// positive: raw wildcard ACAO header set on every response (Koa/Express style)
module.exports = function corsAll(ctx, next) {
  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set("Access-Control-Allow-Credentials", "true");
  return next();
};
