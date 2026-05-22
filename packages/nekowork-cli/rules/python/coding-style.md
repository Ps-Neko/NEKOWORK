# python/coding-style — Python 룰

> [common/coding-style.md](../common/coding-style.md) 의 Python 확장.

## 1. PEP 8 + 타입

- PEP 8 + PEP 484 (타입 힌트) 기본.
- 포매터: `ruff format` (이전 black). 라인 100자.
- 린터: `ruff check`. 추가로 `mypy --strict` 또는 `pyright`.

## 2. 타입 힌트

- 공개 함수·메서드는 인자·반환 타입 명시.
- `Any` 는 외부 데이터 진입점만, 즉시 narrow.
- `from __future__ import annotations` 로 forward reference 부담 제거.

```python
from __future__ import annotations

def format_user(user: User) -> str:
    return f"{user.first_name} {user.last_name}"
```

## 3. 데이터 모델

- 단순 값 묶음: `dataclass` (`frozen=True` 우선).
- 검증 + 직렬화 필요: `pydantic.BaseModel`.
- `Enum` 보다 `Literal["a", "b"]` 권장 (직렬화 단순).

## 4. 불변성

- `dataclass(frozen=True)` 또는 `tuple` / `frozenset`.
- 리스트 mutation 보다 컴프리헨션·`+` 로 새 객체.

```python
# 잘못됨
def add(items, x):
    items.append(x)
    return items

# 올바름
def add(items: list[int], x: int) -> list[int]:
    return [*items, x]
```

## 5. 에러 처리

- 도메인 에러 클래스 (`class NotFoundError(Exception): ...`).
- `except Exception:` 광범위 catch 금지. 좁게.
- `try/except/else/finally` 의 `else` 는 성공 경로 분리에 활용.
- 절대 `except: pass` 금지.

## 6. 컨텍스트 매니저

- 파일·DB·락 등 자원은 `with` 로. 수동 close 금지.
- 사용자 정의는 `contextlib.contextmanager` 또는 `__enter__/__exit__`.

## 7. 비동기

- `async def` + `await` 기본. blocking IO 는 `asyncio.to_thread`.
- 병렬: `asyncio.gather` (실패 전파) / `return_exceptions=True` (모아 처리).
- 사용 안 하는 동기 / 비동기 혼합 주의 — `nest_asyncio` 같은 hack 금지.

## 8. 입력 검증

- `pydantic.BaseModel` 으로 schema 검증.
- `parse_obj` / `model_validate` 의 ValidationError 를 catch 후 사용자 메시지로 변환.

## 9. 모듈 구조

- 패키지: 작은 모듈 다수.
- `__init__.py` 는 공개 API 만 re-export (`__all__` 명시).
- circular import 가 보이면 구조 재설계 (lazy import 회피책 X).

## 10. 도구 체인

- 의존성: `uv` (또는 pip + `requirements.txt` + `requirements-dev.txt`).
- 가상환경: `uv venv` / `python -m venv`.
- 테스트: `pytest`.
- 타입 체크: `mypy` (PR 게이트).
