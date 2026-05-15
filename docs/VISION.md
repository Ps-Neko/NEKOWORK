# Long-term Vision

> 이 문서는 **NEKOWORK 의 장기 비전** 입니다. 현재 1.0 product 가 아닙니다.
> 1.0 의 정체성은 [docs/SCOPE-1.0.md](SCOPE-1.0.md) 의 **검증 게이트** 입니다.
> 이 비전은 1.0 검증 게이트가 신뢰되고 사용자에게 통한 뒤에 점진적으로 위로 확장됩니다.

## One-liner

```text
Verification-first AI development OS
```

```text
검증 우선 AI 개발 OS
```

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

## 6 레이어 모델 (long-term)

```text
1. Discover  : 무엇을 만들지 묻는다              (ask 의 미래형)
2. Spec      : 요구사항·수용조건을 쓴다          (plan 의 미래형)
3. Plan      : 작업을 작게 나눈다                (plan 의 분해 단계)
4. Build     : AI 가 구현한다                    (외부 AI 의 자리)
5. Verify    : 테스트·룰·증거 수집·판정           (1.0 의 코어, NEKOWORK 의 칼날)
6. Decide    : 통과·보류·차단·명시적 적용         (1.0 의 게이트)
```

NEKOWORK 의 **차별 핵심은 5와 6**.
1~4는 외부 AI (Claude Code / Codex / Cursor / Gemini / 사람) 가 채울 수 있으며, NEKOWORK 는 그 출력을 **입력 소스로 흡수**합니다.

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

### 3.x 이후 — Verification-first AI development OS
- 위 1~6 레이어가 모두 검증으로 묶임
- 외부 AI 는 입력 소스 또는 어시스턴트로 사용됨
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
