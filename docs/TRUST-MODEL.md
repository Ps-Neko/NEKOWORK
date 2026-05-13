# Trust Model

NEKOWORK separates writing, verification, approval, and apply.

| Actor | Responsibility | Boundary |
|---|---|---|
| User | Defines the task and decides whether risk is acceptable | Must explicitly approve gates and apply |
| Claude worker | Plans or writes a candidate change | Does not get final authority to ship |
| Read-only team | Produces product, security, test, and planning handoffs | Does not mutate the project |
| Preverify rules | Flags deterministic diff risk before LLM review | Produces early risk evidence, not a final ship decision |
| Codex verifier | Challenges the work in a separate context | Produces verification evidence, not blind apply |
| Human Gate | Records approve/block/request-fix decisions | Stops critical or repeated-risk changes |
| Apply step | Applies a verified live-work diff | Requires ship-ready evidence |

## Evidence Chain

A normal session creates:

- work summary
- preverify summary
- verification summary
- ship/no-ship summary
- gate status
- `decision.json`
- optional `REPORT.md`

The report is the primary human-readable trust surface.

`decision.json` is the machine-readable trust surface. It consolidates the current verdict, reason, risk tags, Human Gate state, ship readiness, apply permission, diff hash, and evidence paths so CLI output, reports, CI, and future dashboards read the same decision.

Example:

```json
{
  "verdict": "blocked",
  "reason": "preverify requires Human Gate for secret env fallback",
  "risk": { "level": "critical", "tags": ["secret", "auth"] },
  "ship_ready": false,
  "human_gate": "required",
  "apply_allowed": false,
  "evidence": ["preverify-summary.json", "verify-summary.json", "REPORT.md"]
}
```

## Default Verifier

The public alpha defaults to Codex verification because it gives NEKOWORK a separate model/context from the Claude work path.

This is a product boundary, not a claim that only Codex can ever verify. The long-term verifier adapter direction is:

```text
verifier = codex | gemini | local | custom
```

For this alpha, Codex remains the default verifier and mock mode remains the default no-API path.

## One-Executor Writes

NEKOWORK can ask many roles for evidence, but only one executor should create the candidate implementation. This keeps blame, review, and rollback understandable.

The product goal is not maximum autonomy. The product goal is a clear answer to:

```text
What changed, who challenged it, what evidence exists, and did a human approve apply?
```
