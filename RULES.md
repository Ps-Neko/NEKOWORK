# RULES

> 강제 가능한 규칙만 적는다. "왜"는 SOUL.md, "어떻게"는 CLAUDE.md / AGENTS.md.

## Must Always

- 모든 응답·산출물은 한국어로 작성한다.
- 모든 자동 수정은 quality-gate → self-review → codex-review 순서로 검증한다.
- 모든 도구 호출은 `.harness/audit/<date>.jsonl` 에 기록한다.
- 모든 MCP 서버는 SemVer 핀(`@x.y.z`)으로 명시한다. `@latest` 금지.
- `Edit` / `Write` 직전 `gateguard-fact-force` 가 사실 조사를 강제한다.
- 핸드오프는 5필드(Decided / Rejected / Risks / Files / Remaining)를 지킨다.
- 커밋 메시지는 `feat / fix / docs / refactor / test / chore / perf / ci` 접두사를 쓴다.
- 80% 이상 테스트 커버리지를 유지한다.

## Must Never

- 사용자 글로벌 룰을 우회하지 않는다 (`C:\Users\ILJIN\.claude\CLAUDE.md` 우선).
- `git push --force`, `git reset --hard`, `rm -rf` 를 자동 실행하지 않는다.
- `--no-verify` 로 hook 을 건너뛰지 않는다.
- secret 을 코드에 하드코딩하지 않는다.
- Codex 와 Claude 의 컨텍스트를 직접 공유하지 않는다 (핸드오프 문서로만).
- severity ≥ HIGH 또는 round ≥ 3 발견 시 사람 승인 없이 머지하지 않는다.
- 184개 스킬을 한꺼번에 카탈로그에 넣지 않는다 (progressive 확장).

## Format Specs

### Agent
- 위치: `agents/<name>.md`
- frontmatter 필수: `name, description, model, level, provider, disallowedTools`

### Skill
- 위치: `skills/<name>/SKILL.md`
- frontmatter 필수: `name, description, origin, level`

### Hook
- 위치: `hooks/hooks.json` (단일 정의) + `hooks/scripts/*.{js,mjs}`
- ENV 토글 필수 (`HARNESS_HOOK_<NAME>=1`)

### Handoff
- 위치: `.harness/state/sessions/<id>/handoffs/<NN>-<stage>.md`
- 5필드 고정: Decided / Rejected / Risks / Files / Remaining
- 10~20줄 한도

## 변경 절차

이 문서를 변경하려면 PR 에서 명시적 사유를 제시해야 한다. 변경 후 `CLAUDE.md` 와 `AGENTS.md` 의 자동 갱신 영역(`<!-- HARNESS:START --> ... <!-- HARNESS:END -->`)을 동기화한다.
