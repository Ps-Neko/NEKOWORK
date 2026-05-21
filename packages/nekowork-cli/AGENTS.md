# AGENTS.md

> 외부 하네스(Codex CLI, OpenAI 표준, GitHub agents) · 사람을 위한 풀 사양. CLAUDE.md 의 압축 버전이 아니라 정전(canon) 문서.

## You Are

You are running with HARNESS — a multi-harness AI development agent runtime. Your role depends on which agent identity you were dispatched with. Read the matching `agents/<name>.md` for your full prompt and constraints.

## 역할 정전(Canonical Roles)

각 에이전트는 `agents/<name>.md` 의 frontmatter 로 정의된다. 핵심 필드:

```yaml
name: <id>
description: <한 줄>
provider: claude | codex | gemini | auto
model: opus | sonnet | haiku | gpt-5-codex | gemini-2.5-pro
level: 0 | 1 | 2 | 3      # 0=info, 1=helper, 2=workflow, 3=critical
disallowedTools: [...]    # Opus 는 기본 Write/Edit 차단
trigger: [...]            # 키워드 또는 stage 이름
hand_off_to: [...]
fact_forcing: true|false  # PreToolUse 사실 조사 강제 여부
```

## Workflow Surface Policy

- `skills/` 가 정전 워크플로우 표면이다. 새 워크플로우는 `skills/` 에 먼저 만든다.
- `commands/` 는 legacy slash-entry 호환 표면이다. 신규 추가 금지, 점진 마이그레이션.
- `agents/` 는 페르소나 카탈로그다. 워크플로우는 `skills/` 에서 정의하고 에이전트는 `skills/` 가 호출한다.

## 7단계 풀사이클 (claude-led-codex-review)

| 단계 | 담당 | 입력 | 출력 |
|---|---|---|---|
| 1 ideate | research, planner | 사용자 한 줄 요청 | `handoffs/01-ideate.md` |
| 2 plan | planner (opus) | 1의 출력 + 선택적 upstream(`context.md`, `DOMAIN.md`, `SPEC.md`) | `prd-<id>.md` + `test-spec-<id>.md` + `plan-inputs.json` |
| 3 implement | executor (sonnet) | 2의 출력 + 선택적 `PLAN.md` + TDD | git diff |
| 4 self-review | code-reviewer (opus, ro) | git diff | `handoffs/04-self-review.md` (issues JSON 요약) |
| 5 codex-review | codex-reviewer (별도 세션) | diff + 04 + PRD | `handoffs/05-codex-review.md` |
| 6 codex-challenge | codex-challenger (별도 세션, --secure) | diff + 04 + 05 | `handoffs/06-challenge.md` |
| 7 ship | doc-writer + git-master | 모든 핸드오프 | PR + CHANGELOG |

**Upstream artifact contract.** `ask` / `plan` / `team` / `work` 는 `<projectRoot>/{context,DOMAIN,SPEC,PLAN}.md` 를 자동으로 픽업하거나 명시 플래그(`--context-file`, `--domain-file`, `--spec-file`, `--plan-file`) 로 전달받는다. 결과는 `ask.json.upstream_artifacts`, `plan-inputs.json`, `work-summary.json.upstream`, 그리고 각 단계 handoff 의 `upstream_artifacts` 필드에 기록된다. 자세한 contract 는 [docs/INTEGRATION.md](docs/INTEGRATION.md) 참고.

**용어 노트.** 7단계 표의 `ship` 은 **readiness decision** 이다 (`SHIP_READY` / `NO_SHIP` 마커). 배포가 아니다. `ship` 결과는 `apply` 가 허용되는지만 결정하며, 자체적으로 커밋·푸시·배포·퍼블리시를 하지 않는다.

## 라우팅 결정 규칙

- **eco mode**: opus → sonnet, sonnet → haiku (단 단계 4·5는 sonnet floor).
- **risk escalation**: auth/crypto/payment 디렉터리 변경 → security-reviewer 필수, --secure 자동 활성.
- **blast radius**: 변경 파일 ≥ 20 → code-reviewer (opus) 필수.
- **round limit**: 단계 5/6 round ≥ 3 → human gate.

## 권한 매트릭스

| Tool | architect | planner | executor | code-reviewer | codex-reviewer | security-reviewer |
|---|---|---|---|---|---|---|
| Read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Write | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Edit | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Bash | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Network | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |

## 핸드오프 표준

```markdown
# Handoff: <stage>

**Decided**: ...
**Rejected**: ...
**Risks**: ...
**Files**: ...
**Remaining**: ...
```

10~20줄 한도. 자유 산문 금지. JSON 첨부 가능 (`schemas/handoff.schema.json`).

## State Management

- `.harness/state/sessions/<id>/prd.json` — acceptance criteria + passes 플래그
- `.harness/state/sessions/<id>/progress.txt` — append-only 학습 누적
- `.harness/state/sessions/<id>/notepad.md` — 자유 메모
- `.harness/state/sessions/<id>/handoffs/<NN>-<stage>.md` — 단계 간 결정 로그

PreCompact 훅이 컴팩션 직전 자동 dump. SessionStart 에서 active 세션 발견 시 prd + 가장 최근 핸드오프 2개만 inject.

## 보안 12-item Minimum Bar

ECC `the-security-guide.md` 차용:

1. 에이전트 ID 와 개인 계정 분리
2. Short-lived scoped credentials (OIDC 권장)
3. Untrusted work 는 devcontainer / VM / 원격 샌드박스
4. Outbound network 기본 deny
5. Secret-bearing path 읽기 차단
6. 파일 / HTML / 스크린샷 / 링크 sanitize 후 privileged agent 에 전달
7. unsandboxed shell, egress, deploy, off-repo write 는 approval 필수
8. tool calls / approvals / network attempts 모두 로깅
9. process-group kill + heartbeat dead-man switch
10. 영속 메모리는 좁고 처분 가능하게
11. 카탈로그(skills, hooks, MCP, agents)도 supply chain 으로 스캔
12. MCP 서버는 SemVer 핀

## 외부 하네스 호환

- **Claude Code**: `.claude/` 빌드 산출물 + `.claude-plugin/plugin.json`
- **Codex CLI**: `.codex/config.toml` (TOML, `[mcp_servers.*]`, `[profiles.review]` 등)
- **Cursor**: `.cursor/hooks.json` (이벤트명 어댑터: `beforeShellExecution` 등)
- **Gemini CLI**: `.gemini/GEMINI.md` (요약 + 스킬 포인터)
- **OpenCode**: `.opencode/opencode.json` (단일 JSON)

빌드 타임 투영은 `scripts/build-<harness>.{js,ts}` 가 담당.

## 변경 절차

이 문서의 핸드오프 표준 / 라우팅 규칙 / 권한 매트릭스 변경은 RULES.md 변경과 함께 진행한다.
