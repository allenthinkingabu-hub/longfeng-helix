#!/usr/bin/env node
'use strict';

// harness.js — engine: orchestrates Coder ↔ Tester adversarial loops + invokes audit.js.
// 指挥链: 人类 → TL agent → harness.js → agent team (Coder + Tester) → audit.js
// 设计原则: 程序不说谎。

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

// ─── Layout ──────────────────────────────────────────────────────
const REPO_ROOT    = path.resolve(__dirname, '..');
const HARNESS_DIR  = path.join(REPO_ROOT, '.harness');
const INFLIGHT_DIR = path.join(HARNESS_DIR, 'inflight');
const EVENT_DIR    = path.join(HARNESS_DIR, 'events');
const RUNS_DIR     = path.join(REPO_ROOT, 'audits', 'runs');
const AUDIT_JS     = path.join(__dirname, 'audit.js');

const PHASES = Object.freeze({
  CODER:         'coder',
  TESTER:        'tester',
  DONE:          'done',
  CIRCUIT_BREAK: 'circuit_break',
});

const MAX_AUDIT_RETRIES = 3;
const SPAWN_MODE = process.env.HARNESS_SPAWN_MODE || 'claude';

// ─── ANSI ────────────────────────────────────────────────────────
const RED='\x1b[31m', GREEN='\x1b[32m', YELLOW='\x1b[33m', BLUE='\x1b[34m', CYAN='\x1b[36m', BOLD='\x1b[1m', DIM='\x1b[2m', RESET='\x1b[0m';
const log = (m, c) => console.log((c||'') + m + RESET);
const err = (m)    => console.error(RED + m + RESET);

// ─── fs helpers ──────────────────────────────────────────────────
const ensureDir   = (p) => fs.mkdirSync(p, { recursive: true });
const readJson    = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson   = (p, obj) => { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); };
const fileExists  = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const inflightPath = (id) => path.join(INFLIGHT_DIR, id + '.json');

// ─── inflight schema ─────────────────────────────────────────────
function permissionsFor(phase) {
  if (phase === PHASES.CODER)  return { writable_fields: ['task.dev_done', 'task.git_commits'] };
  if (phase === PHASES.TESTER) return { writable_fields: ['task.passes'] };
  return { writable_fields: [] };
}

function logRequirementsFor(phase) {
  if (phase === PHASES.CODER)  return { must_write: ['coder.md', 'bugs-found.md'] };
  if (phase === PHASES.TESTER) return { must_write: ['tester.md', 'adversarial.md', 'test-reports/'] };
  return { must_write: [] };
}

function makeInflight({ taskId, teamId, title, attempt, phase, context, isolation, previousAuditVerdict, gitCommits, auditRetries }) {
  attempt = attempt || 1;
  phase = phase || PHASES.CODER;
  const workLogDir = path.posix.join('audits/runs', taskId, teamId, 'attempt-' + attempt);
  ensureDir(path.join(REPO_ROOT, workLogDir));
  return {
    schema_version: 1,
    task: {
      id: taskId,
      team_id: teamId,
      title: title || '',
      attempt,
      phase,
      dev_done: false,
      passes: false,
      retries: 0,
      audit_retries: auditRetries || 0,
      git_commits: gitCommits || [],
    },
    work_log_dir: workLogDir,
    log_requirements: logRequirementsFor(phase),
    audit_gate: 'audit.js 五维度卡口: (1) work_log_dir 三件套齐全 (2) commit hash git cat-file -e 验真 (3) mock ≤ 5 (4) maxDiffPixels ≤ 500 (5) 对抗 ≥ 1 轮 REJECT+fix',
    previous_audit_verdict: previousAuditVerdict || null,
    context: context || {},
    isolation: isolation || { worktree_disabled: false, working_dir: REPO_ROOT, branch_name: null },
    physical_verification: { dor_c1_to_c6_required: phase === PHASES.CODER },
    permissions: permissionsFor(phase),
    written_at: new Date().toISOString(),
    written_by: 'harness',
  };
}

// ─── state machine ───────────────────────────────────────────────
function decideNextAction(payload) {
  const t = payload.task;
  if (t.audit_retries >= MAX_AUDIT_RETRIES) return { kind: 'circuit_break', reason: `audit_retries=${t.audit_retries} ≥ ${MAX_AUDIT_RETRIES}` };
  if (t.phase === PHASES.CODER) {
    if (!t.dev_done) return { kind: 'stay', reason: 'coder still working (dev_done=false)' };
    return { kind: 'transition', toPhase: PHASES.TESTER };
  }
  if (t.phase === PHASES.TESTER) {
    if (!t.passes) return { kind: 'stay', reason: 'tester still working (passes=false)' };
    return { kind: 'audit', reason: 'tester PASS, must invoke audit.js' };
  }
  if (t.phase === PHASES.DONE) return { kind: 'stay', reason: 'already done' };
  return { kind: 'stay', reason: 'phase=' + t.phase };
}

// ─── git hash verification ───────────────────────────────────────
function verifyCommitHashes(payload) {
  const bad = [];
  for (const h of payload.task.git_commits || []) {
    try { cp.execSync(`git cat-file -e ${h}`, { cwd: REPO_ROOT, stdio: 'ignore' }); }
    catch { bad.push(h); }
  }
  return bad;
}

// ─── audit hook ──────────────────────────────────────────────────
function runAudit(taskId) {
  if (!fileExists(AUDIT_JS)) {
    err(`audit.js not found at ${AUDIT_JS} — cannot proceed past tester PASS without deterministic audit.`);
    return { exitCode: 127, verdict: null };
  }
  log(`${CYAN}[audit] invoking audit.js for ${taskId}...${RESET}`);
  const result = cp.spawnSync('node', [AUDIT_JS, taskId], { cwd: REPO_ROOT, stdio: 'inherit' });
  const payload = readInflight(taskId);
  const verdictPath = path.join(REPO_ROOT, payload.work_log_dir, 'audit-verdict.json');
  const verdict = fileExists(verdictPath) ? readJson(verdictPath) : null;
  return { exitCode: result.status, verdict };
}

// ─── inflight io ─────────────────────────────────────────────────
function readInflight(taskId) {
  const p = inflightPath(taskId);
  if (!fileExists(p)) throw new Error(`no inflight for ${taskId} at ${p}`);
  return readJson(p);
}

function writeInflight(taskId, payload) {
  payload.written_at = new Date().toISOString();
  payload.written_by = payload.written_by || 'harness';
  writeJson(inflightPath(taskId), payload);
}

function listInflight() {
  if (!fileExists(INFLIGHT_DIR)) return [];
  return fs.readdirSync(INFLIGHT_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
}

// ─── spawn agent (pluggable: claude | stub | manual) ─────────────
function spawnAgent({ role, taskId }) {
  const payload     = readInflight(taskId);
  const workingDir  = (payload.isolation && payload.isolation.working_dir) || REPO_ROOT;
  const agentMd     = path.join('.harness', 'agents', role === 'coder' ? 'coder-agent.md' : 'test-agent.md');
  const inflightRel = path.relative(REPO_ROOT, inflightPath(taskId));
  const prompt = [
    `你是 ${role} agent。`,
    `第一件事: 完整读 ${agentMd} 全文 + 完整读 ${inflightRel} 全文。`,
    `按 agent.md 内化的铁律和步骤执行 task ${taskId}。`,
    `完成后改对应 inflight 字段 (Coder: dev_done; Tester: passes)，`,
    `然后调用 node .harness/harness.js --advance=${taskId} 通知 harness 推进。`,
  ].join(' ');

  if (SPAWN_MODE === 'stub') {
    log(`${YELLOW}[stub spawn] would spawn ${role} for ${taskId} cwd=${path.relative(REPO_ROOT, workingDir) || '.'}${RESET}`);
    log(`${DIM}  prompt: ${prompt}${RESET}`);
    return { mode: 'stub', pid: null };
  }

  if (SPAWN_MODE === 'manual') {
    ensureDir(EVENT_DIR);
    const reqPath = path.join(EVENT_DIR, `spawn-${taskId}-${role}-${Date.now()}.json`);
    writeJson(reqPath, { role, taskId, prompt, agentMd, inflightRel, workingDir });
    log(`${YELLOW}[manual spawn] wrote ${path.relative(REPO_ROOT, reqPath)} — TL agent must spawn via Task tool.${RESET}`);
    return { mode: 'manual', pid: null, reqPath };
  }

  try {
    const child = cp.spawn('claude', ['-p', prompt], { cwd: workingDir, stdio: ['ignore', 'inherit', 'inherit'], detached: true });
    child.unref();
    log(`${GREEN}[claude spawn] ${role} ${taskId} pid=${child.pid}${RESET}`);
    return { mode: 'claude', pid: child.pid };
  } catch (e) {
    err(`claude CLI spawn failed: ${e.message}`);
    err(`set HARNESS_SPAWN_MODE=stub or manual to bypass.`);
    return { mode: 'claude', pid: null, error: e.message };
  }
}

// ─── snapshot dashboard ──────────────────────────────────────────
function renderSnapshot() {
  const tasks = listInflight().map(id => {
    try { return readInflight(id); } catch { return null; }
  }).filter(Boolean);

  console.log();
  console.log(BOLD + '═══ harness · 实时看板 ═══' + RESET);
  console.log(`${DIM}snapshot @ ${new Date().toISOString()} · ${tasks.length} task(s) inflight · spawn_mode=${SPAWN_MODE}${RESET}`);
  console.log();
  console.log(`${BOLD}${'TASK'.padEnd(14)} ${'TEAM'.padEnd(8)} ${'PHASE'.padEnd(16)} ${'ATT'.padEnd(4)} ${'DEV'.padEnd(4)} ${'PASS'.padEnd(5)} ${'AR'.padEnd(3)} ${'LAST WRITE'}${RESET}`);
  console.log(DIM + '─'.repeat(96) + RESET);
  for (const p of tasks) {
    const t = p.task;
    const phaseColor = t.phase === PHASES.CIRCUIT_BREAK ? RED
      : t.phase === PHASES.DONE   ? GREEN
      : t.phase === PHASES.TESTER ? CYAN
      :                              BLUE;
    const devColor  = t.dev_done ? GREEN : DIM;
    const passColor = t.passes   ? GREEN : DIM;
    const arColor   = t.audit_retries >= 2 ? YELLOW : DIM;
    console.log(
      `${t.id.padEnd(14)} ${(t.team_id || '').padEnd(8)} ${phaseColor}${t.phase.padEnd(16)}${RESET} ${String(t.attempt).padEnd(4)} ${devColor}${(t.dev_done ? 'Y' : 'N').padEnd(4)}${RESET} ${passColor}${(t.passes ? 'Y' : 'N').padEnd(5)}${RESET} ${arColor}${String(t.audit_retries).padEnd(3)}${RESET} ${DIM}${p.written_at}${RESET}`
    );
  }
  console.log();
}

// ─── core: advance ───────────────────────────────────────────────
function cmdAdvance(taskId) {
  const payload = readInflight(taskId);

  log(`${BOLD}[advance] ${taskId} · phase=${payload.task.phase} · attempt=${payload.task.attempt}${RESET}`);

  // cheap pre-check: every claimed commit hash must really exist.
  // (audit.js will also do this; surfacing early avoids wasting an audit call.)
  const badHashes = verifyCommitHashes(payload);
  if (badHashes.length) {
    err(`commit hash verification FAILED: ${badHashes.join(', ')} — git cat-file -e missed.`);
    err(`agent claimed commits that do not exist. abort advance.`);
    process.exit(2);
  }

  const next = decideNextAction(payload);
  log(`${DIM}[decide] ${next.kind}: ${next.reason || next.toPhase || ''}${RESET}`);

  if (next.kind === 'stay') {
    log(`${YELLOW}[stay] phase=${payload.task.phase}, no transition.${RESET}`);
    return;
  }

  if (next.kind === 'circuit_break') {
    payload.task.phase = PHASES.CIRCUIT_BREAK;
    writeInflight(taskId, payload);
    err(`[CIRCUIT BREAK] ${next.reason}. surfacing to TL agent — human intervention needed.`);
    process.exit(3);
  }

  if (next.kind === 'transition') {
    payload.task.phase = next.toPhase;
    payload.permissions = permissionsFor(next.toPhase);
    payload.log_requirements = logRequirementsFor(next.toPhase);
    payload.physical_verification = { dor_c1_to_c6_required: next.toPhase === PHASES.CODER };
    writeInflight(taskId, payload);
    log(`${GREEN}[transition] coder → tester · spawning tester...${RESET}`);
    spawnAgent({ role: 'tester', taskId });
    return;
  }

  if (next.kind === 'audit') {
    const { exitCode, verdict } = runAudit(taskId);
    if (exitCode === 0) {
      const reloaded = readInflight(taskId);
      reloaded.task.phase = PHASES.DONE;
      writeInflight(taskId, reloaded);
      log(`${GREEN}${BOLD}[audit PASS] ${taskId} truly complete.${RESET}`);
      return;
    }
    // audit REDO — bump attempt, route back to coder or tester per verdict
    const reloaded = readInflight(taskId);
    const target   = (verdict && verdict.redo_target) || 'coder';
    const reason   = (verdict && verdict.redo_reason) || 'audit failed (verdict missing or non-zero exit)';
    reloaded.task.passes        = false;
    reloaded.task.audit_retries = (reloaded.task.audit_retries || 0) + 1;
    reloaded.task.attempt       = (reloaded.task.attempt || 1) + 1;
    reloaded.task.dev_done      = target === 'tester';   // coder REDO needs new dev_done; tester REDO keeps coder's done state
    reloaded.task.phase         = target;
    reloaded.work_log_dir       = path.posix.join('audits/runs', taskId, reloaded.task.team_id, 'attempt-' + reloaded.task.attempt);
    ensureDir(path.join(REPO_ROOT, reloaded.work_log_dir));
    reloaded.permissions             = permissionsFor(target);
    reloaded.log_requirements        = logRequirementsFor(target);
    reloaded.physical_verification   = { dor_c1_to_c6_required: target === PHASES.CODER };
    reloaded.previous_audit_verdict  = verdict;
    writeInflight(taskId, reloaded);
    err(`[audit REDO] target=${target} · attempt→${reloaded.task.attempt} · audit_retries=${reloaded.task.audit_retries}`);
    err(`  reason: ${reason}`);
    spawnAgent({ role: target, taskId });
    return;
  }
}

// ─── init / status / list / reset / start / help ─────────────────
function cmdInit({ taskId, teamId, title, contextPath }) {
  if (!taskId) { err('--init requires task id'); process.exit(2); }
  teamId = teamId || 'team-1';
  let context = {};
  if (contextPath) {
    if (!fileExists(contextPath)) { err(`context file not found: ${contextPath}`); process.exit(2); }
    context = readJson(contextPath);
  }
  if (fileExists(inflightPath(taskId))) {
    err(`inflight ${taskId}.json already exists. use --reset=${taskId} to recycle.`);
    process.exit(2);
  }
  const payload = makeInflight({ taskId, teamId, title, attempt: 1, phase: PHASES.CODER, context });
  writeInflight(taskId, payload);
  log(`${GREEN}[init] ${taskId}/${teamId} · phase=coder · work_log_dir=${payload.work_log_dir}${RESET}`);
}

function cmdStatus(taskId) {
  if (taskId) {
    console.log(JSON.stringify(readInflight(taskId), null, 2));
    return;
  }
  renderSnapshot();
}

function cmdList() {
  const tasks = listInflight();
  console.log(tasks.length ? tasks.join('\n') : '(no inflight tasks)');
}

function cmdReset(taskId) {
  const p = readInflight(taskId);
  p.task.audit_retries = 0;
  p.task.phase         = PHASES.CODER;
  p.task.dev_done      = false;
  p.task.passes        = false;
  p.task.attempt       = (p.task.attempt || 1) + 1;
  p.work_log_dir       = path.posix.join('audits/runs', taskId, p.task.team_id, 'attempt-' + p.task.attempt);
  ensureDir(path.join(REPO_ROOT, p.work_log_dir));
  p.permissions             = permissionsFor(PHASES.CODER);
  p.log_requirements        = logRequirementsFor(PHASES.CODER);
  p.physical_verification   = { dor_c1_to_c6_required: true };
  p.previous_audit_verdict  = null;
  writeInflight(taskId, p);
  log(`${YELLOW}[reset] ${taskId} · attempt→${p.task.attempt} · phase=coder · audit_retries cleared.${RESET}`);
}

function cmdStart({ taskId, teamId, featureList }) {
  if (taskId) {
    if (!fileExists(inflightPath(taskId))) cmdInit({ taskId, teamId });
    spawnAgent({ role: 'coder', taskId });
  } else if (featureList) {
    err('--feature-list parsing not yet implemented (待 feature_list.json 还原后再接).');
    process.exit(2);
  } else {
    err('--start requires --task=<id> or --feature-list=<path>');
    process.exit(2);
  }

  log(`${BOLD}${CYAN}[engine] watching ${path.relative(REPO_ROOT, INFLIGHT_DIR)}/ · ctrl-c to stop${RESET}`);
  setInterval(() => {
    process.stdout.write('\x1b[2J\x1b[0;0H');  // clear + home
    renderSnapshot();
  }, 1000);
}

function cmdHelp() {
  console.log(`
${BOLD}harness.js — engine for AI agent team (Coder + Tester) adversarial loop${RESET}

${BOLD}USAGE${RESET}
  node .harness/harness.js --init=<task_id> [--team=<team>] [--title="..."] [--context=path/to/ctx.json]
  node .harness/harness.js --advance=<task_id>
  node .harness/harness.js --status[=<task_id>]
  node .harness/harness.js --list
  node .harness/harness.js --reset=<task_id>
  node .harness/harness.js --start [--task=<id>] [--team=<team>] [--feature-list=path]
  node .harness/harness.js --help

${BOLD}ENV${RESET}
  HARNESS_SPAWN_MODE   claude | stub | manual    (default: claude)

${BOLD}指挥链${RESET}
  human → TL agent → harness.js → agent team (Coder + Tester) → audit.js
                     └── engine ──┘                              └── deterministic gate

${BOLD}PHASES${RESET}
  coder ─(dev_done=true · advance)→ tester ─(passes=true · advance)→ audit
                                                                     ├ PASS → done
                                                                     └ REDO → target=coder|tester · attempt++ · audit_retries++

  audit_retries ≥ ${MAX_AUDIT_RETRIES} → circuit_break (surface to TL · human intervention)
`);
}

// ─── CLI ─────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  }
  return args;
}

function main() {
  ensureDir(INFLIGHT_DIR);
  ensureDir(EVENT_DIR);

  const args = parseArgs(process.argv.slice(2));

  if (args.help || Object.keys(args).length === 0) return cmdHelp();
  if (args.advance)               return cmdAdvance(args.advance);
  if (args.init)                  return cmdInit({ taskId: args.init, teamId: args.team, title: args.title, contextPath: args.context });
  if (args.status !== undefined)  return cmdStatus(typeof args.status === 'string' ? args.status : null);
  if (args.list)                  return cmdList();
  if (args.reset)                 return cmdReset(args.reset);
  if (args.start)                 return cmdStart({ taskId: args.task, teamId: args.team, featureList: args['feature-list'] });

  err('unknown command. use --help.');
  process.exit(2);
}

main();
