// negative: ORM / query-builder chains — no raw SQL string assembled.
export async function list(repo, qb, id) {
  const a = await repo.find({ where: { id } });
  const b = await qb.where("id = :id", { id }).orderBy("created_at").getMany();
  return [a, b];
}
