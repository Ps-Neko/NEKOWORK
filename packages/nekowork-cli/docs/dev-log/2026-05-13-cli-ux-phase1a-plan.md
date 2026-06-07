# NEKOWORK CLI UX — Phase 1a 구현 계획

> **Archived 2026-05-15**: 본 계획은 PR #54로 머지 완료. 본 문서는 dev-log 보존용이며 실행 가이드로는 사용하지 않는다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/CLI-UX-REDESIGN.md`의 Phase 1 중 첫 번째 슬라이스 — 공용 출력 인프라를 도입하고 `nekowork` 단독 출력 + `work`/`verify` 두 동사에만 새 UX(사람 친화 세션 ID, Next 블록, 3단 에러, 색상 5톤, 플래그 alias)를 적용한다. 나머지 동사(ship/apply/gate/run/build/auto/review)는 Phase 1b로 분리.

**Architecture:** 신규 lib 4개(`ui-format`, `session-id`, `flag-normalize`, `ui-errors`)를 `scripts/lib/`에 추가하고 기존 `session-resolver.js`에 prefix 매칭만 보강한다. 동사별 출력 변경은 cli.js의 두 분기(work, verify)와 orchestrators 두 파일(work.js, review.js)에만 한정. 기존 형식(`work-1778631431662`)은 양립 가능하도록 resolver가 두 패턴 모두 인식.

**Tech Stack:** Node 22+ (ESM), `node --test` 기본 테스트 러너, 기존 `scripts/lib/` 모듈 패턴 따름. 외부 의존성 추가 없음.

**Scope (Phase 1a 한정):**
- C1 `nekowork` 단독 + `help all` / `help <verb>`
- C2 work/verify의 새 ID 형식 + Next 블록 + prefix 매칭
- C3 플래그 alias 인프라 (work/verify에만 적용)
- C4 work/verify의 task-required 에러 3단 구조
- 공용 색상/포맷 5톤 인프라 (모든 후속 동사가 재사용)

**Out of Scope:** wizard, ship/apply/gate/run/build/auto/review 동사, 구 플래그 제거.

---

## 파일 구조

| 경로 | 변경 | 책임 |
|---|---|---|
| `scripts/lib/ui-format.js` | 신규 | 색상 5톤, NO_COLOR/비-TTY, `nextBlock`, `kvBlock` 헬퍼 |
| `scripts/lib/session-id.js` | 신규 | `generateSessionId(verb)` → `<verb>-YYYY-MM-DD-XXXX` |
| `scripts/lib/flag-normalize.js` | 신규 | alias 매핑 + deprecate 경고 stderr |
| `scripts/lib/ui-errors.js` | 신규 | `printError`, `printBlocked` 3단 헬퍼 |
| `scripts/lib/session-resolver.js` | 수정 | prefix 매칭 추가 (기존 함수 시그니처 유지) |
| `scripts/orchestrators/work.js` | 수정 | `generateSessionId('work')` 사용 |
| `scripts/orchestrators/review.js` | 수정 | `generateSessionId('review')` 사용 |
| `scripts/cli.js` | 수정 | 단독 입력 분기, `help all`/`help <verb>`, work/verify 출력 포맷 |
| `tests/unit/ui-format.test.js` | 신규 | 색상/NO_COLOR/블록 헬퍼 단위 테스트 |
| `tests/unit/session-id.test.js` | 신규 | ID 생성 형식 단위 테스트 |
| `tests/unit/session-resolver.test.js` | 신규 | prefix 매칭 단위 테스트 |
| `tests/unit/flag-normalize.test.js` | 신규 | alias/경고 단위 테스트 |
| `tests/unit/ui-errors.test.js` | 신규 | 에러 헬퍼 단위 테스트 |
| `tests/integration/cli-output.test.js` | 신규 | nekowork/work/verify e2e 스냅샷 |

---

## Task 1: 색상·포맷 헬퍼 (`ui-format.js`)

**Files:**
- Create: `scripts/lib/ui-format.js`
- Test: `tests/unit/ui-format.test.js`

- [ ] **Step 1: 실패 테스트 작성**

```javascript
// tests/unit/ui-format.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paint, nextBlock, isColorEnabled } from '../../scripts/lib/ui-format.js';

test('paint wraps text with ANSI when color enabled', () => {
  const out = paint('ok', 'OK', { force: true });
  assert.match(out, /\[/);
  assert.ok(out.includes('OK'));
});

test('paint returns plain text when NO_COLOR set', () => {
  const out = paint('ok', 'OK', { noColor: true });
  assert.equal(out, 'OK');
});

test('isColorEnabled respects NO_COLOR env', () => {
  assert.equal(isColorEnabled({ env: { NO_COLOR: '1' }, isTTY: true }), false);
  assert.equal(isColorEnabled({ env: {}, isTTY: false }), false);
  assert.equal(isColorEnabled({ env: {}, isTTY: true }), true);
});

test('nextBlock renders Next arrow with items', () => {
  const out = nextBlock([
    { cmd: 'nekowork verify --session a3f7', note: 'Codex 검증' },
    { cmd: 'nekowork report --session a3f7', note: 'evidence 미리 보기' },
  ], { force: false, noColor: true });
  assert.match(out, /Next/);
  assert.match(out, /nekowork verify/);
  assert.match(out, /Codex 검증/);
});
```

- [ ] **Step 2: 테스트 실행, 실패 확인**

```bash
node --test tests/unit/ui-format.test.js
```

기대: `Cannot find module .../ui-format.js`

- [ ] **Step 3: 최소 구현**

```javascript
// scripts/lib/ui-format.js
const TONES = {
  ok:   '[32m',
  warn: '[33m',
  err:  '[31m',
  hint: '[36m',
  dim:  '[90m',
  reset: '[0m',
};

export function isColorEnabled({ env = process.env, isTTY = process.stdout.isTTY } = {}) {
  if (env.NO_COLOR) return false;
  if (!isTTY) return false;
  return true;
}

export function paint(tone, text, { force, noColor } = {}) {
  const enabled = noColor === true ? false : (force === true ? true : isColorEnabled());
  if (!enabled) return text;
  const code = TONES[tone] || '';
  return `${code}${text}${TONES.reset}`;
}

export function nextBlock(items, opts = {}) {
  const lines = [paint('hint', 'Next →', opts)];
  for (const { cmd, note } of items) {
    const left = paint('hint', `  ${cmd}`, opts);
    const right = note ? '  ' + paint('dim', note, opts) : '';
    lines.push(left + right);
  }
  return lines.join('\n');
}

export function kvBlock(rows, opts = {}) {
  const width = Math.max(...rows.map(([k]) => k.length));
  return rows.map(([k, v]) => {
    const key = paint('dim', k.padEnd(width), opts);
    return `  ${key}  ${v}`;
  }).join('\n');
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test tests/unit/ui-format.test.js
```

기대: 4 pass

- [ ] **Step 5: 커밋**

```bash
git add scripts/lib/ui-format.js tests/unit/ui-format.test.js
git commit -m "feat(cli): add ui-format lib for color tones and Next block helpers"
```

---

## Task 2: 사람 친화 세션 ID 생성 (`session-id.js`)

**Files:**
- Create: `scripts/lib/session-id.js`
- Test: `tests/unit/session-id.test.js`

- [ ] **Step 1: 실패 테스트 작성**

```javascript
// tests/unit/session-id.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSessionId, isLegacyId, isNewId } from '../../scripts/lib/session-id.js';

test('generateSessionId follows <verb>-YYYY-MM-DD-XXXX pattern', () => {
  const id = generateSessionId('work', new Date('2026-05-13T09:00:00Z'));
  assert.match(id, /^work-2026-05-13-[0-9a-f]{4}$/);
});

test('generateSessionId honors verb prefix', () => {
  const id = generateSessionId('review', new Date('2026-05-13T09:00:00Z'));
  assert.ok(id.startsWith('review-2026-05-13-'));
});

test('isNewId detects new pattern', () => {
  assert.equal(isNewId('work-2026-05-13-a3f7'), true);
  assert.equal(isNewId('work-1778631431662'), false);
});

test('isLegacyId detects timestamp pattern', () => {
  assert.equal(isLegacyId('work-1778631431662'), true);
  assert.equal(isLegacyId('work-2026-05-13-a3f7'), false);
});

test('generateSessionId produces distinct ids on rapid calls', () => {
  const a = generateSessionId('work');
  const b = generateSessionId('work');
  assert.notEqual(a, b);
});
```

- [ ] **Step 2: 실행, 실패 확인**

```bash
node --test tests/unit/session-id.test.js
```

기대: 모듈 미존재

- [ ] **Step 3: 구현**

```javascript
// scripts/lib/session-id.js
import { randomBytes } from 'node:crypto';

const NEW_RE    = /^[a-z]+-\d{4}-\d{2}-\d{2}-[0-9a-f]{4}$/;
const LEGACY_RE = /^[a-z]+-\d{10,}$/;

function isoDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function generateSessionId(verb, when = new Date()) {
  if (!verb || !/^[a-z][a-z-]*$/.test(verb)) {
    throw new Error(`generateSessionId: invalid verb '${verb}'`);
  }
  const hex = randomBytes(2).toString('hex');
  return `${verb}-${isoDate(when)}-${hex}`;
}

export function isNewId(id) {
  return NEW_RE.test(String(id || ''));
}

export function isLegacyId(id) {
  return LEGACY_RE.test(String(id || ''));
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test tests/unit/session-id.test.js
```

기대: 5 pass

- [ ] **Step 5: 커밋**

```bash
git add scripts/lib/session-id.js tests/unit/session-id.test.js
git commit -m "feat(cli): add session-id lib for human-friendly session identifiers"
```

---

## Task 3: prefix 매칭을 session-resolver에 추가

**Files:**
- Modify: `scripts/lib/session-resolver.js`
- Test: `tests/unit/session-resolver.test.js`

기존 `resolveSessionId`는 `'latest'` 해석만 함. `--session a3f7`처럼 prefix만 와도 매칭하도록 확장. 중복(2개 이상 일치)이면 에러 throw, 0개면 입력 그대로 반환(기존 호환).

- [ ] **Step 1: 실패 테스트 작성**

```javascript
// tests/unit/session-resolver.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveSessionId } from '../../scripts/lib/session-resolver.js';

function tmpProject(sessions) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-sess-'));
  const dir = path.join(root, '.harness', 'state', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  for (const s of sessions) fs.mkdirSync(path.join(dir, s));
  return root;
}

test('resolveSessionId returns exact id when full match exists', () => {
  const root = tmpProject(['work-2026-05-13-a3f7']);
  assert.equal(resolveSessionId(root, 'work-2026-05-13-a3f7'), 'work-2026-05-13-a3f7');
});

test('resolveSessionId resolves unique prefix to full id', () => {
  const root = tmpProject(['work-2026-05-13-a3f7', 'work-2026-05-12-bbbb']);
  assert.equal(resolveSessionId(root, 'a3f7'), 'work-2026-05-13-a3f7');
});

test('resolveSessionId throws on ambiguous prefix', () => {
  const root = tmpProject(['work-2026-05-13-a3f7', 'work-2026-05-12-a3f8']);
  assert.throws(() => resolveSessionId(root, 'a3f'), /ambiguous/i);
});

test('resolveSessionId falls back to input when no match (legacy callers)', () => {
  const root = tmpProject(['work-2026-05-13-a3f7']);
  assert.equal(resolveSessionId(root, 'zzzz'), 'zzzz');
});

test('resolveSessionId latest still picks newest mtime', () => {
  const root = tmpProject([]);
  const dir = path.join(root, '.harness', 'state', 'sessions');
  fs.mkdirSync(path.join(dir, 'older'));
  fs.mkdirSync(path.join(dir, 'newer'));
  const newer = path.join(dir, 'newer');
  fs.utimesSync(newer, Date.now()/1000 + 100, Date.now()/1000 + 100);
  assert.equal(resolveSessionId(root, 'latest'), 'newer');
});
```

- [ ] **Step 2: 실행, 실패 확인**

```bash
node --test tests/unit/session-resolver.test.js
```

기대: prefix/ambiguous 케이스 FAIL

- [ ] **Step 3: 구현**

`scripts/lib/session-resolver.js` 전체를 다음으로 교체:

```javascript
import fs from 'node:fs';
import path from 'node:path';

function listSessions(projectRoot) {
  const sessionsRoot = path.join(projectRoot || process.cwd(), '.harness', 'state', 'sessions');
  if (!fs.existsSync(sessionsRoot)) return [];
  return fs.readdirSync(sessionsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      name: entry.name,
      mtimeMs: fs.statSync(path.join(sessionsRoot, entry.name)).mtimeMs,
    }));
}

export function resolveSessionId(projectRoot, sessionId) {
  const value = String(sessionId || '').trim();
  if (!value) return value;

  const sessions = listSessions(projectRoot);

  if (value === 'latest') {
    const sorted = [...sessions].sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));
    return sorted[0]?.name || value;
  }

  const exact = sessions.find(s => s.name === value);
  if (exact) return exact.name;

  const matches = sessions.filter(s => s.name.includes(value));
  if (matches.length === 1) return matches[0].name;
  if (matches.length > 1) {
    const list = matches.map(m => m.name).sort().join(', ');
    throw new Error(`session prefix '${value}' is ambiguous: ${list}`);
  }

  return value;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test tests/unit/session-resolver.test.js
```

기대: 5 pass

- [ ] **Step 5: 커밋**

```bash
git add scripts/lib/session-resolver.js tests/unit/session-resolver.test.js
git commit -m "feat(cli): resolve session ids by prefix substring, error on ambiguity"
```

---

## Task 4: 플래그 정규화 lib (`flag-normalize.js`)

**Files:**
- Create: `scripts/lib/flag-normalize.js`
- Test: `tests/unit/flag-normalize.test.js`

Phase 1a 범위: alias 인식 + stderr 경고만. 정확한 값 매핑(Q8)은 구현 시점에서 명시:
- `--pack <v>` → `--profile <v>`
- `--secure` → `--profile security` (단, `--profile` 명시되어 있으면 무시)
- `--strict-quality` → `--strict`
- `--fast` → `--strict=false` 동등 (단, 기본이 비-strict라 사실상 no-op이며 경고만)

- [ ] **Step 1: 실패 테스트 작성**

```javascript
// tests/unit/flag-normalize.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFlags } from '../../scripts/lib/flag-normalize.js';

test('--pack alias rewrites to --profile and warns', () => {
  const warns = [];
  const out = normalizeFlags(['--pack', 'quality'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--profile', 'quality']);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /--pack.*deprecated.*--profile/);
});

test('--secure alias adds --profile security when none set', () => {
  const warns = [];
  const out = normalizeFlags(['--secure'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--profile', 'security']);
  assert.equal(warns.length, 1);
});

test('--secure is ignored (warn-only) when --profile already set', () => {
  const warns = [];
  const out = normalizeFlags(['--profile', 'quality', '--secure'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--profile', 'quality']);
  assert.match(warns[0], /--secure.*ignored.*--profile.*present/);
});

test('--strict-quality rewrites to --strict', () => {
  const warns = [];
  const out = normalizeFlags(['--strict-quality'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--strict']);
});

test('unknown flags pass through unchanged', () => {
  const warns = [];
  const out = normalizeFlags(['--session', 'a3f7', '--json'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--session', 'a3f7', '--json']);
  assert.equal(warns.length, 0);
});
```

- [ ] **Step 2: 실행, 실패 확인**

```bash
node --test tests/unit/flag-normalize.test.js
```

- [ ] **Step 3: 구현**

```javascript
// scripts/lib/flag-normalize.js
export function normalizeFlags(argv, { warn = (m) => console.warn(m) } = {}) {
  const out = [];
  const hasProfileAlready = argv.includes('--profile');
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === '--pack') {
      const value = argv[i + 1];
      warn(`[deprecated] --pack is deprecated; use --profile (will be removed in 0.2.0)`);
      out.push('--profile', value);
      i++;
      continue;
    }

    if (token === '--secure') {
      if (hasProfileAlready) {
        warn(`[deprecated] --secure ignored because --profile is present (will be removed in 0.2.0)`);
        continue;
      }
      warn(`[deprecated] --secure is deprecated; use --profile security (will be removed in 0.2.0)`);
      out.push('--profile', 'security');
      continue;
    }

    if (token === '--strict-quality') {
      warn(`[deprecated] --strict-quality is deprecated; use --strict (will be removed in 0.2.0)`);
      out.push('--strict');
      continue;
    }

    if (token === '--fast') {
      warn(`[deprecated] --fast is a no-op; non-strict is default (will be removed in 0.2.0)`);
      continue;
    }

    out.push(token);
  }
  return out;
}
```

- [ ] **Step 4: 통과 확인**

```bash
node --test tests/unit/flag-normalize.test.js
```

기대: 5 pass

- [ ] **Step 5: 커밋**

```bash
git add scripts/lib/flag-normalize.js tests/unit/flag-normalize.test.js
git commit -m "feat(cli): add flag-normalize for --pack/--secure/--strict-quality aliases"
```

---

## Task 5: 에러 출력 헬퍼 (`ui-errors.js`)

**Files:**
- Create: `scripts/lib/ui-errors.js`
- Test: `tests/unit/ui-errors.test.js`

- [ ] **Step 1: 실패 테스트 작성**

```javascript
// tests/unit/ui-errors.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderError, renderBlocked } from '../../scripts/lib/ui-errors.js';

test('renderError emits symbol + message + examples + helpRef', () => {
  const out = renderError({
    message: 'task 인수가 필요합니다.',
    examples: ['nekowork work "BOM 단가 추가"'],
    helpRef: 'nekowork help work',
  }, { noColor: true });
  assert.match(out, /✗.*task 인수/);
  assert.match(out, /예시:/);
  assert.match(out, /nekowork work "BOM 단가 추가"/);
  assert.match(out, /도움말: nekowork help work/);
});

test('renderBlocked emits 3-section block', () => {
  const out = renderBlocked({
    message: 'HUMAN_GATE 가 열려 있어 ship 이 막힘.',
    fields: [['세션', 'p2c-b2-fullcycle'], ['사유', 'codex flagged edge case']],
    nextSteps: [
      { cmd: 'nekowork gate status --session p2c-b2', note: '상세 컨텍스트' },
      { cmd: 'nekowork gate approve --session p2c-b2 --reason "..."' },
    ],
  }, { noColor: true });
  assert.match(out, /⚠.*HUMAN_GATE/);
  assert.match(out, /세션.*p2c-b2-fullcycle/);
  assert.match(out, /사유.*codex flagged/);
  assert.match(out, /해결 방법 →/);
  assert.match(out, /gate approve/);
});
```

- [ ] **Step 2: 실행, 실패 확인**

```bash
node --test tests/unit/ui-errors.test.js
```

- [ ] **Step 3: 구현**

```javascript
// scripts/lib/ui-errors.js
import { paint, kvBlock } from './ui-format.js';

export function renderError({ message, examples = [], helpRef }, opts = {}) {
  const lines = [`${paint('err', '✗', opts)} ${message}`, ''];
  if (examples.length) {
    lines.push('  예시:');
    for (const ex of examples) lines.push(`    ${paint('hint', ex, opts)}`);
    lines.push('');
  }
  if (helpRef) lines.push(`  ${paint('dim', '도움말: ' + helpRef, opts)}`);
  return lines.join('\n');
}

export function renderBlocked({ message, fields = [], nextSteps = [] }, opts = {}) {
  const lines = [`${paint('warn', '⚠', opts)} ${message}`, ''];
  if (fields.length) {
    lines.push(kvBlock(fields, opts));
    lines.push('');
  }
  if (nextSteps.length) {
    lines.push(paint('hint', '해결 방법 →', opts));
    for (const { cmd, note } of nextSteps) {
      const left = paint('hint', `  ${cmd}`, opts);
      const right = note ? '  ' + paint('dim', note, opts) : '';
      lines.push(left + right);
    }
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: 통과 확인**

```bash
node --test tests/unit/ui-errors.test.js
```

기대: 2 pass

- [ ] **Step 5: 커밋**

```bash
git add scripts/lib/ui-errors.js tests/unit/ui-errors.test.js
git commit -m "feat(cli): add ui-errors lib for 3-section error/blocked rendering"
```

---

## Task 6: orchestrator가 새 ID를 발급하도록 변경

**Files:**
- Modify: `scripts/orchestrators/work.js:13`
- Modify: `scripts/orchestrators/review.js:44`

기존 호출자(`sessionId`를 외부에서 전달하는 cli `--session a3f7`)는 영향 없음. `opts.sessionId`가 없을 때만 새 ID 생성.

- [ ] **Step 1: work.js 수정**

`scripts/orchestrators/work.js` 13행 부근:

변경 전:
```javascript
const sessionId = opts.sessionId || `work-${Date.now()}`;
```

변경 후:
```javascript
import { generateSessionId } from '../lib/session-id.js';
// ...
const sessionId = opts.sessionId || generateSessionId('work');
```

(파일 상단 import 블록에 한 줄 추가)

- [ ] **Step 2: review.js 동일 패턴 수정**

`scripts/orchestrators/review.js` 44행 부근:

변경 전:
```javascript
const sessionId = opts.sessionId || `review-${Date.now()}`;
```

변경 후:
```javascript
import { generateSessionId } from '../lib/session-id.js';
// ...
const sessionId = opts.sessionId || generateSessionId('review');
```

- [ ] **Step 3: 통합 테스트(work 더미 호출)로 새 ID 형식 확인**

`tests/integration/cli-output.test.js`는 Task 9에서 만든다. 여기서는 수동 한 줄로 확인:

```bash
node packages/nekowork-cli/scripts/cli.js work "phase1a smoke" 2>&1 | head -5
```

기대 출력 안에 `work-YYYY-MM-DD-xxxx` 형태의 session 라인이 포함되어야 함. (출력 포맷 변경은 Task 9 — 여기서는 기존 `=== work ===` 블록 그대로지만 ID 형식만 바뀐다.)

- [ ] **Step 4: 기존 회귀 테스트 실행**

```bash
node --test tests/unit/*.test.js tests/integration/*.test.js
```

기대: 기존 73개 + 새로 추가된 단위 테스트 PASS. legacy ID(`work-1778631431662`) 사용 테스트가 있으면 그대로 통과 (resolver는 양립).

- [ ] **Step 5: 커밋**

```bash
git add scripts/orchestrators/work.js scripts/orchestrators/review.js
git commit -m "feat(cli): emit human-friendly session ids from work/review orchestrators"
```

---

## Task 7: `nekowork` 단독 입력 — 상태 + 추천 3개

**Files:**
- Modify: `scripts/cli.js:28-134` (기존 `help()` 함수 영역)

기존 `help()`는 모든 도움말을 출력. 새 동작:
- 인수 없음 또는 `nekowork --help` → 단축 출력(상태 + 추천 + 자주 쓰는 흐름)
- `nekowork help all` → 기존 전체 도움말 출력 (현재 `help()` 본문)
- `nekowork help <verb>` → Task 8에서

- [ ] **Step 1: 통합 테스트 작성**

```javascript
// tests/integration/cli-output.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const CLI = path.resolve('scripts/cli.js');
function runCli(args, env = {}) {
  return spawnSync('node', [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', ...env },
  });
}

test('nekowork (no args) shows short status + 3 recommendations', () => {
  const r = runCli([]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /NEKOWORK \d+\.\d+\.\d+/);
  assert.match(r.stdout, /처음이라면/);
  assert.match(r.stdout, /nekowork check/);
  assert.match(r.stdout, /nekowork init/);
  assert.match(r.stdout, /nekowork run/);
  assert.match(r.stdout, /자주 쓰는 흐름/);
  assert.match(r.stdout, /work.*verify.*ship.*apply/);
});

test('nekowork help all shows full legacy help', () => {
  const r = runCli(['help', 'all']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Install \/ verify/);
  assert.match(r.stdout, /Review loop/);
  assert.match(r.stdout, /Sessions \/ cost \/ learning/);
});
```

- [ ] **Step 2: 실행, 실패 확인**

```bash
node --test tests/integration/cli-output.test.js
```

기대: 단축 출력 형식 미일치로 FAIL

- [ ] **Step 3: cli.js의 `help()` 분리 및 단축 출력 도입**

`scripts/cli.js`에서 기존 `function help() { console.log(`...`); }` 함수를 다음 구조로 교체:

```javascript
import { paint, kvBlock } from './lib/ui-format.js';
import fs from 'node:fs';
import pathMod from 'node:path';

function readVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(pathMod.resolve('package.json'), 'utf8'));
    return pkg.version;
  } catch { return 'unknown'; }
}

function countSessions(projectRoot) {
  try {
    const dir = pathMod.join(projectRoot || process.cwd(), '.harness', 'state', 'sessions');
    return fs.readdirSync(dir).length;
  } catch { return 0; }
}

function shortHelp() {
  const version = readVersion();
  const root = process.cwd();
  const installed = fs.existsSync(pathMod.join(root, '.harness')) ? 'yes' : 'no';
  const sessions = countSessions(root);
  const opts = {};

  console.log('');
  console.log(`  ${paint('ok', '●', opts)} NEKOWORK ${version}`);
  console.log('  ' + paint('dim', `project: ${root}  ·  installed: ${installed}  ·  sessions: ${sessions}`, opts));
  console.log('');
  console.log(paint('hint', '처음이라면 →', opts));
  console.log(`  1.  ${paint('hint', 'nekowork check', opts)}          환경 진단 (30초)`);
  console.log(`  2.  ${paint('hint', 'nekowork init', opts)}           프로필 설치 (1분)`);
  console.log(`  3.  ${paint('hint', 'nekowork run "<task>"', opts)}    첫 풀 사이클 실행`);
  console.log('');
  console.log(paint('hint', '자주 쓰는 흐름 →', opts));
  console.log(`  ${paint('hint', 'work', opts)} → ${paint('hint', 'verify', opts)} → ${paint('hint', 'ship', opts)} → ${paint('hint', 'apply', opts)}     사람·게이트 통과 풀 사이클`);
  console.log(`  ${paint('hint', 'run', opts)}                              위 4단계 자동 래퍼`);
  console.log(`  ${paint('hint', 'sessions', opts)}                         진행 중 / 완료 세션 목록`);
  console.log('');
  console.log('  ' + paint('dim', "전체 명령은  'nekowork help all'", opts));
  console.log('  ' + paint('dim', "항목별은    'nekowork help <verb>'", opts));
  console.log('');
}

function fullHelp() {
  console.log(`<여기 기존 help() 본문(L29-L133)을 그대로 옮겨 붙임>`);
}

function help() {
  // legacy entry point; kept for backwards compatibility
  fullHelp();
}
```

**주의:** 기존 `help()` 본문(`scripts/cli.js` 29~133행의 `console.log` 큰 문자열)을 `fullHelp()`로 그대로 이동. 본문 한 글자도 수정하지 않는다.

- [ ] **Step 4: cli.js 디스패치 분기 수정**

기존 `checkArgs(argv)` 또는 메인 entry에서 `help()` 호출하는 부분을 다음 패턴으로:

```javascript
// 메인 디스패치 영역에서:
const verb = process.argv[2];
if (!verb || verb === '--help' || verb === '-h') {
  shortHelp();
  process.exit(0);
}
if (verb === 'help') {
  const sub = process.argv[3];
  if (!sub || sub === 'all') { fullHelp(); process.exit(0); }
  // sub === '<verb>' 는 Task 8에서
}
```

(정확한 분기 위치는 cli.js의 기존 switch/if 체인을 따라 자연스럽게 통합)

- [ ] **Step 5: 통합 테스트 통과 확인**

```bash
node --test tests/integration/cli-output.test.js
```

기대: 2 pass

- [ ] **Step 6: 회귀 — 기존 도움말 호출자 영향 없는지 확인**

```bash
node packages/nekowork-cli/scripts/cli.js help all 2>&1 | head -5
node packages/nekowork-cli/scripts/cli.js --help 2>&1 | head -5
```

기대: 전자는 기존 전체 도움말, 후자는 새 단축 출력.

- [ ] **Step 7: 커밋**

```bash
git add scripts/cli.js tests/integration/cli-output.test.js
git commit -m "feat(cli): short status help on bare invocation; full help moves to 'help all'"
```

---

## Task 8: `nekowork help <verb>` 동사별 도움말

**Files:**
- Modify: `scripts/cli.js` (Task 7 분기 확장)

각 동사 1줄 시그니처 + 짧은 설명 + 예시 1개. Phase 1a에서는 `work`, `verify` 두 동사만 풍부 출력하고 나머지는 fullHelp의 해당 섹션을 grep해서 보여주는 폴백 OK.

- [ ] **Step 1: 통합 테스트 작성 (cli-output.test.js에 추가)**

```javascript
test('nekowork help work shows verb-specific help', () => {
  const r = runCli(['help', 'work']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /nekowork work/);
  assert.match(r.stdout, /--profile/);
  assert.match(r.stdout, /예시:/);
});

test('nekowork help unknown-verb prints fallback notice', () => {
  const r = runCli(['help', 'nope']);
  assert.match(r.stdout + r.stderr, /알 수 없는 동사|unknown verb/);
});
```

- [ ] **Step 2: 실행, 실패 확인**

- [ ] **Step 3: 구현 — cli.js에 `verbHelp()` 추가**

```javascript
const VERB_HELP = {
  work: () => {
    console.log('');
    console.log('nekowork work "<task>" [options]');
    console.log('');
    console.log('  단일 executor 구현 핸드오프. 코드 변경을 생성한 뒤 verify로 넘긴다.');
    console.log('');
    console.log('Options:');
    console.log('  --profile quality|security|product   강조점 (기본: quality)');
    console.log('  --strict                              TDD/품질 강화');
    console.log('  --live                                실 제공자 사용 (없으면 mock)');
    console.log('  --session <id>                        기존 세션에 이어붙임 (prefix 가능)');
    console.log('  --project-root <dir>                  대상 프로젝트 루트');
    console.log('  --json                                머신 파싱용 출력');
    console.log('');
    console.log('예시:');
    console.log('  nekowork work "BOM 출력 컬럼에 단가 추가"');
    console.log('  nekowork work "타이틀바 다크모드" --profile quality --strict');
    console.log('');
  },
  verify: () => {
    console.log('');
    console.log('nekowork verify "<task>" --session <id> [options]');
    console.log('');
    console.log('  앞선 work 핸드오프를 Codex로만 검증한다.');
    console.log('');
    console.log('Options:');
    console.log('  --session <id>                        대상 세션 (prefix 가능)');
    console.log('  --profile quality|security|product   강조점');
    console.log('  --strict                              TDD/품질 강화');
    console.log('  --live                                실 제공자 사용');
    console.log('  --json                                머신 파싱용 출력');
    console.log('');
    console.log('예시:');
    console.log('  nekowork verify "BOM 단가 추가" --session a3f7');
    console.log('  nekowork verify --session a3f7   # task 생략 (세션이 보유)');
    console.log('');
  },
};

function verbHelp(verb) {
  const renderer = VERB_HELP[verb];
  if (renderer) { renderer(); return; }
  console.error(`알 수 없는 동사: ${verb}`);
  console.error(`전체 명령은: nekowork help all`);
  process.exit(2);
}
```

그리고 Task 7의 분기에 추가:

```javascript
if (verb === 'help') {
  const sub = process.argv[3];
  if (!sub || sub === 'all') { fullHelp(); process.exit(0); }
  verbHelp(sub);
  process.exit(0);
}
```

- [ ] **Step 4: 통과 확인**

```bash
node --test tests/integration/cli-output.test.js
```

기대: 4 pass (Task 7의 2개 + 새 2개)

- [ ] **Step 5: 커밋**

```bash
git add scripts/cli.js tests/integration/cli-output.test.js
git commit -m "feat(cli): verb-specific help via 'nekowork help <verb>' for work/verify"
```

---

## Task 9: `work` 명령 출력 새 포맷 + Next 블록 + 플래그 정규화

**Files:**
- Modify: `scripts/cli.js` (work 동사 처리 영역)

기존 `=== work ===` 7행 평문 블록을 `kvBlock` + `nextBlock` 조합으로 교체. JSON 모드는 그대로.

- [ ] **Step 1: 통합 테스트 작성 (cli-output.test.js에 추가)**

```javascript
test('nekowork work outputs new format with session and Next block', () => {
  const r = runCli(['work', 'phase1a smoke test'], { NO_COLOR: '1' });
  assert.equal(r.status, 0, r.stderr);
  // 새 ID 형식
  assert.match(r.stdout, /work-\d{4}-\d{2}-\d{2}-[0-9a-f]{4}/);
  // 새 상태 라인
  assert.match(r.stdout, /work 완료/);
  // Next 블록
  assert.match(r.stdout, /Next →/);
  assert.match(r.stdout, /nekowork verify --session/);
  assert.match(r.stdout, /nekowork report --session/);
});

test('nekowork work --pack quality emits deprecation warning', () => {
  const r = runCli(['work', 'smoke', '--pack', 'quality']);
  assert.match(r.stderr, /--pack.*deprecated/);
});

test('nekowork work without task shows 3-section error', () => {
  const r = runCli(['work']);
  assert.notEqual(r.status, 0);
  const out = r.stdout + r.stderr;
  assert.match(out, /✗.*task/);
  assert.match(out, /예시:/);
  assert.match(out, /nekowork work "/);
  assert.match(out, /도움말: nekowork help work/);
});
```

- [ ] **Step 2: 실행, 실패 확인**

- [ ] **Step 3: 구현 — cli.js의 work 디스패치 변경**

cli.js 상단에 import 추가:

```javascript
import { paint, kvBlock, nextBlock } from './lib/ui-format.js';
import { normalizeFlags } from './lib/flag-normalize.js';
import { renderError } from './lib/ui-errors.js';
```

work 동사 처리 부근에서 (기존 `=== work ===` 출력 영역):

기존 `parseWorkArgs(argv)` 호출 직전에 `argv = normalizeFlags(argv, { warn: console.error })`로 정규화.

기존 task 미입력 에러:
```javascript
console.error('task is required. Example: harness work "implement trading dashboard mockup"');
```
를 다음으로 교체:
```javascript
console.error(renderError({
  message: 'task 인수가 필요합니다.',
  examples: [
    'nekowork work "BOM 출력 컬럼에 단가 추가"',
    'nekowork work "타이틀바 다크모드"',
  ],
  helpRef: 'nekowork help work',
}));
process.exit(2);
```

기존 결과 출력(`=== work === / session ... / executor ... / round ... / files ... / diff ... / codex ... / ship ...`):
```javascript
if (parsed.json) {
  console.log(JSON.stringify(result.handoff, null, 2));
} else {
  const opts = {};
  const tookSec = (result.elapsedMs / 1000).toFixed(1);
  const fileCount = result.handoff.files?.length ?? 0;
  console.log('');
  console.log(`  ${paint('ok', '✓', opts)} work 완료              ${paint('dim', `round ${result.handoff.round} · ${fileCount} files · ${tookSec}s`, opts)}`);
  console.log(kvBlock([
    ['session', paint('hint', result.sessionId, opts)],
    ['diff',    result.handoff.diff ? '(generated)' : '(none — 다음 단계에서 생성)'],
    ['codex',   result.handoff.codex ? 'ok' : 'not run'],
    ['ship',    result.handoff.ship  ? 'ready' : 'not run'],
  ], opts));
  console.log('');
  const shortId = result.sessionId.split('-').pop();
  console.log(nextBlock([
    { cmd: `nekowork verify --session ${shortId}`, note: 'Codex 검증 (필수)' },
    { cmd: `nekowork report --session ${shortId}`, note: 'evidence 미리 보기' },
    { cmd: `nekowork gate status --session ${shortId}`, note: 'HUMAN_GATE 확인' },
  ], opts));
  console.log('');
}
```

**주의:** `result` 객체에 `elapsedMs`나 `handoff.round`/`handoff.files` 등이 실제로 있는지 cli.js 기존 코드를 따라 확인. 없으면 안전한 대체값 사용 (예: `result.elapsedMs ?? 0`).

- [ ] **Step 4: 통합 테스트 통과 확인**

```bash
node --test tests/integration/cli-output.test.js
```

기대: 7 pass

- [ ] **Step 5: 기존 회귀 테스트 전체 실행**

```bash
npm test
```

기대: 기존 73개 + 새로 추가된 테스트 모두 PASS. JSON 모드 의존 테스트는 영향 없음(JSON 분기는 그대로).

- [ ] **Step 6: 커밋**

```bash
git add scripts/cli.js tests/integration/cli-output.test.js
git commit -m "feat(cli): apply new format/Next/3-section error to 'work' verb"
```

---

## Task 10: `verify` 명령 출력 새 포맷 + Next 블록 + prefix 매칭

**Files:**
- Modify: `scripts/cli.js` (verify 동사 처리 영역)

work와 동일 패턴. 추가로 `--session a3f7` prefix 매칭이 정상 작동하는지 통합 테스트.

- [ ] **Step 1: 통합 테스트 작성**

```javascript
test('nekowork verify resolves --session by 4-char prefix', () => {
  // 먼저 work로 세션 생성
  const w = runCli(['work', 'phase1a verify prefix']);
  const id = w.stdout.match(/work-\d{4}-\d{2}-\d{2}-[0-9a-f]{4}/)?.[0];
  assert.ok(id, 'work did not emit new id');
  const shortId = id.split('-').pop();

  const r = runCli(['verify', 'phase1a verify prefix', '--session', shortId]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /verify 완료/);
  assert.match(r.stdout, new RegExp(id));   // resolver가 풀 ID를 노출
  assert.match(r.stdout, /Next →/);
});

test('nekowork verify without --session emits 3-section error', () => {
  const r = runCli(['verify', 'no session given']);
  assert.notEqual(r.status, 0);
  const out = r.stdout + r.stderr;
  assert.match(out, /✗.*--session/);
  assert.match(out, /예시:/);
});
```

- [ ] **Step 2: 실행, 실패 확인**

- [ ] **Step 3: 구현 — verify 디스패치 변경**

work와 동일 패턴:
1. `argv = normalizeFlags(argv, { warn: console.error })`
2. `--session` 인자를 `resolveSessionId(projectRoot, raw)`로 해석. 기존 cli.js에서 이미 resolver를 쓰고 있다면 prefix 매칭이 자동 활성화됨(Task 3에서 resolver만 확장). 아니라면 호출 추가.
3. task 미입력 또는 `--session` 미입력 에러를 `renderError`로 교체. session 미입력 예시:
```javascript
console.error(renderError({
  message: '--session 인자가 필요합니다.',
  examples: [
    'nekowork verify --session a3f7',
    'nekowork verify "원본 task" --session a3f7',
  ],
  helpRef: 'nekowork help verify',
}));
process.exit(2);
```
4. 결과 출력은 work와 동일한 `kvBlock` + `nextBlock` 패턴. Next는 다음으로:
```javascript
{ cmd: `nekowork ship --session ${shortId}`, note: 'ship 준비 확인' },
{ cmd: `nekowork report --session ${shortId}`, note: 'REPORT.md 생성' },
{ cmd: `nekowork gate status --session ${shortId}`, note: 'gate 상태' },
```

- [ ] **Step 4: 통합 테스트 통과 확인**

```bash
node --test tests/integration/cli-output.test.js
```

기대: 9 pass

- [ ] **Step 5: 회귀 전체 실행**

```bash
npm test
```

- [ ] **Step 6: 커밋**

```bash
git add scripts/cli.js tests/integration/cli-output.test.js
git commit -m "feat(cli): apply new format/Next/prefix matching to 'verify' verb"
```

---

## Task 11: 시각 시안 캡처본 갱신 + 문서 동기화

**Files:**
- Modify: `docs/CLI-UX-REDESIGN.md`
- Modify: `.tmp_ecc/cli-design/index.html` (Before 캡처를 새 출력으로 교체하지 *않음* — Before는 변경 전 캡처로 보존, Phase 1a 완료 후 별도 페이지에 "Phase 1a 적용 후" 캡처 추가)
- Modify: `docs/QUICKSTART.md` (work/verify 예시가 있으면 새 출력으로 갱신)

- [ ] **Step 1: 새 출력 캡처**

```bash
node packages/nekowork-cli/scripts/cli.js > /tmp/nekowork-bare.txt 2>&1
node packages/nekowork-cli/scripts/cli.js work "doc capture demo" > /tmp/nekowork-work.txt 2>&1
SESSION=$(grep -oE 'work-[0-9-]+-[0-9a-f]{4}' /tmp/nekowork-work.txt | head -1)
SHORT=$(echo $SESSION | awk -F- '{print $NF}')
node packages/nekowork-cli/scripts/cli.js verify "doc capture demo" --session $SHORT > /tmp/nekowork-verify.txt 2>&1
node packages/nekowork-cli/scripts/cli.js work > /tmp/nekowork-work-error.txt 2>&1
```

- [ ] **Step 2: docs/CLI-UX-REDESIGN.md 끝에 "Phase 1a 적용 후 실제 캡처" 섹션 추가**

```markdown
## Phase 1a 적용 후 실제 캡처 (참고)

> 본 섹션은 Phase 1a PR 머지 직후 자동 갱신.

### nekowork (단독)
```text
<위 /tmp/nekowork-bare.txt 내용 붙여넣기>
```

### nekowork work
```text
<위 /tmp/nekowork-work.txt 내용 붙여넣기>
```

### nekowork verify (--session prefix)
```text
<위 /tmp/nekowork-verify.txt 내용 붙여넣기>
```

### nekowork work (인수 누락 에러)
```text
<위 /tmp/nekowork-work-error.txt 내용 붙여넣기>
```
```

- [ ] **Step 3: docs/QUICKSTART.md에서 work/verify 예시가 있는지 확인 후 동일 패턴으로 갱신**

```bash
grep -n "work-[0-9]\{10,\}\|harness work\|nekowork work" docs/QUICKSTART.md
```

옛 timestamp 형식이나 옛 출력 블록이 있으면 새 출력으로 교체. 없으면 건너뜀.

- [ ] **Step 4: 커밋**

```bash
git add docs/CLI-UX-REDESIGN.md docs/QUICKSTART.md
git commit -m "docs(cli): capture Phase 1a after-output for work/verify and bare invocation"
```

---

## Task 12: Phase 1a 마무리 — 전체 회귀 + lint + CLAUDE.md 마커 갱신

**Files:**
- Modify: `CLAUDE.md` (필요 시 카탈로그 요약 자동 마커 안에서)

- [ ] **Step 1: 전체 회귀**

```bash
npm test
```

기대: 모든 unit/integration/e2e PASS.

- [ ] **Step 2: lint·validate**

```bash
npm run lint
```

기대: PASS. 새 lib들이 `scripts/ci/catalog.js`가 요구하는 패턴(ESM, named export)을 따르는지 확인. 어긋나면 즉시 수정.

- [ ] **Step 3: CLAUDE.md 자동 영역 갱신**

```bash
node scripts/sync-claude-md.js
```

기대: 카탈로그 요약이 새 명령(`help all`, `help <verb>`)을 반영하지 않을 수 있음. 변화 없으면 OK, 변화 있으면 commit.

- [ ] **Step 4: 변경 요약 한 줄로 푸시 준비**

```bash
git log --oneline main..HEAD
```

기대: 11개 또는 12개 커밋 (Task 1~11 + 본 Task 마무리). 각 커밋이 작고 독립 빌드 가능한지 확인.

- [ ] **Step 5: PR/머지 핸드오프 메모**

PR description에 다음을 포함:
- 본 PR은 `docs/CLI-UX-PHASE1A-PLAN.md`의 Task 1~12 구현
- 신규 lib 4개(`ui-format`, `session-id`, `flag-normalize`, `ui-errors`)는 후속 Phase 1b/2가 재사용
- 사용자 시각 변화: `nekowork` 단독, `nekowork help`, `work`, `verify` 4개
- 기존 ID 형식(`work-1778631431662`)도 resolver가 계속 인식 — 진행 중인 세션 호환
- 후속: Phase 1b는 별도 PR

- [ ] **Step 6: 마무리 커밋 (있으면)**

```bash
git add CLAUDE.md
git commit -m "chore(cli): refresh CLAUDE.md catalog after Phase 1a cli changes"
```

---

## Self-Review 결과

**Spec coverage** (스펙 C1~C5 + 원칙 6개 ↔ 태스크):

| 스펙 항목 | 태스크 |
|---|---|
| C1 온보딩 단축 출력 | T7 |
| C1 `help all`/`help <verb>` 분리 | T7 + T8 |
| C2 사람 친화 세션 ID | T2 + T6 |
| C2 prefix 매칭 | T3 |
| C2 Next 블록 | T1 (헬퍼) + T9 + T10 (적용) |
| C3 플래그 alias + deprecate | T4 (lib) + T9 + T10 (적용) |
| C4 3단 에러 구조 | T5 (헬퍼) + T9 + T10 (적용) |
| 원칙 6: 색상 5톤 + NO_COLOR | T1 |
| 캡처본 갱신 | T11 |
| 회귀/lint/문서 동기화 | T12 |

Phase 1a 범위 밖(ship/apply/gate/run/build/auto/review 적용, wizard, 구 플래그 제거)은 의도적으로 누락 — Phase 1b/2/3에서 다룸.

**Placeholder scan:** "TBD"/"TODO"/"as appropriate" 없음. 단, T9 Step 3에 *"result 객체에 elapsedMs/handoff.round 등이 실제로 있는지 cli.js 기존 코드를 따라 확인. 없으면 안전한 대체값 사용"* 안내가 있음 — 이는 placeholder가 아니라 기존 코드 적응 지시.

**Type consistency:** `generateSessionId(verb, when?)` 시그니처가 T2 정의 → T6 사용에서 동일. `resolveSessionId(projectRoot, sessionId)`는 T3에서 기존 시그니처 보존. `paint(tone, text, opts)`, `kvBlock(rows, opts)`, `nextBlock(items, opts)`, `renderError({...}, opts)`, `renderBlocked({...}, opts)` 모두 T1/T5 정의와 T9/T10 사용이 일치.

**Ambiguity:** T9의 `result` 객체 필드는 실제 cli.js 기존 코드(L127~L131 참조)에서 확인할 사항이라 명시. 그 외 모호점 없음.
