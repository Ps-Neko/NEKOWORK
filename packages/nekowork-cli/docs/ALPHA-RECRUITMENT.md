# Alpha User Recruitment — Draft Messages

> 5명 알파 사용자 모집을 위한 채널별 메시지 초안.
> 검토 후 사용자가 실제 게시 (Claude 가 게시하지 않음).
> 발화 시점: alpha.11 publish 직후, verify-pr 가 working tree 에서 실제 검증을 수행하는 상태.
>
> 목표: 5명 응답 (per [SCOPE-1.0.md §13.1](SCOPE-1.0.md#131-외부-알파-5명-모집-채널)).
> 채널: 직접 아는 사람 1-2 + r/cursor 또는 r/ClaudeAI 1-2 + GeekNews (한국) 1-2.
>
> **모집의 목표는 홍보가 아니라 실제 AI 생성 diff 수집** — SCOPE-1.0 §9 의
> stage 2/3 fixture 와 §13.2 의 1.0 release gate 를 동시에 만족시키는 경로.

## Pasteable Template — 짧은 버전 (DM / 슬랙 / Discord 등)

가장 빠른 복사용. 친한 사람에게 바로 보낼 때:

```text
AI 가 만든 PR / diff 를 NEKOWORK verify-pr 로 검증해줄 외부 알파를 찾습니다.

목표는 자동 코딩이 아니라,
"이 AI 변경을 머지해도 되는가?" 를 REPORT.md 와 decision.json 으로 판정하는 것.

필요한 것:
- 최근 Claude Code / Cursor / Codex 가 만든 diff 또는 PR
- npx 로 verify-pr 실행
- REPORT.md / decision.json 결과 공유
- 오탐 / 미탐 / 이해 가능성 피드백

10분 정도 부탁드려요.

설치 + 실행:
  npx -y @ps-neko/nekowork@alpha verify-pr

피드백 양식:
  https://github.com/Ps-Neko/NEKOWORK/issues/new?template=alpha-feedback.yml
```

긴 채널별 메시지는 아래 섹션에 보존. 상황에 맞게 골라 사용.

## 공통 정체성 한 줄

```text
EN: Don't merge AI code without verification.
KO: AI 가 만든 코드, 검증 없이는 통과시키지 마세요.
```

## 채널 1: 직접 아는 사람 (DM / Slack / Discord)

### EN

> Hey — I shipped an alpha of NEKOWORK, a local verification gate for AI-generated code. It scans diffs from Cursor / Claude Code / Codex with deterministic rules (secret fallbacks, auto-push, hardcoded credentials, test disables, supply-chain hooks) and refuses to allow merge/apply unless the verdict is clear. No LLM in the verdict path, no auto-commit/push.
>
> 60-second try: `npx -y @ps-neko/nekowork@alpha verify-pr` in any git repo with a working tree diff. It writes REPORT.md + decision.json under `.nekowork/`.
>
> I'd love 10 minutes of your feedback after a real PR: did the verdict help you decide, was the report readable, did anything false-positive, did anything slip through? Issue template: <link to alpha-feedback>.

### KO

> 안녕하세요 — NEKOWORK 알파를 출시했어요. AI 가 만든 코드 변경의 로컬 검증 게이트입니다. Cursor / Claude Code / Codex 가 만든 diff 를 결정적 룰 (secret fallback, 자동 push, hardcoded credential, test disable, supply chain hook) 로 스캔하고, 판정이 명확하지 않으면 머지/적용을 차단합니다. LLM 은 verdict 경로에 없고, auto-commit/push 없음.
>
> 60초 체험: 아무 git repo 의 working tree diff 에서 `npx -y @ps-neko/nekowork@alpha verify-pr`. `.nekowork/` 아래에 REPORT.md 와 decision.json 가 생깁니다.
>
> 실제 PR 한 번 돌려보시고 10분 정도 피드백 부탁드려요 — verdict 가 머지 결정에 도움됐는지, REPORT 가 읽기 좋았는지, 오탐/미탐 있었는지. 이슈 템플릿: <link to alpha-feedback>.

## 채널 2: r/cursor / r/ClaudeAI / r/ChatGPTCoding

### Title

```text
Local verification gate for AI-generated diffs — recall 90+%, no LLM in the verdict path
```

### Body

```text
I built NEKOWORK after watching Cursor and Claude Code happily commit `process.env.X || "fallback-secret"` and `git push --force` into PRs I had to review.

What it does: takes the working-tree diff (or a patch file), runs 11 deterministic rules over the added lines, writes evidence, and emits a verdict — ALLOW / ALLOW_WITH_WARNINGS / NEEDS_HUMAN_REVIEW / INSUFFICIENT_EVIDENCE / BLOCK. Optional Codex review is recorded as an advisor note only and never controls the verdict.

Rules (current scope):
- Secret Fallback (`env.X || "literal"` and variants) — 30 real OSS positives, 2 live-AI captures
- Auto-Apply / Commit / Push (`git push --force`, subprocess git push, auto-merge config)
- Hardcoded Credential (provider signatures: AKIA, sk_live_, ghp_, xox-, AIza, PEM) — synthetic fixtures only
- Test-Or-Security-Disable (it.skip, @ts-nocheck, file-wide eslint-disable)
- Package-Lockfile-Risk (postinstall, curl|bash, git/tarball URL deps)
- eval usage (`eval(...)`, `new Function(...)`) — 6 real OSS positives
- Insecure TLS (`rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`) — 6 real OSS positives
- CORS wildcard (`Access-Control-Allow-Origin: *` on credentialed endpoints) — 6 real OSS positives
- SQL injection (basic string-concat query shapes; regex-level only) — 6 real OSS positives
- Command injection (basic user-input-into-shell shapes; regex-level only) — 6 real OSS positives
- AST dataflow (inter-procedural intra-module taint for variable-mediated injection: assembled SQL/`eval`/shell across statements, local-helper returns, sink aliases; AST-based, JS/TS single-file only) — 6 real OSS positives

All 11 rules currently sit at 100% recall / 0 false positives on their fixture corpus (234/234 positives, 0/130 negatives). Honest provenance: ~82 real OSS positives now span the rules (30 on secret-fallback, which also carries the only live-AI captures; 6 each on the newer injection/AST rules after the OSS-fixture merge), and only `hardcoded-credential` stays synthetic-only by design. Synthetic share of positives is 63% — still above the ≤30% target. Ten rules are pure regex; `ast-dataflow` adds one tiny, well-known dependency (`acorn`, the JS parser — MIT, zero transitive dependencies). The published `@alpha` (`0.2.0-alpha.11`) now ships all 11 rules + acorn; the `latest` dist-tag is still a stale `0.2.0-alpha.0` (5 rules, zero deps), so install with `@alpha`. NEKOWORK is a deterministic risk-pattern gate, not an exhaustive security audit — most injection classes, cross-file/whole-program dataflow, auth flaws, and logic bugs are out of scope (see BENCHMARK.md "What is NOT covered").

Quick try:
    npx -y @ps-neko/nekowork@alpha verify-pr

Exit codes match the verdict: 0 ALLOW, 1 NEEDS_REVIEW/NO_EVIDENCE, 2 BLOCK. There's a GitHub Actions example that posts the verdict as a PR comment.

Looking for 5 alpha users to run it on a real PR and report: did it block a real risk? Did it false-positive? Issue template inside the repo. <link>
```

## 채널 3: GeekNews (한국)

### Title

```text
NEKOWORK alpha — AI 가 만든 diff 를 결정적 룰로 검증하는 로컬 게이트
```

### Body

```text
AI 코딩 도구 (Cursor, Claude Code, Codex) 가 PR 에 자신감 있게 넣는 두 패턴이 가장 무서웠습니다:

1. `process.env.API_KEY || "fallback-secret"` — secret 이 없으면 hardcoded 값으로 동작
2. `git push --force origin main` — 자동 release script 에 슬쩍 추가

NEKOWORK 는 이런 패턴을 결정적 룰로 잡고, 판정이 명확하지 않으면 머지/적용을 차단하는 로컬 게이트입니다. LLM 은 verdict 경로에 없습니다 (advisor 만).

설치 + 실행 (60초):
    npx -y @ps-neko/nekowork@alpha verify-pr

산출: `.nekowork/decision.json`, `REPORT.md`, `.nekowork/evidence/risk-findings.json`.

1.0 시점 룰 (synthetic seed 측정):
- Secret Fallback: recall 90% / FP 0%
- Auto-Apply-Commit-Push: 100% / 0%
- Hardcoded Credential (provider 시그니처): 100% / 0%
- Test-Or-Security-Disable: 100% / 0%
- Package-Lockfile-Risk: 100% / 0%

알파 사용자 5명 찾고 있어요. 실제 PR 에 돌려보고 (a) BLOCK 이 정당했는지 (b) 오탐 있었는지 (c) REPORT 가 읽기 좋았는지 알려주시면 큰 도움됩니다.

GitHub: <repo link>
피드백 이슈 템플릿: <link to alpha-feedback>
```

## 채널 4: HN Show (보류)

verify-pr recall 0.90 이 합성 코퍼스 기준이고 OSS / live AI fixture 가 아직 부족하므로 HN 은 1.0 release 또는 verify-skill land-grab 시점까지 보류.
SCOPE-1.0.md §13.1 정책에 부합.

## 피드백 수집 항목

각 응답자에게 받을 정보 (alpha-feedback issue template 에 반영):

```text
- Project type (open source / SaaS / internal / etc.)
- AI tool used to generate the change (Cursor / Claude Code / Codex / other)
- Verdict received
- Was the verdict correct? (yes / no / partial)
- False positive? (which finding, what context)
- False negative? (what slipped through)
- Did REPORT.md help you decide? (1-5)
- Would you run it on the next PR? (yes / no / depends — say why)
- What was confusing or missing?
```

## 1.0 release 게이트 (per SCOPE-1.0.md §13.2)

- 내부 fixture benchmark Secret Fallback recall ≥ 0.90, FP ≤ 0.10 (✅ 이미 통과)
- CI 에 benchmark job 추가, 3일 연속 PASS (대기)
- 외부 알파 3/5 명 "다시 쓰겠다" 응답 (대기 — 이 모집의 목표)
- CRITICAL 미탐 0건 또는 수정 완료 (대기)
