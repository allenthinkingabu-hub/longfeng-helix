/**
 * useEventSource · P03 SSE 4-step pipeline hook
 * spec: design/system/pages/P03-analyzing.spec.md §4 / §8
 * wire: GET /api/ai/stream/{taskId} · 7 SSE type (STEP_START / STEP_DONE / PARTIAL_JSON / DONE / FAIL / CANCELLED / FALLBACK_MODEL)
 *
 * Uses fetch + ReadableStream (not native EventSource) for finer control over
 * abort, retry, and chunk-level parsing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Public types ─────────────────────────────────────────────
export type StreamStep = 1 | 2 | 3 | 4;

export const STEP_LABELS: Record<StreamStep, string> = {
  1: '图像预处理',
  2: 'OCR 题干',
  3: '错因诊断',
  4: '生成解法',
};

export type StreamStatus =
  | 'QUEUED'
  | 'STREAMING'
  | 'SLOW'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export type StepState = 'wait' | 'now' | 'done' | 'fail';

export interface UseEventSourceOpts {
  taskId: string;
  onStep?: (step: StreamStep, phase: 'start' | 'done', durMs?: number) => void;
  onDone?: () => void;
  onSlow?: () => void;
  onFail?: (code?: string) => void;
  onCancelled?: () => void;
  onFallbackModel?: (fromTo: string) => void;
  /** ms before declaring SLOW (default 10_000) */
  slowThresholdMs?: number;
  /** max SSE reconnect attempts (default 3) */
  maxRetries?: number;
}

export interface UseEventSourceReturn {
  status: StreamStatus;
  stepStatuses: Record<StreamStep, StepState>;
  stepDurations: Record<StreamStep, number | undefined>;
  partialJson: string;
  cancel: () => Promise<void>;
}

// ─── SSE chunk shape (matches AnalysisChunk.java) ─────────────
interface SseChunk {
  type?: string;
  step?: number;
  durationMs?: number;
  chunk?: string;
  result?: unknown;
  errorCode?: string;
}

// ─── Default states ──────────────────────────────────────────
function initStepStatuses(): Record<StreamStep, StepState> {
  return { 1: 'wait', 2: 'wait', 3: 'wait', 4: 'wait' };
}

function initStepDurations(): Record<StreamStep, number | undefined> {
  return { 1: undefined, 2: undefined, 3: undefined, 4: undefined };
}

// ─── Hook ────────────────────────────────────────────────────
export function useEventSource(opts: UseEventSourceOpts): UseEventSourceReturn {
  const {
    taskId,
    onStep,
    onDone,
    onSlow,
    onFail,
    onCancelled,
    onFallbackModel,
    slowThresholdMs = 10_000,
    maxRetries = 3,
  } = opts;

  const [status, setStatus] = useState<StreamStatus>('QUEUED');
  const [stepStatuses, setStepStatuses] = useState(initStepStatuses);
  const [stepDurations, setStepDurations] = useState(initStepDurations);
  const [partialJson, setPartialJson] = useState('');

  // Refs to keep callbacks stable across re-renders
  const onStepRef = useRef(onStep);
  const onDoneRef = useRef(onDone);
  const onSlowRef = useRef(onSlow);
  const onFailRef = useRef(onFail);
  const onCancelledRef = useRef(onCancelled);
  const onFallbackModelRef = useRef(onFallbackModel);
  onStepRef.current = onStep;
  onDoneRef.current = onDone;
  onSlowRef.current = onSlow;
  onFailRef.current = onFail;
  onCancelledRef.current = onCancelled;
  onFallbackModelRef.current = onFallbackModel;

  const abortRef = useRef<AbortController | null>(null);
  const terminalRef = useRef(false);

  const cancel = useCallback(async () => {
    terminalRef.current = true;
    // Abort the SSE stream
    abortRef.current?.abort();
    // POST cancel to backend
    try {
      await fetch(`/api/ai/cancel/${encodeURIComponent(taskId)}`, { method: 'POST' });
    } catch { /* best-effort */ }
    setStatus('CANCELLED');
    onCancelledRef.current?.();
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    terminalRef.current = false;
    let retries = 0;
    let slowTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      if (terminalRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;

      // Slow detection timer
      slowTimer = setTimeout(() => {
        if (!terminalRef.current) {
          setStatus('SLOW');
          onSlowRef.current?.();
        }
      }, slowThresholdMs);

      try {
        const resp = await fetch(`/api/ai/stream/${encodeURIComponent(taskId)}`, {
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          throw new Error(`SSE response ${resp.status}`);
        }

        setStatus((prev) => (prev === 'QUEUED' ? 'STREAMING' : prev));

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (terminalRef.current) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE frames: "data: {...}\n\n"
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);

            // Extract data line(s) from the frame
            for (const line of frame.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const jsonStr = line.slice(5).trim();
              if (!jsonStr) continue;

              let chunk: SseChunk;
              try {
                chunk = JSON.parse(jsonStr);
              } catch {
                continue;
              }

              // Reset slow timer on any event
              if (slowTimer) {
                clearTimeout(slowTimer);
                slowTimer = null;
              }

              handleChunk(chunk);
            }
          }
        }
      } catch (err: unknown) {
        if (terminalRef.current) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;

        // Retry logic
        if (retries < maxRetries) {
          retries++;
          const delay = Math.min(1000 * 2 ** (retries - 1), 5000);
          await new Promise((r) => setTimeout(r, delay));
          if (!terminalRef.current) {
            connect();
          }
          return;
        }

        // Exhausted retries
        setStatus('FAILED');
        onFailRef.current?.('NETWORK_ERROR');
      } finally {
        if (slowTimer) {
          clearTimeout(slowTimer);
          slowTimer = null;
        }
      }
    }

    function handleChunk(chunk: SseChunk) {
      if (terminalRef.current) return;
      const type = chunk.type;

      switch (type) {
        case 'STEP_START': {
          const step = chunk.step as StreamStep;
          if (step >= 1 && step <= 4) {
            setStepStatuses((prev) => ({ ...prev, [step]: 'now' }));
            setStatus((prev) => (prev === 'QUEUED' ? 'STREAMING' : prev));
            onStepRef.current?.(step, 'start');
          }
          break;
        }

        case 'STEP_DONE': {
          const step = chunk.step as StreamStep;
          if (step >= 1 && step <= 4) {
            setStepStatuses((prev) => ({ ...prev, [step]: 'done' }));
            setStepDurations((prev) => ({ ...prev, [step]: chunk.durationMs }));
            onStepRef.current?.(step, 'done', chunk.durationMs);
          }
          break;
        }

        case 'PARTIAL_JSON': {
          // spec §8: PARTIAL_JSON payload uses `chunk` field (not `partialJson`)
          const fragment = chunk.chunk ?? '';
          if (fragment) {
            setPartialJson((prev) => prev + fragment);
          }
          break;
        }

        case 'DONE': {
          terminalRef.current = true;
          setStatus('SUCCEEDED');
          setStepStatuses({ 1: 'done', 2: 'done', 3: 'done', 4: 'done' });
          onDoneRef.current?.();
          break;
        }

        case 'FAIL': {
          const code = chunk.errorCode ?? 'UNKNOWN';
          const step = chunk.step as StreamStep | undefined;
          if (step && step >= 1 && step <= 4) {
            setStepStatuses((prev) => ({ ...prev, [step]: 'fail' }));
          }
          setStatus('FAILED');
          onFailRef.current?.(code);
          break;
        }

        case 'CANCELLED': {
          terminalRef.current = true;
          setStatus('CANCELLED');
          onCancelledRef.current?.();
          break;
        }

        case 'FALLBACK_MODEL': {
          // chunk field carries "from→to" string
          const fromTo = chunk.chunk ?? '';
          // Reset all steps to wait for the new provider
          setStepStatuses(initStepStatuses());
          setStepDurations(initStepDurations());
          setPartialJson('');
          setStatus('SLOW');
          onFallbackModelRef.current?.(fromTo);
          break;
        }
      }
    }

    connect();

    return () => {
      terminalRef.current = true;
      abortRef.current?.abort();
      if (slowTimer) clearTimeout(slowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, slowThresholdMs, maxRetries]);

  return { status, stepStatuses, stepDurations, partialJson, cancel };
}
