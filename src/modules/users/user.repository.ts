import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";

export type UserDatabase = PrismaClient | Prisma.TransactionClient;

export async function upsertUser(
  client: UserDatabase,
  data: { name: string; email: string },
) {
  return client.user.upsert({
    where: { email: data.email },
    create: data,
    update: { name: data.name },
  });
}

export async function lockUser(client: UserDatabase, userId: number) {
  await client.$queryRaw<
    { id: number }[]
  >`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
  return client.user.findUnique({ where: { id: userId } });
}
