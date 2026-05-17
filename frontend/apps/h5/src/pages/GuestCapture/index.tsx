// ============================================================================
// SC-12-T03 · P-GUEST-CAPTURE 真页 (替换 SC-12-STUB-T01 stub)
// ============================================================================
//
// Source of truth (biz + design + code 三方拉齐):
//   biz §2A.3.2 P-GUEST-CAPTURE 规格卡 (布局分区 · 顶部 quota + ConsentBar + Shutter)
//   biz §2B.13 SC-12 F01 (mount → POST /api/anon/session · 200ms 预算)
//                    F02 (consent 勾选 → consent_at 写库)
//   design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md §6 状态机
//   backend/anonymous-service AnonSessionController + AnonSessionConsentController
//
// 状态机 (spec §6):
//   BOOTSTRAPPING (mount 中 · 调 /api/anon/session)
//     ├ 200 → IDLE                (consent 未勾 · shutter disabled)
//     └ fail → ERROR              (errorBanner 渲染 · '初始化失败 · 请刷新重试')
//   IDLE
//     └ consent.check → CONSENT_PENDING (调 PATCH consent · shutter unlock)
//
// 本 task 不实现 (留 T04+):
//   - 真相机 getUserMedia + 图片捕获 → cameraPreview 是占位 div
//   - 上传 / OSS presign / AI analyze / 轮询 / claim / quota 挡板
//
// 反 React.StrictMode 双 mount: useRef('mintedRef') 守 mint 只调一次.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEST_IDS } from '@longfeng/testids';
import {
  computeDeviceFp,
  sanitizeEntrySource,
  trackGuestCapture,
} from './telemetry';
import styles from './index.module.css';

type Phase = 'BOOTSTRAPPING' | 'IDLE' | 'CONSENT_PENDING' | 'ERROR';

interface SessionMint {
  anonToken: string;
  anonSessionId: number;
  expiresAt: string;
}

interface ConsentState {
  checked: boolean;
  consentAt: string | null;
}

const ENDPOINT_MINT = '/api/anon/session';
const endpointConsent = (id: number): string =>
  `/api/anon/session/${id}/consent`;

export const GuestCapturePage: React.FC = () => {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('BOOTSTRAPPING');
  const [session, setSession] = useState<SessionMint | null>(null);
  const [consent, setConsent] = useState<ConsentState>({
    checked: false,
    consentAt: null,
  });
  const [errorMsg, setErrorMsg] = useState<string>('');

  // React.StrictMode 双 mount guard · mint 只调一次.
  const mintedRef = useRef(false);

  useEffect(() => {
    if (mintedRef.current) return;
    mintedRef.current = true;

    const deviceFp = computeDeviceFp();
    const entrySource = sanitizeEntrySource(
      new URLSearchParams(window.location.search).get('entry_source'),
    );

    fetch(ENDPOINT_MINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceFp, entrySource }),
    })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error('mint_failed_' + r.status);
        }
        return (await r.json()) as SessionMint;
      })
      .then((data) => {
        try {
          sessionStorage.setItem('anon_token', data.anonToken);
          sessionStorage.setItem('anon_session_id', String(data.anonSessionId));
        } catch {
          /* private mode / quota exceeded · 不阻塞流程 */
        }
        setSession(data);
        setPhase('IDLE');
        trackGuestCapture('anon_guest_capture_view', {
          device_fp: deviceFp,
          entry_source: entrySource,
        });
      })
      .catch(() => {
        setErrorMsg('初始化失败 · 请刷新重试');
        setPhase('ERROR');
      });
  }, []);

  const onConsentChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    if (!session) return;
    const next = e.target.checked;
    if (!next) {
      // uncheck · 仅前端状态回退 (后端 last-writer-wins · 不调 PATCH 0)
      setConsent({ checked: false, consentAt: null });
      // 回 IDLE (consent 取消后 shutter 又 disabled)
      if (phase === 'CONSENT_PENDING') setPhase('IDLE');
      return;
    }
    // 乐观更新: 立刻把 UI 翻成 checked · 让 controlled component 反映用户意图.
    // PATCH 完成后再把 consentAt 写回; 失败则回滚 checked → false.
    // 这是 controlled checkbox 的标准模式 · 也让 Playwright 的 .check() 不需
    // 反复重试等待 async state (避免 "click did not change state" timeout).
    setConsent({ checked: true, consentAt: null });
    try {
      const r = await fetch(endpointConsent(session.anonSessionId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Anon-Token': session.anonToken,
        },
        body: JSON.stringify({ consentType: 1 }),
      });
      if (!r.ok) throw new Error('consent_failed_' + r.status);
      const data = (await r.json()) as {
        consentAt: string;
        consentType: number;
      };
      setConsent({ checked: true, consentAt: data.consentAt });
      setPhase('CONSENT_PENDING');
      trackGuestCapture('anon_guest_consent', {
        device_fp: computeDeviceFp(),
        consent_type: 1,
      });
    } catch {
      // 失败回滚 checked · 让用户重试
      setConsent({ checked: false, consentAt: null });
      setErrorMsg('Consent 失败 · 请重试');
    }
  };

  const handleLogoTap = (): void => {
    navigate('/welcome');
  };

  const handleLoginTap = (): void => {
    navigate('/auth/login');
  };

  const shutterDisabled =
    !consent.checked || phase === 'BOOTSTRAPPING' || phase === 'ERROR';

  return (
    <div
      className={styles.page}
      data-testid={TEST_IDS.pGuestCapture.root}
      data-phase={phase}
    >
      {/* 顶部匿名 Shell nav (biz §2A.3.2) — Logo 左 + 登录胶囊右 · 无 Tab Bar */}
      <nav
        className={styles.shellNav}
        data-testid={TEST_IDS.pGuestCapture.shellNav}
        aria-label="anon-shell-top-nav"
      >
        <button
          type="button"
          className={styles.shellLogo}
          data-testid={TEST_IDS.pGuestCapture.shellLogo}
          onClick={handleLogoTap}
          aria-label="返回首页"
        >
          <span className={styles.guestDot} aria-hidden="true" />
          GUEST · 错题本
        </button>
        <button
          type="button"
          className={styles.loginBtn}
          data-testid={TEST_IDS.pGuestCapture.loginBtn}
          onClick={handleLoginTap}
        >
          登录
        </button>
      </nav>

      {/* QuotaBanner · 固定 1 次 · 文案 biz §2A.3.2 (T06 接真 quota 时改 dynamic) */}
      <div
        className={styles.quotaBanner}
        data-testid={TEST_IDS.pGuestCapture.quotaBanner}
      >
        今日还剩{' '}
        <span
          className={styles.quotaRemaining}
          data-testid={TEST_IDS.pGuestCapture.quotaRemaining}
        >
          1
        </span>{' '}
        次 · 结果保留 24h 可保存到错题本
      </div>

      {/* CameraPreview · T03 占位 div · T04 接 getUserMedia */}
      <div
        className={styles.cameraPreview}
        data-testid={TEST_IDS.pGuestCapture.cameraPreview}
      >
        相机预览 (T04 启用)
      </div>

      {/* ConsentCard · 勾选 → PATCH consent · 解锁 Shutter */}
      <div
        className={styles.consentCard}
        data-testid={TEST_IDS.pGuestCapture.consentCard}
      >
        <input
          type="checkbox"
          className={styles.consentCheckbox}
          data-testid={TEST_IDS.pGuestCapture.consentCheckbox}
          checked={consent.checked}
          onChange={onConsentChange}
          disabled={phase === 'BOOTSTRAPPING' || phase === 'ERROR'}
          aria-describedby="guest-consent-label"
        />
        <label className={styles.consentLabel} id="guest-consent-label">
          我已阅读并同意《未成年人保护条款》《游客试用协议》
        </label>
      </div>

      {/* Shutter · consent 未勾时 disabled */}
      <div className={styles.shutterWrap}>
        <button
          type="button"
          className={styles.shutter}
          data-testid={TEST_IDS.pGuestCapture.shutter}
          disabled={shutterDisabled}
          aria-label="拍照分析"
        >
          ● Analyze
        </button>
      </div>

      {/* ErrorBanner · phase === 'ERROR' 时渲染 */}
      {phase === 'ERROR' && errorMsg && (
        <div
          className={styles.errorBanner}
          data-testid={TEST_IDS.pGuestCapture.errorBanner}
          role="alert"
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
};
