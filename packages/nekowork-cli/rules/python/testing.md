# python/testing — Python 테스트 룰

> [common/testing.md](../common/testing.md) 의 Python 확장.

## 1. 프레임워크

- 단위 / 통합: **pytest**.
- E2E: pytest + playwright (`pytest-playwright`) 또는 별도 시나리오 러너.
- 커버리지: **pytest-cov** (`coverage[toml]` 백엔드).

## 2. 파일 위치

- `tests/unit/test_<area>.py`.
- `tests/integration/test_<scenario>.py`.
- `tests/e2e/test_<flow>.py`.
- 픽스처: `tests/conftest.py` 또는 `tests/<area>/conftest.py`.

## 3. pytest 패턴

```python
import pytest
from harness.router import route

@pytest.mark.parametrize("severity, expected", [
    ("critical", "opus"),
    ("high", "sonnet"),
])
def test_route(severity, expected):
    assert route(severity=severity) == expected
```

- `@pytest.mark.parametrize` 로 테이블 케이스.
- `pytest.fixture` 로 setup, `yield` 로 teardown.

## 4. 모킹

- `pytest-mock` (`mocker` fixture) 또는 `unittest.mock`.
- 외부 의존만 mock. 자체 모듈은 실 구현.
- HTTP: `httpx_mock` / `responses`.
- DB: 통합 테스트는 실 DB (테스트 DB 격리). 단위 테스트는 repository 인터페이스 mock.

## 5. 비동기

```python
import pytest
import asyncio

@pytest.mark.asyncio
async def test_async_route():
    result = await route_async(severity="critical")
    assert result == "opus"
```

- `pytest-asyncio` 의 `mode = "auto"` 설정 권장 (`pyproject.toml`).

## 6. 픽스처 스코프

- `function` (기본): 매 테스트.
- `module`: 모듈 단위 (DB 연결 등 비싼 자원).
- `session`: 전체 세션 (잘 안 씀, 격리 위험).

## 7. 단언(assertion)

- pytest 의 plain `assert` 사용. `unittest` 스타일 `assertEqual` 불필요.
- `pytest.approx(x, rel=1e-6)` 로 부동소수.
- `with pytest.raises(MyError, match=r"..."):` 로 예외 검증.

## 8. 커버리지

```bash
pytest --cov=harness --cov-report=term-missing --cov-fail-under=80
```

- `pyproject.toml` 의 `[tool.coverage.run]` 으로 omit 설정.
- HTML 리포트는 `htmlcov/`, CI 아티팩트로.

## 9. CI 게이트

- `pytest -q` 가 PR 단계에서 통과.
- `mypy --strict` 추가 게이트.
- `ruff check` 린트 게이트.

## 10. 에이전트 지원

- TDD: `tdd-guide` (skills/tdd-workflow).
- Python 코드 리뷰: `python-reviewer` 에이전트 (글로벌 룰의 reviewer 매트릭스 참조).
