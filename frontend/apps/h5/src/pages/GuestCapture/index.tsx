// ============================================================================
// SC-12-T10 · P-GUEST-CAPTURE 完整真页 (升级 SC-12-T03 stub-ish 版本)
// ============================================================================
//
// Source of truth (biz + design + code 三方拉齐):
//   biz §2A.3.2 P-GUEST-CAPTURE 完整规格卡 (布局 · ConsentBar · Shutter · 异常态)
//   biz §2B.13 SC-12 F01-F10 (mount → consent → 拍照 → 上传 → AI → 结果 → claim)
//   design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md §6 状态机
//   backend/anonymous-service AnonSession/Consent/Presign/Question/Analyze/Result/Claim Controller
//
// 状态机 (spec §6 · 本 task 完整版):
//   BOOTSTRAPPING (mount 中 · 调 /api/anon/session)
//     ├ 200 → IDLE                    (consent 未勾 · shutter disabled)
//     └ fail → ERROR                  (errorBanner · '初始化失败 · 请刷新重试')
//   IDLE
//     └ consent.check → CONSENT_PENDING (PATCH consent · shutter unlock)
//   CONSENT_PENDING
//     └ click Shutter (first tap) → 启动相机 getUserMedia → CAMERA_ACTIVE
//   CAMERA_ACTIVE
//     └ click Shutter (二次 tap) → canvas snapshot → UPLOADING
//   UPLOADING
//     ├ presign + PUT + questions + analyze 链 → ANALYZING
//     ├ analyze 429 → QUOTA_EXHAUSTED (整页挡板 + Retry-After 倒计时)
//     ├ analyze 502 / network fail → ERROR (红条 + 重试)
//   ANALYZING (1Hz GET /api/anon/result/{id} 轮询 · 30s timeout)
//     ├ result.status='READY' → READY (显示 4 卡片 + CTA)
//     ├ result.status='FAILED' → FAILED (errorBanner · '注册后重试')
//     ├ 30s timeout → ERROR (红条 · 'AI 分析超时')
//   READY
//     └ click ctaSaveToWrongbook → navigate /auth/login?anonToken=...&returnTo=/guest/capture
//
// NO MOCK 铁律 (用户铁律 · 前端版):
//   - 真 fetch :8090 / :8083 / :8082 / :9000 (vite proxy)
//   - 真相机用 Chromium --use-fake-device-for-media-stream (浏览器 capability)
//   - 真 PUT 到 Minio presigned URL · 真 image/jpeg bytes
//
// 反 React.StrictMode 双 mount: useRef('mintedRef') · pollIntervalRef 清理.
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEST_IDS } from '@longfeng/testids';
import {
  GUEST_EVENTS,
  computeDeviceFp,
  sanitizeEntrySource,
  trackGuestCapture,
} from './telemetry';
import styles from './index.module.css';

type Phase =
  | 'BOOTSTRAPPING'
  | 'IDLE'
  | 'CONSENT_PENDING'
  | 'CAMERA_ACTIVE'
  | 'UPLOADING'
  | 'ANALYZING'
  | 'READY'
  | 'FAILED'
  | 'QUOTA_EXHAUSTED'
  | 'ERROR';

interface SessionMint {
  anonToken: string;
  anonSessionId: number;
  expiresAt: string;
}

interface ConsentState {
  checked: boolean;
  consentAt: string | null;
}

interface AnalyzeResult {
  subject: string;
  stem_length: number;
  chat_model: string;
  ocr_model: string;
}

interface PresignResponse {
  upload_url: string;
  file_key: string;
}

const ENDPOINT_MINT = '/api/anon/session';
const ENDPOINT_PRESIGN = '/api/anon/file/presign';
const ENDPOINT_QUESTIONS = '/api/anon/questions';
const ENDPOINT_ANALYZE = '/api/anon/analyze-by-url';
const endpointConsent = (id: number): string =>
  `/api/anon/session/${id}/consent`;
const endpointResult = (id: number): string => `/api/anon/result/${id}`;

const POLL_INTERVAL_MS = 1000;
const POLL_MAX_SECONDS = 30;
const DEFAULT_SUBJECT = 'math';
const JPEG_QUALITY = 0.85;

/** crypto.randomUUID with fallback for jsdom / older browsers. */
function genUuid(): string {
  try {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  // Fallback: timestamp + random
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

export const GuestCapturePage: React.FC = () => {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('BOOTSTRAPPING');
  const [session, setSession] = useState<SessionMint | null>(null);
  const [consent, setConsent] = useState<ConsentState>({
    checked: false,
    consentAt: null,
  });
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [retryAfter, setRetryAfter] = useState<number>(0);

  // Refs · React.StrictMode double-mount guards + DOM/stream/interval handles.
  const mintedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const retryCountdownRef = useRef<number | null>(null);
  const sessionRef = useRef<SessionMint | null>(null);

  // Keep ref in sync with state (avoid stale closure in polling callbacks)
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // ── Mount: mint session (T03 logic) ──────────────────────────────────────
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
        trackGuestCapture(GUEST_EVENTS.view, {
          device_fp: deviceFp,
          entry_source: entrySource,
        });
      })
      .catch(() => {
        setErrorMsg('初始化失败 · 请刷新重试');
        setPhase('ERROR');
      });
  }, []);

  // ── Cleanup on unmount: stop stream + clear intervals ────────────────────
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current !== null) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (retryCountdownRef.current !== null) {
        window.clearInterval(retryCountdownRef.current);
        retryCountdownRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ── Bind video srcObject when stream changes / phase=CAMERA_ACTIVE ───────
  useEffect(() => {
    if (phase === 'CAMERA_ACTIVE' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  // ── Consent toggle (T03 logic preserved) ─────────────────────────────────
  const onConsentChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    if (!session) return;
    const next = e.target.checked;
    if (!next) {
      setConsent({ checked: false, consentAt: null });
      if (phase === 'CONSENT_PENDING') setPhase('IDLE');
      return;
    }
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
      trackGuestCapture(GUEST_EVENTS.consent, {
        device_fp: computeDeviceFp(),
        consent_type: 1,
      });
    } catch {
      setConsent({ checked: false, consentAt: null });
      setErrorMsg('Consent 失败 · 请重试');
    }
  };

  // ── Start camera (first Shutter tap in CONSENT_PENDING) ──────────────────
  const startCamera = useCallback(async (): Promise<void> => {
    try {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        throw new Error('getUserMedia_unavailable');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setPhase('CAMERA_ACTIVE');
    } catch {
      setErrorMsg('相机授权失败 · 请允许相机权限');
      setPhase('ERROR');
      trackGuestCapture(GUEST_EVENTS.error, { reason: 'camera_denied' });
    }
  }, []);

  // ── Start polling 1Hz · 30s timeout ──────────────────────────────────────
  const startPolling = useCallback((): void => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
    }
    let elapsed = 0;
    const interval = window.setInterval(() => {
      void (async (): Promise<void> => {
        elapsed += 1;
        const s = sessionRef.current;
        if (!s) return;
        if (elapsed > POLL_MAX_SECONDS) {
          window.clearInterval(interval);
          pollIntervalRef.current = null;
          setErrorMsg('AI 分析超时 · 注册后重试');
          setPhase('ERROR');
          trackGuestCapture(GUEST_EVENTS.error, { reason: 'poll_timeout' });
          return;
        }
        try {
          const r = await fetch(endpointResult(s.anonSessionId), {
            method: 'GET',
            headers: { 'X-Anon-Token': s.anonToken },
          });
          if (!r.ok) return; // transient · keep polling
          const data = (await r.json()) as {
            status: 'ANALYZING' | 'READY' | 'FAILED';
            result?: AnalyzeResult;
            error_code?: string;
          };
          if (data.status === 'ANALYZING') {
            return;
          }
          if (data.status === 'READY' && data.result) {
            window.clearInterval(interval);
            pollIntervalRef.current = null;
            setResult(data.result);
            setPhase('READY');
            trackGuestCapture(GUEST_EVENTS.analyzeDone, {
              status: 'READY',
              chat_model: data.result.chat_model,
              ocr_model: data.result.ocr_model,
              stem_length: data.result.stem_length,
            });
          } else if (data.status === 'FAILED') {
            window.clearInterval(interval);
            pollIntervalRef.current = null;
            setErrorMsg('AI 分析失败 · ' + (data.error_code || '请重试'));
            setPhase('FAILED');
            trackGuestCapture(GUEST_EVENTS.analyzeDone, {
              status: 'FAILED',
              error_code: data.error_code,
            });
          }
        } catch {
          /* network blip · keep polling */
        }
      })();
    }, POLL_INTERVAL_MS);
    pollIntervalRef.current = interval;
  }, []);

  // ── Capture + upload chain ───────────────────────────────────────────────
  const captureAndUpload = useCallback(async (): Promise<void> => {
    if (!session || !videoRef.current || !streamRef.current) {
      setErrorMsg('相机未就绪 · 请重试');
      setPhase('ERROR');
      return;
    }
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setErrorMsg('图片捕获失败 · canvas 不可用');
      setPhase('ERROR');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY);
    });
    if (!blob) {
      setErrorMsg('图片捕获失败 · 请重试');
      setPhase('ERROR');
      return;
    }

    // Stop camera tracks before upload to free hardware
    streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setPhase('UPLOADING');
    trackGuestCapture(GUEST_EVENTS.shoot, {
      size: blob.size,
      mime: 'image/jpeg',
    });

    try {
      // (1) Presign
      const presignResp = await fetch(ENDPOINT_PRESIGN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Anon-Token': session.anonToken,
        },
        body: JSON.stringify({
          filename: 'guest.jpg',
          mime: 'image/jpeg',
          size: blob.size,
          purpose: 'GUEST_CAPTURE',
        }),
      });
      if (!presignResp.ok) {
        throw new Error('presign_failed_' + presignResp.status);
      }
      const presign = (await presignResp.json()) as PresignResponse;

      // (2) PUT to Minio
      const putResp = await fetch(presign.upload_url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/jpeg' },
      });
      if (!putResp.ok) {
        throw new Error('upload_failed_' + putResp.status);
      }

      // (3) POST /api/anon/questions (idempotency)
      const idemKey = 'cli-' + genUuid();
      const qResp = await fetch(ENDPOINT_QUESTIONS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Anon-Token': session.anonToken,
          'X-Idempotency-Key': idemKey,
        },
        body: JSON.stringify({
          objectKey: presign.file_key,
          subject: DEFAULT_SUBJECT,
        }),
      });
      if (!qResp.ok) {
        throw new Error('questions_failed_' + qResp.status);
      }

      // (4) POST /api/anon/analyze-by-url
      const aResp = await fetch(ENDPOINT_ANALYZE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Anon-Token': session.anonToken,
        },
        body: JSON.stringify({
          anonQid: session.anonSessionId,
          subject: DEFAULT_SUBJECT,
        }),
      });
      if (aResp.status === 429) {
        const retryAfterRaw = aResp.headers.get('Retry-After') || '0';
        const retryAfterSec = parseInt(retryAfterRaw, 10) || 0;
        setRetryAfter(retryAfterSec);
        setPhase('QUOTA_EXHAUSTED');
        trackGuestCapture(GUEST_EVENTS.quotaExhausted, {
          retry_after: retryAfterSec,
        });
        // Start countdown
        if (retryAfterSec > 0) {
          if (retryCountdownRef.current !== null) {
            window.clearInterval(retryCountdownRef.current);
          }
          const cd = window.setInterval(() => {
            setRetryAfter((prev) => {
              if (prev <= 1) {
                if (retryCountdownRef.current !== null) {
                  window.clearInterval(retryCountdownRef.current);
                  retryCountdownRef.current = null;
                }
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          retryCountdownRef.current = cd;
        }
        return;
      }
      if (!aResp.ok) {
        throw new Error('analyze_failed_' + aResp.status);
      }

      // (5) Enter ANALYZING + start 1Hz polling
      setPhase('ANALYZING');
      trackGuestCapture(GUEST_EVENTS.analyzeStart, {
        anon_qid: session.anonSessionId,
        subject: DEFAULT_SUBJECT,
      });
      startPolling();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      setErrorMsg('网络错误 · 请重试 (' + msg + ')');
      setPhase('ERROR');
      trackGuestCapture(GUEST_EVENTS.error, { reason: msg });
    }
  }, [session, startPolling]);

  // ── Shutter dispatch (multi-state) ───────────────────────────────────────
  const onShutterClick = useCallback((): void => {
    if (phase === 'CONSENT_PENDING') {
      void startCamera();
      return;
    }
    if (phase === 'CAMERA_ACTIVE') {
      void captureAndUpload();
      return;
    }
    // Other phases · shutter disabled · no-op
  }, [phase, startCamera, captureAndUpload]);

  // ── Retry from ERROR / FAILED ─────────────────────────────────────────────
  const onRetryClick = useCallback((): void => {
    setErrorMsg('');
    setResult(null);
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    // Reset back to consent-checked state (user can re-shoot)
    if (consent.checked) {
      setPhase('CONSENT_PENDING');
    } else {
      setPhase('IDLE');
    }
  }, [consent.checked]);

  // ── Save CTA · navigate to login w/ anonToken + returnTo ─────────────────
  const onSaveCta = useCallback((): void => {
    if (!session) return;
    trackGuestCapture(GUEST_EVENTS.ctaSave, {
      anon_session_id: session.anonSessionId,
    });
    const url =
      '/auth/login?anonToken=' +
      encodeURIComponent(session.anonToken) +
      '&returnTo=' +
      encodeURIComponent('/guest/capture');
    navigate(url);
  }, [navigate, session]);

  // ── Quota blocker CTA ────────────────────────────────────────────────────
  const onQuotaCta = useCallback((): void => {
    navigate('/auth/login');
  }, [navigate]);

  const handleLogoTap = (): void => {
    navigate('/welcome');
  };

  const handleLoginTap = (): void => {
    navigate('/auth/login');
  };

  const shutterDisabled =
    phase === 'BOOTSTRAPPING' ||
    phase === 'ERROR' ||
    phase === 'IDLE' ||
    phase === 'UPLOADING' ||
    phase === 'ANALYZING' ||
    phase === 'READY' ||
    phase === 'FAILED' ||
    phase === 'QUOTA_EXHAUSTED' ||
    (phase === 'CONSENT_PENDING' && !consent.checked);

  // QUOTA_EXHAUSTED full-page blocker overrides normal layout
  if (phase === 'QUOTA_EXHAUSTED') {
    return (
      <div
        className={styles.page}
        data-testid={TEST_IDS.pGuestCapture.root}
        data-phase={phase}
      >
        <div
          className={styles.quotaBlocker}
          data-testid={TEST_IDS.pGuestCapture.quotaBlocker}
          role="alert"
        >
          <h2 className={styles.quotaTitle}>今日免费试用额度已用完</h2>
          <p className={styles.quotaSubtitle}>注册后不限次 · 跨设备同步错题</p>
          {retryAfter > 0 && (
            <p
              className={styles.quotaRetryAfter}
              data-testid={TEST_IDS.pGuestCapture.quotaRetryAfter}
            >
              Retry-After: {retryAfter} 秒后可再次免费试用
            </p>
          )}
          <button
            type="button"
            className={styles.quotaCta}
            data-testid={TEST_IDS.pGuestCapture.quotaBlockerCta}
            onClick={onQuotaCta}
          >
            立即注册 · 不限次
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.page}
      data-testid={TEST_IDS.pGuestCapture.root}
      data-phase={phase}
    >
      {/* 顶部匿名 Shell nav (biz §2A.3.2) */}
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

      {/* QuotaBanner · 固定 1 次 · biz §2A.3.2 */}
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

      {/* CameraPreview · 真 video el (CAMERA_ACTIVE) 或占位 div */}
      <div
        className={styles.cameraPreview}
        data-testid={TEST_IDS.pGuestCapture.cameraPreview}
      >
        {phase === 'CAMERA_ACTIVE' ? (
          <video
            ref={videoRef}
            className={styles.cameraVideo}
            data-testid={TEST_IDS.pGuestCapture.cameraVideo}
            autoPlay
            playsInline
            muted
          />
        ) : phase === 'UPLOADING' ? (
          <div
            className={styles.uploadProgress}
            data-testid={TEST_IDS.pGuestCapture.uploadProgress}
            role="status"
          >
            <span className={styles.spinner} aria-hidden="true" />
            <span>正在上传...</span>
          </div>
        ) : phase === 'ANALYZING' ? (
          <div
            className={styles.analyzingProgress}
            data-testid={TEST_IDS.pGuestCapture.analyzingProgress}
            role="status"
          >
            <span className={styles.spinner} aria-hidden="true" />
            <span>AI 正在分析中...</span>
          </div>
        ) : phase === 'READY' && result ? (
          <div
            className={styles.resultCard}
            data-testid={TEST_IDS.pGuestCapture.resultCard}
          >
            <h3 className={styles.resultTitle}>分析完成</h3>
            <div className={styles.resultGrid}>
              <div
                className={styles.resultItem}
                data-testid={TEST_IDS.pGuestCapture.resultSubject}
              >
                <span className={styles.resultLabel}>学科</span>
                <span className={styles.resultValue}>{result.subject}</span>
              </div>
              <div
                className={styles.resultItem}
                data-testid={TEST_IDS.pGuestCapture.resultStemLength}
              >
                <span className={styles.resultLabel}>题干长度</span>
                <span className={styles.resultValue}>{result.stem_length}</span>
              </div>
              <div
                className={styles.resultItem}
                data-testid={TEST_IDS.pGuestCapture.resultChatModel}
              >
                <span className={styles.resultLabel}>AI 模型</span>
                <span className={styles.resultValue}>{result.chat_model}</span>
              </div>
              <div
                className={styles.resultItem}
                data-testid={TEST_IDS.pGuestCapture.resultOcrModel}
              >
                <span className={styles.resultLabel}>OCR 模型</span>
                <span className={styles.resultValue}>{result.ocr_model}</span>
              </div>
            </div>
          </div>
        ) : (
          <span>相机预览 (勾选 consent 后点击下方按钮启动)</span>
        )}
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
          disabled={
            phase === 'BOOTSTRAPPING' ||
            phase === 'ERROR' ||
            phase === 'CAMERA_ACTIVE' ||
            phase === 'UPLOADING' ||
            phase === 'ANALYZING' ||
            phase === 'READY' ||
            phase === 'FAILED'
          }
          aria-describedby="guest-consent-label"
        />
        <label className={styles.consentLabel} id="guest-consent-label">
          我已阅读并同意《未成年人保护条款》《游客试用协议》
        </label>
      </div>

      {/* Shutter · multi-state (start camera / capture) · OR primary CTA in READY */}
      <div className={styles.shutterWrap}>
        {phase === 'READY' ? (
          <button
            type="button"
            className={styles.ctaPrimary}
            data-testid={TEST_IDS.pGuestCapture.ctaSaveToWrongbook}
            onClick={onSaveCta}
          >
            保存到错题本
          </button>
        ) : (
          <button
            type="button"
            className={styles.shutter}
            data-testid={TEST_IDS.pGuestCapture.shutter}
            disabled={shutterDisabled}
            onClick={onShutterClick}
            aria-label={
              phase === 'CAMERA_ACTIVE' ? '拍照' : '启动相机 · 拍照分析'
            }
          >
            {phase === 'CAMERA_ACTIVE' ? '● 拍照' : '● Analyze'}
          </button>
        )}
      </div>

      {/* ErrorBanner · phase===ERROR/FAILED 时显示 + 重试按钮 */}
      {(phase === 'ERROR' || phase === 'FAILED') && errorMsg && (
        <div
          className={styles.errorBanner}
          data-testid={TEST_IDS.pGuestCapture.errorBanner}
          role="alert"
        >
          <span className={styles.errorMsg}>{errorMsg}</span>
          <button
            type="button"
            className={styles.errorRetry}
            data-testid={TEST_IDS.pGuestCapture.errorRetryBtn}
            onClick={onRetryClick}
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
};
