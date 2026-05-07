# Plan

Acceptance criteria:

- AC-001: parser rejects malformed input with a stable error message
- AC-002: parser accepts the documented happy path
- AC-003: no unrelated files are changed

Test-first plan:

- Add or identify a parser malformed-input check before implementation.
- Keep happy path behavior unchanged.
- Compare the final changed file list against the planned scope.

Non-goals:

- No parser architecture rewrite.
- No new dependency.
- No production deploy or publish.
