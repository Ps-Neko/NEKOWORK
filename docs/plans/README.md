# Plans & Checkpoints

monorepo bootstrap (T1~T12) 의 디자인 결정, 12-task plan, 세션별 진행 checkpoint 를 보존한다. 원본은 gstack 의 로컬 audit trail (`~/.gstack/projects/`) 이며 본 디렉토리는 GitHub 가시화를 위한 사본이다.

## 구조

```
docs/plans/
├── design/         # /office-hours + /plan-eng-review 산출 design doc
├── tasks/          # /plan-eng-review 가 생성한 task JSONL
└── checkpoints/    # /context-save 의 세션별 진행 스냅샷
```

## 파일

### design/

| 파일 | 내용 |
|---|---|
| `20260521-095633-monorepo-restructure.md` | monorepo restructure design doc (D1~D14 결정, "30초 wedge" 명시). NEKOWORK + NEKOFORGE 통합 + packages/{nekowork-cli,forge-engine,quality-core} 구조 도출. |
| `20260521-095700-eng-review-test-plan.md` | restructure 의 eng-review 테스트 plan. |

### tasks/

| 파일 | 내용 |
|---|---|
| `20260521-110117-monorepo-12-tasks.jsonl` | 12-task plan. 각 라인 1 task: id (T1~T12), priority, component, files, effort_human/cc, title, source_finding. |

### checkpoints/

세션 진행 순서 (오래된 순):

| 파일 | 진행 단계 |
|---|---|
| `20260521-153944-neko-monorepo-t2-complete-t5-partial.md` | T2 완료, T5 부분 진행 |
| `20260521-160326-neko-monorepo-t3-complete-nekoforge-imported.md` | T3 완료 (NEKOFORGE filter-repo) |
| `20260521-170543-monorepo-t4-t5-quality-core-complete.md` | T4/T5 완료 (quality-core contract + pnpm workspace) |
| `20260522-094048-neko-monorepo-t2-t5-done-review-found-2-p0.md` | T2~T5 DONE, /review 가 P0 2건 발견 |
| `20260522-103757-neko-monorepo-p02-merged-hardening-fixed.md` | P0 #2 (origin/main 머지) 완료, hardening fix |
| `20260522-105500-neko-monorepo-pr60-shipped-ci-green.md` | PR #60 ship 완료, CI green |
| `20260522-153000-t6-t12-shipped-t8-gap-discovered.md` | T6 (PR #61) + T12 (PR #63) 머지, T8/T9 plan gap 발견 |

## 사용

새 세션이 진입할 때 가장 최근 checkpoint 를 읽어 컨텍스트 복원:

```bash
ls docs/plans/checkpoints/ | tail -1
```

12-task plan 상태 확인:

```bash
cat docs/plans/tasks/20260521-110117-monorepo-12-tasks.jsonl | jq '.id + " " + .priority + " " + .title'
```

본 사본은 **read-only mirror**. 원본 갱신은 gstack 의 `/context-save` / `/plan-eng-review` 가 `~/.gstack/projects/` 에 쓰며, 본 디렉토리는 주기적으로 별도 PR 으로 동기화한다 (자동화는 향후).

## 진행률 (2026-05-22 기준)

12-task plan **10/12 DONE (83%)** — T1~T7 + T12 완료. 남은 deferred: T8 (forge dynamic import, plan gap 재정의 필요), T9 (perf fixture, T8 동반), T10 (Release compat, alpha.12 publish 시점), T11 (npm deprecate nekoforge, T10 후).

## 명명 컨벤션

- design / tasks: `YYYYMMDD-HHMMSS-<topic>.{md,jsonl}` (gstack 원본 timestamp 유지, 사용자 식별자 prefix 제거)
- checkpoints: `YYYYMMDD-HHMMSS-<topic>.md` (gstack 원본 그대로)

## 보존되지 않는 항목

다음은 gstack 로컬에만 두고 GitHub 에 올리지 않는다:
- `learnings.jsonl` (gstack 학습 누적, 도구 메타데이터)
- `timeline.jsonl` (스킬 호출 timeline)
- `main-reviews.jsonl` / `<branch>-reviews.jsonl` (review 결과 로그)
- 사용자 식별 prefix 가 있는 audit 파일

이들은 사적 audit / 도구 디버깅용이라 공개 가시화 가치 낮음.
