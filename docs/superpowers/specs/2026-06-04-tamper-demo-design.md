# tamper 데모 (`npm run demo:tamper`) 설계 — 결정성 · LLM 못이김

- Status: Approved design — 구현 대기 (writing-plans 전환 예정)
- Date: 2026-06-04
- Branch: (제안) `feat/demo-tamper` (base `main`)
- 관련: 현 hero "Claude said LGTM. NEKOWORK blocked." / `packages/nekowork-cli/docs/DEMO.md` / 해자 포지셔닝

## 1. 배경 / 문제

런칭 legibility 문제: 외부인이 3분 안에 NEKOWORK를 "그냥 린터 / secret scanner 아냐?"
로 과소평가한다 (Reddit r/cursor mod 삭제, r/ClaudeAI 2차 게시 등 실증). 해소책은
**서사 확장이 아니라** "속일 수 없음"을 눈으로 보이게 하는 것(좁은 검증게이트 웨지 유지).

코드 실측(Explore)으로 확정한 전제:

- NEKOWORK(JS)에는 **content-hash 사후조작 거부가 미구현**이다. `decision.js:56` 의
  `diff_hash` 는 기록만 되고 검증에 쓰이지 않으며, `apply` 는 `decision.json` 을 읽지도
  않는다(SHIP_READY 마커 기반). 따라서 "조작된 `decision.json` 을 apply 가 거부한다" 류
  데모는 **거짓이 되므로 만들지 않는다.** (그 하드닝은 NEKOFORGE(TS) 쪽 자산이다.)
- 대신 NEKOWORK가 *실제로* 가진 정직한 "못 속임" 두 가지를 데모한다:
  1. **결정성** — verdict 는 매 실행마다 diff 에서 재계산된다. 기록물(`REPORT.md` /
     `decision.json`)을 ALLOW 로 바꿔도 다시 돌리면 또 BLOCK. 게이트는 저장된 상태가
     아니라 diff 를 믿는다.
  2. **LLM 미판정** — 결정론 룰이 verdict 를 정한다. 선택적 Codex/Claude advisor 가
     LGTM 해도 verdict 는 BLOCK. (현 hero 메시지와 정합)
- 둘 다 100+ 테스트로 보장된 실제 동작이며 신규 코드 0 으로 재현 가능하다. 이 데모는
  그 두 성질을 **한 명령으로 진짜 실행**해 회의론자가 직접 재현하도록 만든다.

## 2. 목표 / 비목표

### 목표
- `npm run demo:tamper` 한 명령으로 격리된 임시 git repo 에서 **진짜 verify-pr** 실행.
- 1막 BLOCK → 2막 기록(`decision.json`) ALLOW 손조작 → 3막 재실행 → 또 BLOCK 을
  **실제 출력**으로 보인다.
- LLM 한 컷: advisor 가 LGTM 으로 표시돼도 verdict 는 BLOCK(결정론)임을 명시.
- 출력 트랜스크립트를 `docs/DEMO.md` 새 섹션 + README 링크 1개로 노출.
- 데모가 *실제로 그렇게 동작*함을 CI 테스트로 영구 보장.

### 비목표 (v1)
- `apply` / `decision` 경로의 `diff_hash` 결박 검증 구현 (미구현 — §6 별도 spec 후보).
  이 데모는 그 능력을 **주장하지 않는다.**
- 진짜 LLM(Codex/Claude) 호출 — illustrative(예시)만. API 없이 재현 가능해야 한다.
- visualizer 변경, README 본문 서사 확장.
- 사용자 실제 프로젝트 변경 (절대 — 격리 temp 만).

## 3. 정직성 불변식 (이 데모의 생명)

- **I1.** 3막의 BLOCK 은 **실제 재실행의 진짜 verdict / exit code**여야 한다.
  하드코딩 출력 금지 (안 그러면 "못 속인다"를 보이려고 우리가 속이는 자기모순).
- **I2.** "apply 가 조작된 `decision.json` 을 거부한다"고 **주장하지 않는다.** 주장은
  엄격히 "verdict 는 매 실행 재계산되고, 기록은 기록일 뿐"이다.
- **I3.** LLM 컷은 **명시적 illustrative**(가짜 API 호출 아님). "예시" 라벨을 단다.
- **I4.** 항상 격리 temp dir. 사용자 프로젝트는 절대 변경하지 않는다.
- **I5.** 데모 스크립트는 각 막의 기대 결과를 **assert** 하고, 어긋나면 비0 종료로
  시끄럽게 실패한다 (룰이 바뀌면 데모가 조용히 거짓말하지 않게).

## 4. 설계

### 4.1 컴포넌트
1. **`packages/nekowork-cli/scripts/demo-tamper.js`** (신설) — 기존 `demo-quick-run.js`
   / `demo-external-project.js` 와 같은 위치·패턴.
2. **`package.json` scripts** — `"demo:tamper": "node scripts/demo-tamper.js"`.
   옵션: `--cleanup`(기본 동작, temp 삭제), `--keep`(temp 보존+경로 출력), `--json`(요약).
3. **재사용(변경 없음)** — `scripts/orchestrators/verify-pr.js`(실제 실행 경로),
   `scripts/lib/rules/secret-fallback.js`, `printVerifyPrSummary`(verdict 카드).

### 4.2 흐름 (스크립트 단계)
```
0. 사전     : Node 22+ / git 확인. 없으면 친절 메시지 + 비0 종료.
1. 셋업     : os.tmpdir()/nekowork-tamper-demo-<pid> 에 git init + baseline commit
             (빈/안전한 src/auth.ts) → 그 위에 secret-fallback diff 작성:
                 export function getSecret() {
                   return process.env.JWT_SECRET || "dev-secret";
                 }
             working-tree diff 상태 (verify-pr 는 git repo + 1 commit 필요 — 충족).
2. 1막      : verify-pr 실행(mock provider, API 키 불필요).
             → verdict 카드 BLOCK / critical=1 출력, decision.json(BLOCK)+REPORT.md 생성.
             [assert] verdict === BLOCK, exitCode === 2.
3. 2막      : decision.json 을 verdict:"ALLOW", apply_allowed:true 로 스크립트가 손편집.
             "누군가 기록을 ALLOW 로 고쳤다" 안내 + 거짓 decision.json 발췌 출력.
             [assert] 파일에 "ALLOW" 가 실제로 쓰였음.
4. 3막      : verify-pr 재실행 → BLOCK. decision.json 재생성으로 ALLOW 가 덮어써짐.
             교훈: "기록을 고쳐도 소용없다 — verdict 는 diff 에서 재계산된다."
             [assert] 재실행 verdict === BLOCK, exitCode === 2, decision.json 다시 BLOCK.
5. LLM 컷   : illustrative advisor note(LGTM)를 나란히 두고 한 줄:
             "LLM advisor 가 LGTM 해도 결정론 룰이 결정한다 — LLM 은 verdict 를 통제하지 않는다."
6. 정리     : temp dir 삭제 (--keep 시 보존 + 경로 출력).
```

### 4.3 출력 (트랜스크립트)
- 사람이 읽기 좋은 단계 헤더(`=== 1막 … ===`) + verdict 카드 + 교훈 라인.
- `--json`(선택): 각 막의 `{ act, verdict, exitCode }` 요약 — 테스트/CI 소비용. v1 필수 아님.

### 4.4 노출
- **`packages/nekowork-cli/docs/DEMO.md`** — 새 섹션 "Tampering the verdict is futile
  (determinism)": 트랜스크립트 + "재현: `npm run demo:tamper`".
- **README (en/ko)** — 기존 "terminal transcript" 증거 줄에 **링크 1개만** 추가
  (본문/서사 확장 없음, 웨지 보호).

### 4.5 에러 처리 / cross-platform
- git 없음 / Node 낮음 → 친절 메시지 + 비0 종료.
- temp 생성/정리 실패 → 명확한 에러, 사용자 프로젝트 무변경 보장.
- Windows: `git init`/`commit`, 경로는 `path.join` 으로 os-agnostic. verify-pr 의 기존
  cross-platform 로직 재사용. temp 정리는 `fs.rm(recursive)`.
- assert 실패(룰 변경 등) → 비0 종료 + 무엇이 어긋났는지 출력.

## 5. 테스트 전략 (TDD, node:test)
- `packages/nekowork-cli/tests/…/demo-tamper.test.js` (레포 테스트 위치 관례):
  - 데모 스크립트를 temp 에서 실행 → 검증:
    - (a) 1막 verdict BLOCK · exit 2.
    - (b) 2막 조작 후 `decision.json` 에 `"ALLOW"` 가 실제로 존재.
    - (c) 3막 재실행 verdict BLOCK · exit 2 · `decision.json` 다시 BLOCK.
    - (d) `--cleanup` 후 temp dir 삭제됨.
  - **하드코딩 아님 보장**: 3막 BLOCK 이 *재실행이 산출한* `decision.json` 에서 옴을 확인
    (I1/I5 가드의 테스트화).
- `npm run validate:all` 무영향(스크립트/문서 변경, catalog 검증 무관). 단 테스트 게이트는
  통과해야(현 532 → +N).

## 6. 향후 (비목표 → 승격 후보)
- `apply` / `decision` 경로에 `diff_hash` 결박 검증 구현 → "조작된 `decision.json` 을
  apply 가 거부"를 *진짜로* 만들고 데모를 확장(별도 spec). NEKOFORGE 하드닝 포팅 후보.
- visualizer 에 재현 링크/실제 트랜스크립트 임베드(시뮬레이션 아님).

## 7. 확정 세부
- 스크립트 경로: `packages/nekowork-cli/scripts/demo-tamper.js`. npm script: `demo:tamper`.
- 시나리오 룰: secret-fallback `env-or-literal` (`process.env.JWT_SECRET || "dev-secret"`),
  critical → BLOCK → exit 2.
- 조작 대상: `.nekowork/decision.json` 의 `verdict` / `apply_allowed`. `REPORT.md` 는 선택.
- 격리: `os.tmpdir()` 하위, 기본 `--cleanup`.
- LLM 컷: illustrative(가짜 호출 아님), "예시" 라벨 명시.
