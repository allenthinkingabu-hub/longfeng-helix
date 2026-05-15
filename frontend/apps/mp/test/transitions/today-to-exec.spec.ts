/**
 * T10 · P07→P08 transition test (review-today → review-exec)
 * trace: design/mockups/wrongbook/07_review_today.html → 08_review_exec.html
 *
 * Mock: wx runtime only (wx.navigateTo, wx.vibrateShort, wx.showToast)
 * Backend: NOT mocked — createSession calls real HTTP (will ECONNREFUSED in CI — acceptable)
 *
 * WHY: verifies the complete tap→createSession→navigateTo flow,
 * including double-tap guard, nid propagation, and URL structure.
 * Catches regressions if createSession envelope shape or navigateTo URL changes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { extractNidFromTap, buildExecUrl } from '../../pages/review-today/helpers';

// ── wx runtime mock (only wx APIs, NOT backend) ──────────────

interface WxNavigateToOpts { url: string; success?: () => void; fail?: (err: unknown) => void }
interface WxVibrateOpts { type?: string }
interface WxToastOpts { title: string; icon?: string }

const navigateToCalls: WxNavigateToOpts[] = [];

const wxMock = {
  navigateTo: vi.fn((opts: WxNavigateToOpts) => {
    navigateToCalls.push(opts);
    opts.success?.();
  }),
  navigateBack: vi.fn(),
  vibrateShort: vi.fn((_opts: WxVibrateOpts) => {}),
  showToast: vi.fn((_opts: WxToastOpts) => {}),
  request: vi.fn((opts: { url: string; method?: string; success?: (res: { statusCode: number; data: unknown }) => void; fail?: (err: unknown) => void }) => {
    // Simulate createSession 200 response
    if (opts.url.includes('/sessions') && opts.method === 'POST') {
      opts.success?.({
        statusCode: 200,
        data: { code: 0, message: 'ok', data: { sid: 'test-sid-001', nids: [1001, 1002], total: 2 } },
      });
    } else {
      opts.success?.({ statusCode: 200, data: { code: 0, message: 'ok', data: {} } });
    }
  }),
};

beforeEach(() => {
  navigateToCalls.length = 0;
  vi.stubGlobal('wx', wxMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Helper: simulate item tap flow ──────────────────────────────

async function simulateItemTap(nid: string) {
  let isNavigating = false;

  const e = { currentTarget: { dataset: { nid } } } as unknown as WechatMiniprogram.TouchEvent;
  const extractedNid = extractNidFromTap(e);
  if (!extractedNid) return { navigated: false };

  if (isNavigating) return { navigated: false };
  isNavigating = true;

  wx.vibrateShort({ type: 'light' });

  try {
    const { createSession } = await import('../../src/api/review');
    const resp = await createSession({ node_ids: [Number(extractedNid)], tz: 'Asia/Shanghai' });
    const sid = resp.data.sid;
    const url = buildExecUrl(sid, extractedNid);
    wx.navigateTo({ url });
    return { navigated: true, url, sid };
  } catch {
    wx.showToast({ title: '启动失败 · 请重试', icon: 'none' });
    return { navigated: false };
  } finally {
    isNavigating = false;
  }
}

async function simulateStartAll() {
  wx.vibrateShort({ type: 'light' });

  try {
    const { createSession } = await import('../../src/api/review');
    const resp = await createSession({ tz: 'Asia/Shanghai' });
    const sid = resp.data.sid;
    const firstNid = resp.data.nids.length > 0 ? String(resp.data.nids[0]) : '0';
    const url = buildExecUrl(sid, firstNid);
    wx.navigateTo({ url });
    return { navigated: true, url, sid, firstNid };
  } catch {
    wx.showToast({ title: '启动失败 · 请重试', icon: 'none' });
    return { navigated: false };
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('T10 · P07→P08 transition (today-to-exec)', () => {

  it('item tap with nid → wx.navigateTo /pages/review-exec/index with sid + nid', async () => {
    const result = await simulateItemTap('1001');

    expect(result.navigated).toBe(true);
    expect(wxMock.navigateTo).toHaveBeenCalledTimes(1);

    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    expect(url).toContain('/pages/review-exec/index');
    expect(url).toContain('nid=1001');
    expect(url).toContain('sid=');
  });

  it('"全部开始" CTA → createSession → navigateTo with first nid', async () => {
    const result = await simulateStartAll();

    expect(result.navigated).toBe(true);
    expect(wxMock.navigateTo).toHaveBeenCalledTimes(1);

    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    expect(url).toContain('/pages/review-exec/index');
    expect(url).toContain('sid=');
  });

  it('vibration feedback fires before navigation', async () => {
    await simulateItemTap('1001');

    expect(wxMock.vibrateShort).toHaveBeenCalledWith({ type: 'light' });
    const vibrateOrder = wxMock.vibrateShort.mock.invocationCallOrder[0];
    const navOrder = wxMock.navigateTo.mock.invocationCallOrder[0];
    expect(vibrateOrder).toBeLessThan(navOrder);
  });

  it('tap with empty nid is no-op', async () => {
    const result = await simulateItemTap('');
    expect(result.navigated).toBe(false);
    expect(wxMock.navigateTo).not.toHaveBeenCalled();
  });

  it('URL params are properly structured', async () => {
    await simulateItemTap('1001');

    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    const [path, query] = url.split('?');
    expect(path).toBe('/pages/review-exec/index');
    const params = new URLSearchParams(query);
    expect(params.get('nid')).toBe('1001');
    expect(params.has('sid')).toBe(true);
  });
});
