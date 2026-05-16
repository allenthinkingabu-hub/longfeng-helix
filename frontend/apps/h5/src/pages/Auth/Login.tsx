// PHASE-A-LOGIN-H5 · P00 login (h5 端)
// SoT: design/mockups/wrongbook/00_login.html (1:1 mirror) + design/system/pages/P00-login.spec.md
// State machine: §6 IDLE → VERIFYING → SUCCESS / FAILED (ANONYMOUS_CLAIM 子态本 task 不实现)

import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TEST_IDS } from '@longfeng/testids';
import s from './Login.module.css';

type AuthState = 'IDLE' | 'VERIFYING' | 'SUCCESS' | 'FAILED';

// §7.1 redirect whitelist — internal-path only · cross-origin / unknown prefixes
// downgraded to /home per spec §9 异常表.
const REDIRECT_WHITELIST_PREFIXES = [
  '/home',
  '/capture',
  '/question/',
  '/result/',
  '/review/',
  '/calendar',
  '/s/',
  '/observer/',
  '/welcome',
  '/welcome-back',
  '/auth',
  '/wrongbook',
];

// inflight scope_in #10/#11 + spec §7.2: default redirect = /home · whitelist applies
// to non-default ?redirect= values · cross-origin / non-whitelist → downgrade to /home
//
// 2026-05-17 Tester adversarial T1 fix · path-traversal hardening:
//   ?redirect=/home/../admin previously passed startsWith('/home') and was returned
//   verbatim · react-router then resolved it to /admin (open-redirect vuln). We now
//   reject any input containing '..' segment OR backslash before whitelist check.
function sanitizeRedirect(raw: string | null): string {
  if (!raw) return '/home';
  if (!raw.startsWith('/')) return '/home'; // strip absolute http://… / //evil
  if (raw.startsWith('//')) return '/home';
  // Reject any path-traversal payload — '..' segment or backslash-escaped traversal.
  // The whole raw value (path + query + hash) is the corpus since it's fed verbatim
  // into navigate(); '..' anywhere is suspicious for an internal-path-only redirect.
  if (raw.includes('..') || raw.includes('\\')) return '/home';
  const path = raw.split('?')[0].split('#')[0];
  for (const prefix of REDIRECT_WHITELIST_PREFIXES) {
    if (path === prefix || path.startsWith(prefix)) return raw;
  }
  return '/home';
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const loc = useLocation();
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const rawRedirect = params.get('redirect');
  const redirect = sanitizeRedirect(rawRedirect);
  // Banner only shows when there's an explicit redirect query (i.e. user came from
  // SC-02 token-expired / SC-13 share / SC-14 welcome-back redirect) — NOT for the
  // default /home target.
  const showRedirectBanner = !!rawRedirect && redirect !== '/home';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [toast, setToast] = useState<string>('');

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2400);
  };

  const canSubmit =
    consentAccepted &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    authState !== 'VERIFYING';

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!consentAccepted) {
      showToast('请先同意服务条款与隐私政策');
      return;
    }
    if (authState === 'VERIFYING') return;
    setAuthState('VERIFYING');
    setErrorMsg('');
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'EMAIL',
          email: email.trim(),
          password,
          rememberMe,
          consentAt: new Date().toISOString(),
        }),
      });

      if (resp.ok) {
        const data = (await resp.json()) as {
          jwt: string;
          refreshToken: string;
          expiresIn: number;
          student: { id: number; nickMasked: string };
        };
        const expiresAt = Date.now() + data.expiresIn * 1000;
        localStorage.setItem('jwt', data.jwt);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('expiresAt', String(expiresAt));
        setAuthState('SUCCESS');
        navigate(redirect, { replace: true });
        return;
      }

      // Try to parse error envelope { code, message, lockedUntil? }
      let body: { code?: string; message?: string; lockedUntil?: string } = {};
      try {
        body = await resp.json();
      } catch {
        // empty body — fall through with generic msg
      }
      if (resp.status === 423 || body.code === 'ACCOUNT_LOCKED') {
        setErrorMsg('账号已锁定 · 5 分钟后重试');
      } else if (resp.status === 401 || body.code === 'INVALID_CREDENTIALS') {
        setErrorMsg('邮箱或密码错误');
      } else {
        setErrorMsg(body.message || '登录失败，请重试');
      }
      setAuthState('FAILED');
    } catch (err) {
      setErrorMsg('网络不可用，请检查后重试');
      setAuthState('FAILED');
    }
  };

  const stubToast = (label: string) => () => showToast(`${label}功能开发中 · 暂请用邮箱密码登录`);

  return (
    <div className={s.root} data-testid={TEST_IDS.p00.root}>
      <div className={s.statusbar} data-testid={TEST_IDS.p00.statusbar}>
        <span>9:41</span>
        <span>•••</span>
      </div>

      {showRedirectBanner && (
        <div className={s.banner} data-testid={TEST_IDS.p00.redirectBanner}>
          登录后将自动打开 {redirect}
        </div>
      )}

      <div className={s.logoWrap} data-testid={TEST_IDS.p00.logoZone}>
        <div className={s.logo}>
          <svg
            data-testid={TEST_IDS.p00.logoZoneLogo}
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
          >
            <rect x="7" y="10" width="34" height="31" rx="7" fill="#fff" opacity=".98" />
            <rect x="7" y="10" width="34" height="10" rx="4" fill="#FFFFFF" />
            <rect x="13" y="6" width="2.6" height="8" rx="1.3" fill="#fff" />
            <rect x="32.4" y="6" width="2.6" height="8" rx="1.3" fill="#fff" />
            <circle cx="16" cy="27" r="2" fill="#0A84FF" />
            <circle cx="24" cy="27" r="2" fill="#FF9500" />
            <circle cx="32" cy="27" r="2" fill="#34C759" />
            <circle cx="16" cy="34" r="2" fill="#C7C7CC" />
            <circle cx="24" cy="34" r="2" fill="#0A84FF" />
            <circle cx="32" cy="34" r="2" fill="#C7C7CC" />
          </svg>
        </div>
      </div>

      <div className={s.appTitle}>日历</div>
      <div className={s.appSub}>
        统一 <b>学习 · 任务 · 提醒 · 备忘</b>
      </div>

      <form className={s.card} onSubmit={handleSubmit} noValidate>
        <div className={`${s.field} ${errorMsg ? s.fieldError : ''}`}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m2 7 10 6 10-6" />
          </svg>
          <input
            type="email"
            placeholder="邮箱或手机号"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            data-testid={TEST_IDS.p00.emailInput}
            autoComplete="username"
          />
        </div>
        <div className={`${s.field} ${errorMsg ? s.fieldError : ''}`}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            data-testid={TEST_IDS.p00.passwordInput}
            autoComplete="current-password"
          />
        </div>

        <div className={s.rowFoot}>
          <label className={s.chk} data-testid={TEST_IDS.p00.rememberMe}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ display: 'none' }}
            />
            <span className={`${s.box} ${!rememberMe ? s.unchecked : ''}`}>
              {rememberMe && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <span>记住我</span>
          </label>
          <button
            type="button"
            className={s.forget}
            data-testid={TEST_IDS.p00.forgetPasswordLink}
            onClick={stubToast('找回密码')}
          >
            忘记密码？
          </button>
        </div>
      </form>

      {errorMsg && (
        <div className={s.errorInline} data-testid={TEST_IDS.p00.errorInline} role="alert">
          {errorMsg}
        </div>
      )}

      <button
        type="button"
        className={`${s.btn} ${s.btnPrimary} ${!canSubmit ? s.btnDisabled : ''}`}
        onClick={() => handleSubmit()}
        data-testid={TEST_IDS.p00.loginSubmitBtn}
      >
        {authState === 'VERIFYING' ? (
          <>
            <span className={s.spinner} aria-hidden="true" />
            登录中...
          </>
        ) : (
          '登录'
        )}
      </button>

      <div className={s.divider}>或使用</div>

      <button
        type="button"
        className={`${s.btn} ${s.btnApple}`}
        data-testid={TEST_IDS.p00.appleCtaBtn}
        onClick={stubToast('Apple 登录')}
      >
        <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true">
          <path d="M13.4 13.7c-.5 1.2-.8 1.7-1.5 2.8-1 1.5-2.4 3.4-4.1 3.4-1.5 0-1.9-1-4-1-2 0-2.5 1-4 1-1.7 0-3-1.7-4-3.2C-6.5 13.3-7 7.6-4.1 4.6c1-1 2.4-1.6 3.7-1.6 1.6 0 2.6 1 3.9 1 1.3 0 2-1 3.9-1 1.5 0 3 .8 4 2.2-3.5 1.9-3 6.9.6 8.5zM9.1-1.9C9.8-2.8 10.3-4 10.2-5.2c-1 .1-2.3.7-3 1.5-.7.7-1.4 2-1.2 3.1 1.1.1 2.3-.6 3.1-1.3z" transform="translate(4 3)" />
        </svg>
        使用 Apple 账号继续
      </button>

      <button
        type="button"
        className={`${s.btn} ${s.btnWechat}`}
        data-iron-rule-1-exception="wechat-brand"
        data-testid={TEST_IDS.p00.wechatCtaBtn}
        onClick={stubToast('微信登录')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9.5 3C5 3 1.5 5.9 1.5 9.5c0 2 1.1 3.8 2.9 5l-.7 2.2 2.6-1.3c.9.2 1.9.4 2.8.3-.2-.6-.3-1.3-.3-2C8.8 10.1 12 7 16 7c.2 0 .5 0 .7.1C16 4.7 13 3 9.5 3zM7 7.2c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1S5.9 9 5.9 8.3 6.4 7.2 7 7.2zm5 0c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1S11 9 11 8.3s.4-1.1 1-1.1zm4 1.6c-3.9 0-7 2.7-7 5.9 0 3.3 3.1 5.9 7 5.9.8 0 1.6-.1 2.4-.3l2.2 1.1-.6-1.8c1.6-1.1 2.6-2.7 2.6-4.5 0-3.2-3-6.3-6.6-6.3zm-2.3 4.2c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zm4.5 0c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z" />
        </svg>
        使用微信登录
      </button>

      <div className={s.foot} data-testid={TEST_IDS.p00.consentBar}>
        <label
          className={s.consentCheckbox}
          data-testid={TEST_IDS.p00.consentCheckbox}
          onClick={(e) => {
            // Prevent parent <a> default · keep label click idiomatic
            e.stopPropagation();
          }}
        >
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            style={{ display: 'none' }}
          />
          <span className={`${s.box} ${!consentAccepted ? s.unchecked : ''}`}>
            {consentAccepted && (
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
        </label>
        登录即表示同意{' '}
        <a data-testid={TEST_IDS.p00.consentLinkTos} onClick={(e) => e.preventDefault()}>
          服务条款
        </a>{' '}
        与{' '}
        <a data-testid={TEST_IDS.p00.consentLinkPrivacy} onClick={(e) => e.preventDefault()}>
          隐私政策
        </a>
      </div>

      {toast && (
        <div className={s.toast} data-testid={TEST_IDS.p00.toast} role="status">
          {toast}
        </div>
      )}
    </div>
  );
};
