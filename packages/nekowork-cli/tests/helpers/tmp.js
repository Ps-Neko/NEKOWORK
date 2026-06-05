import fs from 'node:fs';

// Best-effort recursive cleanup for throwaway test directories (often temp git
// repos). Tests create these and remove them in `finally`/`afterEach`.
//
// On Windows, concurrent `git` subprocesses plus antivirus scanning can hold a
// transient handle on a directory's files longer than the retry window under
// full-suite load. The assertions are already done by the time cleanup runs,
// and a leaked dir under `os.tmpdir()` is harmless (the OS reaps it), so a
// residual EPERM/EBUSY must never fail an otherwise-passing test.
//
// `maxRetries`/`retryDelay` retry the common transient-lock case (so the dir is
// usually removed); the surrounding try/catch swallows the rare residual error.
export function rmrf(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    // ignore — temp cleanup is non-critical and environment-dependent
  }
}
