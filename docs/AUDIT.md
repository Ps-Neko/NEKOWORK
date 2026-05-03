# AUDIT — Week 1~4 통합 검토

> 최초 작성: 2026-04-29 (Week 1~4 마감)
> 갱신: 2026-04-29 P1 회수 세션 (`docs/dev-log/2026-04-29-week1-4.md` 의 "P1 회수" 절 참조)
> 목적: 18절 설계 문서 / MVP 정의 / 8계층 아키텍처 vs 실 구현 매핑. 빠진 항목 · 부채 · 다음 세션 우선순위.

## 1. 18절 설계 문서 매핑

| 절 | 항목 | 상태 | 위치 / 비고 |
|---|---|---|---|
| 1 | Executive Summary | OK | `README.md`, `docs/CHANGELOG.md` |
| 2 | 레퍼런스 역설계 요약 | OK | `docs/ARCHITECTURE.md` 풀 18절 본문 작성 (528 줄) |
| 3 | 통합 아키텍처 개요 | OK | ARCHITECTURE §3 ASCII 다이어그램 + §4 8계층 매트릭스 |
| 4 | 계층별 컴포넌트 설계 | OK | (아래 §2 매트릭스 참조) |
| 5 | 데이터/컨텍스트 흐름 | OK | review.js 풀체인 동작, routing.jsonl, costs.jsonl |
| 6 | Agent 라우팅 전략 | OK | `scripts/lib/router.js` + Stage Routing 표 |
| 7 | Skill/Hook/Rule 구조 | OK | hook 5, rule 디렉터리 8 파일 (common 3 + ts 3 + py 2) |
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
| 4 Skill & Rule | OK | 6/6 skill + 거버넌스 4 + ralph. **rule 디렉터리 8 파일** (common 3 + ts 3 + py 2) |
| 5 Memory & Learning | OK | session(prd/handoffs/notepad/round) + project-memory(stub) + instincts (record/list/promote/prune/ready) |
| 6 Verification | OK | quality-gate ✓, self-review ✓, codex-review ✓, codex-challenge ✓, fix-loop ✓, severity matrix ✓, human gate ✓ |
| 7 Security & Governance | 부분 | gateguard / config-protection / audit jsonl / MCP 핀 / sandbox 프로파일 ✓. **OIDC / dead-man switch / supply chain 스캔 미구현** |
| 8 Integration | OK | 5/5 builder (claude / codex / cursor / gemini / opencode), GH Actions ✓, MCP 단일 게이트웨이 ✓ |

## 3. 빠진 항목 / 부채 (구체)

### 3.1 빈 디렉터리 (placeholder) — **2026-04-29 P1 회수 세션에서 모두 채움**
```
docs/CODEMAPS/         ✓ build-codemaps.js 생성기 + 9 영역 자동 산출
rules/common/          ✓ coding-style / testing / security
rules/typescript/      ✓ coding-style / testing / security
rules/python/          ✓ coding-style / testing
tests/e2e/             ✓ review-cycle.test.js (7 케이스)
tests/integration/     ✓ build-pipeline.test.js (10 케이스)
```

### 3.2 package.json 에 명시됐지만 미구현 스크립트 — **2026-04-29 P1 회수 세션에서 모두 구현**
| 스크립트 | 상태 | 비고 |
|---|---|---|
| `scripts/ci/validate-agents.js` | ✓ | ajv + frontmatter 검증 + 카탈로그 정합 |
| `scripts/ci/validate-skills.js` | ✓ | 동일 |
| `scripts/ci/validate-hooks.js` | ✓ | hooks.json schema + 스크립트 존재 검증 |
| `scripts/ci/validate-manifests.js` | ✓ | 4 schema + 그래프 무결성 |
| `scripts/build-cursor.js` | ✓ | `.cursor/rules/*.mdc` + camelCase 이벤트 |
| `scripts/build-gemini.js` | ✓ | summary GEMINI.md + settings.json |
| `scripts/build-opencode.js` | ✓ | 단일 config.json |
| `scripts/sync-claude-md.js` | ✓ | 마커 자동 갱신 + version 주입 + --check |
| `scripts/repair.js` | ✓ | install-state sha256 비교 + 변경분 재빌드 |
| `scripts/build-codemaps.js` | ✓ | (보너스) 디렉터리 트리 + export 추출 |

### 3.3 외부 의존 검증 컴포넌트
| 항목 | 이유 | 변경 |
|---|---|---|
| Claude CLI live 호출 | OK | 2026-05-03 Claude Code CLI 2.1.126, `npm run verify:claude` PASS |
| Codex CLI live 호출 | OK | 2026-05-03 codex-cli 0.128.0, `npm run verify:codex` PASS |
| Gemini CLI live 호출 | OK | 2026-05-03 Gemini CLI 0.40.1, `npm run verify:gemini` PASS |
| Rust runtime 컴파일 | OK | 2026-05-03 `npm run verify:runtime` PASS: cargo auto-discovery, build/test/clippy/help/init/status/ipc |
| GitHub OAuth 상태 | OK | 2026-05-03 keychain token valid for Ps-Neko. scope: `gist read:org repo`; workflow 파일 변경 시 `workflow` scope refresh 필요 |
| GitHub Actions 실 동작 | OK | PR #18~#24 기준 validate/review checks PASS |
| npm publish 결정 | OK | 명시 공개 릴리스 요청 전까지 `private: true` 유지 |
| 사내 PoC preflight | OK | 2026-05-03 `simulate-port` dry-run 강화 + `--project-root` 기반 portable execution/install 준비. 실제 결합은 선택한 대상 프로젝트에 `.harness-tool/` 결합 후 수행 |
| ~~install-apply 의 sha256 placeholder~~ | ~~Day 4 stub~~ | **2026-04-29 회수**: source_sha256 + targets[].sha256 모두 실값 |

### 3.4 stub 메시지 흔적 — **2026-04-29 회수**
- `scripts/cli.js`, `bridge/mcp-server.js`, `hooks/scripts/pre-bash-dispatcher.js`, `scripts/daemon/wait.js`, `scripts/orchestrators/ralph.js`, `scripts/ci/catalog.js` — "Day N" 흔적 모두 정리.
- `package.json`: `lint` / `test` 가 실 명령으로 매핑 (catalog + validate:all / unit+integration+e2e 테스트 러닝).

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
5. ✓ 테스트 게이트 — unit / integration / e2e suite 를 `npm test` 로 실행

**MVP 100% 충족.** 단 PR 코멘트는 Actions 가 mock 으로만 동작 (실 push 후 검증 필요).

## 5. 다음 세션 우선순위 (권장 순서)

> 2026-04-29 P1 회수 세션 후 갱신. P1 / P2(부분) 완료, 잔존은 외부 의존이 큰 항목들.

### P0 — 사용자 환경 동의 후 즉시 가치
1. ~~**Claude/Codex/Gemini CLI live smoke** — delegated local CLI auth 로 provider smoke 완료.~~ 2026-05-03 완료.
2. **사내 PoC 비파괴 결합** — preflight는 `simulate-port <target> --profile research --verbose` 로 준비 완료. `--project-root` 로 HARNESS 설치 루트와 대상 프로젝트 루트를 분리했으므로 다음 단계는 선택한 프로젝트에 `.harness-tool/` 결합 후 `install-apply` 와 첫 review 동작 확인. (메모리 등록된 두 디렉터리는 제외).
3. **GitHub workflow scope refresh** — workflow 파일을 로컬에서 수정해야 할 때만 `gh auth refresh -s workflow` 또는 HARNESS OAuth App workflow scope 재승인.

### P1 — 자체 완결 — **2026-04-29 모두 완료**
- ~~sync-claude-md~~ ✓
- ~~repair~~ ✓
- ~~rules 콘텐츠~~ ✓
- ~~build-cursor / gemini / opencode~~ ✓
- ~~validate-* 4개~~ ✓
- ~~ARCHITECTURE 18절 풀 본문~~ ✓
- ~~stub 메시지 정리~~ ✓
- ~~install-apply sha256 실값화~~ ✓
- ~~integration / e2e 테스트~~ ✓
- ~~codemap 자동 생성~~ ✓

### P2 — 검증 / 확장 (외부 의존)
1. ~~**Rust runtime 컴파일 검증** — rustup 설치 + `cargo build --release` + smoke (init / status / ipc ping).~~ 완료.
2. ~~**Codex CLI / Gemini CLI live 검증** — 바이너리 설치 후 단독 smoke 1회.~~ 2026-05-03 완료.
3. ~~**GitHub Actions 실 동작** — push 후 PR validate/review 검증.~~ PR #18~#23에서 완료.
4. ~~**npm publish 결정** — `private: true` 유지 vs 공개.~~ 명시 공개 릴리스 요청 전까지 `private: true` 유지.

### P3 — 사내 임팩트 (사용자 요청 시)
1. 사용자 명시 사내 프로젝트에 풀 결합 + 첫 실 task 1개로 사이클.
2. 추가 사내 프로젝트 동일 절차.
3. 사내 LLM endpoint 를 추가 provider 로 (`runners/internal.js`).
4. 사내 GitLab / 기타 CI 가이드 (`.gitlab-ci.yml` 예시).

### P4 — 안 해도 되는 것 (의도적 거절)
- OMC 매직 키워드 자동 활성 (사용자 룰 충돌)
- ECC 184 풀 스킬 카탈로그 (점진 확장)
- tmux team 런타임 (Windows 마찰, ralph 가 대체)
- ECC `pyproject.toml` LLM monorepo (별도 레포 분리)
- OMC `bridge/cli.cjs` 3.2MB 단일 번들 (디버깅 / 모듈성)

## 6. 발견된 마찰 (다음 세션에 회수)

| 마찰 | 원인 / 회수안 |
|---|---|
| Git CRLF warning 매 add 마다 | `.gitattributes` 추가하여 LF 강제 |
| `node --test tests/unit/` 디렉터리 호출 실패 | Node 22+ glob 미지원. `tests/unit/*.test.js` 명시 |
| Windows 에서 tsc 가 PATH 에서 못 잡힘 | `which()` 가 cwd 부터 부모 탐색. 임시 .ts 는 프로젝트 안에 둘 것 |
| `/tmp` 가 Node 에서 Windows 경로로 매핑 안 됨 | 임시 파일은 `os.tmpdir()` 또는 `tests/_tmp/` 사용 |
| Node SDK `notifications/initialized` 가 처음에 누락되면 timeout | smoke test 에 명시 — 현재 OK |

## 7. 통계 (Week 1~4 누적)

| 지표 | 값 |
|---|---|
| 디렉터리 | 28+ |
| 파일 | ~92 |
| LOC (md+json+yaml+yml+js+mjs+sh+ps1) | ~10,500 |
| Rust LOC (별도) | 529+ (컴파일 및 smoke 검증 완료) |
| 커밋 | 4 |
| Agents | 11 |
| Skills | 6 |
| Hooks | 5 |
| Schemas | 10 |
| Provider runners | 4 (mock/claude/codex/gemini) |
| MCP 도구 | 7 |
| CLI verbs | 10 (install / validate / review / plan / ralph / wait / sessions / costs / instincts / version) |
| 단위 테스트 | `npm run test:unit` PASS (auth guard / core runner utils / git mutation guard / runner wrapper / codex/gemini prompt normalization / live fallback guard / token vault 등) |
| 통합 테스트 | `npm run test:integration` PASS (build pipeline + state 영속 + repair detection + sync-claude-md + codemaps + validate:all + check-markers) |
| E2E 테스트 | `npm run test:e2e` PASS (demo-review 7단계 + 5필드 무결성 + --secure + round 카운터 + CLI version/help) |
| 전체 테스트 | `npm test` PASS |
| GitHub Actions | 2 |

## 8. 결론

**MVP 100% + 인스팅트 + 사내 이식 시뮬 + Rust 골격 + P1 회수 완료.**

2026-04-29 P1 회수 세션 결과:
- 빈 디렉터리 6개 → 0개
- 미구현 스크립트 9개 → 0개 (보너스 build-codemaps 1개 추가)
- stub 메시지 흔적 → 정리
- install-apply sha256 placeholder → 실값
- 테스트 suite 확장 (unit + integration + e2e)
- local-first auth 포팅 + provider mutation guard 후 `npm test` PASS
- ARCHITECTURE 풀 18절 본문 528줄

잔존 부채는 **npm publish 결정** + **사내 임팩트 (사용자 명시 시점)** + **OIDC / dead-man / supply-chain 심화**다. 자체 완결 가능한 영역은 실사용 가능한 수준까지 정합성 도달.
