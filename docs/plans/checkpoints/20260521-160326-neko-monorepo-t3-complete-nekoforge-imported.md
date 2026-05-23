---
status: in-progress
branch: chore/monorepo-bootstrap
timestamp: 2026-05-21T16:03:26+09:00
files_modified: []
---

## Working on: NEKOWORK monorepo bootstrap (T3 완료, T4 대기)

### Summary

NEKOFORGE(D:/claude/nekoforge, 39 commits) history를 `packages/forge-engine/` 서브디렉토리 prefix로 재작성한 후 NEKOWORK monorepo(`chore/monorepo-bootstrap`)에 `--allow-unrelated-histories`로 머지. 충돌 0건, 새 merge commit `518f77a feat(monorepo): T3 import NEKOFORGE history into packages/forge-engine`. nekowork-cli 테스트 401/401 GREEN (12.19s, T2 회귀 없음). main 대비 50 커밋(T2 10 + T3 NEKOFORGE 39 + merge 1). working tree clean.

### Decisions Made

**도구**: `pip install git-filter-repo` (2.47.0) — Python 3.13.3 시스템 install. 격리 pipx 대신 시스템 pip 채택(빠른 진행 우선).

**T3 절차 (실행 완료)**:
1. `git clone --no-local D:/claude/nekoforge /tmp/nekoforge-mirror` — 39 commits, main branch
2. `git filter-repo --to-subdirectory-filter packages/forge-engine` — 0.61s 재작성 + 1.54s repack. origin remote는 filter-repo가 자동 제거 (안전장치)
3. `git remote add forge /tmp/nekoforge-mirror` + `git fetch forge`
4. `git merge --allow-unrelated-histories forge/main -m "feat(monorepo): T3 import NEKOFORGE history into packages/forge-engine"` — 충돌 0건, exit 0

**Cleanup (실행 완료)**: forge remote 제거, /tmp/nekoforge-mirror 삭제. monorepo에는 origin만 남음.

**검증 범위**: nekowork-cli 테스트만 실행 (401/401 GREEN, 12.19s). forge-engine 자체 테스트는 의존성 미설치 상태라 skip — T4에서 quality-core 분리하면서 같이 정리 예정.

**브랜치 전략**: T2 작업물(`chore/monorepo-bootstrap`) 위에 T3을 그대로 쌓음. main 대비 50 커밋 누적. T3을 별도 브랜치로 분리하지 않음 (사용자가 T4까지 같은 브랜치에서 계속 진행 의도로 해석).

### Remaining Work

1. **T4 — quality-core 최소 contract**: verdict + evidence schema 인터페이스만 `packages/quality-core/` 에 추출. forge-engine 구현, nekowork-cli 소비. forge-engine.
2. **T5 본 작업**: workspace:* protocol — quality-core/forge-engine을 nekowork-cli의 dependency로 추가 시 적용.
3. **T6/T7 — GHA dynamic matrix + pnpm cache**: 새 `.github/workflows/ci.yml`. `dorny/paths-filter@v3` + `actions/cache@v4`.
4. **T8 — forge-engine dynamic import**: `if (profile === 'forge') { const forge = await import('@ps-neko/forge-engine'); ... }` 패턴 (D10).
5. **T9 — 30초 perf regression fixture**: `fixtures/perf/sample-pr.diff` (50라인) + CI assertion `< 25s` (D8).
6. **T10 — Release/Compat verification**: `npm publish --dry-run` (packages/nekowork-cli 안에서), bin/exports/files 필드 검증, alpha.10→alpha.11 drop-in test (D13).
7. **T11 — Ship**: `@ps-neko/nekowork@0.2.0-alpha.0` publish + `npm deprecate "nekoforge@*" "moved to @ps-neko/nekowork"` + NEKOFORGE archive + README pointer.
8. **T12 (P3) — Register TODOS**: TS-MIGRATION, REACTION-COLLECTOR, RULE-PACK-DIR, NEKOFORGE-PR-INVENTORY (D14).
9. **D7 후속 PR — README rewrite**: monorepo 루트는 monorepo 소개 + 패키지별 README 분리.
10. **The Assignment**: 외부 개발자 5명 wedge 시도 메시지 발송 + reaction 수집.

### Notes

**핵심 산출물 경로**:
- 디자인 doc + lock-in: `~/.gstack/projects/claude/dora-main-design-neko-restructure-20260521-095633.md` (Status: APPROVED)
- 테스트 plan: `~/.gstack/projects/claude/dora-main-eng-review-test-plan-20260521-095700.md`
- 12 tasks JSONL: `~/.gstack/projects/claude/tasks-eng-review-20260521-110117.jsonl`
- 직전 T2 체크포인트: `~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260521-153944-neko-monorepo-t2-complete-t5-partial.md`
- 본 체크포인트 (Ps-Neko-NEKOWORK SLUG): `~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260521-160326-neko-monorepo-t3-complete-nekoforge-imported.md`

**커밋 히스토리** (main 대비 50 커밋, feature branch `chore/monorepo-bootstrap`):
- `518f77a feat(monorepo): T3 import NEKOFORGE history into packages/forge-engine` ← T3 merge commit
- `f1177b0 test(monorepo): T2.6 update tests + hardening fn for monorepo policy`
- `debb386 chore(monorepo): T5 add pnpm-lock.yaml after workspace install`
- `97d739f chore(monorepo): T5 remove root package-lock.json (pnpm migration)`
- `dee5eb3 chore(monorepo): T2.6-fix copy README to package`
- `e1dccc7 chore(monorepo): T2.4 root pnpm-workspace.yaml + private root package.json`
- `f333720 chore(monorepo): T2.3 expand .gitignore patterns`
- `0ef575e chore(monorepo): T2.3-E package.json git mv`
- `9076d82 chore(monorepo): T2.3-C 6 패키지 자산 git mv`
- `affc61f chore(monorepo): T2.3-B 7 루트 파일 git mv`
- `7c2770c chore(monorepo): T2.3-A 13 디렉토리 git mv`
- (T3 측 39 commits: `1d45dae feat(rule): placeholder 10 휴리스틱`부터 NEKOFORGE 초기 commit까지, prefix `packages/forge-engine/` 적용됨)

**packages/forge-engine 내부 구조** (T3 직후, NEKOFORGE 원본 그대로):
- src/, tests/, docs/, examples/, fixtures/
- package.json (`name: nekoforge`, `version: 0.5.0-alpha.0`, `private: true`)
- package-lock.json (npm — 추후 pnpm workspace로 통합 필요, T5)
- tsconfig.json, eslint.config.js, depcruise.config.cjs
- README.md, RELEASE-NOTES.md, GETTING-STARTED.md, TASKS.md, CONTRIBUTING.md
- .github/, .gitignore, .editorconfig (NEKOFORGE 측 사본)

**T4 시작 시 주의사항**:
- forge-engine 패키지의 .github/, .editorconfig 등은 monorepo 루트와 중복. .github/ 워크플로우는 NEKOWORK 측 우선 (체크포인트 노트와 일치). 중복 파일은 T4 또는 T6 정리.
- forge-engine/package-lock.json 은 npm 형식. pnpm workspace 통합 시 제거하고 루트 pnpm-lock.yaml에 흡수.
- forge-engine 자체 의존성 (ajv, ajv-formats, cli-table3, commander, picocolors)이 nekowork-cli와 겹칠 수 있음 — pnpm workspace는 hoist로 자동 처리.
- quality-core 추출 시 forge-engine의 verdict/evidence 타입을 packages/quality-core/src/types.ts 로 옮기고, forge-engine은 import해서 구현, nekowork-cli도 import해서 소비. workspace:* protocol은 quality-core 신설 + nekowork-cli dependency 추가 시 발효.

**T3 학습**:
- `git filter-repo --to-subdirectory-filter <path>`는 모든 commit을 `<path>/` 아래로 prefix. 빠름 (40 commits 2.15s). origin remote 자동 제거 (의도).
- `git merge --allow-unrelated-histories` + filter-repo'd source = 충돌 없는 디렉토리 prefix 머지. `packages/forge-engine/`는 NEKOWORK 측에 없으므로 새 파일 추가만 발생.
- `git filter-repo --version` 출력이 commit hash 같은 형식 (예: `a40bce548d2c`). 동작은 정상.
- /tmp는 일회용 미러 위치로 적합 (작업 후 rm -rf 안전).

**다음 세션 시작 시**: `/context-restore` 호출 → 본 파일 자동 로드. T4 진입 (quality-core 추출) 또는 T2+T3 PR 생성 결정.

**세션 설정**: `checkpoint_mode=explicit`, `proactive=true`, `telemetry=off`.
