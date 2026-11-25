import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";

export type RegistrationDatabase = PrismaClient | Prisma.TransactionClient;

export async function findConfirmedRegistrationsForUser(
  client: RegistrationDatabase,
  userId: number,
) {
  return client.registration.findMany({
    where: { userId, status: "CONFIRMED" },
    include: { event: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function findConfirmedRegistrationOnDate(
  client: RegistrationDatabase,
  userId: number,
  eventDate: Date,
) {
  return client.registration.findFirst({
    where: { userId, status: "CONFIRMED", event: { eventDate } },
  });
}

export async function findConfirmedRegistrationCreatedSince(
  client: RegistrationDatabase,
  userId: number,
  since: Date,
) {
  return client.registration.findFirst({
    where: { userId, status: "CONFIRMED", createdAt: { gte: since } },
  });
}

export async function findRegistrationForEvent(
  client: RegistrationDatabase,
  userId: number,
  eventId: number,
) {
  return client.registration.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });
}

export async function createRegistration(
  client: RegistrationDatabase,
  data: { userId: number; eventId: number },
) {
  return client.registration.create({ data: { ...data, status: "CONFIRMED" } });
}

export async function confirmRegistration(
  client: RegistrationDatabase,
  registrationId: number,
) {
  return client.registration.update({
    where: { id: registrationId },
    data: { status: "CONFIRMED" },
  });
}

export async function cancelRegistration(
  client: RegistrationDatabase,
  registrationId: number,
) {
  return client.registration.update({
    where: { id: registrationId },
    data: { status: "CANCELLED" },
  });
}
