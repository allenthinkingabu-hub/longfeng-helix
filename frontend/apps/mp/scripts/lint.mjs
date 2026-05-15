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
 *
 * Usage: node scripts/lint.mjs
 * Exit 0 = clean · Exit 1 = errors found
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

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
