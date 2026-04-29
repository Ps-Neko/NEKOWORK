# HARNESS — 통합 아키텍처

> 본 문서는 18절 풀 사양을 다음 세션에 본문 채움. Day 1 시점 골격 + 핵심 의사결정만 표 형태로 박아둔다.
> 원천 분석: ECC (`affaan-m/everything-claude-code` v2.0.0-rc.1), OMC (`Yeachan-Heo/oh-my-claudecode` v4.13.5), CLCR (`~/.claude/commands/claude-led-codex-review.md`).

## 5대 원칙

1. **Single Source of Truth** — `agent.yaml` + 정규 카탈로그 디렉터리가 진실, 하네스별 디렉터리는 빌드 산출물.
2. **Claude 주 실행자, Codex 독립 검증자** — 컨텍스트 미공유, 핸드오프 마크다운으로만 통신.
3. **Progressive Disclosure** — 스킬 카탈로그는 description 만 노출, 본문은 lazy-load.
4. **Fact-Forcing Security** — Edit/Write 직전 importer·API·schema 사실 조사 강제.
5. **Test → Review → Re-Review → Human Gate** — 모든 자동 수정은 4단 게이트.

## 8-계층 구조 (요약)

| 계층 | 핵심 컴포넌트 (Day 1 부트스트랩 기준) |
|---|---|
| 1 Interface | NL Router, Slash Command, CLI (`scripts/cli.js`), GitHub Actions, CI |
| 2 Orchestration | Task Planner, Agent Router, Team/Worktree Mgr, Persistent Ctrl, Cost Optimizer |
| 3 Agent | architect, planner, executor, code-reviewer, codex-reviewer, codex-challenger, security-reviewer, debugger, test-engineer, research, doc-writer (11개) |
| 4 Skill & Rule | `skills/<name>/SKILL.md` + `rules/{common,typescript,python,…}` + 거버넌스 4문서 |
| 5 Memory & Learning | session(`prd.json` + `handoffs/<NN>-<stage>.md`) + project(`WORKING-CONTEXT.md` + `project-memory.json`) + cross-session(`~/.harness/instincts/`) |
| 6 Verification | quality-gate → self-review → codex-review → codex-challenge(--secure) → fix-loop(round≤3) → human gate |
| 7 Security & Governance | sandbox, secret redaction, prompt injection 방어, MCP allowlist + SemVer 핀, audit log, severity matrix |
| 8 Integration | `.claude/`, `.codex/`, `.cursor/`, `.gemini/`, `.opencode/` 빌드 어댑터 + bridge/mcp-server.cjs 단일 게이트웨이 |

## 7단계 풀사이클 (claude-led-codex-review)

`ideate → plan → implement → self-review → codex-review → [codex-challenge] → ship`

- `--fast`: 1·6 스킵
- `--secure`: 6 강제
- `--no-ship`: 7 생략
- round ≥ 3 또는 critical 발견 시 human gate

## 라우팅 매트릭스

3단계: provider(claude/codex/gemini/local) → model tier(opus/sonnet/haiku) → stage routing(필수/옵션 에이전트)

## 채택하지 않은 것

- OMC 매직 키워드 자동 활성 (사용자 룰 "확인 후 실행" 우선)
- ECC 184개 스킬 풀 카탈로그 (5개로 시작, progressive 확장)
- ECC `pyproject.toml` LLM monorepo 구조 (별도 레포)

## 다음 세션에서 채움

- 데이터/컨텍스트 흐름 다이어그램
- Codex Review Loop 상태 머신 풀 명세
- 12-item Security Minimum Bar 구현 매핑 표
- MVP vs Full Architecture 분리표
- 2주 개발 계획 (Day 1 완료, Day 2~10)
