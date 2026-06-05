# External Run Evidence Kit

Use this kit when asking an outside user to try NEKOWORK and share public evidence.

The goal is not to collect private source code. The goal is:

```text
1 external user
1 real repo or real local project
1 transcript
1 REPORT.md trust card
1 short quote about whether the evidence/gate/apply boundary was clear
```

## Privacy Rules

- Redact secrets, tokens, private paths, customer names, private repository names, and proprietary source code.
- Paste summaries, not private diffs.
- `verify-pr` never modifies your source or git history — it only writes `REPORT.md` and `.nekowork/`. Pass `--no-write` to suppress even those if the repo is sensitive.
- Do not ask users to run `apply`, commit, push, publish, deploy, or open a PR.
- If a run touches auth, secrets, deploy, financial, or data-loss risk, keep Human Gate evidence visible.

## 10-Minute Run

The flow mirrors the 1.0 hero: the tester's AI tool writes the diff, NEKOWORK
verifies it, and they share the `REPORT.md` trust card.

1. Use any AI coding tool (Claude Code / Cursor / Codex) to make a change in a
   real repo so there is a working-tree diff. **Do not commit, push, or open a PR.**
2. Run NEKOWORK over that diff:

```bash
npx -y @ps-neko/nekowork@alpha check --json
npx -y @ps-neko/nekowork@alpha verify-pr
cat REPORT.md
cat .nekowork/decision.json
```

If the repo has `test` / `lint` / `typecheck` scripts and the diff did not touch
them, they can execute those checks too (escalation-only — a failing check
downgrades to `NEEDS_HUMAN_REVIEW`, never a standalone `BLOCK`):

```bash
npx -y @ps-neko/nekowork@alpha verify-pr --run-checks
```

If they only have time for one command after `check`, ask for:

```bash
npx -y @ps-neko/nekowork@alpha verify-pr
```

## Evidence To Request

Ask for:

- OS/shell and Node/npm versions
- install path, usually `npx @ps-neko/nekowork@alpha`
- which AI tool produced the diff (Claude Code / Cursor / Codex / other)
- redacted command transcript
- redacted `REPORT.md` trust card (Verdict / Reason / Decision / Findings)
- the `verdict` + `merge_allowed` / `apply_allowed` lines from `.nekowork/decision.json`
- whether the verdict was `BLOCK`, `NEEDS_HUMAN_REVIEW`, `INSUFFICIENT_EVIDENCE`, `ALLOW_WITH_WARNINGS`, or `ALLOW`
- whether `apply` was requested
- one short quote that can be public

## Good External Task Shapes

Prefer changes that produce a diff with a clear verdict:

- fix a failing test
- review an auth parser boundary
- check a CI or release workflow
- verify a PR diff before merging (use `--comment-file` for the GitHub comment)
- inspect a config/secrets boundary
- verify a small refactor before apply

## Public Quote Template

```text
I ran NEKOWORK verify-pr on a diff <my AI tool> wrote for <kind of project/task>.
It returned <BLOCK / NEEDS_HUMAN_REVIEW / INSUFFICIENT_EVIDENCE / ALLOW_WITH_WARNINGS / ALLOW>,
and the merge/apply boundary was <clear/confusing/useful>. I am okay with this quote being public.
```

## Maintainer Checklist

Before using the evidence in README, release notes, or case-study docs:

- confirm the user granted public quote permission
- remove private paths and private repository identifiers
- preserve the actual verdict wording where possible
- link to a public issue, discussion, gist, or repository transcript
- record the diff source (`--from-working-tree` / `--from-staged` / `--from-patch`) and whether `--run-checks` was used
- do not claim mathematical correctness; "Verified" is not mathematically proven correctness, it is independent review with recorded evidence
