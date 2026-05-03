// Tracing setup and status output.

use anyhow::Result;
use std::path::Path;

pub fn init() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .with_writer(std::io::stderr)
        .init();
}

pub async fn print_status(root: &Path) -> Result<()> {
    let pidfile = root.join(".harness").join("runtime.pid");
    let pid = std::fs::read_to_string(&pidfile)
        .ok()
        .and_then(|s| s.trim().parse::<u32>().ok());
    println!("supervisor pid: {:?}", pid);

    let conn = crate::session::open(root)?;
    let active = crate::session::list_active(&conn)?;
    println!("active sessions ({}):", active.len());
    for id in &active {
        println!("  - {}", id);
    }

    let sessions_dir = root.join(".harness").join("state").join("sessions");
    let mut pending = 0usize;
    if sessions_dir.exists() {
        for e in std::fs::read_dir(&sessions_dir)? {
            let e = e?;
            if e.path().join("wakeup.json").exists() {
                pending += 1;
            }
        }
    }
    println!("pending wakeup: {}", pending);
    Ok(())
}
