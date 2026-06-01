# @ps-neko/nekowork

**AI가 만든 코드 변경을 CI 단계에서 deterministic하게 검증하는 local-first 게이트.**

AI가 100줄을 10초 만에 쓰는 시대 — `main`에 닿기 전 누가 그 100줄을 보는가?
`nekowork verify-pr`은 working-tree diff를 스캔해 하드코딩 시크릿, 비활성화된 테스트·보안 검사, 자동 commit/push 시도, 위험한 install 스크립트 등을 잡는다. 결과는 한 줄 verdict + 사람이 읽는 `REPORT.md`. **LLM은 verdict에 투표하지 않는다.** 결정은 deterministic.

## 60초 try

```bash
# git repo 안에서, AI 도구가 파일을 바꾼 직후:
npx -y @ps-neko/nekowork verify-pr
```

working-tree diff를 스캔하고 `REPORT.md` + `.nekowork/decision.json`을 만든다. verdict가 `BLOCK`이면 종료 코드 비-0 — CI에 그대로 연결하면 fail로 잡힌다.

## Example: 하드코딩 시크릿 fallback이 잡힐 때

AI가 환경 변수 fallback을 남기면:

```diff
- const token = process.env.AUTH_TOKEN;
+ const token = process.env.AUTH_TOKEN || "dev-token-not-rotated";
```

`nekowork verify-pr` 출력:

```text
=== verify-pr ===
  verdict        : BLOCK
  reason         : Hardcoded secret fallback at src/auth.ts:42 (env-or-literal)
  risk_level     : CRITICAL
  apply_allowed  : false
```

## Two verbs

| Verb | What it does |
|---|---|
| `check` | 환경 점검 (Node 22+, git, repo 상태) |
| `verify-pr` | working-tree diff 스캔 → verdict + REPORT.md + .nekowork/decision.json |

## How it works

1. AI 도구가 코드를 작성한다. `nekowork`는 코드를 쓰지 않는다.
2. `verify-pr`이 working-tree diff에 고정 rule set을 돌린다. 같은 diff면 항상 같은 verdict.
3. 증거는 `REPORT.md`에 그대로 남는다. `.nekowork/decision.json`은 머신 판독용.
4. 사람이 본다. 사람이 결정한다.
5. auto-commit, auto-push, auto-deploy는 절대 하지 않는다.

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

## License

MIT
