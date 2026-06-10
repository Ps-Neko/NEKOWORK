// Project baseline detector for verify-pr.
//
// Inspects a working directory to decide which verification commands can run
// against the change. The result feeds the verification plan: a "no test
// script" answer becomes INSUFFICIENT_EVIDENCE for source changes, not PASS.
//
// Out of scope: dependency graph resolution, repo-wide static analysis.

import fs from 'node:fs';
import path from 'node:path';

const SECURITY_FILE_HINTS = [
  '.env',
  '.env.example',
  '.env.template',
  'SECURITY.md',
  '.github/workflows',
];

const CI_FILES = [
  '.github/workflows',
  '.gitlab-ci.yml',
  '.circleci/config.yml',
  'azure-pipelines.yml',
  'Jenkinsfile',
  '.travis.yml',
];

const LANGUAGE_MARKERS = [
  { type: 'node', file: 'package.json' },
  { type: 'rust', file: 'Cargo.toml' },
  { type: 'python', file: 'pyproject.toml' },
  { type: 'python', file: 'requirements.txt' },
  { type: 'go', file: 'go.mod' },
  { type: 'java', file: 'pom.xml' },
  { type: 'java', file: 'build.gradle' },
  { type: 'java', file: 'build.gradle.kts' },
  { type: 'ruby', file: 'Gemfile' },
  { type: 'php', file: 'composer.json' },
];

const LOCKFILE_TO_PM = {
  'package-lock.json': 'npm',
  'npm-shrinkwrap.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  'bun.lockb': 'bun',
};

// 하위 탐색 시 들어가지 않을 디렉토리 (의존성 / 빌드 산출물 / 캐시).
// 이 안의 언어 마커는 프로젝트 본체의 것이 아니므로 무시한다.
const EXCLUDED_DIRS = new Set([
  'node_modules', 'vendor', 'dist', 'build', 'out', 'target',
  'coverage', 'venv', '.venv', '__pycache__', 'tmp',
]);

// 하위 탐색 최대 깊이 (root 의 직계 자식이 depth 1).
const SUBTREE_MAX_DEPTH = 4;

/**
 * Detect what verifications make sense for `root`.
 *
 * @param {string} root  project root directory
 * @returns {{
 *   root: string,
 *   projectType: 'node' | 'rust' | 'python' | 'go' | 'java' | 'ruby' | 'php' | 'unknown',
 *   languages: string[],
 *   packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | null,
 *   hasGit: boolean,
 *   hasTests: boolean,
 *   hasLint: boolean,
 *   hasTypecheck: boolean,
 *   hasBuild: boolean,
 *   hasAudit: boolean,
 *   hasCi: boolean,
 *   ciFiles: string[],
 *   securityFiles: string[],
 *   commands: { test: string | null, lint: string | null, typecheck: string | null, build: string | null, audit: string | null },
 *   baselineAt: string
 * }}
 */
export function detectProject(root = process.cwd()) {
  const out = {
    root,
    projectType: 'unknown',
    languages: [],
    packageManager: null,
    hasGit: exists(path.join(root, '.git')),
    hasTests: false,
    hasLint: false,
    hasTypecheck: false,
    hasBuild: false,
    hasAudit: false,
    hasCi: false,
    ciFiles: [],
    securityFiles: [],
    commands: { test: null, lint: null, typecheck: null, build: null, audit: null },
    baselineAt: new Date().toISOString(),
  };

  // 언어 마커는 root 를 우선 검사한다. root 에서 아무 언어도 못 찾았을 때만
  // (모노레포 / backend 서브디렉토리 등) 제한된 깊이로 하위를 탐색한다.
  // root 에 마커가 있으면 하위는 보지 않으므로 기존 동작이 그대로 보존된다.
  const langDirs = new Map(); // type -> 마커가 발견된 디렉토리
  for (const marker of LANGUAGE_MARKERS) {
    if (exists(path.join(root, marker.file)) && !langDirs.has(marker.type)) {
      langDirs.set(marker.type, root);
    }
  }
  if (langDirs.size === 0) {
    for (const { type, dir } of findLanguageMarkersInSubtree(root)) {
      if (!langDirs.has(type)) langDirs.set(type, dir);
    }
  }
  out.languages = [...langDirs.keys()];
  out.projectType = pickPrimaryLanguage(out.languages);

  if (langDirs.has('node')) {
    Object.assign(out, detectNode(langDirs.get('node')));
  }
  if (langDirs.has('rust')) {
    mergeCommands(out, detectRust(langDirs.get('rust')));
  }
  if (langDirs.has('python')) {
    mergeCommands(out, detectPython(langDirs.get('python')));
  }
  if (langDirs.has('go')) {
    mergeCommands(out, detectGo(langDirs.get('go')));
  }

  for (const file of CI_FILES) {
    const p = path.join(root, file);
    if (exists(p)) {
      out.hasCi = true;
      out.ciFiles.push(file);
    }
  }

  for (const file of SECURITY_FILE_HINTS) {
    const p = path.join(root, file);
    if (exists(p)) out.securityFiles.push(file);
  }

  return out;
}

function pickPrimaryLanguage(languages) {
  if (!languages.length) return 'unknown';
  const priority = ['node', 'rust', 'python', 'go', 'java', 'ruby', 'php'];
  for (const lang of priority) if (languages.includes(lang)) return lang;
  return languages[0];
}

// root 에서 언어 마커를 못 찾았을 때, 제한된 깊이로 하위 디렉토리를 탐색한다.
// node_modules / vendor / 빌드 산출물 / 숨김(.) 디렉토리는 건너뛴다.
// 같은 언어가 여러 곳이면 가장 먼저 만난 디렉토리를 쓴다.
function findLanguageMarkersInSubtree(root, maxDepth = SUBTREE_MAX_DEPTH) {
  const found = [];
  const markerByFile = new Map(LANGUAGE_MARKERS.map(m => [m.file, m.type]));

  const skipDir = (name) => name.startsWith('.') || EXCLUDED_DIRS.has(name);

  const walk = (dir, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isFile() && markerByFile.has(entry.name)) {
        found.push({ type: markerByFile.get(entry.name), dir });
      }
    }
    if (depth >= maxDepth) return;
    for (const entry of entries) {
      if (entry.isDirectory() && !skipDir(entry.name)) {
        walk(path.join(dir, entry.name), depth + 1);
      }
    }
  };

  let rootEntries;
  try {
    rootEntries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of rootEntries) {
    if (entry.isDirectory() && !skipDir(entry.name)) {
      walk(path.join(root, entry.name), 1);
    }
  }
  return found;
}

function detectNode(root) {
  const pkgPath = path.join(root, 'package.json');
  const out = {
    packageManager: detectPackageManager(root),
    hasTests: false,
    hasLint: false,
    hasTypecheck: false,
    hasBuild: false,
    hasAudit: false,
    commands: { test: null, lint: null, typecheck: null, build: null, audit: null },
  };
  let pkg;
  try {
    // Strip a UTF-8 BOM before parsing: Windows PowerShell 5.1's default
    // `-Encoding utf8` writes one, and npm itself accepts a BOM'd package.json
    // — so `npm test` runs fine while a bare JSON.parse throws here, silently
    // flipping hasTests to false (and a source change to INSUFFICIENT_EVIDENCE
    // with a misleading "no test command" reason).
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return out;
  }
  const scripts = pkg.scripts || {};
  const pm = out.packageManager || 'npm';
  if (scripts.test) {
    out.hasTests = true;
    out.commands.test = `${pm} test`;
  }
  if (scripts.lint) {
    out.hasLint = true;
    out.commands.lint = `${pm} run lint`;
  }
  if (scripts.typecheck) {
    out.hasTypecheck = true;
    out.commands.typecheck = `${pm} run typecheck`;
  } else if (exists(path.join(root, 'tsconfig.json'))) {
    out.hasTypecheck = true;
    out.commands.typecheck = 'npx tsc --noEmit';
  }
  if (scripts.build) {
    out.hasBuild = true;
    out.commands.build = `${pm} run build`;
  }
  if (pm === 'npm' || pm === 'yarn' || pm === 'pnpm') {
    out.hasAudit = true;
    out.commands.audit = `${pm} audit --audit-level=moderate`;
  }
  return out;
}

function detectRust(root) {
  return {
    hasTests: true,
    hasLint: true,
    hasBuild: true,
    commands: {
      test: 'cargo test',
      lint: 'cargo clippy --all-targets -- -D warnings',
      build: 'cargo build --release',
    },
  };
}

function detectPython(root) {
  const out = { hasTests: false, hasLint: false, hasTypecheck: false, commands: {} };
  if (exists(path.join(root, 'pytest.ini')) || exists(path.join(root, 'tox.ini')) || existsAny(root, ['tests', 'test'])) {
    out.hasTests = true;
    out.commands.test = 'pytest';
  }
  if (exists(path.join(root, '.ruff.toml')) || exists(path.join(root, 'ruff.toml'))) {
    out.hasLint = true;
    out.commands.lint = 'ruff check .';
  }
  if (exists(path.join(root, 'mypy.ini')) || exists(path.join(root, '.mypy.ini'))) {
    out.hasTypecheck = true;
    out.commands.typecheck = 'mypy .';
  }
  return out;
}

function detectGo(_root) {
  return {
    hasTests: true,
    hasLint: false,
    hasBuild: true,
    commands: {
      test: 'go test ./...',
      build: 'go build ./...',
    },
  };
}

function detectPackageManager(root) {
  for (const [lockfile, pm] of Object.entries(LOCKFILE_TO_PM)) {
    if (exists(path.join(root, lockfile))) return pm;
  }
  return null;
}

function mergeCommands(target, partial) {
  if (!partial) return;
  for (const key of ['hasTests', 'hasLint', 'hasTypecheck', 'hasBuild', 'hasAudit']) {
    if (partial[key]) target[key] = true;
  }
  for (const key of Object.keys(partial.commands || {})) {
    if (!target.commands[key] && partial.commands[key]) {
      target.commands[key] = partial.commands[key];
    }
  }
}

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function existsAny(root, names) {
  return names.some(n => exists(path.join(root, n)));
}
