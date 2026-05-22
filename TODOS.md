# TODOS

> 본 파일은 monorepo 의 deferred 작업 단일 진실원이다. 새 TODO 등록 시 What/Why/Context/Pros/Cons/Depends-on 6필드 필수. 완료된 TODO 는 삭제하지 말고 `## DONE` 섹션으로 이동하고 완료 date + 결과 commit/PR 을 추가한다.
>
> 출처: `~/.gstack/projects/claude/tasks-eng-review-20260521-110117.jsonl` T12 (D14 결정), saved context `Ps-Neko-NEKOWORK/checkpoints/20260522-105500-...md`.

## 2026-05-22 — TS-MIGRATION

- **What:** `packages/nekowork-cli/scripts/**/*.js` 를 `*.ts` 로 점진 이식. 파일별 개별 PR, `allowJs:true` → `strict:true` 단계 진입.
- **Why:** type safety 경계와 패키지 경계 일치. forge-engine / quality-core 가 이미 TS 인데 nekowork-cli 만 JS 라 workspace:* import 시 타입 손실. 점진 이식이라 한 PR 당 위험 적음.
- **Context:** monorepo 부트스트랩 (T1~T7) 머지 완료 (PR #60 → main). `packages/nekowork-cli/scripts/` 에 약 30+ JS 파일. cli.js, install-plan.js, orchestrators/* 등이 핵심 진입점. 시작 후보: 유틸리티 (scripts/core/) → CI scripts (scripts/ci/) → CLI 진입점 (scripts/cli.js) 순서가 가장 작은 위험.
- **Pros:** 패키지 경계의 타입 검증 활성, forge-engine/quality-core 의 dist 산출물을 nekowork-cli 에서 typecheck 받으며 사용 가능, JSDoc 의 한계 (generic, conditional type) 제거.
- **Cons:** tsx loader 의존 (`node --import tsx`) 또는 build step 추가. 파일별 PR 이라도 ~30+ PR 사이클. 외부 alpha 사용자 영향 0 (CLI 동작 동일).
- **Depends on / blocked by:** PR #60 머지 완료 (DONE). T8/T9 와는 독립이지만 T8 (forge-engine dynamic import) 의 type-level 처리는 본 마이그레이션 후 깔끔해짐.

## 2026-05-22 — REACTION-COLLECTOR

- **What:** 외부 알파 5-user wedge test 의 reaction 수집 메커니즘 확정. 후보 채널: GitHub issue template / Google Form / DM 텍스트 / 전용 Discord 채널.
- **Why:** alpha 5명 모집 후 7일 피드백 수집 단계 (`packages/nekowork-cli/WORKING-CONTEXT.md` Active Queues §In Progress) 에서 구조화된 응답이 없으면 정성 코멘트만 모이고 P4 가설 (자율 에이전트 oversight) 검증이 불가. The Assignment 발송 전 결정 필수.
- **Context:** Design doc Open Question 3 (`~/.gstack/projects/claude/dora-main-design-neko-restructure-20260521-095633.md` §Open Questions). 1.0 진입 게이트 5조건 중 "외부 알파 3/5 다시 쓰겠다" 측정에 직접 사용.
- **Pros:** 응답 비교 가능 (정량/정성 혼합), reject 시 (a) wedge 약함 vs (b) distribution shape 잘못 의 신호 분리 가능.
- **Cons:** 너무 무거우면 응답률 하락 — 5min 이내 답변 가능 형식 필수. Google Form 은 외부 의존, GitHub issue template 는 GitHub 계정 필요.
- **Depends on / blocked by:** alpha 5명 모집 진행 (사용자 수동 social work). 모집 직전까지 결정.

## 2026-05-22 — RULE-PACK-DIR

- **What:** forge-engine 내부의 Rule Pack 13 + Skill Pack 13 디렉토리 분리 구조 확정. 목표 경로: `packages/forge-engine/packs/{rule,skill}/`.
- **Why:** 현재 forge-engine 의 rule/skill pack 이 `src/` 내부에 평면 배치되어 카탈로그 lint 가 검색 비용 높음. 명시적 분리로 (1) 카탈로그 검색 단순화, (2) external contributor 가 pack 만 PR 가능, (3) Rule/Skill pack 의 schema 분리 lint 강화 가능.
- **Context:** Phase RP (Rule/Skill Pack v0.5, 2026-05-20 통과) 후속 정리. `packages/forge-engine/docs/ROADMAP.md` §7.C 통과 기록 참조. 현재 13 + 13 = 26 pack 이 src/ 와 schemas/ 사이 분산.
- **Pros:** pack 추가 시 git diff scope 가 packs/ 안으로 한정 (T6 paths-filter affected matrix 와 자연스럽게 연결). README 외부 컨트리뷰터 진입 경로 명료.
- **Cons:** 이동 후 import path 갱신 다수 (~26 파일 + tests). dependency-cruiser 규칙 갱신. 1회성 이동이라 후속 무비용.
- **Depends on / blocked by:** forge-engine 패키지 이름 결정 (Open Question: nekoforge vs @ps-neko/forge-engine). rename 시 본 디렉토리 정리와 같은 PR 으로 묶는 게 효율적.

## 2026-05-22 — NEKOFORGE-PR-INVENTORY

- **What:** archive 전 기존 `Ps-Neko/NEKOFORGE` 레포의 미해결 PR 인벤토리 작성 + 각 PR transfer 결정 (close / cherry-pick to monorepo / 폐기).
- **Why:** T11 (npm deprecate nekoforge + NEKOFORGE 레포 archive) 진입 전 PR drain 필요. archive 후에는 PR 작업 불가, contributor 작업 손실 위험.
- **Context:** T11 (alpha.12 publish 후) 의존 작업. 직전 saved context (`20260522-105500-...md`) 의 Open Questions §2 forge-engine 이름 결정과 같이 처리 권장. 현재 NEKOFORGE 레포 open PR 개수는 archive 직전 재확인 필요.
- **Pros:** contributor 기여 손실 0, T11 archive 가 깔끔. monorepo 통합 후에도 NEKOFORGE 시절 기여 traceability 보존.
- **Cons:** open PR 별로 monorepo 의 다른 디렉토리 (`packages/forge-engine/`) 로 변환 필요 — 자동화 안 됨. 수작업.
- **Depends on / blocked by:** T10 (Release compat) → T11 (npm deprecate + archive) 순서. 본 인벤토리는 T11 직전.

## DONE

- _완료된 TODO 는 여기에 옮긴다. 형식: `## YYYY-MM-DD — KEY (DONE @ commit/PR)` + 1줄 결과 요약._
