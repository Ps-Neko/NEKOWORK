# Tracking dashboard — NEKOWORK pivot 3개월

> brief 점수판 = **"3개월 후 외부 사용자 5명 + star 30~50"**.
> 매주 일요일 23:59 KST 에 1행 추가 (수동).

## Weekly snapshot

| Week | Date | npm dl (7d) | GH star | GH watcher | issue 오픈 | issue 응답 mean | PR 오픈 | 외부 사용자 (확인) | 비고 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 0 | YYYY-MM-DD | — | — | — | — | — | — | — | launch 직전 baseline |
| 1 | YYYY-MM-DD | — | — | — | — | — | — | — | GeekNews 게시 |
| 2 | YYYY-MM-DD | — | — | — | — | — | — | — | Show HN 게시 |
| 3 | YYYY-MM-DD | — | — | — | — | — | — | — | |
| 4 | YYYY-MM-DD | — | — | — | — | — | — | — | 1개월 점검 |
| 5 | YYYY-MM-DD | — | — | — | — | — | — | — | |
| 6 | YYYY-MM-DD | — | — | — | — | — | — | — | |
| 7 | YYYY-MM-DD | — | — | — | — | — | — | — | |
| 8 | YYYY-MM-DD | — | — | — | — | — | — | — | 2개월 점검 |
| 9 | YYYY-MM-DD | — | — | — | — | — | — | — | |
| 10 | YYYY-MM-DD | — | — | — | — | — | — | — | |
| 11 | YYYY-MM-DD | — | — | — | — | — | — | — | |
| 12 | YYYY-MM-DD | — | — | — | — | — | — | — | |
| 13 | YYYY-MM-DD | — | — | — | — | — | — | — | **3개월 점수 확정** |

## 수집 방법

- **npm dl (7d)**: `npm view @ps-neko/nekowork` → `dist-tags` 옆 weekly downloads 또는 https://npm-stat.com/charts.html?package=%40ps-neko%2Fnekowork
- **GH star / watcher**: repo 페이지 우상단 카운터
- **issue 오픈**: `gh issue list --state open --json number | jq length`
- **issue 응답 mean**: `gh issue list --state closed --json createdAt,closedAt --limit 100` → (closedAt - createdAt) 평균
- **외부 사용자 (확인)**: false-positive / false-negative / feedback issue 를 연 unique handle 수 (메인테이너 본인 제외)

## 판정 (Week 13)

3개월 점수판:

| 결과 | 신호 | 다음 행동 |
|---|---|---|
| ✅ 외부 사용자 5명 + star 30 이상 | **1.0 진입 신호** | 좁힘 유지, brief boundary 강화, 1.0 release plan |
| ⚠️ 외부 사용자 0~2명 + star <10 | **wedge 가 약함** | README 첫 문장이 진짜 1줄로 이해되는지 외부 사람에게 다시 듣기. brief boundary "리빌드 금지" 유지 |
| ❌ star 많은데 외부 사용자 0 | **흥미는 끌었으나 실사용 마찰** | 60초 try 가 진짜 60초인지 측정 + 마찰 제거 (Cursor 통합 등) |

## 결정 기록

> week 별로 관찰·결정 1줄씩 추가.

- (e.g. Week 1: GeekNews 댓글에서 X 패턴 요청 → fixture 시드로 추가, v0.2.1 publish)
