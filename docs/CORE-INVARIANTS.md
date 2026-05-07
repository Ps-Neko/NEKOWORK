# Core Invariants

NEKOWORK is a verification runtime. These invariants are not feature toggles.

```text
Claude work -> Codex verification -> Human Gate
```

## Runtime Rules

1. Multi-worker phases are read-only by default.
2. Only one executor may mutate project files in a work cycle.
3. Codex review is the default independent verification path.
4. Secure or sensitive changes require Codex challenge or Human Gate.
5. Human Gate cannot be bypassed by skill, hook, profile, module, or CLI expansion.
6. Profiles may add capabilities, but they cannot weaken core safety gates.
7. Local delegated CLI auth is the default live-provider path.
8. Long-lived provider API keys are not required by the default path.
9. Handoffs must be inspectable artifacts.
10. Shipping requires evidence from work, verification, and gate state.

## Enforcement Surfaces

- `team` and `team-lite` run as read-only handoff surfaces.
- `work` runs one executor and records acceptance criteria before implementation.
- `verify` requires prior work, runs Codex review, and triggers challenge/gates for sensitive work.
- `gate` records explicit human approve/block decisions.
- `ship` refuses unresolved gates and writes readiness markers only after verification.
- `report` summarizes evidence without mutating project files.
- `apply` is the explicit mutation command for verified live-work diffs.
- Manifest validation rejects profiles that try to weaken core safety policy.

## Compatibility

`review` remains the legacy full cycle for the current alpha line. `review-cycle` is the explicit compatibility alias. New automation should prefer:

```text
ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply
```
