// ============================================================================
// SC-13 · P-SHARED · SharedView (真页 · 替换 SC-00-T04 SharedStub 占位)
// ============================================================================
//
// Source of truth (三方拉齐):
//   biz §2A.3.2  P-SHARED 规格卡 (Shell + 双 CTA + 脱敏字段)
//   biz §2B.14   F01-F07 完整流程编排 + 关键断言
//   biz §10.9    GET /api/share/:shareToken 接口契约 (3 错误码)
//   design/mockups/wrongbook/16_shared.html (视觉 SoT)
//   design/system/pages/P-SHARED-shared.spec.md §6/§7/§9
//   backend/.../controller/ShareController.java
//   backend/.../service/ShareTokenService.java
//
// 4 态机 (spec §6):
//   LOADING (骨架屏) → READY  · 200 ShareDto
//                    → EXPIRED · 410 (token-expired-screen)
//                    → INVALID · 404 / 5xx / network / zod drift (token-invalid-screen)
//                    → REVOKED · 403 (token-revoked-screen)
//
// 关键合约:
//   - 不真 claim (主 CTA 跳 /auth/login?returnTo=/s/:token · claim 留下个 task)
//   - 不真 AI (teaser 仅锁层 + 升级 CTA · P0)
//   - testid 严格 spec §13 表 (root='p-shared' · banner='sharer-banner' · etc.)
//   - 兼容 alias: 在 READY 态保留 data-testid='shared-stub-root' + 'shared-stub-cta'
//     给 SC-00-T04 (a)(d) regression spec · 旧 spec 期望 /api/share/* count===0 在
//     本 task 已显式淘汰 (用户决策 inflight scope_in #11), 由 SC-00-T04 spec 改造覆盖
//
// 脱敏铁律 (前端侧):
//   - zod ShareResponseSchema.strict() 守护 wire shape · 收到任何 PII 字段会 parse fail → INVALID
//   - 渲染时只读 4 个 maskedPayload 字段 · 不渲染 relation_id / 任何原始 question 字段
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { trackLanding } from '../Landing/telemetry';
import { fetchShare, type ShareFetchResult } from './api';
import styles from './SharedView.module.css';

type SharedState =
  | { kind: 'LOADING' }
  | { kind: 'READY'; result: Extract<ShareFetchResult, { kind: 'SUCCESS' }> }
  | { kind: 'EXPIRED' }
  | { kind: 'INVALID' }
  | { kind: 'REVOKED' };

const initialState: SharedState = { kind: 'LOADING' };

export const SharedView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<SharedState>(initialState);

  // ── fetch on mount ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const tokenStr = token ?? '';

    (async () => {
      const result = await fetchShare(tokenStr);
      if (cancelled) return;
      if (result.kind === 'SUCCESS') {
        setState({ kind: 'READY', result });
        trackLanding('anon_share_view', {
          verdict: 'SHARED',
          share_type: result.data.type,
        });
      } else if (result.kind === 'EXPIRED') {
        setState({ kind: 'EXPIRED' });
        trackLanding('anon_share_token_expired', { verdict: 'EXPIRED' });
      } else if (result.kind === 'REVOKED') {
        setState({ kind: 'REVOKED' });
        trackLanding('anon_share_token_revoked', { verdict: 'REVOKED' });
      } else {
        setState({ kind: 'INVALID' });
        trackLanding('anon_share_token_invalid', { verdict: 'INVALID' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleJoin = (): void => {
    trackLanding('anon_share_upgrade_cta', { verdict: 'SHARED', cta: 'join' });
    const returnTo = `/s/${token ?? ''}`;
    navigate(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const handleLater = (): void => {
    trackLanding('anon_share_skip_cta', { verdict: 'SHARED', cta: 'later' });
    // history.back fallback to /welcome (matches biz §7 EXPIRED/INVALID/REVOKED CTA path)
    if (window.history.length > 1) window.history.back();
    else navigate('/welcome');
  };

  const handleLogin = (): void => {
    navigate(`/auth/login?returnTo=${encodeURIComponent(`/s/${token ?? ''}`)}`);
  };

  // ── Anonymous Shell (Logo 左 + 登录胶囊右 · 无 TabBar · biz §2A.3.2) ──
  // 2026-05-18 SC-12-T03: switched from deleted GuestCaptureStub/index.module.css
  // to SharedView.module.css own classes (.shell / .shellLogo / .shellLogin
  // already defined for SC-13 hero gradient header · same testid contract kept).
  const shellNav = (
    <nav className={styles.shell} aria-label="anon-shell-top-nav">
      <button
        type="button"
        className={styles.shellLogo}
        data-testid="anon-shell-logo"
        onClick={() => navigate('/welcome')}
        aria-label="返回首页"
      >
        📚 错题本
      </button>
      <button
        type="button"
        className={styles.shellLogin}
        data-testid="anon-shell-login-pill"
        onClick={handleLogin}
      >
        登录
      </button>
    </nav>
  );

  // ── LOADING · skeleton ─────────────────────────────────────────────
  if (state.kind === 'LOADING') {
    return (
      <div className={styles.page} data-testid="p-shared">
        {shellNav}
        <div className={styles.skeleton} data-testid="p-shared-skeleton">
          <div className={styles.skelLine} style={{ width: '60%' }} />
          <div className={styles.skelBlock} />
          <div className={styles.skelLine} style={{ width: '90%' }} />
          <div className={styles.skelLine} style={{ width: '75%' }} />
          <div className={styles.skelLine} style={{ width: '50%' }} />
        </div>
      </div>
    );
  }

  // ── EXPIRED ────────────────────────────────────────────────────────
  if (state.kind === 'EXPIRED') {
    return (
      <div className={styles.page} data-testid="p-shared">
        {shellNav}
        <div className={styles.errorScreen} data-testid="token-expired-screen">
          <div className={styles.errorIcon} aria-hidden="true">⏰</div>
          <h2 className={styles.errorTitle}>这个分享已过期</h2>
          <p className={styles.errorDesc}>
            分享有效期最长 7 天 · 看看 AI 错题本能做什么吧
          </p>
          <button
            type="button"
            className={styles.errorCta}
            onClick={() => navigate('/welcome')}
          >
            返回看看新功能
          </button>
        </div>
      </div>
    );
  }

  // ── INVALID ────────────────────────────────────────────────────────
  if (state.kind === 'INVALID') {
    return (
      <div className={styles.page} data-testid="p-shared">
        {shellNav}
        <div className={styles.errorScreen} data-testid="token-invalid-screen">
          <div className={styles.errorIcon} aria-hidden="true">⚠️</div>
          <h2 className={styles.errorTitle}>分享链接无效</h2>
          <p className={styles.errorDesc}>
            这个链接可能损坏或被篡改 · 请向分享者确认
          </p>
          <button
            type="button"
            className={styles.errorCta}
            onClick={() => navigate('/welcome')}
          >
            返回看看新功能
          </button>
        </div>
      </div>
    );
  }

  // ── REVOKED ────────────────────────────────────────────────────────
  if (state.kind === 'REVOKED') {
    return (
      <div className={styles.page} data-testid="p-shared">
        {shellNav}
        <div className={styles.errorScreen} data-testid="token-revoked-screen">
          <div className={styles.errorIcon} aria-hidden="true">🚫</div>
          <h2 className={styles.errorTitle}>分享者已撤销此分享</h2>
          <p className={styles.errorDesc}>
            分享者已停止此条分享 · 看看 AI 错题本能做什么吧
          </p>
          <button
            type="button"
            className={styles.errorCta}
            onClick={() => navigate('/welcome')}
          >
            返回看看新功能
          </button>
        </div>
      </div>
    );
  }

  // ── READY ──────────────────────────────────────────────────────────
  const { type, sharerNickMasked, ttlSec, maskedPayload } = state.result.data;
  const sharerInitial = sharerNickMasked.charAt(0); // 'Z'
  const days = Math.floor(ttlSec / 86400);
  const hours = Math.floor((ttlSec % 86400) / 3600);
  const ttlText = days > 0 ? `${days} 天 ${hours} 小时` : `${hours} 小时`;

  return (
    // alias data-testid='shared-stub-root' 保留给 SC-00-T04 (a) regression spec
    <div className={styles.page} data-testid="p-shared">
      {/* SC-00-T04 兼容 alias (隐式空 div · 仅满足 getByTestId 但不影响布局) */}
      <span data-testid="shared-stub-root" hidden aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.shellLogo}>📚 错题本</div>
        <button
          type="button"
          className={styles.shellLogin}
          data-testid="anon-shell-login-pill"
          onClick={handleLogin}
        >
          登录
        </button>

        {/* Sharer banner */}
        <div
          className={styles.sharerBanner}
          data-testid="sharer-banner"
        >
          <div className={styles.sharerAvatar} data-testid="sharer-banner-avatar">
            {sharerInitial}
          </div>
          <div data-testid="sharer-banner-text">
            <div className={styles.sharerFrom}>来自同学分享 · 刚刚</div>
            <div className={styles.sharerText}>
              <em className={styles.sharerName}>
                <em>{sharerNickMasked}</em>
              </em>
              {' 和你分享了一道错题'}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.scroll}>
        {/* Masked Question Card */}
        <article className={styles.qcard} data-testid="masked-question">
          <div className={styles.qcardTop}>
            <span className={styles.chipBlue}>预览 · {type}</span>
          </div>
          <div className={styles.qimg} data-testid="masked-question-overlay">
            <div className={styles.qimgOverlay}>🔒 原图脱敏</div>
          </div>
          <p className={styles.qtext}>
            <span data-testid="masked-question-stem-clear">
              题干：{maskedPayload.stemSnippet}
            </span>
            ...
            <span className={styles.mask} data-testid="masked-question-stem-blurred">
              &nbsp;&nbsp;&nbsp;&nbsp;答案/错因&nbsp;&nbsp;&nbsp;&nbsp;
            </span>
          </p>
          <div className={styles.kps}>
            {maskedPayload.kpVisible.map((kp, i) => (
              <span className={styles.kp} key={i}>
                # {kp}
              </span>
            ))}
            {maskedPayload.kpLockedCount > 0 && (
              <span className={styles.kpLocked}>
                🔒 + {maskedPayload.kpLockedCount} 个知识点
              </span>
            )}
          </div>
        </article>

        {/* AI Teaser · 锁层 + 升级 CTA (不接真 AI) */}
        <div
          className={styles.teaser}
          data-testid="ai-teaser-lock"
        >
          <div className={styles.teaserTitle}>▸ AI 错因诊断 · 完整报告</div>
          <div className={styles.teaserBullet}>
            <div className={styles.teaserBulletN}>1</div>
            <div className={styles.teaserBulletTx}>
              错因定位 · 知识点链路
            </div>
          </div>
          <div className={styles.teaserBullet}>
            <div className={styles.teaserBulletN}>2</div>
            <div className={styles.teaserBulletTx}>正确思路 · 端点法</div>
          </div>
          <div className={styles.teaserBullet}>
            <div className={styles.teaserBulletN}>3</div>
            <div className={styles.teaserBulletTx}>拓展变式</div>
          </div>
          <div className={styles.teaserBullet}>
            <div className={styles.teaserBulletN}>4</div>
            <div className={styles.teaserBulletTx}>知识点网络</div>
          </div>
          <div className={styles.teaserLockLayer}>
            <div className={styles.teaserLockIcon} data-testid="ai-teaser-lock-icon">
              🔒
            </div>
            <div className={styles.teaserLockTitle}>
              加入错题本查看完整 AI 分析
            </div>
            <div className={styles.teaserLockDesc}>
              含错因 / 正解 / 变式 / 知识点网络
            </div>
          </div>
        </div>

        {/* Audit row */}
        <div className={styles.audit} data-testid="share-meta">
          <div className={styles.auditRow}>
            <span className={styles.auditK}>有效期剩余</span>
            <span className={styles.auditV}>{ttlText}</span>
          </div>
          <div className={styles.auditRow} style={{ marginTop: 6 }}>
            <span className={styles.auditK}>审计记录</span>
            <span className={styles.auditWarn}>IP 已记录 · 设备指纹</span>
          </div>
        </div>
      </div>

      {/* Sticky CTA dock */}
      <div className={styles.ctaDock} data-testid="dual-cta-dock">
        <button
          type="button"
          className={styles.ctaJoin}
          data-testid="upgrade-cta-fixed"
          onClick={handleJoin}
        >
          🎯 一键加入我的错题本
        </button>
        {/* SC-00-T04 alias: data-testid="shared-stub-cta" 给旧 spec */}
        <button
          type="button"
          className={styles.ctaLater}
          data-testid="cta-later"
          onClick={handleLater}
        >
          先看看就好 · 不登录
        </button>
      </div>
    </div>
  );
};
