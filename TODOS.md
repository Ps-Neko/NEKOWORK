# TODOS

> 본 파일은 NEKOWORK 의 deferred 작업 단일 진실원이다. 새 TODO 등록 시 What/Why/Context/Pros/Cons/Depends-on 6필드 필수. 완료된 TODO 는 삭제하지 말고 `## DONE` 섹션으로 이동하고 완료 date + 결과 commit/PR 을 추가한다.

## 2026-06-01 — POST-PIVOT 상태

NEKOWORK 가 좁은 검증 게이트(2 verbs: `check`, `verify-pr`)로 좁혀짐. 14단계 harness / forge-engine / visualizer 사상은 박제 (NEKOFORGE README 의 박제 배너 참조).

본 파일에 등록된 2026-05 작업 중 14단계 harness · forge-engine · visualizer · `nekowork-cli` 기반 TODO 들은 `## DEFERRED (pre-pivot)` 섹션으로 이동했다. 박제 결정이 뒤집힐 때만 재개.

## ACTIVE (post-pivot)

- _(none — slim 패키지 자체의 새 TODO 를 여기에 등록)_

## DEFERRED (pre-pivot — 2026-06-01 박제 결정 영향)

아래 TODO 들은 NEKOFORGE / 14단계 harness 박제 결정 이전에 등록되었다. NEKOWORK 가 외부 채택을 확보하기 전엔 진행 무의미.

### 2026-05-22 — TS-MIGRATION

- **What:** `packages/nekowork-cli/scripts/**/*.js` 를 `*.ts` 로 점진 이식. 파일별 개별 PR, `allowJs:true` → `strict:true` 단계 진입.
- **Why:** type safety 경계와 패키지 경계 일치. forge-engine / quality-core 가 이미 TS 인데 nekowork-cli 만 JS 라 workspace:* import 시 타입 손실. 점진 이식이라 한 PR 당 위험 적음.
- **Context:** monorepo 부트스트랩 (T1~T7) 머지 완료 (PR #60 → main). `packages/nekowork-cli/scripts/` 에 약 30+ JS 파일. cli.js, install-plan.js, orchestrators/* 등이 핵심 진입점. 시작 후보: 유틸리티 (scripts/core/) → CI scripts (scripts/ci/) → CLI 진입점 (scripts/cli.js) 순서가 가장 작은 위험.
- **Pros:** 패키지 경계의 타입 검증 활성, forge-engine/quality-core 의 dist 산출물을 nekowork-cli 에서 typecheck 받으며 사용 가능, JSDoc 의 한계 (generic, conditional type) 제거.
- **Cons:** tsx loader 의존 (`node --import tsx`) 또는 build step 추가. 파일별 PR 이라도 ~30+ PR 사이클. 외부 alpha 사용자 영향 0 (CLI 동작 동일).
- **Depends on / blocked by:** PR #60 머지 완료 (DONE). T8/T9 와는 독립이지만 T8 (forge-engine dynamic import) 의 type-level 처리는 본 마이그레이션 후 깔끔해짐.
- **Post-pivot:** `nekowork-cli` 자체가 박제 대상. NEKOWORK 가 외부 채택을 확보해 harness 재개가 결정될 때만 의미 있음.

### 2026-05-22 — REACTION-COLLECTOR

- **What:** 외부 알파 5-user wedge test 의 reaction 수집 메커니즘 확정. 후보 채널: GitHub issue template / Google Form / DM 텍스트 / 전용 Discord 채널.
- **Why:** alpha 5명 모집 후 7일 피드백 수집 단계 (`packages/nekowork-cli/WORKING-CONTEXT.md` Active Queues §In Progress) 에서 구조화된 응답이 없으면 정성 코멘트만 모이고 P4 가설 (자율 에이전트 oversight) 검증이 불가. The Assignment 발송 전 결정 필수.
- **Context:** Design doc Open Question 3 (`~/.gstack/projects/claude/dora-main-design-neko-restructure-20260521-095633.md` §Open Questions). 1.0 진입 게이트 5조건 중 "외부 알파 3/5 다시 쓰겠다" 측정에 직접 사용.
- **Pros:** 응답 비교 가능 (정량/정성 혼합), reject 시 (a) wedge 약함 vs (b) distribution shape 잘못 의 신호 분리 가능.
- **Cons:** 너무 무거우면 응답률 하락 — 5min 이내 답변 가능 형식 필수. Google Form 은 외부 의존, GitHub issue template 는 GitHub 계정 필요.
- **Depends on / blocked by:** alpha 5명 모집 진행 (사용자 수동 social work). 모집 직전까지 결정.
- **Post-pivot:** post-launch (Show HN / GeekNews 게시 후) 피드백 채널로 의미 재구성 가능. brief 점수판 = "3개월 후 외부 사용자 5명" 측정과 연결.

### 2026-05-22 — RULE-PACK-DIR

- **What:** forge-engine 내부의 Rule Pack 13 + Skill Pack 13 디렉토리 분리 구조 확정. 목표 경로: `packages/forge-engine/packs/{rule,skill}/`.
- **Why:** 현재 forge-engine 의 rule/skill pack 이 `src/` 내부에 평면 배치되어 카탈로그 lint 가 검색 비용 높음. 명시적 분리로 (1) 카탈로그 검색 단순화, (2) external contributor 가 pack 만 PR 가능, (3) Rule/Skill pack 의 schema 분리 lint 강화 가능.
- **Context:** Phase RP (Rule/Skill Pack v0.5, 2026-05-20 통과) 후속 정리. `packages/forge-engine/docs/ROADMAP.md` §7.C 통과 기록 참조. 현재 13 + 13 = 26 pack 이 src/ 와 schemas/ 사이 분산.
- **Pros:** pack 추가 시 git diff scope 가 packs/ 안으로 한정 (T6 paths-filter affected matrix 와 자연스럽게 연결). README 외부 컨트리뷰터 진입 경로 명료.
- **Cons:** 이동 후 import path 갱신 다수 (~26 파일 + tests). dependency-cruiser 규칙 갱신. 1회성 이동이라 후속 무비용.
- **Depends on / blocked by:** forge-engine 패키지 이름 결정 (Open Question: nekoforge vs @ps-neko/forge-engine). rename 시 본 디렉토리 정리와 같은 PR 으로 묶는 게 효율적.
- **Post-pivot:** forge-engine 박제. 무관.

### 2026-05-22 — NEKOFORGE-PR-INVENTORY

> **[BLOCKED — 2026-05-28]** NEKOWORK·NEKOFORGE는 계열사(같은 그룹, 다른 분야, 별도 저장소)로 유지하기로 결정. archive 전제 자체가 무효화됨 → 본 인벤토리 작업 보류. 관련 정정: `Downloads/NEKOWORK_NEKOFORGE_계획_프롬프트.md`.
>
> **[추가 — 2026-06-01]** NEKOWORK pivot brief 가 NEKOFORGE archive(박제)를 재결정. 본 TODO 는 archive 가 사용자에 의해 실행될 때 다시 의미 가짐.

- **What:** archive 전 기존 `Ps-Neko/NEKOFORGE` 레포의 미해결 PR 인벤토리 작성 + 각 PR transfer 결정 (close / cherry-pick to monorepo / 폐기).
- **Why:** T11 (npm deprecate nekoforge + NEKOFORGE 레포 archive) 진입 전 PR drain 필요. archive 후에는 PR 작업 불가, contributor 작업 손실 위험.
- **Context:** T11 (alpha.12 publish 후) 의존 작업. 직전 saved context (`20260522-105500-...md`) 의 Open Questions §2 forge-engine 이름 결정과 같이 처리 권장. 현재 NEKOFORGE 레포 open PR 개수는 archive 직전 재확인 필요.
- **Pros:** contributor 기여 손실 0, T11 archive 가 깔끔. monorepo 통합 후에도 NEKOFORGE 시절 기여 traceability 보존.
- **Cons:** open PR 별로 monorepo 의 다른 디렉토리 (`packages/forge-engine/`) 로 변환 필요 — 자동화 안 됨. 수작업.
- **Depends on / blocked by:** T10 (Release compat) → T11 (npm deprecate + archive) 순서. 본 인벤토리는 T11 직전.

### 2026-05-23 — VIZ-FONT-VERIFY

- **What:** playwright headless chromium 의 한국어 폰트 fallback 검증 방법론 lock. fonts-noto-cjk 가 정상 로드되는지 확인 + tofu (사각 박스) 발견 시 CI fail.
- **Why:** plan D9 의 GIF 사이즈/FCP/bundle hard block 으로는 한글 렌더 실패 탐지 불가. design doc Reviewer Concerns RESIDUAL → 첫 CI run 후 결정 lock 됐으나 방법론 자체는 미결.
- **Context:** Phase 1.0 의 hero GIF 가 한국 OSS 메인테이너의 첨 인지 대상. 폰트 tofu 시 wedge 메시지 깨짐 — share velocity 직접 손상. plan §Edge Cases.
- **Pros:** 첫 CI run 후 baseline 비교로 0.5h 결정 가능 (font.check API + screenshot pixel hash 비교, 또는 OCR ≥99%).
- **Cons:** 방법론 lock 늦으면 1.0 ship 직전 마지막 시간 압박.
- **Depends on / blocked by:** Phase 1.0 T8 (gen-hero-gif step) 실 첫 run 의 산출물.
- **Post-pivot:** visualizer 자체가 박제. 무관.

### 2026-05-23 — VIZ-PR-PREVIEW

- **What:** PR 단계의 visualizer preview Pages URL 자동 발급. plan D11 lock 으로 main only 결정됐으나 메인테이너 contribution 시 visualizer 변경 review 가 어려움.
- **Why:** D11 lock 이유: free tier quota + multi-env 비공식. 그러나 외부 PR (Stage 2 의 fixture 추가 PR 등) 의 review 효율성 손실.
- **Context:** GitHub Pages 의 native multi-env 부재. peaceiris/actions-gh-pages 또는 Cloudflare Pages 의 native preview 검토.
- **Pros:** contributor 의 visualizer review 가능 + share velocity 보조.
- **Cons:** quota 소모 + 설정 ~2-3h.
- **Depends on / blocked by:** design doc Phase 2 의 P4 정성 시그널 결과. Stage 2 entry 결정 시 동반.
- **Post-pivot:** visualizer 자체가 박제. 무관.

### 2026-05-23 — VIZ-FIXTURE-WRITER

- **What:** fixture writer 도구. design doc Open Question 1 의 follow-up. Stage 2 의 3·5 fixture 추가의 critical path.
- **Why:** Phase 1.0 의 1 fixture 는 수작업으로 OK. Stage 2 entry 후 3-5 fixture 추가 시 수작업이 시간 압박.
- **Context:** nekowork CLI 의 자체 명령 (`nekowork bench --emit-fixture`) 또는 별도 dev tool. forge-engine 의 Ajv schema 재사용 (plan D4/D8).
- **Pros:** Stage 2 진입 1주 단축.
- **Cons:** 별도 tool ~5-8h 개발 비용. Stage 2 enter 결정 전 미상.
- **Depends on / blocked by:** Stage 2 entry 결정 (P4 정성 시그널 ≥2건).
- **Post-pivot:** visualizer · forge-engine 박제. 무관.

### 2026-05-23 — VIZ-SCHEMA-DRIFT

- **What:** visualizer 의 inline fixture schema (`packages/nekowork-cli/docs/visualizer/src/fixture-schema.ts`) 와 forge-engine 의 정본 schema (`packages/forge-engine/src/schemas/*.schema.ts`) 의 drift 자동 감지. 권장 종착: forge-engine 의 package.json 에 `exports` 추가 → visualizer 가 forge-engine 의 `decisionSchema` 직접 사용 → visualizer 의 inline schema 삭제.
- **Why:** Phase 1.0 implementation 시점에 forge-engine package.json 에 entry point 없어 cross-package schema import 가 까다로움. visualizer 가 자체 schema inline 으로 분기했고, forge-engine 의 schema 가 갱신될 때 visualizer 의 fixture 검증이 silent 하게 stale 해질 수 있음.
- **Context:** plan D8 의 본래 의도는 forge-engine 의 `createValidator()` 직접 호출. 본 세션의 fixture-schema.ts §주석 참조.
- **Pros:** drift 0 → fixture 가 정본 schema 와 항상 정합. Phase 1.0 후속 schema 진화 시 visualizer 가 자동 따라감. 코드 중복 제거.
- **Cons:** forge-engine 의 package.json 변경 (`exports` 신설) + visualizer 의 import 갱신 + 정합성 test 추가. ~2-3h.
- **Depends on / blocked by:** forge-engine 의 npm publish strategy (현재 nekoforge 가 private). package name rename (TODOS#NEKOFORGE-PR-INVENTORY) 와 같이 처리하면 한 PR.
- **Post-pivot:** visualizer · forge-engine 박제. 무관.

### 2026-05-23 — VIZ-STATION-MAP

- **What:** visualizer 의 12-station 정의 (`packages/nekowork-cli/docs/visualizer/src/stations.ts`) 와 forge-engine 의 14단계 공정 (`packages/forge-engine/docs/FACTORY-CELLS.md`) 의 1:1 매핑 lock + design doc 1줄 patch.
- **Why:** plan T3 의 12-station grid 는 자연 선정 (forge-engine 14단계 중 핵심 12). design doc 도 "12-station" 표현이고 plan 도 동일하지만 정확한 매핑은 미명시. 첫 외부 메인테이너가 visualizer 와 forge-engine 의 station 명세를 같이 보는 시점 (Stage 2 의 3·5 fixture 또는 contributor PR) 에 혼선 가능.
- **Context:** forge-engine FACTORY-CELLS.md 의 14단계: clarify, spec, intake, context, harness-design, plan, team, work, quality-policy, quality-contract, quality-score, self-review, codex-review, architecture-review, design-review, gate, apply (Memory 부속 별도). visualizer 의 12: intake, spec, plan, build, preverify, deterministic-rules, quality-contract, quality-score, self-review, advisor-review, human-gate, apply.
- **Pros:** 정합성 1:1 → docs · visualizer · 실 산출물 의 station 라벨 통일. external contributor 의 entry friction 0.
- **Cons:** ~30min 의 design doc patch + visualizer station label rename 가능.
- **Depends on / blocked by:** plan T15 (design doc patch — 별도 PC 에 있는 design doc) 과 같이 처리.
- **Post-pivot:** visualizer · forge-engine 박제. 무관.

## DONE

- _완료된 TODO 는 여기에 옮긴다. 형식: `## YYYY-MM-DD — KEY (DONE @ commit/PR)` + 1줄 결과 요약._
