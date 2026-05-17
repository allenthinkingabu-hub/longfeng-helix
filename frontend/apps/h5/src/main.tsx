import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { BootstrapGate } from './bootstrap/BootstrapGate';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
    mutations: { retry: 0 },
  },
});

// SC-00-T01: <BootstrapGate> sits inside BrowserRouter (route hooks usable)
// and intercepts only path='/', '/home', '/auth/login'. Other deeplinks (e.g.
// /question/123, /review-exec) render their pages directly to avoid infinite
// "internal nav → resolve → redirect" loops.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <BootstrapGate>
          <App />
        </BootstrapGate>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
