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
PASS    package metadata        @ps-neko/nekowork@0.2.0-alpha.2; public alpha package
PASS    git worktree            project root is inside a git worktree
WARN    gemini cli              installed, auth status is not checked non-interactively

summary: WARN
```

## Tampering the verdict is futile (determinism)

`verify-pr` decides the verdict by recomputing it from the diff on **every run**.
The recorded `REPORT.md` / `.nekowork/decision.json` are records, not the gate —
editing them changes nothing, because the next run re-derives the verdict from the
actual change.

Run it yourself (isolated sandbox — your project is never touched):

```bash
npm run demo:tamper
```

What it shows:

1. An AI leaves a secret fallback in `src/auth.ts` → `verify-pr` returns **BLOCK**.
2. Someone edits `.nekowork/decision.json` to say `ALLOW`.
3. `verify-pr` runs again → **BLOCK** again. The forged record is ignored; the
   verdict is recomputed from the diff.

An optional LLM advisor saying "LGTM" does not change this — the deterministic
rules decide the verdict; the advisor never controls it.

> Honest scope: this demonstrates **determinism** (re-running re-derives the
> verdict). It does **not** claim cryptographic tamper-detection of stored
> artifacts — that is separate hardening tracked in the roadmap.
