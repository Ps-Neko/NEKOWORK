# Why NEKOWORK

NEKOWORK is not another Claude Code power pack. It is a verified autopilot for AI code changes: agents build and repair before the apply boundary, Codex verifies the result, and the human controls final apply.

## Position

```text
Use your favorite AI authoring workflow to generate stronger work.
Use NEKOWORK when that work needs evidence, independent review, gate decisions, and controlled apply.
```

NEKOWORK can absorb useful ideas from other systems, but only as capabilities. The architecture stays fixed around:

```text
verified autopilot -> Codex verification -> report -> Human Gate -> explicit apply
```

NEKOWORK intentionally keeps the catalog selective. Every agent, skill, hook, profile, build mode, module, and pack must preserve the verification loop.

## Evidence-Based Comparison

| Question | NEKOWORK evidence |
|---|---|
| Did the tool record why ship was blocked? | `NO_SHIP`, `REPORT.md`, `gate-summary.json` |
| Did it keep apply human-controlled? | `auto` rejects `--apply`; `apply` is a separate command |
| Did it separate executor and verifier? | `work -> verify` with Codex review evidence |
| Did it block risky mode downgrades? | manifest-backed build mode safety order |
| Did it avoid long-lived provider API keys by default? | delegated CLI auth and API-key override guard |

## Comparison

| Pattern | Strong At | NEKOWORK Answer |
|---|---|---|
| Large agent catalog | Many roles, skills, and commands | Keep catalogs selective; make verification the product |
| Discipline workflow | TDD, planning, debugging, review method | Add `quality` profile, evidence policy, and strict quality gates |
| Team simulation | Many specialists thinking in parallel | Keep `team` read-only and preserve one executor for writes |
| Autopilot UX | Fast one-command execution | Use bounded `auto` to build, verify, repair, report, and stop before apply |
| Cross-tool setup | Many tool surfaces | Project one source catalog into Claude, Codex, Cursor, Gemini, and OpenCode |

## Catalog Interpretation

NEKOWORK should not be judged only by catalog size. A fairer split is:

| Dimension | Current Position |
|---|---|
| Catalog size | Selective alpha catalog |
| Catalog quality | Validated agents, skills, hooks, modules, and profiles |
| Catalog consistency | Every pack resolves to a safety-checked profile |
| Multi-surface support | Claude, Codex, Cursor, Gemini, OpenCode |
| External evidence | Eight case-study flows across UI, CI, package, auth, Python protocol, environment configuration, local diary app, and quality lifecycle targets |
| Verification-loop fit | Core product requirement |

The catalog is small by design:

```text
not the largest catalog
but a curated builder catalog for reportable, gated, explicitly applied changes
```

## What NEKOWORK Optimizes For

- Local delegated auth, not static API keys by default.
- Verified autopilot flow for build, verify, fixable repair, report, and apply-boundary control.
- One-command build modes for fast, safe, team, TDD, and release flows.
- Inspectable session artifacts and handoffs.
- Read-only multi-agent thinking.
- Single-executor mutation.
- Independent Codex verification.
- Human Gate for risky changes.
- `apply` only after verified `SHIP_READY` live-work diffs.

## What NEKOWORK Does Not Optimize For

- Being the largest agent catalog.
- Magic-keyword automatic activation.
- Bypassing review to maximize speed.
- Publishing, deploying, or pushing without human control.

## Default Pitch

English:

```text
NEKOWORK is a verified autopilot for AI code changes.
It helps agents build and repair quickly, then makes their changes prove themselves
through independent verification, Human Gate decisions, and explicit apply control.
```

Korean:

```text
NEKOWORK는 AI 코드 변경을 위한 검증형 오토파일럿입니다.
AI가 빠르게 만들고 고칠 수 있게 하되, 독립 검증, Human Gate,
명시적 apply 통제를 거쳐 증거 기반 변경만 통과시킵니다.
```
