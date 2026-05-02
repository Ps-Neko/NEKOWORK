# HARNESS — 통합 아키텍처

> 18절 사양 풀 본문. AUDIT 매핑(`docs/AUDIT.md` §1) 기준 정합.
> 원천 분석: ECC (`affaan-m/everything-claude-code` v2.0.0-rc.1), OMC (`Yeachan-Heo/oh-my-claudecode` v4.13.5), CLCR (`~/.claude/commands/claude-led-codex-review.md`).

## 1. Executive Summary

HARNESS 는 **하나의 매니페스트(`agent.yaml`)** 와 **5개 정규 카탈로그**(`agents/`, `skills/`, `commands/`, `hooks/`, `rules/`) 를 진실 원본으로 두고, **5개 하네스**(Claude Code / Codex CLI / Cursor / Gemini CLI / opencode) 로 동시 투영하는 AI 개발 에이전트 런타임이다. Claude 가 코드를 쓰고 Codex 가 독립 검증하며 사람이 critical 또는 round ≥ 3 에서 마지막을 잡는다.

핵심 가치:

- **이식성**: Claude Code 가 사라져도 동일 카탈로그가 다른 하네스에서 동작.
- **검증 강제**: critical 발견 시 자동 fix → 재검증 → human gate 의 4단 게이트.
- **사실 조사 강제**: Edit/Write 직전 importer/API/schema 사실 조사 (`gateguard-fact-force`).
- **Progressive Disclosure**: 스킬은 description 만 노출, 본문은 lazy-load.

## 2. 레퍼런스 역설계 요약

| 출처 | 차용 | 의도적 거절 |
|---|---|---|
| ECC v2.0.0-rc.1 | progressive disclosure, skill / agent / rule 계층, 정규 카탈로그 → 산출물 분리, schema 검증 매니페스트 | 184개 스킬 풀 카탈로그 (점진 확장으로 대체), `pyproject.toml` LLM monorepo (별도 레포 분리), gan-{planner,generator,evaluator} (YAGNI) |
| OMC v4.13.5 | 핸드오프 5필드, persistent mode, fact-forcing, instinct 학습 | 매직 키워드 자동 활성 (`$ralph` 등 — 사용자 룰 "확인 후 실행" 우선), tmux team 런타임 (Windows 마찰 — ralph 단일 워커가 대체), `bridge/cli.cjs` 3.2MB 단일 번들 (디버깅 / 모듈성) |
| CLCR (사용자 본인 자산) | 7단계 풀사이클(ideate→plan→implement→self-review→codex-review→codex-challenge→ship), severity matrix, fix-loop round ≤ 3, --secure / --fast / --no-ship 플래그 | — |

## 3. 통합 아키텍처 개요

```
┌────────────────────────────────────────────────────────────────────────┐
│  Interface Layer                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │ slash /  │  │ harness  │  │  GitHub  │  │  IDE (Cursor/VSCode) │   │
│  │ command  │  │   CLI    │  │ Actions  │  │  + Copilot CLI       │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘   │
└───────┼─────────────┼─────────────┼───────────────────┼───────────────┘
        │             │             │                   │
┌───────▼─────────────▼─────────────▼───────────────────▼───────────────┐
│  Orchestration                                                         │
│   ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────────┐    │
│   │ planner  │ │  router  │ │ persistent   │ │ cost optimizer   │    │
│   │ (PRD/AC) │ │ (3-tier) │ │   mode       │ │ (haiku/sonnet/   │    │
│   │          │ │          │ │              │ │  opus)           │    │
│   └────┬─────┘ └────┬─────┘ └──────┬───────┘ └─────────┬────────┘    │
└────────┼────────────┼──────────────┼───────────────────┼─────────────┘
         │            │              │                   │
┌────────▼────────────▼──────────────▼───────────────────▼─────────────┐
│  Agent Catalog (11)                                                  │
│  Claude:   architect / planner / executor / code-reviewer            │
│            security-reviewer / debugger / test-engineer / doc-writer │
│  Codex:    codex-reviewer / codex-challenger                         │
│  Gemini:   research                                                  │
└────────┬────────────┬──────────────┬───────────────────┬─────────────┘
         │            │              │                   │
┌────────▼────────────▼──────────────▼───────────────────▼─────────────┐
│  Skill (5) + Hook (5) + Rule (common/ts/py)                          │
│  claude-led-codex-review · plan-eng-review · tdd-workflow · review · │
│  ship · ralph         hooks: gateguard-fact-force · quality-gate ·   │
│                              pre-bash-dispatcher · persistent-mode · │
│                              config-protection                       │
└────────┬────────────┬──────────────┬───────────────────┬─────────────┘
         │            │              │                   │
┌────────▼────────────▼──────────────▼───────────────────▼─────────────┐
│  Memory & Learning                                                   │
│  session: .harness/state/sessions/<id>/{prd.json, handoffs/, ...}    │
│  project: .harness/project-memory.json + WORKING-CONTEXT.md          │
│  global : ~/.harness/instincts/ + ~/.harness/costs.jsonl             │
└────────┬────────────┬──────────────┬───────────────────┬─────────────┘
         │            │              │                   │
┌────────▼────────────▼──────────────▼───────────────────▼─────────────┐
│  Verification (4-gate)                                               │
│  quality-gate → self-review → codex-review → [codex-challenge] →     │
│      [fix-loop round ≤ 3] → human gate (critical / round 3 / blast20)│
└────────┬────────────┬──────────────┬───────────────────┬─────────────┘
         │            │              │                   │
┌────────▼────────────▼──────────────▼───────────────────▼─────────────┐
│  Security & Governance                                               │
│  sandbox profile · MCP SemVer 핀 · audit jsonl · secret redaction ·  │
│  config-protection · severity matrix                                 │
└────────┬────────────┬──────────────┬───────────────────┬─────────────┘
         │            │              │                   │
┌────────▼────────────▼──────────────▼───────────────────▼─────────────┐
│  Integration (build adapters)                                        │
│  agent.yaml + agents/ + skills/ + hooks/ + rules/                    │
│   ↓ scripts/build-claude.js   → .claude/                             │
│   ↓ scripts/build-codex.js    → .codex/                              │
│   ↓ scripts/build-cursor.js   → .cursor/                             │
│   ↓ scripts/build-gemini.js   → .gemini/                             │
│   ↓ scripts/build-opencode.js → .opencode/                           │
│  + bridge/mcp-server.js (MCP 단일 게이트웨이)                       │
└──────────────────────────────────────────────────────────────────────┘
```

## 4. 계층별 컴포넌트 설계 (8 계층)

| 계층 | Day 1 부트스트랩 | 현 상태 (`docs/AUDIT.md` §2) |
|---|---|---|
| 1 Interface | NL Router(off, 사용자 룰 우선), Slash Command, CLI(`scripts/cli.js`), GitHub Actions | 부분 — NL Router 의도적 OFF |
| 2 Orchestration | planner / router / persistent / cost. team mgr 는 ralph 단일 워커 | 부분 — tmux team 미채택 |
| 3 Agent | 11/11 (Claude 8, Codex 2, Gemini 1) | OK |
| 4 Skill & Rule | 5 스킬 + ralph + 거버넌스 4 + rule 공통/TS/Python | OK (rules 작성 완료) |
| 5 Memory & Learning | session(7개 핸드오프 파일) + project-memory + 글로벌 instincts | OK |
| 6 Verification | quality-gate → self-review → codex-review → codex-challenge → fix-loop → human gate | OK |
| 7 Security & Governance | gateguard-fact-force, config-protection, audit jsonl, MCP 핀, sandbox profile | 부분 — OIDC / dead-man / supply chain 미구현 |
| 8 Integration | claude / codex / cursor / gemini / opencode 빌더 + MCP 단일 게이트웨이 | OK (5개 빌더 모두 구현) |

## 5. 데이터 / 컨텍스트 흐름

`harness review "<task>"` 풀체인:

1. **PRD 생성** (`scripts/orchestrators/review.js`): 사용자 task → planner agent → `.harness/state/sessions/<id>/prd.json` (acceptance criteria 포함).
2. **계획**: `00-plan.md` 핸드오프 작성 (5필드: Decided / Rejected / Risks / Files / Remaining).
3. **구현**: executor agent. 매 Edit/Write 직전 `gateguard-fact-force` hook 이 importer/API/schema 사실 조사 강제.
4. **자체 리뷰**: code-reviewer agent (Claude Opus, read-only) → `01-self-review.md`.
5. **Codex 리뷰**: codex-reviewer agent (gpt-5-codex, read-only, no-net) → `02-codex-review.md`. Claude / Codex 컨텍스트 미공유 — 핸드오프 마크다운으로만 통신.
6. **(선택) Codex 챌린지**: `--secure` 일 때만. codex-challenger 가 의도적으로 부수려 듦 → `03-codex-challenge.md`.
7. **Fix-loop**: severity ≥ HIGH 발견 시 executor 재실행, round ≤ 3.
8. **Human gate**: severity = critical OR round ≥ 3 OR blast_radius ≥ 20 파일이면 사람 승인 대기.
9. **Ship**: `04-ship.md` + 커밋 / PR.

흐름 추적 자료:

- `.harness/state/sessions/<id>/routing.jsonl` — 단계별 agent / model / cost.
- `.harness/costs.jsonl` — 누적 비용.
- `.harness/audit/<date>.jsonl` — 모든 도구 호출.

## 6. Agent 라우팅 전략

3 단계 라우팅 (`scripts/lib/router.js`):

### Tier 1: Provider 선택

| 작업 | Provider |
|---|---|
| 코드 작성 / 수정 | claude |
| 독립 코드 리뷰 | codex |
| 광범위 리서치 / 멀티모달 | gemini |
| 로컬 / 사내 LLM (옵션) | local (사내 endpoint) |

### Tier 2: Model Tier (cost optimizer)

| 시나리오 | Tier | 근거 |
|---|---|---|
| 아키텍처 / 깊은 추론 | opus | 최고 추론, 고비용 — `eco_mode_floor: sonnet` 무시 가능 |
| 일반 구현 / 리뷰 | sonnet | 베스트 코드 모델, 기본값 |
| 페어링 / 빈번 호출 | haiku | 90% 능력, 1/3 비용 |

`eco_mode_floor: sonnet` 설정은 비용 폭주 방지 — 일반 작업에 opus 자동 선정 차단.

### Tier 3: Stage Routing

| 단계 | 필수 에이전트 | 옵션 |
|---|---|---|
| ideate | (사람) | research |
| plan | planner / architect | — |
| implement | executor | debugger |
| self-review | code-reviewer | security-reviewer |
| codex-review | codex-reviewer | — |
| codex-challenge | codex-challenger | — |
| ship | doc-writer | — |

`severity ≥ critical` / `round ≥ 3` / `blast_radius ≥ 20 파일` 의 트리거 중 하나라도 만족하면 human gate.

## 7. Skill / Hook / Rule 구조

### Skill (`skills/<name>/SKILL.md`)

- Frontmatter: `name, description, origin, level` (`schemas/skill.schema.json`).
- Progressive disclosure — Gemini / opencode 빌더는 description 만 노출.
- 5 정식 + 1 부속 (ralph): `claude-led-codex-review`, `plan-eng-review`, `tdd-workflow`, `review`, `ship`, `ralph`.

### Hook (`hooks/hooks.json` + `hooks/scripts/`)

5 활성:

| 훅 | 이벤트 | 역할 |
|---|---|---|
| `pre-bash-dispatcher` | PreToolUse(Bash) | block-no-verify, dev-server-block, commit-quality, push-reminder |
| `gateguard-fact-force` | PreToolUse(Edit\|Write) | importer/API/schema 사실 조사 강제 |
| `config-protection` | PreToolUse(Edit\|Write) | secret / lockfile 보호 |
| `quality-gate` | PostToolUse | 포맷·린트·타입 체크 |
| `persistent-mode` | Stop | 핸드오프 강제 — 5필드 마크다운 작성 안 했으면 차단 |

ENV 토글: `HARNESS_HOOK_<NAME>=1` 로 개별 활성/비활성.

### Rule (`rules/{common,typescript,python}/`)

언어 무관 공통 룰 + 언어별 확장. 공통 / 언어 충돌 시 언어가 우선 (CSS specificity 와 동일).

| 파일 | 내용 |
|---|---|
| `common/coding-style.md` | 불변성, 파일/함수 크기, 네이밍, 에러, 입력 검증 |
| `common/testing.md` | 80% 커버리지, TDD, 격리, 결정성 |
| `common/security.md` | 시크릿, 입력 검증, MCP 핀, 사고 대응 |
| `typescript/coding-style.md` | 타입, async, immutability, console.log 금지 |
| `typescript/testing.md` | vitest / node:test, Playwright |
| `typescript/security.md` | zod, parameterized SQL, JWT, CSRF |
| `python/coding-style.md` | PEP 8, 타입 힌트, dataclass / pydantic |
| `python/testing.md` | pytest, parametrize, asyncio, 80% 커버리지 |

## 8. Codex Review Loop (단계 5 상세)

```
[implement 완료]
        │
        ▼
┌──────────────────────────┐
│ self-review (Claude)     │   read-only, 자체 코드 검증
└──────────┬───────────────┘
           │ severity 분류 (CRITICAL/HIGH/MEDIUM/LOW)
           ▼
┌──────────────────────────┐
│ codex-review (Codex)     │   read-only, no-net, 컨텍스트 미공유
│   → handoff 마크다운만   │
└──────────┬───────────────┘
           │
           ▼
        [severity 결정]
           │
   ┌───────┼─────────┐
   │       │         │
LOW     MEDIUM    HIGH/CRITICAL
   │       │         │
   ▼       ▼         ▼
[ship]  [warn]   [fix-loop]
                     │
                     ▼ round++
              ┌──────────────┐
              │ executor     │  자동 fix
              │ + re-review  │
              └──┬───────────┘
                 │
        round ≤ 3?  ──no→ [human gate]
                 │
                yes
                 │
                 ▼
            [재평가]
```

Severity matrix (`scripts/lib/severity.js`):

| 레벨 | 예 |
|---|---|
| CRITICAL | secret leak, SQL injection, race condition, data loss 가능 |
| HIGH | API breaking change, auth 우회, N+1 쿼리 |
| MEDIUM | 타입 부재, 미사용 import, 부분 covered |
| LOW | 코멘트, 네이밍, 포맷 |

`--fast` 시 codex-challenge 스킵. `--secure` 시 codex-challenge 강제. `--no-ship` 시 ship 단계만 생략(나머지는 그대로).

## 9. Memory & Learning (3-tier)

| Tier | 위치 | 내용 | 수명 |
|---|---|---|---|
| Session | `.harness/state/sessions/<id>/` | `prd.json`, `progress.txt`, `notepad.md`, `handoffs/<NN>-<stage>.md`, `routing.jsonl` | 세션 한정, archive 유지 |
| Project | `.harness/project-memory.json` + `WORKING-CONTEXT.md` | 프로젝트 결정 / 부채 / 컨벤션 / 핫스팟 | 영속, 사람이 큐레이트 |
| Global | `~/.harness/instincts/` + `~/.harness/costs.jsonl` | 사용자 본능(record/list/promote/prune/ready), 비용 누적 | 사용자별 영속 |

핸드오프 5필드(고정): **Decided / Rejected / Risks / Files / Remaining**. 10~20줄 한도. `persistent-mode` 훅이 강제.

본능 라이프사이클: `record` → `list` → 검토 → `promote`(승급) 또는 `prune`(폐기) → `ready` (다음 세션에서 활성).

## 10. Security & Governance (12-item Bar)

| # | 항목 | 구현 |
|---|---|---|
| 1 | 시크릿 redaction | `secret_redaction: true` (audit jsonl 작성 직전 마스킹) |
| 2 | 시크릿 파일 보호 | `config-protection` 훅이 .env, .pem 류 Edit 차단 |
| 3 | MCP allowlist + SemVer 핀 | `mcp.external_servers[*].pin` 강제, `mcp_pin_required: true` |
| 4 | 외향 네트워크 기본 차단 | `outbound_network_default: deny`, opt-in |
| 5 | sandbox 프로파일 | agent frontmatter `sandbox: read-only / workspace-write / danger` |
| 6 | 사실 조사 강제 | `fact_forcing_default: true`, gateguard 훅 |
| 7 | audit log | `.harness/audit/<date>.jsonl` 모든 도구 호출 |
| 8 | severity matrix + human gate | round 3 / critical / blast 20 파일 트리거 |
| 9 | 승인 필요 작업 | `unsandboxed_shell, egress, deploy, off_repo_write` |
| 10 | OIDC / 키리스 | **미구현** — P3 |
| 11 | dead-man switch | **미구현** — P3 |
| 12 | 의존성 스캔 | npm/pip/cargo audit 가이드. CI 자동화 미통합 — P2 |

## 11. 설치 / 배포 구조

3 layered manifest:

```
profiles (5)  →  modules (6)  →  components (32)
```

| Profile | 포함 모듈 | 기본값 |
|---|---|---|
| core | rules-core, agents-core, hooks-runtime, platform-configs | 최소 운용 |
| developer (default) | core + workflow-quality, codex-loop | 풀 리뷰 사이클 |
| security | core + security 강화 (security-reviewer, --secure 강제) | 인증 / 결제 코드 |
| research | core + research agent + Gemini provider | 리서치 / 분석 |
| full | 전 모듈 | 모두 |

설치 흐름:

```
install.sh --plan       → install-plan.js     (검증 + 표 출력, dry-run)
install.sh --apply      → install-apply.js    (plan + 빌더 실행 + state 기록)
node scripts/repair.js  → install state 비교, 변경분만 재빌드
node scripts/sync-claude-md.js  → CLAUDE.md 마커 영역 갱신
```

## 12. MVP 범위

설계 MVP 5 조건 (`docs/AUDIT.md` §4):

1. ✓ `harness review --pr <n>` 자동 단계 1~5 + Codex 결과 PR 코멘트 (GitHub Actions 구현)
2. ✓ `gateguard-fact-force` 활성, Edit 전 사실 조사 강제
3. ✓ critical 자동 fix → re-review 1회 루프
4. ✓ `.harness/state/sessions/<id>/` 영속, 핸드오프 7개 파일
5. ✓ 80% 커버리지 게이트 (단위 테스트 56/56 PASS)

**MVP 100% 충족.** PR 코멘트는 Actions 가 mock 동작 — 실 push 후 검증은 P0.

## 13. 확장 로드맵

| 시점 | 항목 | 비고 |
|---|---|---|
| P0 (사용자 동의) | Claude CLI live smoke, GitHub push, 사내 PoC 비파괴 결합 | 로컬 CLI 로그인 / 네트워크 필요 |
| P1 (1~2시간) | sync-claude-md, repair, build-cursor/gemini/opencode, validate-* 4개, rules 채우기 | 본 세션에서 모두 완료 |
| P2 (2~4시간) | integration / e2e 테스트, ARCHITECTURE 풀 본문, Rust runtime 컴파일, codemap 자동 생성 | 본 세션 후반 |
| P3 (사용자 명시 시) | 사내 풀 결합, 추가 사내 프로젝트, 사내 LLM provider | 외부 임팩트 |
| P4 (의도적 거절) | 매직 키워드 자동 활성, 184 풀 카탈로그, tmux team | 사용자 룰 / progressive 원칙 충돌 |

## 14. 리스크 / 대응책

| 리스크 | 대응 |
|---|---|
| Git CRLF warning | `.gitattributes` 로 LF 강제 |
| Node 22+ glob 미지원 | 테스트 호출 시 `tests/unit/*.test.js` 명시 또는 vitest 도입 |
| Windows tsc PATH 미인식 | 임시 .ts 는 프로젝트 안에 두고 cwd 기준으로 탐색 |
| `/tmp` 가 Windows 매핑 안 됨 | `os.tmpdir()` / `tests/_tmp/` 사용 |
| Codex / Claude 컨텍스트 의도치 않은 공유 | 핸드오프 마크다운만 허용, 직접 메시지 전달 차단 |
| 매니페스트 vs 실 카탈로그 불일치 | `validate:all` + `repair --check` CI 게이트 |
| install 부분 실패 시 반쪽 상태 | `install-apply` 가 멱등. `repair` 가 sha256 비교로 재정합 |
| 시크릿 의도치 않은 커밋 | `config-protection` 훅 + `secret_redaction` audit |
| MCP 서버 supply chain | SemVer 핀 강제. 새 서버 추가 시 security-reviewer 검토 |

## 15. 예시 디렉터리 구조

```
harness/
├── agent.yaml                 ← 매니페스트 (단일 진실 원본)
├── package.json               ← @harness/cli (private)
├── VERSION
├── SOUL.md  RULES.md  CLAUDE.md  AGENTS.md  WORKING-CONTEXT.md  REVIEW.md
│   └─ (거버넌스 4 + 작업 컨텍스트 + 리뷰 로그)
├── agents/<name>.md            ← 11개. frontmatter + 본문
├── skills/<name>/SKILL.md      ← 5+1. progressive disclosure
├── commands/<name>.md          ← 1 (legacy compat)
├── hooks/
│   ├── hooks.json              ← 단일 정의
│   └── scripts/                ← 5개 훅 스크립트
├── rules/
│   ├── common/                 ← coding-style / testing / security
│   ├── typescript/             ← TS/JS 확장
│   └── python/                 ← Python 확장
├── manifests/
│   ├── install-profiles.json   ← 5 profile
│   ├── install-modules.json    ← 6 module
│   └── install-components.json ← 32 component
├── schemas/                    ← 10 JSON schema
├── scripts/
│   ├── cli.js                  ← harness CLI (10 verb)
│   ├── install-plan.js / install-apply.js
│   ├── repair.js               ← 변경분만 재빌드
│   ├── sync-claude-md.js       ← 마커 영역 갱신
│   ├── build-{claude,codex,cursor,gemini,opencode}.js
│   ├── ci/
│   │   ├── validate-{agents,skills,hooks,manifests}.js
│   │   ├── catalog.js
│   │   └── check-markers.js
│   └── lib/                    ← router, severity, costs, runners
├── bridge/
│   └── mcp-server.js          ← MCP 단일 게이트웨이
├── runtime/                    ← Rust 골격 (별도 컴파일)
├── docs/
│   ├── ARCHITECTURE.md         ← 본 문서
│   ├── AUDIT.md                ← 18절 vs 실 구현 매핑
│   ├── CHANGELOG.md
│   ├── RUNBOOK.md
│   ├── PORTING.md
│   ├── CODEMAPS/               ← 자동 생성 (P2)
│   └── dev-log/                ← 일일 로그
└── tests/
    ├── unit/                   ← 56 / 56 PASS
    ├── integration/            ← P2
    └── e2e/                    ← P2
```

빌드 산출물(`.gitignore`):

```
.claude/  .codex/  .cursor/  .gemini/  .opencode/  .harness/
node_modules/  coverage/
```

## 16. 예시 설정 파일

`agent.yaml` 의 핵심 섹션 (전문은 레포 참조):

```yaml
spec_version: gitagent/0.1.0
name: harness
version: 0.0.1

agents: [architect, planner, executor, code-reviewer, codex-reviewer,
         codex-challenger, security-reviewer, debugger, test-engineer,
         research, doc-writer]

skills: [claude-led-codex-review, plan-eng-review, tdd-workflow, review, ship]

hooks:
  file: hooks/hooks.json
  active: [gateguard-fact-force, quality-gate, pre-bash-dispatcher, persistent-mode]

mcp:
  gateway: bridge/mcp-server.js
  external_servers:
    - { name: github,   pin: "@modelcontextprotocol/server-github@2025.4.8" }
    - { name: context7, pin: "@upstash/context7-mcp@2.1.4" }
    - { name: exa,      type: http, url: https://mcp.exa.ai/mcp }
    - { name: memory,   pin: "@modelcontextprotocol/server-memory@2026.1.26" }

harnesses:
  - { name: claude,   output_dir: .claude,   builder: scripts/build-claude.js }
  - { name: codex,    output_dir: .codex,    builder: scripts/build-codex.js }
  - { name: cursor,   output_dir: .cursor,   builder: scripts/build-cursor.js }
  - { name: gemini,   output_dir: .gemini,   builder: scripts/build-gemini.js }
  - { name: opencode, output_dir: .opencode, builder: scripts/build-opencode.js }

profiles: { default: developer, available: [core, developer, security, research, full] }

security:
  mcp_pin_required: true
  outbound_network_default: deny
  fact_forcing_default: true
  audit_log_path: .harness/audit

routing:
  eco_mode_floor: sonnet
  human_gate_triggers: { severity: critical, round: 3, blast_radius: 20 }
```

`.mcp.json` (Claude Code 가 읽음):

```json
{
  "mcpServers": {
    "harness": { "command": "node", "args": ["bridge/mcp-server.js"] },
    "github":  { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github@2025.4.8"] }
  }
}
```

## 17. 예시 명령어 (CLI 10 verb)

```bash
# 설치 / 정합성
./install.sh --plan --profile developer
./install.sh --apply --profile developer
node scripts/repair.js --check
node scripts/sync-claude-md.js --check

# 풀체인
harness review "<task>"                  # 1~7단계 자동
harness review "<task>" --secure         # codex-challenge 강제
harness review "<task>" --fast           # codex-challenge 스킵
harness review --pr 123                  # PR 모드
harness plan "<task>"                    # 단계 2 단독
harness self-review                      # 단계 4 단독
harness codex-review                     # 단계 5 단독
harness ship                             # 단계 7 단독

# 운영
harness sessions                         # 활성 / 보관 세션 목록
harness costs --since=7d                 # 비용 누적
harness instincts {record|list|promote|prune|ready}

# 검증
npm run validate:all                     # 4개 catalog validator
npm run test                             # 단위 테스트
node scripts/ci/catalog.js               # 매니페스트 vs 파일
node scripts/ci/check-markers.js         # CLAUDE.md 마커 무결성
```

## 18. 최종 권장 아키텍처

향후 6개월 권장 진화:

1. **이식성 검증** (P0) — 사내 PoC 비파괴 결합 1건, GitHub push 후 Actions 실 동작.
2. **integration / e2e 테스트** (P2) — 실 풀체인 시나리오 + `.harness/state/sessions/<id>/` 영속 검증.
3. **codemap 자동 생성** (P2) — `docs/CODEMAPS/<area>.md` 디렉터리 트리 + 핵심 export.
4. **Rust runtime 컴파일 검증** (P2) — IPC ping 까지.
5. **사내 LLM provider** (P3) — `runners/internal.js` 추가, 사내 endpoint 라우팅.
6. **OIDC / dead-man / supply chain 스캔** (P3) — Security Bar 12-item 풀 충족.

**원칙 유지**:

- 매니페스트는 단일 진실 원본.
- 자동화 끝에 사람이 있다 (severity / round / blast 게이트).
- progressive disclosure — 184개 카탈로그로 한꺼번에 늘리지 않는다.
- 매직 키워드 자동 활성 금지 — 사용자 룰 우선.
- 핸드오프는 5필드, 10~20줄.

본 아키텍처는 1년에 한 번 이상 큰 변경이 없어야 한다 (`SOUL.md`). 자주 바뀐다면 정체성이 흔들리고 있다는 신호.

## 부록 A — 5대 원칙

1. **Single Source of Truth** — `agent.yaml` + 정규 카탈로그 디렉터리가 진실, 하네스별 디렉터리는 빌드 산출물.
2. **Claude 주 실행자, Codex 독립 검증자** — 컨텍스트 미공유, 핸드오프 마크다운으로만 통신.
3. **Progressive Disclosure** — 스킬 카탈로그는 description 만 노출, 본문은 lazy-load.
4. **Fact-Forcing Security** — Edit/Write 직전 importer·API·schema 사실 조사 강제.
5. **Test → Review → Re-Review → Human Gate** — 모든 자동 수정은 4단 게이트.

## 부록 B — 7단계 풀사이클 플래그

`ideate → plan → implement → self-review → codex-review → [codex-challenge] → ship`

| 플래그 | 효과 |
|---|---|
| `--fast` | 단계 1·6 스킵 (빠른 패치) |
| `--secure` | 단계 6 강제 (인증 / 결제 / PII) |
| `--no-ship` | 단계 7 생략 (로컬 검증 only) |
| `--pr <n>` | PR 모드. 결과를 GitHub PR 코멘트로 |

`severity = critical` OR `round ≥ 3` OR `blast_radius ≥ 20` 파일이면 human gate 자동 트리거.
