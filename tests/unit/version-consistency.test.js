import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function markdownSection(text, heading) {
  const start = text.indexOf(`## ${heading}`);
  assert.notEqual(start, -1, `${heading} section missing`);
  const rest = text.slice(start);
  const next = rest.indexOf('\n## ', 1);
  return next === -1 ? rest : rest.slice(0, next);
}

function packNamesFromTable(text, heading) {
  const section = markdownSection(text, heading);
  return [...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map(match => match[1]);
}

test('release surfaces record repository version and published alpha', () => {
  const pkg = JSON.parse(read('package.json'));
  const manifest = YAML.parse(read('agent.yaml'));
  const readme = read('README.md');
  const npmAlpha = readme.match(/Current npm alpha: `@ps-neko\/nekowork@([^`]+)`/)?.[1];

  assert.equal(manifest.version, pkg.version);
  assert.match(readme, new RegExp(`Current repository version: \`${pkg.version}\``));
  assert.match(read('docs/SETUP.md'), new RegExp(`NEKOWORK \`${pkg.version}\``));
  assert.match(read('docs/PORTING.md'), new RegExp(`NEKOWORK \`${pkg.version}\``));
  assert.ok(npmAlpha, 'README must record the current npm alpha version');
  assert.match(read('docs/DEMO.md'), new RegExp(`@ps-neko/nekowork@${npmAlpha}`));
  assert.match(read('docs/assets/demo-terminal.svg'), new RegExp(`@ps-neko/nekowork@${npmAlpha}`));
});

test('package exposes product and runtime CLI names', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));

  assert.equal(pkg.bin.nekowork, 'scripts/cli.js');
  assert.equal(pkg.bin.harness, 'scripts/cli.js');
  assert.deepEqual(lock.packages[''].bin, pkg.bin);
});

test('official pack docs match install profile manifest', () => {
  const profiles = JSON.parse(read('manifests/install-profiles.json'));
  const packNames = Object.keys(profiles.packs);
  const readme = read('README.md');
  const readmeStarterPacks = packNamesFromTable(readme, 'Starter Packs');
  const catalog = read('docs/CATALOG-PACKS.md');
  const catalogPacks = packNamesFromTable(catalog, 'Official Packs');
  const expectedStarterPacks = ['core', 'builder', 'productivity', 'security', 'release'];

  assert.deepEqual(readmeStarterPacks, expectedStarterPacks);
  assert.deepEqual(catalogPacks, packNames);
  assert.match(catalog, new RegExp(`${packNames.length} official packs`));
  assert.match(readme, /5 starter packs/);
  assert.doesNotMatch(readme, new RegExp(`${packNames.length} packs /`));
});

test('README defines verified autopilot without overclaiming proof', () => {
  const readme = read('README.md');

  assert.match(readme, /Verified Autopilot for AI code changes/);
  assert.match(readme, /\[한국어\]\(README\.ko\.md\)/);
  assert.match(readme, /"Verified" means independently reviewed with recorded evidence, not mathematically proven correctness/);
  assert.match(readme, /One Command\. One Blocked Risk\./);
  assert.match(readme, /Codex verdict: request_changes/);
  assert.match(readme, /Applied: false/);
});

test('Korean README keeps the GitHub landing page thesis and install path', () => {
  const ko = read('README.ko.md');

  assert.match(ko, /\[English\]\(README\.md\)/);
  assert.match(ko, /AI 코드 변경을 위한 검증형 오토파일럿/);
  assert.match(ko, /AI가 만들고, Codex가 검증하고, 사람은 최종 경계를 승인합니다/);
  assert.match(ko, /npx -y @ps-neko\/nekowork@alpha check/);
  assert.match(ko, /Risk: provider-auth \/ long-lived-secret/);
  assert.match(ko, /Applied: false/);
  assert.match(ko, /Tests: 293 pass/);
  assert.match(ko, /docs\/EXTERNAL-RUN\.md/);
});
