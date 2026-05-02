const BLOCKED_ENV = {
  claude: ['ANTHROPIC_API_KEY'],
  codex: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
};

export function assertDelegatedCliAuth(provider, env = process.env) {
  if (env.HARNESS_AUTH_ALLOW_ENV_OVERRIDE === '1') return;

  const keys = BLOCKED_ENV[provider] || [];
  const found = keys.filter((key) => env[key]);
  if (!found.length) return;

  throw new Error([
    `구독/OAuth 보호: ${provider} CLI 호출 직전 API key 환경변수가 감지되었습니다.`,
    `감지: ${found.join(', ')}`,
    '로컬 CLI auth를 쓰려면 해당 환경변수를 unset 하세요.',
    '종량제 사용을 의도했다면 HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1 을 명시하세요.',
  ].join('\n'));
}

export { BLOCKED_ENV };
