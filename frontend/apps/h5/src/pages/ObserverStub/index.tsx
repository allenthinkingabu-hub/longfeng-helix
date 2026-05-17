// SC-00-T01 · ObserverStubPage 占位 · SC-15 (P1) fleshes content
import React from 'react';
import { useParams } from 'react-router-dom';

export const ObserverStubPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  return (
    <div data-testid="observer-placeholder-root" style={{ padding: 24, color: '#333' }}>
      <h2>观察者入口</h2>
      <p>verdict=OBSERVER placeholder · code={code ?? '(none)'} · SC-15 (P1) fleshes out</p>
    </div>
  );
};
