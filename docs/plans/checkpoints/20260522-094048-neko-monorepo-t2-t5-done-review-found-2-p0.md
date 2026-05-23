---
status: blocked-on-2-p0
branch: chore/monorepo-bootstrap
timestamp: 2026-05-22T09:40:48+09:00
files_modified: []
---

## Working on: NEKOWORK monorepo bootstrap — T2~T5 완료, /review 결과 2 P0 발견, ship 전 정리 필요

### Summary

NEKOWORK(Ps-Neko/NEKOWORK)의 모노레포 전환 (T2 bootstrap + T3 NEKOFORGE history import + T4 quality-core contract + T5 workspace:* 와이어링)이 로컬 브랜치 `chore/monorepo-bootstrap` 에 13 커밋으로 완료된 상태. 직전 세션의 `/context-restore` → `/review` 흐름에서 P0 블로커 2건 발견. 코드 logic delta는 약 250 라인으로 깔끔하지만 (1) origin/main 16 커밋 미반영 + (2) CI 워크플로우가 monorepo 미반영 상태라 그대로 `/ship` 하면 즉시 CI RED. `/ship` 전 fresh 세션에서 origin merge + CI 수정 작업이 필요해 본 컨텍스트를 저장하고 종료.

### Decisions Made

**리뷰 범위**: 직전 saved checkpoint(2026-05-21 15:39) 이후 T3/T4/T5가 추가 커밋되어 PR이 T2~T5 통합 단위로 확장됨. 사용자 선택 C(`/review` 먼저)로 진행 → 2 P0 발견 → 사용자 선택 B(컨텍스트 저장 후 fresh 세션) 채택.

**/review에서 specialist subagent + Codex 모두 생략 결정**: diff가 712 파일 / 30,513 추가 / 1,579 삭제로 거대하지만 거의 대부분 rename + 생성된 pnpm-lock.yaml(2548줄) + filter-repo로 import한 NEKOFORGE 히스토리. 실제 리뷰 대상은 ~250 라인 (quality-core 200 + security-hardening.js +19/-3 + test 3건 + T5 type re-export 22/-39). specialist에 30K 라인 diff를 보내면 컨텍스트 폭발로 노이즈만 생성된다는 판단. 직접 점검으로 충분히 cover 됨.

**T6/T7 (GHA dynamic matrix + pnpm cache) 본 PR 흡수 vs 분리 결정 보류**: 본 saved context 이전엔 T6/T7가 "remaining work"로 deferred 였으나, /review 결과 기존 `.github/workflows/harness-validate.yml` + `harness-review.yml` 가 monorepo 미반영으로 CI가 즉시 RED 상태임을 확인. 본 PR 안에서 최소 워크플로우 수정은 필수.

**rebase vs merge 전략**: origin/main 16 커밋 + 100 신규 파일(`scripts/lib/*`, `scripts/orchestrators/verify-pr.js`, fixtures)이 모노레포 미반영. `git rebase` 시 cherry-pick 16번 충돌 vs `git merge origin/main` 시 단일 충돌 해결. **merge 추천** (덜 고통스러움).

### Remaining Work (다음 세션 진입 순서)

1. **origin/main 머지** (대규모 충돌 예상 — fresh 컨텍스트 필수)
   - `cd D:/claude/harness && git checkout chore/monorepo-bootstrap`
   - `git fetch origin main`
   - `git merge origin/main` (rename 추적 활성: `merge.renames = true`)
   - 16 rename/modify 충돌: `CLAUDE.md`, `VERSION`, `WORKING-CONTEXT.md`, `agent.yaml`, `docs/{ADVANCED,ARCHITECTURE,CHANGELOG,DEMO,GUIDED-MODE,PORTING,SETUP}.md`, `docs/assets/demo-terminal.svg`, `package.json`, `scripts/cli.js`, `tests/integration/cli-output.test.js`, `tests/unit/version-consistency.test.js` — 모두 origin 변경분을 `packages/nekowork-cli/` 측 사본에 반영
   - origin/main 신규 100 파일 (`scripts/lib/`, `scripts/orchestrators/`, `tests/fixtures/auto-apply-commit-push/*` 등)을 `packages/nekowork-cli/scripts/...` 로 이동 (monorepo 정책)
   - 충돌 해결 후 단일 머지 커밋

2. **CI 워크플로우 monorepo aware 재작성** (P0 — 본 PR 내 필수)
   - `.github/workflows/harness-validate.yml`:
     - L51 `cache: npm` → `pnpm/action-setup` + `cache: 'pnpm'`
     - L70 `npm ci` → `pnpm install --frozen-lockfile`
     - L74-80 `node scripts/install-plan.js` 등 → `pnpm -F nekowork-cli run ci:install-plan` 또는 직접 `node packages/nekowork-cli/scripts/...`
     - L83 `npm run security:hardening` → `pnpm -F nekowork-cli run security:hardening`
     - L86 `npm test` → `pnpm -r run test`
     - L88 `npm audit` → `pnpm audit --audit-level=moderate`
     - L92-97 build scripts → `pnpm -F nekowork-cli run build:*`
   - `.github/workflows/harness-review.yml`: 동일 패턴 (L51/54/58-60/63/109)
   - 가능하면 `paths-filter` 로 forge-engine/quality-core 변경 시에만 해당 패키지 빌드 (T6 dynamic matrix 일부 흡수)

3. **로컬 검증**
   - `pnpm install --frozen-lockfile`
   - `pnpm -r run test` (nekowork-cli 401 + forge-engine 292 + quality-core 7 = 700 GREEN 확인)
   - `pnpm -r run typecheck`
   - `pnpm -r run lint`
   - `pnpm -F nekowork-cli run security:hardening`
   - `pnpm audit --audit-level=moderate`

4. **`/ship` 시작 가능 상태 도달 후**: PR 작성. PR body에 본 컨텍스트 + /review 발견 informational 5건 + T6/T7 흡수 범위 + T8~T12 deferred 명시.

### /review 발견 (다음 세션에서 참조)

**P0 #1 — CI 워크플로우 깨짐**: 위 #2 작업으로 해결.

**P0 #2 — origin/main 16 커밋 미반영**: 위 #1 작업으로 해결.

**INFORMATIONAL #1** — `packages/nekowork-cli/tests/unit/version-consistency.test.js:46-48` lockfile bin 검증 약화. pnpm-lock.yaml v9가 bin 정보를 저장 안 해 우회 불가피. 후속에서 `pnpm pack --dry-run` 출력 파싱으로 bin 검증 추가 검토.

**INFORMATIONAL #2** — `packages/forge-engine/package.json:2` 패키지 이름이 `nekoforge` (예전 이름). saved context의 T11 plan은 `@ps-neko/nekowork@0.2.0-alpha.0` publish + `nekoforge@*` deprecate. forge-engine을 `@ps-neko/forge-engine` 으로 rename할지, 아니면 publish 시점에 deprecate할지 결정 필요. 현재 `private: true` 라 publish 위험은 없음.

**INFORMATIONAL #3** — `packages/nekowork-cli/scripts/ci/security-hardening.js:170-178` supply-chain 검증이 lockfile 존재만 확인. lockfile integrity hash 검증(`pnpm install --frozen-lockfile`) 게이트는 CI에 부재. T6 GHA 재작성 시 `--frozen-lockfile` 추가 필수.

**INFORMATIONAL #4** — `packages/nekowork-cli/scripts/ci/security-hardening.js:232-241` `readAgentManifest` 세 번째 분기 의도 주석 권장 (`// neither path exists → log a clear error via readYaml`).

**INFORMATIONAL #5** — `packages/nekowork-cli/CLAUDE.md` 와 root `CLAUDE.md` rebase 후 정합 필요 (origin/main 측 수정 + 이 브랜치 측 rename 분기).

### Notes

**핵심 경로**:
- 직전 checkpoint (T2 complete, T5 partial): `~/.gstack/projects/claude/checkpoints/20260521-153944-neko-monorepo-t2-complete-t5-partial.md`
- 본 checkpoint (T2~T5 complete, 2 P0 발견): `~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260522-094048-neko-monorepo-t2-t5-done-review-found-2-p0.md`
- 디자인 doc (APPROVED): `~/.gstack/projects/claude/dora-main-design-neko-restructure-20260521-095633.md`
- 테스트 plan: `~/.gstack/projects/claude/dora-main-eng-review-test-plan-20260521-095700.md`
- 12 tasks JSONL: `~/.gstack/projects/claude/tasks-eng-review-20260521-110117.jsonl`

**13 커밋 히스토리 (main 대비, top → bottom)**:
```
3cd4327 T5 wire forge-engine ← @ps-neko/quality-core (workspace:*)
fbd438d T4 add @ps-neko/quality-core contract package
518f77a T3 import NEKOFORGE history into packages/forge-engine
f1177b0 T2.6 update tests + hardening fn for monorepo policy
debb386 T5 add pnpm-lock.yaml after workspace install
97d739f T5 remove root package-lock.json (pnpm migration)
dee5eb3 T2.6-fix copy README.{md,ko.md} to package (D7 rewrite TODO)
e1dccc7 T2.4 add root pnpm-workspace.yaml + private root package.json
f333720 T2.3 expand .gitignore patterns to glob for packages/*
0ef575e T2.3-E move package.json to packages/nekowork-cli/
9076d82 T2.3-C move 6 package assets to packages/nekowork-cli/
affc61f T2.3-B move 7 root files (files field) to packages/nekowork-cli/
7c2770c T2.3-A move 13 directories to packages/nekowork-cli/
```

**origin/main 측 신규 16 커밋 요약** (rebase/merge 대상):
- `560fcde` ~ `6a0e862` (5건): alpha.11 publish + CI 핫픽스 + 정합 docs
- `b4c86aa` ~ `9a31601` (2건): VISION 12-station factory + alpha.10 cleanup
- `5f27921` ~ `90192fb` (3건): alpha.11 운영 docs
- `c8f55bd` ~ `160c1ff` (6건): **verify-pr feature** (1.0 검증 게이트 + 5 deterministic rules + diff-parser/project-detector + Auto-Apply-Commit-Push rule + Secret Fallback rule + 베이스 모듈 등)

**상태**:
- working tree clean (`.tmp_ecc/` untracked만)
- `node 24.14.0`, pnpm 10.33.0
- packages/: `nekowork-cli/`, `forge-engine/`, `quality-core/`
- pnpm-lock.yaml importers: `.`, `packages/forge-engine` (`@ps-neko/quality-core: workspace:link`), `packages/nekowork-cli`, `packages/quality-core`
- 직전 세션 테스트: 401/401 GREEN (T5 머지 후 forge-engine 292/292 + nekowork-cli 401/401 도 GREEN 보고됨, but T5 와이어링 후 재실행은 아직)

**Gotchas**:
- SLUG: D:/claude → `claude`, D:/claude/harness → `Ps-Neko-NEKOWORK`. **본 checkpoint는 Ps-Neko-NEKOWORK SLUG에 저장**. `/context-restore` 호출 시 cwd가 D:/claude(메타)면 본 파일이 안 보임 → `cd D:/claude/harness` 먼저.
- `npm run` 절대 쓰지 말 것. monorepo 진입 후 모든 명령은 `pnpm` 또는 `pnpm -F nekowork-cli run ...` 패턴.
- merge 충돌 해결 시 `.github/` 는 monorepo root에 유지 (GitHub Actions 표준).
- `agent.yaml`은 `packages/nekowork-cli/` 에만 있음 (root에 없음 → security-hardening.js의 `readAgentManifest` 폴백 로직 의존).
- `import.meta.url` 기반 ROOT 해상도가 정상 (`scripts/cli.js:23-24`).
- pnpm-lock.yaml v9는 bin 정보를 저장 안 함.

**Open Questions** (Day 1):
- forge-engine 패키지 이름: `nekoforge` 유지 vs `@ps-neko/forge-engine` 으로 rename?
- T11 publish 시점 quality-core 함께 publish 여부 (현재 `private: true`)
- verify-pr feature(origin/main의 16커밋 일부)를 monorepo에서 어디로 이동? `packages/nekowork-cli/scripts/lib/rules/*` 가 자연스럽지만 확인 필요

**세션 설정**: `checkpoint_mode=explicit`, `proactive=true`, `telemetry=off`, `repo_mode=collaborative`.

**다음 세션 진입 명령** (cwd 무관):
```
cd D:/claude/harness && /context-restore
```
또는 직접:
```
cd D:/claude/harness && cat ~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260522-094048-neko-monorepo-t2-t5-done-review-found-2-p0.md
```
