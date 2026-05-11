// SC-01-E02a · Capture P02 · subject chip-strip + 78px shutter
// AC-P02-002 (chips + aria-pressed) · AC-P02-003 (78px shutter present) · §10 wb_capture_subject_switch / wb_capture_shutter
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CapturePage } from './index';
import { i18n } from '../../i18n';
import { TEST_IDS } from '@longfeng/testids';
import { __getBuffer, __resetBuffer } from '@longfeng/telemetry';

expect.extend(toHaveNoViolations as never);

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <CapturePage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('CapturePage · SC-01-E02a · P02 chip-strip + shutter', () => {
  beforeEach(() => {
    __resetBuffer();
    try { localStorage.removeItem('lf:capture:draft:v1'); } catch { /* noop */ }
  });

  it('renders P02 root + 4 canonical subject chips (math/physics/chemistry/english) + shutter', () => {
    const { getByTestId } = renderPage();
    expect(getByTestId(TEST_IDS.p02.root)).toBeInTheDocument();
    // §3 B2 · canonical testid spec §13
    expect(getByTestId('subject-chip-math')).toBeInTheDocument();
    expect(getByTestId('subject-chip-physics')).toBeInTheDocument();
    expect(getByTestId('subject-chip-chemistry')).toBeInTheDocument();
    expect(getByTestId('subject-chip-english')).toBeInTheDocument();
    // §3 B5 · 78px shutter
    expect(getByTestId('capture-shutter')).toBeInTheDocument();
  });

  it('AC-P02-002 · default chip math has aria-pressed=true; clicking physics flips state', () => {
    const { getByTestId } = renderPage();
    const math = getByTestId('subject-chip-math');
    const physics = getByTestId('subject-chip-physics');
    expect(math.getAttribute('aria-pressed')).toBe('true');
    expect(physics.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(physics);
    expect(math.getAttribute('aria-pressed')).toBe('false');
    expect(physics.getAttribute('aria-pressed')).toBe('true');
  });

  it('§10 emits wb_capture_subject_switch on chip change with {from,to}', () => {
    const { getByTestId } = renderPage();
    fireEvent.click(getByTestId('subject-chip-chemistry'));
    const events = __getBuffer().filter((e) => e.name === 'wb_capture_subject_switch');
    expect(events.length).toBe(1);
    expect(events[0].props).toMatchObject({ from: 'math', to: 'chemistry' });
  });

  it('§10 wb_capture_subject_switch is NOT emitted when clicking already-selected chip', () => {
    const { getByTestId } = renderPage();
    fireEvent.click(getByTestId('subject-chip-math')); // already selected
    const events = __getBuffer().filter((e) => e.name === 'wb_capture_subject_switch');
    expect(events.length).toBe(0);
  });

  it('AC-P02-003 · shutter button enabled by default + onClick emits wb_capture_shutter', () => {
    const { getByTestId } = renderPage();
    const shutter = getByTestId('capture-shutter') as HTMLButtonElement;
    expect(shutter.disabled).toBe(false);
    expect(shutter.getAttribute('aria-label')).toMatch(/拍摄按钮/);
    fireEvent.click(shutter);
    const events = __getBuffer().filter((e) => e.name === 'wb_capture_shutter');
    expect(events.length).toBe(1);
    expect(events[0].props).toMatchObject({ subject: 'math', mode: 'photo' });
  });

  it('a11y · 0 axe violations', async () => {
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
