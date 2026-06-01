# GeekNews 초안 — NEKOWORK

> 제목과 본문 초안. 실제 게시는 사람이 결정.

## 제목 (권장)

**[오픈소스] NEKOWORK — AI가 만든 코드 변경을 CI에서 60초 만에 검증하는 local-first 게이트**

(Alt: `Cursor·Claude Code·Codex가 만든 diff에서 하드코딩 시크릿을 잡는 deterministic gate`)

## 본문

AI 코딩 도구가 100줄을 10초 만에 씁니다. 그 100줄 중에 `const token = process.env.AUTH_TOKEN || "dev-token-not-rotated";` 같은 줄이 한 줄 섞여 있을 때 — 사람이 매번 다 읽지 않으면 그대로 `main`에 들어갑니다.

NEKOWORK은 verb 하나입니다.

```bash
npx -y @ps-neko/nekowork verify-pr
```

working-tree diff를 읽고, 고정 rule set을 돌리고, `REPORT.md` + 한 줄 verdict를 줍니다. **LLM은 verdict에 투표하지 않습니다.** 같은 diff면 항상 같은 결과.

### 지금 잡는 것

- 하드코딩 시크릿·API 키·PAT (AWS, Stripe, GitHub, Slack, Google, PEM 등)
- 비활성화된 테스트·보안 검사 (`it.skip`, `xit`, `pytest.mark.skip`, `@ts-nocheck`, file-wide `eslint-disable`)
- 자동 commit/push/merge 시도 (`git push --force`, `auto-merge: true`, `spawnSync git push`)
- 위험한 install script (`curl | bash`, `postinstall`, git/tarball URL 의존성)
- 증거가 부족해 신뢰할 수 없는 변경

commit·push·merge·deploy는 절대 하지 않습니다 — 결정은 사람이.

### CI 통합 (5줄 복붙)

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }
- uses: Ps-Neko/NEKOWORK@main
```

pre-commit hook 도 한 줄 entry.

### 제품 철학

- Local-first. SaaS 없음, telemetry 없음, 계정 없음.
- 좁은 게이트가 곧 제품. verb는 두 개 (`check`, `verify-pr`).
- AI가 코드를 쓰고, NEKOWORK이 위험 신호를 확인하고, 사람이 결정.

Repo: https://github.com/Ps-Neko/NEKOWORK · MIT

### 피드백 환영

- 실제 PR에서 잘 잡은 / 놓친 케이스
- verdict 출력이 PR 리뷰어에게 읽히는지
- 60초 try 경로가 실제로 60초 안에 끝나는지
