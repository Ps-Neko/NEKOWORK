---
status: in-progress
branch: chore/monorepo-bootstrap
timestamp: 2026-05-21T15:39:44+09:00
session_duration_s: 6692
files_modified: []
---

## Working on: NEKOWORK monorepo bootstrap (T2 완료, T5 부분 완료, T3 대기)

### Summary

NEKOWORK(Ps-Neko/NEKOWORK)을 단일 monorepo 구조로 전환하는 T2(monorepo bootstrap)와 T5의 일부(pnpm workspace install + lockfile 전환)를 완료. `packages/nekowork-cli/` 패키지가 자체 의존성·테스트·빌드 산출물을 보유한 워크스페이스 멤버로 안착. 모노레포 루트는 `pnpm-workspace.yaml` + private `package.json` + 공통 `.github` `/README` `/LICENSE`만 보유. **401/401 테스트 GREEN** (11.75s). main 대비 10 커밋, feature branch `chore/monorepo-bootstrap` 상태로 동결.

### Decisions Made

**T2.0 파일 분류 (사용자 승인 완료)**:
- `packages/nekowork-cli/` 로 이동: 13개 디렉토리(files 필드 11개 + tests/ + runtime/) + 7개 루트 파일(agent.yaml SOUL.md RULES.md CLAUDE.md AGENTS.md WORKING-CONTEXT.md REVIEW.md) + 6개 추가 자산(tsconfig.json VERSION install.sh install.ps1 .env.example .mcp.json) + package.json
- 루트 유지: README.md README.ko.md LICENSE CODE_OF_CONDUCT.md CONTRIBUTING.md SECURITY.md .gitignore .gitattributes .editorconfig .github/ .harness/
- 빌드 산출물 (.claude/ .codex/ .cursor/ .gemini/ .opencode/ .claude-plugin/): git untracked, T5 이후 `npm run build:claude` 등 재실행으로 패키지 안에 자동 생성. git mv 불필요 (묶음 D skip).

**T2.6 README 결정 번복**: 직전 T2.0 결정 "README 루트만 유지"를 일부 번복. baseline 테스트(`tests/unit/version-consistency.test.js`)가 패키지 안 README 직접 lookup → 패키지에도 사본 두기로 결정. D7 rewrite 시 명시적 분리 워크플로우로 처리 예정.

**T2.6 사용자 결정 (테스트 update vs known-fail 문서화)**: T2 안에서 테스트·security-hardening 함수 update 채택. 5개 fail은 monorepo migration의 의도된 정책 변경(.github 루트 격상 + pnpm lockfile 전환) 결과로, T2 PR 안에서 일관되게 처리.

**T2.6 version-consistency 검증 방식**: pnpm-lock.yaml 기반 검증(importer entry 확인) + package.json bin 자체 검증. pnpm-lock.yaml v9는 npm 스타일 `packages[''].bin` 구조 없음 (bin 정보 lockfile에 저장 안 함).

**브랜치명**: `chore/monorepo-bootstrap` (conventional commits, 기능 추가 아닌 구조 변경).

**T5 부분 흡수 (D4)**: pnpm install로 packages/nekowork-cli/node_modules 자동 생성 + pnpm-lock.yaml 새로 만듦. pnpm 10.33.0 사용. workspace 인식 (`@ps-neko/nekowork-monorepo` + `@ps-neko/nekowork` 2 packages). T5 본 작업의 workspace:* protocol 적용은 quality-core/forge-engine 패키지 추가 후 후속.

### Remaining Work

1. **T3 — NEKOFORGE history import (destructive)**: 새 fresh context에서 시작 권장. 단계:
   - `git clone --no-local D:/claude/nekoforge /tmp/nekoforge-mirror` (또는 mirror 위치)
   - `cd /tmp/nekoforge-mirror && git filter-repo --to-subdirectory-filter packages/forge-engine`
   - NEKOWORK monorepo에서: `git remote add forge /tmp/nekoforge-mirror && git fetch forge && git merge --allow-unrelated-histories forge/<main>`
2. **T4 — quality-core 최소 contract**: verdict + evidence schema 인터페이스만 `packages/quality-core/` 에 추출. forge-engine 구현, nekowork-cli 소비. 구현은 forge-engine.
3. **T5 본 작업**: workspace:* protocol — quality-core/forge-engine을 nekowork-cli의 dependency로 추가 시 적용.
4. **T6/T7 — GHA dynamic matrix + pnpm cache**: 새 `.github/workflows/ci.yml`. `dorny/paths-filter@v3` + `actions/cache@v4` (keyed by `hashFiles('pnpm-lock.yaml')`).
5. **T8 — forge-engine dynamic import**: `if (profile === 'forge') { const forge = await import('@ps-neko/forge-engine'); ... }` 패턴 (D10).
6. **T9 — 30초 perf regression fixture**: `fixtures/perf/sample-pr.diff` (50라인) + CI assertion `< 25s` (D8).
7. **T10 — Release/Compat verification**: `npm publish --dry-run` (packages/nekowork-cli 안에서), bin/exports/files 필드 검증, alpha.10→alpha.11 drop-in test (D13).
8. **T11 — Ship**: `@ps-neko/nekowork@0.2.0-alpha.0` publish + `npm deprecate "nekoforge@*" "moved to @ps-neko/nekowork"` + NEKOFORGE archive + README pointer.
9. **T12 (P3) — Register TODOS**: TS-MIGRATION, REACTION-COLLECTOR, RULE-PACK-DIR, NEKOFORGE-PR-INVENTORY (D14).
10. **D7 후속 PR — README rewrite**: monorepo 루트는 monorepo 소개 + 패키지별 README 분리. 현재 사본은 임시.
11. **The Assignment**: 외부 개발자 5명 wedge 시도 메시지 발송 + reaction 수집.

### Notes

**핵심 산출물 경로**:
- 디자인 doc + lock-in: `~/.gstack/projects/claude/dora-main-design-neko-restructure-20260521-095633.md` (Status: APPROVED)
- 테스트 plan: `~/.gstack/projects/claude/dora-main-eng-review-test-plan-20260521-095700.md`
- 12 tasks JSONL: `~/.gstack/projects/claude/tasks-eng-review-20260521-110117.jsonl`
- 직전 checkpoint: `~/.gstack/projects/claude/checkpoints/20260521-111539-neko-monorepo-migration-t1-done-t2-pending.md`
- 본 checkpoint (NEKOWORK SLUG): `~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260521-153944-neko-monorepo-t2-complete-t5-partial.md`

**커밋 히스토리** (main 대비 10 커밋, feature branch `chore/monorepo-bootstrap`):
- `7c2770c` T2.3-A 13 디렉토리 git mv
- `affc61f` T2.3-B 7 루트 파일 git mv (files 필드)
- `9076d82` T2.3-C 6 패키지 자산 git mv (tsconfig VERSION install.sh install.ps1 .env.example .mcp.json)
- `0ef575e` T2.3-E package.json git mv
- `f333720` T2.3 .gitignore glob 패턴 확장 (`**/docs/dev-log/` 등)
- `e1dccc7` T2.4 pnpm-workspace.yaml + private root package.json
- `dee5eb3` T2.6-fix README 패키지 사본 (D7 rewrite TODO)
- `97d739f` T5 package-lock.json 제거
- `debb386` T5 pnpm-lock.yaml 추가 (workspace install)
- `f1177b0` T2.6 테스트·security-hardening 함수 monorepo policy 반영

**Gotchas**:
- SLUG는 cwd에 따라 바뀜. D:/claude 메타에서는 `claude`, D:/claude/harness 진입 시 `Ps-Neko-NEKOWORK`. 직전 세션 체크포인트는 `claude` SLUG 경로에. 본 체크포인트는 `Ps-Neko-NEKOWORK` SLUG 경로에 저장. /context-restore 시 양 경로 확인 필요할 수 있음.
- `import.meta.url` 기반 ROOT 해상도(`scripts/cli.js:23-24`, `scripts/core/build-roots.js`) 덕분에 cli + 빌드 스크립트 모두 패키지 안에서 정상 작동. process.cwd() 의존 없음.
- 빌드 산출물 `.claude/ .codex/ ...` 디렉토리는 .gitignore에 있음 (라인 6-12). monorepo로 격상하면서 글로블 패턴 추가(`**/.claude/` 등).
- 패키지 안 `npm test`는 Node 모듈 해상도가 상위 `node_modules` 까지 탐색해 OK. e2e SANDBOX 격리 시에만 패키지 내 node_modules 필요.
- `tests/e2e/review-cycle.test.js:29`는 `path.join(ROOT, 'node_modules')` 심볼릭 링크 시도. 패키지 안 node_modules 부재 시 빈 SANDBOX → CLI 의존성 못 찾아 status 1.
- `tests/e2e/review-cycle.test.js:16-17` SANDBOX 복사 로직은 `.gitignore`/`.mcp.json` 빼고 dotfile skip. 따라서 SANDBOX에 `.env.example` 도 안 들어감(테스트 영향 없음).
- pnpm-lock.yaml v9는 bin 정보를 lockfile에 저장 안 함. supply chain 검증은 importer entry로 우회.
- `.github/`는 monorepo 루트에 유지(GitHub Actions 표준). 테스트는 `MONOREPO_ROOT = path.resolve(ROOT, '..', '..')` 헬퍼로 접근.
- `agent.yaml`은 패키지 안에 유지. `checkSecurityHardening` 함수는 root에 없으면 `packages/nekowork-cli/agent.yaml` 폴백 (monorepo aware).

**T2.6 패치 5건 (`f1177b0`)**:
- `tests/e2e/feedback-triage-doc.test.js`: MONOREPO_ROOT 헬퍼, .github lookup 3곳 변경
- `tests/unit/security-hardening.test.js`: MONOREPO_ROOT 헬퍼, `checkSecurityHardening(MONOREPO_ROOT)` 호출
- `tests/unit/version-consistency.test.js`: lock 검증을 pnpm-lock.yaml importer entry로 교체
- `scripts/ci/security-hardening.js`: lockfile 정책에 pnpm-lock.yaml 허용 추가
- `scripts/ci/security-hardening.js`: `readAgentManifest` 헬퍼 — monorepo면 packages/nekowork-cli/agent.yaml 폴백

**T3 시작 시 사전 점검**:
- working tree clean (chore/monorepo-bootstrap, .tmp_ecc/ untracked만)
- `node --version` ≥ 22 (현재 24.14.0)
- pnpm 10.33.0 사용 가능
- D:/claude/nekoforge 경로 확인 (NEKOFORGE local clone 위치)
- git filter-repo 설치 확인 (`pip install git-filter-repo` 또는 `pipx install git-filter-repo`)
- merge `--allow-unrelated-histories` 충돌 가능성: `packages/forge-engine/` 디렉토리는 NEKOFORGE 측에서만 존재하므로 충돌 없음 예상

**Open Questions** (Day 1 inventory 단계):
- quality-core ↔ forge-engine 모듈 매핑 inventory
- 5-user wedge test reaction 수집 메커니즘 (GitHub issue template? Form? DM?)
- REPORT.md / decision.json / quality-score.json schema ownership
- Rule Pack 13 / Skill Pack 13 forge-engine 내부 디렉토리 구조
- NEKOFORGE archive 전 미해결 PR 인벤토리

**세션 설정**: `checkpoint_mode=explicit`, `proactive=true`, `telemetry=off`.

**다음 세션 시작 시**: `/context-restore` 호출 → 본 파일 자동 로드. T3 진입 또는 PR 올리기 결정.
