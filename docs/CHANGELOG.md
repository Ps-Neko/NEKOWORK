# CHANGELOG

> 형식: Keep a Changelog · 버전: SemVer · 한국어 표기.

## [Unreleased]

### Week 5 후보 (docs/AUDIT.md 우선순위 P0~P2)
- P0: Anthropic SDK 1회 실 호출 검증 (사용자 API 키 동의)
- P0: 사내 PoC 비파괴 결합 (iljin-rag-poc 부터)
- P0: GitHub push + Actions 실 동작 검증
- P1: scripts/{sync-claude-md, repair, build-cursor, build-gemini, build-opencode}.js
- P1: rules/{common, typescript, python} 내용 작성
- P1: stub 메시지 정리
- P2: integration / e2e 테스트, ARCHITECTURE 풀 18절, Rust runtime 컴파일 검증, codemap 자동화

## [0.0.1-week4] — 2026-04-29

> Week 4 완료. 자동 promote 규칙 + Rust runtime 골격 + Week 1~4 AUDIT.

### Added (Day 16)
- `scripts/lib/instincts.js` 에 `ready()` 추가
  - 자동 promote 후보 판정: confidence ≥ 1 + last_seen ≤ maxStaleDays + diversity ≥ minDiversity + !promoted
  - diversity = 고유 sessionId / 총 evidence
- CLI: `harness instincts ready [--max-stale-days N] [--min-diversity X] [--blocked]`
- 단위 테스트 4 추가 (총 instincts 15/15 PASS)

### Added (Day 17-18)
- `runtime/Cargo.toml` + `runtime/src/{main,session,supervisor,ipc,observability}.rs` (529 LOC)
  - tokio + serde + clap + rusqlite(bundled) + sysinfo + tracing
  - SQLite 스키마: sessions / handoffs / audits 3 테이블
  - supervisor: wakeup.json 폴링 → Node CLI ralph spawn, HUMAN_GATE 즉시 무시
  - ipc: stdio JSON-RPC 단일 요청 (ping / session.upsert / handoff.record / session.list)
- `runtime/README.md` — 빌드 / 사용 / Node 데몬과의 관계 (동시 실행 금지)
- 컴파일 검증은 다음 세션 (rustup 미설치)

### Added (Day 19-20)
- `docs/AUDIT.md` — Week 1~4 통합 검토
  - 18절 매핑 (15 OK, 5 부분, 0 미구현)
  - 8계층 매핑 (4 OK, 4 부분)
  - 빠진 항목: 빈 디렉터리 6, 미구현 스크립트 9, stub 메시지 2
  - 검증 안 된 컴포넌트 7 (live 호출 / 컴파일 / push)
  - P0~P2 우선순위 + 의도적 거절 5건

### Stats (Week 4)
- 8 파일 변경 (+1,300 LOC: instincts ready 100 + Rust 529 + AUDIT 200 + tests 200 + CLI/CHANGELOG 갱신)

### 누적 (Week 1+2+3+4)
- 5 커밋, ~100 파일, ~12,000 LOC
- 단위 테스트: 5+10+6+3+15+5+12 = **56/56 PASS**
- Rust runtime 골격 추가 (529 LOC, 컴파일 미검증)

## [0.0.1-week3] — 2026-04-29

> Week 3 완료. 인스팅트 + PoC 이식 시뮬 + live mode 경로 강화.

### Added (Day 11)
- `scripts/lib/instincts.js` — record / list / get / promote / prune
  - 신뢰도 점수: count / threshold (기본 3 → 1.0)
  - evidence 누적 (최대 20건)
  - prune: 미승격 + confidence<1 + olderDays 초과 시 제거
- orchestrator `review.js` 가 매 핸드오프 후 자동 `instincts.record`:
  - issue-pattern: severity/category/파일 prefix
  - fix-flow: stage→verdict@round
- CLI `harness instincts list / show <id> / promote <id> / prune [--older-days N] [--dry-run]`
- 단위 테스트 11/11 PASS

### Added (Day 12)
- `scripts/portability/simulate-port.js` — 사내 PoC 이식 dry-run
  - target 디렉터리 검사 (git / CLAUDE.md / AGENTS.md / .mcp.json / package files)
  - 추천 전략: create / init+submodule / submodule
  - plan 결과 vs 기존 파일 비교 → 충돌 severity 분류
  - 실 변경 없음 (--apply 옵션 미존재)
- 단위 테스트 5/5 PASS
- 실 시뮬: iljin-rag-poc (medium 충돌 2건), cad-api-bridge (충돌 0건)

### Added (Day 13)
- `claude.js` / `codex.js` 의 `extractJson`, `_buildSystem`, `_buildUserMessage`, `_buildPrompt` export
- 단위 테스트 `runners-extract.test.js` 12/12 PASS
  - JSON 펜스 / raw 추출
  - 중첩 / escape / 문자열 안 `}`
  - PRD / diff / priorHandoffs / Round 메시지 포함
  - 큰 diff (50K) 가 30K 에서 잘림

### 누적 (Week 1+2+3)
- 4 커밋 누적, ~92 파일, ~10,500 LOC
- 단위 테스트: severity(10) + router(6) + costs(3) + orchestrator(5) + instincts(11) + portability(5) + runners-extract(12) = **52/52 PASS**
- CLI: install / validate / review / plan / ralph / wait / sessions / costs / instincts / version
- MCP 도구: state_read / state_write / notepad_append / handoff_write / severity_classify / route_decide / cost_record (7개)

## [0.0.1-week2] — 2026-04-29

> Week 2 완료. 풀체인 동작 + GitHub Actions + 사내 이식 가이드.

### Added (Day 7)
- `scripts/lib/severity.js` — severity / category 휴리스틱 분류 + verdict 도출 + risk level
- `scripts/lib/router.js` — Stage Routing 표 코드화 + eco mode 다운그레이드 + alternatives
- `scripts/lib/costs.js` — 모델별 가격 합산, since 윈도우(`1h/30m/7d/all`)
- MCP 도구 3개 (`bridge/mcp-server.js`):
  - `severity_classify` — 이슈 자동 분류 + verdict
  - `route_decide` — 라우팅 결정 + alternatives, optional `trace`
  - `cost_record` — 호출 1건 비용 적립
- `harness costs --since=<window> [--rows] [--json]` CLI
- `dispatch.js` 가 매 호출마다 `routing.jsonl` 자동 적층
- `dispatch.js` 가 비표준 필드(예: `prdSeed`) 통과시키도록 수정

### Added (Day 8)
- `skills/ralph/SKILL.md` — 명시 옵트인 영속 루프 (자동 키워드 활성 OFF, 사용자 룰 우선)
- `scripts/orchestrators/ralph.js` — PRD AC 가 모두 PASS 까지 review 사이클 반복
  - cost cap (`HARNESS_DAILY_COST_CAP_USD`) / max-iter / HUMAN_GATE 자동 정지
  - prd.json 영속 (ralph sessionDir 단일 원본)
- `scripts/daemon/wait.js` — `harness wait start/stop/status`, wakeup.json 폴링

### Added (Day 9-10)
- `.github/workflows/harness-review.yml` — PR 자동 7단계 + 핸드오프 PR 코멘트 + 아티팩트 업로드
- `.github/workflows/harness-validate.yml` — push 시 매니페스트 + 24개 단위 테스트
- `docs/PORTING.md` — 사내 PoC (iljin-rag-poc / cad-api-bridge / solidedge-mcp) 30분 이식 가이드

### Tests
- `tests/unit/severity.test.js` — 10 케이스
- `tests/unit/router.test.js` — 6 케이스
- `tests/unit/costs.test.js` — 3 케이스
- 누적: `node --test tests/unit/*.test.js` 24/24 PASS

### Stats
- 17 파일 변경 (+1,231 LOC)

---

## [0.0.1-day6] — 2026-04-29

> Week 1+ Day 6: orchestrator + 4 provider runner + cli wiring.

### Added
- `scripts/agents/dispatch.js` — agent.md frontmatter 읽고 provider runner 위임
- `scripts/agents/runners/{mock,claude,codex,gemini}.js` — 4 provider runner
  - mock (default, dry-run): 결정론적 응답
  - claude: Anthropic SDK, ANTHROPIC_API_KEY 필요
  - codex: subprocess + JSON 파싱, sandbox=read-only/no-net 강제
  - gemini: subprocess
- `scripts/orchestrators/review.js` — 7단계 Stage Routing
  - sensitive path 자동 감지 (auth/crypto/payment/jwt 등) → 단계 6 자동 활성
  - round 한도 / critical → HUMAN_GATE
  - --fast / --secure / --no-ship 모두 동작
- `scripts/cli.js` — `review` / `plan` / `sessions` verb 추가
- `tests/unit/orchestrator.test.js` — 5 케이스 (auto-secure / fast skip / fix-loop / no-ship / disk persistence)

### Stats
- 9 파일 변경 (+959 / -39 LOC)

---

## [0.0.1-week1] — 2026-04-29

> Week 1 부트스트랩. 골격부터 데모까지 풀스택.

### Added (Day 1)
- 디렉터리 17개 골격 + git init
- 거버넌스 6: `SOUL.md` / `RULES.md` / `CLAUDE.md` / `AGENTS.md` / `WORKING-CONTEXT.md` / `REVIEW.md`
- `agent.yaml` (gitagent/0.1.0)
- `manifests/{install-profiles,install-modules,install-components}.json` (5 × 6 × 32)
- `schemas/*.schema.json` 10개 (요청 9 + routing 보너스)
- `install.sh` / `install.ps1` 트램폴린
- `scripts/install-plan.js` (dry-run, Ajv 2020-12 검증)
- `scripts/install-apply.js` stub
- `scripts/cli.js` 진입점
- `scripts/ci/{catalog,check-markers}.js`
- `package.json` (Node 22+, ajv / ajv-formats / yaml)

### Added (Day 2)
- `agents/<name>.md` 11개:
  - architect, planner, executor, code-reviewer, codex-reviewer, codex-challenger,
    security-reviewer, debugger, test-engineer, research, doc-writer
- `skills/<name>/SKILL.md` 5개:
  - claude-led-codex-review, plan-eng-review, tdd-workflow, review, ship
- `commands/claude-led-codex-review.md` (legacy compat)

### Added (Day 3)
- `hooks/hooks.json` + 5개 훅 stub:
  - `gateguard-fact-force.js`, `config-protection.js`, `pre-bash-dispatcher.js`,
    `quality-gate.js`, `persistent-mode.mjs`
- `scripts/build-claude.js` — 정규 카탈로그 → `.claude/` (22 components)
- `scripts/build-codex.js` — codex provider 만 → `.codex/agents/*.toml` + config.toml

### Added (Day 4)
- `bridge/mcp-server.js` — MCP SDK 1.29 단일 게이트웨이, 4 도구
  (state_read, state_write, notepad_append, handoff_write)
- `.mcp.json` — 단일 서버 등록
- `scripts/install-apply.js` 풀체인: plan → 빌드 → state 기록 → 마커 검증

### Added (Day 5)
- `gateguard-fact-force.js` 실 구현 — importer / public API / schema 정적 추출 + 답변 강제
- `quality-gate.js` 실 구현 — tsc / ruff / py_compile / node --check 다중 검증, 차단(exit 2)
- `scripts/demo-review.js` — 7단계 풀사이클 시뮬레이션

### Stats
- 65 파일 (+6,960 LOC)

---

## 핵심 동작 (Week 1+2 누적)

### 검증된 명령
```bash
harness install --plan --profile {core,developer,security,research,full}
harness install --apply --profile developer
harness validate
harness review "<task>" [--secure|--fast|--no-ship|--live] [--session <id>]
harness ralph "<task>" [--max-iter N]
harness costs [--since=7d|1h|30m|all] [--rows] [--json]
harness sessions
harness wait {start|stop|status}
harness version
```

### 검증된 동작
- 5 프로파일 plan dry-run PASS
- install --apply 풀체인 (claude+codex 빌드 + state + 마커)
- MCP smoke 7도구 PASS
- gateguard 사실 노트 차단/통과
- quality-gate `tsc TS1109` 자동 차단
- review 7단계 + sensitive 자동 활성 + fix loop + HUMAN_GATE
- ralph iter 3 → AC 3/3 PASS → all_passed
- 단위 테스트 24/24 PASS

### 의존성
- Node 22+ (테스트는 24.14.0)
- npm packages: ajv, ajv-formats, yaml, @modelcontextprotocol/sdk, vitest, typescript, @types/node
- 옵션: ANTHROPIC_API_KEY (--live), codex CLI (Codex provider live), gemini CLI (Gemini provider live)
