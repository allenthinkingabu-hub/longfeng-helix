// SC-00-T04 · ObserverStubPage 真 stub 页 · SC-15 (P1) fleshes content
//
// Source of truth:
//   biz §2A.3.2 (P-OBSERVER stub 阶段约束)
//   biz §2B.1a 关键断言点 5 (verdict=OBSERVER stub 阶段不调 /api/observer/*)
//   inflight SC-00-T04 scope_in 3
//
// 严禁 (Playwright spy 验证):
//   - /api/observer/* (SC-15 exchange + READ JWT 真页留 P1)

import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from '../../styles/stub-card.module.css';
import { djb2Hex } from '../../utils/djb2';

export const ObserverStubPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const tokenHash = code ? djb2Hex(code) : null;

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[telemetry] anon_stub_view', {
      verdict_intended: 'OBSERVER',
      token_hash: tokenHash,
    });
  }, [tokenHash]);

  const handleCta = (): void => {
    // eslint-disable-next-line no-console
    console.log('[telemetry] anon_stub_cta_click', {
      verdict_intended: 'OBSERVER',
    });
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className={styles.page} data-testid="observer-stub-root">
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">👀</div>
        <h2 className={styles.title}>观察者邀请功能正在开发中</h2>
        <p className={styles.subtitle}>
          家长 / 老师查看孩子进度功能 P1 上线
        </p>
        <button
          type="button"
          className={styles.cta}
          data-testid="observer-stub-cta"
          onClick={handleCta}
        >
          立即注册 / 登录
        </button>
      </div>
    </div>
  );
};
