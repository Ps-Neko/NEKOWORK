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

test('README defines apply-before-verify safety gate without overclaiming proof', () => {
  const readme = read('README.md');
  const firstScreen = readme.slice(0, readme.indexOf('## One Command. One Blocked Risk.'));

  assert.match(readme, /Verifies AI-made code changes before you apply them/);
  assert.match(readme, /NEKOWORK is a local safety gate for AI coding tools/);
  assert.match(readme, /"Verified" means independently reviewed with recorded evidence, not mathematically proven correctness/);
  assert.match(readme, /Bring your coding agent\. NEKOWORK proves the change before apply\./);
  assert.match(readme, /diff -> deterministic risk scan -> Codex verification -> decision\.json -> REPORT\.md -> Human Gate -> explicit apply/);
  assert.match(readme, /One Command\. One Blocked Risk\./);
  assert.match(readme, /Verdict: BLOCKED/);
  assert.match(readme, /Reason: preverify requires Human Gate for secret env fallback/);
  assert.match(readme, /Apply allowed: false/);
  assert.doesNotMatch(firstScreen, /12 practical agentic harness patterns/);
  assert.doesNotMatch(firstScreen, /parallel candidates/i);
  assert.doesNotMatch(firstScreen, /ralph|instincts/i);
  assert.doesNotMatch(firstScreen, /`work`, `verify`, `ship`/);
});

test('README quickstart, CLI stage docs, and package metadata agree on start-first path', () => {
  const pkg = JSON.parse(read('package.json'));
  const readme = read('README.md');
  const quickstart = markdownSection(readme, '30-Second First Run');
  const stages = read('docs/CLI-STAGES.md');

  assert.match(pkg.description, /Verifies AI-made code changes before apply/);
  assert.match(quickstart, /npx -y @ps-neko\/nekowork@alpha check/);
  assert.match(quickstart, /npx -y @ps-neko\/nekowork@alpha start "fix failing tests safely"/);
  assert.match(quickstart, /npx -y @ps-neko\/nekowork@alpha report --session latest/);
  assert.doesNotMatch(quickstart, /work -> verify -> ship/);
  assert.match(stages, /check -> start -> report -> gate status/);
});

test('integration docs keep upstream domain workflow outside the core runtime', () => {
  const readme = read('README.md');
  const integration = read('docs/INTEGRATION.md');

  assert.match(readme, /\[docs\/INTEGRATION\.md\]\(docs\/INTEGRATION\.md\)/);
  assert.match(readme, /Works With Your Existing AI Workflow/);
  assert.match(integration, /NEKOWORK should stay narrow/);
  assert.match(integration, /domain\/spec workflow -> candidate change -> NEKOWORK safety gate/);
  for (const artifact of ['context.md', 'DOMAIN.md', 'SPEC.md', 'PLAN.md']) {
    assert.ok(integration.includes(`\`${artifact}\``), `${artifact} missing from integration artifact contract`);
  }
  assert.match(integration, /Bug fix, refactor, or docs-only change/);
  assert.match(integration, /Large feature with unclear domain/);
  assert.match(integration, /no built-in domain interview system/);
  assert.match(integration, /The integration point is the artifact contract/);
});

test('Korean README keeps public install and evidence links visible', () => {
  const ko = read('README.ko.md');

  assert.match(ko, /\[English\]\(README\.md\)/);
  assert.match(ko, /Node\.js 22\+/);
  assert.match(ko, /npx -y @ps-neko\/nekowork@alpha check/);
  assert.match(ko, /docs\/AGENTIC-PATTERNS\.md/);
  assert.match(ko, /Tests: 398/);
  assert.match(ko, /docs\/EXTERNAL-RUN\.md/);
  assert.match(ko, /docs\/INTEGRATION\.md/);
});
