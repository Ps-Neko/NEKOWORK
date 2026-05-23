---
status: shipped
branch: main
timestamp: 2026-05-22T15:30:00+09:00
files_modified: [.github/workflows/harness-validate.yml, TODOS.md]
pr: [61, 63]
issues_open: [62]
---

## Working on: T6 (GHA paths-filter) + T12 (TODOS.md) 완료, T8/T9 plan gap 발견

### Summary

직전 saved context (`20260522-105500-neko-monorepo-pr60-shipped-ci-green.md`) 의 DEFERRED 6건 중 **T6 (GHA paths-filter affected matrix) + T12 (TODOS.md 4건 등록)** 두 건을 본 세션에서 완료. PR #61 (T6) + PR #63 (T12) 모두 main 머지. T6 의 docs-only skipped 케이스는 PR #63 가 자연 검증 PR 역할을 해서 별도 fixture PR 불필요. 추가로 PR #61 `/review` 단계에서 발견한 `on:` 트리거 중복 finding 을 Issue #62 로 분리 추적. 진행률 8/12 → **10/12 DONE (83%)**.

본 세션 후반 **T8/T9 진입 시도에서 plan 가정 ≠ 현실 갭 발견**. `packages/nekowork-cli/src/cli/check.ts` 가 존재하지 않으며 `--profile forge` 처리 코드도 0건. nekowork-cli 에서 forge-engine 을 import 하는 path 자체가 없음. T8 plan 의 "dynamic import 변환" 가정 = 미성립. 새 office-hours / plan-eng-review 로 T8/T9 재정의 필요. 본 세션은 confusion protocol 발동 시점에서 멈추고 T12 + checkpoint 으로 마무리.

### Decisions Made

**T6 D1 = B (정적 잡 + if 가드 + aggregator)**: 패키지 N=3 규모에서 동적 matrix(footgun) / 단일 잡(병렬X) 대비 가장 보링. `validate-quality` / `validate-forge` / `validate-cli` 3개 잡 + `security` 잡 + `validate-all` aggregator. branch protection 단일 required check 등록 가능 (현재 보호 자체 미설정).

**T6 D2 = A (각 잡 첨 스텝 `pnpm -r run build`)**: forge→quality 의존성(workspace:*) 의 TS2307 함정 회피. pnpm filter syntax 함정(`pkg...` vs `...pkg`) 완전 회피. 전체 빌드 ~30초 손해는 GH Actions 부팅 시간 대비 무의미.

**T6 PR #61 `/review` finding 1 = A (Fix)**: root `package.json` 을 3개 필터에 추가. silent gate skip 시나리오 (root 위임 script / engines 변경 시 lockfile 동반 변경 없으면 모든 validate-* skip) 차단. 추가 commit `26b1f44`.

**T6 PR #61 finding 3 → Issue #62 분리**: `on: push` + `on: pull_request` 중복 트리거 (잡당 2회 실행). T6 스코프 밖. P3.

**T12 형식**: gstack TODOS-format 의 6필드 (What/Why/Context/Pros/Cons/Depends-on) 표준 적용. 단순 bullet 누적은 false confidence 생산이라 명시 금지 (글로벌 룰 정합).

**T8/T9 STOP — confusion protocol**: plan 가정 ≠ 현실 갭 명확화 후 사용자 결정 받고 D + B (세션 종료 + T12 + checkpoint) 권장 옵션으로 우회. T8/T9 본격 진입은 다음 세션의 새 office-hours / plan-eng-review 영역.

### Remaining Work (다음 세션 진입 순서)

1. **T8/T9 재정의** (P1, 다음 세션 첫 작업 권장)
   - **사실 확인**: `packages/nekowork-cli/src/cli/check.ts` 부재, `--profile forge` 코드 0건, forge-engine import 0건
   - **필요한 새 plan**:
     - 현재 nekowork-cli 진입점 = `scripts/cli.js` (JS, src/ 없음)
     - design doc D3: "nekowork check --profile forge" 결정만 있고 미구현
     - T8 본질 = forge integration 자체 신설 + dynamic import 적용 (2단계)
     - T9 perf fixture = forge profile flow 가 있어야 측정 가능 → T8 와 묶음
   - **권장 진입**: `/office-hours` → `/plan-eng-review` (T8/T9 단위가 아니라 "forge integration 자체" 단위로 재정의)
   - **TS-MIGRATION 과 묶음 가능성**: forge integration 신설 시 cli.js 일부를 TS 로 같이 이식하면 type-level 으로 forge-engine 의 quality-core 의존 검증 가능

2. **T10 (Release compat)** + **T11 (npm deprecate nekoforge)** — alpha.12 publish 결정 시점 진입
   - publish 결정 자체는 사용자 영역 (외부 알파 5명 피드백 7일 + 1.0 게이트 5조건 검토 후)
   - Open Question 3건 (forge-engine 이름 / quality-core publish 여부 / verify-pr feature 노출) 결정 선행

3. **Issue #62 fix** (`on:` 트리거 중복) — P3, 별도 작은 PR 후보. 언제든 진입 가능

4. **Carry-over INFORMATIONAL 4건** (PR #60 `/review` 잔존):
   - #1 version-consistency lockfile-bin-weakened
   - #2 forge-engine 이름 (Open Question 1번과 동일)
   - #4 security-hardening dead-branch-intent
   - #5 CLAUDE.md rebase divergence (자동 해소 가능성 높음)

### Notes

**본 세션 추가 PR 2건 (모두 머지)**:
- **PR #61** `chore/ci-paths-filter` (T6) — merge commit `2eca29d`
  - `2710eeb` ci: harness-validate.yml paths-filter affected matrix 도입
  - `26b1f44` fix(ci): paths-filter 에 root package.json 추가 (/review 후속)
- **PR #63** `chore/add-todos` (T12) — merge commit `d438128`
  - `7a7e4e1` docs: TODOS.md 신설 (T12) — deferred 4건 등록

**main 최신 5 commits**:
```
d438128 Merge pull request #63 from Ps-Neko/chore/add-todos
7a7e4e1 docs: TODOS.md 신설 (T12) — deferred 4건 등록
2eca29d Merge pull request #61 from Ps-Neko/chore/ci-paths-filter
26b1f44 fix(ci): paths-filter 에 root package.json 추가
2710eeb ci: harness-validate.yml paths-filter affected matrix 도입
```

**T6 CI 풀 매트릭스 실측** (PR #61 첫 push 후):
- changes 6s, security 9s, validate-quality 12-17s, validate-forge 30-31s, validate-cli 33-35s, validate-all 2s, published-alpha-smoke 10s, review 16s — 모두 PASS

**T6 skipped 케이스 실측** (PR #63 docs-only push 후):
- changes pass (4-5s)
- validate-forge / validate-quality / validate-cli **모두 skipping** ✓
- validate-all pass (3s) — aggregator `success|skipped` 로직 정확 동작 ✓
- security pass (14s) — paths-filter 무관 항상 실행 ✓
- published-alpha-smoke pass (17s)

**branch protection 상태**: `main` 에 보호 규칙 **미설정** (`gh api .../protection` → HTTP 404 "Branch not protected"). 향후 도입 시 `validate-all` 단일 required check 로 등록 권장. PR #61 body 의 "branch protection 갱신" 가이드는 향후 사용 위해 보존.

**브랜치 cleanup**: `chore/ci-paths-filter` + `chore/add-todos` 모두 머지 시 `--delete-branch` 로 remote 정리. 로컬 main 자동 switch + fast-forward.

**Issue #62**: https://github.com/Ps-Neko/NEKOWORK/issues/62 — `on: push` + `on: pull_request` 중복 트리거 정리. P3. body 에 fix 안 + 영향 + harness-review.yml 도 동일 패턴 점검 권장 명시.

**Plan completion 매핑** (12 task plan, 본 세션 후):
- DONE: T1 (verified), T2, T3, T4, T5, T6 (이번), T7, T12 (이번), P0 #1, P0 #2, security fix = **10건 + 3 보너스**
- DEFERRED: T8, T9, T10, T11 = **4건**

**핵심 경로**:
- 본 saved context: `~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260522-153000-t6-t12-shipped-t8-gap-discovered.md`
- 직전 saved context: `~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260522-105500-neko-monorepo-pr60-shipped-ci-green.md`
- 12 tasks plan: `~/.gstack/projects/claude/tasks-eng-review-20260521-110117.jsonl`
- 디자인 doc: `~/.gstack/projects/claude/dora-main-design-neko-restructure-20260521-095633.md`
- TODOS.md (이번 신설): `D:/claude/harness/TODOS.md`

**Gotchas (새 항목 + 기존)**:
- (신규) **plan 의 file path 가 현실과 다를 수 있음**: T8 의 `packages/nekowork-cli/src/cli/check.ts` 는 plan 작성 시점 (2026-05-21) 의 가정. 실제 nekowork-cli 는 `src/` 없이 `scripts/cli.js` 진입점. 다음 plan-eng-review 호출 전 실제 코드 트리 먼저 grep 으로 확인 권장.
- (신규) **paths-filter 의 workflow 파일 자체 포함**: 각 필터에 `.github/workflows/harness-validate.yml` 가 포함되어 workflow 변경 시 풀 매트릭스 트리거. 의도된 설계. workflow 의 주석/포맷팅만 변경해도 풀 실행 — 비용 미미.
- (신규) **`on: push` + `on: pull_request` 잡 중복 실행**: 잡당 2회 (push 이벤트 + PR 이벤트). Issue #62 추적 중. 머지 게이트 영향 없음, CI 분 50% 절감 기회.
- (신규) **TODOS.md 형식**: gstack 6필드 표준 (What/Why/Context/Pros/Cons/Depends-on). 단순 bullet 누적 금지 (글로벌 룰).
- (기존) **`pnpm -r run build` 가 typecheck 전 필수**: quality-core 의 types 가 `./dist/index.d.ts` 라 fresh checkout 시 forge-engine typecheck TS2307. T6 의 각 validate-* 잡 첫 스텝으로 처리됨.
- (기존) **브랜치 이름 슬래시**: `chore/ci-paths-filter` 같은 `/` 포함 브랜치는 reviews.jsonl 경로 디렉토리 해석. gstack 최신 스킬은 `tr '/' '-'` 처리 내장.
- (기존) SLUG: `D:/claude/harness` → `Ps-Neko-NEKOWORK`
- (기존) `npm run` 절대 쓰지 말 것. `pnpm` 또는 `pnpm --filter @ps-neko/nekowork run ...`
- (기존) `.github/` 는 monorepo root 유지

**세션 설정 (변동 없음)**: `checkpoint_mode=explicit`, `proactive=true`, `telemetry=off`, `repo_mode=collaborative`.

**다음 세션 진입 명령** (T8/T9 재정의 우선 시):
```
cd D:/claude/harness && /office-hours
```
또는 saved context 직접 읽기:
```
cd D:/claude/harness && cat ~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260522-153000-t6-t12-shipped-t8-gap-discovered.md
```
