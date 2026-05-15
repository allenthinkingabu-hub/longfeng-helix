// Stub for P03 Analyzing SSE hook
// Real implementation lands with SC-01-T03 (P03 Analyzing pipeline)
import { useState, useEffect, useRef, useCallback } from 'react';

export interface StreamStep {
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  detail?: string;
}

export const STEP_LABELS = [
  '图像预处理',
  'OCR 题干识别',
  '错因诊断',
  '生成解法',
];

export function useEventSource(taskId: string | null) {
  const [steps, setSteps] = useState<StreamStep[]>(
    STEP_LABELS.map((label) => ({ label, status: 'pending' as const })),
  );
  const [jsonChunks, setJsonChunks] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const cancel = useCallback(() => {
    esRef.current?.close();
  }, []);

  return { steps, jsonChunks, done, error, cancel };
}
