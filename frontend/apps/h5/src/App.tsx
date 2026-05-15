import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { CapturePage } from './pages/Capture/index';
import { AnalyzingPage } from './pages/Analyzing/index';
import { HomePage } from './pages/Home/index';

// P05 stub with tab bar (T07 parallel · stub fallback)
const WrongbookStub: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div
      data-testid="p05-root"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#F2F2F7',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      }}
    >
      <div style={{ padding: 20, color: '#333' }}>
        <h2>错题本</h2>
      </div>
      {/* Inline tab bar for P05→P-HOME navigation (SC01-T08 AC1) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 84,
          background: 'rgba(242,242,247,0.88)',
          backdropFilter: 'blur(22px) saturate(180%)',
          borderTop: '.5px solid rgba(60,60,67,0.14)',
          display: 'flex',
          alignItems: 'flex-start',
          paddingTop: 6,
        }}
      >
        <button
          data-testid="tab-home"
          onClick={() => navigate('/')}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, color: '#8E8E93', fontSize: 10, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 11L12 3l9 8v9a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1Z" stroke="#8E8E93" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span>首页</span>
        </button>
        <button
          data-testid="tab-wrongbook"
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, color: '#007AFF', fontSize: 10, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 4h10l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="#007AFF" strokeWidth="1.5" />
            <path d="M8 13h8M8 17h5" stroke="#007AFF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>错题本</span>
        </button>
      </div>
    </div>
  );
};

const ManualEntryStub: React.FC = () => (
  <div data-testid="manual-entry-root" style={{ padding: 20, color: '#333' }}>
    <h2>手动填写</h2>
  </div>
);

export const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/wrongbook" element={<WrongbookStub />} />
    <Route path="/capture" element={<CapturePage />} />
    <Route path="/analyzing/:taskId" element={<AnalyzingPage />} />
    <Route path="/question/:qid/result" element={<div data-testid="p04-root">Result</div>} />
    <Route path="/manual-entry" element={<ManualEntryStub />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
