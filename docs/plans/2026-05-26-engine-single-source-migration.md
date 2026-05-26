# 헤비 엔진 단일 소스화 (Engine Single-Source) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (또는 subagent-driven-development) 로 task 단위 실행. Steps 는 체크박스(`- [ ]`) 추적.

**Goal:** monorepo(`REPO_ROOT`)에서 중복된 헤비 엔진 `packages/forge-engine` 과 그 타입-전용 패키지 `packages/quality-core` 를 제거하여, standalone `~/NEKOFORGE` 를 헤비 제품의 **단일 소스**로 확정한다. 라이트 제품 `packages/nekowork-cli` 는 영향받지 않는다.

**Architecture:** 조사로 확정한 사실 — (1) `nekowork-cli` 는 `forge-engine` 을 import/의존하지 않음(별도 scripts/agent.yaml 기반). (2) `quality-core` 는 `forge-engine` 만 쓰는 타입 패키지(3파일: evidence/index/verdict.ts), 타 사용처 0. (3) standalone `NEKOFORGE` 는 quality-core 타입을 로컬(`src/rules/types.ts`)로 내장해 자립 + auto-factory(9파일) + 최신 수정(395c967 `firstHash`)을 모두 보유한 **superset**. (4) `visualizer` 는 두 패키지를 import 하지 않음(grep 0, fixture 기반). 따라서 두 패키지 디렉토리 삭제 + CI job 제거만으로 monorepo 는 "라이트 전용"이 되고 헤비는 standalone 단일화된다. **역포트(이식) 불필요** — standalone 이 이미 최신이라 monorepo 쪽은 순수 제거.

**Tech Stack:** pnpm workspace(`packages/*` 글롭), TypeScript, GitHub Actions(`.github/workflows/harness-validate.yml`).

**위험/되돌리기:** 두 공개 레포 위상 변경. monorepo 변경은 PR + CI 로 게이트(되돌리기 = PR revert). standalone 은 무변경이라 위험 0.

---

## File Structure

| 액션 | 경로 | 책임/비고 |
|---|---|---|
| Delete | `packages/forge-engine/` | 헤비 엔진 중복본 (standalone 이 superset) |
| Delete | `packages/quality-core/` | forge-engine 전용 타입 패키지, 타 사용처 0 |
| Modify | `.github/workflows/harness-validate.yml` | `changes` 필터의 forge/quality 제거, `validate-quality`·`validate-forge` job 삭제, `validate-all` 집계에서 quality/forge 제거 |
| Auto | `pnpm-lock.yaml` | `pnpm install` 로 자동 갱신 |
| Verify→Modify | `README.md`, `README.ko.md`, `.claude/CLAUDE.md` | forge-engine/quality-core 언급 있으면 정리 (grep 후) |
| 무변경 | `packages/nekowork-cli/` | 라이트, forge-engine 미사용 |
| 무변경 | `pnpm-workspace.yaml` | `packages/*` 글롭 — 디렉토리 삭제로 자동 정리 |
| 무변경 | standalone `NEKOFORGE` repo | 이미 헤비 단일 소스 |

---

## Task 1: 사전 안전 검증 (제거해도 깨지는 것 없음 확정)

**Files:** 없음 (읽기 전용 검증)

- [ ] **Step 1: visualizer 가 두 패키지를 실제 import 하지 않음 재확인**

Run: `cd REPO_ROOT && grep -rn "from ['\"].*\(forge-engine\|quality-core\)" packages/nekowork-cli/docs/visualizer/src`
Expected: 출력 없음 (import 0). 단순 문자열 언급(fixture stage 이름 등)은 무관.

- [ ] **Step 2: nekowork-cli(라이트) 가 두 패키지를 import/의존하지 않음 확인**

Run: `grep -rn "from ['\"].*\(forge-engine\|quality-core\)\|@ps-neko/quality-core" packages/nekowork-cli/src packages/nekowork-cli/scripts packages/nekowork-cli/package.json`
Expected: 출력 없음.

- [ ] **Step 3: 현재 nekowork-cli 테스트 baseline green 확보**

Run: `pnpm --filter @ps-neko/nekowork run test`
Expected: PASS (제거 후 비교 기준). 실패 시 → 기존 결함이므로 중단하고 별도 처리.

---

## Task 2: NEKOFORGE 본진 자격 재확인 (단일 소스로 충분한가)

**Files:** 없음 (standalone 레포 검증)

- [ ] **Step 1: standalone NEKOFORGE 단독 전체 검증 green**

Run: `cd ~/NEKOFORGE && npm run verify`
Expected: typecheck + lint + depcheck + test 전부 PASS (356 test). quality-core 패키지 없이 자립함을 재확인 — 통과해야 monorepo 쪽 제거가 안전.

- [ ] **Step 2: standalone 이 quality-core 를 참조하지 않음 확인**

Run: `grep -rn "quality-core" src 2>/dev/null; echo "exit=$?"`
Expected: 출력 없음 (참조 0).

---

## Task 3: monorepo 에서 두 패키지 제거 + CI 정리

**Files:**
- Delete: `packages/forge-engine/`, `packages/quality-core/`
- Modify: `.github/workflows/harness-validate.yml`

- [ ] **Step 1: 작업 브랜치 생성**

Run: `cd REPO_ROOT && git checkout main && git pull --ff-only && git checkout -b chore/single-source-engine`

- [ ] **Step 2: 두 패키지 디렉토리 삭제**

Run: `git rm -r packages/forge-engine packages/quality-core`
Expected: 두 디렉토리의 모든 파일 staged for deletion.

- [ ] **Step 3: `harness-validate.yml` — `changes` job 정리**

`changes` job(line 59~90)에서 forge/quality 흔적 제거:
- `outputs` (line 62~65): `forge:` 와 `quality:` 줄 삭제, `cli:` 만 남김.
- `filters` (line 72~90): `forge:` 블록(73~78)과 `quality:` 블록(79~84) 삭제, `cli:` 블록만 남김.

- [ ] **Step 4: `harness-validate.yml` — `validate-quality` job 전체 삭제**

`validate-quality:` job 전체(line 118~147) 삭제.

- [ ] **Step 5: `harness-validate.yml` — `validate-forge` job 전체 삭제**

`validate-forge:` job 전체(line 149~178) 삭제.

- [ ] **Step 6: `harness-validate.yml` — `validate-all` 집계 정리**

`validate-all` job(line 357~391):
- `needs:` (line 358): `validate-quality`, `validate-forge` 제거 → `needs: [security, validate-cli, tarball-size-guard]`.
- `env:` (line 364~369): `R_QUALITY`, `R_FORGE` 줄 삭제.
- aggregate 스크립트 `for k in ...` (line 373): `quality forge` 제거 → `for k in security cli tarball; do`.

- [ ] **Step 7: lockfile + workspace 자동 정리 확인**

Run: `pnpm install`
Expected: `forge-engine`, `quality-core` 가 `pnpm-lock.yaml` 에서 사라지고 에러 없음. `pnpm-workspace.yaml` 은 `packages/*` 글롭이라 수정 불필요.

---

## Task 4: monorepo 검증 (라이트 전용 상태로 green)

**Files:** 없음 (검증)

- [ ] **Step 1: 전체 빌드**

Run: `pnpm -r run build`
Expected: PASS (이제 nekowork-cli + visualizer 만 빌드).

- [ ] **Step 2: 전체 테스트**

Run: `pnpm -r run test`
Expected: PASS (Task 1 Step 3 baseline 과 동일 — 라이트 테스트 회귀 0).

- [ ] **Step 3: 전체 lint**

Run: `pnpm -r run lint`
Expected: PASS.

- [ ] **Step 4: 잔존 참조 0 확인**

Run: `grep -rn "forge-engine\|@ps-neko/quality-core" --include=*.ts --include=*.js --include=*.json --include=*.yml . | grep -v node_modules | grep -v "docs/visualizer/dist"`
Expected: 의미 있는 코드/CI 참조 0 (fixture 데이터의 문자열 언급만 남으면 무해 — 판단해 무시).

---

## Task 5: 문서 정리

**Files:** `README.md`, `README.ko.md`, `.claude/CLAUDE.md` (해당 시)

- [ ] **Step 1: forge-engine/quality-core 언급 탐색**

Run: `grep -rln "forge-engine\|quality-core" README.md README.ko.md .claude docs 2>/dev/null | grep -v node_modules`

- [ ] **Step 2: 발견 시 정리**

각 언급을 검토해 (a) monorepo 가 더 이상 헤비 엔진을 품지 않음을 반영, (b) 헤비 제품은 standalone `Ps-Neko/NEKOFORGE` 레포임을 한 줄 안내로 대체. 코드 예시/카탈로그가 nekowork-cli 기준이면 무변경.

---

## Task 6: 커밋 + PR

**Files:** 없음 (git)

- [ ] **Step 1: 커밋**

```bash
git add -A
git commit -m "chore(repo): 중복 헤비 엔진 제거 — forge-engine/quality-core 삭제, 헤비는 NEKOFORGE 단일 소스

- nekowork-cli(라이트)는 forge-engine 미사용 → 제거 영향 0
- quality-core 는 forge-engine 전용 타입 패키지(타 사용처 0) → 동반 제거
- 헤비 엔진 단일 소스 = standalone Ps-Neko/NEKOFORGE (superset: auto-factory + 최신 수정 보유)
- CI: validate-quality/validate-forge job 및 changes 필터 제거
- monorepo 는 라이트(nekowork-cli) 전용으로 정리

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 2: push + PR**

```bash
git push -u origin chore/single-source-engine
gh pr create --base main --title "chore(repo): 중복 헤비 엔진 제거 (헤비=NEKOFORGE 단일 소스)" --body "<요약: 위 커밋 메시지 + 검증 결과 + 라이트 무영향 근거>"
```

- [ ] **Step 3: CI green 확인 후 머지 (사용자 승인)**

Run: `gh pr checks <PR#> --watch`
Expected: 남은 job(security, validate-cli, tarball-size-guard, validate-all) 전부 pass. 머지 방식은 사용자 결정.

---

## Self-Review (스펙 대비)

- **헤비 엔진 단일화** → Task 3(제거) + Task 2(standalone 자립 확인). ✓
- **라이트 무영향** → Task 1(독립성 검증) + Task 4 Step 2(테스트 회귀 0). ✓
- **quality-core 동반 제거 안전** → Task 1(타 사용처 0) + Task 4 Step 4(잔존 참조 0). ✓
- **CI 정합** → Task 3 Step 3~6(4개 job/필터 수정) + Task 6 Step 3(CI green). ✓
- **문서 드리프트** → Task 5. ✓
- **되돌리기 가능성** → PR 기반(Task 6), standalone 무변경. ✓

**실행 중 확인(placeholder 아님, 실측 항목):**
- `harness-validate.yml` line 번호는 현재 파일 기준 — 편집 시 앵커 텍스트(`validate-forge:`, `R_FORGE` 등)로 재확인.
- Task 5 문서 정리 범위는 grep 결과에 따라 가변(없으면 skip).
