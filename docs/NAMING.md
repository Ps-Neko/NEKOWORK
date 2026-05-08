# Naming

Status date: 2026-05-08

NEKOWORK keeps one public product name and one main command surface.

## Public Names

| Surface | Name | Notes |
|---|---|---|
| Product | NEKOWORK | Keep as the public project name. |
| npm package | `@ps-neko/nekowork` | Keep stable through alpha. |
| Primary CLI | `nekowork` | Preferred command name in docs and examples. |
| Legacy CLI alias | `harness` | Supported for compatibility and internal scripts, but not the main public name. |
| Main command | `build` | Beginner entrypoint for Safe Build Modes. |
| Main product surface | Safe Build Modes | `fast`, `safe`, `team`, `tdd`, and `release`. |
| Main pack/profile | `builder` | Kept as the install alias for build-centered setup. |

## Product Copy

Preferred short description:

```text
NEKOWORK is a local-first AI development runtime for fast, verified code changes.
```

Preferred supporting line:

```text
Build quickly with AI agents, verify independently with Codex, and apply only with human control.
```

Core promise:

```text
fast AI build -> Codex verification -> Human Gate -> explicit apply
```

## Naming Rules

- Do not rename the product to `NEKO`; the shorter name is too broad and less searchable.
- Do not promote `HARNESS` as the product name.
- Use `runtime`, `local runtime`, or `NEKOWORK runtime` in public docs.
- Keep `harness` only for compatibility, environment variables, generated paths, and older automation.
- Use `Safe Build Modes` when describing the `build` command family.
- Keep `builder` as the pack/profile name unless a future migration has a compatibility alias.
