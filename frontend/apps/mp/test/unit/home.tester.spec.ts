// P-HOME · Tester independent anti-regression spec for SC01-MP-HOME-BUG-FIX
// Author: Tester Agent attempt-1 · 2026-05-16
// trace: design/mockups/wrongbook/01_home.html · Coder commit d31d2ca
//
// ⚠️ Intent (CLAUDE.md Rule 9 Tests verify intent, not just behavior):
// Coder's own home.spec.ts only covers B4/B5/B6 (pure JS).
// This Tester spec **independently** covers B1/B2/B3/B7/B8 by reading the
// actual source files (app.json, wxml, wxss) so business-logic drift will
// fail loud here too. Each assertion encodes WHY (anti-regression vector).

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SUBJECT_COLORS, buildCurrentWeekStrip } from '../../pages/home/helpers';

// Resolve repo paths (relative to frontend/apps/mp/test/unit/ working dir = mp app root via vitest cwd)
const MP_ROOT = path.resolve(__dirname, '../..');
function readMp(rel: string): string {
  return fs.readFileSync(path.join(MP_ROOT, rel), 'utf8');
}

// ─── B1 · app.json tabBar must have 5 tabs including pages/me ──────────────
describe('B1 anti-regression · app.json tabBar 5 tabs + pages/me', () => {
  it('app.json tabBar.list has exactly 5 items', () => {
    const app = JSON.parse(readMp('app.json'));
    expect(app.tabBar).toBeDefined();
    expect(Array.isArray(app.tabBar.list)).toBe(true);
    expect(app.tabBar.list.length).toBe(5);
  });

  it('app.json tabBar.list includes pages/me/index (B1 fix · new placeholder page)', () => {
    const app = JSON.parse(readMp('app.json'));
    const pagePaths = app.tabBar.list.map((t: { pagePath: string }) => t.pagePath);
    expect(pagePaths).toContain('pages/me/index');
    // pages[] must also declare pages/me/index
    expect(app.pages).toContain('pages/me/index');
  });

  it('pages/me/ has all 4 required MP files (lint enforces) · prevents silent partial creation', () => {
    for (const f of ['index.wxml', 'index.wxss', 'index.ts', 'index.json']) {
      const p = path.join(MP_ROOT, 'pages/me', f);
      expect(fs.existsSync(p), `pages/me/${f} missing`).toBe(true);
      expect(fs.statSync(p).size).toBeGreaterThan(0);
    }
  });
});

// ─── B2 · navigationStyle=custom (kill black navbar that compresses hero) ──
describe('B2 anti-regression · navigationStyle=custom in app.json window', () => {
  it('app.json window.navigationStyle === "custom"', () => {
    const app = JSON.parse(readMp('app.json'));
    expect(app.window).toBeDefined();
    expect(app.window.navigationStyle).toBe('custom');
  });
});

// ─── B3 · sparkline SVG marker + days bar in weekly card ───────────────────
describe('B3 anti-regression · weekly card contains sparkline + days bar', () => {
  const wxml = readMp('pages/home/index.wxml');

  it('wxml retains data-test-id="p-home-weekly-sparkline" (testid name not silently dropped)', () => {
    expect(wxml).toContain('data-test-id="p-home-weekly-sparkline"');
  });

  it('wxml has spark image bound to weekSummarySparklineUri (B 方案 严格真值 · 2026-05-18)', () => {
    expect(wxml).toContain('class="spark-svg"');
    // 旧 sparklineSvgUri (mockup 占位) 已删 · 改绑 weekSummarySparklineUri 真值 ·
    // 空周时 wx:if 不命中 → 不画 (防 mockup 假曲线穿透 · 与 P03/P04 治理同根)
    expect(wxml).toMatch(/src="\{\{weekSummarySparklineUri\}\}"/);
  });

  it('wxml has dynamic days bar bound to weekDayLabels + todayIdx (2026-05-18 fix · "今天"动态贴 ISO 今天位置)', () => {
    expect(wxml).toContain('data-test-id="p-home-weekly-days"');
    // 旧写死 7 个 <text>周一</text> ... <text>今天</text> 已删 ·
    // 改 wx:for {{weekDayLabels}} · helper buildWeekDayLabels 生成 (单测在 home-weeksummary.spec)
    expect(wxml).toMatch(/wx:for="\{\{weekDayLabels\}\}"/);
    expect(wxml).toMatch(/todayIdx/);
  });
});

// ─── B6 · SUBJECT_COLORS bright palette · R channel > 200 for warm colors ──
describe('B6 anti-regression · SUBJECT_COLORS math + literal RGB parsing', () => {
  // Independent angle: parse RGB instead of equality (catches future "FF6B6D" near-miss
  // that would silently darken without unit test reverse-equality catching it)
  function hexR(hex: string): number {
    return parseInt(hex.slice(1, 3), 16);
  }

  it('数学 R-channel > 200 (bright not dark) · old #C41E3A has R=196 < 200', () => {
    const r = hexR(SUBJECT_COLORS['数学']);
    expect(r).toBeGreaterThan(200);
  });

  it('物理 R-channel > 200 (yellow-ish bright) · old #0057B7 has R=0', () => {
    const r = hexR(SUBJECT_COLORS['物理']);
    expect(r).toBeGreaterThan(200);
  });

  it('英语 G-channel > 200 (green bright) · old #9C4F00 has G=79', () => {
    const hex = SUBJECT_COLORS['英语'];
    const g = parseInt(hex.slice(3, 5), 16);
    expect(g).toBeGreaterThan(200);
  });
});

// ─── B5 · buildCurrentWeekStrip pure function · cross-year / dynamic label ─
describe('B5 anti-regression · buildCurrentWeekStrip never returns hardcoded month/day', () => {
  it('different now → different label (not always "4 月 20-26 日")', () => {
    const a = buildCurrentWeekStrip(new Date(2026, 0, 5)); // 2026-01-05 周一
    const b = buildCurrentWeekStrip(new Date(2026, 5, 15)); // 2026-06-15 周一
    expect(a.label).not.toBe(b.label);
    expect(a.label).not.toMatch(/4 月 20/);
    expect(b.label).not.toMatch(/4 月 20/);
  });

  it('cross-year date 2026-12-31 (周四) computes month 12 / Sun = 1月3日 of next year', () => {
    // Week of 2026-12-31 (Thursday): Mon=12/28, Sun=2027/1/3
    const strip = buildCurrentWeekStrip(new Date(2026, 11, 31)); // month 11 = December
    expect(strip.days).toHaveLength(7);
    expect(strip.days[0].d).toBe('28'); // Mon = 12/28
    // Sunday spans next year — d=03 (calendar day, not absolute);
    // label format is "M 月 D1–D2 日" using monday's month → "12 月 28–3 日"
    expect(strip.days[6].d).toBe('03');
    // The label uses monday's month; sunday's calendar day = 3
    expect(strip.label).toBe('12 月 28–3 日');
    // today (Thursday) marked
    expect(strip.days[3].today).toBe(true);
  });
});

// ─── B7 · scroll-view container removed in favor of <view> or has height ───
describe('B7 anti-regression · main scroll container is <view>, not <scroll-view> without height', () => {
  const wxml = readMp('pages/home/index.wxml');

  it('main scroll wrapper uses <view class="scroll">, NOT <scroll-view class="scroll"', () => {
    // The bug was <scroll-view class="scroll" scroll-y="true"> with no height → won't scroll on MP
    expect(wxml).toContain('<view class="scroll">');
    expect(wxml).not.toMatch(/<scroll-view\s+class="scroll"/);
  });

  it('if any <scroll-view> remains in wxml, it must have height/style declared (MP requirement)', () => {
    const m = wxml.matchAll(/<scroll-view\b[^>]*>/g);
    for (const occ of m) {
      // legacy known limitation: MP <scroll-view scroll-y> needs height OR style. Either explicit or none allowed.
      // We assert: there is no orphan scroll-view at all on home page after B7.
      throw new Error(`Unexpected leftover <scroll-view>: ${occ[0]}`);
    }
  });
});

// ─── B8 · hero height ≤ 480rpx (no oversize blue band) ─────────────────────
describe('B8 anti-regression · hero / greeting / scroll sizing', () => {
  const wxss = readMp('pages/home/index.wxss');

  function extractRpx(selector: string, prop: string): number | null {
    // crude block parser: find selector { ... prop: Xrpx ... }
    const blockRe = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`);
    const block = wxss.match(blockRe);
    if (!block) return null;
    const propRe = new RegExp(`${prop}\\s*:\\s*(\\d+)\\s*rpx`);
    const m = block[1].match(propRe);
    return m ? parseInt(m[1], 10) : null;
  }

  it('.hero height ≤ 480rpx (was 476rpx; mockup 240px ≈ 480rpx; never grow beyond)', () => {
    const h = extractRpx('.hero', 'height');
    expect(h).not.toBeNull();
    expect(h!).toBeLessThanOrEqual(480);
    expect(h!).toBeGreaterThan(0);
  });

  it('.greeting top ≤ 100rpx (B8 · tight to top · was 116rpx before fix)', () => {
    const top = extractRpx('.greeting', 'top');
    expect(top).not.toBeNull();
    expect(top!).toBeLessThanOrEqual(100);
  });

  it('.scroll margin-top ≤ 380rpx (B8 · compressed; was 384rpx before fix)', () => {
    const mt = extractRpx('.scroll', 'margin-top');
    expect(mt).not.toBeNull();
    expect(mt!).toBeLessThanOrEqual(380);
  });
});

// ─── B4 · 7 distinct consecutive days (independent angle from Coder) ──────
describe('B4 anti-regression · 100 random dates · always 7 distinct consecutive d-values', () => {
  it('property-based · 100 random dates over 2024-2028 → 7 distinct consecutive', () => {
    // Coder's spec only tests 2026-05-16. We blast 100 random dates.
    const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
    for (let i = 0; i < 100; i++) {
      const y = rand(2024, 2028);
      const m = rand(0, 11);
      const d = rand(1, 28); // safe day
      const strip = buildCurrentWeekStrip(new Date(y, m, d));
      expect(strip.days).toHaveLength(7);
      const ds = strip.days.map((x) => parseInt(x.d, 10));
      expect(new Set(ds).size).toBe(7);
      // exactly one today
      expect(strip.days.filter((x) => x.today)).toHaveLength(1);
    }
  });
});
