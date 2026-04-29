# HARNESS

> Hybrid Agent Runtime with Native Evaluation, Skills, and Security

Claude Code · Codex CLI · Gemini CLI 를 단일 매니페스트로 통합하는 차세대 AI 개발 에이전트 하네스. ECC(everything-claude-code) 의 매니페스트·인스톨러 골격 위에 OMC(oh-my-claudecode) 의 멀티 에이전트·영속 실행 런타임을 얹고, claude-led-codex-review 7단계 풀사이클을 디폴트 검증 루프로 박았다.

## 5대 원칙

1. **Single Source of Truth** — `agent.yaml` + `agents/`, `skills/`, `hooks/`, `commands/` 가 진실 원본. 하네스별 디렉터리(`.claude/`, `.codex/`, ...)는 빌드 산출물.
2. **Claude 주 실행자, Codex 독립 검증자** — 컨텍스트 미공유. 핸드오프 마크다운으로만 통신.
3. **Progressive Disclosure** — 스킬은 카탈로그 description 만 노출, 본문은 호출 시점 lazy-load.
4. **Fact-Forcing Security** — 자기평가는 무력. Edit 직전 importer·API·schema 사실 조사 강제.
5. **Test → Review → Re-Review → Human Gate** — 모든 자동 수정은 4단 게이트.

## 빠른 시작 (Day 1 시점)

```bash
# 설치 dry-run
node scripts/install-plan.js --profile core
```

## 상태 (2026-04-29 기준)

- **Week 1 완료**: 골격 + 거버넌스 + 매니페스트 + 11 agents + 5 skills + 5 hooks + MCP 4도구 + gateguard·quality-gate 실 구현.
- **Week 2 완료**: orchestrator + 4 provider runner (mock/claude/codex/gemini) + lib (severity/router/costs) + MCP 7도구 + ralph 영속 루프 + GitHub Actions 2개 + PORTING 가이드.
- **Week 3 완료**: 인스팅트 시스템 (record/list/promote/prune) + PoC 이식 시뮬레이터 + live runner extractJson/buildPrompt 단위 테스트.
- 누적: 4 커밋, ~92 파일, ~10,500 LOC, 단위 테스트 **52/52 PASS**.

## 문서

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 통합 설계 (18절)
- [SOUL.md](SOUL.md) — 정체성
- [RULES.md](RULES.md) — Must / Must Never
- [CLAUDE.md](CLAUDE.md) — Claude Code 부팅 컨텍스트
- [AGENTS.md](AGENTS.md) — 외부 하네스용 풀 사양
- [WORKING-CONTEXT.md](WORKING-CONTEXT.md) — 현재 스프린트 액티브 메모리
- [REVIEW.md](REVIEW.md) — 핸드오프 표준
- [docs/RUNBOOK.md](docs/RUNBOOK.md) — 운영 절차

## 라이선스

MIT
