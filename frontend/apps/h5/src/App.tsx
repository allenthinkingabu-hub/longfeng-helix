import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CapturePage } from './pages/Capture/index';
import { ReviewExecPage } from './pages/ReviewExec/index';
import { ReviewDonePage } from './pages/ReviewDone/index';

// Stub pages for routing (real implementations in other tasks)
const AnalyzingStub: React.FC = () => (
  <div data-testid="p03-root" style={{ padding: 20, color: '#333' }}>
    <h2>分析中...</h2>
    <p>AI 正在识别您的错题</p>
  </div>
);

const HomeStub: React.FC = () => (
  <div style={{ padding: 20, color: '#333' }}>
    <h2>首页</h2>
  </div>
);

export const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<HomeStub />} />
    <Route path="/capture" element={<CapturePage />} />
    <Route path="/analyzing/:taskId" element={<AnalyzingStub />} />
    <Route path="/review/exec/:nid" element={<ReviewExecPage />} />
    <Route path="/review/done" element={<ReviewDonePage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
