# Team Handoffs

All team handoffs are read-only.

Planner:

- Keep this as a parser cleanup, not a rewrite.
- Require explicit acceptance coverage in verify.

Test:

- AC-001 and AC-002 should be checked independently.
- Missing test evidence should be a quality warning.

Security:

- No secrets, credentials, deploy logic, or auth files are in scope.

Reviewer:

- Findings should include claim, evidence, required_fix, confidence, and gate_required when high or critical.
