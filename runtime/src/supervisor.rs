// 영속 supervisor.
// 책임:
//   - .harness/state/sessions/<id>/wakeup.json 폴링 (poll_ms 간격)
//   - 발견 시 Node CLI (`harness review` 또는 `harness ralph`) 를 자식 프로세스로 spawn
//   - heartbeat: 자식 프로세스 health 모니터링, 죽으면 sysinfo 로 좀비 정리
//   - HUMAN_GATE 또는 done 마커 발견 시 active 제거
//
// foreground=true 면 stdout 로그, false 면 백그라운드 (Windows 는 detach 가 까다로워 fg 로 시작).

use anyhow::Result;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::time::sleep;

pub async fn run(root: &Path, poll_ms: u64, foreground: bool) -> Result<()> {
    tracing::info!("supervisor 시작: root={}, poll_ms={}, fg={}", root.display(), poll_ms, foreground);
    let pidfile = root.join(".harness").join("runtime.pid");
    std::fs::create_dir_all(pidfile.parent().unwrap())?;
    std::fs::write(&pidfile, format!("{}", std::process::id()))?;

    // SIGTERM / Ctrl+C 핸들러
    let shutdown = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    {
        let s = shutdown.clone();
        ctrlc::set_handler(move || s.store(true, std::sync::atomic::Ordering::Relaxed))
            .ok();
    }

    let conn = crate::session::open(root)?;
    crate::session::record_audit(&conn, None, "supervisor.start", "{}")?;

    while !shutdown.load(std::sync::atomic::Ordering::Relaxed) {
        if let Err(e) = tick(root, &conn).await {
            tracing::warn!("tick 실패: {:?}", e);
        }
        sleep(Duration::from_millis(poll_ms)).await;
    }

    let _ = std::fs::remove_file(&pidfile);
    tracing::info!("supervisor 종료");
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

async fn process_session(root: &Path, sd: &Path, session_id: &str, conn: &rusqlite::Connection) -> Result<()> {
    let active = sd.join("active");
    let wakeup = sd.join("wakeup.json");
    let gate = sd.join("HUMAN_GATE");

    if gate.exists() {
        // 사람 게이트는 supervisor 가 절대 무시하지 않는다.
        if wakeup.exists() {
            let _ = std::fs::remove_file(&wakeup);
            tracing::info!("[{}] HUMAN_GATE 존재 — wakeup 무시 / 정리", session_id);
        }
        return Ok(());
    }
    if !active.exists() {
        // active 없음 = ralph 종료. wakeup 있으면 정리.
        if wakeup.exists() {
            let _ = std::fs::remove_file(&wakeup);
        }
        return Ok(());
    }
    if !wakeup.exists() {
        return Ok(());
    }

    tracing::info!("[{}] wakeup 발견 → 재개 시도", session_id);
    crate::session::record_audit(conn, Some(session_id), "wakeup.detected", "{}")?;

    // 재개 spawn — Node CLI 호출.
    let node = which_node().unwrap_or_else(|| "node".to_string());
    let cli = root.join("scripts").join("cli.js");
    let mut cmd = tokio::process::Command::new(node);
    cmd.arg(cli)
        .arg("ralph")
        .arg("--task").arg("(supervisor 자동 재개)")
        .arg("--max-iter").arg("1")
        .arg("--session").arg(format!("{}-resume", session_id))
        .current_dir(root)
        .env("HARNESS_ROOT", root);

    match cmd.spawn() {
        Ok(mut child) => {
            tracing::info!("[{}] spawn OK pid={:?}", session_id, child.id());
            // wakeup 정리 (자식이 후속 wakeup 을 다시 만들 수 있음)
            let _ = std::fs::remove_file(&wakeup);
            // 비동기 wait
            tokio::spawn(async move {
                if let Ok(status) = child.wait().await {
                    tracing::info!("자식 종료 status={:?}", status);
                }
            });
        }
        Err(e) => {
            tracing::warn!("[{}] spawn 실패: {:?}", session_id, e);
            crate::session::record_audit(conn, Some(session_id), "wakeup.spawn_failed", &format!("{{\"err\":\"{}\"}}", e))?;
        }
    }
    Ok(())
}

fn which_node() -> Option<String> {
    use sysinfo::System;
    // 단순: PATH 에서 node / node.exe 찾기.
    let exe_name = if cfg!(target_os = "windows") { "node.exe" } else { "node" };
    let path_env = std::env::var("PATH").unwrap_or_default();
    for dir in std::env::split_paths(&path_env) {
        let candidate = dir.join(exe_name);
        if candidate.exists() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }
    let _ = System::new(); // sysinfo 사용 보존 (좀비 정리 추후 확장)
    None
}

#[allow(dead_code)]
fn _unused_pathbuf_marker() -> PathBuf { PathBuf::new() }
