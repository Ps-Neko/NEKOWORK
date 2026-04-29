# HARNESS Rust runtime

> 영속 supervisor + IPC. Node CLI 의 `harness wait` 데몬을 보강하거나 대체.

## 빌드

```bash
# rustup 미설치 시 먼저:
#   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh    (Linux/Mac)
#   winget install Rustlang.Rustup                                   (Windows)
cargo build --release
```

산출: `target/release/harness-runtime` (Linux/Mac) 또는 `harness-runtime.exe` (Windows).

## 사용

```bash
# 1. 세션 SQLite 초기화 (idempotent)
./target/release/harness-runtime init

# 2. 영속 데몬 시작
./target/release/harness-runtime daemon --foreground --poll-ms 5000

# 3. 상태
./target/release/harness-runtime status

# 4. IPC (단일 요청)
echo '{"id":1,"method":"ping"}' | ./target/release/harness-runtime ipc
echo '{"id":2,"method":"session.upsert","params":{"id":"s1","mode":"review","task":"x"}}' | ./target/release/harness-runtime ipc
echo '{"id":3,"method":"session.list"}' | ./target/release/harness-runtime ipc
```

## 책임

- **session.rs**: SQLite (`.harness/runtime.sqlite`) — sessions / handoffs / audits 3 테이블. 컴팩션과 무관.
- **supervisor.rs**: `.harness/state/sessions/<id>/wakeup.json` 폴링 → `node scripts/cli.js ralph` 로 spawn → wait. HUMAN_GATE 시 즉시 무시.
- **ipc.rs**: stdio JSON-RPC, 단일 요청 처리. Node CLI 가 위임용으로 호출 가능.
- **observability.rs**: tracing + status 출력.

## Node 측 데몬과의 관계

- Node `scripts/daemon/wait.js` — JS 단순 폴링, 의존성 0, Node 22+ 어디서나.
- Rust `harness-runtime daemon` — SQLite 영속 + 정확한 supervisor + 좀비 정리. 사내 / 장기 운영용.

둘은 같은 디스크 영역(`.harness/state/sessions`, `.harness/state/sessions/*/wakeup.json`)을 공유한다.
**동시 실행 금지** — 한 머신에 한 데몬만 띄운다.

## 빌드 검증 미완료

이 디렉터리는 골격만 작성됐다. `cargo build` 컴파일 검증은 다음 세션 (rustup 설치 후) 으로 미룬다.
TypeScript / Node 측은 단위 테스트 50+ PASS 로 검증됨.
