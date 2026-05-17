/**
 * P03 fix · 静态文件级验证 (不依赖 IDE)
 *
 * 跑法: pnpm exec vitest run test/unit/analyzing-p03-fixes.static.spec.ts
 *
 * 直接读 frontend/apps/mp/pages/analyzing/{index.wxml,index.wxss} 源文件,
 * 验证 commit f4201bb 修复是否真的在源码里. 如果这个 spec PASS 但 IDE
 * 仍渲染旧版本, 100% 是 DevTools 缓存 (HMR / 编译缓存 / 项目未重开).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = resolve(__dirname, '../../pages/analyzing');

describe('P03 source files reflect f4201bb fix', () => {
  const wxml = readFileSync(resolve(PAGES_DIR, 'index.wxml'), 'utf-8');
  const wxss = readFileSync(resolve(PAGES_DIR, 'index.wxss'), 'utf-8');
  const ts = readFileSync(resolve(PAGES_DIR, 'index.ts'), 'utf-8');

  // ── nav 返回钮 ──────────────────────────────────────────────
  it('wxml: nav back 块用 van-icon arrow-left · 不再有 &lt; 字面量', () => {
    // 删除注释后再检查 · 避免误报 (注释里保留了原 bug 描述)
    const wxmlNoComments = wxml.replace(/<!--[\s\S]*?-->/g, '');

    // 旧 bug: <text class="back-chevron">&lt;</text>
    expect(wxmlNoComments).not.toContain('back-chevron');
    expect(wxmlNoComments).not.toContain('&lt;');

    // 新版应有 van-icon name="arrow-left"
    expect(wxmlNoComments).toMatch(/<van-icon\s+name="arrow-left"/);
  });

  it('wxss: .back-chevron 样式已删', () => {
    // 注释里保留了说明 · 但实际样式定义不能再有
    const wxssNoComments = wxss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(wxssNoComments).not.toMatch(/\.back-chevron\s*\{/);
  });

  // ── 底部空白区 ──────────────────────────────────────────────
  it('wxml: 旧 .stream SSE 终端块已删', () => {
    const wxmlNoComments = wxml.replace(/<!--[\s\S]*?-->/g, '');
    expect(wxmlNoComments).not.toMatch(/class="stream"/);
    expect(wxmlNoComments).not.toContain('analyzing-pipeline-json-stream');
    expect(wxmlNoComments).not.toContain('stream-hdr');
    expect(wxmlNoComments).not.toContain('SSE · /api/ai/stream');
  });

  it('wxml: 新 .afterview "完成后将看到" 引导卡 4 行 bullet 全在', () => {
    expect(wxml).toContain('class="afterview"');
    expect(wxml).toContain('analyzing-pipeline-afterview');
    expect(wxml).toContain('分析完成后将看到');
    expect(wxml).toContain('错因诊断');
    expect(wxml).toContain('解答步骤');
    expect(wxml).toContain('知识点');
    expect(wxml).toContain('艾宾浩斯');
  });

  it('wxss: .afterview 样式定义齐 (5 个 class)', () => {
    expect(wxss).toMatch(/\.afterview\s*\{/);
    expect(wxss).toMatch(/\.afterview-hdr\s*\{/);
    expect(wxss).toMatch(/\.afterview-title\s*\{/);
    expect(wxss).toMatch(/\.afterview-row\s*\{/);
    expect(wxss).toMatch(/\.afterview-bullet\s*\{/);
  });

  it('wxss: 旧 .stream / .stream-pre / .dot-red 样式全删', () => {
    const wxssNoComments = wxss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(wxssNoComments).not.toMatch(/^\.stream\s*\{/m);
    expect(wxssNoComments).not.toMatch(/^\.stream-pre\s*\{/m);
    expect(wxssNoComments).not.toMatch(/^\.stream-hdr\s*\{/m);
    expect(wxssNoComments).not.toMatch(/^\.dot-red\s/m);
  });

  // ── TS data 字段同步 ───────────────────────────────────────
  it('ts: STREAM_PLACEHOLDER 常量已删 · streamOutput data 字段已删', () => {
    // 注释里保留了说明 · 真常量定义不能再有
    const tsNoComments = ts
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(tsNoComments).not.toMatch(/const\s+STREAM_PLACEHOLDER\s*=/);
    expect(tsNoComments).not.toMatch(/streamOutput\s*:\s*STREAM_PLACEHOLDER/);
    expect(tsNoComments).not.toMatch(/streamOutput\s*:\s*resp\.result/);
  });
});
