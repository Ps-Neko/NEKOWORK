# Canonical Verification

Final verification runs after arbitration, not before it.

```json
{
  "stage": "canonical-candidate-verification",
  "agent": "codex-reviewer",
  "selected_candidate": "candidate-01",
  "verdict": "approve",
  "issues": [],
  "files": ["src/parser.js"],
  "apply_boundary": "explicit-only"
}
```

The approved canonical candidate is promoted into the normal handoff path:

```text
.harness/state/sessions/<session>/handoffs/03-implement.json
.harness/state/sessions/<session>/handoffs/05-codex-review.json
.harness/state/sessions/<session>/canonical-verify-summary.json
```
