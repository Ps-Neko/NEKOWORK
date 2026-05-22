// positive: subprocess git push from code
import { spawnSync } from 'node:child_process';

export function autoPushRelease() {
  spawnSync('git', ['push', 'origin', 'main'], { stdio: 'inherit' });
}
