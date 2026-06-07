// negative: Sequelize + Drizzle builder calls. No raw assembled SQL string.
import { eq } from "drizzle-orm";

export async function queries(sequelize: any, db: any, users: any, id: number) {
  const a = await sequelize.models.User.findOne({ where: { id } });
  const b = await db.select().from(users).where(eq(users.id, id));
  return [a, b];
}
