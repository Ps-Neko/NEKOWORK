# Long-term Vision

> 이 문서는 **NEKOWORK 의 장기 비전** 입니다. 현재 1.0 product 가 아닙니다.
> 1.0 의 정체성은 [docs/SCOPE-1.0.md](SCOPE-1.0.md) 의 **검증 게이트** 입니다.
> 이 비전은 1.0 검증 게이트가 신뢰되고 사용자에게 통한 뒤에 점진적으로 위로 확장됩니다.

## One-liner

```text
Verification-first AI development factory.
AI builds. NEKOWORK verifies. Humans decide.
Nothing ships without evidence.
```

```text
검증 우선 AI 개발 공장.
AI 가 만들고, NEKOWORK 가 검증하고, 사람이 결정한다.
증거 없이는 출고하지 않는다.
```

> 비유: NEKOWORK 는 검증관이 붙은 AI 개발 공장. 입력은 아이디어, 출력은 증거가 첨부된 변경. 검사 없이는 출고하지 않는다.

## 핵심 원칙

NEKOWORK 의 모든 장기 확장은 단 하나의 원칙에 묶입니다.

```text
증거 없이는 통과 없음.
검증되지 않은 것은 적용되지 않음.
LLM 의견은 verdict 가 아님.
사람 승인은 위험 변경의 마지막 게이트.
AI 생성물은 신뢰하지 않고 검증한다.
```

이 원칙이 6개 레이어 전체를 묶습니다.

## 12-Station Factory Model (long-term)

> **주의:** 12 patterns ≠ 12 sequential steps. **12 patterns = 공장 운영에 필요한 12개 설계 블록**.
> 작업 유형에 따라 일부 station 만 거친다. 모든 작업이 12 station 을 순차적으로 도는 것은 아니다.

```text
[입고]
1.  Intake              사용자 요청 접수
2.  Clarify             제품 질문 / 요구사항 흔들기

[기획]
3.  Route               작업 유형 분류: bug / feature / refactor / release / docs
4.  Context             도메인 문서 / 기존 구조 / 제약 확인
5.  Spec                acceptance criteria 작성
6.  Plan                실행 계획과 작업 단위 분해

[제조]
7.  Team                read-only 전문가 handoff 생성
8.  Work                단일 executor 가 코드 변경

[검사]  ← 1.0 의 칼날
9.  Self-Review         작성자 1차 검토
10. Independent Review  Codex / 별도 모델 교차 검토

[출고]
11. Human Gate / Apply  위험 작업은 사람 승인 후 적용

[학습]
12. Memory / Evolution  결과·실패·규칙·개선점을 다음 작업에 반영
```

NEKOWORK 의 **차별 핵심은 station 9–11** ([검사] + [출고]).
1–8 은 외부 AI (Claude Code / Codex / Cursor / Gemini / 사람) 가 채울 수 있으며, NEKOWORK 는 그 출력을 **입력 소스로 흡수**합니다.
station 12 는 검사·출고 결과를 다음 작업에 되먹이는 닫힌 루프 — 1.x 의 rule learning, 2.x 의 자동 룰 제안으로 이어집니다.

### 기존 6-layer 와의 매핑

> 참고용. 2026-05-16 이전 문서가 6-layer (Discover / Spec / Plan / Build / Verify / Decide) 로 작성되어 있음. 12-station 은 그것을 더 정밀하게 분해한 것이며 정체성 변경이 아닙니다.

| 6-layer | 12-station |
|---|---|
| 1. Discover | 1 Intake · 2 Clarify |
| 2. Spec | 3 Route · 4 Context · 5 Spec |
| 3. Plan | 6 Plan · 7 Team |
| 4. Build | 8 Work |
| 5. Verify | 9 Self-Review · 10 Independent Review |
| 6. Decide | 11 Human Gate / Apply |
| — | 12 Memory / Evolution (신규) |

### 각 station 의 현재 상태

> alpha.11 기준 (2026-05-16). 자세한 1.0 scope 는 [SCOPE-1.0.md](SCOPE-1.0.md). 이 표는 **약속이 아니라 현재 그림** — CLI 명령 추가는 별도 alpha 결정 사항.

| Station | 1.0 (현재) | 1.x | 2.x |
|---|---|---|---|
| 1 Intake | 외부 (사람 / Cursor / Claude Code) | upstream file 자동 수집 확장 | NEKOWORK 진입점 |
| 2 Clarify | 외부 | — | NEKOWORK 진입점 |
| 3 Route | 결정적 룰이 diff 에서 자동 추론 | task type label | 진입점 분기 |
| 4 Context | upstream file (`context.md` / `DOMAIN.md`) 자동 픽업 | — | NEKOWORK 진입점 |
| 5 Spec | upstream file (`SPEC.md`) 자동 픽업 | acceptance coverage 측정 | NEKOWORK 진입점 |
| 6 Plan | upstream file (`PLAN.md`) 자동 픽업 | plan 검증 룰 | NEKOWORK 진입점 |
| 7 Team | read-only handoff (legacy `team`) | — | 검증 게이트 강제 |
| 8 Work | 외부 executor (Claude Code / Cursor / Codex) | — | 검증 게이트 강제 |
| **9 Self-Review** | `verify-pr` 결정적 룰 + 증거 수집 | check 자동 실행 (test / lint / typecheck / audit) | check 매트릭스 확장 |
| **10 Independent Review** | Codex review (advisor 노트, verdict 영향 없음) | `verify-skill` / `verify-release` family | 멀티 reviewer 가중치 |
| **11 Human Gate / Apply** | `decision.json` + 명시적 `apply` | policy profiles + team approval flow | apply 범위 확장 (patch → workflow) |
| 12 Memory / Evolution | session evidence + `bench:rules` rule efficacy | rule learning | 자동 룰 제안 |

**진한 station (9 · 10 · 11) 이 NEKOWORK 의 칼날** — 1.0 의 출하 기준은 이 세 station 의 신뢰도입니다.

## 외부 AI 의 정의

OMC / ECC / Cursor / Claude Code / Codex / Gemini 는 NEKOWORK 의 경쟁자가 아닙니다.

```text
입력:  외부 AI 가 만든 diff / patch / PR / 파일 변경
처리:  NEKOWORK 검증 / 증거 수집 / 판정
출력:  REPORT.md + decision.json + apply 허용 여부
```

이 정의 아래서 NEKOWORK 가 위쪽 레이어 (Discover/Spec/Plan/Build) 를 직접 만들지 여부는 **2.x 의 결정**이며, 1.0 / 1.x 는 절대 그 영역에 들어가지 않습니다.

## 단계별 비전 확장

### 1.0 — 검증 게이트 (현재 목표)
- `verify-pr` 가 단일 진입점
- 결정적 룰 + 증거 + 명시적 apply
- 외부 AI 출력의 안전한 입력 처리

### 1.x — 검증 family 확장 + decide/apply 권위 확대
- `verify-skill` : Claude / ECC / OMC / Cursor / Gemini 스킬·룰·훅 파일 검증 (land-grab 기회)
- `verify-release` : 릴리스 전 일관성 검증
- GitHub App 통합 (PR 자동 체크)
- policy profiles, team approval flow
- decide 의 권위가 강해지면서 apply 범위 확장 (현재 patch-only → workflow)

### 2.x — 위쪽 레이어로 확장 (검증이 충분히 신뢰될 때)
- `nekowork ask` : Discover 단계의 NEKOWORK 진입
- `nekowork spec` : Spec 작성 + 자동 검증
- `nekowork plan` : 작업 분해 + 결정적 검증 매핑
- `nekowork build` : 구현 + 검증 게이트 강제

단, **모든 위쪽 레이어는 검증 게이트에 묶여야 합니다.** 검증되지 않은 산출물은 다음 단계로 가지 못합니다. 이게 OMC/ECC 식 자유로운 multi-agent runtime 과의 차이입니다.

### 3.x 이후 — Verification-first AI development factory
- 12 station 이 모두 검증으로 묶임
- 외부 AI 는 입력 소스 또는 어시스턴트 ("공장 안 작업자 또는 외부 납품원") 로 사용됨
- 사용자는 "NEKOWORK 안에서 작업하면 절대 검증 없이 머지·apply 되지 않는다" 를 신뢰

## 무엇이 NEKOWORK 가 아닌가

- ❌ IDE 가 아님
- ❌ Agent pack 카탈로그가 아님
- ❌ 코드를 push 하는 autopilot 이 아님
- ❌ Cursor / Claude Code / Codex 의 대체재가 아님
- ❌ "LLM 에이전트 팀장" 이 아님 (OMC 식 멀티 에이전트 오케스트레이션 X)

## 왜 이 비전을 hero 에 노출하지 않는가

1.0 이전 단계에서 "AI 개발 OS" 라고 마케팅하면:
- 검증 게이트라는 칼날의 메시지가 뭉뚝해진다
- 사용자가 Cursor / Codex 와 plan/build 로 비교한다 (지는 비교)
- 알파 사용자의 기대치가 현실보다 높아져 피드백이 망가진다

비전은 비전이고, 제품은 제품입니다. 비전은 _도달 목표_, 제품은 _지금 깎고 있는 칼날_.

## 관련 문서

- [docs/SCOPE-1.0.md](SCOPE-1.0.md) — 1.0 의 실제 scope 와 결정
- [docs/ROADMAP.md](ROADMAP.md) — 단기 빌드 일정
- [docs/ADVANCED.md](ADVANCED.md) — 알파 시기의 wide CLI surface (1.0 → 2.0 동안 deprecate)
