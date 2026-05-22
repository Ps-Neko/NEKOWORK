import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectProject } from '../../scripts/lib/project-detector.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'project-detect-'));
}

function writeFile(root, relative, content) {
  const full = path.join(root, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

test('Node 프로젝트: package.json + scripts → 명령 추출', () => {
  const root = makeTempDir();
  try {
    writeFile(root, 'package.json', JSON.stringify({
      name: 'demo',
      scripts: { test: 'node --test', lint: 'eslint .', build: 'tsc' },
    }));
    writeFile(root, 'package-lock.json', '{}');

    const r = detectProject(root);
    assert.equal(r.projectType, 'node');
    assert.equal(r.packageManager, 'npm');
    assert.equal(r.hasTests, true);
    assert.equal(r.commands.test, 'npm test');
    assert.equal(r.hasLint, true);
    assert.equal(r.commands.lint, 'npm run lint');
    assert.equal(r.hasBuild, true);
    assert.equal(r.commands.build, 'npm run build');
    assert.equal(r.hasAudit, true);
    assert.match(r.commands.audit, /audit-level=moderate/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('tsconfig.json 만 있으면 typecheck fallback 으로 npx tsc', () => {
  const root = makeTempDir();
  try {
    writeFile(root, 'package.json', JSON.stringify({ name: 'demo', scripts: { test: 'foo' } }));
    writeFile(root, 'tsconfig.json', '{}');

    const r = detectProject(root);
    assert.equal(r.hasTypecheck, true);
    assert.equal(r.commands.typecheck, 'npx tsc --noEmit');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('typecheck script 가 있으면 그걸 우선', () => {
  const root = makeTempDir();
  try {
    writeFile(root, 'package.json', JSON.stringify({
      name: 'demo',
      scripts: { typecheck: 'tsc --noEmit' },
    }));
    writeFile(root, 'tsconfig.json', '{}');

    const r = detectProject(root);
    assert.equal(r.commands.typecheck, 'npm run typecheck');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('pnpm-lock.yaml → packageManager=pnpm', () => {
  const root = makeTempDir();
  try {
    writeFile(root, 'package.json', JSON.stringify({ name: 'demo', scripts: { test: 'foo' } }));
    writeFile(root, 'pnpm-lock.yaml', '');

    const r = detectProject(root);
    assert.equal(r.packageManager, 'pnpm');
    assert.equal(r.commands.test, 'pnpm test');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Rust 프로젝트: Cargo.toml → cargo test / clippy', () => {
  const root = makeTempDir();
  try {
    writeFile(root, 'Cargo.toml', '[package]\nname = "x"\nversion = "0.1.0"');

    const r = detectProject(root);
    assert.equal(r.projectType, 'rust');
    assert.equal(r.commands.test, 'cargo test');
    assert.match(r.commands.lint, /clippy/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CI 파일 탐지: .github/workflows 있으면 hasCi=true', () => {
  const root = makeTempDir();
  try {
    writeFile(root, 'package.json', '{}');
    writeFile(root, '.github/workflows/ci.yml', 'on: push');

    const r = detectProject(root);
    assert.equal(r.hasCi, true);
    assert.ok(r.ciFiles.includes('.github/workflows'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('보안 파일 탐지: .env.example, SECURITY.md', () => {
  const root = makeTempDir();
  try {
    writeFile(root, '.env.example', 'API_KEY=');
    writeFile(root, 'SECURITY.md', '# security');

    const r = detectProject(root);
    assert.ok(r.securityFiles.includes('.env.example'));
    assert.ok(r.securityFiles.includes('SECURITY.md'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('language marker 없음 → projectType=unknown', () => {
  const root = makeTempDir();
  try {
    writeFile(root, 'README.md', '# nothing');
    const r = detectProject(root);
    assert.equal(r.projectType, 'unknown');
    assert.deepEqual(r.languages, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('hasGit: .git 디렉토리 존재 시 true', () => {
  const root = makeTempDir();
  try {
    writeFile(root, '.git/HEAD', 'ref: refs/heads/main');
    const r = detectProject(root);
    assert.equal(r.hasGit, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('package.json 파싱 실패 시 안전하게 fallback', () => {
  const root = makeTempDir();
  try {
    writeFile(root, 'package.json', '{ not valid json');
    const r = detectProject(root);
    assert.equal(r.projectType, 'node');
    assert.equal(r.hasTests, false);
    assert.equal(r.commands.test, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('baselineAt 은 ISO 8601 형식', () => {
  const root = makeTempDir();
  try {
    writeFile(root, 'package.json', '{}');
    const r = detectProject(root);
    assert.match(r.baselineAt, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
