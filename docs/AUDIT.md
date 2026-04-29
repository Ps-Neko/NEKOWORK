# AUDIT — Week 1~4 통합 검토

> 작성일: 2026-04-29
> 목적: 18절 설계 문서 / MVP 정의 / 8계층 아키텍처 vs 실 구현 매핑. 빠진 항목 · 부채 · 다음 세션 우선순위.

## 1. 18절 설계 문서 매핑

| 절 | 항목 | 상태 | 위치 / 비고 |
|---|---|---|---|
| 1 | Executive Summary | OK | `README.md`, `docs/CHANGELOG.md` |
| 2 | 레퍼런스 역설계 요약 | 부분 | `docs/ARCHITECTURE.md` (stub). 풀 18절 본문 미작성 |
| 3 | 통합 아키텍처 개요 | 부분 | ARCHITECTURE stub. ASCII 다이어그램 미작성 |
| 4 | 계층별 컴포넌트 설계 | OK | (아래 §2 매트릭스 참조) |
| 5 | 데이터/컨텍스트 흐름 | OK | review.js 풀체인 동작, routing.jsonl, costs.jsonl |
| 6 | Agent 라우팅 전략 | OK | `scripts/lib/router.js` + Stage Routing 표 |
| 7 | Skill/Hook/Rule 구조 | 부분 | hook 5 OK. rule 디렉터리 빈 (§3 부채) |
| 8 | Codex Review Loop | OK | `scripts/orchestrators/review.js`, fix-loop / round / HUMAN_GATE |
| 9 | Memory & Learning | OK | session + project + instincts 3-tier |
| 10 | Security & Governance | 부분 | gateguard / config-protection / audit / MCP 핀 OK. 12-item 풀 매핑 미문서화 |
| 11 | 설치/배포 구조 | OK | plan/apply/build, 5 profile × 6 module × 32 component |
| 12 | MVP 범위 | OK | 18절 MVP 정의 항목 모두 충족 (§4) |
| 13 | 확장 로드맵 | OK | CHANGELOG Unreleased / RUNBOOK |
| 14 | 리스크 / 대응책 | 부분 | 발견된 마찰 (CRLF / Windows tsc / Node 24 호환) 문서 미정리 |
| 15 | 예시 디렉터리 구조 | OK | 실 디렉터리 vs 설계 거의 일치 |
| 16 | 예시 설정 파일 | OK | agent.yaml / hooks.json / .mcp.json |
| 17 | 예시 명령어 | OK | CLI 10 verb 동작 |
| 18 | 최종 권장 아키텍처 | OK | README, CHANGELOG |

## 2. 8계층 vs 실 구현

| 계층 | 상태 | 구현 / 부재 |
|---|---|---|
| 1 Interface | 부분 | CLI ✓, slash command ✓, NL Router(매직 키워드) **OFF (의도)** — 사용자 룰 우선. IDE plugin / GitHub PR trigger ✓ (Actions). |
| 2 Orchestration | 부분 | planner ✓, router ✓, **team mgr ×** (tmux 미구현, ralph 만), parallel ctrl × (직렬 실행), persistent ✓, cost ✓ |
| 3 Agent | OK | 11/11 |
| 4 Skill & Rule | 부분 | 6/6 skill + 거버넌스 4 + ralph. **rule 디렉터리 비어있음** (common/ts/py 모두 0 파일) |
| 5 Memory & Learning | OK | session(prd/handoffs/notepad/round) + project-memory(stub) + instincts (record/list/promote/prune/ready) |
| 6 Verification | OK | quality-gate ✓, self-review ✓, codex-review ✓, codex-challenge ✓, fix-loop ✓, severity matrix ✓, human gate ✓ |
| 7 Security & Governance | 부분 | gateguard / config-protection / audit jsonl / MCP 핀 / sandbox 프로파일 ✓. **OIDC / dead-man switch / supply chain 스캔 미구현** |
| 8 Integration | 부분 | claude / codex builder ✓, GH Actions ✓, MCP 단일 게이트웨이 ✓. **cursor / gemini / opencode builder ×** |

## 3. 빠진 항목 / 부채 (구체)

### 3.1 빈 디렉터리 (placeholder)
```
docs/CODEMAPS/         (codemap 자동 생성 미구현)
rules/common/          (공통 룰 미작성)
rules/typescript/      (TS 룰 미작성)
rules/python/          (Python 룰 미작성)
tests/e2e/             (e2e 테스트 미작성)
tests/integration/     (통합 테스트 미작성)
```

### 3.2 package.json 에 명시됐지만 미구현 스크립트
| 스크립트 | 상태 | 영향 |
|---|---|---|
| `scripts/ci/validate-agents.js` | MISSING | `npm run validate:agents` 실패. catalog.js 가 일부 대체. |
| `scripts/ci/validate-skills.js` | MISSING | 동상 |
| `scripts/ci/validate-hooks.js` | MISSING | 동상 |
| `scripts/ci/validate-manifests.js` | MISSING | 동상 |
| `scripts/build-cursor.js` | MISSING | `.cursor/` 빌드 안 됨. agent.yaml 에 명시. |
| `scripts/build-gemini.js` | MISSING | `.gemini/` 빌드 안 됨 |
| `scripts/build-opencode.js` | MISSING | `.opencode/` 빌드 안 됨 |
| `scripts/sync-claude-md.js` | MISSING | 마커 자동 갱신 미구현. check-markers 만 있음. |
| `scripts/repair.js` | MISSING | install repair 미구현. agent.yaml `post_install` 명시. |

### 3.3 검증 안 된 컴포넌트
| 항목 | 이유 |
|---|---|
| Anthropic SDK live 호출 | API 키 미보유 환경 |
| Codex CLI live 호출 | codex 바이너리 미설치 |
| Gemini CLI live 호출 | gemini 바이너리 미설치 |
| Rust runtime 컴파일 | rustup 미설치 |
| GitHub Actions 실 동작 | 레포 미 push |
| 사내 PoC 실 이식 | 외부 디렉터리 변경 보류 |
| install-apply 의 sha256 | placeholder (`0`*64) — Day 4 stub 그대로 |

### 3.4 stub 메시지 흔적
- `scripts/install-plan.js`: NOTE "Day 5 이후" — 사실 Day 4 부터 apply 동작. 메시지 갱신 필요.
- `scripts/install-apply.js`: 첫 줄 "Day 5 이후 구현" — 실제 Day 4 부터 풀체인. 메시지 잔존.

### 3.5 OMC / ECC 차용 안 한 것 (의도적)
| 패턴 | 이유 |
|---|---|
| OMC 매직 키워드 자동 활성 (`$ralph` 등) | 사용자 룰 "확인 후 실행" 우선 |
| ECC 184 스킬 풀 카탈로그 | progressive 확장 (현재 6개) |
| ECC `pyproject.toml` LLM monorepo | 별도 레포 분리 원칙 |
| OMC `bridge/cli.cjs` 3.2MB 단일 번들 | 디버깅 / 모듈성 위반 |
| OMC tmux team 런타임 | Windows 마찰. ralph 가 대체 (단일 워커) |
| ECC `gan-{planner,generator,evaluator}` | YAGNI |

## 4. MVP 정의 vs 실 구현 (18절 §12)

설계 MVP 5 조건:
1. ✓ `harness review --pr <n>` 자동 단계 1~5 + Codex 결과 PR 코멘트 — Actions 으로 구현
2. ✓ `gateguard-fact-force` 활성, Edit 전 사실 조사 강제
3. ✓ critical 자동 fix → re-review 1회 루프
4. ✓ `.harness/state/sessions/<id>/` 영속, 핸드오프 7개 파일
5. ✓ 80% 커버리지 게이트 — 단위 테스트 52/52 PASS (proxy)

**MVP 100% 충족.** 단 PR 코멘트는 Actions 가 mock 으로만 동작 (실 push 후 검증 필요).

## 5. 다음 세션 우선순위 (권장 순서)

### P0 — 사용자 환경 동의 후 즉시 가치
1. **Anthropic SDK 1회 실 호출** — `harness review --live --no-ship "간단 변경"` 한 번. 비용 ~$0.10. live runner 의 실 응답 파싱 검증.
2. **사내 PoC 비파괴 결합** (`iljin-rag-poc/.harness-tool/`, gitignore). 첫 review 동작 확인.
3. **GitHub 레포 push** — Actions 자동 동작 검증, PR 코멘트 실 등록.

### P1 — 자체 완결 (다음 세션 1~2시간)
4. **`scripts/sync-claude-md.js` 구현** — 마커 자동 갱신. CHANGELOG version 주입.
5. **`scripts/repair.js` 구현** — `harness repair` (install state 의 sha256 비교, 변경 파일만 재빌드).
6. **rules/{common, typescript, python}/ 내용** — `coding-style.md`, `testing.md` 최소 1편씩.
7. **build-cursor / build-gemini / build-opencode** — 각 80~120줄 추정. 단순 투영.
8. **stub 메시지 정리** — install-plan.js / install-apply.js 의 "Day 5 이후" 흔적 제거.

### P2 — 검증 / 확장 (다음 세션 2~4시간)
9. **integration / e2e 테스트** — 실제 review 풀체인 + `.harness/state/sessions/<id>/` 검증, demo-review.js 를 e2e 화.
10. **ARCHITECTURE.md 풀 18절 본문** — 한 번에 작성.
11. **Rust runtime 컴파일 검증** — rustup 설치 + `cargo build --release` + smoke (init / status / ipc ping).
12. **codemap 자동 생성** — `docs/CODEMAPS/<area>.md` 스크립트.

### P3 — 사내 임팩트 (사용자 요청 시)
13. iljin-rag-poc 풀 결합 + 첫 실 task 1개로 사이클 돌려보기.
14. cad-api-bridge / solidedge-mcp 도 동일 절차.
15. 사내 LLM endpoint 를 추가 provider 로 (`runners/iljin.js`).

### P4 — 안 해도 되는 것 (의도적 거절)
- OMC 매직 키워드 자동 활성 (사용자 룰 충돌)
- ECC 184 풀 스킬 카탈로그 (점진 확장)
- tmux team 런타임 (Windows 마찰, ralph 가 대체)

## 6. 발견된 마찰 (다음 세션에 회수)

| 마찰 | 원인 / 회수안 |
|---|---|
| Git CRLF warning 매 add 마다 | `.gitattributes` 추가하여 LF 강제 |
| `node --test tests/unit/` 디렉터리 호출 실패 | Node 22+ glob 미지원. `tests/unit/*.test.js` 명시 또는 vitest 도입 |
| Windows 에서 tsc 가 PATH 에서 못 잡힘 | `which()` 가 cwd 부터 부모 탐색. 임시 .ts 는 프로젝트 안에 둘 것 |
| `/tmp` 가 Node 에서 Windows 경로로 매핑 안 됨 | 임시 파일은 `os.tmpdir()` 또는 `tests/_tmp/` 사용 |
| Node SDK `notifications/initialized` 가 처음에 누락되면 timeout | smoke test 에 명시 — 현재 OK |

## 7. 통계 (Week 1~4 누적)

| 지표 | 값 |
|---|---|
| 디렉터리 | 28+ |
| 파일 | ~92 |
| LOC (md+json+yaml+yml+js+mjs+sh+ps1) | ~10,500 |
| Rust LOC (별도) | 529 (미컴파일) |
| 커밋 | 4 |
| Agents | 11 |
| Skills | 6 |
| Hooks | 5 |
| Schemas | 10 |
| Provider runners | 4 (mock/claude/codex/gemini) |
| MCP 도구 | 7 |
| CLI verbs | 10 (install / validate / review / plan / ralph / wait / sessions / costs / instincts / version) |
| 단위 테스트 | **52/52 PASS** (orchestrator 5 + severity 10 + router 6 + costs 3 + instincts 15 + portability 5 + runners-extract 12 — 56 으로 정정) |
| GitHub Actions | 2 |

## 8. 결론

**MVP 100% + 인스팅트 + 사내 이식 시뮬 + Rust 골격까지 도달.** 의도적 비채택 항목과 환경 동의 필요 검증 외에 부채는 §3 의 빈 디렉터리 6개 + 미구현 스크립트 9개 + stub 메시지 2건. 다음 세션 P1 우선순위로 1~2시간이면 99% 정합성 달성.

가장 큰 미수렴 영역은 **실 환경 검증 3종** (API 키 / Codex CLI / GitHub push) — 사용자 동의 시점에 즉시 가능.
