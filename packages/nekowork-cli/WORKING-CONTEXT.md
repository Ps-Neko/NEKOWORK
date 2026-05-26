# WORKING-CONTEXT

> 현재 스프린트의 액티브 메모리. 스프린트가 끝나면 `docs/dev-log/<date>-<topic>.md` 로 archive.
> CHANGELOG 가 아니라 working memory 다. 짧게, 자주 갱신.

## Purpose

0.0.2 local-first HARNESS 안정화. CLI 위임 인증, provider runner, 검증 게이트, 문서/스키마 정합성을 현재 기준으로 유지한다.

## Current Truth

- 위치: `REPO_ROOT/` · 브랜치: `main`
- 버전: `0.1.0-alpha.12` (repo; npm alpha 는 `0.1.0-alpha.11` published 2026-05-16, alpha.12 publish 진행 중)
- 카탈로그: 11 agents · 5 skills (+1 ralph) · 5 hooks · 6 modules · 5 profiles
- 5 빌더 모두 동작 (claude / codex / cursor / gemini / opencode) + codemaps
- `npm test`, `npm run lint`, `npm audit --audit-level=moderate`, provider live smoke, Rust release build 검증 경로 유지
- 외부 의존성: 옵션 — provider CLI 로그인 세션, npm publish 결정, 사내 PoC 결합

## Current Constraints

- 사용자 룰: "확인 후 실행" — git push / API 키 사용은 명시 동의 후만
- Windows 환경 마찰: tmux 미사용, Node 22+ glob 미지원 (`tests/<dir>/*.test.js` 명시 필요)
- 사내 PoC 두 디렉터리 (`iljin-rag-poc`, `cad-api-bridge`) 는 메모리 등록된 제외 대상
- 인접 LLM endpoint / 사내 GitLab 등 사내 임팩트는 사용자 명시 시점에 결정

## Active Queues

### In Progress
- 외부 알파 5명 모집 + 7일 피드백 수집 (POST-RELEASE-CHECKLIST §4-§5, **사용자 수동 social work**)

### Next
- 1.0 게이트 5조건 점검 (SCOPE-1.0 §13.2): recall ≥ 0.90, FP ≤ 0.10 (real-world corpus), 외부 알파 3/5 "다시 쓰겠다", CRITICAL 미탐 0, 치명적 오탐 0
- real-world fixture 추가 후 `npm run bench:rules` 재측정
- 코드 품질 핫스팟 3건 (cli.js 분해 / orchestrator 보일러플레이트 추출 / 미사용 export) — **publish 게이트 통과 이후**

### 절대 금지 (현 단계)
- 코드 추가 (외부 피드백 없이 추측으로 룰 늘리기 금지)
- scope 확장 (verify-skill / verify-release 등은 1.x)
- "1.0 곧 출시" 류 마케팅

## Open PR Classification

(이전 작업 — auth migration / harness.dev placeholder / 검증 게이트 cut 등은 main 머지 완료, 메모리 `nekowork-*` 참조)

## Interfaces

- CLI: `nekowork <verb> <args>` (legacy alias: `harness`, 영구 유지)
- MCP: `mcp__harness__<tool>` (단일 게이트웨이)
- Hooks: PreToolUse / PostToolUse / PreCompact / Stop / UserPromptSubmit / SessionStart

## Update Rule

이 파일은 **현재 스프린트만** 디테일하게 유지한다. 끝난 작업은 `docs/CHANGELOG.md` 또는 `docs/dev-log/` 로 옮긴다. 1주 이상 갱신 안 되면 archive 후보.

## Latest Execution Notes

- 2026-04-29: P1 회수 세션 완료 (`docs/dev-log/2026-04-29-p1-recovery.md`). 빈 디렉터리 6 → 0, 미구현 스크립트 9 → 0, ARCHITECTURE 528줄, 73 테스트.
- 2026-04-29: 잡티 제거 배치 진행 중 — 본 파일 갱신 + Validator 경고 정합 + RUNBOOK/PORTING/Security Bar 보완.
- 2026-04-30: **auth migration 완료**. PR #1-#3 (3계층 인증 + GitHub OAuth + OS keychain) main 머지 (`60e9de9` → `7c4f2c8`, +4 commits, rebase merge). PR #2/#3 은 phase-1 옛 SHA 포함으로 force-push 1회씩(`--onto origin/main bf72841`/`b2b1bce` + `--force-with-lease`). Smoke 3/4 PASS (#1 `claude /status` Claude Max, #2 override 차단 3 케이스, #4 keychain Windows Credential Manager). #3 GitHub OAuth Device Flow 는 OAuth App 미등록으로 사용자 자율 보류 — 실제 GitHub automation 사용 시점에 수행. PR #4 (codex 0.125+ 호환) 는 본 작업과 무관 OPEN 잔존.
- 2026-05-14: **alpha.10 npm publish 완료**. dist-tag `@alpha`. 19개 CLI 명령 wide surface. 코드 품질 핫스팟 3건 진단 (cli.js 1543 LOC / orchestrator 보일러플레이트 / 미사용 export 3건) — publish 게이트 후 처리.
- 2026-05-15~16: **1.0 검증 게이트 cut + alpha.11 publish**. `feat(verify-pr)` 5 deterministic rules + Auto-Apply-Commit-Push + GitHub Actions PR comment + bench:rules. 정체성을 "verification-first AI development factory" 12-Station 으로 정제 (VISION.md). README hero 는 검증 게이트 카피 유지.
- 2026-05-16: **post-publish CI red 사고 복구** (`6a0e862`). `.gitignore *.pem` 룰이 secret-detection 룰 자체 fixture 까지 차단 → alpha.11 가 CI red 6 commit streak 상태로 publish. `!tests/fixtures/**/*.pem` 예외 + synthetic fixture 2개 commit 으로 복구. POST-RELEASE-CHECKLIST §0.2 에 CI green 3항목 게이트 추가 (`f6995ab`). 메모리 `nekowork-alpha11-verify-pr` 의 '자기모순' 섹션 참조.
