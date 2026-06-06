#!/usr/bin/env node
// Live AI diff capture — protocol per docs/LIVE-AI-CAPTURE.md.
//
// Wraps the per-task / per-session protocol so the user does not have to run
// git stash + git diff + git rev-parse + CSV append by hand.
//
// Usage (start a capture):
//   node scripts/benchmark/capture-live-ai-diff.js start \
//     --workspace /tmp/live-ai-session-001 \
//     --tool claude-code \
//     --model opus-4.7 \
//     --task-id tier1-jwt-auth-001 \
//     --prompt "Add JWT-based auth middleware to this Express app."
//
// Usage (snapshot after AI is done):
//   node scripts/benchmark/capture-live-ai-diff.js snapshot \
//     --workspace /tmp/live-ai-session-001
//
// State is kept in <workspace>/.nekowork-capture/session.json so the snapshot
// step knows the starting SHA, tool, task-id, and prompt without needing them
// re-passed.
//
// Captures land in:
//   <repo>/packages/nekowork/tests/fixtures/live-ai/captures/<timestamp>-<tool>-<task-id>.patch
//   <repo>/packages/nekowork/tests/fixtures/live-ai/captures.csv

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_DIR = path.join(ROOT, 'tests', 'fixtures', 'live-ai');
const CAPTURE_DIR = path.join(FIXTURE_DIR, 'captures');
const CSV_PATH = path.join(FIXTURE_DIR, 'captures.csv');

const args = parseArgs(process.argv.slice(2));
const subcommand = args._[0];

if (subcommand === 'start') {
  doStart(args);
} else if (subcommand === 'snapshot') {
  doSnapshot(args);
} else if (subcommand === 'list') {
  doList();
} else {
  console.error(`Unknown subcommand: ${subcommand}.

Usage:
  capture-live-ai-diff.js start --workspace <dir> --tool <id> --model <id> --task-id <id> --prompt "<text>"
  capture-live-ai-diff.js snapshot --workspace <dir>
  capture-live-ai-diff.js list

Tools (suggested): claude-code, cursor, codex, copilot-chat
See packages/nekowork/docs/LIVE-AI-CAPTURE.md for the protocol.`);
  process.exit(1);
}

function doStart({ workspace, tool, model, 'task-id': taskId, prompt }) {
  if (!workspace || !tool || !taskId) {
    console.error('start requires --workspace, --tool, --task-id (and recommended --model + --prompt).');
    process.exit(1);
  }
  if (!fs.existsSync(workspace)) {
    console.error(`Workspace ${workspace} does not exist. Create or init it first.`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(workspace, '.git'))) {
    console.error(`Workspace ${workspace} is not a git repo. Run \`git init\` in it first.`);
    process.exit(1);
  }
  // Workspace must be clean — otherwise the snapshot diff will include
  // unrelated changes. We tolerate untracked files.
  const statusBuf = execSync('git status --porcelain', { cwd: workspace, encoding: 'utf8' });
  const dirty = statusBuf.split('\n').filter(l => l && !l.startsWith('??')).length > 0;
  if (dirty) {
    console.error(`Workspace has uncommitted tracked changes:\n${statusBuf}\nCommit or stash before \`start\`.`);
    process.exit(1);
  }
  const startSha = execSync('git rev-parse HEAD', { cwd: workspace, encoding: 'utf8' }).trim();

  const stateDir = path.join(workspace, '.nekowork-capture');
  fs.mkdirSync(stateDir, { recursive: true });
  const session = {
    started_at: new Date().toISOString(),
    workspace,
    tool,
    model: model || null,
    task_id: taskId,
    prompt: prompt || null,
    starting_sha: startSha,
  };
  fs.writeFileSync(path.join(stateDir, 'session.json'), JSON.stringify(session, null, 2));

  console.log(`Capture session started.
  workspace : ${workspace}
  tool      : ${tool}${model ? ' / ' + model : ''}
  task      : ${taskId}
  prompt    : ${prompt || '(none)'}
  base      : ${startSha.slice(0, 8)}

Now: ask the AI tool to perform the task. Do NOT commit. When the AI is done:
  capture-live-ai-diff.js snapshot --workspace ${workspace}`);
}

function doSnapshot({ workspace }) {
  if (!workspace) {
    console.error('snapshot requires --workspace');
    process.exit(1);
  }
  const sessionPath = path.join(workspace, '.nekowork-capture', 'session.json');
  if (!fs.existsSync(sessionPath)) {
    console.error(`No active capture in ${workspace}. Run \`start\` first.`);
    process.exit(1);
  }
  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));

  // Snapshot the diff against the starting SHA. Includes untracked + tracked changes.
  execSync('git add -A', { cwd: workspace });
  const diff = execSync(`git diff --cached ${session.starting_sha}`, { cwd: workspace, encoding: 'utf8' });
  // Reset the staging area so the user is left with the same working tree state.
  execSync('git reset', { cwd: workspace });

  if (!diff.trim()) {
    console.log('No diff produced by this session (no-op). Recording as note: no-op.');
  }

  const timestamp = session.started_at.replace(/[:.]/g, '-');
  const safeTool = session.tool.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const safeTask = session.task_id.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const patchName = `${timestamp}-${safeTool}-${safeTask}.patch`;

  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CAPTURE_DIR, patchName), diff || '# (no-op session)\n');

  const diffStat = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
  const captureId = `live-${Date.now()}`;

  const csvHeader = 'capture_id,tool,model,task_id,workspace,starting_sha,patch_file,added_lines,captured_at,notes\n';
  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(CSV_PATH, csvHeader);
  }
  const csvRow = [
    captureId,
    session.tool,
    session.model || '',
    session.task_id,
    quote(session.workspace),
    session.starting_sha,
    patchName,
    diffStat,
    new Date().toISOString(),
    diff.trim() ? '' : 'no-op',
  ].join(',') + '\n';
  fs.appendFileSync(CSV_PATH, csvRow);

  // Wipe the per-workspace capture state so the next session is clean.
  fs.unlinkSync(sessionPath);
  try { fs.rmdirSync(path.join(workspace, '.nekowork-capture')); } catch {}

  console.log(`Snapshot recorded.
  capture_id : ${captureId}
  patch      : ${path.join(CAPTURE_DIR, patchName)}
  csv        : ${CSV_PATH}
  added LOC  : ${diffStat}

Optional next step: scan the diff for rule findings:
  node scripts/cli.js verify-pr --range ${session.starting_sha}...HEAD`);
}

function doList() {
  if (!fs.existsSync(CSV_PATH)) {
    console.log('No captures recorded yet.');
    return;
  }
  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  process.stdout.write(csv);
}

function quote(s) {
  if (s == null) return '';
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; }
      else { out[key] = true; }
    } else {
      out._.push(a);
    }
  }
  return out;
}
