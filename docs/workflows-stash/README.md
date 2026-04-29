# Workflows Stash

> 첫 push 당시 OAuth 토큰의 `workflow` 스코프 부족으로 `.github/workflows/` 가 reject 되어 임시 보관소.
> 정책상 본 디렉터리는 일시적이며, 토큰 갱신 또는 웹 UI 업로드 후 본 디렉터리는 삭제할 수 있다.

## 재 등록 절차 (택일)

### A. GitHub 웹 UI 업로드 (가장 단순)

1. https://github.com/Ps-Neko/NEKOWORK 접속
2. `Add file` → `Create new file`
3. 파일명: `.github/workflows/harness-review.yml`
4. 내용: 본 디렉터리의 `harness-review.yml` 그대로 복사 / 붙여넣기
5. Commit (직접 main 또는 PR)
6. `harness-validate.yml` 도 동일

### B. 토큰 갱신 후 push

```bash
gh auth refresh -s workflow             # 브라우저 동의 필요
mkdir -p .github/workflows
cp docs/workflows-stash/harness-review.yml .github/workflows/
cp docs/workflows-stash/harness-validate.yml .github/workflows/
git add .github/workflows/
git commit -m "ci: GitHub Actions 복원"
git push
```

## 무엇이 보관됐나

- `harness-review.yml` — PR 자동 7단계 + 핸드오프 PR 코멘트 + 아티팩트 업로드
- `harness-validate.yml` — push/PR 시 매니페스트 + 단위 테스트
