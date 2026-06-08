# Quickstart

Get from a clean checkout to your first verdict in two commands.

NEKOWORK's job is narrow on purpose: **check AI-written code before it enters your
project.** It reads what changed, runs deterministic risk rules, and gives you a
verdict. It does not write, commit, push, merge, or deploy.

## 1. The 30-Second Path (npm)

Requirements: Node.js 22+, npm, and a git repository with at least one commit.

After your AI tool (Cursor / Claude Code / Codex) changes some files:

```bash
npx -y @ps-neko/nekowork@alpha check        # environment check (~30s)
npx -y @ps-neko/nekowork@alpha verify-pr     # scan the diff, write a verdict
```

`verify-pr` reads your changed lines, runs the deterministic risk rules, writes a
plain-English `REPORT.md` and a machine-readable `.nekowork/decision.json`, and
prints a verdict.

Tip: add `.nekowork/` and `REPORT.md` to `.gitignore` — they are NEKOWORK's
evidence output, not changes to commit.

Read the result:

```bash
cat REPORT.md
cat .nekowork/decision.json
```

Example when a change is blocked:

```text
=== verify-pr ===
  verdict        : BLOCK
  reason         : Hardcoded secret fallback detected (src/auth.ts:4)
  risk_level     : CRITICAL
  merge_allowed  : false
  apply_allowed  : false
```

`check` probes environment readiness: Node.js version, package metadata, git
state, API key overrides, and provider CLI presence. It is one of the four verbs
the published slim package supports.

## 2. What verify-pr Looks At

verify-pr defaults to your working-tree diff. You can point it elsewhere:

```bash
npx -y @ps-neko/nekowork@alpha verify-pr                       # working tree (default)
npx -y @ps-neko/nekowork@alpha verify-pr --from-staged         # staged changes only
npx -y @ps-neko/nekowork@alpha verify-pr --from-patch out.diff # a saved patch file
npx -y @ps-neko/nekowork@alpha verify-pr --range origin/main...HEAD  # a commit range
npx -y @ps-neko/nekowork@alpha verify-pr --full-scan           # the whole tree
```

It then runs eleven deterministic risk rules over the changed lines:

- **Secret fallback** — `process.env.X || "literal"` and similar hardcoded fallbacks.
- **Auto commit / push / apply** — code that tries to `git push`, auto-merge, `rm -rf`, etc.
- **Hardcoded credential** — API keys, tokens, passwords, private keys in code.
- **Test or security disable** — mass `*.skip`, `eslint-disable`, `ts-ignore`, or CI checks removed.
- **Package / lockfile risk** — dependency, script, and `postinstall`/`preinstall` changes.
- **eval usage** — `eval(...)` and `new Function(...)` dynamic-code execution.
- **Insecure TLS** — `rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`, etc.
- **CORS wildcard** — `Access-Control-Allow-Origin: *` on credentialed endpoints.
- **SQL injection (basic)** — string-concatenated SQL query shapes (regex-level only).
- **Command injection (basic)** — user input flowing into `exec`/`spawn` shells (regex-level only).
- **AST dataflow** — AST/dataflow taint for **variable-mediated injection** that the regex rules miss (assembled SQL/`eval`/shell across statements, local-helper returns, sink aliases). Inter-procedural (intra-module, single-file), JS/TS-only.

NEKOWORK is **primarily a JS/TS scanner**. Several regex rules add a **few
representative Python and Go patterns** (e.g. `subprocess` git push,
`os.system`/`exec.Command`, `verify=False` / `InsecureSkipVerify`, `os.environ.get`
fallbacks) — useful samples, **not full multi-language support**. The `ast-dataflow`
rule is JS/TS-only. Match this honest framing in [BENCHMARK.md](BENCHMARK.md).

All eleven rules currently sit at 100% recall / 0% false positives on their
fixture corpus and pass the 0.95 detection gate. After the OSS-fixture merge most
rules carry **real OSS positives** (`eval-usage`, `insecure-tls`, `cors-wildcard`,
`sql-injection`, `command-injection`, and `ast-dataflow` each add 6, on top of
`secret-fallback`'s 30); only `hardcoded-credential` stays **synthetic-only by design**
(see the ethical note in BENCHMARK.md). The two injection
rules are **basic regex shapes** and `ast-dataflow` is **inter-procedural but
intra-module (single-file)** — most injection classes (and anything needing cross-file/
whole-program dataflow) are out of scope. Ten of the rules are pure regex; `ast-dataflow` adds **one tiny, well-known
dependency** (`acorn`, the JS parser — MIT, zero transitive dependencies). See
[BENCHMARK.md](BENCHMARK.md) for the per-rule provenance and the full "What is NOT
covered" boundary.

### Checks: detection + execution (`--run-checks`)

verify-pr looks at whether your project *has* test / lint / typecheck / build /
audit commands. By default it **detects** which exist and records them in the
report. That detection feeds the verdict: a source change with **no** test
command returns `INSUFFICIENT_EVIDENCE` ("not enough evidence to PASS", not a
failure) instead of a false PASS.

Detection alone is not verification, so the published slim `@ps-neko/nekowork`
gate makes a clean PASS something you **earn**:

- A **source** change is only `ALLOW`ed when its checks actually ran and passed.
  Without `--run-checks` a source change is `NEEDS_HUMAN_REVIEW` ("not verified",
  not a failure) — a risk scan alone is not full verification.
- Pass **`--run-checks`** to actually execute the project's test / lint /
  typecheck commands and fold the result into the verdict. A failing check turns
  an otherwise-clean verdict into `NEEDS_HUMAN_REVIEW` (escalation-only; never a
  standalone `BLOCK`). Tune the per-check timeout with `--checks-timeout <ms>`
  (default 300000).
- Execution is **skipped** (and the change stays unverified) when the diff is
  risky to run: a CRITICAL finding, a test/security disable, or an edit to a
  build/run manifest (e.g. `package.json` `scripts`). Running an
  attacker-modified `npm test` would be code execution, so the gate refuses —
  run those checks manually in a trusted sandbox if you trust the change.

```bash
# verify AND run the checks (a clean ALLOW only when they pass)
npx -y @ps-neko/nekowork@alpha verify-pr --run-checks
# don't block CI on "not verified" / a failed check
npx -y @ps-neko/nekowork@alpha verify-pr --run-checks --ci-exit-soft
```

The heavy `@ps-neko/nekowork-harness` runtime shares the same check-runner and
verdict core (it imports them from the slim package), so behavior matches.

See [SCOPE-1.0.md](SCOPE-1.0.md) §5–§7 for the full decision policy.

## 3. The Five Verdicts (and the simple buckets)

The README shows three plain buckets — **PASS / REVIEW / BLOCK**. verify-pr emits
five specific verdicts that map onto them, and onto CI exit codes:

| verify-pr verdict | README bucket | CI exit | Meaning |
|---|---|---|---|
| `ALLOW` | PASS | 0 | No blocking risk found. |
| `ALLOW_WITH_WARNINGS` | PASS | 0 | Lower-severity findings only. |
| `NEEDS_HUMAN_REVIEW` | REVIEW | 1 | A high-severity finding, an unverified source change (no `--run-checks`), or a failed/skipped check needs a human look. |
| `INSUFFICIENT_EVIDENCE` | REVIEW | 1 | Risk scan passed, but there's no test command to fully verify. |
| `BLOCK` | BLOCK | 2 | A critical risk was found; merge and apply are refused. |

## 4. CI Integration

```bash
npx -y @ps-neko/nekowork@alpha verify-pr --range origin/main...HEAD --comment-file pr-comment.md
npx -y @ps-neko/nekowork@alpha verify-pr --range origin/main...HEAD --ci-exit-soft
```

- `--comment-file <path>` writes a Markdown summary you can post as a PR comment.
- `--ci-exit-soft` turns `NEEDS_HUMAN_REVIEW` / `INSUFFICIENT_EVIDENCE` into exit 0
  (warn, don't block) for teams that don't want those to fail the check.

See [INTEGRATION.md](INTEGRATION.md) for a full GitHub Actions example.

## 5. The Four Slim Verbs

The published `@ps-neko/nekowork@alpha` package supports exactly four verbs.
Anything else is rejected with a redirect to the source checkout.

| Verb | What it does |
|---|---|
| `check` | Probe environment readiness (Node version, git repo, etc.). |
| `verify-pr` | Scan the working-tree diff → `REPORT.md` + `.nekowork/decision.json`. |
| `report --session <id>` | Render a session's evidence to `REPORT.md` (session-based compatibility). |
| `apply --session <id>` | Apply a stored `.diff`; requires `SHIP_READY` + a cleared Human Gate (session-based compatibility). |

For the normal flow you only need `check` and `verify-pr` — `verify-pr` already
writes `REPORT.md` directly. `report`/`apply` are session-based compatibility
commands and are **not** driven by `verify-pr`'s `decision.json`.

---

## Source checkout (heavy harness only)

Everything below requires cloning the repository. The heavy
`@ps-neko/nekowork-harness` runtime (`ask`, `plan`, `team`, `work`, `verify`,
`gate`, `ship`, `run`, `build`, `review`, …) is **internal and NOT published to
npm** — it only runs from a source checkout, and the slim CLI rejects those verbs.

### Clone and run the slim verbs from source

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git harness
cd harness
npm ci
```

Run the slim verbs directly from the slim package path:

```bash
node packages/nekowork/scripts/cli.js check
node packages/nekowork/scripts/cli.js verify-pr
```

### Heavy harness commands, install/apply, and the demo

The heavy runtime lives in a separate package path. Run its verbs from
`packages/nekowork-cli/scripts/cli.js` (the slim package does not accept them):

```bash
node packages/nekowork-cli/scripts/cli.js team "split and review this change" --no-write --session team-smoke
```

Initialize a target project with the heavy harness install flow:

```bash
node packages/nekowork-cli/scripts/cli.js install --apply --profile developer --project-root /path/to/my-project
```

`install --apply` writes generated NEKOWORK tool surfaces and install state into
the target project. It does not commit, push, publish, or deploy.

For a no-API tour without touching your own repo:

```bash
cd packages/nekowork-cli
npm run demo:quick -- --cleanup
```

The quick demo creates a disposable target project, runs a mock workflow, and
removes the target when `--cleanup` is set. It does not call Claude, Codex,
Gemini, or any paid API.

`doctor` (the full environment audit with repair/sync/codemap freshness checks)
is also a heavy-harness command:

```bash
node packages/nekowork-cli/scripts/cli.js doctor
```

See [ADVANCED.md](ADVANCED.md) for the full heavy runtime surface and the
[Phased Cut plan](SCOPE-1.0.md#2-phased-cut-단계).

## Troubleshooting

`npm ci` fails:

- Confirm Node.js 22 or newer with `node -v`.
- Check corporate proxy or registry settings in `.npmrc`.

`verify-pr` reports `INSUFFICIENT_EVIDENCE`:

- This is not a failure. The risk scan passed, but the project has no test command
  to fully verify the change.
- Add a test script for full verification, or pass `--ci-exit-soft` to avoid
  blocking CI.

`check` exits with `FAIL`:

- Read the failed row first.
- Use `--json` for CI or issue reports.
- From a source checkout, the heavy `doctor` command runs the deeper
  repair/sync/codemap freshness audit if you need it.
