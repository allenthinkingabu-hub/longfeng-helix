import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ResultPage } from './pages/Result';

export const App: React.FC = () => (
  <Routes>
    <Route path="/question/:qid/result" element={<ResultPage />} />
    <Route path="/wrongbook" element={<div data-testid="p05-stub">错题本列表</div>} />
    <Route path="/capture" element={<div data-testid="p02-stub">拍题</div>} />
    <Route path="/" element={<Navigate to="/capture" replace />} />
  </Routes>
);
