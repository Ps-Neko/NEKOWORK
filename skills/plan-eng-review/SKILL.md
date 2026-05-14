---
name: plan-eng-review
description: "엔지니어링 매니저 모드 계획 리뷰. 아키텍처 / 데이터 흐름 / 엣지 케이스 / 테스트 / 성능."
origin: harness-core
level: 2
prerequisites: []
conflicts: []
tags: [planning, review]
---

# plan-eng-review

planner / architect 가 산출한 PRD 와 단계 분해를 락인 직전에 한 번 더 본다. 구현 시작 전에 잡을 수 있는 아키텍처 이슈를 잡는다.

## 호출

```bash
nekowork plan-eng-review <prd-path>
```

claude-led-codex-review 단계 2 의 일부로 자동 호출된다.

## 체크리스트

### 아키텍처
- [ ] 모듈 경계 / 책임 명확
- [ ] 의존 방향 (DI, 인터페이스 분리)
- [ ] 결합도 / 응집도

### 데이터 흐름
- [ ] 입력 / 출력 / 부수 효과 표
- [ ] 트랜잭션 경계
- [ ] 롤백 / 복구

### 엣지 케이스
- [ ] null / empty / 음수 / 매우 큰 값
- [ ] 동시성 / race condition
- [ ] 부분 실패 (외부 API timeout, 네트워크 끊김)

### 테스트 커버리지
- [ ] 단위 / 통합 / E2E 분배
- [ ] 80% 게이트
- [ ] 회귀 케이스

### 성능
- [ ] N+1 / 메모리 / 알고리즘 복잡도
- [ ] 벤치 기준선

## 출력

체크리스트 채워진 마크다운 + 발견 이슈 (severity 분류). 이슈는 PRD 에 다시 반영 (acceptance criteria 추가 또는 비목표 명시).
