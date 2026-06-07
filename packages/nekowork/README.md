# @ps-neko/nekowork

**Local verification gate for AI-written code diffs.**

AI can write 100 lines in 10 seconds. Who checks them before they hit `main`?

This package reviews every change your AI tool makes, **flags a defined set of
AI-introduced risk patterns** (11 deterministic rules: secrets, secret fallbacks,
hardcoded credentials, auto-push/commit, test/security disables, risky package
hooks, eval, insecure TLS, CORS wildcard, basic SQL/command injection, and AST
dataflow taint for variable-mediated injection) and routes everything else to a
human decision. It is **not an exhaustive security audit** — the AST rule is
intraprocedural (single-function, JS/TS); cross-function and whole-program dataflow
are out of scope. The verdict is deterministic (same diff, same result), and it never
commits, pushes, or deploys on its own. **You** make the final call.

> Note: the published `@alpha` (0.2.0-alpha.8) now ships all **11 rules** described
> above (incl. eval, insecure TLS, CORS wildcard, SQL/command injection, AST dataflow)
> and adds **one tiny, well-known dependency** (`acorn`, the JS parser — MIT, zero
> transitive dependencies) for the AST engine. Always install with the **`@alpha`**
> tag: the `latest` dist-tag is a stale `0.2.0-alpha.0` (5 rules, zero deps).

## Status

**Published alpha** (`@ps-neko/nekowork`, `@alpha` dist-tag). This package is the
published slim verification gate. Always install with the **`@alpha`** tag —
`latest` is pinned to an old `0.2.0-alpha.0` and is not the alpha line:

```bash
npm i -g @ps-neko/nekowork@alpha
```

The fuller legacy and power-user surface lives in the internal
`@ps-neko/nekowork-harness` package (not separately published). See
[HANDOFF-PACKAGE-SPLIT.md](https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork/HANDOFF-PACKAGE-SPLIT.md) for the split history.

## Quickstart

```bash
# right after your AI tool changes some files:
npx -y @ps-neko/nekowork@alpha check        # 30-sec environment check
npx -y @ps-neko/nekowork@alpha verify-pr    # scan the diff → get a verdict
```

`verify-pr` reads the diff, writes a plain-English `REPORT.md`, and tells you
whether the change is safe to merge.

## The verbs

**Primary — the 1.0 front surface. Start here:**

| Verb | What it does |
|---|---|
| `check` | Probe environment readiness (Node version, git repo, etc.) |
| `verify-pr` | Scan the working-tree diff. Produce REPORT.md + .nekowork/decision.json |

**Compatibility — session-based (legacy/advanced; not needed for the normal flow):**

| Verb | What it does |
|---|---|
| `report --session <id>` | Render that session's evidence to REPORT.md. The normal `verify-pr` path already writes REPORT.md directly — you don't need `report` for it. |
| `apply --session <id>` | Apply a stored `.diff`. Requires a completed work cycle (SHIP_READY marker + cleared Human Gate). NOT driven by verify-pr's decision.json. See [ADVANCED.md](https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/ADVANCED.md). |

Anything else (`ask`, `plan`, `team`, `work`, `ship`, `build`, `auto`,
`pr-prep`, `review`, ...) belongs to `@ps-neko/nekowork-harness` (legacy and
power-user surface). The slim package rejects those verbs with a redirect.

## How it works

1. Your AI tool writes the code. `nekowork` never writes it for you.
2. `verify-pr` runs a fixed set of risk rules over the diff — same diff, same
   verdict, every time. **No LLM gets to "vote" the result.**
3. It saves the evidence into a `REPORT.md` you can read, and writes
   `.nekowork/decision.json` with informational verdict fields (`merge_allowed`,
   `apply_allowed`). **verify-pr itself does not apply changes.**
4. You decide at the Human Gate — approve, or don't.

> verify-pr itself does not apply changes. Session-based apply is part of the
> compatibility workflow and requires SHIP_READY and a cleared Human Gate.

No auto-commit. No auto-push. `apply` is a separate, session-based compatibility
step — it is not triggered by `decision.json`.

## Docs

- [Quickstart](https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/QUICKSTART.md)
- [How verification works](https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/SCOPE-1.0.md)
- [Benchmark](https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/BENCHMARK.md) — 11 rules, 226/226 (100%) recall, 0/126 FP; ~82 real OSS positives across rules (incl. 30 on `secret-fallback`), synthetic share 62%; `hardcoded-credential` stays synthetic-only by design
- [Integration](https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/INTEGRATION.md)

## License

MIT
