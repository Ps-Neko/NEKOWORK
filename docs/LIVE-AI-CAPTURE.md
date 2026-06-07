# Live-AI Fixture Capture Protocol

NEKOWORK's deterministic rules are benchmarked against two fixture sources:
real OSS diffs (scraped) and **live-AI diffs** — diffs produced by an actual AI
coding tool against a task we set. Live-AI fixtures answer the only question that
matters: *does the gate catch the risky things real AI assistants actually
write?*

## Why this doc exists: primer bias

The benchmark manifest admits a flaw in the first live-AI batch: the positive
fixtures were captured in a **primed session** — the same conversation that had
just discussed the rule being tested. An AI told "we are testing secret-fallback
detection" is far more likely to emit a `process.env.X || "literal"` fallback
than one given a neutral product task. That inflates recall and makes the gate
look better than it is on real, unprimed work.

This protocol removes primer bias so captured fixtures are trustworthy evidence,
not a rigged demo.

## Hard rules

1. **Fresh, unprimed sessions only.** Each capture starts a brand-new AI session
   (new chat / new CLI invocation / cleared context). The session must never
   have seen: this repo, NEKOWORK, the rule list, the words "secret", "gate",
   "vulnerability", or any hint about what is being detected. If the AI was
   primed, the capture is invalid — discard it.

2. **Neutral product tasks, not "write a bug" tasks.** Prompts describe a
   feature ("Add JWT-based auth middleware to this Express app"), never a defect
   ("add a hardcoded fallback secret"). The risky pattern must emerge from the
   AI's own habits, not from instructions.

3. **≥2–3 different AI tools per task tier.** A single tool's quirks are not the
   population. Capture each task across a spread of tools and models, e.g.:
   - Cursor
   - Codex / Copilot
   - Gemini
   - Claude (Claude Code)

   A finding that only one tool ever produces is a tool quirk; a finding three
   tools independently produce is a real risk class.

4. **One workspace = one task = one snapshot.** Use the capture tool so the diff
   is exactly the AI's output against a clean starting SHA, with nothing else
   mixed in.

## Debiasing checklist (run before every capture)

- [ ] New session with **zero** prior context about NEKOWORK or any rule.
- [ ] Prompt is a neutral feature request; it names **no** risky pattern.
- [ ] The AI has not seen this repo, its tests, or this document.
- [ ] Tool + model are recorded exactly (e.g. `cursor` / `gpt-5-codex`).
- [ ] Workspace is a clean git repo (`git status` empty except untracked).
- [ ] This is at least the 2nd or 3rd **different tool** for this task tier.
- [ ] No "regenerate until it produces the bug" — accept the **first** output.
- [ ] If the diff is empty or off-task, record it as a **negative** (no finding)
      — do not retry to force a positive.

## Capture mechanics

Use the wrapper so provenance is recorded the same way every time:

```bash
# 1) Start: pins the clean starting SHA + tool/model/task/prompt
node packages/nekowork/scripts/benchmark/capture-live-ai-diff.js start \
  --workspace /tmp/live-ai-session-001 \
  --tool cursor \
  --model gpt-5-codex \
  --task-id tier1-jwt-auth-001 \
  --prompt "Add JWT-based auth middleware to this Express app."

# 2) ... let the AI do the task in that workspace, unprimed ...

# 3) Snapshot: diffs against the pinned SHA, writes the .patch + CSV row
node packages/nekowork/scripts/benchmark/capture-live-ai-diff.js snapshot \
  --workspace /tmp/live-ai-session-001

# List everything captured so far
node packages/nekowork/scripts/benchmark/capture-live-ai-diff.js list
```

## Provenance: what every fixture must record

Captures land in `packages/nekowork/tests/fixtures/live-ai/` — one `.patch` per
capture plus an append-only `captures.csv` with these columns:

| Column | Meaning |
|---|---|
| `capture_id` | `<timestamp>-<tool>-<task-id>`, unique |
| `tool` | AI tool used (cursor / codex / gemini / claude-code …) |
| `model` | exact model id |
| `task_id` | which task tier/scenario |
| `workspace` | where the session ran |
| `starting_sha` | clean SHA the diff is measured against |
| `patch_file` | the captured diff |
| `added_lines` | size signal |
| `captured_at` | ISO timestamp |
| `notes` | anything unusual (off-task, empty diff, retries — must be none) |

A fixture with missing provenance (no tool/model/SHA) is not admissible into the
benchmark. The CSV is the audit trail that proves a positive came from an
unprimed session and not a primed demo.

## Labeling

After capture, a human labels each fixture **expected: finding / no finding** by
reading the diff — independent of what NEKOWORK reports. Never label a fixture by
running the gate and copying its verdict; that makes the benchmark a tautology.
Recall/precision are then computed by comparing the gate's output to the
human labels.
