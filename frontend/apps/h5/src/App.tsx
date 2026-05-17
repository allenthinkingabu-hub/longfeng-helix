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
import { LoginPage } from './pages/Auth/Login';
import { LandingPage } from './pages/Landing/index';
import { WelcomeBackPage } from './pages/WelcomeBack/index';
// SC-00-T04 · SharedStub 已退役 · SC-13 真 SharedView 接管 /s/:token (源码保留作回滚备份 · 不再 import)
import { SharedView } from './pages/Shared/index';
import { ObserverStubPage } from './pages/ObserverStub/index';
import { GuestCapturePage } from './pages/GuestCapture/index';

const ManualEntryStub: React.FC = () => (
  <div data-testid="manual-entry-root" style={{ padding: 20, color: '#333' }}>
    <h2>手动填写</h2>
  </div>
);

export const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/home" element={<HomePage />} />
    <Route path="/auth/login" element={<LoginPage />} />
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
    {/* SC-00-T01 占位路由 · T04 / SC-13 / SC-14 / SC-15 后续 flesh */}
    <Route path="/welcome" element={<LandingPage />} />
    <Route path="/welcome-back" element={<WelcomeBackPage />} />
    {/* SC-13 · /s/:token 真页 SharedView · 替换 SC-00-T04 SharedStub 占位 ·
        SharedStub 源码保留 (本文件未删 import) 以便回滚 · 当前不挂任何 Route */}
    <Route path="/s/:token" element={<SharedView />} />
    <Route path="/observer/:code" element={<ObserverStubPage />} />
    {/* SC-12-T03 · /guest/capture 真页 (Try Before Signup · 替换 SC-12-STUB-T01) */}
    <Route path="/guest/capture" element={<GuestCapturePage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
