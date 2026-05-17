// ============================================================================
// SC-00-T01 · BootstrapGate.tsx · 启动闸门
// ============================================================================
// 包在 <BrowserRouter> 内 (路由 hooks 可用) · 仅在 path='/' or '/home' or '/auth/login'
// 时 await resolveEntry() · 其他 deeplink (含 /s/:token & /observer/:code) 走外层
// — 注意: deeplink /s/* /observer/* 在路由层匹配 SharedStub/ObserverStub 占位页, 但
// resolveEntry() 内部对 /s/* /observer/* path 会自动 forceBackend=true 调后端, 这是
// T04 占位页 onMount 自己负责的事 · BootstrapGate 不重复做.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveEntry } from './resolve-entry';

const BOOTSTRAP_PATHS = new Set<string>(['/', '/home', '/auth/login']);

export const BootstrapGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  // null = unknown · false = bypass · true = need splash
  const [ready, setReady] = useState<boolean>(false);
  const [needGate, setNeedGate] = useState<boolean | null>(null);

  // BUG-FIX (SC-00 attempt-1): React.StrictMode runs effects twice in dev. The
  // first run starts resolveEntry() but is then unmounted, setting cancelled=true,
  // which discards the navigation. The second run early-returns because
  // needGate was already set, leaving the splash on screen forever. Switch to a
  // module-level ref so the resolve is launched exactly once across StrictMode
  // double-invoke without depending on a re-render to clear it.
  const launchedRef = useRef(false);

  useEffect(() => {
    if (launchedRef.current) return;
    if (!BOOTSTRAP_PATHS.has(location.pathname)) {
      launchedRef.current = true;
      setNeedGate(false);
      setReady(true);
      return;
    }
    launchedRef.current = true;
    setNeedGate(true);
    resolveEntry()
      .then((outcome) => {
        // Only redirect when target path differs — avoid history pollution
        const here = location.pathname + location.search;
        if (outcome.dispatchTo !== here && outcome.dispatchTo !== location.pathname) {
          navigate(outcome.dispatchTo, { replace: true });
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[bootstrap] gate fatal', err);
        navigate('/welcome', { replace: true });
      })
      .finally(() => {
        setReady(true);
      });
  }, [location.pathname, location.search, navigate]);

  if (!ready && needGate) {
    return (
      <div
        data-testid="bootstrap-splash"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontSize: 14,
          color: '#666',
          background: '#fff',
        }}
      >
        正在准备…
      </div>
    );
  }
  return <>{children}</>;
};
