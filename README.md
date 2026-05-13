# NEKOWORK

[English](README.md) | [한국어](README.ko.md)

Verifies AI-made code changes before you apply them.

[![validate](https://github.com/Ps-Neko/products-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)

Bring your coding agent. NEKOWORK proves the change before apply.

NEKOWORK is a local safety gate for AI coding tools. It checks the diff, records evidence, requires a Human Gate for risky work, and only applies a verified change when you explicitly ask it to.

Note: "Verified" means independently reviewed with recorded evidence, not mathematically proven correctness. NEKOWORK combines Codex review, test evidence, risk policy, Human Gate, and explicit apply boundaries.

Note: "ship" in NEKOWORK is a **readiness decision** (`SHIP_READY` or `NO_SHIP`), not a deployment. The `ship` step decides whether `apply` is allowed; it never commits, pushes, deploys, or publishes by itself.

Default path:

```bash
npx -y @ps-neko/nekowork@alpha check
npx -y @ps-neko/nekowork@alpha start "fix failing tests safely" --session first-start
npx -y @ps-neko/nekowork@alpha report --session latest
```

Every real `start` run puts the decision first:

```text
Verdict: BLOCKED
Reason: preverify requires Human Gate for secret env fallback
Human Gate: required
Ship ready: false
Apply allowed: false
```

And the machine-readable companion, `decision.json`:

```json
{
  "verdict": "blocked",
  "reason": "preverify requires Human Gate for secret env fallback",
  "ship_ready": false,
  "human_gate": "required",
  "apply_allowed": false,
  "diff_hash": null,
  "evidence": ["preverify-summary.json", "decision.json"]
}
```

The evidence chain is intentionally narrow:

```text
diff -> deterministic risk scan -> Codex verification -> decision.json -> REPORT.md -> Human Gate -> explicit apply
```

No auto-commit. No auto-push. No surprise deploy.

Product principle:

```text
NEKOWORK = AI-made change -> evidence -> Human Gate -> explicit apply
```

**Public alpha evidence:** 359 tests / 0 moderate+ npm audit issues / fresh `npx @alpha` smoke / 10 case-study flows / 5 starter packs

NEKOWORK does not automatically commit, push, publish, deploy, or apply diffs. `apply` is explicit and requires verified ship-ready evidence.

Use `start` first. It is the safe beginner entrypoint and prints the final decision before detailed build output. Advanced controls are documented later.

**Latest alpha evidence:** [CI badge](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml) / [npm package](https://www.npmjs.com/package/@ps-neko/nekowork) / [smoke transcript](docs/DEMO.md#one-minute-terminal-transcript) / [report artifact](docs/DEMO-REPORT.md)

**One-minute demo:** [terminal transcript](docs/DEMO.md#one-minute-terminal-transcript) / [full report example](docs/DEMO-REPORT.md) / [external run kit](docs/EXTERNAL-RUN.md) / [alpha feedback](https://github.com/Ps-Neko/NEKOWORK/issues/new?template=alpha-feedback.yml) / [roadmap](docs/ROADMAP.md)

![NEKOWORK one-minute terminal demo](docs/assets/demo-terminal.svg)

## One Command. One Blocked Risk.

```bash
npx -y @ps-neko/nekowork@alpha start "add OPENAI_API_KEY fallback for Codex auth"
```

Typical blocked-risk evidence:

```text
Verdict: BLOCKED
Reason: preverify requires Human Gate for secret env fallback
Human Gate: required
Ship ready: false
Apply allowed: false

Blocked because NEKOWORK defaults to delegated CLI auth and rejects long-lived provider API key paths unless the human explicitly opts in.
```

That is the thesis: the coding agent can produce the change, but risky ship/apply decisions stay evidence-backed and human-controlled.

## 30-Second First Run

Requirements: Node.js 22+, npm, and git.

```bash
npx -y @ps-neko/nekowork@alpha check
npx -y @ps-neko/nekowork@alpha start "fix failing tests safely" --session first-start
npx -y @ps-neko/nekowork@alpha report --session latest
```

Start with `start` when you want the simplest safe entrypoint. It is the only command a new user needs before reading the report.

Source checkout for local development:

```bash
node scripts/cli.js check
node scripts/cli.js start "implement this safely" --session first-start
node scripts/cli.js report --session latest
```

The simple path maps to the evidence loop: `check = doctor --quick`, `start = build`, `report = readable evidence`, and `apply = explicit verified diff application`. See [docs/QUICKSTART.md](docs/QUICKSTART.md) for the longer first-run guide.

## Works With Your Existing AI Workflow

Use Claude Code, Cursor, Codex, Superpowers, GStack, or your own domain workflow to produce the candidate change. NEKOWORK begins after that: deterministic risk scan, independent verification, `decision.json`, `REPORT.md`, Human Gate, and explicit apply.

For the artifact contract between upstream domain/spec workflows and NEKOWORK, see [docs/INTEGRATION.md](docs/INTEGRATION.md). The optional `context.md` / `DOMAIN.md` / `SPEC.md` / `PLAN.md` files are auto-picked from the project root or passed via `--context-file` / `--domain-file` / `--spec-file` / `--plan-file`.

## Example Report

`report` is the main trust surface. It turns session evidence into a readable `REPORT.md`:

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
- preverify-summary.json
- verify-summary.json
- ship-summary.json
- decision.json
- gate-summary.json
```

The first screen of `REPORT.md` is the trust card: work produced, deterministic preverify findings, independent verification, Human Gate, ship readiness, apply state, and whether the target project was mutated. The machine-readable companion is `decision.json`, which consolidates verdict, reason, risk, ship readiness, Human Gate state, apply permission, diff hash, and evidence paths.

See the full report contract and example artifact in [docs/DEMO-REPORT.md](docs/DEMO-REPORT.md), and the one-minute terminal transcript in [docs/DEMO.md](docs/DEMO.md).

## Main Surface

The user-facing CLI is intentionally small. Three layers:

**Beginner — start here:**

- `check` — local readiness probe
- `start` — safe beginner entrypoint, prints verdict first
- `report` — readable evidence into `REPORT.md`
- `apply` — explicit verified diff application (refuses without `SHIP_READY` and clear gate)

**Advanced — phase control:**

- `ask` / `plan` / `team` / `work` — decomposed authoring with single-executor writes
- `verify` / `gate` / `ship` — Codex verification, Human Gate, ship-readiness handoff
- `build` / `auto` / `run` — wrappers over the safety gate; `auto` and `build` never accept `--apply`
- `pr-prep` — review-ready local artifacts without branch, commit, push, or PR

**Legacy — compatibility:**

- `review` / `review-cycle` — older full Claude-led / Codex-reviewed workflow
- `harness` binary — legacy alias for `nekowork`

Full stage contract: [docs/CLI-STAGES.md](docs/CLI-STAGES.md). Build modes and routing: [docs/BUILD.md](docs/BUILD.md). Bounded autonomy and the apply boundary: [docs/AUTONOMY.md](docs/AUTONOMY.md). Advanced runtime (`ralph`, `wait`, instincts, cost tracking, Rust supervisor): [docs/ADVANCED.md](docs/ADVANCED.md).

## Starter Packs

Start with these five public packs. The full catalog is in [docs/CATALOG-PACKS.md](docs/CATALOG-PACKS.md).

| Pack | Adds | Use when |
|---|---|---|
| `core` | minimal verification runtime | first install or repo smoke |
| `builder` | safe build modes entrypoint | one-command build with verification and gates |
| `productivity` | planning, TDD, debugging, finish routines | daily AI-assisted development |
| `security` | auth/secrets/deploy risk prompts | sensitive changes |
| `release` | ship/no-ship evidence | pre-release checks |

Pack discovery and install:

```bash
node scripts/install-plan.js --list
node scripts/install-plan.js --pack productivity
node scripts/install-apply.js --profile developer --project-root <target>
```

## Status

- Current repository version: `0.1.0-alpha.10` alpha candidate
- Current package name: `@ps-neko/nekowork`
- Published CLI name: `nekowork` (`harness` remains a legacy/internal alias)
- Current npm alpha: `@ps-neko/nekowork@0.1.0-alpha.9`
- Current npm alpha.10 status: repository candidate; npm `@alpha` remains `0.1.0-alpha.9` until publish
- Default mode: mock providers, no API keys, no provider CLI calls

Current local verification:

- `npm run lint`: pass
- `npm test`: 359 tests pass
- `npm audit --audit-level=moderate`: 0 vulnerabilities
- `npm pack --dry-run --json`: pass
- `npx -y @ps-neko/nekowork@alpha check`: pass with warnings only

Live provider auth delegates to local CLI sessions (`claude auth status`, `codex login`, `gemini`). Long-lived API key env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`) are blocked by default unless `HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1`. See [docs/SETUP.md](docs/SETUP.md).

## Why NEKOWORK

NEKOWORK is for teams that want AI-assisted development without making the agent catalog the product. The default path keeps local auth, inspectable handoffs, single-executor writes, independent Codex verification, and Human Gate decisions in front of risky ship/apply steps.

NEKOWORK packages one source catalog, `agent.yaml`, projected into Claude Code, Codex CLI, Cursor, Gemini CLI, and OpenCode surfaces.

NEKOWORK is intentionally not a 100-agent pack. Every agent, skill, hook, profile, module, and pack must improve verification, preserve one-executor writes, produce auditable evidence, and respect Human Gate. Advanced autonomy, parallel candidates, PR prep, and agentic harness patterns are documented after the quickstart because they are optional.

For comparison and positioning: [docs/WHY-NEKOWORK.md](docs/WHY-NEKOWORK.md).

## Documentation

Core:

- [docs/QUICKSTART.md](docs/QUICKSTART.md) — first run and common paths
- [docs/CLI-STAGES.md](docs/CLI-STAGES.md) — stage contract and compatibility transition
- [docs/INTEGRATION.md](docs/INTEGRATION.md) — artifact contract for upstream domain/spec workflows
- [docs/BUILD.md](docs/BUILD.md) — build command modes and invariants
- [docs/AUTONOMY.md](docs/AUTONOMY.md) — bounded autonomy and the apply boundary
- [docs/SAFETY-GUARANTEES.md](docs/SAFETY-GUARANTEES.md) — what NEKOWORK guarantees
- [docs/FAILURE-MODES.md](docs/FAILURE-MODES.md) — what happens when gates fail

Demos and evidence:

- [docs/DEMO.md](docs/DEMO.md) — sample command output
- [docs/DEMO-REPORT.md](docs/DEMO-REPORT.md) — readable session report UX
- [docs/EXTERNAL-RUN.md](docs/EXTERNAL-RUN.md) — external run kit
- [docs/case-studies](docs/case-studies) — real external project evidence

Reference:

- [docs/ADVANCED.md](docs/ADVANCED.md) — `ralph`, `wait`, instincts, cost tracking, Rust supervisor
- [docs/CATALOG-PACKS.md](docs/CATALOG-PACKS.md) — curated catalog and official packs
- [docs/PORTING.md](docs/PORTING.md) — repository-pinned install into another project
- [docs/PR-PREP.md](docs/PR-PREP.md) — PR prep artifact contract
- [docs/RELEASE-READINESS.md](docs/RELEASE-READINESS.md) — release and publish gates
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system architecture
- [docs/PRODUCT-PRINCIPLES.md](docs/PRODUCT-PRINCIPLES.md) — product invariants and CLI phase semantics
- [docs/ROADMAP.md](docs/ROADMAP.md) — alpha roadmap and non-goals
- [SOUL.md](SOUL.md), [RULES.md](RULES.md), [AGENTS.md](AGENTS.md) — project principles and agent rules

## License

MIT
