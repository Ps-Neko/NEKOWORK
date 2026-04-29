// 세션 영속 SQLite. 컴팩션과 무관하게 살아남는 상태.
// 스키마:
//   sessions(id, started_at, mode, task, harness_root, status)
//   handoffs(session_id, stage, round, agent, verdict, payload_json, written_at)
//   audits(ts, session_id, event, details_json)

use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use std::path::{Path, PathBuf};

pub fn db_path(root: &Path) -> PathBuf {
    root.join(".harness").join("runtime.sqlite")
}

pub fn open(root: &Path) -> Result<Connection> {
    std::fs::create_dir_all(root.join(".harness"))
        .with_context(|| format!(".harness 디렉터리 생성 실패: {}", root.display()))?;
    let p = db_path(root);
    let conn = Connection::open(&p).with_context(|| format!("SQLite open 실패: {}", p.display()))?;
    conn.execute_batch(SCHEMA)?;
    Ok(conn)
}

pub async fn init(root: &Path) -> Result<()> {
    let conn = open(root)?;
    let p = db_path(root);
    println!("OK runtime.sqlite: {}", p.display());
    drop(conn);
    Ok(())
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  started_at    TEXT NOT NULL,
  mode          TEXT NOT NULL,            -- review | ralph | manual
  task          TEXT,
  harness_root  TEXT,
  status        TEXT NOT NULL DEFAULT 'active'   -- active | paused | done | gated
);

CREATE TABLE IF NOT EXISTS handoffs (
  session_id   TEXT NOT NULL,
  stage        TEXT NOT NULL,
  round        INTEGER NOT NULL DEFAULT 1,
  agent        TEXT,
  verdict      TEXT,
  payload_json TEXT,
  written_at   TEXT NOT NULL,
  PRIMARY KEY (session_id, stage, round)
);

CREATE TABLE IF NOT EXISTS audits (
  ts           TEXT NOT NULL,
  session_id   TEXT,
  event        TEXT NOT NULL,
  details_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_handoffs_session ON handoffs(session_id);
CREATE INDEX IF NOT EXISTS idx_audits_session   ON audits(session_id);
"#;

pub fn upsert_session(conn: &Connection, id: &str, mode: &str, task: Option<&str>, root: Option<&str>) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO sessions(id, started_at, mode, task, harness_root, status)
         VALUES (?1, ?2, ?3, ?4, ?5, 'active')
         ON CONFLICT(id) DO UPDATE SET task = excluded.task, harness_root = excluded.harness_root",
        params![id, now, mode, task, root],
    )?;
    Ok(())
}

pub fn record_handoff(
    conn: &Connection,
    session_id: &str,
    stage: &str,
    round: u32,
    agent: Option<&str>,
    verdict: Option<&str>,
    payload_json: &str,
) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO handoffs(session_id, stage, round, agent, verdict, payload_json, written_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(session_id, stage, round) DO UPDATE
            SET agent = excluded.agent, verdict = excluded.verdict, payload_json = excluded.payload_json, written_at = excluded.written_at",
        params![session_id, stage, round, agent, verdict, payload_json, now],
    )?;
    Ok(())
}

pub fn record_audit(conn: &Connection, session_id: Option<&str>, event: &str, details_json: &str) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO audits(ts, session_id, event, details_json) VALUES (?1, ?2, ?3, ?4)",
        params![now, session_id, event, details_json],
    )?;
    Ok(())
}

pub fn list_active(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT id FROM sessions WHERE status = 'active' ORDER BY started_at")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    let mut out = Vec::new();
    for r in rows { out.push(r?); }
    Ok(out)
}
