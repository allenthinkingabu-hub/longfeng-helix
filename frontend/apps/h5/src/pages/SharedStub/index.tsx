// SC-00-T04 · SharedStubPage 真 stub 页 · SC-13 fleshes content
//
// Source of truth:
//   biz §2A.3.2 (P-SHARED stub 阶段约束 · 占位文字 + 主 CTA)
//   biz §2B.1a 关键断言点 5 (verdict=SHARED stub 阶段不调 /api/share/*)
//   inflight SC-00-T04 scope_in 1
//
// 严禁 (Playwright spy 验证):
//   - 调用 /api/share/* (P0 stub 不消费 share token · 真预览留 SC-13)
//
// 埋点:
//   - mount: anon_stub_view{verdict_intended:'SHARED', token_hash}
//   - CTA click: anon_stub_cta_click{verdict_intended:'SHARED'}
// token_hash 用 simple djb2 hash 避免明文 PII 泄漏。

import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from '../../styles/stub-card.module.css';
import { djb2Hex } from '../../utils/djb2';

export const SharedStubPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const tokenHash = token ? djb2Hex(token) : null;

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[telemetry] anon_stub_view', {
      verdict_intended: 'SHARED',
      token_hash: tokenHash,
    });
  }, [tokenHash]);

  const handleCta = (): void => {
    // eslint-disable-next-line no-console
    console.log('[telemetry] anon_stub_cta_click', {
      verdict_intended: 'SHARED',
    });
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className={styles.page} data-testid="shared-stub-root">
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">✉️</div>
        <h2 className={styles.title}>分享内容功能正在开发中</h2>
        <p className={styles.subtitle}>
          我们正在搭建分享预览页 · 现在去登录账号查看完整错题本
        </p>
        <button
          type="button"
          className={styles.cta}
          data-testid="shared-stub-cta"
          onClick={handleCta}
        >
          立即注册 / 登录
        </button>
      </div>
    </div>
  );
};
