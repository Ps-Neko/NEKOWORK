# Internal Provider Adapter

Status date: 2026-05-07

NEKOWORK can call a private provider through an explicit local command adapter. This is intended for private infrastructure experiments where the public Claude, Codex, Gemini, or mock runners are not the right execution boundary.

The adapter is deliberately narrow:

- It is opt-in through environment variables.
- It sends one JSON request on stdin.
- It expects one handoff-compatible JSON object on stdout.
- It does not bypass Codex verification, Human Gate, strict quality, or explicit apply rules.
- It is protected by the same git mutation guard used by live provider runners.

## Configuration

```bash
HARNESS_PROVIDER_OVERRIDE=internal
HARNESS_INTERNAL_PROVIDER_COMMAND=/path/to/internal-provider
HARNESS_INTERNAL_PROVIDER_ARGS_JSON='["--mode","handoff"]'
```

On Windows PowerShell:

```powershell
$env:HARNESS_PROVIDER_OVERRIDE = "internal"
$env:HARNESS_INTERNAL_PROVIDER_COMMAND = "C:\tools\internal-provider.exe"
$env:HARNESS_INTERNAL_PROVIDER_ARGS_JSON = '["--mode","handoff"]'
```

`HARNESS_INTERNAL_PROVIDER_ARGS_JSON` is optional, but when present it must be a JSON array of strings.

## Request Protocol

The command receives a JSON object on stdin:

```json
{
  "protocol": "nekowork.internal-provider.v1",
  "stage": "codex-review",
  "agent": "codex-reviewer",
  "model": "codex",
  "sandbox": "read-only",
  "network_access": false,
  "execution_mode": "handoff",
  "task": "review parser boundary",
  "system": "Return exactly one JSON object conforming to schemas/handoff.schema.json.",
  "agent_body": "...",
  "context": {}
}
```

The command must return a JSON handoff object on stdout:

```json
{
  "decided": "Reviewed the target boundary.",
  "rejected": "No project mutation, publish, deploy, or apply.",
  "risks": "Fixable evidence gaps remain.",
  "files": [],
  "remaining": "Resolve findings before ship.",
  "issues": [],
  "verdict": "approve_with_fixes",
  "confidence": 0.82
}
```

## Safety Contract

Internal providers are capabilities, not a new architecture. They must preserve the NEKOWORK loop:

```text
ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply
```

The adapter cannot weaken these rules:

- Multi-worker stages remain read-only by default.
- Only one executor may mutate project files in a work cycle.
- Codex verification remains the independent verification path unless an explicit test harness is exercising mock behavior.
- Human Gate remains non-bypassable for risky changes.
- `report` remains inspect-only.
- `apply` remains explicit and evidence-based.

For non-interactive handoff mode, the git mutation guard rejects unexpected provider-side workspace changes. Workspace-write behavior is limited to phases that explicitly request `execution_mode: "workspace-write"`.
