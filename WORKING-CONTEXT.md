# WORKING-CONTEXT

> 현재 스프린트의 액티브 메모리. 스프린트가 끝나면 archive 또는 docs 로 옮긴다. CHANGELOG 가 아니라 working memory.
> Last updated: 2026-04-29

## Purpose

차세대 통합 AI 개발 에이전트 하네스 HARNESS 의 부트스트랩. ECC + OMC + claude-led-codex-review 의 통합 설계를 코드로 옮긴다.

## Current Truth

- Day 1 진행 중. 위치: `D:\claude\harness\`.
- 인접 사내 프로젝트는 다루지 않는다 (사용자 룰).
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
- 2026-04-29 **Day 6 완료**.
  - 4 provider runner (mock/claude/codex/gemini) + dispatch + 7단계 orchestrator + cli wiring.
  - mock 디폴트 (API 키 / Codex CLI 미보유 환경에서도 동작), --live 옵션으로 실 호출.
  - sensitive path 자동 감지 (auth/crypto/payment/jwt 등) → 단계 6 자동 활성.
  - round 한도 + critical 발견 → HUMAN_GATE 자동.
  - node --test 5/5 PASS. harness review CLI 데모 OK.
- 2026-04-29 **Week 2 완료**.
  - Day 7: lib/{severity,router,costs}.js + MCP 3 신규 도구 (severity_classify, route_decide, cost_record) + harness costs CLI + routing.jsonl 자동 적층.
  - Day 8: skills/ralph/SKILL.md + scripts/orchestrators/ralph.js (PRD AC 누적 PASS) + scripts/daemon/wait.js (start/stop/status). 명시 옵트인만 (자동 키워드 활성 OFF).
  - Day 9-10: .github/workflows/{harness-review,harness-validate}.yml + docs/PORTING.md (사내 PoC 이식 가이드).
  - 단위 테스트 24/24 PASS. 83 파일. 풀체인 동작 (review / ralph / costs / sessions / wait).
- 2026-04-29 **Week 3 완료 (Day 11~15)**.
  - Day 11: instincts 시스템 (record/list/promote/prune) + orchestrator 자동 누적 + CLI + 11/11 테스트.
  - Day 12: simulate-port.js + 5/5 테스트 (외부 디렉터리 인용 제거).
  - Day 13: claude/codex extractJson + buildPrompt export + 12/12 테스트.
  - Day 14-15: CHANGELOG Week 3, WORKING-CONTEXT 갱신, 최종 회귀.
  - 누적: 4 커밋, ~92 파일, ~10,500 LOC, 단위 테스트 52/52 PASS.
- 2026-04-29 **Week 4 완료 (Day 16~20)**.
  - Day 16: instincts.ready() + CLI + 4 신규 단위 테스트 (15/15 PASS).
  - Day 17-18: Rust runtime 골격 — Cargo.toml + 5 .rs 파일 (529 LOC, 컴파일은 rustup 설치 후).
  - Day 19: 사용자 D 선택 — 외부 환경 변경 보류, AUDIT 집중.
  - Day 20: docs/AUDIT.md — Week 1~4 통합 검토 (18절 매핑, 8계층 매핑, 빠진 항목 / 부채 / P0~P3 우선순위).
  - 누적: 5 커밋 예정, ~100 파일, ~12,000 LOC, 단위 테스트 56/56 PASS.
- **세션 종료**. 다음 세션 P0: 실 LLM 호출 / PoC 결합 / GitHub push (사용자 명시 동의 시).
