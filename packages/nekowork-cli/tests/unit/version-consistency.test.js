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
  // nekowork-cli is now the internal harness (@ps-neko/nekowork-harness).
  // It exposes only the nekowork-harness bin to avoid workspace bin-link
  // collision with the slim @ps-neko/nekowork package.
  assert.equal(pkg.bin['nekowork-harness'], 'scripts/cli.js');

  const monorepoRoot = path.resolve(ROOT, '..', '..');
  const lockYaml = fs.readFileSync(path.join(monorepoRoot, 'pnpm-lock.yaml'), 'utf8');
  assert.match(lockYaml, /packages\/nekowork-cli:/, 'pnpm-lock.yaml must record nekowork-cli importer');
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

test('README leads with verification gate identity (SCOPE-1.0 Phase 0)', () => {
  const readme = read('README.md');
  const firstScreen = readme.slice(0, readme.indexOf('## One Command. One Blocked Risk.'));

  // 1.0 hero: 검증 게이트 정체성
  assert.match(readme, /\*\*Don't merge AI code without verification\.\*\*/);
  assert.match(readme, /local verification gate for AI-generated code/);
  assert.match(readme, /"Verified" means independently reviewed with recorded evidence — not mathematically proven correct/);
  assert.match(readme, /Optional Codex review is recorded as an advisor note only and never controls the verdict/);
  assert.match(readme, /diff -> deterministic risk rules -> checks \(test\/lint\/typecheck; detected always, executed with --run-checks, escalation-only\) -> evidence package -> deterministic decision -> REPORT\.md -> Human Gate -> human merge decision/);
  // verify-pr (read-only gate) 와 session-based apply (compatibility) 는 분리된 흐름으로 명시되어야 한다
  assert.match(readme, /Session-based apply \(compatibility, separate\): work -> verify -> ship -> cleared Human Gate -> apply/);
  assert.match(readme, /verify-pr itself does not apply changes/);
  assert.match(readme, /docs\/SCOPE-1\.0\.md/);
  assert.match(readme, /docs\/VISION\.md/);
  // verify-pr 출력 형식 (alpha.11 onward)
  assert.match(readme, /One Command\. One Blocked Risk\./);
  assert.match(readme, /verdict\s+:\s+BLOCK/);
  assert.match(readme, /Hardcoded secret fallback detected/);
  assert.match(readme, /apply_allowed\s+:\s+false/);
  // hero noise gate: 알파 시기 의 over-claim 패턴 차단
  assert.doesNotMatch(firstScreen, /12 practical agentic harness patterns/);
  assert.doesNotMatch(firstScreen, /parallel candidates/i);
  assert.doesNotMatch(firstScreen, /ralph|instincts/i);
  assert.doesNotMatch(firstScreen, /`work`, `verify`, `ship`/);
});

test('README quickstart, CLI stage docs, and package metadata agree on verify-first path', () => {
  const pkg = JSON.parse(read('package.json'));
  const readme = read('README.md');
  const quickstart = markdownSection(readme, '30-Second First Run');
  const stages = read('docs/CLI-STAGES.md');

  // package description must convey the 1.0 verification-gate identity.
  // Accept any phrasing that mentions (a) verification of AI-written code AND
  // (b) the deterministic/rule-based or non-LLM-verdict promise. The exact
  // string was tightened on 2026-05-27 (commit b13e82e) — see docs/SCOPE-1.0.md.
  assert.match(pkg.description, /verification gate|verify|verification/i);
  assert.match(pkg.description, /AI|deterministic rule|never the LLM/i);
  assert.match(quickstart, /npx -y @ps-neko\/nekowork@alpha check/);
  assert.match(quickstart, /npx -y @ps-neko\/nekowork@alpha verify-pr/);
  assert.match(quickstart, /cat REPORT\.md/);
  assert.match(quickstart, /cat \.nekowork\/decision\.json/);
  // quickstart 의 실행 명령에서는 --session 의존성 있는 report/apply 를 표면화하지 않음
  // (compat reference 텍스트로 언급은 OK)
  assert.doesNotMatch(quickstart, /nekowork@alpha report\b/);
  assert.doesNotMatch(quickstart, /nekowork@alpha apply\b/);
  assert.doesNotMatch(quickstart, /work -> verify -> ship/);
  // CLI-STAGES.md 는 1.0 front surface (check + verify-pr) 로 정렬됨 — start 는 compatibility 경로로 강등
  assert.match(stages, /check -> verify-pr/);
  assert.doesNotMatch(stages, /Most users should start with this Beginner path/);
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
  assert.match(ko, /Tests: 533 pass/);
  assert.match(ko, /docs\/EXTERNAL-RUN\.md/);
  assert.match(ko, /docs\/INTEGRATION\.md/);
});
