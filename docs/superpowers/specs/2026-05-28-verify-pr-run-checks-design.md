# verify-pr `--run-checks` 설계 (B안)

- Status: Approved design — 구현 대기 (writing-plans 전환 예정)
- Date: 2026-05-28
- Branch: `feat/verify-pr-run-checks` (base `main`)
- 관련: `packages/nekowork-cli/docs/SCOPE-1.0.md` §5–§7, PR #84(문서 정합, 별도)

## 1. 배경 / 문제

현재 `verify-pr` 는 diff 에 결정론적 위험 룰 5종을 돌리고, `project-detector` 로
프로젝트가 test/lint/typecheck/build/audit 명령을 **가지고 있는지 여부(boolean)** 만
감지한다. 명령을 **실제로 실행하지는 않는다**. 그래서:

- `verify-pr.js` 의 `describeChecks()` 는 `hasTests` 등 boolean 만 읽는다.
- source 변경인데 test 명령이 없으면 `INSUFFICIENT_EVIDENCE` 로 처리한다 (정직).
- 그러나 SCOPE §5 파이프라인은 "검증 명령 실행" 단계를, §7 결정 룰은 "검증 실패/성공",
  "테스트 실패 → BLOCK" 분기를 적어 두었다. **이 분기는 코드에 존재하지 않는다** —
  문서가 코드보다 앞서 나간 상태(PR #84 §5 에 "미구현(목표)" 로 정직 표기됨).

이 설계는 그 간극을 코드로 메운다: `verify-pr` 가 옵트인으로 프로젝트의 실제 검사
명령을 실행하고, 그 결과를 결정론적 verdict 에 **격상(escalation)** 으로만 반영한다.

## 2. 목표 / 비목표

### 목표
- `verify-pr --run-checks` 가 프로젝트의 test/lint/typecheck 명령을 실제 실행.
- 실행 결과를 evidence(`checks.json`), `REPORT.md`, `decision.json`, PR 코멘트에 기록.
- 검사 실패가 "그냥 통과(ALLOW)" 를 "사람 검토(NEEDS_HUMAN_REVIEW)" 로 격상.
- AI 가 빌드/테스트 스크립트 자체를 변조한 diff 면 실행을 **거부**(보안 게이트).

### 비목표 (v1)
- 기본 실행(default-on). v1 은 옵트인 `--run-checks` 만.
- build / audit 실행 (v1 제외, 향후 확장).
- 진짜 보안 샌드박스/컨테이너 격리 (별도 인프라 필요, 향후).
- 검사 실패만으로 BLOCK (의도적 제외 — 단독 BLOCK 은 위험 룰만).
- 위험 verdict 의 LLM 결정 (불변 — verdict 는 결정론적).

## 3. 확정 결정 (브레인스토밍 Q1–Q4)

| # | 결정 | 근거 |
|---|---|---|
| Q1 | **격상-only**: 검사 실패는 ALLOW→NEEDS_HUMAN_REVIEW 로만. 단독 BLOCK 안 함. | 웨지(못 속이는 '위험' verdict)는 위험 룰이 쥔다. flaky 테스트가 merge 를 하드블록하지 않게. |
| Q2 | **옵트인 `--run-checks`**. 미지정 시 동작 무변경. | 기본을 빠르고 안전하게 유지. 'CI 래퍼' 인상 회피. AI 코드를 기본으로 실행하지 않음. |
| Q3 | **test + lint + typecheck** 만. build/audit 제외. | correctness 3종. build 느림·typecheck 와 중복. `npm audit` 은 기존 의존성 취약점으로 상시 실패 → 노이즈. |
| Q4 | **위험 시 실행 거부**: 위험 룰(스크립트/postinstall 변조, CRITICAL) 시 실행 skip. | NEKOWORK 취지('실행 전 검사')와 일치. 'AI 가 새로 심은' 공격면 차단. 기존 룰 선실행 순서 재사용. |

## 4. 설계

### 4.1 컴포넌트 (기존 자산 재사용, 작게 분리)

1. **`scripts/core/subprocess.js` — 캡처 변형 추가**
   현재 `spawnAndCollect` 는 종료코드 ≠0 에서 reject(=크래시 취급). 검사는 "실패" 가
   정상 입력이므로, 종료코드를 그대로 반환하는 함수를 추가한다:
   ```
   spawnCapture(bin, args, { cwd, env, timeoutMs, shell }) ->
     Promise<{ code: number|null, stdout, stderr, timedOut: boolean }>
   ```
   기존 `spawnProcess`(Windows .cmd/.bat/.ps1 처리) 와 `killProcessTree`(taskkill) 재사용.
   non-zero 에서 reject 하지 않고 resolve.

2. **`scripts/lib/check-runner.js` — 신설**
   ```
   runChecks(commands, { cwd, timeoutMs, only = ['test','lint','typecheck'] }) ->
     Promise<CheckResult[]>
   CheckResult = {
     name: 'test'|'lint'|'typecheck',
     command: string|null,
     status: 'pass'|'fail'|'timeout'|'unavailable'|'skipped',
     exitCode: number|null,
     durationMs: number,
     outputTail: string   // stdout+stderr 마지막 N줄
   }
   ```
   - `commands[name]` 이 `null` → `skipped`(명령 없음).
   - 실행 자체 불가(ENOENT 등) → `unavailable` (**격상 안 함** — 없는 도구로 벌주지 않음).
   - 종료코드 0 → `pass`. 0 아님 → `fail`. 타임아웃 → `timeout`(=fail 취급).
   - detector 가 주는 명령 문자열(`"npm test"`, `"npx tsc --noEmit"`, `"cargo test"` 등)을
     shell 로 실행 (cross-platform npm/npx 해석). 안전성은 옵트인 + 보안 게이트로 확보.

3. **`scripts/orchestrators/verify-pr.js` — 배선**
   - `parseVerifyPrArgs`: `--run-checks`, `--checks-timeout <ms>` 추가.
   - `verifyPrCycle`: `runRules` 다음에 보안 게이트 평가 → 통과 시 `runChecks` 호출
     → 결과를 `deriveVerdict` / `buildDecision` / `writeEvidence` 로 전달.
   - `deriveVerdict`: 격상 분기 추가 (§4.2).
   - `describeChecks`: 유지(availability) + 실행 결과 별도 전달.

### 4.2 데이터 흐름 / 판정 사다리

```
diff → 5개 위험 룰 (기존, 최우선 — 변경 없음)
  ├─ CRITICAL          → BLOCK
  └─ HIGH              → NEEDS_HUMAN_REVIEW

[--run-checks + 보안 게이트 통과 + 검사 실행됨] 이고 위 해당 없을 때:
  ├─ test/lint/typecheck 중 fail|timeout 1개 이상 → NEEDS_HUMAN_REVIEW
  │     (reason 에 어느 검사가 실패했는지 명시)
  └─ 모두 pass (unavailable/skipped 은 무시)     → ALLOW
        (단, medium/low finding 있으면 ALLOW_WITH_WARNINGS)

[검사 미실행 — 플래그 없음 / 게이트 skip / test 명령 없음]: 기존 그대로
  ├─ sourceOnly && test 명령 없음 → INSUFFICIENT_EVIDENCE
  ├─ medium/low finding           → ALLOW_WITH_WARNINGS
  ├─ docs/config only             → ALLOW
  └─ 그 외                        → ALLOW
```

핵심: 위험 룰 결과가 항상 우선. 검사 결과는 "깨끗한데 검사 실패" 인 경우만 ALLOW 를
NEEDS_HUMAN_REVIEW 로 끌어내린다. 검사 통과는 source 변경에 "증거 있음" 을 부여해
INSUFFICIENT_EVIDENCE 대신 ALLOW 를 줄 수 있다.

### 4.3 보안 게이트 (Q4)

`--run-checks` 가 켜져도, 다음 중 하나면 **명령을 실행하지 않고** REPORT 에 사유를 남긴다:

- CRITICAL finding 존재 (어차피 BLOCK).
- `package-lockfile-risk` finding 중 **scripts / postinstall / preinstall 변경 종류** (단순
  dependency 추가는 제외 — 이건 실행 명령을 바꾸지 않으므로 검사 실행을 막을 이유 없음).
  현재 룰이 finding 종류를 구분하지 않으면, 구현 시 finding 에 subtype 태그(예
  `kind: 'install-hook' | 'script' | 'dependency'`)를 추가해 게이트가 구분하게 한다.
- `test-or-security-disable` 가 test 스크립트 약화/삭제를 보고.

이 판단은 `runRules` 결과(이미 실행을 위해 선행)에서 파생하므로 추가 비용 없음.
스킵 시 verdict 는 검사 미실행 경로를 탄다(룰 finding 이 알아서 등급 부여).
메시지 예: `"checks skipped: diff modifies build/test scripts — run manually in a trusted sandbox if you trust this change."`

한계(문서화 필요): 이건 완전 샌드박스가 아니다. 기존 레포 코드를 실행하는 위험은
사용자 책임(어차피 본인 체크아웃에서 본인이 돌릴 코드). 게이트는 **이 diff 가 새로
들여온** 실행 위험만 차단한다.

### 4.4 증거 / 출력

- `.nekowork/evidence/checks.json` — `CheckResult[]` (신규).
- `REPORT.md` — 기존 "Checks Available" 를 "Checks Run" 으로 확장: 각 검사의 pass/fail,
  실패 시 `outputTail`. 미실행 시 사유.
- `.nekowork/decision.json` — `checks` 필드(요약) + verdict reason 에 검사 영향 반영.
- PR 코멘트(`--comment-file`) — 검사 요약 행 추가.

### 4.5 에러 처리 / cross-platform

- **타임아웃**: 검사당 기본 300_000ms(`--checks-timeout` 조정). 초과 → `timeout`=fail.
  `spawnCapture` 가 프로세스 트리 kill(Windows `taskkill`).
- **도구 없음(ENOENT)** ≠ 실패 → `unavailable`, 격상 안 함.
- **shell 실행**: detector 가 명령을 문자열로 주므로 `{ shell: true }`. npm/npx/cargo 등
  PATH 해석을 OS 셸에 위임. 위험은 옵트인 + 보안 게이트로 상쇄.
- **부분 실패**: 한 검사가 unavailable 이어도 나머지는 진행.

## 5. SCOPE-1.0.md 수정 필요 (구현 시 동반)

- §5 파이프라인: "검증 명령 실행" 을 **구현됨(옵트인 `--run-checks`, test/lint/typecheck)** 으로.
  PR #84 가 넣은 "미구현(목표)" 주석 갱신/제거.
- §7 결정 룰:
  - `테스트 실패 → BLOCK` → **`검사 실패 → NEEDS_HUMAN_REVIEW`** 로 수정 (Q1).
  - `HIGH finding + 검증 실패 → BLOCK` / `HIGH + 성공 → NEEDS_HUMAN_REVIEW` 는
    HIGH 가 이미 NEEDS_HUMAN_REVIEW 이므로 단순화(검사 결과는 HIGH 등급을 못 낮춤).
  - `source 변경 + 검사 통과 → ALLOW`, `source + test 명령 없음 → INSUFFICIENT_EVIDENCE` 명시.

## 6. 테스트 전략 (TDD, node:test)

- **check-runner 단위**:
  - pass: `node -e ""` (exit 0).
  - fail: `node -e "process.exit(1)"`.
  - timeout: 짧은 `--checks-timeout` + 매다는 명령.
  - unavailable: 존재하지 않는 bin.
  - skipped: `commands[name] === null`.
- **subprocess.spawnCapture 단위**: non-zero 에서 reject 안 함 + `{code}` 반환, 타임아웃 동작.
- **verify-pr 통합**:
  - test 통과하는 fixture + source 변경 → ALLOW.
  - test 실패하는 fixture + source 변경 → NEEDS_HUMAN_REVIEW (reason 에 'test').
  - `--run-checks` 없으면 기존 동작(INSUFFICIENT_EVIDENCE 등) 유지(회귀 가드).
  - CRITICAL finding 있으면 검사 실행 전에 BLOCK + 검사 미실행.
- **보안 게이트**:
  - `package.json` scripts 변경 diff + `--run-checks` → 검사 skip + REPORT 사유.
- 레포 기존 테스트 위치/패턴(`tests/`, `node:test`) 따름. `npm run validate:all` 무영향
  (lib/orchestrator 변경이라 catalog 검증과 무관, 단 테스트 게이트는 통과해야).

## 7. 향후 (비목표에서 승격 후보)

- build / audit 실행 (audit 은 informational 등급으로).
- 기본 실행 + 위험 시 자동 skip(옵트아웃) 으로 전환 — 사용 데이터 본 뒤.
- 진짜 샌드박스(컨테이너) 실행.

## 8. 확정한 세부

- `outputTail` 기본 40줄(stdout+stderr 합산, 초과 시 앞부분 잘라 마지막 40줄 보존).
- `decision.json` 에 `checks` 필드(요약 배열) 추가하며 `SCHEMA_VERSION` 을
  `verify-pr-v0` → `verify-pr-v1` 로 올린다. `checks` 는 `--run-checks` 미사용 시 빈 배열/생략.
