# Demo

This demo uses mock providers. It does not call Claude, Codex, Gemini, or paid APIs.

## Quick Build Demo

```bash
npm run demo:quick -- --cleanup
```

This is the shortest demo path. It creates a disposable target project, runs `check`, runs `build = mode preset over run`, generates `REPORT.md`, checks `gate status`, and removes the target when `--cleanup` is set.

Expected shape:

```text
NEKOWORK quick run demo
doctor ... OK
build workflow ... OK
report ... OK
gate status ... OK
Demo completed: mode=team, verdict=approve_with_fixes, ship_ready=false, applied=false
```

## One-minute Terminal Transcript

This transcript is the README-friendly demo path. It uses mock providers, so it is safe to run on a fresh checkout without Claude, Codex, Gemini, or API keys.

![NEKOWORK one-minute terminal demo](assets/demo-terminal.svg)

```text
$ npx -y @ps-neko/nekowork@alpha check
NEKOWORK doctor
STATUS  CHECK              MESSAGE
PASS    node               Node 22+
PASS    package metadata   @ps-neko/nekowork
PASS    api key env        no delegated-provider API key overrides detected
summary: PASS

$ npm run demo:quick -- --cleanup
NEKOWORK quick run demo
doctor ... OK
build workflow ... OK
report ... OK
gate status ... OK
Demo completed: mode=team, verdict=approve_with_fixes, ship_ready=false, applied=false

$ node scripts/cli.js report --session latest --stdout
# NEKOWORK Report
Status: no_ship
Verdict: approve_with_fixes
Ship ready: false
Human gate: clear
Applied: false
Evidence: build-summary.json, work-summary.json, verify-summary.json, ship-summary.json
```

The quick demo writes:

```text
.harness/state/sessions/<session>/REPORT.md
.harness/state/sessions/<session>/report-summary.json
```

## External Project Demo

```bash
npm run demo:external
```

This creates a tiny disposable target project, applies the `developer` profile, runs `check`, and writes a planning session into the target project's `.harness/` directory. See [EXAMPLE-PROJECT.md](EXAMPLE-PROJECT.md) for details.

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
PASS    package metadata        @ps-neko/nekowork@0.1.0-alpha.8; public alpha package
PASS    git worktree            project root is inside a git worktree
WARN    gemini cli              installed, auth status is not checked non-interactively

summary: WARN
```
