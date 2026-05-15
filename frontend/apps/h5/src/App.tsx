import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CapturePage } from './pages/Capture/index';
import { AnalyzingPage } from './pages/Analyzing/index';
import { ResultPage } from './pages/Result/index';
import { WrongbookListPage } from './pages/WrongbookList/index';

const HomeStub: React.FC = () => (
  <div style={{ padding: 20, color: '#333' }}>
    <h2>首页</h2>
  </div>
);

const ManualEntryStub: React.FC = () => (
  <div data-testid="manual-entry-root" style={{ padding: 20, color: '#333' }}>
    <h2>手动填写</h2>
  </div>
);

export const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<HomeStub />} />
    <Route path="/capture" element={<CapturePage />} />
    <Route path="/analyzing/:taskId" element={<AnalyzingPage />} />
    <Route path="/question/:qid/result" element={<ResultPage />} />
    <Route path="/wrongbook" element={<WrongbookListPage />} />
    <Route path="/manual-entry" element={<ManualEntryStub />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
