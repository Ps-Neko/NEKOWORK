#!/usr/bin/env node
// HARNESS CLI 진입점. Day 1 에는 install plan/apply 만 라우팅.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const verb = process.argv[2];
const rest = process.argv.slice(3);

function run(script, args) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

function help() {
  console.log(`
harness <verb> [args]

Day 1 동작 가능:
  harness install --plan [--profile <name>] [--harness <name>] [--json] [--verbose]
  harness install --apply ...   (stub, Day 5 이후)
  harness validate              (모든 매니페스트·카탈로그 검증)
  harness version

Day 2 이후:
  harness review "<task>" [--secure|--fast|--no-ship]
  harness plan "<task>"
  harness sessions
  harness costs --since=7d
`);
}

switch (verb) {
  case 'install': {
    const mode = rest.includes('--apply') ? 'apply' : 'plan';
    const filtered = rest.filter(a => a !== '--apply' && a !== '--plan');
    run(`install-${mode}.js`, filtered);
    break;
  }
  case 'validate':
    // Day 1: install-plan 의 검증 단계만 호출 (--profile core --verbose)
    run('install-plan.js', ['--profile', 'core', '--verbose']);
    break;
  case 'version':
  case '--version':
  case '-v': {
    const fs = await import('node:fs');
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    console.log(`harness ${pkg.version}`);
    break;
  }
  case undefined:
  case 'help':
  case '--help':
  case '-h':
    help();
    break;
  default:
    console.error(`알 수 없는 verb: ${verb}`);
    help();
    process.exit(2);
}
