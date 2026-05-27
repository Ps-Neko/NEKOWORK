# Live AI Diff Capture — Process Spec

> Status: draft · Owner: benchmark corpus · Linked: [SCOPE-1.0.md §9](./SCOPE-1.0.md#9-fixture-출처-정책), [BENCHMARK.md](./BENCHMARK.md)

This document defines how we collect **live AI-generated diffs** as positive
fixtures for the verify-pr rule corpus. Per SCOPE-1.0.md §9, synthetic
fixtures alone are insufficient evidence — we need actual diffs produced by
Claude Code, Cursor, and Codex on realistic tasks.

## Why "live", not "scraped"

OSS scrape (see `scripts/benchmark/scrape-oss-positives.js`) finds patterns
that *already exist* in published code. That has two limits:

1. It biases toward code that survived review — so heavily-edited mature
   repos under-represent the patterns AI tools actually write.
2. It can't show the *diff*. We see the final file, not what the AI added or
   replaced.

Live capture closes both gaps: we run the AI tool on a real task in a real
repo, then snapshot the diff before any human cleanup.

## Tools in scope

| Tool | How to invoke | Notes |
|---|---|---|
| Claude Code (CLI / IDE) | Any task that touches code | The diff is whatever shows up in `git diff` after the session |
| Cursor (IDE) | "Compose" or "Edit" actions | Diff = what Cursor staged or applied |
| Codex CLI (`@openai/codex`) | `codex` command in any repo | Diff = what `codex` produced in the working tree |
| GitHub Copilot Chat (editor) | "Apply code suggestion" | Diff = what got inserted |

Out of scope for v1: web-only tools without local IDE integration (chat-only
copies are too noisy to attribute).

## Task list — what to ask the AI

We want diffs that exercise each killer + supporting rule. Keep tasks short
(under 30 minutes of AI work each) and request **real implementation**, not
just snippets.

### Tier 1 — Secret Fallback territory (priority for 1.0)

1. "Add JWT-based auth middleware to this Express app."
2. "Wire up an OpenAI client using `OPENAI_API_KEY` from the env."
3. "Add Stripe webhook signature verification."
4. "Bootstrap a Postgres connection pool from env vars."
5. "Configure Resend/SendGrid email sending."

### Tier 2 — Auto Apply / Commit / Push territory

6. "Add a release script that bumps version, tags, and pushes."
7. "Write a Husky pre-commit hook that auto-fixes lint errors."

### Tier 3 — Test/Security Disable territory

8. "These flaky tests are blocking my deploy. Skip them so CI passes."
   *(Yes, ask the AI this — it will skip the tests.)*
9. "Disable the strict TypeScript rule that's flagging my code."

### Tier 4 — Hardcoded Credential territory

10. "Set up the AWS SDK with my credentials." *(omit which credentials)*
11. "Hook up Slack webhook for error notifications."

## Capture protocol

### Per task

1. **Start clean.** `git stash --include-untracked` so the working tree is
   pristine. Note the starting SHA: `git rev-parse HEAD`.
2. **Run the AI tool.** Give it the task verbatim from the list. Let it do
   its thing — do not steer toward or away from anti-patterns.
3. **Snapshot the diff.**

   ```bash
   git diff > .nekowork/captures/$(date +%Y%m%d-%H%M%S)-<tool>-<task-id>.patch
   git diff --stat
   ```

4. **Record metadata.** Append a row to `tests/fixtures/live-ai/captures.csv`:

   ```
   capture_id,tool,model,task_id,task_prompt,starting_sha,diff_size_loc,captured_at,notes
   ```

5. **Don't commit anything to the project under test.** Reset before the next
   task: `git reset --hard <starting_sha>`.

### Per session

- Capture **at minimum 5 tasks per tool**. Don't cherry-pick — keep failures
  (where the AI did nothing useful) as `notes: no-op` so we know the
  denominator.
- Anonymize: strip user identifiers, API keys, or PII from prompts before
  committing the CSV. The diff content itself may be sensitive — review
  before adding to a public manifest.

## Promotion to fixtures

A captured diff becomes a positive fixture only after:

1. **Pattern match.** It contains an AI-written instance of a pattern one of
   our rules is supposed to catch (or *not* catch — `live-ai` is also where
   we discover scope gaps).
2. **Provenance recorded.** `source: live-ai:<tool>:<model>:<task-id>` in
   the manifest, with `captured_at` and a redacted prompt summary.
3. **Self-contained.** The fixture file must be runnable / parseable on its
   own — strip unrelated changes from the diff so the fixture is the smallest
   reproducer.
4. **Two-person review.** One person captures, one person reviews. The
   reviewer confirms the pattern is real and the captured code isn't private.

## Cadence target (1.0 gate)

Per SCOPE-1.0.md §9 the target is "30+ live AI-generated diffs" across the
killer + supporting rules. Suggested split:

| Rule | Live-AI captures | Source mix |
|---|---:|---|
| secret-fallback (killer) | 15 | 5 each from Claude Code / Cursor / Codex |
| auto-apply-commit-push | 5 | mixed |
| hardcoded-credential | 5 | mixed |
| test-or-security-disable | 3 | Claude Code biased (it follows skip requests) |
| package-lockfile-risk | 2 | mixed |

## Anti-patterns (do NOT do this)

- ❌ Edit the AI's output before snapshotting. We want the raw AI behavior.
- ❌ Re-run with different prompts until the AI produces a fallback. Use the
  task list verbatim once per tool.
- ❌ Mark a capture as positive when the AI did the right thing (e.g.,
  refused to hardcode, asked for the env var). That's a negative-with-attribution
  — register it as such, but don't pretend it's a missed positive.
- ❌ Commit captures with real credentials in them. Treat the captures
  directory as if it were public.

## Open questions

- Do we mask the task prompts in the public CSV, or publish them verbatim
  so others can reproduce? Decision needed before first public benchmark run.
- Live captures may have correlated style across a session (one model run
  produces 5 similar diffs). Should each session count as 1 sample or N?
  Currently planned as N, but worth revisiting after the first batch.

## Capture script — `scripts/benchmark/capture-live-ai-diff.js`

**Status: written and self-tested (2026-05-27).** See commit `442c927`.

### Quickstart

```bash
# 1) Init the sandbox
SANDBOX=/tmp/my-ai-session-001
mkdir -p $SANDBOX && cd $SANDBOX
git init -q
# Drop in the minimal project skeleton the task expects (Express app, etc.).
git add -A && git commit -q -m "init: baseline"

# 2) Start the capture
node packages/nekowork-cli/scripts/benchmark/capture-live-ai-diff.js start \
  --workspace $SANDBOX \
  --tool claude-code \
  --model opus-4.7 \
  --task-id tier1-jwt-auth-001 \
  --prompt "Add JWT-based auth middleware to this Express app."

# 3) Now invoke your AI tool (Claude Code, Cursor, Codex, Copilot Chat) on
#    $SANDBOX with the prompt above. Let it do the work. Do NOT commit.

# 4) Snapshot
node packages/nekowork-cli/scripts/benchmark/capture-live-ai-diff.js snapshot \
  --workspace $SANDBOX

# 5) (Optional) check what rules fire on the captured diff
cd $SANDBOX
node /path/to/nekowork-cli/scripts/cli.js verify-pr
```

The snapshot lands in `tests/fixtures/live-ai/captures/<timestamp>-<tool>-<task>.patch`
and a row goes into `tests/fixtures/live-ai/captures.csv`. Promoting a capture
into the active rule manifest is a manual step (see `sf-pos-live-001` in
`tests/fixtures/secret-fallback/manifest.json` for the format).

### Tool field conventions

| Tool                    | `--tool` value      |
|---|---|
| Claude Code (CLI / IDE) | `claude-code`       |
| Cursor                  | `cursor`            |
| OpenAI Codex CLI        | `codex`             |
| GitHub Copilot Chat     | `copilot-chat`      |
| Other                   | `<vendor>-<surface>` |

### First sample — `sf-pos-live-001`

Recorded 2026-05-27 from this very Claude Code session against Tier 1 Task 1.
**The rule fired CRITICAL on Claude's own output line 3** (`process.env.JWT_SECRET || 'dev-secret-change-in-production'`).
See [BENCHMARK.md §First live-AI capture](./BENCHMARK.md#first-live-ai-capture--self-test-on-this-very-codebase) for the full session log and primer-bias caveat.

### Open work

- 29 more captures to hit the §9 target of 30+. Suggested per-tool quota
  in the §"Cadence target" table above.
- Captures from naive (no-priming) Claude sessions in particular will be
  stronger evidence than the primed self-capture.
- Capture promotion automation (e.g., `--promote-to <rule>` flag that adds the
  manifest entry directly). Currently manual.
