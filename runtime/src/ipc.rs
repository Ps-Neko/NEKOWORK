// stdio JSON-RPC. Node CLI 가 stdin 으로 한 줄 JSON 요청 → stdout 한 줄 JSON 응답.
// 메서드:
//   - "ping"
//   - "session.upsert" { id, mode, task, root }
//   - "handoff.record" { session_id, stage, round, agent, verdict, payload }
//   - "session.list"
//
// 단일 요청 처리 후 종료 (장기 연결은 supervisor 의 spawn 으로 관리).

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, Write};
use std::path::Path;

#[derive(Deserialize, Debug)]
struct Request {
    #[serde(default)]
    id: Option<u64>,
    method: String,
    #[serde(default)]
    params: serde_json::Value,
}

#[derive(Serialize, Debug)]
struct Response {
    id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

pub async fn run(root: &Path) -> Result<()> {
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    let mut out = stdout.lock();

    let mut line = String::new();
    let mut handle = stdin.lock();
    handle.read_line(&mut line)?;
    let line = line.trim_start_matches('\u{feff}').trim();
    if line.is_empty() {
        return Ok(());
    }

    let resp = match serde_json::from_str::<Request>(line) {
        Ok(req) => handle_req(req, root).await,
        Err(e) => Response { id: None, result: None, error: Some(format!("parse: {e}")) },
    };

    serde_json::to_writer(&mut out, &resp)?;
    writeln!(&mut out)?;
    Ok(())
}

async fn handle_req(req: Request, root: &Path) -> Response {
    let id = req.id;
    match req.method.as_str() {
        "ping" => Response { id, result: Some(serde_json::json!({ "pong": true })), error: None },
        "session.upsert" => {
            let p = req.params;
            let sid = p.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let mode = p.get("mode").and_then(|v| v.as_str()).unwrap_or("manual").to_string();
            let task = p.get("task").and_then(|v| v.as_str()).map(|s| s.to_string());
            match crate::session::open(root).and_then(|c| {
                crate::session::upsert_session(&c, &sid, &mode, task.as_deref(), Some(&root.to_string_lossy()))?;
                Ok(())
            }) {
                Ok(()) => Response { id, result: Some(serde_json::json!({ "ok": true, "session": sid })), error: None },
                Err(e) => Response { id, result: None, error: Some(format!("upsert: {e}")) },
            }
        }
        "handoff.record" => {
            let p = req.params;
            let sid = p.get("session_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let stage = p.get("stage").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let round = p.get("round").and_then(|v| v.as_u64()).unwrap_or(1) as u32;
            let agent = p.get("agent").and_then(|v| v.as_str()).map(|s| s.to_string());
            let verdict = p.get("verdict").and_then(|v| v.as_str()).map(|s| s.to_string());
            let payload = p.get("payload").map(|v| v.to_string()).unwrap_or_else(|| "{}".to_string());
            match crate::session::open(root).and_then(|c| {
                crate::session::record_handoff(&c, &sid, &stage, round, agent.as_deref(), verdict.as_deref(), &payload)
            }) {
                Ok(()) => Response { id, result: Some(serde_json::json!({ "ok": true })), error: None },
                Err(e) => Response { id, result: None, error: Some(format!("handoff: {e}")) },
            }
        }
        "session.list" => match crate::session::open(root).and_then(|c| crate::session::list_active(&c)) {
            Ok(rows) => Response { id, result: Some(serde_json::json!({ "active": rows })), error: None },
            Err(e) => Response { id, result: None, error: Some(format!("list: {e}")) },
        },
        other => Response { id, result: None, error: Some(format!("unknown method: {other}")) },
    }
}
