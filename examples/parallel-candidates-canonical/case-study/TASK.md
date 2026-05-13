# Task

Prove that `auto --parallel-candidates N` can move beyond preview evidence into the canonical ship path while preserving NEKOWORK's safety boundary.

The tiny target change is parser normalization:

- trim leading and trailing whitespace
- lowercase command names
- collapse internal whitespace to `-`
- reject non-string input

Suggested command path:

```bash
node scripts/cli.js auto "normalize parser commands safely" --parallel-candidates 2 --session parallel-canonical
node scripts/cli.js report --session parallel-canonical
```

Important safety expectation:

```text
parallel candidates -> candidate verification -> arbiter -> final Codex verification -> canonical handoffs -> ship readiness
```

`apply`, commit, push, publish, deploy, and PR creation remain explicit human actions.
