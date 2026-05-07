# Case Studies

This directory records NEKOWORK runs against real projects or production-like fixtures.

Case studies must keep the NEKOWORK invariants visible:

- no automatic publish, deploy, push, or PR
- read-only team or planning phases unless explicitly scoped
- one executor for write phases
- Codex verification before ship readiness
- Human Gate when risk policy requires it
- explicit apply only after verified readiness

## Current Case Studies

- [sindresorhus/is-plain-obj](SINDRESORHUS-IS-PLAIN-OBJ.md): third-party public npm package, quality-profile run, strict quality no-ship evidence.
- [jshttp/basic-auth](JSHTTP-BASIC-AUTH.md): third-party public auth parser, security-profile run, Codex review plus challenge, no-ship evidence.
