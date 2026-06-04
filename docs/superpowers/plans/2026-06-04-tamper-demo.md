# tamper(결정성) 데모 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run demo:tamper` 한 명령으로, 격리된 임시 git repo에서 진짜 `verify-pr`를 두 번 실행해 "기록(decision.json)을 ALLOW로 위조해도 재실행하면 verdict가 diff에서 재계산되어 또 BLOCK"임을 보여주는 정직한 데모를 만든다.

**Architecture:** 신규 스크립트 `scripts/demo-tamper.js`가 `os.tmpdir()` 아래 일회용 git repo를 만들고(`src/auth.ts`에 secret fallback diff), 기존 오케스트레이터 함수 `verifyPrCycle`를 프로그램적으로 호출(=CLI와 동일 엔진)한다. 1막 BLOCK → 2막 `.nekowork/decision.json`을 ALLOW로 손편집 → 3막 재실행 BLOCK을 실제 결과로 보이고, 각 막의 기대치를 스크립트가 `assert`하여 어긋나면 비0 종료한다(정직성 보장). 노출은 `docs/DEMO.md` 섹션 + README(en/ko) 링크 1개. CI 통합테스트가 데모의 실제 동작을 영구 가드한다.

**Tech Stack:** Node.js 22+ ESM, `node:test`, `node:child_process`(git), 기존 `scripts/orchestrators/verify-pr.js`의 export(`verifyPrCycle`, `printVerifyPrSummary`, `VERDICT`).

**Spec:** `docs/superpowers/specs/2026-06-04-tamper-demo-design.md`
**Branch:** `feat/demo-tamper` (이미 생성됨, base `main`, spec 커밋 `c2447d7`)

**정직성 불변식(스펙 §3) — 구현 내내 준수:**
- I1: 3막 BLOCK은 실제 재실행 결과(하드코딩 금지).
- I2: "apply가 위조 거부"는 주장 안 함. 주장은 "verdict는 매 실행 재계산".
- I3: LLM 컷은 illustrative(가짜 호출 아님), "예시" 라벨.
- I4: 항상 격리 temp dir. 사용자 프로젝트 무변경.
- I5: 기대치 어긋나면 스크립트가 시끄럽게 실패(비0 종료) + 테스트로 가드.

---

### Task 1: 데모를 가드하는 통합 테스트 (실패부터)

**Files:**
- Test: `packages/nekowork-cli/tests/integration/demo-tamper.test.js` (Create)

이 테스트는 데모 스크립트를 실제로 실행하고, 1막·3막 모두 BLOCK 카드가 나오고 정상 종료(0)하는지 검증한다. (스크립트가 내부 assert로 I1/I5를 강제하므로, exit 0 이면 결정성 동작이 성립한 것.)

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// packages/nekowork-cli/tests/integration/demo-tamper.test.js
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '../../scripts/demo-tamper.js');

test('demo:tamper — 기록을 위조해도 재실행하면 BLOCK 유지(결정성), 정상 종료', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--cleanup', '--json'], {
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  assert.equal(r.status, 0, `데모는 exit 0 이어야 함\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`);

  const out = r.stdout;
  assert.match(out, /1막/, '1막 섹션이 출력되어야 함');
  assert.match(out, /3막/, '3막 섹션이 출력되어야 함');

  // verdict 카드(printVerifyPrSummary)의 BLOCK 이 최소 2번(1막·3막) 나와야 함.
  // (JSON 요약의 "verdict":"BLOCK" 은 콜론 앞에 따옴표가 있어 이 패턴과 매칭되지 않음)
  const blockCards = out.match(/verdict\s+:\s+BLOCK/g) || [];
  assert.ok(blockCards.length >= 2, `BLOCK verdict 카드가 1막·3막 최소 2번 나와야 함, got ${blockCards.length}`);

  // 재실행 결과가 기록이 아니라 재계산에서 옴을 JSON 요약으로 확인
  assert.match(out, /"act3":\{"verdict":"BLOCK","exitCode":2\}/, '3막 재실행이 BLOCK/exit2 여야 함');

  // 격리 sandbox 가 정리되었음
  assert.match(out, /sandbox removed/, '--cleanup 시 sandbox 가 제거되어야 함');
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd packages/nekowork-cli && node --test tests/integration/demo-tamper.test.js`
Expected: FAIL — `scripts/demo-tamper.js` 가 없어 `spawnSync` 의 `status` 가 0이 아니거나(모듈 없음 에러) 출력 매칭 실패.

---

### Task 2: 데모 스크립트 구현

**Files:**
- Create: `packages/nekowork-cli/scripts/demo-tamper.js`

기존 `scripts/demo-quick-run.js` 패턴을 따르되, 데모 본체는 오케스트레이터를 직접 호출(`verifyPrCycle`)한다(= CLI와 동일 엔진, 더 단순·결정적). 임시 repo 세팅은 `tests/unit/verify-pr.test.js` 의 `makeTempProject`/`writeAndStage` 검증된 방식을 그대로 쓴다.

- [ ] **Step 1: 스크립트 작성**

```js
// packages/nekowork-cli/scripts/demo-tamper.js
#!/usr/bin/env node
// NEKOWORK tamper demo: 기록(decision.json)을 위조해도 verify-pr 는 매 실행마다
// diff 에서 verdict 를 재계산한다. 위조는 무의미하다.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  verifyPrCycle,
  printVerifyPrSummary,
  VERDICT,
} from './orchestrators/verify-pr.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { cleanup: true, json: false };
  for (const a of argv) {
    if (a === '--keep') args.cleanup = false;
    else if (a === '--cleanup') args.cleanup = true;
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/demo-tamper.js [--keep] [--json]');
      process.exit(0);
    } else throw new Error(`unknown option: ${a}`);
  }
  return args;
}

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${r.status}): ${r.stderr || r.stdout}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(`DEMO ASSERT FAILED: ${msg}`);
}

// 검증된 fixture: tests/unit/verify-pr.test.js 의 "Secret Fallback 추가 → BLOCK" 와 동일 문자열.
const SECRET_DIFF = [
  'export function getKey(): string {',
  '  return process.env.API_KEY || "sk-leaked-fallback-secret";',
  '}',
  '',
].join('\n');

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nekowork-tamper-demo-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'demo@nekowork.local']);
  git(root, ['config', 'user.name', 'nekowork-demo']);
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'tamper-demo', scripts: { test: 'node --test' } }, null, 2) + '\n',
  );
  fs.writeFileSync(path.join(root, '.gitignore'), '.nekowork/\nREPORT.md\n');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  // baseline: 안전한 버전을 커밋
  fs.writeFileSync(path.join(root, 'src', 'auth.ts'),
    'export function getKey(): string {\n  return "static-ok";\n}\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'baseline']);
  // AI 가 secret fallback 을 심는다 (미커밋 working-tree 변경 = verify-pr 가 보는 diff)
  fs.writeFileSync(path.join(root, 'src', 'auth.ts'), SECRET_DIFF);
  return root;
}

async function runVerify(root, label) {
  console.log(`\n=== ${label} ===`);
  const result = await verifyPrCycle({ projectRoot: root, write: true });
  printVerifyPrSummary(result);
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = makeSandbox();
  console.log('NEKOWORK tamper demo — 기록을 위조해도 verdict 는 diff 에서 재계산된다');
  console.log(`sandbox: ${root}  (사용자 프로젝트는 건드리지 않음)`);

  try {
    // 1막: AI 가 심은 secret → verify-pr 가 BLOCK
    const r1 = await runVerify(root, '1막: AI 가 secret fallback 을 심었다 → verify-pr');
    assert(r1.decision.verdict === VERDICT.BLOCK, `1막 verdict 는 BLOCK 이어야 함 (got ${r1.decision.verdict})`);
    assert(r1.exitCode === 2, `1막 exitCode 는 2 여야 함 (got ${r1.exitCode})`);

    // 2막: 누군가 기록을 ALLOW 로 위조
    const decisionPath = path.join(root, '.nekowork', 'decision.json');
    const tampered = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
    tampered.verdict = VERDICT.ALLOW;
    tampered.apply_allowed = true;
    fs.writeFileSync(decisionPath, JSON.stringify(tampered, null, 2));
    console.log('\n=== 2막: 누군가 기록(.nekowork/decision.json)을 위조 ===');
    console.log(`  위조됨 → "verdict": "${tampered.verdict}", "apply_allowed": ${tampered.apply_allowed}`);
    const reloaded = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
    assert(reloaded.verdict === VERDICT.ALLOW, '2막: 위조(ALLOW)가 디스크에 적용되어야 함');

    // 3막: 재실행 → 위조는 무시되고 BLOCK 으로 재계산
    const r3 = await runVerify(root, '3막: verify-pr 재실행 (위조는 무시된다)');
    assert(r3.decision.verdict === VERDICT.BLOCK, `3막 verdict 는 BLOCK 이어야 함 (got ${r3.decision.verdict})`);
    assert(r3.exitCode === 2, `3막 exitCode 는 2 여야 함 (got ${r3.exitCode})`);
    const rereadDecision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
    assert(rereadDecision.verdict === VERDICT.BLOCK,
      `3막: decision.json 이 다시 BLOCK 으로 재계산되어야 함 (got ${rereadDecision.verdict})`);

    console.log('\n교훈: 기록을 고쳐도 소용없다 — verdict 는 매 실행마다 diff 에서 재계산된다.');
    console.log('      게이트는 저장된 상태(기록)가 아니라 diff(실물)를 믿는다.');

    // LLM 컷 (illustrative — 실제 API 호출 아님)
    console.log('\n=== 예시: LLM advisor 가 LGTM 해도 ===');
    console.log('  (예시) Codex advisor: "LGTM — dev fallback, looks fine."');
    console.log('  → verdict: BLOCK. 결정론 룰이 결정한다. LLM 은 verdict 를 통제하지 않는다.');

    if (args.json) {
      console.log('\n' + JSON.stringify({
        act1: { verdict: r1.decision.verdict, exitCode: r1.exitCode },
        act3: { verdict: r3.decision.verdict, exitCode: r3.exitCode },
      }));
    }
    console.log('\n재현: npm run demo:tamper  (또는 직접: 임의 repo 에서 npx -y @ps-neko/nekowork@alpha verify-pr)');
  } finally {
    if (args.cleanup) {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      console.log('sandbox removed (--keep 로 보존 가능).');
    } else {
      console.log(`sandbox kept: ${root}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 2: 통합 테스트 실행 → 통과 확인**

Run: `cd packages/nekowork-cli && node --test tests/integration/demo-tamper.test.js`
Expected: PASS (1 test). 실패 시 출력의 STDOUT/STDERR 로 어느 막의 assert 가 깨졌는지 진단.

- [ ] **Step 3: 데모 육안 확인 (sandbox 보존)**

Run: `cd packages/nekowork-cli && node scripts/demo-tamper.js --keep`
Expected: 1막 BLOCK 카드 → 2막 위조 출력 → 3막 BLOCK 카드 → 교훈 + LLM 컷 출력. 마지막에 `sandbox kept: <경로>`. 그 경로의 `.nekowork/decision.json` 을 열어 `verdict` 가 다시 `BLOCK` 인지 직접 확인 후 수동 삭제.

- [ ] **Step 4: 커밋**

```bash
git add packages/nekowork-cli/scripts/demo-tamper.js packages/nekowork-cli/tests/integration/demo-tamper.test.js
git commit -m "feat(demo): demo-tamper — 위조된 기록을 재실행이 무시하는 결정성 데모 + 통합 테스트"
```

---

### Task 3: `npm run demo:tamper` 배선

**Files:**
- Modify: `packages/nekowork-cli/package.json` (scripts 블록, `demo:external` 다음 줄)

- [ ] **Step 1: package.json scripts 에 항목 추가**

`"demo:external": "node scripts/demo-external-project.js",` 줄 바로 다음에 추가:

```json
    "demo:tamper": "node scripts/demo-tamper.js",
```

(주의: JSON 유효성 — 앞 줄 끝 쉼표 유지, 새 줄도 쉼표로 끝남.)

- [ ] **Step 2: npm 스크립트로 실행 확인**

Run: `cd packages/nekowork-cli && npm run demo:tamper`
Expected: Task 2 Step 3 과 동일한 전개 + 마지막 `sandbox removed` (기본 `--cleanup`).

- [ ] **Step 3: 커밋**

```bash
git add packages/nekowork-cli/package.json
git commit -m "chore(demo): npm run demo:tamper 스크립트 배선"
```

---

### Task 4: 노출 — DEMO.md 섹션 + README(en/ko) 링크 1개

**Files:**
- Modify: `packages/nekowork-cli/docs/DEMO.md` (끝에 섹션 추가)
- Modify: `packages/nekowork-cli/README.md` (영문, npm 노출본)
- Modify: `packages/nekowork-cli/README.ko.md` (한글)

- [ ] **Step 1: `docs/DEMO.md` 끝에 섹션 추가**

파일 맨 끝에 빈 줄 하나 두고 아래를 그대로 덧붙인다:

````markdown
## Tampering the verdict is futile (determinism)

`verify-pr` decides the verdict by recomputing it from the diff on **every run**.
The recorded `REPORT.md` / `.nekowork/decision.json` are records, not the gate —
editing them changes nothing, because the next run re-derives the verdict from the
actual change.

Run it yourself (isolated sandbox — your project is never touched):

```bash
npm run demo:tamper
```

What it shows:

1. An AI leaves a secret fallback in `src/auth.ts` → `verify-pr` returns **BLOCK**.
2. Someone edits `.nekowork/decision.json` to say `ALLOW`.
3. `verify-pr` runs again → **BLOCK** again. The forged record is ignored; the
   verdict is recomputed from the diff.

An optional LLM advisor saying "LGTM" does not change this — the deterministic
rules decide the verdict; the advisor never controls it.

> Honest scope: this demonstrates **determinism** (re-running re-derives the
> verdict). It does **not** claim cryptographic tamper-detection of stored
> artifacts — that is separate hardening tracked in the roadmap.
````

- [ ] **Step 2: `README.md`(영문)에 링크 1줄 추가**

`README.md` 에서 `## One Command. One Blocked Risk.` 섹션의 thesis 문단(`That is the thesis: ...refuses to let unverified changes merge or apply.`) 바로 다음 줄에 빈 줄 + 아래 한 줄을 추가한다:

```markdown
> Don't trust the recorded verdict? **Tampering it is futile** — re-running re-derives it from the diff. See it: [`npm run demo:tamper`](docs/DEMO.md#tampering-the-verdict-is-futile-determinism).
```

(먼저 해당 thesis 문단을 Read 로 확인해 정확한 위치에 삽입할 것. 한 줄 추가 외 본문 변경 금지 — 웨지 보호.)

- [ ] **Step 3: `README.ko.md`(한글)에 링크 1줄 추가**

`README.ko.md` 에서 `## 한 명령. 하나의 차단된 위험.` 섹션의 마무리 문단(`NEKOWORK 의 핵심: ... LLM verdict 는 게이트를 통과할 수 없습니다.`) 바로 다음 줄에 빈 줄 + 아래 한 줄을 추가한다:

```markdown
> 기록된 verdict 가 의심되나요? **위조는 무의미합니다** — 재실행하면 diff 에서 다시 계산됩니다. 직접 보기: [`npm run demo:tamper`](docs/DEMO.md#tampering-the-verdict-is-futile-determinism).
```

(해당 문단을 Read 로 확인 후 삽입. 한 줄 추가 외 변경 금지.)

- [ ] **Step 4: 커밋**

```bash
git add packages/nekowork-cli/docs/DEMO.md packages/nekowork-cli/README.md packages/nekowork-cli/README.ko.md
git commit -m "docs(demo): DEMO.md 결정성 섹션 + README(en/ko) 재현 링크 1개"
```

> 참고: README 의 다른 줄(테스트 수 등)은 별도 브랜치 `docs/nekowork-doc-number-advisor-alignment` 에서 수정 중이다. 이 작업은 추가 줄만 넣으므로 머지 시 충돌 나도 둘 다 additive 라 사소하게 해소된다.

---

### Task 5: 전체 검증 + 마무리

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `cd packages/nekowork-cli && npm test`
Expected: 기존 532 + 신규 1 = **533 tests pass, 0 fail**. (신규 통합테스트가 데모를 실제 실행하므로 git 필요 — CI/로컬 모두 git 있음.)

- [ ] **Step 2: lint/validate 무영향 확인**

Run: `cd packages/nekowork-cli && npm run validate:all`
Expected: pass (스크립트/문서/테스트만 추가, catalog 무관).

- [ ] **Step 3: (선택) 데모 트랜스크립트를 PR 본문/핸드오프에 캡처**

Run: `cd packages/nekowork-cli && node scripts/demo-tamper.js --cleanup > /tmp/tamper-demo.txt 2>&1; cat /tmp/tamper-demo.txt`
용도: PR 설명에 실제 출력 붙여넣기(노출 효과 확인). 커밋 대상 아님.

---

## Self-Review (작성자 체크)

**1. Spec coverage:**
- 스펙 §2 목표 — 한 명령 실행(Task 3), 격리 temp + 진짜 verify-pr 2회(Task 2), 1막 BLOCK·2막 위조·3막 BLOCK(Task 2 Step 1), LLM 컷(Task 2), DEMO.md+README 노출(Task 4), CI 테스트 가드(Task 1) → 전부 태스크 존재. ✅
- 스펙 §3 정직성 불변식 I1~I5 — I1/I5: 스크립트 내부 assert + 통합테스트(Task1, Task2). I2: "apply 거부" 미주장 + DEMO.md "Honest scope" 노트(Task4). I3: LLM 컷 "(예시)" 라벨(Task2). I4: `mkdtempSync` + 기본 cleanup(Task2). ✅
- 스펙 §7 확정세부 — 경로/스크립트명/룰/조작대상/격리/LLM라벨 전부 반영. ✅
- 비목표(apply 해시검증, 실제 LLM, visualizer, README 본문확장) — 침범 안 함. ✅

**2. Placeholder scan:** TBD/TODO/"적절히 처리" 류 없음. 모든 코드/명령/문구 전체 기재. ✅

**3. Type consistency:** `verifyPrCycle({projectRoot, write})`→`{decision:{verdict,apply_allowed,exitCode? }, exitCode, findings}`, `VERDICT.BLOCK`/`VERDICT.ALLOW`, `printVerifyPrSummary(result)` — 모두 `tests/unit/verify-pr.test.js` 의 검증된 시그니처와 일치. 테스트 매칭 정규식(`/verdict\s+:\s+BLOCK/`)은 카드 출력 형식(`  verdict        : BLOCK`)과 일치, JSON(`"verdict":"BLOCK"`)과는 비매칭. ✅
