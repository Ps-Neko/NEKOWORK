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

/**
 * 이슈 배열 + 선택 가중치(confidence, blastRadius) → verdict 자동 판정.
 *
 * BLOCK 강성 룰 (하나라도 충족):
 *   - critical >= 1
 *   - high > 5                (high 다수면 추가 검토 필수)
 *   - confidence < 0.6        (codex 가 자신없게 답할 때 보수 안전망)
 *
 * APPROVE_WITH_FIXES:
 *   - high in [1, 5]
 *   - medium >= 1
 *   - blast_radius >= 10 + issues.length >= 1   (큰 변경은 작은 issue 라도 강등)
 *
 * 그 외 → approve. opts 미전달 시 기존 동작 유지(후방 호환).
 *
 * SKILL.md 의 Verdict 처리 섹션과 sync 유지.
 */
export function deriveVerdict(issues = [], opts = {}) {
  const c = severityCounts(issues);
  const { confidence, blastRadius } = opts;

  if (c.critical > 0)                                                            return 'block';
  if (c.high > 5)                                                                return 'block';
  if (typeof confidence === 'number' && confidence < 0.6)                        return 'block';

  if (c.high > 0)                                                                return 'approve_with_fixes';
  if (c.medium > 0)                                                              return 'approve_with_fixes';
  if (typeof blastRadius === 'number' && blastRadius >= 10 && issues.length > 0) return 'approve_with_fixes';

  return 'approve';
}
