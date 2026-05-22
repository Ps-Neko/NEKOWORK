// scripts/lib/keychain.js
// OS keychain wrapper (@napi-rs/keyring sync API).
// macOS Keychain / Windows Credential Manager / Linux Secret Service.
// 패키지 미설치 또는 native module 로드 실패 시 _mod = null → token-vault 가 file fallback.
// 자세한 정책은 docs/AUTH-MIGRATION.md.

const SERVICE = 'harness';

let _mod = null;
let _attempted = false;

async function load() {
  if (_attempted) return _mod;
  _attempted = true;
  try {
    _mod = await import('@napi-rs/keyring');
  } catch {
    _mod = null;
  }
  return _mod;
}

function isNotFound(err) {
  const m = String(err?.message || err || '');
  return /no.*entry|not.*found|specified.*item|element not found|no password|no such/i.test(m);
}

export async function isAvailable() {
  // 환경에서 명시적으로 비활성 (CI / 강제 file fallback 검증).
  if (process.env.HARNESS_KEYCHAIN_DISABLED === '1') return false;
  const k = await load();
  if (!k) return false;
  // 실제 OS keychain 이 응답하는지 probe.
  try {
    const e = new k.Entry(SERVICE, '__harness_probe__');
    try { e.getPassword(); }
    catch (err) {
      // not-found 는 정상. 그 외 platform error 는 미가용으로 간주.
      if (!isNotFound(err)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function set(provider, value) {
  const k = await load();
  if (!k) throw new Error('@napi-rs/keyring 미설치 (npm install @napi-rs/keyring).');
  new k.Entry(SERVICE, provider).setPassword(value);
}

export async function get(provider) {
  const k = await load();
  if (!k) throw new Error('@napi-rs/keyring 미설치.');
  try {
    const v = new k.Entry(SERVICE, provider).getPassword();
    return v ?? null;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function remove(provider) {
  const k = await load();
  if (!k) throw new Error('@napi-rs/keyring 미설치.');
  try {
    return new k.Entry(SERVICE, provider).deletePassword();
  } catch (err) {
    if (isNotFound(err)) return false;
    throw err;
  }
}

export async function list() {
  const k = await load();
  if (!k) return [];
  try {
    const creds = k.findCredentials(SERVICE) || [];
    return creds.map((c) => c.account).filter((a) => a !== '__harness_probe__');
  } catch {
    return [];
  }
}
