import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";

export type EventDatabase = PrismaClient | Prisma.TransactionClient;

export async function findEvents(client: EventDatabase, eventDate?: Date) {
  return client.event.findMany({
    where: eventDate ? { eventDate } : undefined,
    orderBy: [{ eventDate: "asc" }, { id: "asc" }],
  });
}

export async function findEventById(client: EventDatabase, eventId: number) {
  return client.event.findUnique({ where: { id: eventId } });
}

// to resolve concurrency issues when updating an event, we lock the row for update
export async function lockEvent(client: EventDatabase, eventId: number) {
  await client.$queryRaw<
    { id: number }[]
  >`SELECT id FROM Event WHERE id = ${eventId} FOR UPDATE`;
  return findEventById(client, eventId);
}

export async function countConfirmedRegistrations(
  client: EventDatabase,
  eventId: number,
) {
  return client.registration.count({ where: { eventId, status: "CONFIRMED" } });
}
