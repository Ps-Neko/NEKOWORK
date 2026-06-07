# NEKOWORK 1.0 Scope

> Status: Active alpha scope. 검증 게이트 정체성은 확정(locked). §5–§7 의 핵심 엔진(diff 파서,
> 11개 risk rule, 5종 verdict 결정 로직, `--run-checks` 검사 실행, `--comment-file` PR 코멘트)은
> **구현 완료** — `scripts/orchestrators/verify-pr.js` 에 출하 중이다. 룰 인벤토리와 최신 recall/FP
> 수치의 단일 출처(single source of truth)는 [BENCHMARK.md](./BENCHMARK.md) 다. 남은 1.0 작업은
> fixture corpus 확대 + recall/FP 게이트(§9) 달성 + Codex advisor 경로 연결이다. 초기 결정은
> 2026-05-15~16 전략 논의 산물이며, 구현 현황은 2026-06-07 코드 기준으로 갱신했다.
>
> **버전 표기 주의(two-version line):** 슬림 발행 패키지(`@ps-neko/nekowork@alpha`)는 `0.2.0-alpha.x`
> 라인이고, 소스 체크아웃 전용 헤비 하네스(`@ps-neko/nekowork-harness`)는 레포 버전 `0.1.0-alpha.12`
> 다. 이 문서의 옛 "alpha.12" 표기는 헤비 git-tag 기준이며, 슬림 사용자는 `0.2.0-alpha.x` 로 읽으면
> 된다. 자세한 두 버전 라인 설명은 [INTEGRATION.md](./INTEGRATION.md) 참조.

## 1. 결정 요약

NEKOWORK 1.0 은 **AI 가 만든 PR/diff 를 머지해도 되는지 판정하는 검증 게이트** 로 포지셔닝한다.
장기 비전 ("Verification-first AI development factory") 은 `docs/VISION.md` 에만 남기고, 1.0 의 README/CLI hero/마케팅에는 노출하지 않는다.

알파.10 의 wide surface (19개 명령) 는 **Phased Cut** 으로 좁힌다 — 1.0 에서는 hero 강등만, 실제 breaking 은 2.0.

```text
Don't merge AI code without verification.
AI 가 만든 코드, 검증 없이는 통과시키지 마세요.
```

## 2. Phased Cut 단계

### Phase 0 (0.1.x → 0.2.x, 즉시)
- `nekowork verify-pr` 신규 추가
- 기존 19개 명령 functional 유지
- README hero = check + verify-pr (1.0 front surface)
- Advanced/Legacy 는 `docs/ADVANCED.md` 로 강등 (functional)

### Phase 1 (0.3.x → 1.0)
- verify-pr 가 1.0 기준 (recall ≥ 0.90 / FP ≤ 0.10) 도달
- Advanced/Legacy 명령에 `[deprecated]` 마크
- CLI 실행 시 "removed in 2.0" 경고
- 기능은 동작

### Phase 2 (1.x → 2.0)
- Deprecated 명령 제거 또는 `@ps-neko/nekowork-legacy` 별도 패키지
- 1.x 는 verification family (verify-pr / verify-skill / verify-release) 만

## 3. 명령 운명 표

| 명령 | 현재 alpha.10 | Phase 0 | Phase 1 | Phase 2 |
|---|---|---|---|---|
| `verify-pr` | 없음 | **신규** hero | hero | hero |
| `check` | Beginner | hero | hero | hero |
| `start` | Beginner | docs/ADVANCED (legacy) | docs/ADVANCED (legacy) | removed |
| `report` | Beginner | compatibility (session: `report --session`) | compatibility | removed |
| `apply` | Beginner | compatibility (session, SHIP_READY + cleared gate) | compatibility | removed |
| `ask` | Advanced | docs/ADVANCED | deprecated | removed |
| `plan` | Advanced | docs/ADVANCED | deprecated | removed |
| `team` | Advanced | docs/ADVANCED | deprecated | removed |
| `work` | Advanced | docs/ADVANCED | deprecated | removed |
| `verify` (Codex-only) | Advanced | docs/ADVANCED | deprecated | removed |
| `gate status` | Advanced | docs/ADVANCED | retained | retained |
| `ship` | Advanced | docs/ADVANCED | deprecated | removed |
| `run` | Advanced | docs/ADVANCED | deprecated | removed |
| `build` | Advanced | docs/ADVANCED | deprecated | removed |
| `auto` | Advanced | docs/ADVANCED | deprecated | removed |
| `pr-prep` | Advanced | docs/ADVANCED | retained 또는 verify-pr 흡수 | retained |
| `review` | Legacy | docs/ADVANCED | deprecated | removed |
| `review-cycle` | Legacy | docs/ADVANCED | deprecated | removed |
| `self-review` | Legacy | docs/ADVANCED | deprecated | removed |
| `codex-review` | Legacy | docs/ADVANCED | deprecated | removed |
| `install --plan/--apply` | Setup | retained | retained | retained |
| `sessions` | Diagnostics | retained | retained | retained |
| `costs` | Diagnostics | retained | retained | retained |

## 4. 현재 코드 인벤토리 (헤비 레포 `0.1.0-alpha.12` / 슬림 `0.2.0-alpha.x` 기준)

### 재사용 가능 (verify-pr 의 토대)
- `scripts/lib/decision.js` (325줄) — decision.json writer/schema 성숙. session summary aggregate. 새 input source (diff finding) 만 추가하면 됨.
- `scripts/lib/severity.js` — finding severity 분류 (issue → critical/high/medium/low).
- `scripts/agents/runners/codex.js` — Codex 호출 파이프라인 (advisor 로 전환).
- `scripts/orchestrators/apply.js` (227줄) — patch apply, auto-push/commit 없음. 정책 일치.
- Human gate state machine (HUMAN_GATE / GATE_APPROVED / GATE_BLOCKED markers).
- `apply_allowed` gate 로직 (decision.js:60).

### 구현 완료 (헤비 레포 `0.1.0-alpha.12` / 슬림 `0.2.0-alpha.x`)
- **Diff 파서**: `scripts/lib/diff-parser.js` — working tree / staged / patch 파일 / range → 파일·라인 수준 분석.
- **11개 결정적 risk rule** (§6): `scripts/lib/rules/{secret-fallback,auto-apply-commit-push,hardcoded-credential,test-or-security-disable,package-lockfile-risk,eval-usage,insecure-tls,cors-wildcard,sql-injection,command-injection,ast-dataflow}.js`, `verify-pr.js` 의 `runRules()` 에서 일괄 실행. 룰별 recall/FP·corpus 출처(synthetic/OSS/live)의 단일 출처는 [BENCHMARK.md](./BENCHMARK.md). 10종은 정규식 패턴 매처이고, `ast-dataflow` 1종만 `acorn` 으로 AST 를 만들어 함수 간(inter-procedural, intra-module) taint 분석을 한다 — 그래서 슬림 패키지는 작고 잘 알려진 의존성 1개(`acorn`, JS 파서 — MIT, transitive 의존성 0)를 갖는다 (TS 는 Node 내장 type-stripping 으로 파싱, TS 의존성 없음).
- **`INSUFFICIENT_EVIDENCE` verdict**: `verify-pr.js` 의 5종 verdict 에 포함 (source 변경 + test 명령 없음 → INSUFFICIENT_EVIDENCE).
- **GitHub PR comment 출력**: `--comment-file` 옵션(`renderPrComment`) + `docs/examples/github-actions-verify-pr.yml`.
- **검사 감지(slim) vs. 실행(harness)**: 발행 슬림 패키지(`@ps-neko/nekowork`)는 test/lint/typecheck 명령의 **존재를 감지**해 verdict 에 반영하지만(소스 변경 + test 명령 없음 → INSUFFICIENT_EVIDENCE), 명령을 **실행하지는 않는다**. 실제 **검사 실행**(`--run-checks`, test/lint/typecheck, 격상-only — `scripts/lib/check-runner.js`)은 소스 체크아웃 전용 헤비 하네스(`@ps-neko/nekowork-harness`) 기능이다. 슬림 게이트에 `--run-checks` 를 넘기면 한 줄 경고를 출력하고(감지는 그대로, 실행만 미지원) 계속 진행한다.

### 남은 작업
- **Fixture corpus 확대**: §9 의 출처 정책 — supporting rule 3종 OSS positives < 30, live AI positives 4/30.
- **Codex advisor 경로 연결**: verify-pr 에 advisor 출력(`evidence/codex-advisor.md`) 미연결 (§5 참조).

### 정책 충돌 (verify-pr 에서 해결됨)
- legacy `verify` 명령은 `verify-summary.json.verdict` → `decision.json.verdict` 매핑에서 **Codex 가 verdict source** 였다 — "Codex 는 advisor only" 결정과 상충.
- **verify-pr 는 이 충돌이 없다**: verdict 는 전적으로 deterministic rule + 검사 결과에서 산출되고(`verify-pr.js` `deriveVerdict`), Codex 경로는 아직 미연결이다. legacy `verify` 명령의 동작은 그대로 둔다 (Phase 1 까지 호환).

## 5. verify-pr 의 동작

> **구현 상태 (2026-05-28 구현, 2026-06-05 재확인):** 검증 명령 실행은 옵트인 `--run-checks` 로 구현됨 (test/lint/typecheck; build/audit 는 v1 제외). 실행 결과는 격상-only — 검사 실패 시 ALLOW → NEEDS_HUMAN_REVIEW, 단독 BLOCK 없음. diff 가 빌드/테스트 스크립트를 변조했거나 CRITICAL finding 이 있으면 실행을 거부(skip)한다. Codex advisor 경로는 미연결.

```text
입력: working tree diff | patch file | --from-pr-url (Phase 1 이후)
  ↓
diff 수집 + project detector
  ↓
파일 분류 (source/test/docs/config/ci/security/dependency/...)
  ↓
risk rule 실행 (§6)
  ↓
검증 명령 실행 (npm test / lint / typecheck / audit)
  ↓
evidence/ 저장 (diff.patch, risk-findings.json, *.log, evidence-manifest.json)
  ↓
deterministic decision 산출 (§7)
  ↓
REPORT.md 렌더링
  ↓
(optional) GitHub PR comment markdown 출력
  ↓
(optional) Codex advisor 실행 후 evidence/codex-advisor.md 만 기록
```

## 6. Risk Rule (11종 — Killer 1 + Supporting 10)

> 룰별 recall/FP 와 corpus 출처(synthetic/OSS/live)의 **단일 출처는 [BENCHMARK.md](./BENCHMARK.md)** 다.
> 아래는 각 룰이 잡는 패턴의 설명이며, 숫자는 BENCHMARK.md 를 본다. 전체 11종:
> `secret-fallback`, `auto-apply-commit-push`, `hardcoded-credential`, `test-or-security-disable`,
> `package-lockfile-risk`, `eval-usage`, `insecure-tls`, `cors-wildcard`, `sql-injection`,
> `command-injection`, `ast-dataflow`. 앞의 10종은 정규식 패턴 매처이고, `ast-dataflow` 1종만
> AST/dataflow 분석(함수 간·intra-module taint)이다. 정직성 주의: `secret-fallback` 가 30개의 실제 OSS positive 로
> 가장 강하고, OSS-fixture merge 이후 더 최근 룰들(`eval-usage`·`insecure-tls`·`cors-wildcard`·
> `sql-injection`·`command-injection`·`ast-dataflow`)도 각각 **real OSS positive** 를 갖는다.
> `hardcoded-credential` 1종만 설계상 **synthetic fixture 만**이다 (윤리적 이유 — BENCHMARK.md 참조).
> 정확한 수치는 BENCHMARK.md 가 단일 출처다.

### Killer: Secret Fallback
- 잡아야 할 패턴:
  - `process.env.X || "literal"`
  - `process.env.X ?? "literal"`
  - `process.env.X ? process.env.X : "literal"`
  - `let key = process.env.X; if (!key) key = "literal"`
  - `config.apiKey || "literal"`
  - `config.fallback.key`
- 1.0 에서 잡지 않아도 되는 패턴: 동적 property access, 파일간 dataflow, 암호화 설정 로더.
- 목표: AI 가 자주 넣는 fallback 패턴 high recall.

### Supporting 1: Hardcoded Credential
- API key / token / password / private key 형태 문자열 탐지.
- 기본 판정: HIGH 또는 CRITICAL 후보, 문맥에 따라 BLOCK 또는 NEEDS_HUMAN_REVIEW.

### Supporting 2: Test Or Security Disable
- `it.skip` / `describe.skip` / `eslint-disable` 대량 추가 / `ts-ignore` 대량 추가 / CI 에서 test/lint/build 삭제 / `npm test` 스크립트 약화.
- "대량" 임계치: 단일 PR 에서 3건 이상 또는 기존 대비 +50% (실측 후 튜닝).

### Supporting 3: Auto Apply / Commit / Push
- `git commit` 자동 실행 / `git push` 자동 실행 / `auto-apply` / `auto-merge` / `--force` 추가 / `rm -rf` 추가.
- 정체성 직결 — 강하게 CRITICAL.

### Supporting 4: Package And Lockfile Risk
- `package.json` 변경, lockfile 변경, dependency 추가, script 변경, `postinstall`/`preinstall` 추가.
- dependency 추가 자체는 BLOCK 아님. postinstall/preinstall 추가는 HIGH. script 가 shell/network/git 실행하면 HIGH.

### Supporting 5: eval Usage
- `eval(...)`, `new Function(...)` 등 동적 코드 실행. OSS-fixture merge 이후 **real OSS positives** 보유 (정확한 수는 [BENCHMARK.md](./BENCHMARK.md)).

### Supporting 6: Insecure TLS
- `rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0` 등 TLS 검증 비활성화. **real OSS positives** 보유 (수치는 BENCHMARK.md).

### Supporting 7: CORS Wildcard
- credentialed 엔드포인트에서 `Access-Control-Allow-Origin: *`. **real OSS positives** 보유 (수치는 BENCHMARK.md).

### Supporting 8: SQL Injection (basic)
- 문자열 연결로 만든 SQL 쿼리 등 **기본 패턴만** 잡는다 (정규식 수준; data-flow/AST 분석 아님). **real OSS positives** 보유 (수치는 BENCHMARK.md). 대부분의 injection 클래스는 범위 밖 — BENCHMARK.md "## What is NOT covered" 참조.

### Supporting 9: Command Injection (basic)
- 사용자 입력을 셸로 흘리는 `exec`/`spawn` 류 **기본 패턴만**. **real OSS positives** 보유 (수치는 BENCHMARK.md). 함수 경계를 넘는 케이스는 범위 밖.

### Supporting 10: AST Dataflow (변수 매개 injection)
- 유일한 AST/dataflow 룰. `acorn` 으로 AST 를 만들고 **함수 간(inter-procedural, intra-module) taint 분석**으로, 정규식 룰이 놓치는 **변수 매개 / 문장 간 injection** 을 잡는다 — 예: `const q = "SELECT "+id; db.query(q)` 처럼 여러 문장에 걸쳐 조립된 SQL, 조각을 합쳐 만든 `eval`, 부분으로 짜맞춘 셸 명령, local helper 의 반환값·sink 별칭. **real OSS positives** 보유 (수치는 BENCHMARK.md). 보수적 설계: 한 파일 안에서 함수 경계는 넘지만 cross-file / whole-program dataflow 와 비-JS 언어는 범위 밖이다.

### 1.0 제외
- auth / authorization 우회 일반 탐지 (1.x)
- basic sql/command + `ast-dataflow`(함수 간·intra-module taint) 가 잡는 것 외 대부분의 injection 클래스 (cross-file / whole-program dataflow 필요 — 1.x)
- dangerous shell 범용 탐지 (1.x)
- CI/CD 보안 완화 범용 탐지 (1.x)
- prompt injection 탐지 (verify-skill, 1.x)
- skill hook 전용 탐지 (verify-skill, 1.x)
- release consistency 탐지 (verify-release, 1.x)

## 7. Decision Engine 정책

### Verdict 5종
```text
ALLOW
ALLOW_WITH_WARNINGS
NEEDS_HUMAN_REVIEW
BLOCK
INSUFFICIENT_EVIDENCE
```

### 현재 verdict 와의 매핑
| Plan | 현재 (`decision.json.verdict` + `status`) |
|---|---|
| ALLOW | `verdict=approved` & `gate=clear` |
| ALLOW_WITH_WARNINGS | `verdict=needs_fixes` & `gate=clear` |
| NEEDS_HUMAN_REVIEW | `status=human_gate` |
| BLOCK | `verdict=blocked` 또는 `status=gate_blocked` |
| INSUFFICIENT_EVIDENCE | verify-pr 에 **구현됨** (legacy 세션 엔진엔 없음) |

### 결정 룰
```text
CRITICAL finding (1개 이상)              → BLOCK
Secret Fallback CRITICAL                 → BLOCK
Auto Apply/Commit/Push CRITICAL          → BLOCK
HIGH finding                             → NEEDS_HUMAN_REVIEW (검사 결과가 등급을 낮추지 않음)
MEDIUM finding + 검증 성공               → ALLOW_WITH_WARNINGS
LOW finding 또는 finding 없음 + 검증 성공 → ALLOW
source 변경 + 테스트 명령 없음           → INSUFFICIENT_EVIDENCE
검사(test/lint/typecheck) 실패 (--run-checks) → NEEDS_HUMAN_REVIEW (단독 BLOCK 없음)
docs-only + finding 없음                  → ALLOW
dependency / script 변경                  → NEEDS_HUMAN_REVIEW
Codex advisor 출력                       → verdict 영향 없음
```

### 절대 원칙
- 증거 없음 = PASS 아님
- LLM 의견 = verdict 아님
- 테스트 없음 = PASS 아님 (`INSUFFICIENT_EVIDENCE`)

## 8. CI Exit Code 매핑

GitHub Actions 에서 verdict 5종이 어떻게 동작하는지 명시.

| Verdict | Exit code | 권장 CI 동작 |
|---|---|---|
| ALLOW | `0` | merge 가능 |
| ALLOW_WITH_WARNINGS | `0` | merge 가능, comment 만 |
| NEEDS_HUMAN_REVIEW | `1` | check fail + label `neko/needs-review` 부여 |
| INSUFFICIENT_EVIDENCE | `1` | check fail + label `neko/no-evidence` 부여 |
| BLOCK | `2` | check fail (강한 신호) |

`--ci-exit-soft` 플래그로 `NEEDS_HUMAN_REVIEW` / `INSUFFICIENT_EVIDENCE` 를 exit 0 으로 강제할 수 있음 (PR 자동 차단을 안 원하는 팀용).

## 9. Fixture 출처 정책

**Synthetic-only 는 금지.** 본인이 짠 룰을 본인이 짠 fixture 로 측정하면 recall 숫자가 의미 없음.

### 권장 출처 (positive)
1. **Real OSS scrape**: GitHub code search 로 `process.env.X || "...` 패턴 검색, popular repo (≥100 star) 에서 30+ 예시 수집.
2. **Live AI 생성**: Claude Code / Cursor / Codex 에게 실제 task (e.g. "add env-based API client") 시키고 생성된 diff 에서 fallback 패턴 추출.
3. 최후로 synthetic 보강 (전체 corpus 의 ≤30%).

### Negative corpus
- 정상적인 `process.env` 사용 (fallback 없음)
- 정상적인 config loader (검증된 fallback path)
- docs / test 변경
- 단순 lint fix

### 측정 게이트 (1.0 출시 전)
```text
Secret Fallback recall      ≥ 0.90
Secret Fallback FP rate     ≤ 0.10
전체 CRITICAL recall        ≥ 0.85
전체 FP rate                ≤ 0.15
```

## 10. `nekowork apply` 의 운명

현재: session 기반 compatibility 명령. `applyCycle` 이 stored .diff 를 workspace 에 적용. auto-commit/push 없음.

**Phase 0 결정: compatibility 유지 + 정책 명시.**
- **apply 는 1.0 front surface(hero) 가 아니다.** README hero 는 `check` 와 `verify-pr` 만이다.
- apply 는 session 기반 compatibility 명령 — 완료된 작업 사이클(SHIP_READY 마커 + cleared Human Gate) 이 필요하다. `decision.json.apply_allowed` 는 apply 트리거가 아니라 verify-pr 가 산출하는 정보성 verdict 필드다.
- `--force` 플래그 동작 확인 후 1.0 에서 정책 명문화 (없으면 추가, 있으면 경고 강화).
- auto-apply / auto-commit / auto-push 플래그 추가 금지.

Phase 1 에서 별도 검토: `apply` 가 verify-pr 와 어떻게 묶이는지. 현재는 session 기반인데 verify-pr 은 single-shot. 둘의 통합 방식 결정 필요.

## 11. 1.0 Non-goals (절대 금지)

```text
- verify-skill 출시 (1.x)
- verify-release 출시 (1.x)
- ask / spec / plan / build 의 hero 노출
- agent catalog 확장
- team runtime 마케팅
- auto-apply / auto-commit / auto-push
- LLM 이 verdict 를 결정하는 경로
- GitHub App (--comment-file 까지만)
```

## 12. 30일 빌드 순서 (제안)

> 구현 현황 (2026-06-07): 아래는 초기 제안 순서다. 항목 2–7 (diff 파서 → exit code 매핑) 은
> 헤비 레포 `0.1.0-alpha.12` / 슬림 `0.2.0-alpha.x` 기준 **구현 완료**, 항목 8–9 (internal benchmark /
> 외부 알파) 가 **진행 중** (벤치마크는 11룰 모두 게이트 통과, corpus 확대 잔존 — [BENCHMARK.md](./BENCHMARK.md)).

상세 day-by-day 는 별도 docs/ROADMAP-1.0.md 에 (향후 작성). 핵심 마일스톤:

1. Day 1: 이 문서 commit + README hero 교체 + docs/VISION.md 분리
2. Day 2-4: diff 파서 + project detector (`scripts/lib/diff-parser.js`, `scripts/lib/project-detector.js`)
3. Day 5-10: Secret Fallback killer rule + OSS fixture 수집
4. Day 11-14: Supporting rule 4종
5. Day 15-17: decision engine 에 `INSUFFICIENT_EVIDENCE` 추가, deterministic 경로 분리
6. Day 18-20: REPORT.md 렌더러 (Verdict / Reason / Merge Decision / Blocking Findings / Evidence / Checks / Human Review / Next Actions)
7. Day 21-23: `--comment-file` + GitHub Actions 예제 + exit code 매핑
8. Day 24-26: Internal benchmark (recall/FP 측정, 게이트 통과 확인)
9. Day 27-30: alpha.11 또는 beta.0 후보, 데모 3개 (Secret Fallback BLOCK / Auto-Push BLOCK / Docs-only ALLOW), 외부 알파 모집문

## 13. 결정 완료 (2026-05-16)

### 13.1 외부 알파 5명 모집 채널

**다중 채널 믹스.** 5명 채우는 게 목표가 아니라 각 채널에서 1명씩이라도 응답받는 게 신호.

```text
1. 직접 아는 사람 1-2명     — warm signal, 빠른 실측, 편향 있지만 디테일 풍부
2. r/cursor 또는 r/ClaudeAI — AI 코드 검증 메시지가 정확히 통하는 타겟
3. GeekNews (한국)           — 1-2명
4. HN Show 는 보류            — verify-pr recall 0.90 도달 전엔 비싼 한 발.
                              1.0 release 또는 verify-skill land-grab 시점에 사용.
```

### 13.2 Phase 1 timing 측정 — 이중 게이트

```text
Phase 0 → Phase 1 게이트 (deprecation 마크 시작):
  - 내부 fixture benchmark Secret Fallback recall ≥ 0.90, FP ≤ 0.10
  - CI 에 benchmark job 추가, 3일 연속 PASS
  → Advanced/Legacy 명령에 [deprecated] 마크 + 2.0 제거 경고 시작

Phase 1 → 1.0 release 게이트:
  - 위 조건 + 외부 알파 3/5 명 "다시 쓰겠다" 응답
  - CRITICAL 미탐 0건 (또는 수정 완료 후 재측정)
  → 1.0 release
```

내부 benchmark 는 신호가 빠르고, 외부 알파는 신호가 진짜. 둘 다 필요.

### 13.3 `start` 명령 — Phase 0 동안 독립 유지

**결정**: `start` 와 `verify-pr` 는 독립 명령. alias 로 묶지 않음.

- Phase 0: `verify-pr` 가 hero primary, `start` 는 docs/ADVANCED.md 로 강등.
- Phase 1: 실측 데이터 (어느 쪽이 사용되는지) 보고 alias 또는 deprecate 결정.

근거: `start` 는 ask/plan/work/verify orchestrator, `verify-pr` 는 diff single-shot. 동작이 다른데 alias 면 사용자 혼란.

### 13.4 `pr-prep` — 공존

**결정**: `pr-prep` 과 `verify-pr` 는 다른 문제를 푸므로 공존.

```text
pr-prep:   session 기반, work 산출물 → PR body markdown 작성
verify-pr: single-shot, diff → REPORT.md + decision.json + pr-comment.md
```

Phase 1 재검토 조건: `start/work` 가 deprecate 되어 `pr-prep` 의 입력원이 사라지면, 그때 `verify-pr --pr-body` 플래그로 흡수.
