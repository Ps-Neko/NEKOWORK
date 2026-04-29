// scripts/lib/token-vault.js
// auth.token_store: encrypted-file (v1). v2 에서 OS keychain 으로 확장.
// 저장 위치: ~/.harness/oauth/<provider>.json (Unix 0600).
// audit: ~/.harness/audit/<date>.jsonl 에 append.
// 자세한 정책은 docs/AUTH-MIGRATION.md.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function home() { return process.env.HARNESS_HOME || path.join(os.homedir(), '.harness'); }
function vaultDir() { return path.join(home(), 'oauth'); }
function vaultPath(provider) { return path.join(vaultDir(), `${provider}.json`); }

export function save(provider, payload) {
  const dir = vaultDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = vaultPath(provider);
  const data = { provider, ...payload, saved_at: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  try { fs.chmodSync(file, 0o600); } catch { /* Windows 무시 */ }
  return file;
}

export function load(provider) {
  const file = vaultPath(provider);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function remove(provider) {
  const file = vaultPath(provider);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}

export function list() {
  const dir = vaultDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

// secret_redaction: agent.yaml security.secret_redaction 와 동기.
// audit log 와 stdout 출력에서 토큰 값을 마스킹.
export function redact(s) {
  if (typeof s !== 'string' || !s) return s;
  // GitHub: gho_, ghp_, ghs_, ghu_, ghr_ 접두 + 36+ 글자
  let out = s.replace(/\bgh[opsur]_[A-Za-z0-9]{20,}\b/g, '***REDACTED-GH***');
  // 일반 long-lived 토큰 (40+ 영숫자)
  out = out.replace(/\b[A-Za-z0-9_-]{40,}\b/g, '***REDACTED***');
  return out;
}

export function audit(event, details = {}) {
  const auditDir = path.join(home(), 'audit');
  fs.mkdirSync(auditDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const f = path.join(auditDir, `${today}.jsonl`);
  // details 안의 access_token 류는 자동 redact.
  const safe = {};
  for (const [k, v] of Object.entries(details)) {
    safe[k] = (k === 'access_token' || k === 'token') ? '***REDACTED***' : v;
  }
  fs.appendFileSync(f, JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...safe,
  }) + '\n');
}
