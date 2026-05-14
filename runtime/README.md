# HARNESS Rust Runtime

Persistent supervisor + IPC bridge for HARNESS. It complements the Node `nekowork wait` loop with SQLite-backed state, wakeup polling, and stdio JSON-RPC.

## Build

Windows prerequisites:

```powershell
winget install --id Rustlang.Rustup -e
winget install --id Microsoft.VisualStudio.2022.BuildTools -e `
  --override "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --norestart"
```

Build:

```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
cargo build --release
```

Output: `target/release/harness-runtime.exe` on Windows, `target/release/harness-runtime` on Linux/macOS.

From the repository root, the same verification can be run without manually editing PATH:

```powershell
npm run verify:runtime
```

`verify:runtime` locates `cargo` on PATH or in the default rustup install directories, then runs release build, tests, clippy, and smoke checks.

## Smoke

Verified on Windows on 2026-05-03:

```powershell
runtime\target\release\harness-runtime.exe --help
runtime\target\release\harness-runtime.exe init
runtime\target\release\harness-runtime.exe status
$json = '{"id":1,"method":"ping"}'
$json | runtime\target\release\harness-runtime.exe ipc
```

Expected ping response:

```json
{"id":1,"result":{"pong":true}}
```

PowerShell pipeline input can include a UTF BOM, so the IPC parser ignores a leading BOM.

## Commands

```powershell
runtime\target\release\harness-runtime.exe init
runtime\target\release\harness-runtime.exe daemon --foreground --poll-ms 5000
runtime\target\release\harness-runtime.exe status
'{"id":1,"method":"ping"}' | runtime\target\release\harness-runtime.exe ipc
```

## Responsibilities

- `session.rs`: SQLite `.harness/runtime.sqlite` with `sessions`, `handoffs`, and `audits`.
- `supervisor.rs`: polls `.harness/state/sessions/<id>/wakeup.json`, spawns `node scripts/cli.js ralph`, ignores sessions at `HUMAN_GATE`.
- `ipc.rs`: single-request stdio JSON-RPC for Node/Rust handoff.
- `observability.rs`: tracing and status output.

Do not run the Node daemon and Rust supervisor at the same time against the same workspace.
