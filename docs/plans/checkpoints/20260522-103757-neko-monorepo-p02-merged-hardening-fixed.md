---
status: in-progress
branch: chore/monorepo-bootstrap
timestamp: 2026-05-22T10:37:57+09:00
files_modified: []
---

## Working on: NEKOWORK monorepo bootstrap — P0 #2 origin/main 머지 완료, hardening monorepo fix 추가, P0 #1 CI 남음

### Summary

직전 saved context (`20260522-094048-neko-monorepo-t2-t5-done-review-found-2-p0.md`)에서 식별된 P0 #2(origin/main 16 커밋 미반영)를 본 세션에서 해결. 머지 결과 95+건 충돌을 일괄 처리(UA 25 + root A 약 70 + UU 1 + M 21)했고, 머지 직후 발견된 회귀(`security:hardening`이 lockfile을 packages/nekowork-cli/에서만 검색해 root pnpm-lock.yaml을 못 찾음)를 별도 fix 커밋으로 보강. 본 브랜치 코드는 798/798 GREEN + typecheck/lint/audit clean 상태. 남은 P0 #1(CI 워크플로우 monorepo aware 재작성)은 fresh 세션에서 진행.

### Decisions Made

**머지 전략**: 사용자 선택 A — "일괄 해결 후 한번에 검증". 카테고리별 단계 진행도 옵션으로 제시했으나, 충돌이 mechanical 패턴(directory rename + monorepo 정책 이동)이라 일괄이 효율적이라 판단. 결과적으로 단일 머지 커밋 `f830eab` 로 정리됨.

**충돌 카테고리별 처리**:
- **UA 25건**(directory rename hint로 git이 packages/nekowork-cli/ 측 stage에 origin 추가분 배치): `git add` 일괄로 unmerged 해소. 한 번 실수로 `git mv` 대상에 UA 25건도 포함시켜 `packages/nekowork-cli/packages/nekowork-cli/...` 이중 경로가 생겼고 즉시 reverse-mv 로 복구함. 향후 유사 머지에서 UA(stage=3 only)와 A(root에 add됨)를 명확히 구분해 처리할 것.
- **root A 약 70건**(scripts/benchmark/, tests/fixtures/*): `git mv` 로 일괄 `packages/nekowork-cli/` 하위로 이동.
- **package.json UU 1건**: ours(monorepo root) 채택. origin alpha.11의 변경(version bump + `bench:rules` script 추가) 2건을 `packages/nekowork-cli/package.json`에 적용. root는 `@ps-neko/nekowork-monorepo` private 그대로.
- **README.{md,ko.md}**: T2.6-fix 정책(root와 packages 동일 유지 D7 rewrite TODO)에 따라 root의 origin 머지 결과를 packages 측에 cp로 동기화.

**security-hardening monorepo fix 별도 커밋**: 머지 직후 회귀로 발견. 사용자 선택 A — "지금 완전수정 + 식별 테스트 추가". `resolveEffectiveRoot(start)` 헬퍼 추가: `../../pnpm-workspace.yaml` 존재 여부로 워크스페이스 루트 자동 감지. `checkSecurityHardening(rawRoot)` 진입에서 effectiveRoot 계산 후 모든 검사(lockfile, .github, manifest)에 적용. 테스트 2건 추가(resolveEffectiveRoot 폴백 + 패키지 dir 호출이 root lockfile 인식). T2.6 패치(`readAgentManifest`만 monorepo aware) 미완성을 보강한 것.

**다음 세션은 fresh 컨텍스트로**: 사용자 선택 B — "여기서 checkpoint 저장 + fresh 세션". P0 #1은 .yml 두 파일 집중 작업이라 fresh 컨텍스트에서 세세하게 진행하는 게 안전 판단.

### Remaining Work (다음 세션 진입 순서)

1. **P0 #1 — CI 워크플로우 monorepo aware 재작성** (본 PR 내 필수)
   - `.github/workflows/harness-validate.yml`:
     - L51 `cache: npm` → `pnpm/action-setup` + `cache: 'pnpm'`
     - L70 `npm ci` → `pnpm install --frozen-lockfile`
     - L74-80 `node scripts/install-plan.js` 등 → `pnpm --filter @ps-neko/nekowork run ci:install-plan` 또는 직접 `node packages/nekowork-cli/scripts/...`
     - L83 `npm run security:hardening` → `pnpm --filter @ps-neko/nekowork run security:hardening` (※ 본 세션 hardening fix 덕에 monorepo root에서도 동작)
     - L86 `npm test` → `pnpm -r run test`
     - L88 `npm audit` → `pnpm audit --audit-level=moderate`
     - L92-97 build scripts → `pnpm --filter @ps-neko/nekowork run build:*`
   - `.github/workflows/harness-review.yml`: 동일 패턴 (L51/54/58-60/63/109)
   - 가능하면 `paths-filter` 로 forge-engine/quality-core 변경 시에만 해당 패키지 빌드 (T6 dynamic matrix 일부 흡수)

2. **로컬 재검증**(CI 수정 후): `pnpm install --frozen-lockfile` → `pnpm -r run test` (798 GREEN) → `pnpm -r run typecheck` → `pnpm -r run lint` → `pnpm --filter @ps-neko/nekowork run security:hardening`

3. **/ship 시작 가능 상태 도달 후**: PR 작성. PR body에 본 세션 + 이전 세션 컨텍스트 + /review 발견 INFORMATIONAL 5건 + T6/T7 흡수 범위 + T8~T12 deferred 명시.

### Notes

**본 세션 추가 커밋 2건**:
- `f830eab` — chore(monorepo): origin/main alpha.11 머지 + verify-pr feature monorepo 재배치
- `556d8b4` — fix(security): resolveEffectiveRoot 추가 — monorepo lockfile/workflows 자동 감지

**테스트 카운트 증가**(origin/main verify-pr feature 흡수 + 신규 식별 테스트):
- nekowork-cli: 401 → 498 (verify-pr feature +95, hardening fix +2)
- forge-engine: 292 (변동 없음)
- quality-core: 7 (변동 없음)
- 총: 700 → 797 (직전 saved 시점 목표) → 798 (현 시점 실측)

**머지 후 검증 결과**:
- `pnpm install --frozen-lockfile`: OK (lockfile 변경 없음)
- `pnpm -r run test`: 798/798 GREEN
- `pnpm -r run typecheck`: forge-engine + quality-core OK
- `pnpm -r run lint`: nekowork-cli pass / forge-engine 1 unused-vars warning (`RuleFinding` in `src/core/gate/verdict.ts:11:3`, 기존 이슈)
- `pnpm --filter @ps-neko/nekowork run security:hardening`: pass (workflows 2 / jobs 3 / actions 7 / mcp servers 4)
- `pnpm audit --audit-level=moderate`: No known vulnerabilities

**현재 origin/main 대비 상태**:
- HEAD: `556d8b4` (monorepo bootstrap T2~T5 13 커밋 + origin/main 머지 + hardening fix)
- origin/main 동기화 완료 (52 ahead, 0 behind)
- working tree clean (`.tmp_ecc/` untracked만)

**핵심 경로 (이전 saved context와 동일)**:
- 직전 saved context (P0 식별): `~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260522-094048-neko-monorepo-t2-t5-done-review-found-2-p0.md`
- 본 saved context: `~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260522-103757-neko-monorepo-p02-merged-hardening-fixed.md`
- 디자인 doc (APPROVED): `~/.gstack/projects/claude/dora-main-design-neko-restructure-20260521-095633.md`
- 테스트 plan: `~/.gstack/projects/claude/dora-main-eng-review-test-plan-20260521-095700.md`
- 12 tasks JSONL: `~/.gstack/projects/claude/tasks-eng-review-20260521-110117.jsonl`

**Gotchas**:
- SLUG: `D:/claude/harness` → `Ps-Neko-NEKOWORK`. `/context-restore` 진입 전 반드시 `cd D:/claude/harness`.
- `npm run` 절대 쓰지 말 것. monorepo 진입 후 모든 명령은 `pnpm` 또는 `pnpm --filter @ps-neko/nekowork run ...`. `pnpm -F nekowork-cli` 는 동작 안 함(필터 키는 패키지 이름 `@ps-neko/nekowork` 또는 `--filter @ps-neko/nekowork`).
- `pnpm -F nekowork-cli` 시도 시 "No projects matched the filters" 에러 나옴 → `--filter @ps-neko/nekowork` 또는 `--filter ./packages/nekowork-cli` 사용.
- `.github/` 는 monorepo root 유지 (GitHub Actions 표준). hardening fix 의 resolveEffectiveRoot 덕에 packages/nekowork-cli/ 컨텍스트에서 호출해도 root .github/ 워크플로우를 검사함.

**Open Questions (그대로 carry-over)**:
- forge-engine 패키지 이름: `nekoforge` 유지 vs `@ps-neko/forge-engine` 으로 rename? (이전 saved 의 INFORMATIONAL #2)
- T11 publish 시점 quality-core 함께 publish 여부 (현재 `private: true`)
- verify-pr feature(packages/nekowork-cli/scripts/orchestrators/verify-pr.js + 8 rules)를 monorepo에서 어떻게 노출? README/docs 업데이트 필요.

**/review 발견 carry-over** (직전 saved context 기준):
- **INFORMATIONAL #1** — version-consistency.test.js:46-48 lockfile bin 검증 약화. pnpm-lock.yaml v9 한계. 우회 검토 미진행.
- **INFORMATIONAL #2** — forge-engine 패키지 이름 `nekoforge` (위 Open Questions).
- **INFORMATIONAL #3** — supply-chain 검증이 lockfile 존재만 확인. **본 세션 부분 해소** (resolveEffectiveRoot로 lockfile 검색은 monorepo aware됨). `--frozen-lockfile` 게이트는 P0 #1 CI 수정 단계에서 적용 예정.
- **INFORMATIONAL #4** — security-hardening.js:232-241 `readAgentManifest` 세 번째 분기 의도 주석 권장 (미진행).
- **INFORMATIONAL #5** — packages/nekowork-cli/CLAUDE.md 와 root CLAUDE.md rebase 후 정합. 머지 자동 머지로 일관성 유지됨, 추가 정합 점검은 PR 작성 단계에서.

**세션 설정**: `checkpoint_mode=explicit`, `proactive=true`, `telemetry=off`, `repo_mode=collaborative`.

**다음 세션 진입 명령**:
```
cd D:/claude/harness && /context-restore
```
또는 직접:
```
cd D:/claude/harness && cat ~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260522-103757-neko-monorepo-p02-merged-hardening-fixed.md
```
