import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  verifyPrCycle,
  parseVerifyPrArgs,
  printVerifyPrSummary,
  VERDICT,
  EXIT_CODE,
} from '../../scripts/orchestrators/verify-pr.js';

function makeTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-pr-'));
  spawnSync('git', ['init', '-q'], { cwd: root });
  spawnSync('git', ['config', 'user.email', 't@t.t'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: root });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'demo',
    scripts: { test: 'node --test' },
  }));
  fs.writeFileSync(path.join(root, '.gitignore'), '.nekowork/\nREPORT.md\n');
  spawnSync('git', ['add', '-A'], { cwd: root });
  spawnSync('git', ['commit', '-q', '-m', 'init'], { cwd: root });
  return root;
}

function writeAndStage(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

test('parseVerifyPrArgs: default = working tree', () => {
  const opts = parseVerifyPrArgs([]);
  assert.equal(opts.mode, 'working');
  assert.equal(opts.write, true);
  assert.equal(opts.json, false);
});

test('parseVerifyPrArgs: --from-patch + path', () => {
  const opts = parseVerifyPrArgs(['--from-patch', 'some/foo.patch']);
  assert.equal(opts.mode, 'patch');
  assert.equal(opts.patchPath, 'some/foo.patch');
});

test('parseVerifyPrArgs: --no-write 와 --json', () => {
  const opts = parseVerifyPrArgs(['--no-write', '--json']);
  assert.equal(opts.write, false);
  assert.equal(opts.json, true);
});

test('EXIT_CODE 매핑: SCOPE-1.0 §8 와 일치', () => {
  assert.equal(EXIT_CODE[VERDICT.ALLOW], 0);
  assert.equal(EXIT_CODE[VERDICT.ALLOW_WITH_WARNINGS], 0);
  assert.equal(EXIT_CODE[VERDICT.NEEDS_HUMAN_REVIEW], 1);
  assert.equal(EXIT_CODE[VERDICT.INSUFFICIENT_EVIDENCE], 1);
  assert.equal(EXIT_CODE[VERDICT.BLOCK], 2);
});

test('working tree 변경 없음 → ALLOW + apply_allowed', async () => {
  const root = makeTempProject();
  try {
    const result = await verifyPrCycle({ projectRoot: root, write: false });
    assert.equal(result.decision.verdict, VERDICT.ALLOW);
    assert.equal(result.decision.apply_allowed, true);
    assert.equal(result.exitCode, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Secret Fallback 추가 → BLOCK + apply_allowed=false + exit 2', async () => {
  const root = makeTempProject();
  try {
    writeAndStage(root, 'src/auth.ts', [
      'export function getKey(): string {',
      '  return process.env.API_KEY || "sk-leaked-fallback-secret";',
      '}',
    ].join('\n'));
    const result = await verifyPrCycle({ projectRoot: root, write: true });
    assert.equal(result.decision.verdict, VERDICT.BLOCK);
    assert.equal(result.decision.apply_allowed, false);
    assert.equal(result.decision.merge_allowed, false);
    assert.equal(result.exitCode, 2);
    assert.equal(result.decision.finding_counts.critical, 1);

    // 증거 파일 확인
    assert.ok(fs.existsSync(path.join(root, '.nekowork', 'decision.json')));
    assert.ok(fs.existsSync(path.join(root, '.nekowork', 'evidence', 'risk-findings.json')));
    assert.ok(fs.existsSync(path.join(root, '.nekowork', 'evidence', 'evidence-manifest.json')));
    assert.ok(fs.existsSync(path.join(root, 'REPORT.md')));

    const report = fs.readFileSync(path.join(root, 'REPORT.md'), 'utf8');
    assert.match(report, /\*\*BLOCK\*\*/);
    assert.match(report, /Hardcoded secret fallback/);
    assert.match(report, /src\/auth\.ts:2/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('source 변경 + test 명령 없음 → INSUFFICIENT_EVIDENCE', async () => {
  const root = makeTempProject();
  try {
    // package.json 의 test 스크립트 제거
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo' }));
    spawnSync('git', ['add', 'package.json'], { cwd: root });
    spawnSync('git', ['commit', '-q', '-m', 'drop test script'], { cwd: root });
    // benign source change
    writeAndStage(root, 'src/util.ts', 'export const x = 1;\n');

    const result = await verifyPrCycle({ projectRoot: root, write: false });
    assert.equal(result.decision.verdict, VERDICT.INSUFFICIENT_EVIDENCE);
    assert.equal(result.exitCode, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('docs only 변경 → ALLOW', async () => {
  const root = makeTempProject();
  try {
    writeAndStage(root, 'docs/notes.md', '# notes\n\nadded a line.\n');
    const result = await verifyPrCycle({ projectRoot: root, write: false });
    assert.equal(result.decision.verdict, VERDICT.ALLOW);
    assert.equal(result.decision.changed_files.docs.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('--no-write 시 disk 에 .nekowork 생성 안 함', async () => {
  const root = makeTempProject();
  try {
    writeAndStage(root, 'docs/x.md', '# x\n');
    const result = await verifyPrCycle({ projectRoot: root, write: false });
    assert.equal(result.writtenPaths, null);
    assert.equal(fs.existsSync(path.join(root, '.nekowork')), false);
    assert.equal(fs.existsSync(path.join(root, 'REPORT.md')), false);
    assert.equal(result.decision.verdict, VERDICT.ALLOW);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('--comment-file 옵션: PR comment markdown 생성', async () => {
  const root = makeTempProject();
  try {
    writeAndStage(root, 'src/leak.ts', 'export const k = process.env.API_KEY || "sk-leaked-fallback-test";');
    const commentPath = path.join(root, 'pr-comment.md');
    const result = await verifyPrCycle({
      projectRoot: root,
      write: false,
      commentFile: commentPath,
    });
    assert.equal(result.decision.verdict, VERDICT.BLOCK);
    assert.ok(fs.existsSync(commentPath));
    const comment = fs.readFileSync(commentPath, 'utf8');
    assert.match(comment, /NEKOWORK verify-pr.*BLOCK/);
    assert.match(comment, /Blocking findings/);
    assert.match(comment, /Hardcoded secret fallback/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('--ci-exit-soft: NEEDS_HUMAN_REVIEW → exit 0 강제', async () => {
  const root = makeTempProject();
  try {
    // Generate HIGH (not CRITICAL): trigger ts-ignore which is MEDIUM... we
    // need HIGH for NEEDS_HUMAN_REVIEW. Use it.skip which is HIGH severity.
    writeAndStage(root, 'src/x.test.ts', "import { test } from 'node:test';\ntest.skip('x', () => {});\n");
    const result = await verifyPrCycle({
      projectRoot: root,
      write: false,
      ciExitSoft: true,
    });
    assert.equal(result.decision.verdict, VERDICT.NEEDS_HUMAN_REVIEW);
    assert.equal(result.exitCode, 0, '--ci-exit-soft 가 NEEDS_HUMAN_REVIEW 의 exit code 를 0 으로 만들어야 함');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('--from-patch 모드: patch file 입력으로 검증', async () => {
  const root = makeTempProject();
  try {
    const patch = `diff --git a/src/auth.ts b/src/auth.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/auth.ts
@@ -0,0 +1,3 @@
+export function getKey(): string {
+  return process.env.API_KEY || "sk-test-fallback-string";
+}
`;
    const patchPath = path.join(root, 'change.patch');
    fs.writeFileSync(patchPath, patch);
    const result = await verifyPrCycle({
      projectRoot: root,
      mode: 'patch',
      patchPath,
      write: false,
    });
    assert.equal(result.decision.verdict, VERDICT.BLOCK);
    assert.equal(result.findings[0].file, 'src/auth.ts');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('parseVerifyPrArgs: --full-scan / --full → mode=full', () => {
  assert.equal(parseVerifyPrArgs(['--full-scan']).mode, 'full');
  assert.equal(parseVerifyPrArgs(['--full']).mode, 'full');
});

test('--full-scan: 변경 없어도 커밋된 파일 전체를 스캔해 시크릿 발견 → BLOCK', async () => {
  const root = makeTempProject();
  try {
    // 시크릿이 든 파일을 커밋한다 (working tree 에는 변경 없음).
    writeAndStage(root, 'src/config.ts', [
      'export function getKey(): string {',
      '  return process.env.API_KEY || "sk-committed-fallback-secret";',
      '}',
    ].join('\n'));
    spawnSync('git', ['add', '-A'], { cwd: root });
    spawnSync('git', ['commit', '-q', '-m', 'add config'], { cwd: root });

    // 기본(working) 모드: 변경분 없음 → ALLOW (커밋된 시크릿은 안 보임)
    const working = await verifyPrCycle({ projectRoot: root, write: false });
    assert.equal(working.decision.verdict, VERDICT.ALLOW);

    // full-scan: 추적 파일 전체를 스캔해 커밋된 시크릿을 잡는다 → BLOCK
    const full = await verifyPrCycle({ projectRoot: root, mode: 'full', write: false });
    assert.equal(full.decision.verdict, VERDICT.BLOCK);
    assert.equal(full.decision.apply_allowed, false);
    assert.ok(full.findings.some(f => f.file === 'src/config.ts'),
      'full-scan 은 커밋된 src/config.ts 의 시크릿을 finding 으로 잡아야 함');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('INSUFFICIENT_EVIDENCE reason 은 "실패 아님" 안내를 포함', async () => {
  const root = makeTempProject();
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo' }));
    spawnSync('git', ['add', 'package.json'], { cwd: root });
    spawnSync('git', ['commit', '-q', '-m', 'drop test script'], { cwd: root });
    writeAndStage(root, 'src/util.ts', 'export const x = 1;\n');

    const result = await verifyPrCycle({ projectRoot: root, write: false });
    assert.equal(result.decision.verdict, VERDICT.INSUFFICIENT_EVIDENCE);
    assert.match(result.decision.reason, /not a failure/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('parseVerifyPrArgs: --include <경로> 는 includePaths 에 누적', () => {
  const opts = parseVerifyPrArgs(['--include', 'src/generated', '--include', 'build/out.js']);
  assert.deepEqual(opts.includePaths, ['src/generated', 'build/out.js']);
});

test('--include: gitignore 된 경로의 시크릿도 강제 스캔 → BLOCK (박준우 케이스)', async () => {
  const root = makeTempProject();
  try {
    // codegen 산출물 디렉토리를 gitignore 한다
    fs.appendFileSync(path.join(root, '.gitignore'), 'generated/\n');
    spawnSync('git', ['add', '.gitignore'], { cwd: root });
    spawnSync('git', ['commit', '-q', '-m', 'ignore generated'], { cwd: root });
    // gitignore 된 codegen 파일에 시크릿 fallback
    fs.mkdirSync(path.join(root, 'generated'), { recursive: true });
    fs.writeFileSync(path.join(root, 'generated', 'client.ts'), [
      'export function getKey(): string {',
      '  return process.env.API_KEY || "sk-codegen-fallback-secret";',
      '}',
    ].join('\n'));

    // 기본(working) 모드: generated/ 는 gitignore 라 diff 에 안 잡힘 → ALLOW
    const working = await verifyPrCycle({ projectRoot: root, write: false });
    assert.equal(working.decision.verdict, VERDICT.ALLOW);

    // --include generated: gitignore 무관하게 강제 스캔 → BLOCK
    const included = await verifyPrCycle({ projectRoot: root, includePaths: ['generated'], write: false });
    assert.equal(included.decision.verdict, VERDICT.BLOCK);
    assert.ok(included.findings.some(f => f.file === 'generated/client.ts'),
      '--include 는 gitignore 된 generated/client.ts 의 시크릿을 잡아야 함');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('parseVerifyPrArgs: --run-checks 와 --checks-timeout', () => {
  const opts = parseVerifyPrArgs(['--run-checks', '--checks-timeout', '60000']);
  assert.equal(opts.runChecks, true);
  assert.equal(opts.checksTimeout, 60000);
});

test('parseVerifyPrArgs: --run-checks 없으면 runChecks 는 falsy', () => {
  const opts = parseVerifyPrArgs([]);
  assert.ok(!opts.runChecks);
});

test('printVerifyPrSummary: --run-checks 결과를 checks 줄로 출력', () => {
  const orig = console.log;
  const out = [];
  console.log = (...a) => out.push(a.join(' '));
  try {
    printVerifyPrSummary({
      decision: {
        verdict: 'NEEDS_HUMAN_REVIEW',
        reason: 'x',
        risk_level: 'LOW',
        merge_allowed: false,
        apply_allowed: false,
        changed_files: { total: 0, additions: 0, deletions: 0 },
        finding_counts: { critical: 0, high: 0, medium: 0, low: 0 },
        checks: {
          requested: true,
          skippedReason: null,
          results: [{ name: 'test', status: 'fail' }, { name: 'lint', status: 'skipped' }],
        },
      },
      findings: [],
      writtenPaths: null,
    });
  } finally {
    console.log = orig;
  }
  assert.ok(out.join('\n').match(/checks.*test=fail/), 'checks 줄에 test=fail 이 포함되어야 함');
});
