---
status: in-progress
branch: chore/monorepo-bootstrap
timestamp: 2026-05-21T17:05:43+09:00
files_modified: []
---

## Working on: NEKOWORK monorepo — T4 (quality-core contract) + T5 (forge-engine wiring) 완료

### Summary

NEKOWORK monorepo의 quality-core 인터페이스 추출과 forge-engine ← quality-core workspace:* 의존 와이어링을 한 세션에서 완료. 디자인 doc의 "single source of truth" 원칙대로 verdict + evidence type contract를 `@ps-neko/quality-core` 가 정의하고 forge-engine은 구현만 보유. **main 대비 13 커밋**, `chore/monorepo-bootstrap` 브랜치에서 동결. **quality-core 7/7, forge-engine 292/292, nekowork-cli 401/401 GREEN**. 다음은 T6/T7(CI 재작성) + T9(perf 회귀) 묶음 또는 PR 정리.

### Decisions Made

**T3 검증 (체크포인트 인용 격차 해소)**:
- 직전 체크포인트는 T3를 "남은 작업"으로 표기했으나 실제로는 `518f77a feat(monorepo): T3 import NEKOFORGE history into packages/forge-engine` 가 이미 커밋된 상태였음. merge commit (`Merge: f1177b0 1d45dae`) 으로 369 파일 전부 `packages/forge-engine/` 하위에 격리. 루트 트리 미오염 확인.
- T3 import 직후에도 nekowork-cli 401/401 GREEN, security-hardening 정책 위반 없음 (root pnpm-lock.yaml 존재).

**T4 — quality-core 추출 범위 (인터페이스 only, 구현은 forge-engine)**:
- `packages/quality-core/src/evidence.ts`: `Severity`, `RuleFinding`, `ReviewSnapshot`
- `packages/quality-core/src/verdict.ts`: `Verdict`, `RiskLevel`, `VerdictInputs`, `VerdictOutput`
- `packages/quality-core/src/index.ts`: barrel re-export (`export type { ... }`)
- 의도적 제외 (forge-engine 유지): `computeVerdict()` 구현, `PolicyFlags`/`RuleContext`/`DeterministicRule`/`makeFinding`, ajv 스키마 12종
- 패키지명 `@ps-neko/quality-core`, `private: true` (workspace internal, npm publish 차단)
- tsconfig: declaration + declarationMap emit, target ES2022, module ESNext, strict
- type test (`tests/types.test.ts`): `AssertEqual<T, U>` 헬퍼로 컴파일 타임 contract 강제. 7/7 PASS, 377ms.

**T5 — forge-engine ← quality-core wiring (보수적 단방향)**:
- `packages/forge-engine/package.json` 에 `"@ps-neko/quality-core": "workspace:*"` 추가 (pnpm workspace protocol)
- `src/core/gate/verdict.ts`: 자체 type 정의 4개 제거 → quality-core import + `export type { ... }` re-export. `computeVerdict()` 구현은 유지.
- `src/rules/types.ts`: `Severity`/`RuleFinding`/`ReviewSnapshot` 자체 정의 제거 → quality-core import + re-export. `PolicyFlags`/`RuleContext`/`DeterministicRule`/`makeFinding`는 forge-engine 내부 contract로 유지.
- 다른 10개 소비 파일(`benchmark/index.ts`, `cli/commands/{apply,memory,report}.ts`, `core/{memory,report}/index.ts`, `scoring/index.ts`, `schemas/eval-case.schema.ts` 등)은 relative import 패턴 유지 — re-export로 동일 type을 보게 됨. 변경 면적 최소화.
- 결과: forge-engine 22 추가 / 39 삭제 (net 17줄 감소).

**T5 의도적 범위 외 (별도 TODO로 보존)**:
- nekowork-cli ← forge-engine 의존 추가는 본 세션에서 와이어링 안 함. nekowork-cli는 `.js` 기반이라 type level에서 quality-core를 직접 소비할 수 없고, forge-engine 코드를 import하지도 않음 (현재 `@ps-neko/nekowork` 문자열 매칭만 존재). TS-MIGRATION TODOS + T8 (forge-engine dynamic import) 와 묶어서 처리 예정.

**T4/T5 검증**:
- `pnpm install` → "Scope: all 4 workspace projects" (root + nekowork-cli + forge-engine + quality-core)
- `packages/forge-engine/node_modules/@ps-neko/quality-core@` symlink 생성 확인
- `pnpm -F nekoforge typecheck` → tsc PASS (no error)
- `pnpm -F nekoforge test` → **292/292 PASS** (10.9s)
- `pnpm -F @ps-neko/nekowork test` → **401/401 PASS** (12.6s, 회귀 0)
- `pnpm -F @ps-neko/quality-core build` → dist/ 12 파일 emit (.js + .d.ts + sourcemap), index.js는 `export {};` (type-only 올바르게 emit)

### Remaining Work

1. **T6/T7 — GHA dynamic matrix + pnpm cache** (CC ~30분): 새 `.github/workflows/ci.yml`. `dorny/paths-filter@v3` 로 변경된 패키지만 빌드/테스트. `actions/cache@v4` 키: `hashFiles('pnpm-lock.yaml')`. matrix: nekowork-cli, forge-engine, quality-core 3개 패키지.
2. **T9 — 30초 perf regression fixture** (CC ~30분, D8): `fixtures/perf/sample-pr.diff` (50라인) + CI assertion `nekowork check` 실행시간 `< 25s` (README "30-second gate" headline 회귀 방지).
3. **PR 정리** — 13 커밋 `chore/monorepo-bootstrap` → main PR. `/ship` 워크플로우. T6/T7/T9 묶어서 한 PR로 갈지, T4/T5만으로 먼저 PR 갈지 결정 필요.
4. **T8 — forge-engine dynamic import** (D10): `nekowork check --profile forge` 시 `const forge = await import('@ps-neko/forge-engine')` 패턴. nekowork-cli가 `.js` 기반이라 dynamic import는 runtime 가능. type 측면은 jsdoc 또는 별도 TS-MIGRATION.
5. **T10 — Release/Compat verification**: `npm publish --dry-run` (packages/nekowork-cli 안에서), bin/exports/files 필드 검증, alpha.10→alpha.11 drop-in test (D13).
6. **T11 — Ship**: `@ps-neko/nekowork@0.2.0-alpha.0` publish + `npm deprecate "nekoforge@*" "moved to @ps-neko/nekowork"` + NEKOFORGE archive + README pointer.
7. **T12 (P3) — Register TODOS** (D14): TS-MIGRATION, REACTION-COLLECTOR, RULE-PACK-DIR, NEKOFORGE-PR-INVENTORY.
8. **D7 후속 PR — README rewrite**: monorepo 루트는 monorepo 소개 + 패키지별 README 분리. 현재 사본은 임시.
9. **위생 정리**: `packages/forge-engine/package-lock.json` (96KB, T3 import 시 따라온 npm lockfile) stale 제거. monorepo 표준은 root `pnpm-lock.yaml` 단일.
10. **forge-engine 패키지명 변경**: `nekoforge` → `@ps-neko/forge-engine` (디자인 doc 결정). T11 직전 또는 T8 와이어링 시 일괄 변경.
11. **The Assignment**: 외부 개발자 5명 wedge 시도 메시지 발송 + reaction 수집.

### Notes

**핵심 산출물 경로**:
- 디자인 doc + lock-in: `~/.gstack/projects/claude/dora-main-design-neko-restructure-20260521-095633.md` (Status: APPROVED)
- 테스트 plan: `~/.gstack/projects/claude/dora-main-eng-review-test-plan-20260521-095700.md`
- 12 tasks JSONL: `~/.gstack/projects/claude/tasks-eng-review-20260521-110117.jsonl`
- 직전 체크포인트 (T2 완료 시점): `~/.gstack/projects/Ps-Neko-NEKOWORK/checkpoints/20260521-153944-neko-monorepo-t2-complete-t5-partial.md`
- T4 커밋: `fbd438d chore(monorepo): T4 add @ps-neko/quality-core contract package`
- T5 커밋: `3cd4327 chore(monorepo): T5 wire forge-engine ← @ps-neko/quality-core (workspace:*)`

**main 대비 13 커밋** (`chore/monorepo-bootstrap`):
- `3cd4327` T5 forge-engine ← quality-core (workspace:*)
- `fbd438d` T4 quality-core contract package
- `518f77a` T3 NEKOFORGE history import (merge commit)
- `f1177b0` T2.6 테스트·security-hardening monorepo policy
- `debb386` T5 pnpm-lock.yaml 추가
- `97d739f` T5 root package-lock.json 제거
- `dee5eb3` T2.6-fix README 패키지 사본 (D7 rewrite TODO)
- `e1dccc7` T2.4 pnpm-workspace.yaml + private root package.json
- `f333720` T2.3 .gitignore glob 패턴 확장
- `0ef575e` T2.3-E package.json git mv
- `9076d82` T2.3-C 6 패키지 자산 git mv
- `affc61f` T2.3-B 7 루트 파일 git mv
- `7c2770c` T2.3-A 13 디렉토리 git mv

**Gotchas**:
- SLUG는 cwd에 따라 바뀜. D:/claude 메타에서는 `claude`, D:/claude/harness 진입 시 `Ps-Neko-NEKOWORK`. 본 체크포인트는 NEKOWORK SLUG 경로에 저장. `/context-restore` 시 양 경로 확인 필요.
- pnpm workspace는 `@ps-neko/quality-core` 같은 dependency 이름으로 패키지를 찾음 — 패키지 디렉토리명(`packages/quality-core/`)이 아닌 package.json `name` 필드 기준.
- TypeScript는 동일 모듈에서 `export type { Foo }` re-export + 동일 이름 `interface Foo` 자체 선언 시 충돌. T5 작업 중 `rules/types.ts`의 `ReviewSnapshot` 자체 정의 제거 필요했음.
- forge-engine `package.json` name이 아직 `nekoforge` (패키지명 미변경). pnpm filter는 `-F nekoforge` 로 호출. `@ps-neko/forge-engine` 으로 rename은 디자인 doc 결정사항이지만 T11 직전 일괄 진행.
- quality-core `dist/index.js` 는 type-only 패키지라 `export {};` 만 emit. 정상이며 `.d.ts` 만 실제 contract.
- forge-engine 빌드 산출물 `.claude/ .codex/ ...` 디렉토리는 .gitignore에 있음 (라인 6-12). monorepo 글로블 패턴(`**/.claude/` 등).
- nekowork-cli 빌드 산출물(`.claude/.codex/...`) 재생성은 패키지 안 `npm run build:claude` 등. `prepack` hook으로 publish 시 자동.

**T6/T7 시작 시 사전 점검**:
- working tree clean (chore/monorepo-bootstrap, .tmp_ecc/ untracked만)
- `.github/workflows/` 디렉토리 현황 확인 (forge-engine import 시 `packages/forge-engine/.github/workflows/test.yml` 가 들어왔는데 이는 monorepo CI와 별도)
- monorepo CI는 root `.github/workflows/` 에 작성. `packages/forge-engine/.github/`은 GitHub Actions 인식 안 함 (루트만).
- pnpm cache 키 후보: `hashFiles('pnpm-lock.yaml')` + node version.
- 변경 감지: `dorny/paths-filter@v3` 으로 `packages/{nekowork-cli,forge-engine,quality-core}` 별 필터.

**Open Questions** (Day 1 inventory 단계, 여전히 미결):
- forge-engine 안의 rule-packs/skill-packs 디렉토리 구조 — forge-engine 내부 유지 vs 별도 `@ps-neko/nekowork-pack-*` plug-in publish (디자인 doc 결정: monorepo merge 범위 외)
- REPORT.md / decision.json / quality-score.json schema ownership — quality-core (인터페이스) vs forge-engine (구현)
- 5-user wedge test reaction 수집 메커니즘 (GitHub issue template? Form? DM?)
- NEKOFORGE archive 전 미해결 PR 인벤토리

**세션 설정**: `checkpoint_mode=explicit`, `proactive=true`, `telemetry=off`.

**다음 세션 시작 시**: `/context-restore` 호출 → 본 파일 자동 로드. T6/T7+T9 묶음으로 진행 권장 (캐시 TTL 보전, CI + perf 회귀 한 PR로 정리 가능). 단독 PR 우선이면 13 커밋 그대로 `/ship`.
