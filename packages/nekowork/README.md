# @ps-neko/nekowork

**Local verification gate for AI-written code diffs.**

AI can write 100 lines in 10 seconds. Who checks them before they hit `main`?

This package reviews every change your AI tool makes, flags the risky parts with
deterministic rules, and lets **you** make the final call. It never commits,
pushes, or deploys on its own.

## Status

**Published alpha** (`@ps-neko/nekowork`, alpha dist-tag). This package is the
published slim verification gate. Install with:

```bash
npm i -g @ps-neko/nekowork
```

The fuller legacy and power-user surface lives in the internal
`@ps-neko/nekowork-harness` package (not separately published). See
[HANDOFF-PACKAGE-SPLIT.md](./HANDOFF-PACKAGE-SPLIT.md) for the split history.

## Quickstart

```bash
# right after your AI tool changes some files:
npx -y @ps-neko/nekowork check        # 30-sec environment check
npx -y @ps-neko/nekowork verify-pr    # scan the diff → get a verdict
```

`verify-pr` reads the diff, writes a plain-English `REPORT.md`, and tells you
whether the change is safe to merge.

## The 4 verbs

| Verb | What it does |
|---|---|
| `check` | Probe environment readiness (Node version, git repo, etc.) |
| `verify-pr` | Scan working-tree diff. Produce REPORT.md + .nekowork/decision.json |
| `report` | Render an existing decision.json to a human-readable REPORT.md |
| `apply` | Session-based compatibility apply. Requires a completed work cycle (SHIP_READY marker + cleared Human Gate). NOT driven by verify-pr's decision.json. See [ADVANCED.md](../nekowork-cli/docs/ADVANCED.md). |

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

- [Quickstart](../nekowork-cli/docs/QUICKSTART.md)
- [How verification works](../nekowork-cli/docs/SCOPE-1.0.md)
- [Benchmark](../nekowork-cli/docs/BENCHMARK.md) — 73/74 (99%) recall, 0/47 FP, 38 real OSS positives
- [Integration](../nekowork-cli/docs/INTEGRATION.md)

## License

MIT
