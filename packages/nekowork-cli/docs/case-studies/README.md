# Case Studies

> **Legacy session-flow case studies.** These records document the session-based
> orchestration (`ask` / `run` / `ship` / `report --session`, with `--profile` and
> `--strict-quality`) — the compatibility surface in [ADVANCED.md](../ADVANCED.md),
> scheduled for removal in 2.0 ([SCOPE-1.0.md](../SCOPE-1.0.md)). They are **not**
> 1.0 `verify-pr` runs. For verify-pr evidence see the real OSS rule corpus in
> [BENCHMARK.md](../BENCHMARK.md) and the example report in [DEMO-REPORT.md](../DEMO-REPORT.md).

This directory records legacy NEKOWORK session runs against real projects. Each keeps the
session-flow invariants visible:

- no automatic publish, deploy, push, or PR
- read-only team or planning phases unless explicitly scoped
- one executor for write phases
- Codex verification before ship readiness
- Human Gate when risk policy requires it
- explicit apply only after verified readiness

## Case Studies

- [sindresorhus/is-plain-obj](SINDRESORHUS-IS-PLAIN-OBJ.md): third-party public npm package, quality-profile session run, strict-quality no-ship evidence.
- [jshttp/basic-auth](JSHTTP-BASIC-AUTH.md): third-party public auth parser, security-profile session run, Codex review plus challenge, no-ship evidence.
- [python-hyper/h11](PYTHON-HYPER-H11.md): third-party public Python HTTP/1.1 protocol library, quality-profile session run, strict-quality no-ship evidence.
- [motdotla/dotenv](MOTDOTLA-DOTENV.md): third-party public environment configuration loader, security-profile session run, Windows path failures plus no-ship evidence.
- [Diary local app](DIARY-LOCAL-APP.md): user-provided local full-stack app produced with the legacy NEKOWORK skill/process, validated with tests, typecheck, and lint.
