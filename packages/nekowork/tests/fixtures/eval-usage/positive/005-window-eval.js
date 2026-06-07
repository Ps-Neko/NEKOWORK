// positive: indirect eval via window.eval (global-scope code execution)
export function runFromQuery(req) {
  const code = req.query.code;
  return window.eval(code);
}
