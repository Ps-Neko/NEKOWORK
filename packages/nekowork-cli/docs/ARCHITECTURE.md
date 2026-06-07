# Architecture

NEKOWORK is the product and public name. It is an apply-before-change safety gate for AI-made code changes. The 1.0 primary path is the **`verify-pr` gate**: a single-shot, deterministic check over a diff. A larger session-based runtime (catalog projection, multi-agent review) sits behind it as the internal engine and advanced surface. The `harness` binary remains a legacy/internal CLI alias.

## verify-pr: the 1.0 Verification Path

`verify-pr` is the hero command and the architecture that matters for most users. It is single-shot and deterministic — no session and no provider call is required:

```text
diff (working tree | staged | patch | range | full)
  |
  v  project detector (does the project have test / lint / typecheck / build / audit?)
  |
  v  5 deterministic risk rules
     (secret fallback . hardcoded credential . auto commit/push/apply .
      test-or-security disable . package/lockfile risk)
  |
  v  deterministic verdict
     (ALLOW . ALLOW_WITH_WARNINGS . NEEDS_HUMAN_REVIEW . INSUFFICIENT_EVIDENCE . BLOCK)
  |
  v  evidence (.nekowork/evidence/*) + .nekowork/decision.json + REPORT.md
  |
  v  exit code (0 / 1 / 2) + optional --comment-file for CI
  |
  v  Human decision
```

The verdict is derived only from the deterministic rules and check availability — an LLM never decides the verdict. The project detector **detects whether** test/lint commands exist (returning `INSUFFICIENT_EVIDENCE` for a source change with no test command). Running those commands and folding pass/fail into the verdict is implemented via `--run-checks` (test/lint/typecheck; escalation-only — a failing check upgrades the verdict toward `NEEDS_HUMAN_REVIEW` but never triggers a standalone `BLOCK`). See [SCOPE-1.0.md](SCOPE-1.0.md) §5 for the full policy.

## Catalog and Projection (internal engine)

The tool surfaces are built from one canonical catalog. This is how NEKOWORK installs into different agents; it sits below the `verify-pr` gate, not in front of it.

```text
agent.yaml
  |
  |-- agents/
  |-- skills/
  |-- hooks/
  |-- rules/
  |-- manifests/
  |
  +--> builders
        |-- .claude/
        |-- .codex/
        |-- .cursor/
        |-- .gemini/
        `-- .opencode/
```

The canonical source is the repository catalog. Generated harness directories are outputs and can be rebuilt.

## Session Runtime Invariants (advanced path)

Besides the single-shot `verify-pr` gate, NEKOWORK ships a session-based runtime — a verification pipeline bounded by safe build modes and gates, not a general agent pack. This is the advanced/legacy surface ([ADVANCED.md](ADVANCED.md)):

```text
AI-made change -> preverify -> Codex verification -> decision/report -> Human Gate -> explicit apply
```

Core invariants:

- Multi-worker phases are read-only by default.
- Only one executor may mutate project files in a work cycle.
- Codex review is the default independent verification path.
- Secure or sensitive changes require Codex challenge or human gate.
- Profiles may add capabilities, but they cannot weaken core safety gates.

See [PRODUCT-PRINCIPLES.md](PRODUCT-PRINCIPLES.md), [CORE-INVARIANTS.md](CORE-INVARIANTS.md), [CLI-STAGES.md](CLI-STAGES.md), and [RISK-CLASSIFIER.md](RISK-CLASSIFIER.md) for the product contract, stage semantics, and risk policy.

## Runtime Shape

```text
User command
  |
  +--> scripts/cli.js
        |
        |-- verify-pr            (1.0 hero — single-shot diff gate)
        |-- doctor / check
        |-- install plan/apply
        |-- ask / plan / team / work / verify / gate / ship / report / apply / run / start / build / review / review-cycle   (session runtime — advanced)
        |-- ralph
        |-- team-lite
        |-- sessions / costs / instincts
        |
        +--> orchestrators/
              |
              +--> agents/dispatch.js
                    |
                    +--> provider runners
                          |-- mock
                          |-- claude CLI
                          |-- codex CLI
                          `-- gemini CLI
```

Mock mode is the default. Live mode delegates authentication to local provider CLIs.

## Session Runtime Surface

Beyond `verify-pr`, the session runtime exposes a broader command surface. These are the advanced/legacy commands being phased out of the first-run path (see [ADVANCED.md](ADVANCED.md)):

```bash
node scripts/cli.js doctor
node scripts/cli.js install --plan --pack quality
node scripts/cli.js install --plan --profile developer
node scripts/cli.js install --apply --profile developer --project-root <target>
node scripts/cli.js ask "clarify a risky or ambiguous request" --project-root <target>
node scripts/cli.js plan "target project smoke" --project-root <target>
node scripts/cli.js team "target project handoff review" --project-root <target>
node scripts/cli.js work "single executor implementation" --session work-smoke --project-root <target>
node scripts/cli.js verify "Codex verification" --session work-smoke --project-root <target>
node scripts/cli.js gate status --session work-smoke --project-root <target>
node scripts/cli.js ship "ship readiness" --session work-smoke --project-root <target>
node scripts/cli.js report --session work-smoke --project-root <target>
node scripts/cli.js apply --session work-smoke --project-root <target>
node scripts/cli.js run "decomposed wrapper" --session run-smoke --project-root <target>
node scripts/cli.js start "compatibility builder alias" --session start-smoke --project-root <target>
node scripts/cli.js build "safe builder wrapper" --mode team --session build-smoke --project-root <target>
node scripts/cli.js auto "bounded autonomy before apply" --level normal --session auto-smoke --project-root <target>
node scripts/cli.js review "change request" --no-ship --project-root <target>
node scripts/cli.js review-cycle "legacy full-cycle request" --no-ship --project-root <target>
```

Advanced features are documented separately:

- `team-lite`
- `ralph`
- instincts
- cost tracking
- Rust runtime

## Review Pipeline

The current alpha `review` command remains the Claude-led and Codex-reviewed legacy full cycle. `review-cycle` is an explicit compatibility alias for the same behavior:

```text
ideate
  -> plan
  -> implement
  -> self-review
  -> codex-review
  -> codex-challenge when secure or sensitive
  -> ship when not --no-ship
```

The long-term phase model is additive and keeps `review` compatibility during migration:

```text
ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply
```

`ask` is a local question gate. `team` creates read-only handoffs from multiple worker perspectives. `work` lets one executor produce an implement handoff and, in live mode, an isolated workspace diff. `verify` runs Codex-only verification against that prior work handoff. `gate` records explicit human approve/block decisions for `HUMAN_GATE`. `ship` creates a ship/no-ship readiness handoff and refuses to bypass unresolved gates. `report` summarizes existing session evidence without mutating project files. `apply` is the only decomposed command in this chain that mutates the target project, and only by applying a verified `SHIP_READY` live-work diff. `team-lite` remains an advanced read-only staged handoff experiment. Future `review` can be retired or kept as a compatibility wrapper once callers have migrated to the decomposed commands.

`work` does not run Codex review or ship. It also does not mutate the target project directly; live executor changes are captured as a session diff for later verification.

`work` also ensures `acceptance-criteria.json` exists. It reuses planned PRD acceptance criteria when available or records a task-derived minimum so verification and ship readiness always have success criteria to inspect.

`verify` does not implement or ship. It requires `--session <id>` so it can read the prior `work` handoff and optional diff. Before Codex review, it writes `preverify-summary.json` for deterministic diff-risk findings. Critical or blocking Codex or preverify findings write `HUMAN_GATE`.

`gate` does not inspect or edit project files. It writes audit markers: `GATE_APPROVED`, `GATE_BLOCKED`, `gate-summary.json`, and `gate-events.jsonl`.

`ship` does not implement, verify, publish, deploy, or mutate the target project. It requires both prior `work` and Codex verification handoffs. It writes `SHIP_READY` only for fully approved verification or explicit human gate approval, writes `NO_SHIP` for fixable findings, and stops with a human gate when `HUMAN_GATE` is unresolved or explicitly blocked.

`report` does not implement, verify, ship, apply, call providers, or inspect project source. It reads session summaries, markers, acceptance criteria, `decision.json`, and handoffs, then writes `REPORT.md` and `report-summary.json` under the session directory.

`apply` requires `SHIP_READY`, no newer `NO_SHIP`, no unresolved gate, and a captured diff from `work --live`. It applies that diff with `git apply --3way`, records `APPLIED_DIFF`, and leaves commit/push/release actions to the human.

`run` is the compatibility-friendly wrapper around the decomposed path. It runs `work -> verify -> ship` and only runs `apply` when `--apply` is explicitly requested and `SHIP_READY` exists. New automation should prefer `run` or the explicit decomposed commands; old automation can continue to use `review` or `review-cycle`.

`build` is a session-based one-command builder wrapper on the advanced/compatibility surface (see [ADVANCED.md](ADVANCED.md)), not part of the 1.0 front surface. It defaults to `auto`, classifies task intent, selects a named mode preset (`fast`, `safe`, `team`, `tdd`, `release`) over the existing safe loop, records `build-summary.json`, writes `decision.json`, and keeps apply explicit. `start` is a compatibility alias for `build`. The 1.0 front surface is `check` + `verify-pr` (read-only verification gate); see [SCOPE-1.0.md](SCOPE-1.0.md).

`ralph` is an advanced repeated-iteration loop. Its default engine remains legacy `review` for compatibility, but `ralph --engine run` repeats the decomposed wrapper and records child run sessions. Ralph does not apply diffs; verified mutation still flows through `apply`.

`wait` is an advanced persistent wakeup daemon. It watches session `wakeup.json` files, parses the session `active` contract, and resumes only supported modes (`ralph`, `run`, `review-cycle`). It writes `wait-summary.json` / `wait-events.jsonl`, backs off failed resumes, and refuses to resume sessions with `HUMAN_GATE`.

Handoffs use five required fields:

- `Decided`
- `Rejected`
- `Risks`
- `Files`
- `Remaining`

This keeps Claude and Codex contexts separated and makes review artifacts compact enough to inspect.

## Project Root Split

NEKOWORK supports running as a tool inside another repository:

```text
target-project/
  .harness-tool/   # NEKOWORK tool checkout or submodule
  .harness/        # target project state
```

The tool root supplies catalog inputs. The target project root receives generated outputs, session state, and git-aware work.

## Authentication Model

Provider auth is delegated by default:

| Provider | Default auth |
|---|---|
| Claude | `claude` local CLI session |
| Codex | `codex` local CLI session |
| Gemini | `gemini` or Google local CLI session |

Long-lived API key environment variables are warned about or blocked before delegated provider calls unless the user explicitly opts into the metered path.

## Safety Model

Key guardrails:

- Provider CLI path trust checks reject workspace-local shims by default.
- Git mutation guards detect unexpected writes from read-only provider phases.
- Multi-worker phases must stay read-only unless a single executor phase explicitly owns mutation.
- `security-hardening` checks workflow permissions, action refs, dependency specs, MCP pins, OIDC policy, and package lock presence.
- `doctor` checks local readiness and generated-output freshness.
- Human gates remain the final stop for critical or repeated-risk changes.

## Generated Outputs

Builders project the catalog into tool-specific files:

| Target | Output |
|---|---|
| Claude Code | `.claude/` |
| Codex CLI | `.codex/config.toml` |
| Cursor | `.cursor/hooks.json` |
| Gemini CLI | `.gemini/GEMINI.md` |
| OpenCode | `.opencode/config.json` |

`scripts/repair.js` checks install-state hashes and rebuilds stale outputs.

## Release State

The current repository release line is `0.1.0-alpha.12`:

- Repository and GitHub tarball release are available.
- Public npm alpha is the slim `@ps-neko/nekowork@alpha`, currently `0.2.0-alpha.5`. The internal harness runtime `@ps-neko/nekowork-harness` is `private` and not published (source-checkout only).
- Clone, submodule, and local checkout integration remain supported for repository-pinned workflows.
