# SETUP

> 외부 컨트리뷰터 / 다른 머신 셋업 가이드. P2 외부 의존 항목별 검증 절차 포함.

First-time users should start with [QUICKSTART.md](QUICKSTART.md). This file is the deeper local contributor setup guide.

Public npm publishing is not enabled for 0.0.2. The package metadata is prepared as `@ps-neko/nekowork`, but use source checkout, submodule, or local repository integration until an explicit public publish is completed.

## 사전 요구

- Node ≥ 22.0.0 (테스트는 24.14.0)
- npm
- git

## 기본 설치 (코드만 동작 — mock provider 풀사이클)

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git harness
cd harness
npm ci
npm test                                          # PASS 기대
node scripts/install-plan.js --profile core      # 설치 dry-run
```

이 시점에서 `harness review --no-ship` 등 mock 풀사이클이 모두 동작합니다. 외부 LLM 호출 없음.

## P2 외부 의존 항목별 셋업

### 1. Codex CLI live 검증 (가장 자립적 — 권장 시작점)

```bash
# CLI 설치
npm install -g @openai/codex

# 인증
codex login                                       # ChatGPT 인증 (구독 필요, 토큰 무과금)
# 종량제 API key 사용은 명시 opt-in 때만:
# export OPENAI_API_KEY="sk-..."
# export HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1

# 회귀 검증 (~25s, ~15K 토큰)
npm run verify:codex
```

검증 완료: 2026-05-03, codex-cli 0.128.0, ChatGPT 로그인 세션.
호환 버전: codex CLI ≥ 0.124.0. `codex exec --sandbox read-only` 비대화형 호출 사용.
`read-only` sandbox 는 단독 보안 경계로 보지 않는다. `runCodex` 는 실행 전후 `git status --porcelain` 을 비교해 작업공간 변조를 차단하며, 의도한 변조 실험일 때만 `HARNESS_CODEX_ALLOW_WORKSPACE_MUTATION=1` 로 우회한다.
기본 경로에서는 `OPENAI_API_KEY` 가 설정되어 있으면 차단한다. ChatGPT 로그인 세션을 쓰려면
`unset OPENAI_API_KEY` 후 실행한다.

> ℹ️ codex CLI 0.125.0 기준 stdout 형식이 `user\n<prompt echo>\n\ncodex\n<응답>` 으로 변경됨.
> `scripts/agents/runners/codex.js` 의 `runCodex` 가 `\ncodex\n` 라벨 이후만 파싱하도록 처리.

### 2. Claude Code CLI live (Claude 단계 활성화, API key 비권장 기본값)

```bash
claude auth status                               # authMethod=claude.ai 확인
npm run verify:claude                            # 구독 OAuth 세션으로 1회 smoke
node scripts/cli.js review "<task>" --live --no-ship
```

검증 완료: 2026-05-03, Claude Code CLI 2.1.126, local delegated auth.
기본 runner 는 `claude -p` 를 호출하므로 Claude Pro/Max 구독 세션을 사용한다.
`ANTHROPIC_API_KEY` 는 기본 경로에 필요 없다. SDK/API-key 경로가 꼭 필요할 때만
`HARNESS_CLAUDE_RUNNER=sdk` 와 `ANTHROPIC_API_KEY` 를 명시한다.
CLI handoff mode 는 실행 전후 git 상태를 비교해 예기치 않은 파일 쓰기를 차단한다.
의도적으로 Claude CLI 쓰기 실험을 할 때만 `HARNESS_CLAUDE_ALLOW_WORKSPACE_MUTATION=1` 을 사용한다.

### Provider CLI path trust

`claude`, `codex`, `gemini` provider CLI 는 사용자/global 설치 경로에서 해석되어야 한다.
현재 워크스페이스 내부의 shim 이 먼저 잡히면 delegated auth 를 가로챌 수 있으므로 기본 차단한다.
테스트나 의도한 로컬 shim 실험일 때만 provider 별로 `HARNESS_CODEX_ALLOW_WORKSPACE_BIN=1`,
`HARNESS_CLAUDE_ALLOW_WORKSPACE_BIN=1`, `HARNESS_GEMINI_ALLOW_WORKSPACE_BIN=1` 을 설정한다.

### 3. Gemini CLI live (research agent)

```bash
# Google 공식 Gemini CLI 설치 후 local auth 사용
gemini                                           # 최초 1회 Login with Google 선택
# Vertex/ADC 방식이 필요한 환경만:
# gcloud auth application-default login
# 종량제 API key 사용은 HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1 로 명시 opt-in 할 때만
npm run verify:gemini
```

검증 완료: 2026-05-03, Gemini CLI 0.40.1, local Gemini login session. `gcloud` 는 Gemini CLI 로그인 경로에서는 필수가 아니다.
`gemini` CLI 가 PATH 에 없으면 `verify:gemini` 는 명확히 실패한다.
기본 경로에서 `GEMINI_API_KEY` / `GOOGLE_API_KEY` 가 설정되어 있으면 auth guard 가 차단한다.

### 4. Rust runtime 컴파일

```bash
# rustup 설치 (https://rustup.rs)
# Windows MSVC target 은 Visual Studio Build Tools C++ workload 필요
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --norestart"
npm run verify:runtime
```

`verify:runtime` 은 `cargo` 가 PATH 에 없어도 기본 rustup 설치 위치(`~/.cargo/bin`)를 탐색한다.
내부적으로 release build, `cargo test`, `cargo clippy --all-targets -- -D warnings`, `--help`, `init`, `status`, `ipc ping` smoke 를 순서대로 실행한다.

주의: Node 데몬(`harness wait`)과 동시 실행 금지. 둘 다 wakeup.json 폴링.

### 5. GitHub Actions live (PR 자동 7단계 리뷰)

GitHub-hosted runner 는 로컬 Claude/Codex 로그인 세션이 없으므로 기본은 mock 이다.
CI 에서 Claude API secret 으로 live 를 켜려면 `HARNESS_CLAUDE_RUNNER=sdk` 와
`ANTHROPIC_API_KEY` 를 함께 설정하는 명시 opt-in 경로를 사용한다.

이후 PR 생성 시 `harness-review` workflow 가 7단계 풀사이클 자동 적용 + handoff 아티팩트 업로드 + PR 코멘트.

## 알려진 이슈

### `.github/workflows/` push 시 OAuth 스코프 거부

- 원인: gh CLI 디폴트 토큰의 `repo` 스코프만으로는 workflow 파일 push 불가. `workflow` 스코프 필요
- 회피 (권장): GitHub 웹 UI 에서 `Add file → Create new file` 로 `.github/workflows/<name>.yml` 직접 생성
- `gh auth refresh -s workflow` 는 환경에 따라 동의 후에도 토큰 스코프 미반영 케이스 보고됨 (gh keyring 캐시 문제 추정)

## 다음 단계

- 부채 / 우선순위: `docs/AUDIT.md`
- 운영 절차: `docs/RUNBOOK.md`
- 사내 결합: `docs/PORTING.md`
- 통합 설계: `docs/ARCHITECTURE.md`
