# Verify Summary

profile: quality
strict_quality: true
strict_quality_blocked: false

Evidence-based finding example:

```text
claim: Parser malformed input behavior is covered.
evidence: tests/parser.test.js references AC-001 and asserts a stable error message.
required_fix: none
confidence: 0.91
gate_required: false
```

acceptance_coverage:

```json
[
  {
    "id": "AC-001",
    "status": "covered",
    "evidence": "tests/parser.test.js references AC-001 and malformed input",
    "source": "codex-review"
  },
  {
    "id": "AC-002",
    "status": "covered",
    "evidence": "codex-review confirms the happy path remains covered",
    "source": "codex-review"
  },
  {
    "id": "AC-003",
    "status": "covered",
    "evidence": "changed file list is limited to parser and parser tests",
    "source": "codex-review"
  }
]
```

Quality warnings:

- none
