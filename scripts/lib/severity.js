// Severity / category 분류 + blast radius 계산.
// REVIEW.md 의 분류 규칙을 코드로 옮긴 것. 단위 테스트 가능.

const CATEGORY_PATTERNS = [
  { c: 'security',    re: /(auth|crypto|password|secret|jwt|oauth|cookie|csrf|xss|sql\s*injection|injection|sanitiz|escape)/i },
  { c: 'correctness', re: /(off.by.one|null|undefined|race|deadlock|leak|infinite|wrong|incorrect|edge case|boundary)/i },
  { c: 'performance', re: /(n\+1|slow|memory|cpu|leak|allocation|throughput|latency)/i },
  { c: 'test',        re: /(test|coverage|assert|mock)/i },
  { c: 'docs',        re: /(docs?|readme|comment|changelog)/i },
];

const SECURITY_PATHS = /(\/|\\)(auth|crypto|payment|session|permission|oauth)(\/|\\)/i;
const SECURITY_KEYWORDS = /\b(jwt|password|secret|cookie|token)\b/i;

/** issue 의 summary + why 텍스트로 category 추정. 명시값이 있으면 그대로. */
export function classifyCategory(issue) {
  if (issue.category) return issue.category;
  const text = `${issue.summary || ''} ${issue.why || ''}`;
  for (const { c, re } of CATEGORY_PATTERNS) if (re.test(text)) return c;
  return 'style';
}

/**
 * Severity 자동 분류 (명시값 없을 때 휴리스틱).
 *   - security 카테고리 + injection / bypass / leak 키워드 → critical
 *   - security + 일반 → high
 *   - correctness + race / deadlock → high
 *   - 그 외 default medium.
 */
export function classifySeverity(issue) {
  if (issue.severity) return issue.severity;
  const cat = classifyCategory(issue);
  const text = `${issue.summary || ''} ${issue.why || ''}`.toLowerCase();
  if (cat === 'security' && /(injection|bypass|leak|exposure|rce|deserializ|escalation)/.test(text)) return 'critical';
  if (cat === 'security') return 'high';
  if (cat === 'correctness' && /(race|deadlock|panic|crash)/.test(text)) return 'high';
  if (cat === 'docs') return 'low';
  return 'medium';
}

/**
 * 변경 파일 목록 + task 키워드로 risk level 결정.
 *   - critical: security path + 변경 파일 ≥ 5
 *   - high:     security path 또는 변경 파일 ≥ 20
 *   - medium:   변경 파일 ≥ 5
 *   - low:      나머지
 */
export function riskLevel(files = [], task = '') {
  const isSec = files.some(f => SECURITY_PATHS.test(f) || SECURITY_KEYWORDS.test(f)) ||
                SECURITY_PATHS.test(task) || SECURITY_KEYWORDS.test(task);
  const blast = files.length;
  if (isSec && blast >= 5)  return 'critical';
  if (isSec)                return 'high';
  if (blast >= 20)          return 'high';
  if (blast >= 5)           return 'medium';
  return 'low';
}

/** 이슈 배열 → severity 분포 카운트. */
export function severityCounts(issues = []) {
  const c = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const i of issues) {
    const s = classifySeverity(i);
    if (c[s] !== undefined) c[s]++;
  }
  return c;
}

/** 이슈 배열 → verdict 자동 판정 규칙. */
export function deriveVerdict(issues = []) {
  const c = severityCounts(issues);
  if (c.critical > 0) return 'block';
  if (c.high > 0)     return 'approve_with_fixes';
  if (c.medium > 0)   return 'approve_with_fixes';
  return 'approve';
}
