#!/usr/bin/env node
// NEKOWORK tamper demo: 기록(decision.json)을 위조해도 verify-pr 는 매 실행마다
// diff 에서 verdict 를 재계산한다. 위조는 무의미하다.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  verifyPrCycle,
  printVerifyPrSummary,
  VERDICT,
} from './orchestrators/verify-pr.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { cleanup: true, json: false };
  for (const a of argv) {
    if (a === '--keep') args.cleanup = false;
    else if (a === '--cleanup') args.cleanup = true;
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/demo-tamper.js [--keep] [--json]');
      process.exit(0);
    } else throw new Error(`unknown option: ${a}`);
  }
  return args;
}

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${r.status}): ${r.stderr || r.stdout}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(`DEMO ASSERT FAILED: ${msg}`);
}

// 검증된 fixture: tests/unit/verify-pr.test.js 의 "Secret Fallback 추가 → BLOCK" 와 동일 문자열.
const SECRET_DIFF = [
  'export function getKey(): string {',
  '  return process.env.API_KEY || "sk-leaked-fallback-secret";',
  '}',
  '',
].join('\n');

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nekowork-tamper-demo-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'demo@nekowork.local']);
  git(root, ['config', 'user.name', 'nekowork-demo']);
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'tamper-demo', scripts: { test: 'node --test' } }, null, 2) + '\n',
  );
  fs.writeFileSync(path.join(root, '.gitignore'), '.nekowork/\nREPORT.md\n');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  // baseline: 안전한 버전을 커밋
  fs.writeFileSync(path.join(root, 'src', 'auth.ts'),
    'export function getKey(): string {\n  return "static-ok";\n}\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'baseline']);
  // AI 가 secret fallback 을 심는다 (미커밋 working-tree 변경 = verify-pr 가 보는 diff)
  fs.writeFileSync(path.join(root, 'src', 'auth.ts'), SECRET_DIFF);
  return root;
}

async function runVerify(root, label) {
  console.log(`\n=== ${label} ===`);
  const result = await verifyPrCycle({ projectRoot: root, write: true });
  printVerifyPrSummary(result);
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = makeSandbox();
  console.log('NEKOWORK tamper demo — 기록을 위조해도 verdict 는 diff 에서 재계산된다');
  console.log(`sandbox: ${root}  (사용자 프로젝트는 건드리지 않음)`);

  try {
    // 1막: AI 가 심은 secret → verify-pr 가 BLOCK
    const r1 = await runVerify(root, '1막: AI 가 secret fallback 을 심었다 → verify-pr');
    assert(r1.decision.verdict === VERDICT.BLOCK, `1막 verdict 는 BLOCK 이어야 함 (got ${r1.decision.verdict})`);
    assert(r1.exitCode === 2, `1막 exitCode 는 2 여야 함 (got ${r1.exitCode})`);

    // 2막: 누군가 기록을 ALLOW 로 위조
    const decisionPath = path.join(root, '.nekowork', 'decision.json');
    const tampered = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
    tampered.verdict = VERDICT.ALLOW;
    tampered.apply_allowed = true;
    fs.writeFileSync(decisionPath, JSON.stringify(tampered, null, 2));
    console.log('\n=== 2막: 누군가 기록(.nekowork/decision.json)을 위조 ===');
    console.log(`  위조됨 → "verdict": "${tampered.verdict}", "apply_allowed": ${tampered.apply_allowed}`);
    const reloaded = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
    assert(reloaded.verdict === VERDICT.ALLOW, '2막: 위조(ALLOW)가 디스크에 적용되어야 함');

    // 3막: 재실행 → 위조는 무시되고 BLOCK 으로 재계산
    const r3 = await runVerify(root, '3막: verify-pr 재실행 (위조는 무시된다)');
    assert(r3.decision.verdict === VERDICT.BLOCK, `3막 verdict 는 BLOCK 이어야 함 (got ${r3.decision.verdict})`);
    assert(r3.exitCode === 2, `3막 exitCode 는 2 여야 함 (got ${r3.exitCode})`);
    const rereadDecision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
    assert(rereadDecision.verdict === VERDICT.BLOCK,
      `3막: decision.json 이 다시 BLOCK 으로 재계산되어야 함 (got ${rereadDecision.verdict})`);

    console.log('\n교훈: 기록을 고쳐도 소용없다 — verdict 는 매 실행마다 diff 에서 재계산된다.');
    console.log('      게이트는 저장된 상태(기록)가 아니라 diff(실물)를 믿는다.');

    // LLM 컷 (illustrative — 실제 API 호출 아님)
    console.log('\n=== 예시: LLM advisor 가 LGTM 해도 ===');
    console.log('  (예시) Codex advisor: "LGTM — dev fallback, looks fine."');
    console.log('  → verdict: BLOCK. 결정론 룰이 결정한다. LLM 은 verdict 를 통제하지 않는다.');

    if (args.json) {
      console.log('\n' + JSON.stringify({
        act1: { verdict: r1.decision.verdict, exitCode: r1.exitCode },
        act3: { verdict: r3.decision.verdict, exitCode: r3.exitCode },
      }));
    }
    console.log('\n재현: npm run demo:tamper  (또는 직접: 임의 repo 에서 npx -y @ps-neko/nekowork@alpha verify-pr)');
  } finally {
    if (args.cleanup) {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      console.log('sandbox removed (--keep 로 보존 가능).');
    } else {
      console.log(`sandbox kept: ${root}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
