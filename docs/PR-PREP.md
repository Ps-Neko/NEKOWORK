# PR Prep

`pr-prep` turns a verified NEKOWORK session into review-ready local artifacts without creating a branch, commit, push, pull request, release, publish, deploy, or apply action.

Use it after `auto`, `build`, `run`, or an advanced phase-level workflow has produced ship/no-ship evidence:

```bash
nekowork pr-prep --session latest
nekowork pr-prep "prepare parser fix for review" --session auto-2026-05-13-abcd
```

## Output

`pr-prep` writes these files into the existing session directory:

```text
REPORT.md
PR_SUMMARY.md
RISK_NOTES.md
TEST_EVIDENCE.md
CHANGELOG_DRAFT.md
SHIP_DECISION.md
pr-prep-summary.json
```

`REPORT.md` also gains a `PR Prep` section listing the generated artifacts and whether the session is ready for human PR review.

## Contract

`pr-prep` may summarize, check, and prepare evidence. It must not:

- create a remote branch
- create a commit
- push code
- open a pull request
- publish a package
- deploy infrastructure
- apply a diff
- bypass Human Gate

The human remains responsible for commit, push, PR, release, publish, deploy, and apply decisions.

## Readiness

`pr-prep` marks a session ready for PR only when the session is ship-ready and has no active `NO_SHIP` or `HUMAN_GATE` state.

Blocked sessions still get artifacts, but `SHIP_DECISION.md` and `pr-prep-summary.json` record `ready_for_pr: false` so reviewers can see why the change should not be opened or updated yet.
