// negative: safe data handling — JSON.parse and a static template, no eval
export function render(payload) {
  const data = JSON.parse(payload);
  const html = `<div>${data.title}</div>`;
  return html;
}
