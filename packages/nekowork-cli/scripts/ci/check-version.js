#!/usr/bin/env node
// 버전 정합성 게이트. `VERSION`, `package.json`, `WORKING-CONTEXT.md`,
// `README.md`/`README.ko.md` 의 Status 절이 단일 진실 소스를 공유하는지 검사한다.
//
// 정책:
//   - VERSION 과 package.json.version 은 정확히 일치해야 한다.
//   - WORKING-CONTEXT.md 의 "버전: `<x>`" 라인이 있으면 package.json 과 일치해야 한다.
//   - README.md "Current repository version: `<x>`" 가 있으면 일치해야 한다.
// CI 가 catch 못 한 내부 모순을 lint 단계에서 잡는다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const errors = [];

function readFile(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

const pkgRaw = readFile('package.json');
if (!pkgRaw) {
  errors.push('package.json missing');
} else {
  const pkg = JSON.parse(pkgRaw);
  const packageVersion = pkg.version;

  const versionFile = readFile('VERSION');
  if (versionFile == null) {
    errors.push('VERSION file missing');
  } else {
    const versionFileValue = versionFile.trim();
    if (versionFileValue !== packageVersion) {
      errors.push(`VERSION (${versionFileValue}) does not match package.json (${packageVersion})`);
    }
  }

  const workingContext = readFile('WORKING-CONTEXT.md');
  if (workingContext) {
    const match = workingContext.match(/^- 버전:\s*`([^`]+)`/m);
    if (match && match[1] !== packageVersion) {
      errors.push(`WORKING-CONTEXT.md '버전: \`${match[1]}\`' does not match package.json (${packageVersion})`);
    }
  }

  for (const readmeRel of ['README.md', 'README.ko.md']) {
    const readme = readFile(readmeRel);
    if (!readme) continue;
    const match = readme.match(/Current repository version:\s*`([^`]+)`/);
    if (match && match[1] !== packageVersion) {
      errors.push(`${readmeRel} 'Current repository version: \`${match[1]}\`' does not match package.json (${packageVersion})`);
    }
  }
}

if (errors.length) {
  for (const error of errors) {
    process.stderr.write(`check-version: ${error}\n`);
  }
  process.exit(1);
}

process.stdout.write('check-version: ok\n');
