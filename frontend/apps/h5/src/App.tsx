import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CapturePage } from './pages/Capture/index';
import { AnalyzingPage } from './pages/Analyzing/index';
import { ResultPage } from './pages/Result/index';
import { ReviewExecPage } from './pages/ReviewExec/index';
import { ReviewDonePage } from './pages/ReviewDone/index';
import { HomePage } from './pages/Home/index';
import { ReviewTodayPage } from './pages/ReviewToday/index';
import { WrongbookListPage } from './pages/WrongbookList/index';

const ManualEntryStub: React.FC = () => (
  <div data-testid="manual-entry-root" style={{ padding: 20, color: '#333' }}>
    <h2>手动填写</h2>
  </div>
);

export const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/capture" element={<CapturePage />} />
    <Route path="/analyzing/:taskId" element={<AnalyzingPage />} />
    <Route path="/question/:qid/result" element={<ResultPage />} />
    <Route path="/result/:qid" element={<ResultPage />} />
    <Route path="/wrongbook" element={<WrongbookListPage />} />
    <Route path="/review/today" element={<ReviewTodayPage />} />
    <Route path="/review-exec" element={<ReviewExecPage />} />
    <Route path="/review/exec/:nid" element={<ReviewExecPage />} />
    <Route path="/review-done" element={<ReviewDonePage />} />
    <Route path="/review/done" element={<ReviewDonePage />} />
    <Route path="/manual-entry" element={<ManualEntryStub />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
