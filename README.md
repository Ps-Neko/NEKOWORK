# NEKOWORK

[English](README.md) | [한국어](README.ko.md)

**AI can write 100 lines in 10 seconds. Who checks them before they hit `main`?**

NEKOWORK is a local safety gate for AI-written code. It reviews every change your
AI tool makes, flags the risky parts, and lets **you** make the final call —
it never commits, pushes, or deploys on its own.

[![CI](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)
[![npm](https://img.shields.io/npm/v/@ps-neko/nekowork/alpha?color=cb3837&logo=npm)](https://www.npmjs.com/package/@ps-neko/nekowork)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![status: public alpha](https://img.shields.io/badge/status-public%20alpha-orange)](#status--public-alpha)

<p align="center">
  <a href="https://ps-neko.github.io/NEKOWORK/?fixture=sample-pr-001">
    <img src="packages/nekowork-cli/docs/assets/hero.gif" alt="NEKOWORK blocks a risky AI-written diff" width="800" />
  </a>
  <br/>
  <em>Claude said LGTM. NEKOWORK blocked.</em> &nbsp;·&nbsp;
  <a href="https://ps-neko.github.io/NEKOWORK/?fixture=sample-pr-001"><strong>Live demo →</strong></a>
</p>

**Who it's for:** developers and teams who let Claude Code, Cursor, or Codex write
code — and want the speed without merging something unsafe.

## Quickstart

Requirements: Node.js 22+, npm, and a git repo with at least one commit.

```bash
# right after your AI tool changes some files:
npx -y @ps-neko/nekowork@alpha check        # 30-second environment check
npx -y @ps-neko/nekowork@alpha verify-pr    # scan the diff → get a verdict
```

NEKOWORK reads the diff, writes a plain-English `REPORT.md`, and tells you whether
the change is safe to merge. That's the whole loop.

## What you'll see

When your AI leaves a risk in the diff:

```text
=== verify-pr ===
  verdict        : BLOCK
  reason         : Hardcoded secret fallback detected (src/auth.ts:42)
  risk_level     : CRITICAL
  merge_allowed  : false
  apply_allowed  : false
```

Clean changes pass. Risky ones get blocked — with a reason and the exact line.

## How it works (the plain version)

1. **Your AI tool writes the code.** NEKOWORK never writes it for you.
2. **NEKOWORK runs a fixed set of risk rules** over the diff — same diff, same
   verdict, every time. No LLM gets to "vote" the result.
3. **It saves the evidence** into a report you can actually read.
4. **You decide at the Human Gate** — approve, or don't.
5. **Only then can it be applied.** No auto-commit. No auto-push. No surprise deploy.

## What it catches

Deterministic rules for the things AI tools quietly slip in — hardcoded secrets,
unsafe `process.env.X || "fallback"` patterns, risky auth/deploy edits, and more.
Full rule catalog and 1.0 scope: [docs/SCOPE-1.0.md](docs/SCOPE-1.0.md).

## What NEKOWORK is not

- Not an IDE, and not another agent pack.
- Not an autopilot that pushes code on its own.
- Not a competitor to Cursor, Claude Code, or Codex — pipe their output **through** NEKOWORK instead.

## Status — public alpha

Early alpha, and honestly looking for feedback. What's real today: published on npm,
CI green, [live demo](https://ps-neko.github.io/NEKOWORK/?fixture=sample-pr-001), and
a full test suite. One honest caveat: **"verified" means independently reviewed with
recorded evidence — not mathematically proven correct.** Found a gap or a false block?
[Open alpha feedback →](https://github.com/Ps-Neko/NEKOWORK/issues/new?template=alpha-feedback.yml)

## Docs · Contributing · License

- **Start here:** [Quickstart](docs/QUICKSTART.md) · [How verification works](docs/SCOPE-1.0.md) · [Integration](docs/INTEGRATION.md)
- **Deeper:** [Architecture](docs/ARCHITECTURE.md) · [Advanced commands](docs/ADVANCED.md) · [Vision](docs/VISION.md)
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md) — English PRs welcome.
- **License:** MIT
