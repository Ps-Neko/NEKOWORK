# Parallel Candidates

This fixture records the expected alpha.9 evidence shape.

```json
{
  "candidate_count": 2,
  "candidates": [
    {
      "id": "candidate-01",
      "worker": "candidate-worker-01",
      "changed_files": ["src/parser.js"],
      "verdict": "approve",
      "score": 0.94,
      "selected": true
    },
    {
      "id": "candidate-02",
      "worker": "candidate-worker-02",
      "changed_files": ["src/parser.js"],
      "verdict": "approve_with_fixes",
      "score": 0.61,
      "selected": false
    }
  ],
  "arbiter": {
    "selected_candidate": "candidate-01",
    "reason": "candidate-01 satisfies the parser normalization criteria with fewer follow-up fixes"
  },
  "canonical": {
    "status": "promoted_for_ship",
    "ship_candidate": true,
    "diff": "diffs/canonical-final.diff"
  }
}
```

The non-selected candidate remains useful evidence, but it is not a ship candidate.
