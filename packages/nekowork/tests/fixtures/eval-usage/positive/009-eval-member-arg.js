// positive: eval of a property/member access on request input (real-world phrasing)
export default function handler(req, res) {
  const result = eval(req.body.expression);
  res.json({ result });
}
