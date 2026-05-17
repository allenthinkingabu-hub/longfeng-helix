// ============================================================================
// SC-11-T04 · DualCTA · 双 CTA 吸底 (主蓝「试试看」/ 次灰「已有账号」)
// ============================================================================
//
// Source of truth:
//   biz §2A.3.2 P-LANDING DualCTA + biz §2B.12 F07A/F07B (CTA → 出口)
//   design/system/pages/P-LANDING-landing.spec.md §3 DualCTA
//   inflight.context.scope_in #1 (a-d)
//
// 设计决策:
//   (1) position: sticky bottom-0 + safe-area-inset-bottom env() padding
//       — iOS 刘海屏 / 安卓底部手势区不挡 CTA
//   (2) A/B 桶顺序 prop — experimentBucket='try_first'|'login_first' →
//       CSS flex-direction row vs row-reverse · 用 boundingBox.x 可测
//   (3) navigate 用 react-router-dom useNavigate · 不用 window.location.href
//       (保留 SPA history + React Router state)
//   (4) onClick 先 trackLanding 再 navigate · 避免 navigate 后页面切换
//       导致 sendBeacon 与 pagehide 抢同一窗口
//   (5) /guest/capture 路由 P0 还没真页 (SC-12-STUB-T01 落) · navigate 会被
//       react-router 的 * → Navigate to '/' fallback 接管 · 这是预期 ·
//       测试用 page.on('framenavigated') 序列断言 (URL 曾经短暂出现 /guest/capture)
// ============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TEST_IDS } from '@longfeng/testids';
import { trackLanding } from '../telemetry';
import styles from './index.module.css';

const ids = TEST_IDS.sc11t04;

export type ExperimentBucket = 'try_first' | 'login_first';

interface DualCTAProps {
  /** A/B 桶顺序 · try_first = 主 CTA 在左 · login_first = 次 CTA 在左 (反序) */
  experimentBucket?: ExperimentBucket;
}

/**
 * 双 CTA 吸底组件. mount 即 sticky bottom · 永远可点击 (即使 DEGRADED 态).
 */
export const DualCTA: React.FC<DualCTAProps> = ({
  experimentBucket = 'try_first',
}) => {
  const navigate = useNavigate();

  const handleTry = (): void => {
    // 先埋点 (sendBeacon 已 enqueue) · 再 navigate (页面切换不影响投递)
    trackLanding('anon_landing_cta_try', { target: '/guest/capture' });
    navigate('/guest/capture');
  };

  const handleLogin = (): void => {
    trackLanding('anon_landing_cta_login', { target: '/auth/login' });
    navigate('/auth/login');
  };

  // A/B 桶: try_first → flex-direction:row (主 CTA 在左) · login_first → row-reverse
  const wrapClass =
    experimentBucket === 'login_first'
      ? `${styles.wrap} ${styles.loginFirst}`
      : styles.wrap;

  return (
    <div
      data-testid={ids.ctaWrap}
      data-bucket={experimentBucket}
      className={wrapClass}
      role="group"
      aria-label="主操作按钮"
    >
      <button
        type="button"
        data-testid={ids.ctaTry}
        className={`${styles.cta} ${styles.primary}`}
        onClick={handleTry}
      >
        试试看（无需注册）
      </button>
      <button
        type="button"
        data-testid={ids.ctaLogin}
        className={`${styles.cta} ${styles.secondary}`}
        onClick={handleLogin}
      >
        已有账号 → 登录
      </button>
    </div>
  );
};
