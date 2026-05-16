# NEKOWORK

[English](README.md) | [한국어](README.ko.md)

**AI 가 만든 코드, 검증 없이는 통과시키지 마세요.**

[![validate](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)

NEKOWORK 는 AI 가 생성한 코드를 위한 로컬 검증 게이트입니다. diff 를 분석하고, 결정적 위험 룰을 실행하고, 증거를 수집한 뒤, 머지 / 적용 가능 여부를 판정합니다 — auto-commit / auto-push 없이, LLM 판정에 의존하지 않고.

> 이 문서는 한국어 요약본입니다. 전체 상세 설명과 모든 고급 옵션은 [English README](README.md)를 참고하세요.

여기서 "검증됨"은 정답을 수학적으로 보증한다는 뜻이 아닙니다. verdict 는 결정적 룰과 검증 결과만 결정합니다. 선택적 Codex 리뷰는 advisor 노트로만 기록되며 verdict 에 영향을 주지 않습니다.

> 1.0 scope 와 로드맵: [docs/SCOPE-1.0.md](docs/SCOPE-1.0.md). 장기 비전 (검증 우선 AI 개발 OS): [docs/VISION.md](docs/VISION.md).

## 용어

- evidence: 실행과 검증 결과로 남는 증거 파일입니다.
- Human Gate: 사람이 최종 적용 여부를 승인하거나 차단하는 단계입니다.
- executor: 실제 변경 후보를 만드는 단일 작업자입니다.
- session: 한 번의 NEKOWORK 실행에서 생성되는 작업 기록 묶음입니다.
- apply: 검증된 ship-ready diff를 사람이 명시적으로 반영하는 명령입니다.

## 핵심 원칙

```text
NEKOWORK = diff -> 결정적 위험 룰 -> 검증 명령 -> 증거 -> 결정적 verdict -> REPORT -> Human Gate -> 명시적 apply
```

```text
증거 없으면 통과 없음.
LLM 의견은 verdict 아님.
테스트 없으면 PASS 아님 (INSUFFICIENT_EVIDENCE).
경계에서는 사람이 통제.
```

NEKOWORK는 자동으로 commit, push, publish, deploy, apply를 하지 않습니다.

## 요구 사항

- Node.js 22+
- npm
- git

## 안전한 기본값

NEKOWORK는 기본 흐름을 mock provider 모드로 확인할 수 있습니다. API key나 유료 provider 호출 없이 `check`, `auto --dry-run`, report 생성 흐름을 먼저 검증할 수 있습니다.

실제 provider를 사용할 때는 Claude, Codex, Gemini 같은 로컬 CLI 인증을 우선 사용합니다. 장기 provider API key fallback 경로는 기본적으로 차단하고, 사람이 명시적으로 선택한 경우에만 다룹니다.

## 30초 실행

요구사항: Node.js 22+, npm, git. commit 이 하나 이상 있는 git repo.

```bash
npx -y @ps-neko/nekowork@alpha check
npx -y @ps-neko/nekowork@alpha verify-pr
cat REPORT.md
cat .nekowork/decision.json
```

`check` 가 환경을 진단합니다. `verify-pr` 가 현재 working tree diff 를 결정적 위험 룰로 스캔하고, `.nekowork/evidence/` 에 증거를 남기고, 머지/적용 가능 여부를 판정합니다. 프로젝트 루트에 `REPORT.md` 와 `.nekowork/decision.json` 을 작성합니다.

> **재현성 메모:** `npx @ps-neko/nekowork@alpha` 는 가장 최근 publish 된 alpha 로 resolve 됩니다. publish 된 alpha 는 `main` 보다 뒤일 수 있습니다. 재현 가능한 동작을 원하면 정확한 버전 (예: `@ps-neko/nekowork@0.1.0-alpha.11`) 을 핀하세요.

Compatibility / legacy 명령 (`cockpit`, `start`, `ask`, `plan`, `team`, `work`, `verify`, `gate`, `ship`, `run`, `build`, `auto`, `pr-prep`, `report --session`, `apply --session`, `review`) 은 [docs/ADVANCED.md](docs/ADVANCED.md) 에 있습니다. 2.0 에서 제거 예정 ([docs/SCOPE-1.0.md](docs/SCOPE-1.0.md) Phased Cut).

## 한 명령. 하나의 차단된 위험.

AI 가 작성한 변경에 `process.env.X || "fallback"` 이 들어가면:

```bash
npx -y @ps-neko/nekowork@alpha verify-pr
```

전형적 BLOCK 출력:

```text
=== verify-pr ===
  verdict        : BLOCK
  reason         : Hardcoded secret fallback detected (src/auth.ts:42)
  merge_allowed  : false
  apply_allowed  : false
  risk_level     : CRITICAL
```

NEKOWORK 의 핵심: AI 는 변경을 만들 수 있지만, 위험한 ship/apply 결정은 결정적 룰과 사람 승인 아래에 둡니다. LLM verdict 는 게이트를 통과할 수 없습니다.

## 왜 필요한가

AI coding 도구는 점점 더 빠르게 코드를 만듭니다. 하지만 마지막 질문은 그대로 남습니다.

```text
이 변경을 믿고 내 프로젝트에 반영해도 되는가?
```

NEKOWORK는 이 질문에 답하기 위한 로컬 우선 런타임입니다.

- AI 작업을 session evidence로 남깁니다.
- 한 executor만 실제 변경 후보를 만듭니다.
- Codex가 별도 관점에서 검증합니다.
- 위험하면 Human Gate를 엽니다.
- `apply`는 검증된 ship-ready diff에만 명시적으로 실행됩니다.

## 실행 흐름

대부분은 이 흐름으로 시작하면 됩니다.

```text
check -> auto -> report -> gate
```

단계별 제어가 필요하면:

```text
ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply
```

`team`은 read-only handoff를 만들고, 파일 수정은 single executor가 담당합니다.

## Starter Packs

처음에는 아래 5개만 보면 됩니다. 전체 catalog는 [docs/CATALOG-PACKS.md](docs/CATALOG-PACKS.md)에 있습니다.

| Pack | 역할 | 언제 쓰나 |
|---|---|---|
| `core` | 최소 검증 런타임 | 첫 설치, repo smoke |
| `builder` | safe build mode 진입점 | 한 명령으로 build + 검증 + gate |
| `productivity` | 계획, TDD, 디버깅, finish 루틴 | 일상적인 AI 개발 |
| `security` | auth, secrets, deploy 위험 프롬프트 | 민감한 변경 |
| `release` | ship/no-ship evidence | 릴리즈 전 점검 |

## Report가 제품의 얼굴입니다

`report`는 session evidence를 사람이 읽을 수 있는 `REPORT.md`로 정리합니다.

```text
Verdict: approve_with_fixes
Ship ready: false
Human gate: required
Applied: false
Profile: quality
Strict quality: enabled
Acceptance coverage: 4/5
Quality warnings: 2

Evidence:
- work-summary.json
- verify-summary.json
- ship-summary.json
- gate-summary.json
```

전체 예시는 [docs/DEMO-REPORT.md](docs/DEMO-REPORT.md)를 보세요.

## 12가지 에이전틱 하네스 패턴

NEKOWORK는 하나의 거대한 agent 묶음이 아니라, 일을 나누고 검증하고 승인하는 패턴을 조합합니다.

이미 강하게 적용된 패턴:

- 계획-실행: `ask`, `plan`, Build Intelligence mini plan
- 생성-검토: `work -> verify`, Codex review
- 라우터: Build Intelligence와 risk classifier
- 전문가 팀: read-only `team` handoff
- 순차 파이프라인: `ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply`
- 사람 승인: Human Gate
- 도구 게이트: provider auth, git mutation guard, explicit `apply`

아직 의도적으로 partial인 패턴:

- 병렬 처리: `auto --parallel-candidates N` preview는 isolated candidate evidence, candidate verification, arbiter 선택, final Codex verification, ship readiness까지 연결합니다. `apply`는 여전히 명시적으로만 실행됩니다.
- 메모리 루프: `instincts`, `wait`, `ralph`가 기반이지만 자동 승격은 하지 않습니다.
- 진화 루프: 관찰은 자동화하되 채택은 사람이 검토합니다.

자세한 매핑은 [docs/AGENTIC-PATTERNS.md](docs/AGENTIC-PATTERNS.md)를 보세요.

## NEKOWORK가 최적화하는 것

| 질문 | NEKOWORK evidence |
|---|---|
| 왜 ship이 막혔는가? | `NO_SHIP`, `REPORT.md`, `gate-summary.json` |
| apply가 사람 통제 아래 있는가? | `auto`는 `--apply`를 거부하고, `apply`는 별도 명령입니다 |
| 구현자와 검증자가 분리되는가? | `work -> verify`와 Codex review evidence |
| 위험한 fast downgrade를 막는가? | manifest-backed build mode safety order |
| 장기 provider API key를 기본값으로 피하는가? | delegated CLI auth와 API-key override guard |

## 현재 alpha 상태

- Package: `@ps-neko/nekowork`
- Current alpha: `0.1.0-alpha.11` (npm `@alpha` published 2026-05-16)
- CLI: `nekowork`
- Legacy/internal alias: `harness`
- Tests: 496 pass
- npm audit: 0 moderate+ issues
- Fresh `npx @alpha` smoke: pass

## 외부 real run 공유

NEKOWORK는 실제 외부 run evidence가 중요합니다. 아래 문서를 따라 transcript, report trust card, quote를 공유할 수 있습니다.

- [docs/EXTERNAL-RUN.md](docs/EXTERNAL-RUN.md)
- [External run issue template](https://github.com/Ps-Neko/NEKOWORK/issues/new?template=external-run.yml)

비밀키, private path, proprietary source code는 반드시 제거하고 공유하세요.

## 문서

- [Quickstart](docs/QUICKSTART.md)
- [Workflow integration](docs/INTEGRATION.md)
- [Build modes](docs/BUILD.md)
- [Bounded autonomy](docs/AUTONOMY.md)
- [Safety guarantees](docs/SAFETY-GUARANTEES.md)
- [Trust model](docs/TRUST-MODEL.md)
- [Why NEKOWORK](docs/WHY-NEKOWORK.md)
- [12 agentic harness patterns](docs/AGENTIC-PATTERNS.md)
- [External run kit](docs/EXTERNAL-RUN.md)
