# HARNESS

> Hybrid Agent Runtime with Native Evaluation, Skills, and Security

[![harness-validate](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)

Claude Code · Codex CLI · Cursor · Gemini CLI · OpenCode 를 단일 매니페스트로 통합하는 차세대 AI 개발 에이전트 하네스. ECC(everything-claude-code) 의 매니페스트·인스톨러 골격 위에 OMC(oh-my-claudecode) 의 멀티 에이전트·영속 실행 런타임을 얹고, claude-led-codex-review 7단계 풀사이클을 디폴트 검증 루프로 박았다.

## 5대 원칙

1. **Single Source of Truth** — `agent.yaml` + `agents/`, `skills/`, `hooks/`, `commands/` 가 진실 원본. 하네스별 디렉터리(`.claude/`, `.codex/`, ...)는 빌드 산출물.
2. **Claude 주 실행자, Codex 독립 검증자** — 컨텍스트 미공유. 핸드오프 마크다운으로만 통신.
3. **Progressive Disclosure** — 스킬은 카탈로그 description 만 노출, 본문은 호출 시점 lazy-load.
4. **Fact-Forcing Security** — 자기평가는 무력. Edit 직전 importer·API·schema 사실 조사 강제.
5. **Test → Review → Re-Review → Human Gate** — 모든 자동 수정은 4단 게이트.

## 빠른 시작

```bash
node scripts/install-plan.js --profile core      # 설치 dry-run
npm test                                          # 93 테스트 (76 unit + 10 integration + 7 e2e)
node scripts/cli.js review "<task>" --no-ship    # 7단계 풀사이클 dry-run (mock provider)
```

## 상태 (2026-05-02 기준, v0.0.2)

- **0.0.1** (Week 1~4): 골격·거버넌스·매니페스트·11 agents·5 skills·5 hooks·MCP 7 도구·orchestrator·4 provider runner·인스팅트·Rust runtime 골격(529 LOC, 컴파일 미검증)·GitHub Actions 2개. ~12,000 LOC.
- **0.0.2** (P1 회수): 빈 디렉터리 0, 미구현 스크립트 0 (validate-* 4개 / build-{cursor,gemini,opencode} / sync-claude-md / repair / build-codemaps), 통합 테스트 10·E2E 테스트 7 신규. 단위 56 + 통합 10 + E2E 7 = **73/73 PASS**. 누적 ~14,500 LOC.
- **local-first auth 포팅**: Claude 기본 live runner 를 Claude Code CLI 세션으로 전환. Claude/Codex/Gemini CLI 호출 직전 long-lived API key 환경변수는 기본 차단, 명시 opt-in 시에만 SDK/API-key 경로 사용. Provider 공통 core 유틸(`cli-resolver`, `subprocess`, `json-extractor`) 분리. 단위 76 + 통합 10 + E2E 7 = **93/93 PASS**.
- **다음**: P2 외부 의존 — Rust 컴파일 / Claude·Codex·Gemini CLI live smoke / npm publish.

## 빠진 / 부채

`docs/AUDIT.md` 참조. 0.0.2 P1 회수 결과:

- 빈 디렉터리 **0**, 미구현 스크립트 **0**, stub 메시지 **0**.
- 자체 완결 영역 100% 정합.
- 외부 의존 잔존 5건: Claude CLI live smoke / Rust 컴파일 / Codex CLI live / Gemini CLI live / 사내 PoC 결합.

## 문서

- [docs/SETUP.md](docs/SETUP.md) — 외부 컨트리뷰터 / 다른 머신 셋업 (P2 외부 의존 절차)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 통합 설계 (18절)
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — 버전 이력
- [docs/AUDIT.md](docs/AUDIT.md) — 부채 / 우선순위
- [docs/RUNBOOK.md](docs/RUNBOOK.md) — 운영 절차
- [docs/PORTING.md](docs/PORTING.md) — 사내 PoC 결합 가이드
- [SOUL.md](SOUL.md) — 정체성
- [RULES.md](RULES.md) — Must / Must Never
- [CLAUDE.md](CLAUDE.md) — Claude Code 부팅 컨텍스트
- [AGENTS.md](AGENTS.md) — 외부 하네스용 풀 사양
- [WORKING-CONTEXT.md](WORKING-CONTEXT.md) — 현재 스프린트 액티브 메모리
- [REVIEW.md](REVIEW.md) — 핸드오프 표준

## 라이선스

MIT
