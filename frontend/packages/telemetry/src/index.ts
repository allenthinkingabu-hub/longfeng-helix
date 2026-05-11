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
