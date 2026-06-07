// negative: Prisma client — typed query methods, no raw SQL strings.
export async function fetchPosts(prisma: PrismaClient, authorId: number) {
  return prisma.post.findMany({
    where: { authorId, published: true },
    orderBy: { createdAt: "desc" },
  });
}
