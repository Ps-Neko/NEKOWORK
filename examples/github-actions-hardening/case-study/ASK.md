# Ask

Expected question-gate outcome:

```text
risk=high
tags=deploy
requiresCodexChallenge=true
requiresHumanGate=true
```

## Blocking Questions

1. Is this workflow allowed to deploy or publish?
2. What token permissions are required?
3. Are cloud credentials or repository secrets in scope?
4. Which event triggers are allowed?
5. What evidence proves the workflow is hardened?

## Draft Success Criteria

1. Workflow uses read-only default permissions.
2. Jobs use the minimum explicit permissions required.
3. Actions use pinned non-floating refs.
4. Workflow avoids `pull_request_target`, secrets, deploy, and publish behavior.
5. Local check validates the hardening boundary.
