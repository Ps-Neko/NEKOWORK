---
name: security-hardening
description: "Run and interpret the HARNESS security hardening gate for workflow, MCP, dependency, and delegated-auth policy changes."
origin: harness-core
level: 2
prerequisites: [review]
conflicts: []
auto_inject_keywords: [security, hardening, oidc, mcp, dependency, workflow]
tags: [security, ci, audit]
---

# security-hardening

Use this skill when changing CI workflows, provider auth, MCP servers, package dependencies, release gates, or security-sensitive project policy.

## Workflow

1. Inspect the changed surface.
   - `.github/workflows/*.yml`
   - `agent.yaml#security`
   - `agent.yaml#mcp`
   - `package.json`
   - `package-lock.json`
   - provider runner auth code

2. Run the hardening gate.

```bash
npm run security:hardening
```

3. Pair it with dependency and catalog checks.

```bash
npm audit --audit-level=moderate
npm run lint
```

4. If workflow files changed, check for these explicit invariants:
   - no `pull_request_target`
   - top-level `permissions`
   - no `write-all`
   - every job has `timeout-minutes`
   - action refs are pinned to a SHA or major version tag
   - static cloud credential secrets require OIDC `id-token: write`

5. If MCP servers changed, verify:
   - stdio servers use exact semver pins
   - HTTP servers use `https://`
   - no `@latest`

## Output

Report:

- changed security surface
- commands run
- pass/fail result
- any residual risk or required human approval
