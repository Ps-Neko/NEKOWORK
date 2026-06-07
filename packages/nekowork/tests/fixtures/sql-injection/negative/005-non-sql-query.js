// negative: query/execute calls whose strings are NOT SQL (no DML keyword)
export function track(logger, name) {
  logger.query("fetching " + name);
  scheduler.execute(`run job ${name}`);
  return jobs.exec("status check");
}
