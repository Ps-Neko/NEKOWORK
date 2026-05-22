# Security Model

NEKOWORK is local-first by default. The safest path is to let provider CLIs manage their own local login sessions instead of passing long-lived API keys through the harness.

## Delegated CLI Auth

Default live provider calls use local CLI sessions:

- Claude: `claude` CLI session
- Codex: `codex` CLI session
- Gemini: `gemini` CLI session

The harness calls these CLIs as local processes and does not need to store LLM provider API keys.

## API Key Guard

Before delegated provider calls, NEKOWORK blocks common long-lived API key environment variables by default:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_API_KEY`

Use `HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1` only when a metered API-key path is intentional.

## CLI Path Trust

Provider CLIs should resolve from user/global install locations, not from the current project workspace. This prevents a repository-local `claude`, `codex`, or `gemini` shim from hijacking delegated auth.

If a local test shim is intentional, opt in explicitly with provider-specific environment variables such as:

```bash
HARNESS_CODEX_ALLOW_WORKSPACE_BIN=1
HARNESS_CLAUDE_ALLOW_WORKSPACE_BIN=1
HARNESS_GEMINI_ALLOW_WORKSPACE_BIN=1
```

## Git Mutation Guard

Read-only or handoff-mode provider runs are checked after execution. Unexpected workspace mutations are blocked unless an explicit provider-specific override is set.

This is especially important for Codex read-only review, because the Codex sandbox should not be treated as the only security boundary.

## MCP Supply Chain

MCP stdio servers must use exact SemVer pins. HTTP MCP servers must use HTTPS.

The `security-hardening` gate checks MCP pins, workflow permissions, job timeouts, dependency specs, OIDC policy, and package-lock presence:

```bash
npm run security:hardening
```

## Human Gates

Automation stops for high-risk conditions:

- critical severity
- repeated fix rounds
- large blast radius
- explicit security-sensitive review paths

The goal is not fully autonomous shipping. The goal is a local workflow that preserves independent review and human control.

## Audit And Redaction

Audit records are designed to redact common token fields. Do not commit secrets, `.env` files, private keys, or provider tokens to the repository.

Run the standard release gates before publishing or tagging:

```bash
npm run lint
npm test
npm audit --audit-level=moderate
node scripts/repair.js --check
node scripts/sync-claude-md.js --check
node scripts/build-codemaps.js --check
npm run security:hardening
```
