# PORTING — 사내 PoC에 HARNESS 이식하기

> 대상: `iljin-rag-poc`, `cad-api-bridge`, `solidedge-mcp` 등 사내 프로젝트.
> 목적: HARNESS 의 7단계 풀사이클 + 매니페스트 + 인스톨러를 30분 안에 사내 프로젝트에 결합.

## 0. 기본 가정

- 사내 프로젝트는 자체 코드 / 의존성을 가지고 있다. HARNESS 는 **개발 워크플로우 도구**로만 결합한다.
- 사내 프로젝트의 `CLAUDE.md` / `AGENTS.md` 가 이미 있으면 보존한다 (마커 영역만 자동 갱신).
- 사용자 글로벌 룰(`C:/Users/ILJIN/.claude/CLAUDE.md`) 우선이라 자동 push / 자동 키워드 활성은 OFF.

## 1. 결합 방식 3가지

### A. Submodule (가장 단순, 사내 격리 환경 권장)

```bash
cd D:/claude/iljin-rag-poc
git submodule add ../harness .harness-tool
echo ".harness-tool/" >> .gitignore   # tool 자체는 커밋 안 함
```

이후:
```bash
node .harness-tool/scripts/cli.js review "<task>"
```

### B. npm dep (사내 npm registry 가 있을 때)

```bash
npm i --save-dev @iljin/harness@0.0.x
```

`package.json`:
```json
{
  "scripts": {
    "harness": "node node_modules/@iljin/harness/scripts/cli.js"
  }
}
```

### C. 글로벌 설치 (개발자별)

```bash
npm i -g @iljin/harness
harness install --plan --profile research --harness claude
```

## 2. 첫 30분 절차

### Step 1 — 프로필 선택

| PoC | 권장 프로필 | 이유 |
|---|---|---|
| iljin-rag-poc | research | Context7 / Exa / 사내 RAG 결합. codex-loop 옵션. |
| cad-api-bridge | developer | AutoCAD COM 자동화. 일반 개발 + Codex 검증. |
| solidedge-mcp | developer + security | MCP 서버 자체. 외부 입력 sanitization 중요. |

### Step 2 — 매니페스트 dry-run

```bash
node .harness-tool/scripts/install-plan.js \
  --profile research --harness claude \
  --json > harness-plan.json
```

산출 plan.json 검토. 사내 정책에 맞지 않는 컴포넌트가 있으면 **모듈 단위로 제외**하거나 사내 모듈로 오버라이드.

### Step 3 — 사내 룰 오버라이드

`harness/rules/iljin/` (또는 프로젝트별 rules) 디렉터리 추가:

```
rules/iljin/
├── coding-style.md       # 사내 컨벤션
├── security.md           # 사내 보안 정책
└── data-handling.md      # 사내 데이터 분류 / 마스킹
```

`agent.yaml` 의 modules 에 `rules-iljin` 추가, `manifests/install-modules.json` / `install-components.json` 에 매핑 추가.

### Step 4 — apply

```bash
node .harness-tool/scripts/install-apply.js --profile research
```

산출: 프로젝트 루트에 `.claude/`, `.codex/` 빌드 + `.harness/install-state.json` 영속.

### Step 5 — 첫 review (mock)

```bash
node .harness-tool/scripts/cli.js review \
  "사내 첫 풀사이클 검증" --no-ship --session iljin-first
```

7개 핸드오프가 `.harness/state/sessions/iljin-first/handoffs/` 에 떨어지면 결합 OK.

## 3. 사내 PoC 별 주의사항

### iljin-rag-poc
- RAG 응답 검증을 `gateguard-fact-force` 와 결합. 응답 content 에 대한 importer / API 시그니처 확인을 hook 단계에서 강제.
- `agents/research.md` 의 provider 를 `gemini` → 사내 LLM 으로 교체 (frontmatter 의 `provider` 만 변경).

### cad-api-bridge
- AutoCAD COM 호출 / PDF 출력은 사용자 룰 "확인 후 실행" 으로. `harness review --no-ship` 로 끝내고 실 호출은 사람이 트리거.
- 보안 디렉터리 자동 감지 패턴에 `cad/` 또는 `autocad/` 추가하려면 `scripts/orchestrators/review.js` 의 `SENSITIVE_PATTERNS` 만 확장.

### solidedge-mcp
- MCP 서버 자체이므로 `bridge/mcp-server.js` 의 패턴 차용 가능. `severity_classify` / `route_decide` / `cost_record` 도구를 SE MCP 에 추가하면 통합 거버넌스.
- `--secure` 디폴트 켜기: `harness review` alias 를 `--secure` 포함으로 정의.

## 4. CI/CD 결합

### GitHub Actions

`harness/.github/workflows/harness-review.yml` 을 사내 프로젝트의 `.github/workflows/` 로 복사. 시크릿 `ANTHROPIC_API_KEY` 추가 시 `--live` 자동 활성. 없으면 mock 으로 풀사이클만 검증.

### 사내 GitLab / 기타

`scripts/cli.js review --no-ship --session "ci-${CI_JOB_ID}"` 한 줄로 어떤 CI 에든 결합 가능.

## 5. 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| `harness install --plan` 이 schema 오류 | Ajv 2020-12 수입 (`ajv/dist/2020.js`). package.json 의존성 `ajv >= 8.17`. |
| Windows 에서 quality-gate 의 tsc 가 안 잡힘 | `node_modules/.bin/tsc.cmd` 가 PATH 에 없음 — `which()` 가 cwd 부터 부모로 탐색하므로 프로젝트 루트에서 호출. |
| MCP 게이트웨이 stdio 통신 timeout | `HARNESS_CODEX_TIMEOUT_S` 환경변수로 조정 (기본 180). |
| ralph 가 무한 반복 | `HARNESS_RALPH_MAX_ITER` 또는 `--max-iter` 강제. `HARNESS_DAILY_COST_CAP_USD` 로 비용 게이트. |

## 6. 버전 / 호환성

- HARNESS 0.0.x (alpha): 인터페이스 변경 가능. CHANGELOG 확인.
- pin: 사내 PoC 는 SemVer 핀 (`@0.0.x`) 권장. `@latest` 금지 (RULES.md).
- 깨지는 변경은 `MAJOR` 증가 + CHANGELOG 의 BREAKING 섹션.
