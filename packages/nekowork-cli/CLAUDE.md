# CLAUDE.md

> Claude Code 부팅 컨텍스트. 자동 갱신 영역은 마커 사이만 갈아낀다. 사용자 작성 영역은 보존된다.

## 사용자 작성 영역 (수동, 보존)

이 프로젝트는 HARNESS 자체 코드베이스다. 프로젝트 디폴트 자연어는 한국어 (외부 컨트리뷰터의 영어 PR 환영). 사용자가 자기 환경에 글로벌 룰 (`~/.claude/CLAUDE.md` 등) 을 두고 있다면 그쪽이 우선한다.

## 자동 갱신 영역

<!-- HARNESS:START version=0.1.0-alpha.12 -->
<!-- 이 영역은 scripts/sync-claude-md.js 가 자동 갱신한다. 직접 편집 금지. -->

## 카탈로그 요약

- agents: 11
- skills: 11
- commands: 1 (legacy compat)
- hooks: 5 (gateguard-fact-force, config-protection, quality-gate, pre-bash-dispatcher, persistent-mode)
- packs: core, builder, productivity, team, debugging, maintenance, pr, catalog-plus, quality, security, frontend, testing, release, enterprise
- profiles: core, developer, builder, productivity, security, product, quality, frontend, testing, research, full
- harnesses: claude, codex, cursor, gemini, opencode

## 에이전트 → 모델 매트릭스

| Agent | Provider | Model | Sandbox |
|---|---|---|---|
| architect | claude | opus | read-only |
| planner | claude | opus | read-only |
| executor | claude | sonnet | workspace-write |
| code-reviewer | claude | opus | read-only |
| codex-reviewer | codex | gpt-5-codex | read-only |
| codex-challenger | codex | gpt-5-codex | read-only |
| security-reviewer | claude | opus | read-only |
| debugger | claude | sonnet | workspace-write |
| test-engineer | claude | sonnet | workspace-write |
| research | gemini | gemini-2.5-pro | read-only |
| doc-writer | claude | haiku | workspace-write |

## 핵심 명령어

README 의 Main Surface 3계층(Beginner / Advanced / Legacy) 과 정렬한다. 신규 사용자는 Beginner 4종만 먼저 익히면 된다.

### Beginner — 안전 게이트 4종

```bash
nekowork check                              # 환경 진단 (30초)
nekowork start "<task>"                     # 검증 결과(verdict 카드) 우선 출력
nekowork report --session latest            # 세션 증거 → readable REPORT.md
nekowork apply --session <id>               # 명시적 적용. SHIP_READY 와 clear gate 필수
```

### Advanced — 단계별 제어

```bash
nekowork ask "<task>"                       # question gate, no project mutation
nekowork plan "<task>"                      # plan-only
nekowork team "<task>"                      # read-only worker handoffs
nekowork work "<task>"                      # single executor implement handoff
nekowork verify "<task>" --session <id>     # Codex-only verification
nekowork gate status --session <id>         # HUMAN_GATE / approval / block 확인
nekowork ship "<task>" --session <id>       # SHIP_READY / NO_SHIP 결정
nekowork run "<task>" --session <id>        # work -> verify -> ship 래퍼
nekowork build "<task>" [--mode auto|...]   # 일체형 빌더 래퍼
nekowork auto "<task>" [--level cautious|...]  # bounded autonomy (apply 는 별도)
nekowork pr-prep --session <id>             # PR 자료만, 브랜치/푸시/PR 생성 X
```

### Legacy — 하위 호환

```bash
nekowork review "<task>" [--secure|--fast|--no-ship]   # legacy full cycle
nekowork review-cycle "<task>"                          # explicit legacy alias
nekowork self-review
nekowork codex-review                       # 단계 5 단독
```

### Install / Diagnostics

```bash
nekowork install --plan --profile core      # 설치 dry-run
nekowork install --plan --pack quality      # curated pack dry-run
nekowork install --apply --profile <p>      # 실제 설치
nekowork sessions                           # 세션 목록
nekowork costs --since=7d                   # 비용 추정
```

## State 경로

- 세션: `.harness/state/sessions/<id>/{prd.json,progress.txt,notepad.md,handoffs/}`
- 프로젝트: `.harness/project-memory.json` + `WORKING-CONTEXT.md`
- 글로벌: `~/.harness/instincts/` + `.harness/costs.jsonl`

## 매직 키워드 → 스킬 (명시 옵트인만)

자동 활성 키워드 감지는 **사용**하지 않는다. 사용자 룰("확인 후 실행") 우선. 모든 스킬은 슬래시 명령(`/nekowork-full-cycle`) 또는 CLI(`nekowork review`) 로 명시 호출.

## 핸드오프 5필드

Decided / Rejected / Risks / Files / Remaining — 10~20줄.

<!-- HARNESS:END -->

## 빌드 후 확인

```bash
node scripts/ci/check-markers.js   # 마커 일관성
npm run validate:all               # 카탈로그 lint
```
