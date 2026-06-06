# Naming

Status date: 2026-06-06

NEKOWORK keeps one public product name and a small, stable command surface.

## Public Names

| Surface | Name | Notes |
|---|---|---|
| Product | NEKOWORK | Keep as the public project name. |
| npm package | `@ps-neko/nekowork` | Keep stable through alpha. |
| Primary CLI | `nekowork` | Preferred command name in docs and examples. |
| Legacy CLI alias | `harness` | Supported for compatibility and internal scripts, but not the main public name. |
| Main commands (1.0 front surface) | `check`, `verify-pr` | Read-only verification gate (deterministic rules + evidence + Human Gate). `build` and the other session/wrapper commands are compatibility/labs — see [ADVANCED.md](ADVANCED.md). |
| Main product surface | Verification gate | `check` + `verify-pr` decide the verdict from the diff. Safe Build Modes (`build` family: `auto`, `fast`, `safe`, `team`, `tdd`, `release`) are compatibility/labs. |
| Main pack/profile | `builder` | Kept as the install alias for build-centered setup. |

## Product Copy

Preferred short description:

```text
NEKOWORK is a local verification gate for AI-written code diffs — deterministic rules decide the verdict, never the LLM.
```

Preferred supporting line:

```text
Bring your AI tool to write the diff. NEKOWORK verifies it with deterministic rules; you decide at the Human Gate.
```

Core promise:

```text
AI writes the diff -> deterministic risk rules + checks -> evidence + verdict -> Human Gate -> human merge decision
```

## Naming Rules

- Do not rename the product to `NEKO`; the shorter name is too broad and less searchable.
- Do not promote `HARNESS` as the product name.
- Use `runtime`, `local runtime`, or `NEKOWORK runtime` in public docs.
- Keep `harness` only for compatibility, environment variables, generated paths, and older automation.
- Use `Safe Build Modes` when describing the `build` command family.
- Keep `builder` as the pack/profile name unless a future migration has a compatibility alias.
