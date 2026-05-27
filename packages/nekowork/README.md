# @ps-neko/nekowork

**Local verification gate for AI-written code diffs.**

AI can write 100 lines in 10 seconds. Who checks them before they hit `main`?

This package reviews every change your AI tool makes, flags the risky parts with
deterministic rules, and lets **you** make the final call. It never commits,
pushes, or deploys on its own.

## Status

**Phase A skeleton** (2026-05-27). The 4 public verbs work via delegation to
`@ps-neko/nekowork-cli` in the monorepo. To publish this package
independently, the verify-pr code path needs to be moved into this package —
see [HANDOFF-PACKAGE-SPLIT.md](./HANDOFF-PACKAGE-SPLIT.md).

For the full alpha-stage product today, install:

```bash
npm i -g @ps-neko/nekowork-cli@alpha
```

## Quickstart (once Phase A is complete)

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
| `apply` | Apply a stored .diff iff decision.json says `apply_allowed: true` |

Anything else (`ask`, `plan`, `team`, `work`, `ship`, `build`, `auto`,
`pr-prep`, `review`, ...) belongs to `@ps-neko/nekowork-harness` (legacy and
power-user surface). The slim package rejects those verbs with a redirect.

## How it works

1. Your AI tool writes the code. `nekowork` never writes it for you.
2. `verify-pr` runs a fixed set of risk rules over the diff — same diff, same
   verdict, every time. **No LLM gets to "vote" the result.**
3. It saves the evidence into a `REPORT.md` you can read.
4. You decide at the Human Gate — approve, or don't.
5. Only then can `apply` apply the diff. No auto-commit. No auto-push.

## Docs

- [Quickstart](../nekowork-cli/docs/QUICKSTART.md)
- [How verification works](../nekowork-cli/docs/SCOPE-1.0.md)
- [Benchmark](../nekowork-cli/docs/BENCHMARK.md) — 73/74 (99%) recall, 0/47 FP, 38 real OSS positives
- [Integration](../nekowork-cli/docs/INTEGRATION.md)

## License

MIT
