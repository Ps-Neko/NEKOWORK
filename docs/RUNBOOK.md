# RUNBOOK

> 운영자(사람)·자동화·외부 협업자가 동일한 절차로 HARNESS 를 다루기 위한 단일 책자. Day 별 진행 상태와 검증 절차를 누적 기록한다.

## 0. 사전 조건

- Node 22+ (확인: `node -v`)
- Git
- Bash (Windows 는 git-bash 또는 WSL2)
- Codex CLI (Day 5 이후): `npm i -g @openai/codex` 또는 공식 패키지

## 1. 초기 설치 (개발자 입장)

```bash
git clone <repo> harness
cd harness
npm install
node scripts/install-plan.js --profile core --verbose
```

JSON 으로 받기:
```bash
node scripts/install-plan.js --profile developer --json > plan.json
```

## 2. 프로파일별 차이 (Day 1 시점)

| 프로파일 | 모듈 수 | 컴포넌트 수 | 용도 |
|---|---|---|---|
| core | 4 | 32 | 최소 부팅. claude-led-codex-review 풀사이클 가능 |
| developer | 6 | 40 | 일상 개발 (디폴트) |
| security | 6 | 40 | --secure 디폴트, auth/crypto/payment |
| research | 5 | 36 | 사내 RAG / Context7 / Exa 결합 |
| full | 6 | 40 | 정의된 모든 모듈 |

## 3. 매일 검증

```bash
# 카탈로그 무결성
node scripts/ci/catalog.js

# 마커 무결성
node scripts/ci/check-markers.js

# (Day 5 이후) 모든 검증
npm run validate:all
```

## 4. CLI 사용

```bash
node scripts/cli.js install --plan --profile developer
node scripts/cli.js validate
node scripts/cli.js version

# 또는 trampoline
./install.sh --plan --profile core
```

## 5. Day 1 산출 검증 결과 (2026-04-29)

### 동작 확인
- [x] 디렉터리 골격 17개 + git init
- [x] 거버넌스 6 (SOUL/RULES/CLAUDE/AGENTS/WORKING-CONTEXT/REVIEW)
- [x] agent.yaml (gitagent/0.1.0) — 검증 통과
- [x] manifests 3종 — 검증 통과
- [x] JSON Schema 10개 (요청 9개 + routing 보너스)
- [x] install.sh / install.ps1 트램폴린
- [x] install-plan.js dry-run — 5 프로파일 모두 동작
- [x] CI: catalog.js + check-markers.js
- [x] cli.js 진입점

### 카탈로그 카운트
- agents 선언 11 (파일 0, Day 2 작성)
- skills 선언 5 (파일 0, Day 2 작성)
- commands 선언 1 (파일 0, Day 2 작성)
- modules 6 / components 32 / profiles 5
- catalog.js 통과 (warnings 18 = 예상된 결손)

### 알려진 결손 (Day 2/3)
- agents/<name>.md 11개 frontmatter + 본문
- skills/claude-led-codex-review/SKILL.md + 단계별 stage-*.md
- commands/claude-led-codex-review.md (legacy compat)
- hooks/hooks.json + 4개 훅 stub
- bridge/mcp-server.cjs (Day 4)

## 6. 트러블슈팅

### Ajv 가 draft 2020-12 인식 못 함
```
Error: no schema with key or ref "https://json-schema.org/draft/2020-12/schema"
```
→ `import Ajv2020 from 'ajv/dist/2020.js'` 사용 (이미 적용됨).

### Windows 에서 install.sh 동작 안 함
→ git-bash 또는 WSL2 필요. 또는 `pwsh ./install.ps1 --plan --profile core`.

### npm install 실패
→ Node 22+ 인지 확인 (`node -v`), 회사 프록시 환경이면 `.npmrc` 에 registry 설정.

## 7. 진행 상태 (Week 1 완료, 2026-04-29)

### Day 1 완료
- 디렉터리 17 + 거버넌스 6 + agent.yaml + manifests 3 + schemas 10 + install plan stub.

### Day 2 완료
- agents/<name>.md 11개 (architect, planner, executor, code-reviewer, codex-reviewer, codex-challenger, security-reviewer, debugger, test-engineer, research, doc-writer).
- skills/<name>/SKILL.md 5개 (claude-led-codex-review, plan-eng-review, tdd-workflow, review, ship).
- commands/claude-led-codex-review.md (legacy compat).
- catalog.js 경고 0건.

### Day 3 완료
- hooks/hooks.json + 4훅 stub (gateguard, config-protection, pre-bash-dispatcher, persistent-mode, quality-gate).
- scripts/build-claude.js : 11+5+1+5 = 22 카탈로그 항목 + `.claude-plugin/plugin.json` 생성.
- scripts/build-codex.js : Codex provider agent 2개 → TOML, config.toml 생성.

### Day 4 완료
- bridge/mcp-server.js (MCP SDK 1.29 기반 단일 게이트웨이, 4도구).
- .mcp.json (단일 서버 등록).
- scripts/install-apply.js : plan → 빌드 → state 기록 → 마커 검증 풀체인.
- MCP smoke test 4도구 모두 PASS.

### Day 5 완료
- gateguard-fact-force.js 실 구현 : importer / public API / schema 정적 추출 + 답변 강제.
- quality-gate.js 실 구현 : tsc --noEmit / ruff / py_compile / node --check 다중 검증, 차단(exit 2).
- demo-review.js : 7단계 풀사이클 시뮬레이션, 7개 핸드오프 + round 카운터 + fix loop + --secure 자동 활성.

## 8. Week 1 데모 결과

```
node scripts/demo-review.js "JWT 검증 미들웨어 추가" demo-week1 --secure

[1] ideate           ✓
[2] plan             ✓ → prd.json (AC-001/002/003)
[3] implement TDD    ✓
[4] self-review r=1  → high 1 발견, verdict approve_with_fixes
[3a] fix-loop        → executor 재호출, round 2
[4] self-review r=2  → verdict approve
[5] codex-review     → medium 1 추가 발견, approve_with_fixes
[6] codex-challenge  → auth 영역 자동 활성, info 1, approve
[7] ship (no-push)   → CHANGELOG 갱신, PR 초안

handoffs/01..07 7개 모두 작성. prd.json 영속.
```

### gateguard 실 동작
```
첫 호출  : 사실 노트 생성, exit 2 (차단)
답변 후  : exit 0 (통과)
```

### quality-gate 실 동작
```
good .ts : tsc OK, exit 0
bad .ts  : tsc FAIL "Expression expected", exit 2 (차단)
```

## 9. 다음 단계 (Week 2)

### Day 6
- harness review CLI 명령 (실 LLM 호출 wiring) — Claude SDK + Codex CLI subprocess 연동.
- Stage Routing 표 → 실 에이전트 dispatch.
- 모든 단계가 디스크 핸드오프 / MCP gateway 거치도록.

### Day 7
- bridge/mcp-server.js 도구 추가 (severity_classify, route_decide, cost_record).
- routing.jsonl 트레이스 누적.
- harness costs --since=7d.

### Day 8
- ScheduleWakeup 결합 영속 데몬 (harness wait --start).
- ralph 모드 ($ralph 키워드는 명시 옵트인만, 자동 활성 안 함).

### Day 9~10
- GitHub Actions 통합 (.github/workflows/harness-review.yml).
- 사내 PoC 이식 가이드 (일반 절차).

## 8. 배포 / 이식

사내 다른 프로젝트에 동일 골격 이식 시 (사용자 지정 디렉터리):

1. 해당 프로젝트 루트에 `harness/` 를 git submodule 또는 npm dep 으로 결합.
2. `node node_modules/@harness/cli/scripts/install-plan.js --profile research`.
3. 프로젝트별 룰은 `rules/<project-name>/` 로 추가 (common 위에 오버라이드).
4. CLAUDE.md 의 `<!-- HARNESS:START -->` 마커 영역만 자동 갱신, 사용자 영역 보존.
