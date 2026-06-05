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

`check` is the beginner alias for `doctor --quick`. It checks Node.js, package
metadata, git state, API key overrides, and provider CLI presence without the
slower freshness checks.

## 2. What verify-pr Looks At

verify-pr defaults to your working-tree diff. You can point it elsewhere:

```bash
npx -y @ps-neko/nekowork@alpha verify-pr                       # working tree (default)
npx -y @ps-neko/nekowork@alpha verify-pr --from-staged         # staged changes only
npx -y @ps-neko/nekowork@alpha verify-pr --from-patch out.diff # a saved patch file
npx -y @ps-neko/nekowork@alpha verify-pr --range origin/main...HEAD  # a commit range
npx -y @ps-neko/nekowork@alpha verify-pr --full-scan           # the whole tree
```

It then runs five deterministic risk rules over the changed lines:

- **Secret fallback** — `process.env.X || "literal"` and similar hardcoded fallbacks.
- **Hardcoded credential** — API keys, tokens, passwords, private keys in code.
- **Auto commit / push / apply** — code that tries to `git push`, auto-merge, `rm -rf`, etc.
- **Test or security disable** — mass `*.skip`, `eslint-disable`, `ts-ignore`, or CI checks removed.
- **Package / lockfile risk** — dependency, script, and `postinstall`/`preinstall` changes.

### Checks: detection and `--run-checks`

verify-pr also looks at whether your project *has* test / lint / typecheck / build /
audit commands. By default it **detects** which exist and records them in the report.
If a source change has no test command, verify-pr returns `INSUFFICIENT_EVIDENCE`
("not enough evidence to PASS", not a failure) instead of a false PASS.

Pass `--run-checks` to actually execute test / lint / typecheck. Their results are
**escalation-only**: a failing check turns `ALLOW` into `NEEDS_HUMAN_REVIEW`, never a
standalone `BLOCK`. When the diff has a CRITICAL finding or tampers with build/test
scripts, the checks are skipped and the report records the reason. See
[SCOPE-1.0.md](SCOPE-1.0.md) §5–§7 for the decision policy.

## 3. The Five Verdicts (and the simple buckets)

The README shows three plain buckets — **PASS / REVIEW / BLOCK**. verify-pr emits
five specific verdicts that map onto them, and onto CI exit codes:

| verify-pr verdict | README bucket | CI exit | Meaning |
|---|---|---|---|
| `ALLOW` | PASS | 0 | No blocking risk found. |
| `ALLOW_WITH_WARNINGS` | PASS | 0 | Lower-severity findings only. |
| `NEEDS_HUMAN_REVIEW` | REVIEW | 1 | A high-severity finding needs a human look. |
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

## 5. Install From Source (contributors)

Use the repository path when you want examples, tests, or local development:

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git harness
cd harness
npm ci
```

Verify the checkout, then run the hero command directly:

```bash
node scripts/cli.js check
node scripts/cli.js verify-pr
```

## 6. Use NEKOWORK In Another Project

Initialize a target project with the published alpha:

```bash
cd /path/to/my-project
npx -y @ps-neko/nekowork@alpha init --profile developer --project-root .
```

`init` is the beginner alias for `install --apply`. It writes generated NEKOWORK
tool surfaces and install state to the target project. It does not commit, push,
publish, or deploy.

For a no-API tour without touching your own repo:

```bash
npm run demo:quick -- --cleanup
```

The quick demo creates a disposable target project, runs a mock workflow, and
removes the target when `--cleanup` is set. It does not call Claude, Codex, Gemini,
or any paid API.

## 7. Advanced / Legacy Runtime

NEKOWORK also ships a larger session-based runtime — `ask`, `plan`, `team`, `work`,
`verify`, `gate`, `ship`, `run`, `build`, `review`, and more. These remain functional
but are **being phased out of the first-run path** in favor of `verify-pr`. The
recommended hero commands for 1.0 are `check / verify-pr / report / apply`.

See [ADVANCED.md](ADVANCED.md) for the full runtime surface and the
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

`check` / `doctor` exits with `FAIL`:

- Read the failed row first.
- Run `doctor` without `--quick` if you need repair/sync/codemap freshness checks.
- Use `--json` for CI or issue reports.
