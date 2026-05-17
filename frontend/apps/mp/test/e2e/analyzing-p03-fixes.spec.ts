/**
 * P03 fix verification · 2026-05-17
 *
 * 验证两点 (跟用户截图红圈一一对照):
 * 1. nav 返回钮: 不再渲染字面量 "&lt;" · 改 van-icon arrow-left
 * 2. 底部空白区: .stream SSE 终端 mockup 已删 · 改 .afterview "完成后将看到" 引导卡
 *
 * 跑法: 先 `pnpm devtools:start` 开 IDE + 起 9420 端口 ·
 *      再 `pnpm test:e2e:automator -- analyzing-p03-fixes`
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean } from './_helpers';

describe('P03 fix verification · nav back btn + afterview 引导卡', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'analyzing-p03-fixes.spec');
  });

  it('nav 返回钮: 不含字面量 "&lt;" · 含 van-icon arrow-left', async () => {
    await mp.reLaunch('/pages/analyzing/index?taskId=demo');
    await new Promise((r) => setTimeout(r, 1200));

    const page = await mp.currentPage();
    const backWrap = await page.$('.back');
    expect(backWrap).toBeTruthy();

    // 旧 bug: <text class="back-chevron">&lt;</text> 渲染成字面 "&lt;"
    // 修后该 class 完全删除 · 没有 .back-chevron 节点
    const oldChevron = await page.$('.back-chevron');
    expect(oldChevron).toBeFalsy();

    // back text 节点应该只有 "拍题" 这一段 · 不含 "&lt;"
    const backText = await backWrap!.text();
    expect(backText).toContain('拍题');
    expect(backText).not.toContain('&lt;');
    expect(backText).not.toContain('<');

    // van-icon 渲染后会有内部 .van-icon 类节点 (vant-weapp 实现)
    const vanIcon = await backWrap!.$('.van-icon');
    expect(vanIcon).toBeTruthy();
  });

  it('底部引导卡: 新 .afterview 存在 · 旧 .stream 已删', async () => {
    const page = await mp.currentPage();

    // 旧 mockup SSE 终端卡 · 必须不存在
    const oldStream = await page.$('[data-test-id="analyzing-pipeline-json-stream"]');
    expect(oldStream).toBeFalsy();

    // 新引导卡 · 必须存在
    const afterview = await page.$('[data-test-id="analyzing-pipeline-afterview"]');
    expect(afterview).toBeTruthy();

    // 4 条 bullet · 内容覆盖 P04 result 页核心 section
    const afterviewText = await afterview!.text();
    expect(afterviewText).toContain('分析完成后将看到');
    expect(afterviewText).toContain('错因诊断');
    expect(afterviewText).toContain('解答步骤');
    expect(afterviewText).toContain('知识点');
    expect(afterviewText).toContain('艾宾浩斯');
  });

  it('截图存档 · artifact 给人眼复核', async () => {
    const png = await mp.screenshot();
    expect(png).toBeTruthy();
    // 落盘到 test-results/e2e/analyzing-p03-fixes.png
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../test-results/e2e');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'analyzing-p03-fixes.png'), png as unknown as Buffer);
  });
});
