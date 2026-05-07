# AI Development Lifecycle

NEKOWORK is a local-first AI development quality runtime. Its job is not to collect every useful agent feature; its job is to make AI development disciplined, high-quality, independently verified, and human-gated.

## Position

```text
Good development habits
+ quality rules, hooks, and skills
+ product-aware scope control
+ read-only multi-agent thinking
+ Codex verification
+ Human Gate and explicit apply
= NEKOWORK gated AI development runtime
```

The short slogan remains:

```text
Claude work -> Codex verification -> Human Gate
```

## Product Rules

1. Claude should develop well.
2. The workflow should produce high-quality work.
3. Independent verification is mandatory before trust.
4. Human Gate is a feature, not a failure.
5. Multiple agents may think, but only one executor writes.
6. Rich skills, hooks, and rules may improve quality, but cannot weaken safety.
7. Apply is explicit and evidence-based.

## Absorption Model

External project ideas are absorbed as capabilities, not as a new architecture:

| Source Pattern | Useful Strength | NEKOWORK Boundary |
|---|---|---|
| Development discipline | Brainstorm, plan, TDD, debugging, verification before completion | `quality`, `developer`, and `testing` profiles |
| Rich agent environment | Skills, hooks, rules, MCP, memory, scanner-style checks | Profile/module based selective install |
| Product questioning | Product, design, QA, release, and scope control questions | `ask`, `plan`, and `product` profile |
| Team orchestration | Multiple perspectives and parallel review | `team` read-only handoffs |
| NEKOWORK core | Codex verification, Human Gate, controlled apply | Non-bypassable runtime invariants |

Capabilities can expand. The architecture cannot weaken the verification loop.

## Workflow

```text
ask
  -> plan
  -> team
  -> work
  -> verify
  -> gate
  -> ship
  -> apply
```

Quality enters early through `ask` and `plan`, not only at the final review step. Team mode collects multiple perspectives, but the write phase stays single-executor. Verification is independent, gate decisions are explicit, and apply requires evidence.

## Quality Profile

The `quality` profile is the disciplined-development bundle:

- brainstorm before work
- test-first planning
- systematic debugging
- evidence-based review
- verification before completion
- quality gate required
- Codex verification required
- Human Gate on critical findings
- single-executor mutation policy

Example:

```bash
node scripts/install-plan.js --profile quality
node scripts/cli.js plan "implement feature X" --session feature-x
node scripts/cli.js run "implement feature X" --session feature-x
```

## Evidence-Based Review

Review findings should be specific enough to audit later:

```json
{
  "claim": "The implementation may allow real order execution.",
  "evidence": "OrderPanel imports brokerClient from src/api/broker.ts.",
  "severity": "critical",
  "category": "security",
  "required_fix": "Replace brokerClient with a mock adapter before ship.",
  "confidence": 0.91,
  "gate_required": true
}
```

The handoff schema allows these fields on issues so Codex review and challenge findings can carry evidence instead of vague objections.
