import { spawn } from 'node:child_process';

export function spawnAndCollect(bin, args, stdin, options = {}) {
  const label = options.label || bin;
  const timeoutMs = Number(options.timeoutMs || 180000);

  return new Promise((resolve, reject) => {
    const child = spawnProcess(bin, args);
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
      try { child.kill(); } catch {}
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

function spawnProcess(bin, args) {
  if (process.platform !== 'win32') {
    return spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  }

  if (/\.(cmd|bat)$/i.test(bin)) {
    const comspec = process.env.ComSpec || 'cmd.exe';
    return spawn(comspec, ['/d', '/c', bin, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
  }

  if (/\.ps1$/i.test(bin)) {
    return spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', bin, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  return spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
}
