# D-Day 발사 체크리스트

> 한 페이지. 게시 버튼 누르기 직전에 한 번 더 확인.

## 24시간 전

- [ ] `npx -y @ps-neko/nekowork verify-pr` 가 **새 디렉토리에서 정말 60초 안에 끝나는가?** (npm cache 미스 상태 가정)
- [ ] README 첫 줄을 **처음 읽는 사람**에게 보여줬을 때 "이 도구가 뭐 하는 거야?" 가 30초 안에 정확히 답되는가?
- [ ] `docs/demo/secret-fallback-walkthrough.md` 의 출력 발췌가 현재 버전 실제 출력과 일치하는가?
- [ ] GitHub repo About 섹션에 한 문장 정의 + topics (`ai-code-review`, `pr-review`, `secret-scanner` 등) 설정됐는가?
- [ ] Issue templates (`false-positive` / `false-negative` / `feedback`) 가 GitHub Issue 생성 페이지에서 정상 노출되는가?
- [ ] CI badge 가 green 인가?
- [ ] npm publish 가 끝났고 `npm view @ps-neko/nekowork` 가 최신 버전을 보여주는가?
- [ ] GitHub Action 이 Marketplace 에 등록됐는가? (또는 `Ps-Neko/NEKOWORK@main` 직접 참조도 동작하는가)

## 게시 직전 1시간

- [ ] 발사 후 **6시간은 댓글 응답에 할애 가능한 시간인가?** (HN 의 경우 첫 1-2시간이 front page 결정)
- [ ] 모바일에서 README 가 깨지지 않는가? (badges 정렬, 코드 블록 줄바꿈)
- [ ] **1:1 DM 발송 리스트 5-10명 준비됐는가?** (게시 직후 동시 발송 — 이게 가장 효과적)

## 게시 후 첫 24시간

- [ ] 모든 댓글에 24시간 안에 답글
- [ ] false positive / negative 리포트는 **그날 안에 fixture 시드로 추가 + 다음 alpha 버전에 반영 약속**
- [ ] tracking-dashboard 의 해당 Week 행 업데이트

## 발사 안 함 (brief boundary)

- ❌ 한 번에 여러 채널 동시 발사 (GeekNews + Show HN 동시) — 응답 분산 + 첫 인상 분할
- ❌ "이 rule 도 추가하면 더 흥미 끌까?" — brief 의사결정 기준: 기능 추가 < 마찰 제거
- ❌ 발사 직후 NEKOFORGE 부활 유혹 — "14단계 워크플로 흥미로워요" 답글은 "NEKOWORK 외부 채택 후 단계 단위 흡수 예정" 으로
- ❌ 자기채점 숫자 ("99% recall") 댓글 답변에 노출 — 대신 실제 잡힌 사례 1-2건 인용
