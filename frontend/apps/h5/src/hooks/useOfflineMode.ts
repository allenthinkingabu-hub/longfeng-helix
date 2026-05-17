// SC-00-T04 · useOfflineMode hook · 全局离线状态读取
//
// Source of truth:
//   biz §2A.3.1 补丁 3 (离线降级新规则)
//   inflight SC-00-T04 scope_in 4 (c)
//
// 设计:
//   - 全局状态来源: sessionStorage.offlineMode === 'true'
//   - 由 resolve-entry.ts 在 5xx / timeout 时写入
//   - 用户关闭 banner → 写入 sessionStorage.offlineDismissed='true' 让 banner 不再出现
//   - 下次 resolve 成功 → resolve-entry.ts 删 sessionStorage.offlineMode 让 banner 自动消失
//   - 用 storage 事件 + 自定义 'offline-mode-change' 事件双订阅 · 跨 tab + 同 tab 都响应

import { useEffect, useState, useCallback } from 'react';

const OFFLINE_MODE_KEY = 'offlineMode';
const OFFLINE_DISMISSED_KEY = 'offlineDismissed';
const CHANGE_EVENT = 'offline-mode-change';

function readState(): { offline: boolean; dismissed: boolean } {
  try {
    return {
      offline: sessionStorage.getItem(OFFLINE_MODE_KEY) === 'true',
      dismissed: sessionStorage.getItem(OFFLINE_DISMISSED_KEY) === 'true',
    };
  } catch {
    return { offline: false, dismissed: false };
  }
}

export interface UseOfflineModeResult {
  /** Whether the offline banner should currently render. */
  visible: boolean;
  /** Hide the banner for the rest of this session (sessionStorage flag). */
  dismiss: () => void;
}

export function useOfflineMode(): UseOfflineModeResult {
  const [state, setState] = useState(() => readState());

  useEffect(() => {
    const update = (): void => setState(readState());
    // Cross-tab: storage event fires on other tabs (sessionStorage doesn't bridge
    // across tabs, but localStorage does — we keep listener anyway in case
    // resolve writes localStorage later · cheap).
    window.addEventListener('storage', update);
    // Same-tab: custom event dispatched by resolve-entry.ts after writes.
    window.addEventListener(CHANGE_EVENT, update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener(CHANGE_EVENT, update);
    };
  }, []);

  const dismiss = useCallback((): void => {
    try {
      sessionStorage.setItem(OFFLINE_DISMISSED_KEY, 'true');
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const visible = state.offline && !state.dismissed;
  return { visible, dismiss };
}

/** Dispatch the change event manually — called by resolve-entry.ts after sessionStorage write. */
export function notifyOfflineModeChange(): void {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
