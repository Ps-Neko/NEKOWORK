# WORKING-CONTEXT

> 현재 스프린트의 액티브 메모리. 스프린트가 끝나면 `docs/dev-log/<date>-<topic>.md` 로 archive.
> CHANGELOG 가 아니라 working memory 다. 짧게, 자주 갱신.

## Purpose

(현재 스프린트의 목적 1~3줄)

## Current Truth

- 위치 / 브랜치
- 활성 모듈 / PRD ID
- 외부 의존성 (API 키 / CLI / submodule)

## Current Constraints

- 시간 / 비용 / 호환성 제약
- 알려진 마찰

## Active Queues

### In Progress
-

### Next
-

## Open PR Classification

(없음 — 또는 #N: <한 줄>)

## Interfaces

- CLI: `harness <verb> <args>`
- MCP: `mcp__harness__<tool>` (단일 게이트웨이)
- Hooks: PreToolUse / PostToolUse / PreCompact / Stop / UserPromptSubmit / SessionStart

## Update Rule

이 파일은 **현재 스프린트만** 디테일하게 유지한다. 끝난 작업은 `docs/CHANGELOG.md` 또는 `docs/dev-log/` 로 옮긴다. 1주 이상 갱신 안 되면 archive 후보.

## Latest Execution Notes

- (yyyy-mm-dd, 한 줄): ...
