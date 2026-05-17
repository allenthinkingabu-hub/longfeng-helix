// SC-00-T01 · SharedStubPage 占位 · SC-13 fleshes content
import React from 'react';
import { useParams } from 'react-router-dom';

export const SharedStubPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  return (
    <div data-testid="shared-placeholder-root" style={{ padding: 24, color: '#333' }}>
      <h2>分享只读预览</h2>
      <p>verdict=SHARED placeholder · token={token ?? '(none)'} · SC-13 fleshes out</p>
    </div>
  );
};
