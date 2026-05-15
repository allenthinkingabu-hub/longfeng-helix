import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Lazy-load pages to keep bundle lean
const CapturePage = React.lazy(() => import('./pages/Capture/index').then(m => ({ default: m.default ?? (m as any).CapturePage })));
const AnalyzingPage = React.lazy(() => import('./pages/Analyzing/index').then(m => ({ default: m.default ?? (m as any).AnalyzingPage })));
const ResultPage = React.lazy(() => import('./pages/Result/index').then(m => ({ default: m.default ?? (m as any).ResultPage })));

export const App: React.FC = () => {
  return (
    <React.Suspense fallback={<div style={{ minHeight: '100svh', background: '#0F0F23' }} />}>
      <Routes>
        <Route path="/capture" element={<CapturePage />} />
        <Route path="/analyzing/:taskId" element={<AnalyzingPage />} />
        <Route path="/question/:qid/result" element={<ResultPage />} />
        {/* Fallback routes for E2E nav targets */}
        <Route path="/manual-entry" element={<div data-testid="p-manual-entry">手填页</div>} />
        <Route path="/guest/capture" element={<div data-testid="p-guest-capture">游客拍题</div>} />
        <Route path="/" element={<div data-testid="p-home-root">首页</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </React.Suspense>
  );
};
