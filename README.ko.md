# NEKOWORK

[English](README.md) | [한국어](README.ko.md)

AI 코드 변경을 위한 검증 기반 오토파일럿입니다.

[![validate](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)

AI가 만들고, Codex가 검증하고, 사람은 최종 적용 경계를 승인합니다.

NEKOWORK는 AI가 계획, 수정, 검증, 제한된 재수정, 리포트 생성을 수행하도록 돕습니다. 하지만 최종 `apply`는 항상 사람이 명시적으로 실행해야 합니다.

> 이 문서는 한국어 요약본입니다. 전체 상세 설명과 모든 고급 옵션은 [English README](README.md)를 참고하세요.

여기서 "검증됨"은 정답을 수학적으로 보증한다는 뜻이 아닙니다. 독립 리뷰, 테스트 evidence, 위험 정책, Human Gate, 명시적 apply 경계를 기록했다는 뜻입니다.

## 용어

- evidence: 실행과 검증 결과로 남는 증거 파일입니다.
- Human Gate: 사람이 최종 적용 여부를 승인하거나 차단하는 단계입니다.
- executor: 실제 변경 후보를 만드는 단일 작업자입니다.
- session: 한 번의 NEKOWORK 실행에서 생성되는 작업 기록 묶음입니다.
- apply: 검증된 ship-ready diff를 사람이 명시적으로 반영하는 명령입니다.

## 핵심 원칙

```text
NEKOWORK = 검증 기반 오토파일럿 -> Codex 검증 -> Human Gate -> 명시적 apply
```

```text
apply 전까지는 자율적으로.
ship 전에는 독립 검증.
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

현재 npm alpha를 바로 실행할 수 있습니다.

```bash
npx -y @ps-neko/nekowork@alpha check
npx -y @ps-neko/nekowork@alpha auto "fix failing tests safely" --session first-auto
npx -y @ps-neko/nekowork@alpha report --session latest
```

먼저 실행 경로만 보고 싶다면:

```bash
npx -y @ps-neko/nekowork@alpha auto "fix failing tests safely" --dry-run
```

## 한 명령. 하나의 차단된 위험.

```bash
npx -y @ps-neko/nekowork@alpha auto "add OPENAI_API_KEY fallback for Codex auth"
```

예시 출력:

```text
Risk: provider-auth / long-lived-secret
Codex verdict: request_changes
Human Gate: required
Ship ready: false
Applied: false

Blocked because NEKOWORK defaults to delegated CLI auth and rejects long-lived provider API key paths unless the human explicitly opts in.
```

설명: NEKOWORK는 delegated CLI auth를 기본값으로 두고, 장기 provider API key 경로는 사람이 명시적으로 선택하지 않는 한 거부합니다.

이것이 NEKOWORK의 핵심입니다. 오토파일럿은 경계 전까지 계속 일할 수 있지만, 위험한 ship/apply 결정은 evidence와 사람의 승인 아래에 둡니다.

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
- Current alpha: `0.1.0-alpha.8`
- CLI: `nekowork`
- Legacy/internal alias: `harness`
- Tests: 293 pass
- npm audit: 0 moderate+ issues
- Fresh `npx @alpha` smoke: pass

## 외부 real run 공유

NEKOWORK는 실제 외부 run evidence가 중요합니다. 아래 문서를 따라 transcript, report trust card, quote를 공유할 수 있습니다.

- [docs/EXTERNAL-RUN.md](docs/EXTERNAL-RUN.md)
- [External run issue template](https://github.com/Ps-Neko/NEKOWORK/issues/new?template=external-run.yml)

비밀키, private path, proprietary source code는 반드시 제거하고 공유하세요.

## 문서

- [Quickstart](docs/QUICKSTART.md)
- [Build modes](docs/BUILD.md)
- [Bounded autonomy](docs/AUTONOMY.md)
- [Safety guarantees](docs/SAFETY-GUARANTEES.md)
- [Trust model](docs/TRUST-MODEL.md)
- [Why NEKOWORK](docs/WHY-NEKOWORK.md)
- [External run kit](docs/EXTERNAL-RUN.md)
