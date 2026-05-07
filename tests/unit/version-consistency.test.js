import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('public release surfaces use the package version', () => {
  const pkg = JSON.parse(read('package.json'));
  const manifest = YAML.parse(read('agent.yaml'));

  assert.equal(manifest.version, pkg.version);
  assert.match(read('README.md'), new RegExp(`Current repository version: \`${pkg.version}\``));
  assert.match(read('docs/SETUP.md'), new RegExp(`NEKOWORK \`${pkg.version}\``));
  assert.match(read('docs/PORTING.md'), new RegExp(`NEKOWORK \`${pkg.version}\``));
  assert.match(read('docs/DEMO.md'), new RegExp(`@ps-neko/nekowork@${pkg.version}`));
  assert.match(read('docs/assets/demo-terminal.svg'), new RegExp(`@ps-neko/nekowork@${pkg.version}`));
});
