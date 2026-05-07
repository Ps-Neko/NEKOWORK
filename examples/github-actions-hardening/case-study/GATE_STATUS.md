# Gate Status

## Expected Status Before Approval

```text
status=open
reason=risk policy requires human gate (deploy)
```

## Human Review Checklist

- Workflow does not deploy or publish.
- Permissions are read-only.
- Action refs are pinned and non-floating.
- No secrets or cloud credential setup exists.
- Local hardening check passes.

## Approve Command

```bash
node ../../scripts/cli.js gate approve --project-root . --session actions-hardening --reason "Confirmed validation-only hardened workflow."
```

## Block Command

```bash
node ../../scripts/cli.js gate block --project-root . --session actions-hardening --reason "Workflow hardening boundary is not proven."
```
