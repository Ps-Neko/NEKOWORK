# Why Not Autopilot

Autopilot tools optimize for speed and autonomous completion. NEKOWORK optimizes for evidence, reviewability, and explicit control.

## Use Autopilot When

- the project is disposable or low-risk
- speed matters more than audit trail
- autonomous iteration is the desired experience
- surprise writes are acceptable within the workflow

## Use NEKOWORK When

- an AI agent may touch security, release, auth, data, or deployment code
- a person needs to see evidence before apply
- the team wants one executor and independent verification
- no-ship is an acceptable and useful outcome
- local auth and no-API-key default setup matter

## Design Tradeoff

NEKOWORK intentionally adds gates:

```text
work -> verify -> ship/no-ship -> report -> human gate -> explicit apply
```

That is slower than autopilot. It is also the point.

NEKOWORK is not trying to be a 100-agent autonomous coding pack. Every component must answer:

1. Does it improve verification?
2. Does it preserve one-executor writes?
3. Does it produce auditable evidence?
4. Does it respect Human Gate?

The catalog stays selective so the trust loop stays understandable.
