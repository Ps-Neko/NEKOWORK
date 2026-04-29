# Contributing to HARNESS

HARNESS 에 기여해주셔서 감사합니다. 외부 컨트리뷰터를 위한 가이드입니다.

> **English speakers**: see [CONTRIBUTING section in README](./README.md) for a high-level overview. The detailed contribution flow below is currently in Korean. Pull requests written in English are welcome — we value clear technical communication over language uniformity.

## 시작하기

### 사전 조건

- Node.js 22+
- Git
- Bash (Windows: git-bash 또는 WSL2)

선택 사항:
- `tsc` (TypeScript) — quality-gate hook 의 .ts 파일 타입 체크용
- `ruff` / `mypy` — Python 파일 quality-gate
- Codex CLI / Gemini CLI — `--live` 모드 외부 LLM 워커 호출
- Rust toolchain (rustup) — `runtime/` Rust supervisor 빌드

### 로컬 셋업

```bash
git clone <repo>
cd harness
npm install
node scripts/install-plan.js --profile core --verbose
node --test tests/unit/*.test.js   # 56/56 PASS 여야 함
```

## 개발 워크플로우

이 프로젝트는 자기 자신을 개발할 때도 자기 자신의 풀사이클을 사용합니다 (dogfooding).

```bash
# 변경 후
node scripts/cli.js review "<변경 요약>" --no-ship --session dev-<짧은 ID>
node --test tests/unit/*.test.js
node scripts/ci/catalog.js
node scripts/ci/check-markers.js
```

## 코드 스타일

- TypeScript / JavaScript: 2-space, ES2022, ESM (`"type": "module"`)
- 줄 끝: `LF` (`.gitattributes` 강제)
- 주석: 한국어 / 영어 모두 환영. 명확성 우선.

## 커밋 / PR

### 커밋 메시지 형식

```
<type>: <description>

[body]
```

`type`: `feat | fix | refactor | docs | test | chore | perf | ci`

### Pull Request

1. issue 또는 토론 먼저 (큰 변경)
2. branch: `feature/<name>` 또는 `fix/<name>`
3. PR 본문: 변경 요약 + 테스트 계획 + 영향 범위
4. CI 통과 (`harness-validate`, `harness-review` workflow)
5. severity HIGH 이상 발견 시 reviewer 와 합의 후 머지

## Hook / Skill / Agent 추가

새 hook / skill / agent 를 추가하려면:

1. 정규 디렉터리에 파일 추가:
   - `agents/<name>.md` (frontmatter 필수)
   - `skills/<name>/SKILL.md` (frontmatter 필수)
   - `hooks/scripts/<name>.{js,mjs}` + `hooks/hooks.json` 항목
2. `manifests/install-components.json` 에 컴포넌트 추가
3. 관련 모듈에 추가 (`manifests/install-modules.json`)
4. `node scripts/ci/catalog.js` 통과 확인
5. 단위 테스트 추가 (가능하면)

자세한 schema:
- `schemas/agent.schema.json`
- `schemas/skill.schema.json`
- `schemas/hooks.schema.json`

## Provider Runner 추가

새 LLM provider 를 추가하려면 (예: Vertex AI, 사내 LLM):

1. `scripts/agents/runners/<name>.js` 작성. `run<Name>(args)` async 함수 export.
2. 입력 / 출력 컨벤션은 `mock.js` 참조.
3. `scripts/agents/dispatch.js` 의 `RUNNERS` 매트릭스에 등록.
4. `agents/<agent>.md` frontmatter 의 `provider` 에서 사용 가능.

## 라이선스

MIT. `LICENSE` 파일 참조. 컨트리뷰션은 동일 라이선스로 합쳐집니다.

## 행동 강령

기본적인 존중. 기술적 비평은 환영, 인신공격은 금지. 자세한 사항은 contributor covenant v2.1 (https://www.contributor-covenant.org/version/2/1/code_of_conduct/) 을 따릅니다.
