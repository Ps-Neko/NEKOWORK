# AUTH-MIGRATION — API key → 위임/OAuth/vault 3계층 전환

> 대상: NEKOWORK / HARNESS 0.0.x → 0.1.x.
> 목적: provider 인증을 boundary-first 정책에 맞춰 정합화. **API key 일괄 제거가 아니라 `delegated-first, OAuth-where-possible, vault-elsewhere`**.

## 0. 왜 바꾸나

기존 구조의 3가지 결함:

1. **Claude 구독자에게 종량제 과금이 새는 사고 위험**
   - 사용자가 `~/.bashrc`에 `export ANTHROPIC_API_KEY=...`를 박아두면 Claude Code가 구독 OAuth 세션을 무시하고 API 과금으로 빠진다.
   - HARNESS가 `.env.example`에 API key 슬롯을 두고 있으면 이 위험을 권장하는 셈.

2. **정적 long-lived API key 노출**
   - `.env`에 평문 보관 → repo 누출, OS-level 침해 시 영구 자격 증명 유출.

3. **권한 게이트와 인증의 비대칭**
   - `agent.yaml`의 `approval_required_for: [egress, off_repo_write]`는 **호출**을 막지만, **자격 증명 자체**는 검증 없이 통과.

## 1. 3계층 인증 모델

```txt
계층 1  delegated_cli_auth   ← LLM provider 전부 (Claude/Codex/Gemini)
계층 2  oauth_device         ← GitHub
계층 3  api_key_vault        ← Exa / Context7 / 사내 RAG (위임/OAuth 둘 다 불가)
```

### 1.1 계층 1 — CLI 세션 위임

| Provider | 위임 대상 | 검사 명령 | 차단할 환경변수 |
|---|---|---|---|
| Claude (Anthropic) | `claude` (Claude Code) | `claude /status` | `ANTHROPIC_API_KEY` |
| OpenAI (Codex) | `codex` (Codex CLI) | `codex auth status` | `OPENAI_API_KEY` |
| Google (Gemini) | `gemini` 또는 `gcloud` | `gcloud auth list` | `GEMINI_API_KEY`, `GOOGLE_API_KEY` |

**원칙**: NEKOWORK은 LLM token을 **잡지 않는다**. CLI 세션이 이미 갖고 있다고 가정하고 호출만 위임. token 저장/회전은 각 CLI의 책임.

### 1.2 계층 2 — NEKOWORK이 직접 OAuth 관리

| Provider | Flow | Scope | Token 저장 |
|---|---|---|---|
| GitHub | OAuth Device Flow | `repo`, `workflow` | `~/.harness/oauth/github.json` (0600) |

**원칙**: GitHub는 device flow가 표준이고 client secret이 필요 없다 → NEKOWORK에서 직접 발급/갱신해도 안전.

### 1.3 계층 3 — Vault (마지막 수단)

| Provider | 이유 |
|---|---|
| Context7 | 무료 plan key, OAuth 미지원 |
| Exa | API key 기반 HTTP MCP, OAuth 미지원 |
| 사내 RAG | 자체 발급 토큰, OAuth 도입 시점 미정 |

**원칙**: vault에만 보관하고 환경 변수 주입은 호출 직전에. `.env`에는 평문 금지, 예시 슬롯도 두지 않는다.

## 2. 핵심 정책 — `block_subscription_override`

NEKOWORK이 환경 변수에 token을 넣지 않더라도, **사용자 환경에 이미 있을 수 있다**. 이걸 막는 게 본 마이그레이션의 핵심 보안 항목.

### 2.1 정책

```yaml
auth:
  policy:
    block_subscription_override: true
```

활성화되면 `pre-bash-dispatcher` 훅이 다음을 강제:

- `claude ...` 호출 직전 `ANTHROPIC_API_KEY`가 set이면 → 차단
- `codex ...` 호출 직전 `OPENAI_API_KEY`가 set이면 → 차단
- `gemini ...` 호출 직전 `GEMINI_API_KEY`/`GOOGLE_API_KEY`가 set이면 → 차단

### 2.2 옵트아웃

명시적으로 종량제 사용을 원하는 경우:

```bash
HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1 claude ...
```

또는 `agent.yaml`에서:

```yaml
auth:
  policy:
    block_subscription_override: false
```

옵트아웃은 **audit 이벤트**로 기록 (`auth.subscription_override_allowed`).

## 3. agent.yaml auth 섹션 스펙

```yaml
auth:
  mode: delegated-first
  token_store:
    kind: encrypted-file        # v1: 단순 0600 파일. v2: OS keychain.
    path: ~/.harness/oauth
  providers:
    anthropic:
      flow: delegated_cli_auth
      command: claude
      auth_check: "claude /status"
      disallow_env_keys: [ANTHROPIC_API_KEY]
    openai:
      flow: delegated_cli_auth
      command: codex
      auth_check: "codex auth status"
      disallow_env_keys: [OPENAI_API_KEY]
    google:
      flow: delegated_cli_auth
      command: gemini
      auth_check: "gcloud auth list"
      disallow_env_keys: [GEMINI_API_KEY, GOOGLE_API_KEY]
    github:
      flow: oauth_device
      scopes: [repo, workflow]
      client_id_env: HARNESS_GITHUB_CLIENT_ID
    context7:
      flow: api_key_vault
      vault_key: CONTEXT7_API_KEY
    exa:
      flow: api_key_vault
      vault_key: EXA_API_KEY
  policy:
    block_subscription_override: true
    require_human_approval_for_scope_escalation: true
    redact_tokens_in_audit: true
    deny_static_api_keys_in_repo: true
```

### 3.1 필드 의미

| 필드 | 설명 |
|---|---|
| `mode` | `delegated-first` (권장), `oauth-first`, `vault-only` 중 하나. |
| `token_store.kind` | `encrypted-file` (v1), `os-keychain` (v2 예정). |
| `providers.<name>.flow` | `delegated_cli_auth` / `oauth_device` / `oauth_pkce` / `api_key_vault` |
| `providers.<name>.disallow_env_keys` | 호출 직전 환경에서 검사할 키 목록. set이면 차단. |
| `policy.block_subscription_override` | 위 검사 활성/비활성. |
| `policy.deny_static_api_keys_in_repo` | repo 안 `.env*` 파일에 키가 평문 보관되어 있으면 경고/차단. |

## 4. 단계별 마이그레이션

| Phase | 작업 | 산출물 | 호환성 |
|---|---|---|---|
| **1** | `agent.yaml` auth 섹션 + 스키마 추가 | yaml + JSON schema | 정책 선언만, 동작 영향 없음 |
| **2** | `mcp.gateway` 경로 정정 (`.cjs` → `.js`) | yaml | 빌드 결과만 정합 |
| **3** | `pre-bash-dispatcher`에 `block_subscription_override` 가드 | hook | 환경에 키 있으면 차단 (옵트아웃 가능) |
| **4** | GitHub OAuth device flow 구현 | `scripts/auth/github-*.js` + `scripts/lib/token-vault.js` | `GITHUB_TOKEN` env는 fallback으로 격하 |
| **5** | `.env.example`에서 LLM key 슬롯 제거, RUNBOOK 업데이트 | `.env.example`, `RUNBOOK.md` | breaking, 가이드 제공 |
| **6** | (선택) OS keychain wrapper, audit 이벤트 표준화 | `scripts/lib/keychain.js` | 점진적 |

각 Phase는 독립 PR로 배포. Phase 5만 사용자 환경에 영향 (브레이킹).

## 5. 사용자 가이드 (Phase 5 이후)

### 5.1 Claude 구독자 (Pro / Max)

```bash
# 한 번만:
claude login                              # 구독 OAuth 세션 생성

# 환경 정리:
unset ANTHROPIC_API_KEY                   # 있으면 OAuth가 무시됨
echo 'unset ANTHROPIC_API_KEY' >> ~/.bashrc

# NEKOWORK 사용:
harness review "<task>"                   # claude CLI 통해 자동 위임
```

### 5.2 Codex CLI 사용자

```bash
codex auth login                          # ChatGPT 구독 OAuth 또는 API key
unset OPENAI_API_KEY                      # 구독 사용 시
harness codex-review
```

### 5.3 GitHub

```bash
# OAuth App 등록 (한 번만):
# https://github.com/settings/developers → New OAuth App
# Device flow 활성화 → Client ID 받기

export HARNESS_GITHUB_CLIENT_ID=<your_client_id>
npm run auth:github:login                 # device code 표시 → 브라우저 인증
npm run auth:github:status                # 상태 확인
```

### 5.4 종량제 사용을 원하는 경우 (옵트아웃)

```bash
# 일회성:
HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1 claude ...

# 영구:
# agent.yaml: auth.policy.block_subscription_override = false
```

## 6. 보안 노트

### 6.1 Audit 이벤트

`bridge/mcp-server.js`의 `audit()`가 다음 이벤트를 기록 (`secret_redaction: true`로 토큰 마스킹):

- `auth.cli_delegated` — CLI 위임 검사 통과
- `auth.cli_delegation_failed` — `auth_check` 명령 실패 (CLI 미설치/미로그인)
- `auth.token_issued` — OAuth token 발급 (provider, scopes, expires_at)
- `auth.token_refreshed` — 갱신
- `auth.token_revoked` — 회수
- `auth.subscription_override_blocked` — 환경 변수 차단됨
- `auth.subscription_override_allowed` — 옵트아웃 사용
- `auth.scope_escalation_requested` — 새 scope 요청 (human gate)
- `auth.scope_escalation_approved` / `denied`

### 6.2 Token redaction

audit 로그와 stderr 출력에서 token 값은 `***REDACTED***`로 마스킹. 정규식 기반 후필터(`scripts/lib/token-vault.js`의 `redact()`).

### 6.3 Revoke 흐름

```bash
npm run auth:github:logout                # 로컬 vault 삭제 + GitHub revoke API
# 또는:
rm -rf ~/.harness/oauth                   # 모든 token 강제 폐기
```

## 7. FAQ

### Q1. 왜 Anthropic/OpenAI에 직접 OAuth를 안 쓰나?

Messages API와 OpenAI Responses API는 OAuth endpoint를 제공하지 않는다 (2026-04 기준). API key 전용. 따라서 NEKOWORK이 "OAuth 같은 흐름"을 직접 구현해도 의미 없음 → CLI 세션에 위임하는 것이 정답.

### Q2. `ANTHROPIC_API_KEY`를 진짜 못 쓰나?

쓸 수 있다. `HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1` 옵트아웃 또는 `block_subscription_override: false`. 단 audit에 기록되므로 의도가 명시된다.

### Q3. token vault는 진짜 안전한가?

v1은 `0600` 권한 파일. **OS keychain(macOS Keychain / Windows Credential Manager / Linux Secret Service) 도입은 v2**. 그 전까지는 적어도 repo 안에 두지 않는다는 보호선만 보장.

### Q4. CI 환경에서는?

CI는 사용자 세션이 없으므로 모든 provider를 vault 경로로 처리. GitHub Actions의 `GITHUB_TOKEN`은 자동 발급되어 단명, OAuth flow와 동등 취급. Anthropic/OpenAI는 secret으로 주입하되 `HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1` 명시.

## 8. 변경 이력

| 일자 | Phase | 비고 |
|---|---|---|
| 2026-04-29 | 1-5 | 본 문서 작성. 5개 PR 단위 진행 예정. |
