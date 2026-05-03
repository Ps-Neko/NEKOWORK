---
name: porting
description: "Port HARNESS into an external project with preflight conflict detection, selective install, and no-ship review smoke."
origin: harness-core
level: 2
prerequisites: [release-readiness]
conflicts: []
auto_inject_keywords: [port, porting, project-root, install-apply, simulate-port]
tags: [porting, install, project-root]
---

# porting

Use this skill when applying HARNESS to another repository or validating that the tool root and project root stay separated.

## Preferred Shape

Use a local repo/submodule style integration for 0.0.2. npm installation is reserved for a future public package release.

Recommended layout:

```text
target-project/
  .harness-tool/     # HARNESS source, often ignored or submodule-managed
  .harness/          # target project state
  .claude/
  .codex/
```

## Preflight

Run from the HARNESS tool root:

```bash
node scripts/portability/simulate-port.js <target> --profile developer --verbose
```

Stop and inspect if the report shows high conflicts such as:

- existing `.mcp.json`
- existing harness output directories
- self-targeting the HARNESS repository
- existing `.harness-tool` strategy mismatch

## Apply

```bash
node scripts/install-apply.js --profile developer --project-root <target>
```

For a single target surface:

```bash
node scripts/install-apply.js --profile developer --harness claude --project-root <target>
```

## Smoke

```bash
node scripts/cli.js plan "porting smoke" --project-root <target>
node scripts/cli.js review "porting smoke" --no-ship --project-root <target>
```

Verify:

- sessions are written under `<target>/.harness/state/sessions`
- provider CLI cwd is the target project
- agent catalog and schemas are read from the HARNESS tool root
- target git changes are not applied unless explicitly requested
