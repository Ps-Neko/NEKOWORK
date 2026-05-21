#!/usr/bin/env node
// GitHub OAuth 로그아웃. 로컬 vault 만 삭제.
// 주의: device flow 는 client secret 이 없으므로 GitHub 측 revoke API 호출 불가.
// GitHub 측에서도 폐기하려면 사용자가 https://github.com/settings/applications 에서 직접 처리.

import { remove, audit } from '../lib/token-vault.js';

(async () => {
  const ok = await remove('github');
  audit('auth.token_revoked', { provider: 'github', local_only: true });

  if (ok) {
    process.stdout.write('✓ 로컬 vault 에서 GitHub token 삭제됨.\n');
    process.stdout.write('  GitHub 측에서도 폐기하려면:\n');
    process.stdout.write('  https://github.com/settings/applications → 해당 OAuth App → Revoke\n');
    process.exit(0);
  } else {
    process.stdout.write('GitHub token 이 vault 에 없습니다.\n');
    process.exit(1);
  }
})();
