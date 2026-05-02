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
