// SC-01-E02a · Capture P02 · subject chip-strip + 78px shutter
// SC-01-E02b · Capture P02 · presign → PUT → complete → POST /api/wb/questions 拿 qid
// AC-P02-002 (chips + aria-pressed) · AC-P02-003 (78px shutter present)
// §10 wb_capture_subject_switch / wb_capture_shutter / wb_capture_upload_success
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CapturePage } from './index';
import { i18n } from '../../i18n';
import { TEST_IDS } from '@longfeng/testids';
import { __getBuffer, __resetBuffer } from '@longfeng/telemetry';

expect.extend(toHaveNoViolations as never);

// SC-01-E02b · stub the typed client layer so the test asserts call ordering
// (presign → directUpload → complete → createPending) without exercising MSW.
const presignSpy = vi.fn().mockResolvedValue({
  upload_url: 'https://mock-oss.example.com/upload',
  file_key: 'mock-file-key-001',
  ttl_seconds: 300,
  bucket: 'mock-bucket',
});
const directUploadSpy = vi.fn().mockResolvedValue(undefined);
const completeSpy = vi.fn().mockResolvedValue({ file_key: 'mock-file-key-001', status: 'READY' });
const createPendingSpy = vi.fn().mockResolvedValue({ qid: 'qid-mock-001' });

vi.mock('@longfeng/api-contracts', async () => {
  const actual = await vi.importActual<typeof import('@longfeng/api-contracts')>('@longfeng/api-contracts');
  return {
    ...actual,
    filesClient: {
      presign: (...args: unknown[]) => presignSpy(...args),
      directUpload: (...args: unknown[]) => directUploadSpy(...args),
      complete: (...args: unknown[]) => completeSpy(...args),
    },
    questionsClient: {
      createPending: (...args: unknown[]) => createPendingSpy(...args),
    },
  };
});

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
    try { localStorage.removeItem('lf:capture:idemKey:v1'); } catch { /* noop */ }
    presignSpy.mockClear();
    directUploadSpy.mockClear();
    completeSpy.mockClear();
    createPendingSpy.mockClear();
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

  // ── SC-01-E02b · presign → PUT → complete → POST /api/wb/questions chain ──
  describe('SC-01-E02b · upload chain via useMutation', () => {
    function pickFile(container: HTMLElement, file: File) {
      const input = container.querySelector(
        'input[data-testid="p02-file-input"]',
      ) as HTMLInputElement;
      expect(input).toBeTruthy();
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      fireEvent.change(input);
    }

    it('fires presign → directUpload → complete → createPending in order with qid returned', async () => {
      const { container } = renderPage();
      pickFile(container, new File(['xxx'], 'q.jpg', { type: 'image/jpeg' }));

      await waitFor(() => expect(createPendingSpy).toHaveBeenCalledTimes(1));

      expect(presignSpy).toHaveBeenCalledTimes(1);
      expect(directUploadSpy).toHaveBeenCalledTimes(1);
      expect(completeSpy).toHaveBeenCalledTimes(1);
      expect(createPendingSpy).toHaveBeenCalledTimes(1);

      // call ordering · invocationCallOrder strictly increasing
      const orders = [
        presignSpy.mock.invocationCallOrder[0],
        directUploadSpy.mock.invocationCallOrder[0],
        completeSpy.mock.invocationCallOrder[0],
        createPendingSpy.mock.invocationCallOrder[0],
      ];
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    });

    it('createPending body carries studentId/subject/image_key + idempotency key header param', async () => {
      const { container } = renderPage();
      pickFile(container, new File(['x'], 'q.jpg', { type: 'image/jpeg' }));
      await waitFor(() => expect(createPendingSpy).toHaveBeenCalledTimes(1));

      const [req, idemKey] = createPendingSpy.mock.calls[0];
      expect(req).toMatchObject({
        subject: 'math',
        image_key: 'mock-file-key-001',
        mime: 'image/jpeg',
        source_type: 1,
      });
      expect(typeof req.studentId).toBe('number');
      // idempotency key must be a non-empty string (uuid-like or fallback)
      expect(typeof idemKey).toBe('string');
      expect((idemKey as string).length).toBeGreaterThan(0);
    });

    it('§10 emits wb_capture_upload_success with qid after the chain completes', async () => {
      const { container } = renderPage();
      pickFile(container, new File(['x'], 'q.jpg', { type: 'image/jpeg' }));
      await waitFor(() => {
        const evts = __getBuffer().filter((e) => e.name === 'wb_capture_upload_success');
        expect(evts.length).toBe(1);
      });
      const evt = __getBuffer().find((e) => e.name === 'wb_capture_upload_success');
      expect(evt?.props).toMatchObject({ qid: 'qid-mock-001', subject: 'math' });
    });

    it('error in createPending surfaces error banner + state=ERROR (state-machine SC-01 §9)', async () => {
      createPendingSpy.mockRejectedValueOnce({ code: 'CREATE_FAIL', message: 'boom' });
      const { container, findByTestId } = renderPage();
      pickFile(container, new File(['x'], 'q.jpg', { type: 'image/jpeg' }));

      const banner = await findByTestId(TEST_IDS.p02.errorBanner);
      expect(banner.textContent).toMatch(/上传失败/);
      // earlier mutations still ran exactly once · createPending was attempted once and threw.
      expect(presignSpy).toHaveBeenCalledTimes(1);
      expect(directUploadSpy).toHaveBeenCalledTimes(1);
      expect(completeSpy).toHaveBeenCalledTimes(1);
      expect(createPendingSpy).toHaveBeenCalledTimes(1);
    });
  });
});
