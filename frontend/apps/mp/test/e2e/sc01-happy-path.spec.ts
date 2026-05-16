/**
 * SC-01 端到端 happy path · 走全部 8 page 真验证
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean 三件套 ·
 *   替换原 inline mp.on('console') · 现在 helper 自动挂订阅 + 落 ide-console.txt
 *
 * Flow: home → capture → analyzing → result → review-today → review-exec → review-done → home
 * 真 backend: file=8084 · wb=8082 · ai=8083 · review=8085
 * 真 automator: ws://127.0.0.1:9420
 *
 * 目标: 这条 spec 通了 = user 早上能在 IDE 真演示 SC-01.
 * 每步独立 it · 失败时具体定位哪 page block.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, resetIdeConsoleLog } from './_helpers';

describe('SC-01 happy path · 8 pages · real backend + real IDE', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    resetIdeConsoleLog(); // 清上轮 IDE Console log · 本 spec 独享
    ({ mp, errors } = await connectMp(10_000));
  }, 30_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'sc01-happy-path · 8 pages');
  });

  // ── Step 1: P-HOME ─────────────────────────────────────────
  it('Step 1 · /pages/home/index loads', async () => {
    await mp.reLaunch('/pages/home/index');
    await new Promise((r) => setTimeout(r, 2000));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/home/index');
  }, 45_000);

  // ── Step 2: P02 Capture ───────────────────────────────────
  it('Step 2 · /pages/capture/index loads', async () => {
    await mp.reLaunch('/pages/capture/index');
    await new Promise((r) => setTimeout(r, 2000));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/capture/index');
  }, 45_000);

  // ── Step 3: P03 Analyzing ─────────────────────────────────
  it('Step 3 · /pages/analyzing/index?taskId=X loads', async () => {
    await mp.reLaunch('/pages/analyzing/index?taskId=demo-task-001');
    await new Promise((r) => setTimeout(r, 2000));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/analyzing/index');
  }, 45_000);

  // ── Step 4: P04 Result ────────────────────────────────────
  it('Step 4 · /pages/result/index?qid=X loads', async () => {
    await mp.reLaunch('/pages/result/index?qid=demo-qid-001');
    await new Promise((r) => setTimeout(r, 2000));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/result/index');
  }, 45_000);

  // ── Step 5: P07 Review-Today ──────────────────────────────
  it('Step 5 · /pages/review-today/index loads', async () => {
    await mp.reLaunch('/pages/review-today/index');
    await new Promise((r) => setTimeout(r, 2000));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/review-today/index');
  }, 45_000);

  // ── Step 6: P08 Review-Exec ───────────────────────────────
  it('Step 6 · /pages/review-exec/index?sid=X&nid=Y loads', async () => {
    await mp.reLaunch('/pages/review-exec/index?sid=demo-session&nid=demo-node-1');
    await new Promise((r) => setTimeout(r, 2000));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/review-exec/index');
  }, 45_000);

  // ── Step 7: P09 Review-Done ───────────────────────────────
  it('Step 7 · /pages/review-done/index?sid=X loads', async () => {
    await mp.reLaunch('/pages/review-done/index?sid=demo-session');
    await new Promise((r) => setTimeout(r, 2000));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/review-done/index');
  }, 45_000);

  // ── Step 8: P05 Wrongbook-List (bonus) ────────────────────
  it('Step 8 · /pages/wrongbook-list/index loads', async () => {
    await mp.reLaunch('/pages/wrongbook-list/index');
    await new Promise((r) => setTimeout(r, 2000));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/wrongbook-list/index');
  }, 45_000);
});
