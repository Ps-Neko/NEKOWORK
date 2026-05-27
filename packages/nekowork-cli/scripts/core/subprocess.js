import { spawn, spawnSync } from 'node:child_process';

export function spawnAndCollect(bin, args, stdin, options = {}) {
  const label = options.label || bin;
  const timeoutMs = Number(options.timeoutMs || 180000);

  return new Promise((resolve, reject) => {
    const child = spawnProcess(bin, args, options);
    let out = '';
    let err = '';
    let done = false;

    const settle = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      fn(value);
    };

    const timeout = setTimeout(() => {
      killProcessTree(child);
      settle(reject, new Error(`${label} timeout`));
    }, timeoutMs);

    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => settle(reject, e));
    child.on('close', (code) => {
      if (code !== 0) settle(reject, new Error(`${label} exit ${code}\nstderr:\n${err}`));
      else settle(resolve, out);
    });
    child.stdin.end(stdin);
  });
}

function killProcessTree(child) {
  try {
    if (process.platform === 'win32' && child.pid) {
      spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      return;
    }
    child.kill();
  } catch {
    try { child.kill(); } catch {}
  }
}

function spawnProcess(bin, args, options = {}) {
  const spawnOptions = {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: options.cwd,
    env: options.env,
  };

  if (process.platform !== 'win32') {
    return spawn(bin, args, spawnOptions);
  }

  if (/\.(cmd|bat)$/i.test(bin)) {
    const comspec = process.env.ComSpec || 'cmd.exe';
    return spawn(comspec, ['/d', '/c', bin, ...args], spawnOptions);
  }

  if (/\.ps1$/i.test(bin)) {
    return spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', bin, ...args], {
      ...spawnOptions,
    });
  }

  return spawn(bin, args, spawnOptions);
}

/**
 * Run a shell command, capturing output. Unlike spawnAndCollect, this NEVER
 * rejects on a non-zero exit — a failing check is a normal result, not a crash.
 *
 * @param {string} command  full command line (e.g. "npm test", "npx tsc --noEmit")
 * @param {{ cwd?: string, env?: object, timeoutMs?: number }} [options]
 * @returns {Promise<{ code: number|null, stdout: string, stderr: string,
 *   timedOut: boolean, spawnError: boolean, durationMs: number }>}
 */
export function spawnCapture(command, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 300000);
  const start = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const child = spawn(command, [], {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true,
    });

    const finish = (partial) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut, durationMs: Date.now() - start, ...partial });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => finish({ code: null, spawnError: true, stderr: stderr + String(e) }));
    child.on('close', (code) => finish({ code, spawnError: false }));
  });
}
