import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CapturePage } from './pages/Capture/index';
import { AnalyzingPage } from './pages/Analyzing/index';
import { HomePage } from './pages/Home/index';
import { ReviewTodayPage } from './pages/ReviewToday/index';
import { ReviewExecPage } from './pages/ReviewExec/index';
import { ReviewDonePage } from './pages/ReviewDone/index';

const WrongbookStub: React.FC = () => (
  <div data-testid="p05-root" style={{ padding: 20, color: '#333' }}>
    <h2>错题本</h2>
  </div>
);

export const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/capture" element={<CapturePage />} />
    <Route path="/analyzing/:taskId" element={<AnalyzingPage />} />
    <Route path="/question/:qid/result" element={<div data-testid="p04-root">Result</div>} />
    <Route path="/manual-entry" element={<div data-testid="manual-entry-root">Manual Entry</div>} />
    <Route path="/review/today" element={<ReviewTodayPage />} />
    <Route path="/review/exec/:nid" element={<ReviewExecPage />} />
    <Route path="/review/done" element={<ReviewDonePage />} />
    <Route path="/wrongbook" element={<WrongbookStub />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
