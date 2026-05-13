# Workflow Integration

NEKOWORK should stay narrow. It is not a domain-interview, DDD, or product-discovery tool. Use your preferred upstream workflow to produce the domain context, product spec, implementation plan, and candidate change. NEKOWORK begins at the trust boundary: verify the AI-made change, record evidence, require Human Gate when needed, and apply only on explicit command.

```text
domain/spec workflow -> candidate change -> NEKOWORK safety gate
```

## Position

```text
Bring your coding agent. NEKOWORK proves the change before apply.
```

In practice, "proves" means reviewed with recorded evidence, deterministic risk checks, independent verification, and Human Gate policy. It does not mean mathematically proven correctness.

## Artifact Contract

These files are optional, but they are the recommended handoff contract between upstream discovery/planning workflows and NEKOWORK.

| Artifact | Produced by | NEKOWORK consumption |
|---|---|---|
| `context.md` | Domain interview, office-hours, brainstorming | `ask` context root for terminology, constraints, and user language |
| `DOMAIN.md` | DDD or architecture boundary pass | `plan` scope boundary input for concepts, modules, and ownership |
| `SPEC.md` | Product/spec review, including excluded features | `plan` acceptance criteria and risk framing |
| `PLAN.md` | Implementation planning workflow | `team` and `work` task units for read-only review and single-executor implementation |

Recommended flow:

```text
context.md + DOMAIN.md + SPEC.md + PLAN.md
  -> ask
  -> plan
  -> team
  -> work
  -> verify
  -> decision.json
  -> REPORT.md
  -> Human Gate
  -> explicit apply
```

If these files do not exist, NEKOWORK still works from the task prompt and session artifacts. The contract is for richer upstream workflows, not a new requirement for every change.

## Scope Rules

Do not run the full hybrid workflow for every task.

| Work type | Recommended path |
|---|---|
| Bug fix, refactor, or docs-only change | `start -> report -> gate status`, then explicit `apply` only if ship-ready |
| Small feature with clear domain | Upstream brainstorm or writing plan -> NEKOWORK safety gate |
| Large feature with unclear domain | Domain interview + `context.md` + `DOMAIN.md` + `SPEC.md` + `PLAN.md` -> full NEKOWORK cycle |
| Prototype or throwaway experiment | Use the upstream workflow only; skip NEKOWORK unless the result will be applied to a real repo |
| Security, auth, payment, deploy, or permission change | Full NEKOWORK cycle with strict verification and Human Gate expectation |

## Non-Goals

NEKOWORK should not absorb upstream discovery features into the core runtime:

- no built-in domain interview system
- no DDD generator as a core feature
- no product-discovery suite
- no automatic memory adoption from upstream context
- no automatic apply, commit, push, publish, deploy, or PR creation

The integration point is the artifact contract. Upstream tools own domain clarity. NEKOWORK owns the evidence-backed apply boundary.

