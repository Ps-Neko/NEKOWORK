# Demo

This demo uses no providers — `verify-pr` is deterministic. It does not call Claude, Codex, Gemini, or paid APIs.

## verify-pr in 30 seconds

```bash
npx -y @ps-neko/nekowork@alpha check
npx -y @ps-neko/nekowork@alpha verify-pr
cat REPORT.md
cat .nekowork/decision.json
```

`check` confirms the environment. `verify-pr` scans the working-tree diff with deterministic risk rules and writes `REPORT.md` + `.nekowork/decision.json` at the project root. Full artifacts: [DEMO-REPORT.md](DEMO-REPORT.md).

## One-minute Terminal Transcript

This is the README-friendly path. It uses no providers, so it is safe to run on a fresh checkout without Claude, Codex, Gemini, or API keys. Here an AI tool slipped `process.env.JWT_SECRET || 'dev-secret-change-in-production'` into `src/auth.ts`:

```text
$ npx -y @ps-neko/nekowork@alpha check
NEKOWORK doctor
STATUS  CHECK              MESSAGE
PASS    node               Node 22+
PASS    package metadata   @ps-neko/nekowork
PASS    api key env        no delegated-provider API key overrides detected
summary: PASS

$ npx -y @ps-neko/nekowork@alpha verify-pr
=== verify-pr ===
  verdict        : BLOCK
  reason         : Hardcoded secret fallback detected (src/auth.ts:4)
  risk_level     : CRITICAL
  merge_allowed  : false
  apply_allowed  : false
  changed_files  : 1 (+3 -1)
  findings       : critical=1 high=0 medium=0 low=0
  top findings:
    - [CRITICAL] Hardcoded secret fallback detected (src/auth.ts:4)
  report         : REPORT.md
  decision       : .nekowork/decision.json

$ echo $?
2
```

`verify-pr` wrote `REPORT.md` and `.nekowork/decision.json`. The exit code is the verdict (`BLOCK` = 2), so CI fails the check. Full report contract: [DEMO-REPORT.md](DEMO-REPORT.md).

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
PASS    package metadata        @ps-neko/nekowork@0.1.0-alpha.12; public alpha package
PASS    git worktree            project root is inside a git worktree
WARN    gemini cli              installed, auth status is not checked non-interactively

summary: WARN
```

## Legacy session demos (advanced — removed in 2.0)

The session-based commands (`build`, `review`, `report --session`, `ship`, `gate`) are a compatibility surface documented in [ADVANCED.md](ADVANCED.md) and scheduled for removal in 2.0 ([SCOPE-1.0.md](SCOPE-1.0.md)). They still run on mock providers:

```bash
npm run demo:quick -- --cleanup        # disposable target: build -> report -> gate status
npm run demo:external                  # writes a planning session into a target project's .harness/
node scripts/cli.js review "check the project setup" --no-ship --session demo-readme
```

For the security-sensitive Codex-challenge path, add `--secure`:

```bash
node scripts/cli.js review "change auth token validation" --secure --no-ship --session demo-secure
```

These write session evidence under `.harness/state/sessions/<id>/` (handoffs, summaries, `REPORT.md`). Each handoff follows the five-field shape: Decided / Rejected / Risks / Files / Remaining. See [EXAMPLE-PROJECT.md](EXAMPLE-PROJECT.md) and [ADVANCED.md](ADVANCED.md).
