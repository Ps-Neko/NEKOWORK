# CLAUDE.md

> Claude Code 부팅 컨텍스트. 자동 갱신 영역은 마커 사이만 갈아낀다. 사용자 작성 영역은 보존된다.

## 사용자 작성 영역 (수동, 보존)

이 프로젝트는 HARNESS 자체 코드베이스다. 모든 응답은 한국어로 작성하고, 사용자 글로벌 룰(`C:\Users\ILJIN\.claude\CLAUDE.md`)을 우선한다.

## 자동 갱신 영역

<!-- HARNESS:START version=0.0.1 -->

## 카탈로그 요약

- agents: 11
- skills: 5
- commands: 1 (legacy compat)
- hooks: 4 (gateguard-fact-force, quality-gate, pre-bash-dispatcher, persistent-mode)
- profiles: core, developer, security, research, full
- harnesses: claude, codex, cursor, gemini, opencode

## 에이전트 → 모델 매트릭스

| Agent | Provider | Model | Tools |
|---|---|---|---|
| architect | claude | opus | read-only |
| planner | claude | opus | read-only |
| executor | claude | sonnet | full |
| code-reviewer | claude | opus | read-only |
| codex-reviewer | codex | gpt-5-codex | read-only, no-net |
| codex-challenger | codex | gpt-5-codex | read-only, no-net |
| security-reviewer | claude | opus | read-only |
| debugger | claude | sonnet | full |
| test-engineer | claude | sonnet | full |
| research | gemini | gemini-2.5-pro | read-only |
| doc-writer | claude | haiku | full |

## 핵심 명령어

```bash
harness install --plan --profile core      # 설치 dry-run
harness review "<task>" [--secure|--fast|--no-ship]
harness plan "<task>"
harness self-review
harness codex-review                       # 단계 5 단독
harness ship
harness sessions
harness costs --since=7d
```

## State 경로

- 세션: `.harness/state/sessions/<id>/{prd.json,progress.txt,notepad.md,handoffs/}`
- 프로젝트: `.harness/project-memory.json` + `WORKING-CONTEXT.md`
- 글로벌: `~/.harness/instincts/` + `~/.harness/costs.jsonl`

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
