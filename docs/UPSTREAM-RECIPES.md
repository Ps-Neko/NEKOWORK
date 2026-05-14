# Upstream Recipes

NEKOWORK does not absorb domain interviews, DDD, or product discovery. It begins at the verification trust boundary. The four optional upstream artifacts — `context.md`, `DOMAIN.md`, `SPEC.md`, `PLAN.md` — are produced by tools you already use. This page catalogs concrete tools that produce those artifacts, so a new user is not stuck on "where do these files come from?"

For the artifact contract itself (auto-pick paths, explicit flags, evidence files), see [INTEGRATION.md](INTEGRATION.md).

## Quick map

| Artifact | What it captures | Recipes below |
|---|---|---|
| `context.md` | Terminology, user language, current constraints | A1, A2, A3 |
| `DOMAIN.md` | Concepts, modules, ownership boundaries | B1, B2 |
| `SPEC.md` | Acceptance criteria, in-scope vs out-of-scope, risks | C1, C2 |
| `PLAN.md` | Step-by-step implementation tasks | D1, D2 |

The artifacts are optional. Use them only when the change is big or risky enough to repay the writing cost. See "Scope Rules" in [INTEGRATION.md](INTEGRATION.md).

## A. `context.md` — what is the situation

### A1. Superpowers `brainstorming` skill

Skill identifier: `superpowers:brainstorming`. Triggers user-intent exploration before any code is written. Output is conversational; capture the decisions and terminology into `context.md`.

```text
"I want to brainstorm <topic>." → use the brainstorming skill → write the
agreed terminology, user goal, and known constraints into context.md.
```

### A2. gstack `/office-hours`

YC office-hours style forcing questions (demand reality, status quo, desperate specificity, wedge, observation, future-fit). Builder mode for side projects or open source. Saves a design doc you can rename to `context.md`.

```bash
# inside Claude Code
/office-hours
```

### A3. Ad-hoc interview note

When there is no separate tool, a 10–20 line `context.md` written by hand is enough. The shape that matters:

```markdown
# context

- Who is the user
- What problem are they having
- Terminology they use
- What you have tried
- What is out of scope right now
```

## B. `DOMAIN.md` — what are the concepts and boundaries

### B1. Event Storming or Context Mapping (DDD)

Run a 30–60 minute event-storming pass on a whiteboard (physical or Miro). Extract the bounded contexts, aggregates, and ownership lines into `DOMAIN.md`. NEKOWORK does not run this for you; it consumes the result.

```markdown
# domain

## Bounded contexts
- Auth
- Billing
- Reporting

## Aggregates
- Auth/User, Auth/Session
- Billing/Subscription, Billing/Invoice

## Ownership
- Auth → backend team
- Billing → platform team
```

### B2. Architecture diagram extraction

If an ARCHITECTURE.md or C4 diagram already exists, distill module names and seams into `DOMAIN.md`. The point is to fix the words NEKOWORK will see in handoffs.

## C. `SPEC.md` — what counts as done

### C1. gstack `/plan-ceo-review` and `/plan-eng-review`

CEO review challenges scope and ambition; engineering review locks in architecture, edge cases, test coverage. Run them on a draft spec, fold the corrections into `SPEC.md`.

```bash
/plan-ceo-review     # is this ambitious enough or scoped tightly enough
/plan-eng-review     # are edge cases, data flow, perf addressed
```

### C2. Spec template

```markdown
# spec

## In scope
- ...

## Out of scope
- ... (explicit; NEKOWORK will not relitigate this)

## Acceptance criteria
- AC1 ...
- AC2 ...

## Known risks
- ...
```

NEKOWORK's `plan` stage records acceptance criteria into evidence; explicit out-of-scope lines keep `verify` and `ship` from drifting.

## D. `PLAN.md` — what are the steps

### D1. Superpowers `writing-plans` skill

Skill identifier: `superpowers:writing-plans`. Produces a numbered, step-sized plan from a spec. Save the output as `PLAN.md`; NEKOWORK `work` auto-picks it from the project root.

### D2. Claude Code `/plan` or a written outline

A flat list works fine — NEKOWORK does not require a particular schema.

```markdown
# plan

1. Add Foo model with X fields
2. Wire Foo into Bar service
3. Migration N → N+1
4. Acceptance: AC1, AC2
```

## Wiring it into NEKOWORK

Drop the files at the project root. Each stage auto-picks them:

```bash
nekowork ask "<task>"     # picks context.md
nekowork plan "<task>"    # picks context.md + DOMAIN.md + SPEC.md
nekowork work "<task>"    # picks PLAN.md
```

Or pass an explicit flag if the file lives elsewhere:

```bash
nekowork plan "<task>" --context-file docs/context.md --spec-file docs/spec.md
nekowork work "<task>" --plan-file docs/plan.md
```

Missing canonical files are silent (no error). An explicit flag pointing at a missing file is a fatal error so typos cannot be masked. The loaded files are recorded with `path`, `source`, `size`, `sha1`, `truncated`, `excerpt` in the stage's evidence JSON.

## What NEKOWORK is intentionally not

NEKOWORK will not grow features that replace these tools:

- no domain interview engine
- no DDD generator
- no product-discovery suite
- no auto-memory adoption from upstream context
- no automatic apply, commit, push, publish, deploy, or PR creation

Upstream tools own domain clarity. NEKOWORK owns the evidence-backed apply boundary. If a recipe above feels like it should be inside NEKOWORK, that is the signal to keep using the upstream tool instead.
