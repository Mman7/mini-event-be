import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  countConfirmedRegistrations,
  lockEvent,
} from "../events/event.repository.js";
import { lockUser } from "../users/user.repository.js";
import {
  createRegistration,
  confirmRegistration,
  cancelRegistration,
  findConfirmedRegistrationsForUser,
  findConfirmedRegistrationCreatedSince,
  findConfirmedRegistrationOnDate,
  findRegistrationForEvent,
} from "./registration.repository.js";

export async function listRegistrationsForUser(userId: number) {
  const registrations = await findConfirmedRegistrationsForUser(prisma, userId);
  return registrations.map((registration) => ({
    id: registration.id,
    eventId: registration.event.id,
    eventTitle: registration.event.title,
    eventDate: registration.event.eventDate.toISOString().slice(0, 10),
    registeredAt: registration.createdAt.toISOString(),
  }));
}

function isPastEvent(eventDate: Date) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return eventDate.getTime() < today.getTime();
}

export async function registerForEvent(
  eventId: number,
  userId: number,
): Promise<void> {
  try {
    await prisma.$transaction(async (transaction) => {
      // Lock the user and event records to prevent race conditions during registration.
      const user = await lockUser(transaction, userId);
      if (!user) {
        throw new AppError(401, "Authenticated user no longer exists.");
      }

      const event = await lockEvent(transaction, eventId);
      if (!event) {
        throw new AppError(404, "Event not found.");
      }

      if (isPastEvent(event.eventDate)) {
        throw new AppError(409, "Past events cannot accept registrations.");
      }

      const existing = await findRegistrationForEvent(
        transaction,
        user.id,
        event.id,
      );
      if (existing?.status === "CONFIRMED") {
        throw new AppError(409, "You are already registered for this event.");
      }

      const sameDate = await findConfirmedRegistrationOnDate(
        transaction,
        user.id,
        event.eventDate,
      );
      if (sameDate) {
        throw new AppError(
          409,
          "You already registered for an event on this date.",
        );
      }

      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const registeredToday = await findConfirmedRegistrationCreatedSince(
        transaction,
        user.id,
        startOfToday,
      );
      if (registeredToday) {
        throw new AppError(409, "You already registered for an event today.");
      }

      const registeredCount = await countConfirmedRegistrations(
        transaction,
        event.id,
      );
      if (registeredCount >= event.maxAttendees) {
        throw new AppError(409, "This event is fully booked.");
      }

      if (existing?.status === "CANCELLED") {
        await confirmRegistration(transaction, existing.id);
      } else {
        await createRegistration(transaction, {
          userId: user.id,
          eventId: event.id,
        });
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(409, "You are already registered for this event.");
    }

    throw error;
  }
}

export async function cancelRegistrationForEvent(
  eventId: number,
  userId: number,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const user = await lockUser(transaction, userId);
    if (!user) {
      throw new AppError(401, "Authenticated user no longer exists.");
    }

    const event = await lockEvent(transaction, eventId);
    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    const registration = await findRegistrationForEvent(
      transaction,
      user.id,
      event.id,
    );
    if (!registration || registration.status === "CANCELLED") {
      throw new AppError(404, "Registration not found.");
    }

    await cancelRegistration(transaction, registration.id);
  });
}
