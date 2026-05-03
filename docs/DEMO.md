# Demo

This demo uses mock providers. It does not call Claude, Codex, Gemini, or paid APIs.

## Command

```bash
node scripts/cli.js review "check the project setup" --no-ship --session demo-readme
```

## Example Output

```text
[review:demo-readme] task: check the project setup
[review:demo-readme] mode: mock --no-ship
[review:demo-readme] 1 ideate
[review:demo-readme] 2 plan
[review:demo-readme] 3 implement
[review:demo-readme] 4 self-review (round 1)
[review:demo-readme] fix-loop: executor round 2
[review:demo-readme] 4 self-review (round 2)
[review:demo-readme] 5 codex-review
[review:demo-readme] 6 codex-challenge skipped (sensitive not detected, --secure not set)
[review:demo-readme] 7 ship skipped (--no-ship)
```

## Generated Files

```text
.harness/state/sessions/demo-readme/
  prd.json
  progress.txt
  handoffs/
    01-ideate.md
    02-plan.md
    03-implement.md
    04-self-review.md
    04-self-review-r2.md
    05-codex-review.md
```

Each handoff follows the same five-field shape:

- Decided
- Rejected
- Risks
- Files
- Remaining

## Security-Sensitive Demo

Use `--secure` to force the Codex challenge stage:

```bash
node scripts/cli.js review "change auth token validation" --secure --no-ship --session demo-secure
```

Expected behavior:

- `codex-review` runs
- `codex-challenge` runs
- `ship` is skipped because `--no-ship` is set

## Doctor Demo

```bash
node scripts/cli.js doctor --quick
```

Example shape:

```text
NEKOWORK doctor
harness root : C:\path\to\harness
project root : C:\path\to\harness

STATUS  CHECK                   MESSAGE
PASS    node                    Node 24.x
PASS    package metadata        @ps-neko/nekowork@0.0.2; private publish disabled
PASS    git worktree            project root is inside a git worktree
WARN    gemini cli              installed, auth status is not checked non-interactively

summary: WARN
```
