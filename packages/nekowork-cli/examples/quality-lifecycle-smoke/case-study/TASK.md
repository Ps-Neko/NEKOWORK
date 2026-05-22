# Task

Create a small parser cleanup flow and prove that NEKOWORK can keep quality expectations visible from question gate through verification.

The target change is intentionally tiny:

- normalize parser error messages
- keep implementation single-executor
- verify acceptance criteria with explicit evidence
- demonstrate strict quality policy without needing a real provider call

Suggested command path:

```bash
node scripts/cli.js ask "clean up parser errors" --profile quality --session quality-smoke
node scripts/cli.js work "clean up parser errors" --profile quality --session quality-smoke
node scripts/cli.js verify "verify parser cleanup" --profile quality --strict-quality --session quality-smoke
node scripts/cli.js ship "prepare quality smoke ship handoff" --session quality-smoke
```
