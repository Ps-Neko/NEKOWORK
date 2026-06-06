// scripts/lib/token-vault.js
// auth.token_store: os-keychain (default) 또는 encrypted-file.
// 백엔드 결정:
//   HARNESS_TOKEN_STORE_KIND=os-keychain  → keychain only (실패 시 throw)
//   HARNESS_TOKEN_STORE_KIND=encrypted-file → file only
//   HARNESS_TOKEN_STORE_KIND=auto (기본) → keychain 시도, 실패하면 file fallback
// audit: ~/.harness/audit/<date>.jsonl.
// 자세한 정책은 docs/AUTH-MIGRATION.md.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as keychain from './keychain.js';

function home() { return process.env.HARNESS_HOME || path.join(os.homedir(), '.harness'); }
function vaultDir() { return path.join(home(), 'oauth'); }
function vaultPath(provider) { return path.join(vaultDir(), `${provider}.json`); }

function resolvedKind() {
  const env = (process.env.HARNESS_TOKEN_STORE_KIND || 'auto').toLowerCase();
  if (env === 'os-keychain' || env === 'encrypted-file') return env;
  return 'auto';
}

export async function backend() {
  const k = resolvedKind();
  if (k === 'encrypted-file') return 'file';
  if (k === 'os-keychain') {
    if (!(await keychain.isAvailable())) {
      throw new Error('HARNESS_TOKEN_STORE_KIND=os-keychain 강제했으나 keychain 가용 불가.');
    }
    return 'keychain';
  }
  return (await keychain.isAvailable()) ? 'keychain' : 'file';
}

// ── file backend ──

function fileSave(provider, payload) {
  const dir = vaultDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = vaultPath(provider);
  const data = { provider, ...payload, saved_at: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  try { fs.chmodSync(file, 0o600); } catch { /* Windows 무시 */ }
  return file;
}

function fileLoad(provider) {
  const file = vaultPath(provider);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function fileRemove(provider) {
  const file = vaultPath(provider);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}

function fileList() {
  const dir = vaultDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

// ── keychain backend ──
// keychain 은 단일 string 만 저장 → JSON 직렬화/역직렬화.

async function keychainSave(provider, payload) {
  const data = { provider, ...payload, saved_at: new Date().toISOString() };
  await keychain.set(provider, JSON.stringify(data));
  return `keychain:harness/${provider}`;
}

async function keychainLoad(provider) {
  const v = await keychain.get(provider);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

async function keychainRemove(provider) {
  return keychain.remove(provider);
}

async function keychainList() {
  return keychain.list();
}

// ── public API (async) ──

export async function save(provider, payload) {
  const b = await backend();
  return b === 'keychain' ? keychainSave(provider, payload) : fileSave(provider, payload);
}

export async function load(provider) {
  const b = await backend();
  return b === 'keychain' ? keychainLoad(provider) : fileLoad(provider);
}

export async function remove(provider) {
  const b = await backend();
  return b === 'keychain' ? keychainRemove(provider) : fileRemove(provider);
}

export async function list() {
  const b = await backend();
  return b === 'keychain' ? keychainList() : fileList();
}

// ── redact / audit (sync 유지) ──
// secret_redaction: agent.yaml security.secret_redaction 와 동기.
// 알려진 공급자 패턴을 명시적으로 먼저 처리하고,
// 잔여 긴 토큰(20+ char)을 catch-all 로 마스킹한다.
export function redact(s) {
  if (typeof s !== 'string' || !s) return s;
  // GitHub tokens
  let out = s.replace(/\bgh[opsur]_[A-Za-z0-9]{20,}\b/g, '***REDACTED-GH***');
  // Anthropic API keys: sk-ant-...
  out = out.replace(/\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, '***REDACTED-ANT***');
  // Stripe secret keys: sk_live_... / sk_test_...
  out = out.replace(/\bsk_(live|test)_[A-Za-z0-9]{20,}\b/g, '***REDACTED-STRIPE***');
  // OpenAI API keys: sk-... (Anthropic pattern above takes priority via ordering)
  out = out.replace(/\bsk-[A-Za-z0-9]{20,}\b/g, '***REDACTED-OPENAI***');
  // Generic catch-all: any 20+ char alphanumeric/underscore/hyphen token
  out = out.replace(/\b[A-Za-z0-9_-]{20,}\b/g, '***REDACTED***');
  return out;
}

export function audit(event, details = {}) {
  const auditDir = path.join(home(), 'audit');
  fs.mkdirSync(auditDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const f = path.join(auditDir, `${today}.jsonl`);
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
