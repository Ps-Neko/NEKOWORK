# CHANGELOG

> 형식: Keep a Changelog · 버전: SemVer · 한국어 표기.

## [Unreleased]

### Changed (Provider CLI path hardening, 2026-05-03)
- `scripts/core/cli-resolver.js` — add provider-aware CLI resolution that rejects workspace-local `claude` / `codex` / `gemini` shims by default, with explicit `HARNESS_<PROVIDER>_ALLOW_WORKSPACE_BIN=1` opt-in.
- `scripts/agents/runners/{claude,codex,gemini}.js` — resolve provider binaries through the trusted provider CLI resolver.
- `tests/unit/core-utils.test.js`, `docs/SETUP.md`, `docs/ARCHITECTURE.md` — cover and document provider CLI path trust policy.

### Changed (CLI contract hardening, 2026-05-03)
- `scripts/cli.js` — unknown review flags now fail fast; `--no-codex` is parsed explicitly; `--fast` with `--secure` is rejected as a conflicting request.
- `scripts/orchestrators/review.js` — add `stopAfter` support so `harness plan` stops after ideate/plan and never enters implement; add `--no-codex` handling for stage 5/6 skip.
- `schemas/handoff.schema.json`, `scripts/agents/dispatch.js` — align persisted handoff metadata (`provider`, `model`, `duration_ms`, whitelisted orchestration metadata) with the schema and avoid arbitrary runner passthrough.
- `hooks/scripts/config-protection.js`, `hooks/hooks.json`, `agent.yaml` — split config-protection onto its own `HARNESS_HOOK_CONFIG_PROTECTION` toggle.
- `.github/workflows/harness-validate.yml` — CI now runs full `npm test`, `npm audit --audit-level=moderate`, all harness builders, and codemap freshness check.

### Added (Local-first runner/auth port, 2026-05-02)
- `scripts/core/auth-guard.js` — Claude/Codex/Gemini CLI 호출 직전 long-lived API key 환경변수 차단. `HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1` 명시 옵트아웃.
- `scripts/core/{cli-resolver,json-extractor,subprocess}.js` — provider runner 공통 CLI 탐색, JSON 추출, subprocess 수집 유틸.
- `scripts/core/git-mutation-guard.js` — read-only / handoff-mode runner 실행 전후 git 상태 비교로 workspace mutation 감지.
- `scripts/verify/claude-live.js` + `npm run verify:claude` — Claude Code CLI 구독/OAuth 세션 smoke.
- `scripts/verify/gemini-live.js` + `npm run verify:gemini` — Gemini CLI local auth smoke.
- `runtime/Cargo.lock` — Rust binary runtime dependency lockfile committed after successful build verification.
- `tests/unit/auth-guard.test.js`, `tests/unit/core-utils.test.js`, `tests/unit/git-mutation-guard.test.js` — delegated CLI auth guard, core runner utility, workspace mutation guard 단위 테스트.
- `@anthropic-ai/sdk` optional dependency — `HARNESS_CLAUDE_RUNNER=sdk` 명시 opt-in 경로 지원.

### Changed (Local-first runner/auth port)
- `scripts/agents/runners/claude.js` — 기본 live runner 를 Anthropic SDK/API-key 에서 Claude Code CLI(`claude -p`) 위임으로 전환. SDK 경로는 `HARNESS_CLAUDE_RUNNER=sdk` 명시 시에만 사용.
- `scripts/agents/runners/claude.js` — CLI 실행을 non-interactive handoff mode 로 명시하고 `--permission-mode plan` + git mutation guard 를 적용. 의도한 쓰기 실험은 `HARNESS_CLAUDE_ALLOW_WORKSPACE_MUTATION=1`.
- `scripts/agents/runners/codex.js`, `scripts/agents/runners/gemini.js` — 공통 auth guard 적용.
- `scripts/agents/runners/codex.js` — `codex exec --sandbox read-only` 를 `harnessRoot` cwd 에서 실행하고, 전후 git mutation guard 로 sandbox 우회를 감지.
- `scripts/agents/runners/gemini.js` — prompt body 포함, non-interactive handoff mode 명시, git mutation guard 적용.
- `scripts/agents/runners/{claude,codex,gemini}.js` — 중복 `which` / subprocess / JSON 추출 로직을 `scripts/core/` 로 이동.
- `scripts/core/subprocess.js` — Windows timeout 시 `.cmd` shim 하위 프로세스까지 `taskkill /t` 로 정리.
- `package.json` — unused `vitest` devDependency 제거. Repo 기본 테스트 러너를 `node:test` 로 문서화하고 npm audit 0 vulnerabilities 로 정리.
- `runtime/Cargo.toml` — add missing `ctrlc` dependency and enable `clap/env` feature.
- `runtime/src/ipc.rs` — ignore leading UTF BOM in PowerShell pipeline input.
- `runtime/README.md` — replace skeleton note with Windows build and smoke instructions.
- `scripts/orchestrators/review.js` — live provider 실패 시 기본 mock fallback 제거. fallback 은 `HARNESS_LIVE_ALLOW_MOCK_FALLBACK=1` 명시 opt-in 으로만 허용.
- `scripts/cli.js`, `docs/SETUP.md`, `docs/RUNBOOK.md`, `docs/PORTING.md` — `--live` 설명을 local CLI auth first 로 갱신.
- `scripts/agents/runners/codex.js` — PascalCase live 응답과 `Risks` 배열을 handoff schema 로 정규화.

### Added (Auth migration, 2026-04-30 머지)
- `agent.yaml#auth` — 3계층 인증 모델 (`delegated_cli_auth` / `oauth_device` / `api_key_vault`) + 정책 (`block_subscription_override`, `redact_tokens_in_audit`, `deny_static_api_keys_in_repo`).
- `schemas/agent-yaml.schema.json` — `auth` 섹션 스키마 검증.
- `hooks/scripts/pre-bash-dispatcher.js` — `block_subscription_override` 가드: claude/codex/gemini CLI 호출 직전 `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`GEMINI_API_KEY`/`GOOGLE_API_KEY` 차단. `HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1` 옵트아웃.
- `scripts/auth/github-{login,status,logout}.js` — GitHub OAuth Device Flow (scopes: `repo`, `workflow`).
- `scripts/lib/token-vault.js` — `encrypted-file` vault + audit redaction (정규식 후필터).
- `scripts/lib/keychain.js` — `@napi-rs/keyring` wrapper (Windows Credential Manager / macOS Keychain / Linux Secret Service 통일 API).
- `tests/unit/token-vault.test.js`, `tests/optional/keychain-smoke.test.js` (`HARNESS_KEYCHAIN_SMOKE=1` 게이트).
- `docs/AUTH-MIGRATION.md` — 정책 / 단계별 마이그레이션 / 사용자 가이드 / 보안 노트 / smoke checklist (§8).

### Changed (Auth migration)
- `.env.example` — LLM API key 슬롯 제거, `HARNESS_GITHUB_CLIENT_ID` 신설, `GITHUB_TOKEN` 은 fallback 격하, Context7/Exa 는 vault 권장 안내.
- `docs/RUNBOOK.md` — §0/§4/§10 인증 안내를 OAuth 위임 기반으로 갱신.
- `docs/ARCHITECTURE.md` — auth 섹션 정합.

### Smoke (acceptance criteria, 2026-04-30)
- ✅ #1 `claude /status` — Login: **Claude Max account**, API Key 미사용.
- ✅ #2 `pre-bash-dispatcher` 차단 — 3 케이스 (차단 exit 2 / 통과 exit 0 / 옵트아웃 exit 0).
- ⏸ #3 GitHub OAuth Device Flow — OAuth App 미등록, 실제 GitHub automation 사용 시점에 수행 결정.
- ✅ #4 OS keychain (Windows Credential Manager) — set/get/remove 사이클 9.4ms.

### 머지 흔적
- main: `60e9de9` → `7c4f2c8` (+4 commits, rebase merge).
- PR #1 (`phase-1-auth-migration`): `06fbe8f` + `8f943af` (smoke checklist).
- PR #2 (`phase-2-env-cleanup`): `0feaa59` — force-push 1회 (`--onto origin/main b2b1bce` + `--force-with-lease`).
- PR #3 (`phase-3-keychain`): `7c4f2c8` — force-push 1회 (`--onto origin/main bf72841` + `--force-with-lease`).
- PR #4 (`phase-4-codex-compat`) 는 본 작업과 무관 OPEN 잔존.

### 다음 후보 (`docs/AUDIT.md §5` + `docs/dev-log/2026-04-29-p1-recovery.md §6` 참조)
- **P0** (사용자 동의): Claude CLI live smoke, ~~GitHub push + Actions 실 동작~~ (auth migration 머지로 수행됨), 사내 PoC 결합
- **P2** (외부 의존): Gemini CLI 설치 후 live 검증, npm publish 결정, origin/main 통합 PR
- **P3** (사내 임팩트, 사용자 명시 시): 사내 풀 결합, `runners/internal.js` 사내 LLM, 사내 GitLab CI 가이드
- **Auth**: smoke #3 (GitHub OAuth Device Flow) — OAuth App 등록 후 `HARNESS_GITHUB_CLIENT_ID` 설정 → `npm run auth:github:login` 실연.

## [0.0.2] — 2026-04-29

> P1 회수 + 일부 P2. AUDIT 의 자체 완결 가능 영역 100% 정합 + 빈 디렉터리 0 + 미구현 스크립트 0.

### Added
- `scripts/sync-claude-md.js` — `<!-- HARNESS:START version=X -->`/`<!-- HARNESS:END -->` 사이를 카탈로그/매니페스트로 자동 갱신. `--check` / `--dry-run` / `--verbose` 모드.
- `scripts/repair.js` — `install-state.json` 의 `targets[].sha256` 비교, 누락/변조 하네스만 재빌드. `--check` / `--harness <name>` / `--force` 모드.
- `scripts/build-cursor.js` — `.cursor/rules/{agents,skills}/*.mdc` (alwaysApply, globs) + `.cursorrules` + camelCase 이벤트 (`beforeTool`/`afterTool`/...) `hooks.json`.
- `scripts/build-gemini.js` — Progressive Disclosure 형: `GEMINI.md` (요약 + 스킬 description 만) + `settings.json` (provider_filter=gemini).
- `scripts/build-opencode.js` — 단일 `config.json` 으로 agents/skills/hooks/MCP 모두 통합.
- `scripts/build-codemaps.js` — 9 영역 (`scripts`/`agents`/`skills`/`hooks`/`manifests`/`schemas`/`bridge`/`rules`/`tests`) 자동 codemap 산출 + `docs/CODEMAPS/README.md` 인덱스.
- `scripts/ci/validate-{agents,skills,hooks,manifests}.js` — 4 validator: ajv + frontmatter 검증 + 카탈로그 정합 + 그래프 무결성. `package.json` `validate:*` 스크립트 실 매핑.
- `rules/common/{coding-style,testing,security}.md` (3) — 언어 무관 공통 룰.
- `rules/typescript/{coding-style,testing,security}.md` (3) — TS/JS 확장.
- `rules/python/{coding-style,testing}.md` (2) — Python 확장.
- `tests/integration/build-pipeline.test.js` — 격리 sandbox 풀체인 검증 10 케이스.
- `tests/e2e/review-cycle.test.js` — `demo-review` 7단계 시뮬 + CLI 검증 7 케이스.
- `docs/ARCHITECTURE.md` — stub 50 줄 → 풀 18절 본문 528 줄. ASCII 다이어그램, 8계층 매트릭스, Codex Loop 상태 머신, 12-item Security Bar, 예시 디렉터리/설정/명령어, 부록 5대원칙·풀사이클 플래그.
- `docs/dev-log/2026-04-29-p1-recovery.md` — 본 세션 사후 기록 (의사결정·마찰·산출 목록).

### Changed
- `scripts/install-apply.js`:
  - `agent.yaml.harnesses[].name` 전부를 빌드 (이전엔 `['claude', 'codex']` 하드코딩).
  - `source_sha256` 을 placeholder `0`*64 → 카탈로그 입력 (`agent.yaml + agents/ + skills/ + commands/ + hooks/ + manifests/`) 의 실 sha256.
  - `targets[].sha256` 추가 — 출력 디렉터리의 실 sha256.
- `package.json` — `lint` / `test` 가 실 명령 매핑 (`catalog + validate:all` / 73 테스트). `test:unit` / `test:integration` / `test:e2e` 분리. `build:codemaps` 추가.
- `scripts/ci/catalog.js` — 경고 메시지의 "(Day 2 에 작성 예정)" 등 stub 흔적 제거.
- `scripts/cli.js`, `bridge/mcp-server.js`, `hooks/scripts/pre-bash-dispatcher.js`, `scripts/daemon/wait.js`, `scripts/orchestrators/ralph.js` — "Day N" 코멘트 흔적 정리.
- `CLAUDE.md` / `.claude/CLAUDE.md` — 자동 영역 마커 정합 + 카탈로그 컨텐츠 갱신.
- `docs/AUDIT.md` — P1 회수 결과 반영 (§1·2·3·5·7·8). 73 테스트 / 0 빈 디렉터리 / 0 미구현 스크립트 명시.

### Stats
- 신규 22 파일, 수정 12 파일 (+ 약 2,500 LOC).
- 단위 테스트: 56 (변동 없음).
- 통합 테스트: 0 → 10.
- E2E 테스트: 0 → 7.
- **전체 테스트: 56/56 → 73/73 PASS**.

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
- 컴파일 검증은 2026-05-02 완료 (`cargo build --release`, help/init/status/ipc ping).

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
- Rust runtime 골격 추가 (529 LOC, 2026-05-02 컴파일 검증 완료)

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
- 실 시뮬: 익명 디렉터리 dry-run (충돌 패턴 0/2건 케이스 검증)

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
- `docs/PORTING.md` — 사내 PoC 30분 이식 가이드 (일반 절차)

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
  - claude: 기본은 Claude Code CLI 세션, SDK/API-key 는 HARNESS_CLAUDE_RUNNER=sdk opt-in
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
- npm packages: ajv, ajv-formats, yaml, @modelcontextprotocol/sdk, typescript, @types/node, optional @anthropic-ai/sdk
- 옵션: Claude/Codex/Gemini CLI 세션 (`--live`), HARNESS_CLAUDE_RUNNER=sdk + ANTHROPIC_API_KEY (CI/API-key opt-in)
