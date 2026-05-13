# NEKOWORK CLI UX 재설계 (draft v0)

> 작성: 2026-05-13
> 상태: **합의 전 시안**. 구현 계획 아님. 코드 변경 0.
> 시각 시안: `.tmp_ecc/cli-design/index.html` (로컬 임시, 미커밋)
> 다음 단계: 본 문서 승인 → 구현 계획(`writing-plans`).

## 개요

`scripts/cli.js` 1282줄에 30+ 개 동사가 단일 진입점에 모여 있다. 명령은 동작하지만 사용자 인지 부하가 큰 다섯 영역(C1~C5)에서 일관된 마찰이 보고됨. 본 문서는 그 다섯 영역을 한 묶음의 UX 원칙(6개)으로 정렬해 점진적으로 개선하는 디자인을 제시한다.

## 문제 정의 (C1~C5)

- **C1 첫 사용 / 온보딩** — `nekowork` 단독 입력 시 30+ 줄 도움말. 다음에 무엇을 할지 안내가 없다.
- **C2 풀 사이클 핸드오프** — `work` → `verify` → `ship` → `apply` 사이에 사용자가 세션 ID(`work-1778631431662`)를 직접 복사해 다음 명령에 붙여야 한다.
- **C3 플래그 일관성** — 같은 개념이 명령마다 다른 어휘로 표현됨: `--profile`/`--pack`/`--mode`/`--level`, `--secure`/`--fast`/`--strict-quality` 가 부울로 분산.
- **C4 에러·블록 회복** — `task is required.` / `blocked: HUMAN_GATE open` 같이 사유만 있고 "이제 뭘 해야 하는지" 안내가 없다.
- **C5 인터랙티브 부재** — 전부 비대화형. `nekowork` 단독 입력은 메뉴/위저드가 아니라 도움말.

## 디자인 원칙 (6)

1. **다음 행동 명시** — 사용자 마주하는 모든 출력의 끝에 `Next →` 블록. 다음 조치가 없는 종결 상태이면 명시적으로 "없음"이라고 적는다.
2. **축약 ID + prefix 매칭** — 세션 ID는 `work-2026-05-13-a3f7` 형태(날짜+4자). 호출 시 `--session a3f7` prefix만 일치하면 채택. 중복 시만 전체 ID 요구.
3. **플래그 어휘 1세트** — `--profile · --strict · --budget · --live` 4개로 통일. 기존 `--pack`/`--mode`/`--level`/`--secure`/`--fast`/`--strict-quality`는 12주 alias 유지 후 제거.
4. **에러도 3단 구조** — `✗`/`⚠` + 사유 + 다음 조치. JSON 모드(`--json`)는 색상·박스 끄고 머신 파싱용 그대로.
5. **인터랙티브는 옵트인** — `nekowork wizard` 명시 동사만 위저드 실행. 자동 띄우기 없음(사용자 룰 "확인 후 실행" 우선). 비-TTY 환경 자동 거절.
6. **색상은 5톤** — OK / WARN / ERR / HINT / DIM. `NO_COLOR` 환경 변수 및 비-TTY 자동 무색.

## 변경 사항

### C1 온보딩 (`nekowork` 단독 입력)

**Before** — 30+ 줄 도움말 한꺼번에 출력.

**After**
- 상태 한 줄: 버전, 프로젝트 경로, 설치 여부, 세션 수
- "처음이라면 →" 추천 3개 (`check` → `init` → `run "<task>"`)
- "자주 쓰는 흐름 →" 4단계 한 줄 + `run` 래퍼 + `sessions`
- 전체 도움말은 `nekowork help all`, 동사별은 `nekowork help <verb>`로 분리

### C2 풀 사이클 핸드오프

**Before** — `=== work === / session : work-1778631431662 / ...` 평문 키:값 7행, 다음 안내 없음.

**After**
- `✓ work 완료  round 1 · 2 files · 1.2s · ~$0.04` 한 줄 상태
- 사람 친화 세션 ID: `work-2026-05-13-a3f7`
- `Next →` 블록 (verify / report / gate status, 모두 `--session a3f7` prefix)
- task 인수는 `verify`/`ship`에서 생략 가능(세션이 이미 task 보유)

### C3 플래그 일관성

**Before** — 명령마다 다른 어휘.

**After** — 모든 동사가 동일 4축을 채택:

| 축 | 플래그 | 값 |
|---|---|---|
| 강조점 | `--profile` | `quality`(기본) / `security` / `product` |
| 엄격도 | `--strict` | 부울 (TDD/품질 강화) |
| 자율 예산 | `--budget` | 정수 (자동 라운드 수, `auto` 동사) |
| 실 제공자 | `--live` | 부울 (mock vs claude/codex/gemini auth) |

- 구 `--pack` → `--profile` alias (deprecate 경고)
- 구 `--mode`/`--level` → `--strict` + `--budget`로 의미 분리
- 구 `--secure`/`--fast`/`--strict-quality` → `--profile security` 또는 `--strict`로 흡수

### C4 에러·블록 회복

**Before**

```
task is required. Example: harness work "implement trading dashboard mockup"
blocked: HUMAN_GATE open
```

**After** — 3단 구조 통일:

```
✗ task 인수가 필요합니다.

  예시:
    nekowork work "BOM 출력 컬럼에 단가 추가"

  도움말: nekowork help work
```

```
⚠ HUMAN_GATE 가 열려 있어 ship 이 막힘.

  세션:   p2c-b2-fullcycle
  사유:   codex-reviewer flagged untested edge case in parser
  열린지: 14분 전

해결 방법 →
  nekowork gate status  --session p2c-b2
  nekowork gate approve --session p2c-b2 --reason "..."
  nekowork gate block   --session p2c-b2 --reason "..."
```

### C5 인터랙티브 (`nekowork wizard`)

**Before** — 부재.

**After** — 명시 동사 `wizard`:
1. "무엇을 하시겠어요?" — 풀 사이클 / ask / team / 설치진단 / 세션 목록
2. 작업 설명 입력
3. 프로필 선택 (`quality`/`security`/`product`)
4. `--live` 여부
5. **최종 실행될 명령을 보여주고** 승인 (`[Y/n/edit]`). `edit` 선택 시 명령줄로 떨어져 사용자가 손볼 수 있음 → **학습 효과**

비-TTY 환경(파이프, CI)에서는 wizard가 자동 비활성되고 일반 도움말로 폴백.

## 미정 항목 (Open Questions)

| ID | 항목 | 메모 |
|---|---|---|
| Q1 | 구 플래그 alias 유지 기간 | 가정: 12주. 0.1.x → 0.2.0에서 제거? |
| Q2 | `wizard`에 포함할 동사 범위 | 위 5개로 충분한지, `apply`까지 포함할지 |
| Q3 | 에러 메시지 i18n | 한국어 / 영어 양립 정책 (현재 영어 혼재) |
| Q4 | 사람 친화 ID 충돌 처리 | 같은 날 4자 prefix 충돌 시 5자 확장 규칙 |
| Q5 | 색상 토큰 정확한 hex | OK/WARN/ERR/HINT/DIM 5톤 최종 값 (목업은 GitHub 다크 팔레트 기반 임시값) |
| Q6 | `harness` alias 운명 | 별칭 영구 유지 vs 향후 deprecate |
| Q7 | 클립보드 자동 복사 | 세션 ID 자동 복사 기능 옵트인 환경 변수로 둘지 |
| Q8 | 구 `--mode`/`--level` 값 매핑표 | `--mode {auto,fast,safe,team,tdd,release}` 및 `--level {cautious,normal,aggressive}` 각 값이 새 플래그 조합(`--profile`/`--strict`/`--budget`)으로 어떻게 사상되는지 1:1 매핑 확정 — 구현 계획 단계 |

## 범위 밖 (Out of Scope)

- 시각 디자인의 색상·박스·로고 등 미적 요소 (영역 A) — 본 디자인은 UX/인터랙션만
- 정보 아키텍처 전면 개편(영역 B) — 도움말 분리(`help all`)는 본 디자인 일부지만, 동사 자체 재분류는 다른 라운드
- 출력 포맷·리포트 가독성(영역 D) — 별도 라운드
- 명령 동사 자체 추가/제거 — 본 라운드에서는 alias·플래그만 손봄

## 마이그레이션 정책

| 단계 | 시점 | 내용 |
|---|---|---|
| 0 | 본 스펙 승인 직후 | 구현 계획 작성 (`writing-plans`) |
| 1 | 0.1.x 패치 | After 출력 + alias 도입 + 구 플래그에 deprecate 경고 |
| 2 | +6주 | `wizard` 동사 도입 |
| 3 | +12주 → 0.2.0 | 구 플래그 제거. `harness` alias는 유지 결정 (Q6) |

## 참고

- 시각 시안: `.tmp_ecc/cli-design/index.html` (Before/After 5쌍 + 원칙 6 + 미정 5)
- 현행 도움말 캡처: 본 문서 작성 시 `node scripts/cli.js --help` 출력 기반
- 관련 기존 문서: `docs/CLI-STAGES.md`, `docs/NAMING.md`, `docs/QUICKSTART.md`

## Phase 1a 적용 후 실제 캡처 (참고)

> 본 섹션은 Phase 1a 구현 직후 자동 갱신본. 후속 Phase에서 동일 명령의 출력이 바뀌면 이 섹션도 갱신.

### `nekowork` (단독)

```text

  ● NEKOWORK 0.1.0-alpha.9
  project: D:\claude\harness-cli-ux-phase1a  ·  installed: yes  ·  sessions: 84

처음이라면 →
  1.  nekowork check          환경 진단 (30초)
  2.  nekowork init           프로필 설치 (1분)
  3.  nekowork run "<task>"    첫 풀 사이클 실행

자주 쓰는 흐름 →
  work → verify → ship → apply     사람·게이트 통과 풀 사이클
  run                              위 4단계 자동 래퍼
  sessions                         진행 중 / 완료 세션 목록

  전체 명령은  'nekowork help all'
  항목별은    'nekowork help <verb>'

```

### `nekowork work "doc capture demo"`

```text

  ✓ work 완료              round 1 · 2 files
  session  work-2026-05-13-8779
  diff     (none — 다음 단계에서 생성)
  codex    not run
  ship     not run

Next →
  nekowork verify --session 8779  Codex 검증 (필수)
  nekowork report --session 8779  evidence 미리 보기
  nekowork gate status --session 8779  HUMAN_GATE 확인

```

### `nekowork verify "doc capture demo" --session 8779`

```text

  ✓ verify 완료            round 1 · 1 files reviewed
  session  work-2026-05-13-8779
  codex    ok
  verdict  approve_with_fixes
  gate     clear

Next →
  nekowork ship --session 8779  ship 준비 확인
  nekowork report --session 8779  REPORT.md 생성
  nekowork gate status --session 8779  gate 상태

```

### `nekowork work` (인수 누락 에러)

```text
✗ task 인수가 필요합니다.

  예시:
    nekowork work "BOM 출력 컬럼에 단가 추가"
    nekowork work "타이틀바 다크모드"

  도움말: nekowork help work

```
