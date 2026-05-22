// Persistent supervisor.
// Responsibilities:
//   - Poll .harness/state/sessions/<id>/wakeup.json.
//   - Spawn a Node CLI resume attempt when a wakeup is found.
//   - Ignore and clean wakeups for sessions stopped at HUMAN_GATE.

use anyhow::Result;
use std::path::Path;
use std::time::Duration;
use tokio::time::sleep;

pub async fn run(root: &Path, poll_ms: u64, foreground: bool) -> Result<()> {
    tracing::info!(
        "supervisor start: root={}, poll_ms={}, foreground={}",
        root.display(),
        poll_ms,
        foreground
    );
    let pidfile = root.join(".harness").join("runtime.pid");
    if let Some(parent) = pidfile.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&pidfile, format!("{}", std::process::id()))?;

    let shutdown = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    {
        let s = shutdown.clone();
        ctrlc::set_handler(move || s.store(true, std::sync::atomic::Ordering::Relaxed)).ok();
    }

    let conn = crate::session::open(root)?;
    crate::session::record_audit(&conn, None, "supervisor.start", "{}")?;

    while !shutdown.load(std::sync::atomic::Ordering::Relaxed) {
        if let Err(e) = tick(root, &conn).await {
            tracing::warn!("tick failed: {:?}", e);
        }
        sleep(Duration::from_millis(poll_ms)).await;
    }

    let _ = std::fs::remove_file(&pidfile);
    tracing::info!("supervisor stop");
    Ok(())
}

async fn tick(root: &Path, conn: &rusqlite::Connection) -> Result<()> {
    let sessions_dir = root.join(".harness").join("state").join("sessions");
    if !sessions_dir.exists() {
        return Ok(());
    }
    for entry in std::fs::read_dir(&sessions_dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let sd = entry.path();
        let session_id = entry.file_name().into_string().unwrap_or_default();
        process_session(root, &sd, &session_id, conn).await?;
    }
    Ok(())
}

async fn process_session(
    root: &Path,
    sd: &Path,
    session_id: &str,
    conn: &rusqlite::Connection,
) -> Result<()> {
    let active = sd.join("active");
    let wakeup = sd.join("wakeup.json");
    let gate = sd.join("HUMAN_GATE");

    if gate.exists() {
        if wakeup.exists() {
            let _ = std::fs::remove_file(&wakeup);
            tracing::info!(
                "[{}] HUMAN_GATE exists; wakeup ignored and removed",
                session_id
            );
        }
        return Ok(());
    }
    if !active.exists() {
        if wakeup.exists() {
            let _ = std::fs::remove_file(&wakeup);
        }
        return Ok(());
    }
    if !wakeup.exists() {
        return Ok(());
    }

    tracing::info!("[{}] wakeup found; spawning resume attempt", session_id);
    crate::session::record_audit(conn, Some(session_id), "wakeup.detected", "{}")?;

    let node = which_node().unwrap_or_else(|| "node".to_string());
    let cli = root.join("scripts").join("cli.js");
    let mut cmd = tokio::process::Command::new(node);
    cmd.arg(cli)
        .arg("ralph")
        .arg("--task")
        .arg("(supervisor automatic resume)")
        .arg("--max-iter")
        .arg("1")
        .arg("--session")
        .arg(format!("{}-resume", session_id))
        .current_dir(root)
        .env("HARNESS_ROOT", root);

    match cmd.spawn() {
        Ok(mut child) => {
            tracing::info!("[{}] spawn OK pid={:?}", session_id, child.id());
            let _ = std::fs::remove_file(&wakeup);
            tokio::spawn(async move {
                if let Ok(status) = child.wait().await {
                    tracing::info!("child exited status={:?}", status);
                }
            });
        }
        Err(e) => {
            tracing::warn!("[{}] spawn failed: {:?}", session_id, e);
            let details = serde_json::json!({ "err": e.to_string() }).to_string();
            crate::session::record_audit(conn, Some(session_id), "wakeup.spawn_failed", &details)?;
        }
    }
    Ok(())
}

fn which_node() -> Option<String> {
    let exe_name = if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    };
    let path_env = std::env::var("PATH").unwrap_or_default();
    for dir in std::env::split_paths(&path_env) {
        let candidate = dir.join(exe_name);
        if candidate.exists() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }
    None
}
