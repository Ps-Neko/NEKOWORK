# WORKING-CONTEXT

> 현재 스프린트의 액티브 메모리. 스프린트가 끝나면 archive 또는 docs 로 옮긴다. CHANGELOG 가 아니라 working memory.
> Last updated: 2026-04-29

## Purpose

차세대 통합 AI 개발 에이전트 하네스 HARNESS 의 부트스트랩. ECC + OMC + claude-led-codex-review 의 통합 설계를 코드로 옮긴다.

## Current Truth

- Day 1 진행 중. 위치: `D:\claude\harness\`.
- 인접 사내 프로젝트: `D:\claude\cad-api-bridge`, `D:\claude\iljin-rag-poc`.
- 기술 스택: Node 22 + TypeScript strict, 추후 Rust(runtime/) TUI.
- 한국어 응답 강제. 사용자 글로벌 룰 우선.

## Current Constraints

- 4시간 풀 사이클로 Day 1 완료 목표.
- MVP 카탈로그: 11 agents, 5 skills, 4 hooks, 6 modules.
- 184 스킬 풀 카탈로그 채택 안 함 (progressive 확장).
- tmux 기반 team 런타임은 Q2 (Windows 환경 마찰).

## Active Queues

### In Progress
- Day 1: 골격 + 거버넌스 + 매니페스트 + 스키마 + plan stub.

### Next
- Day 2: agents/ 11 frontmatter, skills/claude-led-codex-review/SKILL.md, codex-reviewer 페르소나.
- Day 3: hooks/hooks.json + 4훅 stub, scripts/build-claude.js.
- Day 4: bridge/mcp-server.cjs 최소 4도구.
- Day 5: gateguard-fact-force + quality-gate 실 구현.

## Open PR Classification

(없음 — Day 1)

## Interfaces

- CLI: `harness <verb> <args>`
- MCP: `mcp__harness__<tool>` (단일 게이트웨이)
- Hooks: PreToolUse / PostToolUse / PreCompact / Stop / UserPromptSubmit / SessionStart

## Update Rule

이 파일은 **현재 스프린트만** 디테일하게 유지한다. 끝난 작업은 `docs/CHANGELOG.md` 로 옮긴다. 1주 이상 갱신 안 되면 archive 후보.

## Latest Execution Notes

- 2026-04-29 **Week 1 풀 진행 완료**.
  - Day 1: 골격 + 거버넌스 6 + agent.yaml + manifests + schemas 10 + install plan stub.
  - Day 2: agents 11 + skills 5 + commands 1 (catalog warnings 0).
  - Day 3: hooks 5 + build-claude (22 components) + build-codex (config.toml + TOML agents).
  - Day 4: MCP gateway (4도구, smoke PASS) + install-apply 풀체인.
  - Day 5: gateguard 실 (importer/exports 정적 추출 + 답변 강제), quality-gate 실 (tsc/ruff 차단), demo-review 7단계 풀사이클 검증.
  - 통계: 66 파일, 6,765 LOC. 137 packages 의존성.
