// SC-00-T04 · OfflineBanner · 离线降级真 UI (顶部黄条)
//
// Source of truth:
//   biz §2A.3.1 补丁 3 (离线降级新规则 · 黄条 + 关闭)
//   inflight SC-00-T04 scope_in 4
//
// 触发条件 (由 useOfflineMode() 计算):
//   - sessionStorage.offlineMode === 'true' (resolve-entry.ts 在 5xx / abort 时写)
//   - 且 sessionStorage.offlineDismissed !== 'true' (用户当前 session 未关过)

import React from 'react';
import { useOfflineMode } from '../../hooks/useOfflineMode';
import styles from './index.module.css';

export const OfflineBanner: React.FC = () => {
  const { visible, dismiss } = useOfflineMode();
  if (!visible) return null;
  return (
    <div className={styles.root} data-testid="offline-banner-root" role="status">
      <span className={styles.text}>离线模式 · 数据可能不是最新</span>
      <button
        type="button"
        className={styles.close}
        data-testid="offline-banner-close"
        aria-label="关闭离线提示"
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  );
};
