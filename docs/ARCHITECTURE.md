# Architecture

NEKOWORK packages the HARNESS runtime as a local-first AI development harness. The project keeps one canonical catalog and projects it into multiple agent surfaces.

## Core Idea

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

## Runtime Shape

```text
User command
  |
  +--> scripts/cli.js
        |
        |-- doctor
        |-- install plan/apply
        |-- review / plan
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

## Public Flow

The public alpha surface is intentionally small:

```bash
node scripts/cli.js doctor
node scripts/cli.js install --plan --profile developer
node scripts/cli.js install --apply --profile developer --project-root <target>
node scripts/cli.js plan "target project smoke" --project-root <target>
node scripts/cli.js review "change request" --no-ship --project-root <target>
```

Advanced features are documented separately:

- `team-lite`
- `ralph`
- instincts
- cost tracking
- Rust runtime

## Review Pipeline

The main workflow is Claude-led and Codex-reviewed:

```text
ideate
  -> plan
  -> implement
  -> self-review
  -> codex-review
  -> codex-challenge when secure or sensitive
  -> ship when not --no-ship
```

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

The current release line is `0.0.3`:

- Repository and GitHub tarball release are available.
- Public npm publishing is disabled with `private: true`.
- Clone, submodule, and local checkout integration are the supported install paths.
