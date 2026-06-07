// negative: ORM / query-builder calls — no raw SQL string assembled (safe)
export async function find(repo, id) {
  const a = await repo.find({ where: { id } });
  const b = await qb.where("id = :id", { id }).getMany();
  return [a, b];
}
