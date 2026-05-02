# WORKING-CONTEXT

> 현재 스프린트의 액티브 메모리. 스프린트가 끝나면 `docs/dev-log/<date>-<topic>.md` 로 archive.
> CHANGELOG 가 아니라 working memory 다. 짧게, 자주 갱신.

## Purpose

P1 회수 후 잡티 제거 + 거버넌스 정합. 외부 의존 영역 (API 키 / GitHub push / Rust / Codex CLI) 은 사용자 동의 시점까지 보류.

## Current Truth

- 위치: `REPO_ROOT/` · 브랜치: `main`
- 버전: `0.0.2` (2026-04-29 P1 회수 릴리스)
- 카탈로그: 11 agents · 5 skills (+1 ralph) · 5 hooks · 6 modules · 5 profiles
- 5 빌더 모두 동작 (claude / codex / cursor / gemini / opencode) + codemaps 보너스
- 단일 / 통합 / e2e 합 73/73 PASS
- 외부 의존성: 옵션 — `ANTHROPIC_API_KEY` (--live), `codex` / `gemini` 바이너리, rustup

## Current Constraints

- 사용자 룰: "확인 후 실행" — git push / API 키 사용은 명시 동의 후만
- Windows 환경 마찰: tmux 미사용, Node 22+ glob 미지원 (`tests/<dir>/*.test.js` 명시 필요)
- 사내 PoC 두 디렉터리 (`iljin-rag-poc`, `cad-api-bridge`) 는 메모리 등록된 제외 대상
- 인접 LLM endpoint / 사내 GitLab 등 사내 임팩트는 사용자 명시 시점에 결정

## Active Queues

### In Progress
- 2.5시간 잡티 제거 배치 (CHANGELOG / WORKING-CONTEXT / Validator 경고 / RUNBOOK·PORTING / Security Bar)

### Next
- AUDIT P0 외부 검증 (사용자 동의 후): API live 1회, GitHub push, Actions 실 동작
- AUDIT P2 외부 의존: Rust 컴파일, Codex/Gemini CLI live, npm publish 결정

## Open PR Classification

(없음 — 레포 미 push)

## Interfaces

- CLI: `harness <verb> <args>`
- MCP: `mcp__harness__<tool>` (단일 게이트웨이)
- Hooks: PreToolUse / PostToolUse / PreCompact / Stop / UserPromptSubmit / SessionStart

## Update Rule

이 파일은 **현재 스프린트만** 디테일하게 유지한다. 끝난 작업은 `docs/CHANGELOG.md` 또는 `docs/dev-log/` 로 옮긴다. 1주 이상 갱신 안 되면 archive 후보.

## Latest Execution Notes

- 2026-04-29: P1 회수 세션 완료 (`docs/dev-log/2026-04-29-p1-recovery.md`). 빈 디렉터리 6 → 0, 미구현 스크립트 9 → 0, ARCHITECTURE 528줄, 73 테스트.
- 2026-04-29: 잡티 제거 배치 진행 중 — 본 파일 갱신 + Validator 경고 정합 + RUNBOOK/PORTING/Security Bar 보완.
- 2026-04-30: **auth migration 완료**. PR #1-#3 (3계층 인증 + GitHub OAuth + OS keychain) main 머지 (`60e9de9` → `7c4f2c8`, +4 commits, rebase merge). PR #2/#3 은 phase-1 옛 SHA 포함으로 force-push 1회씩(`--onto origin/main bf72841`/`b2b1bce` + `--force-with-lease`). Smoke 3/4 PASS (#1 `claude /status` Claude Max, #2 override 차단 3 케이스, #4 keychain Windows Credential Manager). #3 GitHub OAuth Device Flow 는 OAuth App 미등록으로 사용자 자율 보류 — 실제 GitHub automation 사용 시점에 수행. PR #4 (codex 0.125+ 호환) 는 본 작업과 무관 OPEN 잔존.
