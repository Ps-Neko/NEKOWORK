# Gate Status

## Expected Status Before Approval

```text
status=open
reason=risk policy requires human gate (financial,product-ui)
```

## Human Review Checklist

- The page says demo data only.
- The order ticket is disabled.
- There is no broker or payment SDK.
- There are no outbound calls.
- The local project test passes.

## Approve Command

```bash
node ../../scripts/cli.js gate approve --project-root . --session trading-demo --reason "Confirmed mock-only financial UI boundary."
```

## Block Command

```bash
node ../../scripts/cli.js gate block --project-root . --session trading-demo --reason "Financial UI boundary is not proven."
```
