# Contributing to NEKOWORK

NEKOWORK 에 기여해주셔서 감사합니다. 외부 컨트리뷰터를 위한 가이드입니다.

> **English speakers**: PRs in English are welcome — clear technical communication beats language uniformity.

## 사전 조건

- Node.js 22+
- Git
- Bash (Windows: git-bash 또는 WSL2)

## 로컬 셋업

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git
cd NEKOWORK
pnpm install
pnpm -r run test
```

slim 패키지 단독 검증:

```bash
cd packages/nekowork
node --test tests/unit/*.test.js
node scripts/cli.js --version
node scripts/cli.js verify-pr --help
```

## 변경 흐름

1. issue 또는 토론 먼저 (큰 변경일 때).
2. branch: `feature/<name>` 또는 `fix/<name>`.
3. PR 본문: 변경 요약 + 테스트 계획 + 영향 범위.
4. CI 통과 확인.
5. severity HIGH 이상의 회귀 발견 시 reviewer 합의 후 머지.

## Rule / Fixture 추가 (외부 기여 환영 영역)

새 위험 패턴을 잡고 싶다면:

1. `packages/nekowork/scripts/lib/rules/<name>.js` 작성. `scanFileContent(file, content)`, `scanAddedLines(file, lines)`, `scanDiff(parsedDiff)` 시그니처를 따릅니다.
2. `packages/nekowork/tests/fixtures/<name>/manifest.json` 에 positive/negative 시드 추가. recall ≥ 0.90, CRITICAL FP rate ≤ 0.10 게이트.
3. `packages/nekowork/tests/unit/<name>.test.js` 단위 테스트 추가.
4. `node --test tests/unit/<name>.test.js` 로 단독 검증.

## 코드 스타일

- JavaScript ES2022, ESM (`"type": "module"`), 2-space indent.
- 줄 끝 `LF` (`.gitattributes` 강제).
- 주석: 한국어 / 영어 모두 환영.

## 커밋 메시지 형식

```
<type>: <description>

[body]
```

`type`: `feat | fix | refactor | docs | test | chore | perf | ci`

## 라이선스

MIT. [LICENSE](LICENSE) 참조. 컨트리뷰션은 동일 라이선스로 합쳐집니다.

## 행동 강령

기본적인 존중. 기술적 비평은 환영, 인신공격은 금지. 자세한 사항은 [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) 을 따릅니다.
