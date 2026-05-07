---
name: acceptance-coverage
description: "Map acceptance criteria to concrete verification evidence before ship or apply."
origin: harness-core
level: 2
prerequisites: [tdd-workflow, review]
conflicts: []
tags: [quality, verification, acceptance, evidence]
---

# acceptance-coverage

Use this skill when a task has acceptance criteria and the next decision depends on whether each criterion has explicit evidence.

## Workflow

1. Read the current task, acceptance criteria, prior handoffs, and verify summary.
2. Create one row per acceptance criterion.
3. Mark each row as `covered`, `missing`, or `unclear`.
4. Attach concrete evidence for every `covered` row.
5. For `missing` or `unclear` rows, name the required follow-up test, review finding, or handoff evidence.
6. Do not mark ship ready unless every required criterion has evidence or a human explicitly accepts the residual risk.

## Output Shape

Prefer this compact table in handoffs or review notes:

```text
| AC | status | evidence | required_follow_up |
|---|---|---|---|
| AC-001 | covered | tests/unit/parser.test.js rejects malformed input | none |
| AC-002 | missing | none | add failing malformed input test or document non-goal |
```

## NEKOWORK Boundary

This skill improves quality evidence only. It cannot bypass Codex verification, Human Gate, strict quality, or explicit apply controls.
