# Identity Decision Brief — NEKOWORK / NEKOFORGE

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

**[2026-05-25 코드 실측 — ★ 모순 확대: 새 hero `verify-pr`도 동일]**
- `verify-pr`(README·자기 헤더가 칭한 1.0 hero) = 정규식 위험룰 5종 + 체크 *availability* 감지뿐. **content-hash·audit-integrity·Codex·Human Gate 전무** (`scripts/orchestrators/verify-pr.js`, `lib/project-detector.js` — execSync/spawn 0).
- → forge-engine 해자는 **옛(start/build/auto)·새(verify-pr) user-facing 표면 둘 다** 미호출 → #5 "게이트 통합" 대상에 verify-pr 포함.
- **과대주장 이미 출고**: `package.json:4` description = *"Verifies … with Codex verification, Human Gate, and explicit apply"* (verify-pr는 셋 다 안 함), keywords=`verified-autopilot`/`ai-development-runtime`. → ★의 "포지셔닝>출고물" 경고가 npm 메타데이터에 이미 현실.
- carry(next publish): description 사실화 · `verify-pr.js:6` 주석 stale(실제 5룰) · `evidence-manifest.json` artifacts 누락 + `input_source` 하드코딩.
- 출처: 2026-05-25 검증 세션 (verify-pr / project-detector / secret-fallback / cli / package.json / SCOPE-1.0 실측).

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
