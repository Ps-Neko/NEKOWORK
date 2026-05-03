// HARNESS Rust runtime: persistent supervisor plus IPC bridge.
// Commands:
//   - daemon: poll wakeup.json and spawn a resumable child process.
//   - status: print active sessions, pending wakeups, and supervisor pid.
//   - ipc: handle one stdio JSON-RPC request for Node/Rust handoff.
//
// Dependencies: tokio, rusqlite, sysinfo, clap, tracing.

use clap::{Parser, Subcommand};
use std::process::ExitCode;

mod ipc;
mod observability;
mod session;
mod supervisor;

#[derive(Parser, Debug)]
#[command(
    name = "harness-runtime",
    version,
    about = "HARNESS persistent supervisor (Rust)"
)]
struct Cli {
    #[arg(long, env = "HARNESS_ROOT", default_value = ".")]
    root: String,

    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    /// Start the persistent supervisor.
    Daemon {
        #[arg(long, default_value_t = 10_000)]
        poll_ms: u64,

        #[arg(long)]
        foreground: bool,
    },
    /// Print current runtime status.
    Status,
    /// Handle one stdio JSON-RPC request, then exit.
    Ipc,
    /// Initialize the SQLite runtime database.
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
        Cmd::Daemon {
            poll_ms,
            foreground,
        } => supervisor::run(&root, poll_ms, foreground).await,
    };

    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            tracing::error!("{:?}", e);
            ExitCode::from(1)
        }
    }
}
