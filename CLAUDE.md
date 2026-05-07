# CLAUDE.md

> Claude Code 부팅 컨텍스트. 자동 갱신 영역은 마커 사이만 갈아낀다. 사용자 작성 영역은 보존된다.

## 사용자 작성 영역 (수동, 보존)

이 프로젝트는 HARNESS 자체 코드베이스다. 프로젝트 디폴트 자연어는 한국어 (외부 컨트리뷰터의 영어 PR 환영). 사용자가 자기 환경에 글로벌 룰 (`~/.claude/CLAUDE.md` 등) 을 두고 있다면 그쪽이 우선한다.

## 자동 갱신 영역

<!-- HARNESS:START version=0.1.0-alpha.1 -->
<!-- 이 영역은 scripts/sync-claude-md.js 가 자동 갱신한다. 직접 편집 금지. -->

## 카탈로그 요약

- agents: 11
- skills: 10
- commands: 1 (legacy compat)
- hooks: 5 (gateguard-fact-force, config-protection, quality-gate, pre-bash-dispatcher, persistent-mode)
- profiles: core, developer, security, product, quality, frontend, testing, research, full
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

```bash
harness install --plan --profile core      # 설치 dry-run
harness ask "<task>"                       # question gate, no project mutation
harness team "<task>"                      # read-only worker handoffs
harness work "<task>"                      # single executor implement handoff
harness verify "<task>" --session <id>     # Codex-only verification
harness gate status --session <id>         # inspect or resolve HUMAN_GATE state
harness ship "<task>" --session <id>       # ship/no-ship readiness handoff
harness apply --session <id>               # apply verified SHIP_READY live-work diff
harness run "<task>" --session <id>        # work -> verify -> ship, optional --apply
harness review "<task>" [--secure|--fast|--no-ship]  # legacy full cycle
harness review-cycle "<task>" [--secure|--fast|--no-ship]  # explicit legacy alias
harness plan "<task>"
harness self-review
harness codex-review                       # 단계 5 단독
harness sessions
harness costs --since=7d
```

## State 경로

- 세션: `.harness/state/sessions/<id>/{prd.json,progress.txt,notepad.md,handoffs/}`
- 프로젝트: `.harness/project-memory.json` + `WORKING-CONTEXT.md`
- 글로벌: `~/.harness/instincts/` + `.harness/costs.jsonl`

## 매직 키워드 → 스킬 (명시 옵트인만)

자동 활성 키워드 감지는 **사용**하지 않는다. 사용자 룰("확인 후 실행") 우선. 모든 스킬은 슬래시 명령(`/claude-led-codex-review`) 또는 CLI(`harness review`) 로 명시 호출.

## 핸드오프 5필드

Decided / Rejected / Risks / Files / Remaining — 10~20줄.

<!-- HARNESS:END -->

## 빌드 후 확인

```bash
node scripts/ci/check-markers.js   # 마커 일관성
npm run validate:all               # 카탈로그 lint
```
