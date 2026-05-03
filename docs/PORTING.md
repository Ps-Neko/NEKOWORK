# PORTING — 사내 PoC에 HARNESS 이식하기

> 대상: 사내 프로젝트 (구체 디렉터리는 사용자 명시 시점에 지정).
> 목적: HARNESS 의 7단계 풀사이클 + 매니페스트 + 인스톨러를 30분 안에 사내 프로젝트에 결합.

## 0. 기본 가정

- 사내 프로젝트는 자체 코드 / 의존성을 가지고 있다. HARNESS 는 **개발 워크플로우 도구**로만 결합한다.
- 사내 프로젝트의 `CLAUDE.md` / `AGENTS.md` 가 이미 있으면 보존한다 (마커 영역만 자동 갱신).
- 사용자 환경에 글로벌 룰(`~/.claude/CLAUDE.md` 등) 이 있으면 그쪽 우선. 자동 push / 자동 키워드 활성은 디폴트 OFF.

## 1. 결합 방식 3가지

### A. Submodule (가장 단순, 격리 환경 권장)

```bash
cd <대상 프로젝트>
git submodule add <harness 저장소 URL> .harness-tool
echo ".harness-tool/" >> .gitignore   # tool 자체는 커밋 안 함
```

이후:
```bash
node .harness-tool/scripts/cli.js review "<task>"
```

### B. npm dep

```bash
npm i --save-dev @harness/cli
```

`package.json`:
```json
{
  "scripts": {
    "harness": "node node_modules/@harness/cli/scripts/cli.js"
  }
}
```

### C. 글로벌 설치

```bash
npm i -g @harness/cli
harness install --plan --profile research --harness claude
```

## 2. 첫 30분 절차

### Step 0 — 비파괴 preflight

대상 프로젝트를 건드리기 전에 dry-run 리포트를 먼저 본다.

```bash
node scripts/portability/simulate-port.js <대상 프로젝트> --profile research --verbose
```

이 명령은 파일을 쓰지 않는다. 예상 추가 파일, 기존 `CLAUDE.md` / `AGENTS.md` 보존 충돌, `.mcp.json` namespace 충돌, 기존 `.harness-tool` 결합 여부를 리포트한다.
`high` 충돌이 있으면 exit code 1 로 끝나므로 CI preflight 에도 사용할 수 있다.

### Step 1 — 프로필 선택

| PoC 유형 | 권장 프로필 | 이유 |
|---|---|---|
| RAG / 사내 검색 | research | Context7 / Exa 결합. codex-loop 옵션. |
| CAD / 자동화 | developer | COM / API 자동화. 일반 개발 + Codex 검증. |
| MCP 서버 | developer + security | 외부 입력 sanitization 중요. |

### Step 2 — 매니페스트 dry-run

선택 가능한 카탈로그부터 확인:

```bash
node .harness-tool/scripts/install-plan.js --list
```

```bash
node .harness-tool/scripts/install-plan.js \
  --profile research --harness claude \
  --json > harness-plan.json
```

산출 plan.json 검토. 사내 정책에 맞지 않는 컴포넌트가 있으면 **모듈 단위로 제외**하거나 사내 모듈로 오버라이드.
없는 target/module/component 이름은 plan 단계에서 실패하므로 이 목록을 먼저 기준으로 삼는다.

### Step 3 — 프로젝트 룰 오버라이드

`harness/rules/<project-id>/` 디렉터리 추가 (프로젝트별 컨벤션):

```
rules/<project-id>/
├── coding-style.md       # 컨벤션
├── security.md           # 보안 정책
└── data-handling.md      # 데이터 분류 / 마스킹
```

`agent.yaml` 의 modules 에 `rules-<project-id>` 추가, `manifests/install-modules.json` / `install-components.json` 에 매핑 추가.

### Step 4 — apply

```bash
node .harness-tool/scripts/install-apply.js --profile research
```

산출: 프로젝트 루트에 5 하네스 디렉터리 (`.claude/` · `.codex/` · `.cursor/` · `.gemini/` · `.opencode/`) + `.harness/install-state.json` 영속 (source/target sha256 기록).

특정 하네스만 필요하면:
```bash
node .harness-tool/scripts/install-apply.js --harness claude
```

### Step 5 — 첫 review (mock)

```bash
node .harness-tool/scripts/cli.js review \
  "첫 풀사이클 검증" --no-ship --session port-first
```

7개 핸드오프가 `.harness/state/sessions/port-first/handoffs/` 에 떨어지면 결합 OK.

## 3. 사내 PoC 별 주의사항

### CAD / 자동화 유형 PoC
- COM / 외부 시스템 호출은 사용자 룰 "확인 후 실행" 으로. `harness review --no-ship` 로 끝내고 실 호출은 사람이 트리거.
- 보안 디렉터리 자동 감지 패턴 확장은 `scripts/orchestrators/review.js` 의 `SENSITIVE_PATTERNS` 만 추가.

### MCP 서버 유형 PoC
- `bridge/mcp-server.js` 패턴 차용 가능. `severity_classify` / `route_decide` / `cost_record` 도구 추가 시 통합 거버넌스.
- `--secure` 디폴트 켜기: `harness review` alias 를 `--secure` 포함으로 정의.

## 4. CI/CD 결합

### 검증 한 줄 (어떤 CI 에든)

```bash
npm run lint && npm test && \
  node .harness-tool/scripts/repair.js --check && \
  node .harness-tool/scripts/sync-claude-md.js --check && \
  node .harness-tool/scripts/build-codemaps.js --check
```

### GitHub Actions

`harness/.github/workflows/harness-review.yml` 을 사내 프로젝트의 `.github/workflows/` 로 복사. 기본은 mock 풀사이클이다. self-hosted runner 에 Claude/Codex CLI 로그인 세션이 있거나, CI에서 `HARNESS_CLAUDE_RUNNER=sdk` + `ANTHROPIC_API_KEY` 를 명시 opt-in 한 경우에만 `--live` 를 켠다.

### 사내 GitLab / 기타

`scripts/cli.js review --no-ship --session "ci-${CI_JOB_ID}"` 한 줄로 어떤 CI 에든 결합 가능. 결과는 `.harness/state/sessions/<id>/handoffs/` 에 떨어지므로 아티팩트 업로드만 추가하면 PR 코멘트 / 알림과 동등한 효과.

## 5. 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| `harness install --plan` 이 schema 오류 | Ajv 2020-12 수입 (`ajv/dist/2020.js`). package.json 의존성 `ajv >= 8.17`. |
| Windows 에서 quality-gate 의 tsc 가 안 잡힘 | `node_modules/.bin/tsc.cmd` 가 PATH 에 없음 — `which()` 가 cwd 부터 부모로 탐색하므로 프로젝트 루트에서 호출. |
| MCP 게이트웨이 stdio 통신 timeout | `HARNESS_CODEX_TIMEOUT_S` 환경변수로 조정 (기본 180). |
| ralph 가 무한 반복 | `HARNESS_RALPH_MAX_ITER` 또는 `--max-iter` 강제. `HARNESS_DAILY_COST_CAP_USD` 로 비용 게이트. |

## 6. 버전 / 호환성

- HARNESS 0.0.2 (alpha): 인터페이스 변경 가능. CHANGELOG 확인.
- pin: 사내 PoC 는 SemVer 핀 (`@0.0.2` 등) 권장. `@latest` 금지 (RULES.md).
- 깨지는 변경은 `MAJOR` 증가 + CHANGELOG 의 BREAKING 섹션.

## 7. 결합 후 정합성 체크리스트

```bash
# 매니페스트 변경 후 매번
node .harness-tool/scripts/sync-claude-md.js   # 마커 영역 갱신
node .harness-tool/scripts/repair.js           # sha256 비교 + 누락 재빌드
node .harness-tool/scripts/build-codemaps.js   # docs/CODEMAPS 갱신
npm run lint                                   # 4 validator 통과
npm test                                       # unit + integration + e2e
```

CI 한 줄은 §4 참조.
