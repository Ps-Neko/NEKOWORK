// HARNESS Rust runtime — 영속 데몬, supervisor, IPC bridge.
// 동작:
//   - daemon  : 백그라운드 supervisor. wakeup.json 폴링, child 프로세스 spawn / heartbeat / kill.
//   - status  : 현재 세션 / pending wakeup / 자식 프로세스 상태 출력.
//   - ipc     : Node CLI 와 stdio JSON-RPC. routing trace / cost / instinct 기록 위임 가능.
//
// 의존: tokio (async), rusqlite (세션 SQLite — 컨텍스트와 무관 영속), sysinfo, clap.

use clap::{Parser, Subcommand};
use std::process::ExitCode;

mod ipc;
mod session;
mod supervisor;
mod observability;

#[derive(Parser, Debug)]
#[command(name = "harness-runtime", version, about = "HARNESS 영속 supervisor (Rust)")]
struct Cli {
    #[arg(long, env = "HARNESS_ROOT", default_value = ".")]
    root: String,

    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    /// 영속 데몬 시작.
    Daemon {
        #[arg(long, default_value_t = 10_000)]
        poll_ms: u64,

        #[arg(long)]
        foreground: bool,
    },
    /// 현재 상태 출력.
    Status,
    /// Node CLI 와 stdio JSON-RPC. 단일 요청 처리 후 종료.
    Ipc,
    /// 세션 SQLite 초기화 (idempotent).
    Init,
}

#[tokio::main]
async fn main() -> ExitCode {
    let cli = Cli::parse();
    observability::init();

    let root = std::path::PathBuf::from(&cli.root);
    let result = match cli.cmd {
        Cmd::Init => session::init(&root).await,
        Cmd::Status => observability::print_status(&root).await,
        Cmd::Ipc => ipc::run(&root).await,
        Cmd::Daemon { poll_ms, foreground } => supervisor::run(&root, poll_ms, foreground).await,
    };

    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            tracing::error!("{:?}", e);
            ExitCode::from(1)
        }
    }
}
