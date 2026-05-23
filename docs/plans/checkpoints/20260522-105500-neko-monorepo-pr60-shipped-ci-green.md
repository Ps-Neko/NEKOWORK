---
status: shipped-pr-open
branch: chore/monorepo-bootstrap
timestamp: 2026-05-22T10:55:00+09:00
files_modified: [.github/workflows/harness-validate.yml, .github/workflows/harness-review.yml]
pr: 60
---

## Working on: NEKOWORK monorepo bootstrap — PR #60 OPEN, CI green

### Summary

직전 saved context (`20260522-103757-neko-monorepo-p02-merged-hardening-fixed.md`)에서 식별된 P0 #1(CI 워크플로우 monorepo aware 재작성)을 본 세션에서 완료. 추가로 PR push 직후 발견된 CI 회귀(forge-engine typecheck 가 quality-core 의 build 산출물 dist 를 찾지 못함)를 1줄 fix(`pnpm -r run build` step 추가)로 해결. PR #60 OPEN, validate/review 모두 GREEN. 머지는 사용자 결정.

### Decisions Made

**VERSION 정책**: 사용자 선택 A — `0.1.0-alpha.11` 유지, publish 분리. 본 PR 은 monorepo 인프라 변경이므로 publish 와 분리. 다음 기능 PR 에서 alpha.12 publish 결정. CHANGELOG entry 추가 없음.

**T12 TODOS.md 생성**: DEFERRED. 본 PR 변경 범위(814 files)가 이미 거대해서 TODOS.md 신설은 후속 작업으로 미룸. PR body 의 Deferred 섹션에 명시.

**Build step 위치**: validate.yml 에만 추가. review.yml 의 cli.js 호출은 forge-engine/quality-core 의존 없으므로 불필요. CI 시간 차이 미미하지만 최소 변경 원칙 적용.

**CI 회귀 처리**: investigate 모드 즉시 진입. 직전 ci 커밋 bce9125 의 typecheck step 이 fresh checkout 에서 실패 → 로컬에 quality-core/dist 가 잔존해서 통과한 것이 원인. 로컬 재현 후 1줄 fix. force-push 가 아닌 추가 커밋(1c7809c)으로 처리.

### Remaining Work (다음 세션 진입 순서)

1. **PR #60 머지 결정** (사용자 영역)
   - CI green: validate + review + smoke 모두 pass
   - 53 + 1 = 54 commits, 814 files, +30,596 / -1,607
   - 머지 옵션: A) squash B) merge commit (53 커밋 보존 유의)

2. **머지 후 후속 PR 큐** (DEFERRED 6건):
   - T6 GHA dynamic matrix paths-filter — affected-only build
   - T8 forge-engine dynamic import — 30s wedge cold start 보호
   - T9 30s perf regression fixture — CI threshold 25s
   - T10 Release compat (bin/exports) — alpha.12 publish 시점
   - T11 npm deprecate nekoforge — alpha.12 publish 후
   - T12 TODOS.md 4건 등록 (TS-MIGRATION, REACTION-COLLECTOR, RULE-PACK-DIR, NEKOFORGE-PR-INVENTORY)

3. **Open Questions** (PR 리뷰 또는 후속 결정):
   - forge-engine 패키지 이름 `nekoforge` 유지 vs `@ps-neko/forge-engine` rename
   - T11 publish 시점 `@ps-neko/quality-core` 동시 publish 여부 (현재 private)
   - verify-pr feature monorepo 노출 방식 (README/docs)

### Notes

**본 세션 추가 커밋 2건**:
- `bce9125` — ci: monorepo aware harness workflows (pnpm + packages/nekowork-cli)
- `1c7809c` — fix(ci): build workspace packages before typecheck

**브랜치 상태**:
- HEAD: `1c7809c`
- origin/main 대비 54 ahead, 0 behind
- working tree: `.tmp_ecc/` untracked만 (PR body 작성 산출물)

**CI 결과** (1c7809c):
| 잡 | 결과 |
|---|---|
| pull_request harness-validate | success |
| pull_request harness-review | success |
| push harness-validate | success |
| published-alpha-smoke | pass (이전 커밋 결과, 본 커밋 변경 없음) |

**Plan completion 매핑** (12 task plan):
- DONE: T1 (verified), T2, T3, T4, T5, T7, P0 #1, P0 #2, security fix = 9건
- DEFERRED: T6, T8, T9, T10, T11, T12 = 6건

**Carry-over INFORMATIONAL 5건** (직전 /review):
- #1 version-consistency lockfile-bin-weakened: 그대로
- #2 forge-engine name `nekoforge`: Open Question
- #3 supply-chain-shallow: **부분 해소** (resolveEffectiveRoot + --frozen-lockfile 게이트)
- #4 security-hardening dead-branch-intent: 그대로
- #5 CLAUDE.md rebase divergence: 머지로 자동 정합

**핵심 경로**:
- 본 saved context: `~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260522-105500-neko-monorepo-pr60-shipped-ci-green.md`
- 직전 saved context: `~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260522-103757-neko-monorepo-p02-merged-hardening-fixed.md`
- PR body: `D:/claude/harness/.tmp_ecc/pr-body.md`
- 12 tasks plan: `~/.gstack/projects/claude/tasks-eng-review-20260521-110117.jsonl`

**Gotchas (새 항목 + 기존)**:
- (신규) **`pnpm -r run build` 가 typecheck 전 필수**: quality-core 의 types 가 `./dist/index.d.ts` 라 fresh checkout 시 forge-engine typecheck TS2307 + 연쇄 TS7006. 로컬에서 잔존 dist 로 위장 통과 가능. 향후 새 패키지 추가 시 동일 함정.
- (신규) **브랜치 이름 슬래시**: `chore/monorepo-bootstrap` 같은 `/` 포함 브랜치는 `~/.gstack/projects/$SLUG/$BRANCH-reviews.jsonl` 경로 생성 시 디렉토리로 해석됨. 슬래시 → 하이픈 변환 필요.
- (기존) SLUG: `D:/claude/harness` → `Ps-Neko-NEKOWORK`
- (기존) `npm run` 절대 쓰지 말 것. `pnpm` 또는 `pnpm --filter @ps-neko/nekowork run ...`
- (기존) `pnpm -F nekowork-cli` 동작 안 함. `--filter @ps-neko/nekowork` 또는 `--filter ./packages/nekowork-cli`
- (기존) `.github/` 는 monorepo root 유지

**세션 설정**: `checkpoint_mode=explicit`, `proactive=true`, `telemetry=off`, `repo_mode=collaborative`.

**다음 세션 진입 명령**:
```
cd D:/claude/harness && /context-restore
```
