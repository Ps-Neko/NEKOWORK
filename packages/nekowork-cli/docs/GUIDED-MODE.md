# Guided Mode

Guided Mode turns NEKOWORK into a choice-first terminal cockpit.

Use it when you do not want to remember every command or flag:

```bash
nekowork
```

In non-interactive shells, preview the same surface:

```bash
nekowork cockpit --preview
```

## What It Shows

The cockpit summarizes:

- project root
- git state
- provider mode
- install state
- session count
- latest session decision
- recommended next action
- safety defaults

Example:

```text
+-- NEKOWORK Cockpit -------------------------------------+
| Version : 0.1.0-alpha.11                                |
| Project : /path/to/project                              |
| Git     : dirty (2 changed paths)                       |
| Provider: mock                                          |
| Install : installed                                     |
| Sessions: 3                                             |
+---------------------------------------------------------+

Recommended next action
  > Start safe AI work          route, build, verify, stop before apply
    Review current changes      risk scan and evidence path for this tree
    Prepare PR evidence         local PR artifacts; no branch or push
    View latest report          inspect evidence before acting
    Apply verified diff         explicit boundary; asks again
```

## Choice-First Flow

The interactive launcher keeps advanced flags behind choices:

```text
Start safe AI work
  -> task prompt
  -> recommended auto mode / dry-run / bounded auto

View latest report
  -> session prompt
  -> report --session <id>

Apply verified diff
  -> session prompt
  -> explicit "apply" confirmation
  -> apply --session <id>
```

## Safety Boundary

Guided Mode does not weaken NEKOWORK's runtime contract:

- no auto-apply
- no auto-commit
- no auto-push
- no deploy or publish
- one executor writes
- Codex verifies before apply

The cockpit can start workflows, show evidence, or call the explicit apply command, but it still asks at the apply boundary and uses the same `apply` checks as the direct CLI.

## Direct Commands Still Work

Guided Mode is a front door, not a replacement for the phase-level CLI:

```bash
nekowork start "fix failing tests safely"
nekowork auto "repair fixable findings" --level normal
nekowork report --session latest
nekowork apply --session <id>
```
