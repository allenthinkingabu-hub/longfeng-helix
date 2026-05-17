// SC-00-T04 · WelcomeBackPage 真 stub 页 · SC-14 P1 fleshes content
//
// Source of truth:
//   biz §2A.3.2 (P-WELCOMEBACK stub 阶段约束)
//   biz §2B.1a 关键断言点 5 (verdict=WELCOME_BACK stub 阶段不调 device-refresh / 二次 resolve)
//   inflight SC-00-T04 scope_in 2
//
// 严禁 (Playwright spy 验证):
//   - /api/auth/device-refresh (SC-14 真双因子)
//   - /api/session/resolve 二次 (避免循环 · 防 stub 页又触发 bootstrap 死循环)

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/stub-card.module.css';

export const WelcomeBackPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[telemetry] anon_stub_view', {
      verdict_intended: 'WELCOME_BACK',
      token_hash: null,
    });
  }, []);

  const handleCta = (): void => {
    // eslint-disable-next-line no-console
    console.log('[telemetry] anon_stub_cta_click', {
      verdict_intended: 'WELCOME_BACK',
    });
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className={styles.page} data-testid="welcomeback-stub-root">
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">👋</div>
        <h2 className={styles.title}>回流唤起功能正在开发中</h2>
        <p className={styles.subtitle}>
          正在开发中 · 现在去登录账号
        </p>
        <button
          type="button"
          className={styles.cta}
          data-testid="welcomeback-stub-cta"
          onClick={handleCta}
        >
          登录账号
        </button>
      </div>
    </div>
  );
};
