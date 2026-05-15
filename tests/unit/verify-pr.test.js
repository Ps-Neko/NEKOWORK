import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  verifyPrCycle,
  parseVerifyPrArgs,
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
