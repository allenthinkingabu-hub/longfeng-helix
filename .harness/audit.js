#!/usr/bin/env node
'use strict';

// audit.js — 确定性 7 维度审计。 程序不说谎: grep / file-exists / git cat-file / 数 testcase / IDE Console / 用例对齐.
// 7 dims: test_cases_alignment · coder_compliance · tester_compliance · bug_reality · test_validity · spec_alignment · ide_smoke
// 退出码: 0=PASS  1=REDO  2=usage error
// 落盘: <work_log_dir>/audit-verdict.json

const fs   = require('fs');
const path = require('path');
const cp   = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const taskId = process.argv[2];
if (!taskId) { console.error('audit.js: missing taskId'); process.exit(2); }

const inflightPath = path.join(REPO_ROOT, '.harness', 'inflight', taskId + '.json');
if (!fs.existsSync(inflightPath)) { console.error('audit.js: no inflight at ' + inflightPath); process.exit(2); }

const inflight   = JSON.parse(fs.readFileSync(inflightPath, 'utf8'));
const workLogDir = path.join(REPO_ROOT, inflight.work_log_dir);

// ─── helpers ─────────────────────────────────────────────────────
const exists      = (p) => fs.existsSync(p);
const nonEmpty    = (p) => exists(p) && fs.statSync(p).size > 0;
const readText    = (p) => fs.readFileSync(p, 'utf8');
const dirHasFiles = (p) => exists(p) && fs.statSync(p).isDirectory() && fs.readdirSync(p).length > 0;

function walkFiles(root) {
  if (!exists(root)) return [];
  const out = [];
  const stack = [root];
  while (stack.length) {
    const p = stack.pop();
    const s = fs.statSync(p);
    if (s.isFile()) { out.push(p); continue; }
    if (s.isDirectory()) for (const name of fs.readdirSync(p)) stack.push(path.join(p, name));
  }
  return out;
}

const TEXT_EXTS = new Set(['.md','.ts','.tsx','.js','.jsx','.java','.kt','.py','.go','.xml','.log','.json','.txt','.html','.css','.yaml','.yml']);
function readableTextFiles(root) {
  return walkFiles(root).filter(f => TEXT_EXTS.has(path.extname(f).toLowerCase()));
}

function gitHashExists(hash) {
  try { cp.execSync(`git cat-file -e ${hash}`, { cwd: REPO_ROOT, stdio: 'ignore' }); return true; }
  catch { return false; }
}

function countSubstring(haystack, needle) {
  if (!needle) return 0;
  let n = 0, i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

// ─── verdict accumulator ─────────────────────────────────────────
const checks = [];
function record(dimension, name, pass, evidence) {
  checks.push({ dimension, name, pass: !!pass, evidence: evidence || '' });
}

// ─── 维度 1 · coder_compliance ───────────────────────────────────
function auditCoderCompliance() {
  const DIM = 'coder_compliance';
  const coderMd = path.join(workLogDir, 'coder.md');
  const bugsMd  = path.join(workLogDir, 'bugs-found.md');

  record(DIM, 'coder_md_exists', nonEmpty(coderMd), nonEmpty(coderMd) ? coderMd : `missing: ${coderMd}`);

  if (nonEmpty(coderMd)) {
    const text = readText(coderMd);
    for (const kw of ['地形侦察', '编码', '自检', '提交']) {
      const hits = countSubstring(text, kw);
      record(DIM, `coder_md_keyword_${kw}`, hits >= 1, hits ? `${hits}×` : `keyword '${kw}' not found in coder.md`);
    }
  }

  record(DIM, 'bugs_found_md_exists', nonEmpty(bugsMd), nonEmpty(bugsMd) ? bugsMd : `missing: ${bugsMd}`);

  if (nonEmpty(bugsMd)) {
    const text = readText(bugsMd);
    const has0Bug    = /(0[\s\-]?bug|无\s*bug|零\s*bug|no\s+bugs?)/i.test(text);
    const hasBugList = /^\s*[*\-]\s+|^\s*##?\s+Bug|^\s*\d+\.\s+/m.test(text);
    record(DIM, 'bugs_found_md_has_declaration', has0Bug || hasBugList,
      has0Bug ? '"0 bug" declaration found' : hasBugList ? 'bug list found' : 'neither "0 bug" declaration nor bug list found');
  }
}

// ─── 维度 2 · tester_compliance ──────────────────────────────────
const MOCK_PATTERNS = [
  'vi.mock',
  'page.route',
  'MockMvc',
  'jest.mock',
  'wx.request.mock',
  'miniprogram-simulate',
  'wx.cloud.mock',
  'mockRequest',
];

function auditTesterCompliance() {
  const DIM = 'tester_compliance';
  const testerMd = path.join(workLogDir, 'tester.md');
  const advMd    = path.join(workLogDir, 'adversarial.md');
  const reports  = path.join(workLogDir, 'test-reports');

  record(DIM, 'tester_md_exists',          nonEmpty(testerMd),        nonEmpty(testerMd) ? testerMd : `missing: ${testerMd}`);
  record(DIM, 'adversarial_md_exists',     nonEmpty(advMd),           nonEmpty(advMd)    ? advMd    : `missing: ${advMd}`);
  record(DIM, 'test_reports_nonempty',     dirHasFiles(reports),      dirHasFiles(reports) ? reports : `empty or missing: ${reports}`);

  if (nonEmpty(advMd)) {
    const text = readText(advMd);
    const hasReject = /(REJECT|驳回)/i.test(text);
    const hasFix    = /(fix|修复|修补)/i.test(text);
    record(DIM, 'adversarial_has_reject_round', hasReject, hasReject ? 'REJECT/驳回 keyword found' : 'no REJECT round in adversarial.md');
    record(DIM, 'adversarial_has_fix_round',    hasFix,    hasFix    ? 'fix/修复 keyword found'    : 'no fix round in adversarial.md');
  }

  // mock 总数 ≤ 5 (tester.md + adversarial.md + everything under test-reports/)
  const mockScopeFiles = [];
  for (const f of [testerMd, advMd]) if (nonEmpty(f)) mockScopeFiles.push(f);
  mockScopeFiles.push(...readableTextFiles(reports));
  let mockTotal = 0;
  const mockHits = {};
  for (const f of mockScopeFiles) {
    let body;
    try { body = readText(f); } catch { continue; }
    for (const pat of MOCK_PATTERNS) {
      const c = countSubstring(body, pat);
      if (c) { mockTotal += c; mockHits[pat] = (mockHits[pat] || 0) + c; }
    }
  }
  record(DIM, 'mock_total_le_5', mockTotal <= 5,
    mockTotal <= 5 ? `mock=${mockTotal}/5 (${Object.keys(mockHits).join(',') || 'none'})`
                   : `mock=${mockTotal}/5 OVER · ${JSON.stringify(mockHits)}`);

  // maxDiffPixels ≤ 500 (scan test sources + reports)
  const vrtScopeFiles = [];
  for (const f of [testerMd, advMd]) if (nonEmpty(f)) vrtScopeFiles.push(f);
  vrtScopeFiles.push(...readableTextFiles(reports));
  const E2E_DIR = path.join(REPO_ROOT, 'frontend');
  for (const f of readableTextFiles(E2E_DIR).filter(p => /tests\/e2e\/|playwright\.config/.test(p))) {
    vrtScopeFiles.push(f);
  }
  let maxDiff = 0, maxDiffFile = null;
  for (const f of vrtScopeFiles) {
    let body; try { body = readText(f); } catch { continue; }
    const re = /maxDiffPixels[^0-9]{0,8}(\d+)/g;
    let m;
    while ((m = re.exec(body))) {
      const v = parseInt(m[1], 10);
      if (v > maxDiff) { maxDiff = v; maxDiffFile = f; }
    }
  }
  record(DIM, 'maxDiffPixels_le_500', maxDiff <= 500,
    maxDiff <= 500 ? `max=${maxDiff}/500` : `max=${maxDiff}/500 OVER in ${path.relative(REPO_ROOT, maxDiffFile)}`);
}

// ─── 维度 3 · bug_reality ────────────────────────────────────────
function auditBugReality() {
  const DIM = 'bug_reality';
  const hashes = inflight.task.git_commits || [];

  if (!hashes.length) {
    record(DIM, 'git_commits_present', false, 'task.git_commits[] is empty — Coder must record at least one commit');
    return;
  }

  const bad = hashes.filter(h => !gitHashExists(h));
  record(DIM, 'all_git_commits_verified', bad.length === 0,
    bad.length ? `unverified: ${bad.join(',')}` : `${hashes.length}/${hashes.length} hash(es) git cat-file -e PASS`);
}

// ─── 维度 4 · test_validity ──────────────────────────────────────
const EXPLORATORY_KEYWORDS = [
  '连点', 'rapid click', 'debounce',
  'DOM', '注入', 'inject',
  '超长', '脏数据', '边界', 'boundary',
  '阻断', 'block', 'timeout', '超时', '500',
  'race', '并发', 'concurrent',
  'SQL', 'injection',
];

function countTestcasesInXml(reportsDir) {
  if (!exists(reportsDir)) return 0;
  let total = 0;
  for (const f of walkFiles(reportsDir)) {
    if (path.extname(f).toLowerCase() !== '.xml') continue;
    let body; try { body = readText(f); } catch { continue; }
    total += countSubstring(body, '<testcase');
  }
  return total;
}

function auditTestValidity() {
  const DIM = 'test_validity';
  const testerMd = path.join(workLogDir, 'tester.md');
  const advMd    = path.join(workLogDir, 'adversarial.md');
  const reports  = path.join(workLogDir, 'test-reports');

  // (a) tester.md claimed testcase count vs JUnit XML actual count
  if (nonEmpty(testerMd)) {
    const text = readText(testerMd);
    let claimed = null;
    const patterns = [
      /Tests\s+run:\s*(\d+)/i,
      /(\d+)\s*个\s*testcase/i,
      /(\d+)\s*testcases?\s+passed/i,
      /(\d+)\s*tests?\s+passed/i,
      /(\d+)\s*个\s*测试.*?通过/,
      /(\d+)\/\d+\s*PASS/,
    ];
    for (const re of patterns) { const m = text.match(re); if (m) { claimed = parseInt(m[1], 10); break; } }
    const actual = countTestcasesInXml(reports);
    if (claimed !== null && actual > 0) {
      record(DIM, 'tester_md_testcase_count_matches_xml', claimed === actual,
        claimed === actual ? `claimed=${claimed} == xml<testcase>=${actual}` : `claimed=${claimed} ≠ xml<testcase>=${actual}`);
    } else if (claimed !== null && actual === 0) {
      record(DIM, 'tester_md_testcase_count_matches_xml', false,
        `claimed=${claimed} but no <testcase> in XML — tester.md may inflate`);
    } else {
      record(DIM, 'tester_md_testcase_count_matches_xml', true,
        'no explicit testcase count in tester.md — skip (advisory)');
    }
  }

  // (b) adversarial.md must demonstrate exploratory tests
  if (nonEmpty(advMd)) {
    const text = readText(advMd);
    const hits = EXPLORATORY_KEYWORDS.filter(k => text.includes(k));
    record(DIM, 'adversarial_has_exploratory_keywords', hits.length >= 2,
      hits.length >= 2 ? `${hits.length} matched: [${hits.slice(0,5).join(',')}]`
                       : `${hits.length}/2 minimum (expected: 连点/DOM/注入/超长/阻断/race/SQL etc.)`);
  }
}

// ─── 维度 5 · spec_alignment (DoR C-1..C-6) ──────────────────────
function auditSpecAlignment() {
  const DIM = 'spec_alignment';
  const dorRequired = !!(inflight.physical_verification && inflight.physical_verification.dor_c1_to_c6_required);

  if (!dorRequired) {
    record(DIM, 'dor_e2e_required', true, 'inflight.physical_verification.dor_c1_to_c6_required=false — DoR skipped (P0 audit task)');
    return;
  }

  const e2eCoderDir = path.join(workLogDir, 'test-reports', 'e2e', 'coder');

  // C-2 · Playwright 产物
  const pw = path.join(e2eCoderDir, 'playwright');
  record(DIM, 'c2_playwright_index_html', exists(path.join(pw, 'index.html')), path.join(pw, 'index.html'));
  record(DIM, 'c2_playwright_results_xml', exists(path.join(pw, 'results.xml')), path.join(pw, 'results.xml'));
  const runLog = path.join(pw, 'run.log');
  record(DIM, 'c2_playwright_run_log',   exists(runLog), runLog);
  if (exists(runLog)) {
    const body = readText(runLog);
    const hasFail = /(\b\d+\s+failed\b|timed\s*out)/i.test(body);
    record(DIM, 'c2_playwright_run_log_all_green', !hasFail, hasFail ? 'detected "failed" or "timed out" in run.log' : 'no failures in run.log');
  }

  // C-3 · 后端 IT BUILD SUCCESS
  const verifyLog = path.join(e2eCoderDir, 'backend-it', 'verify.log');
  record(DIM, 'c3_verify_log_exists', exists(verifyLog), verifyLog);
  if (exists(verifyLog)) {
    const body = readText(verifyLog);
    record(DIM, 'c3_verify_log_build_success', body.includes('BUILD SUCCESS'),
      body.includes('BUILD SUCCESS') ? 'BUILD SUCCESS found' : 'BUILD SUCCESS missing (likely BUILD FAILURE)');
  }

  // C-4 · 截图 ≥ 12 张 (4 态 × 3 类)
  const ssDir = path.join(e2eCoderDir, 'screenshots');
  if (exists(ssDir)) {
    const pngCount = fs.readdirSync(ssDir).filter(f => f.endsWith('.png')).length;
    record(DIM, 'c4_screenshots_ge_12', pngCount >= 12, `${pngCount}/12 PNGs in ${ssDir}`);
  } else {
    record(DIM, 'c4_screenshots_ge_12', false, `screenshots dir missing: ${ssDir}`);
  }

  // C-4b · Playwright spec.ts 必须用 toHaveScreenshot (真 pixel diff) 而非只 page.screenshot (盲存)
  // 防 Tester 用 page.screenshot 假装做了 VRT · 实际 0 diff 断言 (PHASE-B T01 attempt-1 真出过这问题)
  const e2eSrcDir = path.join(REPO_ROOT, 'frontend', 'apps', 'h5', 'tests', 'e2e');
  if (exists(e2eSrcDir)) {
    const taskId = inflight.task.id.toLowerCase().replace('sc01-','').replace('-','_');
    const specFiles = walkFiles(e2eSrcDir).filter(f => f.endsWith('.spec.ts'));
    const relevantSpecs = specFiles.filter(f => path.basename(f).toLowerCase().includes(inflight.task.id.toLowerCase().split('-').pop()));
    if (relevantSpecs.length) {
      let totalToHave = 0, totalPageShot = 0;
      for (const f of relevantSpecs) {
        const body = readText(f);
        totalToHave += countSubstring(body, 'toHaveScreenshot');
        totalPageShot += countSubstring(body, 'page.screenshot(');
      }
      record(DIM, 'c4b_real_vrt_diff_not_blind_screenshot', totalToHave >= 1 || totalPageShot === 0,
        totalToHave >= 1 ? `toHaveScreenshot=${totalToHave} (真 VRT diff)`
                         : `0 toHaveScreenshot 但 ${totalPageShot} page.screenshot — 盲存非真 diff`);
    }
  }

  // C-5 · spec-trace.md (≥ 4 行表格)
  const traceMd = path.join(e2eCoderDir, 'spec-trace.md');
  record(DIM, 'c5_spec_trace_md_exists', nonEmpty(traceMd), traceMd);
  if (nonEmpty(traceMd)) {
    const lines = readText(traceMd).split('\n').filter(l => l.trim().startsWith('|') && !l.match(/^\s*\|\s*[-:]+/));
    const tableRows = Math.max(0, lines.length - 1);
    record(DIM, 'c5_spec_trace_md_ge_4_rows', tableRows >= 4, `${tableRows} table row(s) in spec-trace.md`);
  }

  // C-6 · env-snapshot.md + docker ps 真证
  const envMd = path.join(e2eCoderDir, 'env-snapshot.md');
  record(DIM, 'c6_env_snapshot_md_exists', nonEmpty(envMd), envMd);
  if (nonEmpty(envMd)) {
    const body = readText(envMd);
    record(DIM, 'c6_env_snapshot_has_docker_ps', body.includes('docker ps'), 'docker ps in env-snapshot.md');
  }
}

// ─── 维度 7 · test_cases_alignment (Stage 1 · 2026-05-16) ───────
// Test-Case-First 流程编排 · TestDesigner 写用例 → Coder + Tester 互评 → APPROVE 才解锁开发
// 卡口: test-cases.md ≥ 3 行 + 6 列 · review 双方 APPROVE · 链条 ≥ 1 轮 REJECT (防互相批准)
function auditTestCasesAlignment() {
  const DIM = 'test_cases_alignment';
  const casesPath  = path.join(workLogDir, 'test-cases.md');
  const cReviewPath = path.join(workLogDir, 'coder-review.md');
  const tReviewPath = path.join(workLogDir, 'tester-review.md');

  // Stage 1 渐进: 老 task 无 test-cases.md 时不卡 · inflight 加 opt-in 字段 test_case_first_required
  const required = !!(inflight.test_case_first_required);
  if (!required) {
    record(DIM, 'test_case_first_required', true,
      'inflight.test_case_first_required=false · Test-Case-First skip (legacy task)');
    return;
  }

  record(DIM, 'test_cases_md_exists', nonEmpty(casesPath), nonEmpty(casesPath) ? casesPath : `missing: ${casesPath}`);
  record(DIM, 'coder_review_md_exists', nonEmpty(cReviewPath), nonEmpty(cReviewPath) ? cReviewPath : `missing: ${cReviewPath}`);
  record(DIM, 'tester_review_md_exists', nonEmpty(tReviewPath), nonEmpty(tReviewPath) ? tReviewPath : `missing: ${tReviewPath}`);

  if (nonEmpty(casesPath)) {
    const body = readText(casesPath);
    // 数 "| N |" 起始的行 (用例行)
    const rows = body.split('\n').filter(l => /^\|\s*\d+\s*\|/.test(l));
    record(DIM, 'test_cases_ge_3_rows', rows.length >= 3,
      rows.length >= 3 ? `${rows.length} case(s)` : `${rows.length}/3 min`);
    record(DIM, 'test_cases_le_6_rows', rows.length <= 6,
      rows.length <= 6 ? `${rows.length}/6 max` : `${rows.length} > 6 · 拆 task (Rule 6 token budget)`);
    // 表头 6 列严匹配
    const has6Cols = /\|\s*#\s*\|\s*Given\s*\|\s*When\s*\|\s*Then\s*\|\s*Console\s*\|\s*View[^|]*\|\s*API\s*\|/.test(body);
    record(DIM, 'test_cases_6_required_cols', has6Cols,
      has6Cols ? 'header [#|Given|When|Then|Console|View|API] OK' : 'header 6 cols mismatch');
    // trace 必填
    const hasTrace = /^trace:\s+/m.test(body);
    record(DIM, 'test_cases_has_trace', hasTrace,
      hasTrace ? 'trace 行已写' : 'top 行缺 trace: biz/<file> · design/specs/<page>');
  }

  if (nonEmpty(cReviewPath) && nonEmpty(tReviewPath)) {
    const cBody = readText(cReviewPath);
    const tBody = readText(tReviewPath);
    // 至少 1 轮 REJECT (review 链不能 0 对抗 = 互相批准嫌疑)
    const totalRejects = (cBody.match(/REJECT/gi) || []).length + (tBody.match(/REJECT/gi) || []).length;
    record(DIM, 'review_has_ge_1_reject_round', totalRejects >= 1,
      totalRejects >= 1 ? `${totalRejects} REJECT keyword(s) in review chain`
                        : '0 REJECT · 互相批准嫌疑 · TestDesigner 应该写出某些可挑刺的点');
    // 终态必须 APPROVE
    const cApprove = /verdict\s*:?\s*APPROVE|approve/i.test(cBody);
    const tApprove = /verdict\s*:?\s*APPROVE|approve/i.test(tBody);
    record(DIM, 'both_reviewers_approved', cApprove && tApprove,
      `coder=${cApprove?'APPROVE':'?'} · tester=${tApprove?'APPROVE':'?'}`);
  }

  // ── Phase 2.5 · User Approval Gate (2026-05-16 · 人在环 · 防 AI 互相批准失效) ──
  // RC: AI 互评仍是 alignment failure 另一面 · Coder/Tester 同 model 同盲区 ·
  //     test-cases.md 是用户视角契约 · 用户不签字等于跳过最关键的 stakeholder
  // 实现: test-cases.md 末尾必须有 ## User Approval section + verdict: APPROVE
  //       由用户手动编辑该 section · audit text-based grep · 不靠 inflight (与现有 review 机制一致)
  if (nonEmpty(casesPath)) {
    const body = readText(casesPath);
    const hasUserSection = /^##\s+User\s+Approval/im.test(body);
    record(DIM, 'user_approval_section_present', hasUserSection,
      hasUserSection ? 'has "## User Approval" section'
                     : 'missing "## User Approval" section · TestDesigner AI-approve 后必须 append 空 section 等用户签字');

    if (hasUserSection) {
      // 只在 User Approval section 之后 grep verdict APPROVE · 防把 Coder/Tester review 的 APPROVE 误算
      const userSectionStart = body.search(/^##\s+User\s+Approval/im);
      const userSection = userSectionStart >= 0 ? body.slice(userSectionStart) : '';
      const userApproved = /verdict\s*:?\s*APPROVE/i.test(userSection);
      record(DIM, 'user_verdict_approve', userApproved,
        userApproved ? 'user verdict: APPROVE'
                     : 'user verdict ≠ APPROVE · 阻塞 Coder dev · 等用户编辑 test-cases.md 填 "verdict: APPROVE"');
    }
  }
}

// ─── 维度 6 · ide_smoke (Fix-1 · 2026-05-16) ────────────────────
// RC: "E2E 8/8 PASS 但 IDE 一片红" 事故 · audit 5 维度全 PASS 但用户视角失败
// Fix: Tester PASS 必须落 work_log_dir/test-reports/ide-console.txt · 内容来自
//      _helpers.ts connectMp() 的 mp.on('console') 订阅 · 0 字节 = PASS · 任何 [error] 行 = REDO
function auditIdeSmoke() {
  const DIM = 'ide_smoke';

  // 仅对有 UI 的 team 强制 (mp / h5) · backend / shared / data 不要求
  const teamId = (inflight.task.team_id || '').toLowerCase();
  const teamRequiresIde = teamId === 'mp' || teamId === 'h5' || teamId === 'frontend';
  if (!teamRequiresIde) {
    record(DIM, 'ide_smoke_required_by_team', true,
      `team_id=${teamId} · not UI team · IDE smoke skipped`);
    return;
  }

  const logPath = path.join(workLogDir, 'test-reports', 'ide-console.txt');
  if (!exists(logPath)) {
    record(DIM, 'ide_console_log_exists', false,
      `missing: ${logPath} · Tester 必须跑 console-aware E2E (_helpers.ts connectMp) 落此文件`);
    return;
  }
  record(DIM, 'ide_console_log_exists', true, logPath);

  const body = readText(logPath);
  // 严格: 任何 [error] 行 = REDO · [warn] 不计 (deprecated API 等第三方告警暂留 backlog)
  const errorLines = body.split('\n').filter(l => /^\[error\]/.test(l));
  const errCount = errorLines.length;
  record(DIM, 'ide_console_zero_errors', errCount === 0,
    errCount === 0 ? '0 [error] lines'
                   : `${errCount} [error] line(s) · 前 3:\n${errorLines.slice(0, 3).join('\n')}`);
}

// ─── REDO target 决策 ────────────────────────────────────────────
const TEST_DESIGNER_DIMS = new Set(['test_cases_alignment']);
const CODER_DIMS  = new Set(['coder_compliance', 'bug_reality', 'spec_alignment', 'ide_smoke']);
const TESTER_DIMS = new Set(['tester_compliance', 'test_validity']);

function decideRedoTarget(failed) {
  const designerFails = failed.filter(c => TEST_DESIGNER_DIMS.has(c.dimension));
  const coderFails    = failed.filter(c => CODER_DIMS.has(c.dimension));
  const testerFails   = failed.filter(c => TESTER_DIMS.has(c.dimension));
  // 优先级: TestDesigner 失败 → 上游问题先修 · 然后 Coder · 最后 Tester
  if (designerFails.length) return 'test-designer';
  if (coderFails.length)    return 'coder';
  if (testerFails.length)   return 'tester';
  return null;
}

// ─── main ────────────────────────────────────────────────────────
auditCoderCompliance();
auditTesterCompliance();
auditBugReality();
auditTestValidity();
auditSpecAlignment();
auditIdeSmoke();
auditTestCasesAlignment();

const failed   = checks.filter(c => !c.pass);
const allPass  = failed.length === 0;
const verdict  = {
  task_id:     taskId,
  attempt:     inflight.task.attempt,
  team_id:     inflight.task.team_id,
  audited_at:  new Date().toISOString(),
  audited_by:  'audit.js v3 (deterministic · 7 dims · +test_cases_alignment)',
  pass:        allPass,
  checks,
  redo_target: allPass ? null : decideRedoTarget(failed),
  redo_reason: allPass ? null : failed.map(c => `[${c.dimension}.${c.name}] ${c.evidence}`).join(' · '),
};

fs.writeFileSync(path.join(workLogDir, 'audit-verdict.json'), JSON.stringify(verdict, null, 2) + '\n');

// ─── pretty print (grouped by dimension) ─────────────────────────
const RED='\x1b[31m', GREEN='\x1b[32m', YELLOW='\x1b[33m', CYAN='\x1b[36m', BOLD='\x1b[1m', DIM='\x1b[2m', RESET='\x1b[0m';
const DIM_ORDER = ['test_cases_alignment','coder_compliance','tester_compliance','bug_reality','test_validity','spec_alignment','ide_smoke'];

console.log(`${BOLD}[audit] ${taskId} attempt-${inflight.task.attempt} → ${allPass ? GREEN+'PASS' : RED+'REDO target='+verdict.redo_target}${RESET}`);
for (const dim of DIM_ORDER) {
  const dimChecks = checks.filter(c => c.dimension === dim);
  if (!dimChecks.length) continue;
  const allDim = dimChecks.every(c => c.pass);
  const dimColor = allDim ? GREEN : RED;
  console.log(`${CYAN}── ${dimColor}${dim}${RESET}${CYAN} (${dimChecks.filter(c=>c.pass).length}/${dimChecks.length})${RESET}`);
  for (const c of dimChecks) {
    console.log(`   ${c.pass ? GREEN+'✓' : RED+'✗'}${RESET} ${c.name}${DIM} · ${c.evidence}${RESET}`);
  }
}

process.exit(allPass ? 0 : 1);
