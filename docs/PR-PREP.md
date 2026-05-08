# PR Prep

Planned for `0.1.0-alpha.10`.

`pr-prep` will turn a verified session into review-ready artifacts without creating a pull request or pushing code.

## Target UX

```bash
nekowork pr-prep "prepare this branch for review"
```

## Target Output

```text
REPORT.md
PR_SUMMARY.md
RISK_NOTES.md
TEST_EVIDENCE.md
CHANGELOG_DRAFT.md
ship-summary.json
```

## Contract

`pr-prep` may summarize, check, and prepare evidence. It must not:

- create a remote branch
- push commits
- open a pull request
- publish a package
- deploy infrastructure
- bypass Human Gate

The human remains responsible for commit, push, PR, release, publish, and deploy decisions.
