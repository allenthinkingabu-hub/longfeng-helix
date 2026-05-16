#!/usr/bin/env node
/**
 * MP static lint - 微信小程序 cross-file consistency check
 *
 * 验:
 *  1. wx.navigateTo / wx.redirectTo / wx.reLaunch URL 指向真实 page
 *  2. wx.switchTab URL 必须存在于 app.json tabBar.list (tabBar 必须配置)
 *  3. pages/<X>/index.json usingComponents 路径在 miniprogram_npm/ 真实存在
 *  4. pages/<X>/index.wxml 中所有 <van-X> 自定义组件必须在 index.json usingComponents 注册
 *  5. app.json pages[] 数组每个 page 4 文件 (json/wxml/wxss/ts) 齐全
 *  6. (Fix-3 · 2026-05-16) ^__.*__$ reserved dir 禁出现 · IDE 报 "reserved directory" 拒编
 *
 * Usage: node scripts/lint.mjs
 * Exit 0 = clean · Exit 1 = errors found
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Self-heal: 如果 miniprogram_npm/ 不存在 (gitignored · fresh worktree) · 自动跑 build-npm-fs
// 这样 fresh clone / 新 worktree 跑 lint 不会因 22 vant usingComponents 错失败
const MP_NPM = join(PROJECT_ROOT, 'miniprogram_npm');
if (!existsSync(MP_NPM)) {
  console.log('[lint-mp] miniprogram_npm/ missing, auto-building via devtools-cli.sh build-npm-fs...');
  try {
    execSync('bash scripts/devtools-cli.sh build-npm-fs', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error(`[lint-mp] build-npm-fs failed: ${e.message}`);
    process.exit(1);
  }
}

const errors = [];

function err(file, line, msg) {
  errors.push({ file, line, msg });
}

// ── 1. Load app.json ────────────────────────────────────────────
const appJsonPath = join(PROJECT_ROOT, 'app.json');
let appJson;
try {
  appJson = JSON.parse(readFileSync(appJsonPath, 'utf-8'));
} catch (e) {
  err('app.json', 0, `cannot parse: ${e.message}`);
  process.exit(1);
}

const declaredPages = new Set(appJson.pages || []);
const tabBarPages = new Set((appJson.tabBar?.list || []).map((t) => t.pagePath));

// ── 2. 每个 declared page 必须有 4 file ───────────────────────────
for (const pagePath of declaredPages) {
  const baseDir = join(PROJECT_ROOT, dirname(pagePath));
  const baseName = pagePath.split('/').pop();
  for (const ext of ['json', 'wxml', 'wxss', 'ts']) {
    const f = join(baseDir, `${baseName}.${ext}`);
    if (!existsSync(f)) {
      err(`app.json`, 0, `declared page "${pagePath}" missing .${ext}`);
    }
  }
}

// ── 3. 扫所有 pages/*/index.ts 的 wx.navigateTo / switchTab / etc URL ───
const pagesDir = join(PROJECT_ROOT, 'pages');
function walkPages(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkPages(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}
const pageTsFiles = walkPages(pagesDir);

const URL_PATTERN = /wx\.(navigateTo|redirectTo|reLaunch|switchTab)\(\s*\{\s*url:\s*[`'"]([^`'"]+)[`'"]/g;

for (const tsFile of pageTsFiles) {
  const code = readFileSync(tsFile, 'utf-8');
  const relTs = tsFile.replace(PROJECT_ROOT + '/', '');
  let m;
  // reset lastIndex
  URL_PATTERN.lastIndex = 0;
  while ((m = URL_PATTERN.exec(code)) !== null) {
    const api = m[1];           // navigateTo / switchTab / etc
    const url = m[2];            // /pages/foo/bar or pages/foo/bar
    const lineNo = code.substring(0, m.index).split('\n').length;

    // strip leading /
    const norm = url.replace(/^\//, '').split('?')[0]; // remove query string
    // page path doesn't have leading /
    const pageExists = declaredPages.has(norm)
      || existsSync(join(PROJECT_ROOT, norm + '.ts'));

    if (!pageExists) {
      err(relTs, lineNo, `wx.${api} → "${url}" — page not in app.json pages[] and no .ts file at ${norm}.ts`);
    }

    if (api === 'switchTab') {
      if (tabBarPages.size === 0) {
        err(relTs, lineNo, `wx.switchTab → "${url}" but app.json has no tabBar.list (switchTab needs tabBar config)`);
      } else if (!tabBarPages.has(norm)) {
        err(relTs, lineNo, `wx.switchTab → "${url}" but not in app.json tabBar.list (${[...tabBarPages].join(',')})`);
      }
    }
  }
}

// ── 4. 每个 page index.json usingComponents 路径必须真实存在 ──────────
function findPageJsons(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) findPageJsons(full, out);
    else if (full.endsWith('index.json')) out.push(full);
  }
  return out;
}
const pageJsons = findPageJsons(pagesDir);

const miniprogramNpm = join(PROJECT_ROOT, 'miniprogram_npm');

for (const jsonFile of pageJsons) {
  const relJ = jsonFile.replace(PROJECT_ROOT + '/', '');
  let pj;
  try {
    pj = JSON.parse(readFileSync(jsonFile, 'utf-8'));
  } catch (e) {
    err(relJ, 0, `cannot parse: ${e.message}`);
    continue;
  }
  const using = pj.usingComponents || {};
  for (const [tag, refPath] of Object.entries(using)) {
    // resolve refPath relative to miniprogram_npm/ root
    // e.g. "@vant/weapp/button/index" → miniprogram_npm/@vant/weapp/button/index.js
    const candidate = join(miniprogramNpm, refPath + '.js');
    const candidateIndexJs = join(miniprogramNpm, refPath, 'index.js');
    if (!existsSync(candidate) && !existsSync(candidateIndexJs)) {
      err(relJ, 0, `usingComponents "${tag}" → "${refPath}" — no .js found at miniprogram_npm/${refPath}.js or .../index.js`);
    }
  }

  // ── 5. WXML 中 <van-X> tag 必须在 usingComponents 注册 ──
  const wxmlPath = jsonFile.replace(/\.json$/, '.wxml');
  if (!existsSync(wxmlPath)) continue;
  const wxml = readFileSync(wxmlPath, 'utf-8');
  const usedTags = new Set();
  const TAG_RE = /<(van-[a-z-]+|[a-z]+(?:-[a-z]+)+)\b/g;
  let tm;
  while ((tm = TAG_RE.exec(wxml)) !== null) {
    const tag = tm[1];
    // skip known WX built-ins
    if ([
      'cover-image', 'cover-view', 'movable-area', 'movable-view',
      'scroll-view', 'swiper-item', 'web-view', 'rich-text',
      'open-data', 'official-account', 'live-player', 'live-pusher',
      'page-container', 'root-portal', 'page-meta', 'navigation-bar',
      'scroll-view-skyline',
    ].includes(tag)) continue;
    usedTags.add(tag);
  }

  const relWxml = wxmlPath.replace(PROJECT_ROOT + '/', '');
  for (const tag of usedTags) {
    if (!(tag in using)) {
      err(relWxml, 0, `<${tag}> used in WXML but not registered in ${relJ} usingComponents`);
    }
  }
}

// ── 6. (Fix-3) ^__.*__$ reserved dir 禁出现 (IDE 拒编) ────────────
// MP IDE 真错误样本: "Begin and end by '__' is a reserved directory; donutAuthorize__
//                     is a reserved directory; All files in test/__screenshots__ will be ignored"
// 来源: vitest / playwright 默认产物路径 (__screenshots__ / __snapshots__) 与 MP 规则冲突
const RESERVED_DIR_RE = /^__.+__$/;
const RESERVED_SKIP_DIRS = new Set(['node_modules', 'miniprogram_npm', '.miniprogram-build', 'dist', '.git']);

function findReservedDirs(root, out = []) {
  if (!existsSync(root)) return out;
  for (const name of readdirSync(root)) {
    if (RESERVED_SKIP_DIRS.has(name)) continue;
    const full = join(root, name);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (!s.isDirectory()) continue;
    if (RESERVED_DIR_RE.test(name)) {
      out.push(full);
      continue; // 不递归进 reserved dir (反正 IDE 都拒编)
    }
    findReservedDirs(full, out);
  }
  return out;
}

const reservedDirs = findReservedDirs(PROJECT_ROOT);
for (const d of reservedDirs) {
  const rel = d.replace(PROJECT_ROOT + '/', '');
  err(rel, 0, `reserved dir "^__..__$" — 微信 IDE 拒编 · 删之 (rm -rf "${rel}") 或改名 · vitest/playwright 产物路径 需移 test-results/ 外`);
}

// ── Report ──────────────────────────────────────────────────────
if (errors.length === 0) {
  console.log('✓ lint-mp: 0 errors');
  process.exit(0);
} else {
  console.error(`✗ lint-mp: ${errors.length} errors\n`);
  for (const e of errors) {
    console.error(`  ${e.file}:${e.line}: ${e.msg}`);
  }
  process.exit(1);
}
