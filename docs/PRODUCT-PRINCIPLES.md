# Product Principles

NEKOWORK is not a large agent pack. It is a local-first AI development OS and quality runtime where Claude produces work, Codex verifies it from a separate context, and human gates stop risky changes.

## Position

```text
NEKOWORK = fast AI build -> Codex verification -> Human Gate -> explicit apply
```

Agent catalogs, skill packs, hooks, profiles, build modes, and team execution are useful only when they strengthen that verification loop.

NEKOWORK also acts as a local-first AI development quality runtime:

```text
good development discipline
+ product-aware scope control
+ read-only multi-agent thinking
+ evidence-based Codex verification
+ Human Gate
+ explicit apply
= gated AI development lifecycle
```

It can grow into an all-in-one runtime, but the growth rule stays fixed:

```text
fast build
+ agent/team assistance
+ disciplined quality checks
+ independent verification
+ Human Gate
+ explicit apply
= NEKOWORK AI development OS
```

See [AI-DEVELOPMENT-LIFECYCLE.md](AI-DEVELOPMENT-LIFECYCLE.md) for the lifecycle view.

## Core Invariants

These rules are part of the product contract:

1. Multi-worker phases are read-only by default.
2. Only one executor may mutate project files in a work cycle.
3. Codex review is the default independent verification path.
4. Secure or sensitive changes require Codex challenge or human gate.
5. Human gate cannot be bypassed by skill, hook, profile, or module expansion.
6. Profiles may add capabilities, but they cannot weaken core safety gates.
7. Live provider calls must use delegated local CLI auth unless the user explicitly opts into another path.
8. Unexpected git mutation during read-only phases is a failure condition.

See [CORE-INVARIANTS.md](CORE-INVARIANTS.md) for the standalone invariant contract.

## CLI Phase Semantics

The decomposed workflow is:

```text
ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply
```

The phases mean:

| Phase | Meaning | Mutation |
|---|---|---|
| `ask` | Clarify goal, scope, risk, and success criteria. | No project mutation |
| `plan` | Produce an implementation plan and acceptance criteria. | No project mutation |
| `team` | Produce read-only handoffs from multiple worker perspectives. | No project mutation |
| `work` / `run` | Let a single executor implement the approved plan. | Single executor only |
| `verify` | Run Codex review, optional Codex challenge, and gate logic against prior work. | No project mutation |
| `gate` | Record explicit human approve/block decisions for `HUMAN_GATE`. | No project mutation |
| `review` | Compatibility full cycle for `ideate -> plan -> implement -> self-review -> codex-review -> codex-challenge -> ship`. | Legacy full loop |
| `review-cycle` | Explicit alias for the legacy `review` behavior during migration. | Legacy full loop |
| `ship` | Prepare a ship/no-ship readiness handoff after gates pass. | No project mutation |
| `report` | Summarize session evidence into readable audit output. | No project mutation |
| `apply` | Apply a verified `SHIP_READY` live-work diff to the target project. | Controlled project mutation |
| `run` | Convenience wrapper for `work -> verify -> ship`, optional `apply`. | Wrapper; mutation only with `--apply` |
| `build` | One-command builder wrapper with `fast`, `safe`, `team`, `tdd`, and `release` modes. | Wrapper; same apply controls |

For the current alpha line, `review` remains the legacy full cycle, and `review-cycle` is an explicit compatibility alias:

```text
ideate -> plan -> implement -> self-review -> codex-review -> codex-challenge -> ship
```

Do not silently change that meaning. New wrappers and aliases should make the transition additive:

```text
short term:  ask + existing review cycle
mid term:    work + verify + ship split mutation from verification and readiness
long term:   ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply
```

See [CLI-STAGES.md](CLI-STAGES.md) for the standalone stage contract and compatibility window.

## Profile Boundaries

Profiles group capabilities. They do not change safety invariants.

Current and target profile meanings:

| Profile | Boundary |
|---|---|
| `core` | Minimal rules, agents, hooks, platform configs, and safety gates. |
| `developer` | Daily development flow with quality workflow, Codex loop, and ops readiness. |
| `builder` | One-command build modes for productivity, still bounded by Codex verification, Human Gate, and explicit apply. |
| `security` | Secure review defaults, network denial, critical human gates, and hardened checks. |
| `product` | Question gate, scope review, acceptance criteria, and product/design planning surfaces. |
| `quality` | Brainstorm, test-first planning, systematic debugging, evidence-based review, and verification before completion. |
| `frontend` | UI mockup, component review, accessibility, and front-end workflow surfaces. |
| `testing` | Test planning, regression checks, and coverage-oriented review surfaces. |
| `research` | Research-oriented handoffs and optional external knowledge surfaces. |
| `full` | All stable modules, still bounded by core safety invariants. |

## Team Mode

Team mode should start as read-only handoff generation:

```text
planner handoff
research handoff
design/product handoff
security handoff
test handoff
codex review handoff
```

The public command is:

```bash
harness team "<task>" --workers planner,research,product,security,test
harness team "<task>" --workers planner,research,product,security,test --no-write
```

The initial rule is simple:

```text
many workers may think
one executor may write
Codex must verify
Human Gate may stop
```

Parallel write access is a later capability and requires stronger conflict tracking, ownership, audit logs, and rollback behavior.

Advanced `team-lite` remains a handoff and coordination surface. It records read-only intent and does not replace the single-executor `work`/`run` phase.

## Work Mode

The public command is:

```bash
harness work "<task>" --session <id>
harness work "<task>" --single-executor --session <id>
harness work "<task>" --profile quality --session <id>
```

`work` is the single-executor mutation phase. In the current alpha line it is deliberately conservative:

- only the `executor` agent runs
- mock mode writes an implement handoff only
- live mode writes in an isolated git worktree
- live diffs are persisted under the session
- the target project is not mutated directly
- Codex review and ship are not run

The next step after `work` is verification before any apply or ship path.

`work` writes `acceptance-criteria.json` for every session. It reuses `prd.json` acceptance criteria when present and otherwise records a task-derived minimum so verification and ship readiness always have a success artifact to reference.

## Verify Mode

The public command is:

```bash
harness verify "<task>" --session <id>
harness verify "<task>" --profile quality --strict-quality --session <id>
```

`verify` is the Codex-only verification phase:

- requires a prior `work` handoff in the same session
- reads prior handoffs and any captured diff
- runs `codex-review`
- runs `codex-challenge` for `--secure` or sensitive work
- expects findings to include evidence whenever possible: claim, evidence, required fix, confidence, and gate requirement
- records quality/security evidence warnings when profile policy asks for them
- records structured `acceptance_coverage` for the `quality` profile
- can escalate quality warnings into a fix-required verdict with `--strict-quality`
- writes `HUMAN_GATE` for critical or blocking findings
- does not implement
- does not ship

## Gate Mode

The public commands are:

```bash
harness gate status --session <id>
harness gate approve --session <id> --reason "<why>"
harness gate block --session <id> --reason "<why>"
```

`gate` is the explicit human decision phase:

- `status` reads the session gate markers
- `approve` requires an open `HUMAN_GATE`
- `block` creates an explicit no-ship block for the session
- approval writes `GATE_APPROVED` but keeps `HUMAN_GATE` for audit
- block writes `GATE_BLOCKED` and keeps `ship` stopped
- no project files are mutated

## Ship Mode

The public command is:

```bash
harness ship "<task>" --session <id>
harness ship "<task>" --require-clean-gates --session <id>
```

`ship` is the readiness phase:

- requires a prior `work` handoff in the same session
- requires prior Codex verification in the same session
- refuses to bypass an unresolved `HUMAN_GATE`
- respects explicit `gate approve` and `gate block` markers
- writes `SHIP_READY` only after a fully approved verification verdict
- writes `NO_SHIP` when fixable Codex findings remain
- does not publish, deploy, create a PR, or mutate project files

## Report Mode

The public command is:

```bash
harness report --session <id>
```

`report` is the readable evidence phase:

- reads only the requested session directory
- summarizes summaries, markers, handoffs, quality warnings, and acceptance coverage
- writes `REPORT.md` and `report-summary.json`
- does not call providers
- does not inspect or mutate project source files
- does not replace Human Gate, `ship`, or `apply`

## Apply Mode

The public command is:

```bash
harness apply --session <id>
```

`apply` is the controlled mutation phase:

- requires a prior `work` handoff
- requires prior Codex verification
- requires `SHIP_READY`
- refuses newer `NO_SHIP`, open `HUMAN_GATE`, or `GATE_BLOCKED`
- requires a captured diff from `work --live`
- applies the diff with git
- records `APPLIED_DIFF`
- leaves commit, push, PR, release, publish, and deploy to the human

`apply` is never implicit in the default beginner path. It only runs when the user explicitly asks for it through `apply` or `run --apply`.

## Run Mode

The public command is:

```bash
harness run "<task>" --session <id>
```

`run` is a convenience wrapper:

- runs `work -> verify -> ship`
- forwards `--secure` to `verify`
- forwards `--live` to each phase
- does not apply by default
- applies only with explicit `--apply`
- stops on human gates
- writes `run-summary.json`

`run` is the short safe wrapper for new users. It is intentionally narrower than the full long-term workflow: it does not run `plan` yet, but it records acceptance criteria through `work` and preserves the same Codex verification and Human Gate policy. `plan` remains recommended before `work` for larger changes and may become a required accepted artifact in a later release line.

## Ralph Mode

The public command is:

```bash
harness ralph "<task>" --engine review|run --max-iter <n>
```

`ralph` is advanced and explicit:

- default `--engine review` preserves the legacy full-cycle behavior
- `--engine run` repeats `work -> verify -> ship`
- it never applies by default
- every iteration is a child session
- cost cap, human gate, and max-iteration limits stop the loop

## Wait Mode

The public commands are:

```bash
harness wait status
harness wait start
harness wait stop
```

`wait` is an advanced persistent resume surface:

- it resumes only sessions that explicitly write an `active` contract
- supported active modes are `ralph`, `run`, and `review-cycle`
- it refuses to resume sessions with `HUMAN_GATE`
- it records `wait-summary.json` and `wait-events.jsonl`
- it may wake work back up, but it must not weaken Codex verification, Human Gate, or explicit apply rules

## Sensitive Work

Treat these categories as gate-sensitive:

- auth, session, permission, OAuth, JWT, password, token, secret, crypto, TLS, CSRF, CORS, XSS, webhook
- payment, billing, broker/order execution, trading, financial automation
- production deploy, CI/CD workflow changes, cloud credentials, infrastructure changes
- database migrations, destructive data changes, personal data, rollback-sensitive work

Sensitive work may be planned, mocked, or reviewed, but it cannot bypass Codex verification and human gate policy.

See [RISK-CLASSIFIER.md](RISK-CLASSIFIER.md) for the shared classifier contract.
