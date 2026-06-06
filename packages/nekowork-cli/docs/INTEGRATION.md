# Workflow Integration

NEKOWORK should stay narrow. It is not a domain-interview, DDD, or product-discovery tool. Use your preferred upstream workflow to produce the domain context, product spec, implementation plan, and candidate change. NEKOWORK begins at the trust boundary: verify the AI-made change, record evidence, require Human Gate when needed, and apply only on explicit command.

```text
domain/spec workflow -> candidate change -> NEKOWORK safety gate
```

## Position

```text
Bring your coding agent. NEKOWORK proves the change before apply.
```

In practice, "proves" means reviewed with recorded evidence, deterministic risk checks, independent verification, and Human Gate policy. It does not mean mathematically proven correctness.

## Artifact Contract

These files are optional, but they are the recommended handoff contract between upstream discovery/planning workflows and NEKOWORK.

| Artifact | Produced by | NEKOWORK consumption |
|---|---|---|
| `context.md` | Domain interview, office-hours, brainstorming | `ask` context root for terminology, constraints, and user language |
| `DOMAIN.md` | DDD or architecture boundary pass | `plan` scope boundary input for concepts, modules, and ownership |
| `SPEC.md` | Product/spec review, including excluded features | `plan` acceptance criteria and risk framing |
| `PLAN.md` | Implementation planning workflow | `team` and `work` task units for read-only review and single-executor implementation |

Recommended flow:

```text
context.md + DOMAIN.md + SPEC.md + PLAN.md
  -> ask
  -> plan
  -> team
  -> work
  -> verify
  -> ship (decides SHIP_READY or NO_SHIP)
  -> Human Gate (if open)
  -> report
  -> explicit apply
```

Evidence written along the way: `decision.json`, `preverify-summary.json`, `verify-summary.json`, `ship-summary.json`, `gate-summary.json`, and `REPORT.md`. Apply refuses to run without `SHIP_READY` and a cleared gate.

Terminology note: `ship` in NEKOWORK is a **readiness decision** (`SHIP_READY` or `NO_SHIP`), not a deployment. It decides whether `apply` is allowed and never commits, pushes, publishes, or deploys by itself.

If these files do not exist, NEKOWORK still works from the task prompt and session artifacts. The contract is for richer upstream workflows, not a new requirement for every change.

## How the contract is wired

Each stage either auto-picks a canonical file from the project root or accepts an explicit flag. Missing canonical files are silent; an explicit flag pointing at a missing file is a fatal error so typos cannot be masked.

| Stage | Auto-pick | Explicit flag | Evidence file |
|---|---|---|---|
| `ask` | `<projectRoot>/context.md` | `--context-file <path>` | `ask.json.upstream_artifacts.context` |
| `plan` | `<projectRoot>/{context,DOMAIN,SPEC}.md` | `--context-file`, `--domain-file`, `--spec-file` | `plan-inputs.json.upstream` |
| `work` | `<projectRoot>/PLAN.md` | `--plan-file <path>` | `work-summary.json.upstream.plan` |

Loaded artifacts are recorded with `path`, `source` (`auto` or `explicit`), `size`, `sha1`, `truncated`, and an `excerpt` (capped at 16 KiB). Downstream stages can read these files to reconstruct the upstream context without re-reading the source artifact.

## Scope Rules

Do not run the full hybrid workflow for every task.

| Work type | Recommended path |
|---|---|
| Bug fix, refactor, or docs-only change | `check` then `verify-pr` (read-only gate; ends at the human merge decision). Session-based `apply` is a separate compatibility step, allowed only after a completed work cycle with `SHIP_READY` and a cleared Human Gate. |
| Small feature with clear domain | Upstream brainstorm or writing plan -> NEKOWORK safety gate |
| Large feature with unclear domain | Domain interview + `context.md` + `DOMAIN.md` + `SPEC.md` + `PLAN.md` -> full NEKOWORK cycle |
| Prototype or throwaway experiment | Use the upstream workflow only; skip NEKOWORK unless the result will be applied to a real repo |
| Security, auth, payment, deploy, or permission change | Full NEKOWORK cycle with strict verification and Human Gate expectation |

## Non-Goals

NEKOWORK should not absorb upstream discovery features into the core runtime:

- no built-in domain interview system
- no DDD generator as a core feature
- no product-discovery suite
- no automatic memory adoption from upstream context
- no automatic apply, commit, push, publish, deploy, or PR creation

The integration point is the artifact contract. Upstream tools own domain clarity. NEKOWORK owns the evidence-backed apply boundary.

## CI / pre-commit

### GitHub Actions

Use the `Ps-Neko/NEKOWORK` composite action to gate PRs automatically:

```yaml
# .github/workflows/verify-pr.yml
name: verify-pr
on:
  pull_request:
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5
      - uses: Ps-Neko/NEKOWORK@v1
        with:
          args: '--comment-file pr-comment.md'
```

The action installs Node.js ≥ 22 automatically. Pass additional flags to `verify-pr`
via the `args` input. The `@v1` tag tracks the current stable release.

### pre-commit hook

For local safety before each commit, add this to your `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/Ps-Neko/NEKOWORK
    rev: v1          # pin to a specific tag or SHA
    hooks:
      - id: nekowork-verify-pr
```

Then run `pre-commit install` once. After that, every `git commit` scans the
staged diff with `nekowork verify-pr --from-staged` and blocks if the gate fails.

Requires Python's `pre-commit` tool (`pip install pre-commit`).

## Concrete recipes

For a catalog of tools that produce `context.md`, `DOMAIN.md`, `SPEC.md`, and `PLAN.md` (brainstorming skill, gstack `/office-hours`, DDD passes, `writing-plans`, etc.), see [UPSTREAM-RECIPES.md](UPSTREAM-RECIPES.md).

