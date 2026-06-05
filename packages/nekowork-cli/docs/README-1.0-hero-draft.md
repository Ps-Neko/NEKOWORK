# README hero — 1.0 draft

> **Status: SUPERSEDED (2026-06-05).** 이 초안의 방향(verify-pr hero, "Don't merge AI code without verification", Codex = advisor, Beginner 4종)은 PR #95 에서 실제 `README.md` / `README.ko.md` 에 반영 완료. 말미의 후속 항목(demo-terminal.svg, "One Command" 섹션 등)도 처리됨. 이 문서는 **보관용 초안**이며, 안의 수치/예시(`401 tests`·`src/auth.ts:42` 등)는 초안 작성 시점 값이므로 최신은 라이브 README 를 따른다. 저장소 제거 또는 npm 출하 제외는 별도 확인 후 결정.

## Notes for reviewer

- 변경 핵심: "verifies AI-made code changes" → "Don't merge AI code without verification" (능동적 차단 메시지)
- 첫 CLI 예시를 `start` → `verify-pr` 로 변경 (verify-pr 가 구현되면 시연 가능)
- "Codex verification" 을 verdict 경로에서 제거, advisor 로만 표시
- "Bring your coding agent" 프레이밍 유지 (검증 게이트 정체성과 호환)
- Beginner 4종 (check / verify-pr / report / apply) 만 hero. ask/plan/team/work/build/auto/run/ship/pr-prep 은 docs/ADVANCED.md 로 강등 (별도 작업)
- 비전 문구 ("Verification-first AI development OS") 는 hero 에 노출 안 함 — docs/VISION.md 에만

---

## EN — README.md hero replacement

```md
# NEKOWORK

[English](README.md) | [한국어](README.ko.md)

**Don't merge AI code without verification.**

[![validate](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)

NEKOWORK is a local verification gate for AI-generated code. It analyzes the diff, runs deterministic risk rules, collects evidence, and decides whether the change is safe to merge or apply — without auto-committing, auto-pushing, or trusting LLM verdicts.

Note: "Verified" means independently reviewed with recorded evidence — not mathematically proven correct. The verdict is decided by deterministic rules and check results. Optional Codex review is recorded as an advisor note only and never controls the verdict.

Note: NEKOWORK never commits, pushes, deploys, or publishes by itself. `apply` is explicit and only allowed when the verdict says so.

## 60-second flow

```bash
npx -y @ps-neko/nekowork@alpha check          # environment diagnosis
npx -y @ps-neko/nekowork@alpha verify-pr      # verify current working tree / diff
npx -y @ps-neko/nekowork@alpha report         # readable REPORT.md
npx -y @ps-neko/nekowork@alpha apply          # explicit apply if allowed
```

Every `verify-pr` run leads with the decision:

```text
Verdict:           BLOCK
Risk:              CRITICAL
Reason:            Hardcoded API key fallback detected (src/auth.ts:42)
Merge allowed:     false
Apply allowed:     false
Next:              Remove the fallback. Fail closed when the secret is absent.
```

The machine-readable companion `decision.json` and full evidence package live under `.nekowork/evidence/`. See [Example Report](#example-report).

## The verification chain

```text
diff
  → deterministic risk rules
  → checks (test / lint / typecheck / audit)
  → evidence package
  → deterministic decision
  → REPORT.md
  → (optional) PR comment
  → human gate
  → explicit apply
```

No auto-commit. No auto-push. No surprise deploy. LLM verdicts do not pass this gate — only deterministic rules + check evidence do.

## What NEKOWORK is not

- Not an IDE
- Not another agent pack
- Not an autopilot that pushes code
- Not a competitor to Cursor / Claude Code / Codex — pipe their output through NEKOWORK instead

## Advanced controls

`ask` / `plan` / `team` / `work` / `verify` / `gate status` / `ship` / `run` / `build` / `auto` / `pr-prep` and legacy `review` family are documented in [docs/ADVANCED.md](docs/ADVANCED.md). They are functional in alpha but will be deprecated in 1.0 → 2.0 in favor of the verification-first surface above.

**Public alpha evidence:** 401 tests / 0 moderate+ npm audit issues / fresh `npx @alpha` smoke / 10 case-study flows / 5 starter packs · [CI badge](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml) · [npm package](https://www.npmjs.com/package/@ps-neko/nekowork) · [alpha feedback](https://github.com/Ps-Neko/NEKOWORK/issues/new?template=alpha-feedback.yml) · [roadmap](docs/ROADMAP.md)
```

---

## KO — README.ko.md hero replacement

```md
# NEKOWORK

[English](README.md) | [한국어](README.ko.md)

**AI 가 만든 코드, 검증 없이는 통과시키지 마세요.**

[![validate](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)

NEKOWORK 는 AI 가 생성한 코드를 위한 로컬 검증 게이트입니다. diff 를 분석하고, 결정적 위험 룰을 실행하고, 증거를 수집한 뒤, 머지/적용 가능 여부를 판정합니다 — auto-commit / auto-push 없이, LLM 판정에 의존하지 않고.

참고: "검증됨" 은 기록된 증거로 독립 검토했다는 뜻이지, 수학적으로 정확하다는 뜻이 아닙니다. verdict 는 결정적 룰과 검증 결과만 결정합니다. 선택적 Codex 리뷰는 advisor 노트로만 기록되며 verdict 에 영향을 주지 않습니다.

참고: NEKOWORK 는 스스로 commit / push / deploy / publish 하지 않습니다. `apply` 는 명시적 명령이며 verdict 가 허용할 때만 동작합니다.

## 60초 흐름

```bash
npx -y @ps-neko/nekowork@alpha check          # 환경 진단
npx -y @ps-neko/nekowork@alpha verify-pr      # 현재 working tree / diff 검증
npx -y @ps-neko/nekowork@alpha report         # readable REPORT.md
npx -y @ps-neko/nekowork@alpha apply          # 허용되면 명시적 적용
```

모든 `verify-pr` 실행은 판정부터 보여줍니다:

```text
Verdict:           BLOCK
Risk:              CRITICAL
Reason:            Hardcoded API key fallback detected (src/auth.ts:42)
Merge allowed:     false
Apply allowed:     false
Next:              fallback 제거. secret 없으면 fail-closed 로 동작하게.
```

기계가 읽을 수 있는 `decision.json` 과 전체 증거 패키지는 `.nekowork/evidence/` 아래에 있습니다. [Example Report](#example-report) 참고.

## 검증 체인

```text
diff
  → 결정적 위험 룰
  → 검증 명령 (test / lint / typecheck / audit)
  → 증거 패키지
  → 결정적 verdict 산출
  → REPORT.md
  → (선택) PR comment
  → human gate
  → 명시적 apply
```

auto-commit 없음. auto-push 없음. 갑작스러운 deploy 없음. LLM 판정은 이 게이트를 통과하지 못합니다 — 결정적 룰 + 검증 증거만 통과합니다.

## NEKOWORK 가 아닌 것

- IDE 가 아님
- agent pack 이 아님
- 코드를 push 하는 autopilot 이 아님
- Cursor / Claude Code / Codex 의 경쟁자가 아님 — 그들의 출력을 NEKOWORK 로 흘려보내세요

## Advanced 명령

`ask` / `plan` / `team` / `work` / `verify` / `gate status` / `ship` / `run` / `build` / `auto` / `pr-prep` 및 legacy `review` 계열은 [docs/ADVANCED.md](docs/ADVANCED.md) 에 있습니다. 알파에서는 동작하지만 1.0 → 2.0 동안 deprecate 되고, 위 검증 우선 표면이 그 자리를 채웁니다.

**Public alpha evidence:** 401 tests / 0 moderate+ npm audit issues / fresh `npx @alpha` smoke / 10 case-study flows / 5 starter packs · [CI badge](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml) · [npm package](https://www.npmjs.com/package/@ps-neko/nekowork) · [alpha feedback](https://github.com/Ps-Neko/NEKOWORK/issues/new?template=alpha-feedback.yml) · [roadmap](docs/ROADMAP.md)
```

---

## Adjacent files to create/edit (followups, not in this draft)

- `docs/VISION.md` — "Verification-first AI development OS" 장기 비전 격리
- `docs/ADVANCED.md` — 강등된 11개 Advanced + 4개 Legacy 명령 문서 (현재 CLAUDE.md 의 Advanced/Legacy 섹션 + 사용 예시)
- `docs/SCOPE-1.0.md` — 이미 작성됨 (이번 turn)
- README.md hero 교체 시: line 50 의 `docs/assets/demo-terminal.svg` 가 verify-pr 흐름을 반영하도록 별도 업데이트 필요
- "One Command. One Blocked Risk." 섹션 (line 52~70) 은 `start "add OPENAI_API_KEY fallback..."` 예시 → `verify-pr` 흐름으로 재촬영 필요
