// @longfeng/telemetry · minimal track() SDK
// SC-01-E02a: wired by P02 (capture) for wb_capture_subject_switch / wb_capture_shutter
// Real backend pipe (S8 telemetry-service) lands in a later task; this is the
// stable surface front-end pages can import from now.

export interface TelemetryEvent {
  name: string;
  props?: Record<string, unknown>;
  ts: number;
}

type Sink = (e: TelemetryEvent) => void;

const buffer: TelemetryEvent[] = [];
let sink: Sink = (e) => {
  // Default: push to buffer + window.dataLayer (GTM-style) when available.
  buffer.push(e);
  try {
    const w = globalThis as unknown as { dataLayer?: TelemetryEvent[] };
    if (Array.isArray(w.dataLayer)) w.dataLayer.push(e);
  } catch {
    /* noop */
  }
};

/** Replace the default sink (used by test harness + later by HTTP pipe). */
export function setTelemetrySink(s: Sink): void {
  sink = s;
}

/** Emit a single event. Never throws. */
export function track(name: string, props?: Record<string, unknown>): void {
  try {
    sink({ name, props, ts: Date.now() });
  } catch {
    /* swallow — telemetry must never break UX */
  }
}

/** Snapshot of buffered events (test-only helper). */
export function __getBuffer(): TelemetryEvent[] {
  return buffer.slice();
}

/** Reset buffer (test-only). */
export function __resetBuffer(): void {
  buffer.length = 0;
}

// ── SC-16-T02 · P-WEEKLY-REVIEW 埋点事件名常量 ───────────────────
// 来源: design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md §12
// 调用方: pages/me/weekly/index.ts (页面 ts) · 不允许散落裸字符串
// 测试: __getBuffer().filter(e => e.name === WEEKLY_EVENTS.view) 形式
export const WEEKLY_EVENTS = {
  view:             'weekly_view',
  dataRender:       'weekly_data_render',
  weakKpView:       'weekly_weak_kp_view',
  weakKpTap:        'weekly_weak_kp_tap',
  failedQTap:       'weekly_failed_q_tap',
  aiInsightView:    'weekly_ai_insight_view',
  retry:            'weekly_retry',
  emptyCtaTap:      'weekly_empty_cta_tap',
  share:            'weekly_share',
  back:             'weekly_back',
} as const;

export type WeeklyEventName = (typeof WEEKLY_EVENTS)[keyof typeof WEEKLY_EVENTS];
