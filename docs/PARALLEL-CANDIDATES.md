# Parallel Candidate Writers

Alpha.10 preview.

`auto --parallel-candidates N` will make NEKOWORK feel more autonomous without allowing unsafe shared-worktree writes.

## Target UX

```bash
nekowork auto "refactor auth parser safely" --parallel-candidates 4
nekowork auto "refactor auth parser safely" --parallel-candidates 4 --dry-run
```

## Contract

```text
planner
  -> candidate workers in isolation
     -> patch A
     -> patch B
     -> patch C
     -> patch D
  -> candidate verification
  -> arbiter summary
  -> one canonical final diff
  -> Codex verification
  -> report / Human Gate / ship
  -> explicit apply only
```

The current preview records isolated candidate evidence and keeps the normal `auto`
build as the canonical ship path. Candidate patches are not promoted to
ship-ready output yet.

## Safety Rules

1. Candidate workers must never write to the same target worktree concurrently.
2. Each candidate must run in an isolated worktree, isolated temp project, or isolated diff capture.
3. Candidate patches are evidence, not ship-ready output.
4. Only one canonical final diff may become the ship candidate.
5. Codex verification runs on the final diff before ship/apply.
6. Human Gate remains required for sensitive work.
7. `apply`, commit, push, publish, deploy, and PR creation remain explicit human actions.

## Report Evidence

The report should include:

- candidate count
- candidate worker names
- changed files per candidate
- verifier verdict per candidate when candidate verification is enabled
- rejected candidates and reasons
- selected canonical diff rationale
- final Codex verdict
- Human Gate status

Current preview evidence:

```text
.harness/state/sessions/<session>/parallel-candidates.json
.harness/state/sessions/<session>/parallel-candidates/candidate-01.json
.harness/state/sessions/<session>/parallel-candidates/candidate-01.md
```

`REPORT.md` includes a `Parallel Candidates` section when the artifact exists.

## Non-Goals

- no multi-agent concurrent writes to one worktree
- no majority-vote apply
- no automatic PR creation
- no Human Gate bypass
