# NEKOWORK

[English](README.md) | [한국어](README.ko.md)

**AI가 만든 코드 변경을 CI 단계에서 deterministic하게 검증하는 local-first 게이트.**

[![CI](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)
[![npm](https://img.shields.io/npm/v/@ps-neko/nekowork/alpha?color=cb3837&logo=npm)](https://www.npmjs.com/package/@ps-neko/nekowork)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Cursor, Claude Code, Codex 같은 AI 도구가 만든 diff를 받아 — 하드코딩 시크릿, 비활성화된 테스트·보안 검사, 자동 commit/push, 위험한 install 스크립트를 잡고 한 줄 verdict 와 사람이 읽는 `REPORT.md` 로 답합니다. **결정은 deterministic. LLM은 verdict에 투표하지 않습니다.** auto-commit, auto-push, auto-deploy 는 하지 않습니다 — 사람이 결정합니다.

## 60초 try

```bash
# git repo 안에서, AI 도구가 파일을 바꾼 직후:
npx -y @ps-neko/nekowork verify-pr
```

working-tree diff 를 스캔하고 `REPORT.md` + `.nekowork/decision.json` 을 만듭니다. `BLOCK` 이면 종료 코드 비-0 — CI 에 그대로 연결하면 fail 로 잡힙니다.

## 예시: 하드코딩 시크릿 fallback 이 잡힐 때

AI 가 환경 변수 fallback 을 남기면:

```diff
- const token = process.env.AUTH_TOKEN;
+ const token = process.env.AUTH_TOKEN || "dev-token-not-rotated";
```

```text
=== verify-pr ===
  verdict        : BLOCK
  reason         : Hardcoded secret fallback at src/auth.ts:42 (env-or-literal)
  risk_level     : CRITICAL
  apply_allowed  : false
```

## 무엇을 잡나

- 하드코딩 시크릿·API 키·PAT (AWS, Stripe, GitHub, Slack, Google, PEM 등)
- 비활성화된 테스트 (`it.skip`, `xit`, `pytest.mark.skip`), `@ts-nocheck`, file-wide `eslint-disable`
- 자동 commit/push/merge 시도 (`git push --force`, `auto-merge: true`, `spawnSync git push`)
- 위험한 install script (`curl | bash`, `postinstall`, git/tarball URL 의존성)
- 증거가 부족해 신뢰할 수 없는 변경

## NEKOWORK 가 아닌 것

- IDE 가 아닙니다.
- AI 코딩 에이전트가 아닙니다.
- 사람 없이 코드를 push 하는 자동화가 아닙니다.
- Cursor/Claude Code/Codex 대체가 아닙니다. 그 도구로 작성한 뒤 산출물을 NEKOWORK 에 통과시킵니다.

## Two verbs

| Verb | 역할 |
|---|---|
| `check` | 환경 점검 (Node 22+, git, repo 상태) |
| `verify-pr` | working-tree diff 스캔 → verdict + REPORT.md + .nekowork/decision.json |

## 요구사항

Node.js 22+, npm/npx, 최소 한 개 커밋이 있는 git 저장소.

## CI 통합 (5줄 복붙)

GitHub Actions:

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }
- uses: Ps-Neko/NEKOWORK@main
```

pre-commit:

```yaml
repos:
  - repo: https://github.com/Ps-Neko/NEKOWORK
    rev: main
    hooks:
      - id: nekowork-verify-pr
```

## 라이선스

MIT — [LICENSE](LICENSE) 참고.
