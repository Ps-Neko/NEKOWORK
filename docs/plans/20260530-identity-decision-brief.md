# Identity Decision Brief — NEKOWORK / NEKOFORGE

> ✅ **2026-05-25 결정 완료 (plan-ceo-review 조기 결정) — 5/30 재실행 불필요, nudge 루틴 무효**
> - **#1 본진/이름**: 해소 → **2제품 라인업**. NEKOWORK=라이트, NEKOFORGE=헤비, **둘 다 공개**(archive 없음).
> - **#2 포지셔닝**: "un-foolable gate" = 작업가설(두 제품 공통). 공개 확정·과대주장은 (d) 신호 후.
> - **#3 stage 서사**: 12-station = 공통 큰 그림. 제품별 실제 단계 수는 다름(라이트 짧게 / 헤비 14). 12↔9↔14 매핑은 헤비 공개 준비 때.
> - **#4 forge rename**: 안 바꿈 (nekoforge = 헤비 제품명으로 승격).
> - **#5 게이트통합 · #6 visualizer schema**: (d) 신호 후 defer.
> - **다음 한 수**: 라이트(NEKOWORK)부터 저부담 익명 채널 push → (d) 측정. 그 전엔 두 제품 동결.
> - **정리 과제(헤비 공개 때)**: monorepo `forge-engine` ↔ standalone `NEKOFORGE` 중복.
>
> Trigger: **2026-05-30** (defer 만료) · Authored: 2026-05-24 (Claude 종합)
> **결정 = 사용자. 본 문서 = 자료(decision support), 결정 아님.**
> 전체 안건 상세 = `nekoforge-defer-decision` 메모리. 본 브리프는 그 위에 2026-05-24 세션 데이터 + 한 가지 모순을 얹는다.

## 5/30 전체 안건 (defer 메모리 6건)
1. **본진/이름**: NEKOWORK ↔ NEKOFORGE
2. **포지셔닝**: "full factory / AI dev OS" ↔ "solo가 못 속이는 검증 게이트"  ← 이번 세션 집중
3. stage 서사 7/12/14 통일
4. forge-engine rename (이름은 1번의 *결과로*)
5. **게이트 통합: user-facing nekowork-cli(JS) → forge-engine(TS) 호출 vs 독립 유지**  ← 2번과 직결 (아래 ★)
6. visualizer schema drift (fixture inline → forge 정본 import) · 합리화봉쇄 이식 ROI

## 코드 현실
- monorepo: **NEKOWORK ← NEKOFORGE 통합(main)**, nekoforge = private 엔진. → 1번은 코드상 거의 기움(명시 확정만 보류).
- ★ **그러나 게이트가 2층으로 분열**(메모리 2026-05-24 실측): user-facing `nekowork start/build/auto` = JS `risk-classifier.js` + `verify.js` (verdict 어휘 ALLOW/BLOCK). 내가 강화한 **content-hash 결박 / audit-integrity = forge-engine(PASS/BLOCK)에만**. user-facing 경로는 forge-engine 게이트를 **미호출**(deps 0, spawn 0).

## 2026-05-24 세션 데이터 (→ 2번)
- 경쟁사 스타 실측 진짜(204k/190k/101k/35k) — 단 별 ≠ 목표(1.0 = 알파 5 + 30일 자가 + 7일 피드백).
- 해자 = "게이트 개념"이 아니라 **"속일 수 없는 verdict"**(content-hash/audit-integrity). 게이트 개념은 ECC 등이 스킬 하나로 복제.
- 코호트(The Assignment 5명) 전원 개인 → 승인자≠배포자, 거버넌스 수요 구조적 0.
- 라이브: `sample-pr-002`(audit-integrity moat 데모) 배포(PR #71).
- → 데이터는 2번을 **"solo un-foolable gate"** 쪽으로 민다.

## ★ 핵심 모순 (이 브리프의 제일 중요한 줄)
2번을 "solo un-foolable gate"로 정하면, 그 해자(content-hash/audit-integrity)는 **forge-engine에만 있고 npm `nekowork` 사용자가 받는 게이트엔 없다(5번 미해결).** 따라서:
- **2번 "un-foolable gate" 확정 = 5번 "게이트 통합" 사실상 강제** (안 하면 포지셔닝이 출고물보다 과대).
- `sample-pr-002` 데모는 forge-engine 메커니즘을 보임 → 컨셉/엔진엔 정직하나 `npx nekowork`가 *오늘* 주는 것과는 갭. sharp 메인테이너(AGUMON/Hugh)가 짚을 수 있는 지점 → push 메시지는 "엔진/접근"으로 framing(오늘의 CLI가 다 한다고 과대주장 금지).

**[2026-05-25 코드 실측 — ★ 검증: 양 user-facing 경로 모두 해자 미호출 + verdict 어휘 3분열]**
- 옛 경로(`start/build/auto`)뿐 아니라 **새 1.0 hero `verify-pr`도** forge-engine 해자(content-hash/audit-integrity) 미호출 — 정규식 5룰 + 체크 *availability* 감지뿐 (`scripts/orchestrators/verify-pr.js`, `lib/project-detector.js`). nekowork-cli/scripts 전체에 forge-engine 참조 0 · audit-integrity/content-hash 0. (`decision.js:56` `diff_hash`는 수동 기록 필드일 뿐, 불일치 차단 enforcement 아님)
- → 해자(enforcement)는 forge-engine(`utils/integrity.ts`, `core/gate/index.ts`)에만. **#5 게이트통합 대상 = 옛·새 표면 둘 다.**
- **verdict 어휘 3분열**(통합 시 선결): `verify-pr`=ALLOW/ALLOW_WITH_WARNINGS/NEEDS_HUMAN_REVIEW/BLOCK/INSUFFICIENT_EVIDENCE · `forge`=PASS/PASS_WITH_WARNINGS/…(verify-pr와 PASS↔ALLOW만 다름=거의 동일) · `session(decision.js)`=approved/needs_fixes/ship_ready/blocked/applied(완전 이질). → **통합 비용 비대칭**: verify-pr↔forge는 리네임 수준, session 경로는 어휘 재조정 필요.
- **정정(이전 "과대주장" 표현 교정)**: npm `package.json:4` description("Verifies … with Codex verification, Human Gate, and explicit apply")은 *거짓 광고 아님* — Codex검증/Human Gate/apply는 session 경로(`decision.js`: HUMAN_GATE marker·codex verdict·APPLIED_DIFF)에 실제 존재. 진짜 문제는 **hero가 verify-pr로 옮겨가 메타데이터가 옛 경로를 가리키는 정체성 불일치**. 어디에도 없는 건 해자뿐. (keywords `verified-autopilot`/`ai-development-runtime`도 같은 불일치)
- carry(next publish): description↔hero(verify-pr) 정합 · `verify-pr.js:6` 주석 stale(실제 5룰) · `evidence-manifest.json` artifacts 누락 + `input_source` 하드코딩.
- 출처: 2026-05-25 검증 세션 (verify-pr / project-detector / secret-fallback / cli / package.json / SCOPE-1.0 / decision.js / forge verdict.ts·integrity.ts 실측).

## 빈 칸 (현재 0)
- **(d) 신호 = 0** (push 보류 → 외부 수요 미측정). 2번 핵심 입력 부재.
- 외부 사용자 0 · 본인 14단계 실사용 1 사이클(얇음).
- ⚠️ 5/30이 원하는 데이터를 *보류한 push*가 만든다 (push 부담과 얽힘).

## 살아있는 비판 (defer 사유)
솔로 거수기화 · 적용 곡선 · 자기루프 · 외부 0명 · 테스트 밀도 역전(1/115 vs 1/56).

## 정직한 종합 *(결정 아님)*
- **1번**: NEKOWORK 본진 거의 답 → 확정만.
- **2번**: 데이터는 "un-foolable gate"를 가리키나 **둘 다 미해소** — (ⅰ) 외부 수요 미검증(push 보류), (ⅱ) 그 해자가 아직 user-facing에 없음(5번).
- → **2·5·push는 한 묶음**: "un-foolable gate" 포지셔닝 확정 = 게이트 통합 + (수요 검증 위한) push 를 함께 커밋하는 것.
- **5/30 선택지**: **A)** 묶음 확정(포지셔닝 + 5번 통합 착수; push 는 부담 해소 후) / **B)** push 없인 2번 미검증이니 defer 연장 (또는 push 저부담 진입 먼저).
- **3·4·6**은 1·2·5 확정 후 자동/종속.

## 출처
2026-05-24 세션 (경쟁 분석 → moat 재정의 → sample-pr-002 빌드·머지·라이브 → (d) 신호). 메모리: `nekoforge-defer-decision`(전체 안건), `nekoforge-full-factory`, `nekowork-moat-positioning`, `the-assignment-list`.
