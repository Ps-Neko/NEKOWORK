# Show HN draft — NEKOWORK

> Title and body for a Show HN post. Final submission is a human decision.

## Title (recommended)

**Show HN: NEKOWORK – a local, deterministic gate for AI-written diffs**

(Alt: `Show HN: I built a CI gate that catches hardcoded secrets in AI-written diffs`)

## Body

I keep watching AI coding tools (Cursor, Claude Code, Codex) write 100 lines in 10 seconds. The lines look fine. Sometimes one of them is `const token = process.env.AUTH_TOKEN || "dev-token-not-rotated";`. Nobody re-reads every line — that's why a project ends up with a hardcoded fallback secret on `main`.

NEKOWORK is one verb: `nekowork verify-pr`. It reads the working-tree diff, runs a fixed set of deterministic rules, and emits a verdict + a human-readable `REPORT.md`. No LLM votes on the verdict. Same diff in, same verdict out.

Try it in 60 seconds in any git repo your AI tool just touched:

```
npx -y @ps-neko/nekowork verify-pr
```

What it catches today:

- Hardcoded secrets and PATs (AWS, Stripe, GitHub, Slack, Google, PEM).
- Disabled tests / security checks (`it.skip`, `xit`, `pytest.mark.skip`, `@ts-nocheck`, file-wide `eslint-disable`).
- Auto-commit / auto-push / auto-merge attempts (`git push --force`, `auto-merge: true`, `spawnSync git push`).
- Install-script supply-chain risk (`curl | bash`, `postinstall`, git/tarball URL deps).
- Changes with too little evidence to trust.

It is **only** a gate. It never commits, pushes, merges, or deploys. Humans decide at the gate.

CI integration is two lines (composite GitHub Action) or one entry in `.pre-commit-config.yaml`. Local first — no SaaS, no telemetry, no account.

Repo: https://github.com/Ps-Neko/NEKOWORK
License: MIT

I'd love feedback on:
- Rules that fired (true positive) or didn't (false negative) on your real PRs.
- Whether `verify-pr`'s output is readable for non-author reviewers.
- Whether the 60-second `npx` path actually works in 60 seconds for you.
