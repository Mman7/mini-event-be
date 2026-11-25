import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  countConfirmedRegistrations,
  findEventById,
  findEvents,
} from "./event.repository.js";
import type { EventSummary } from "./event.types.js";
import { toDate } from "./event.validator.js";

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getStatus(
  eventDate: Date,
  registeredCount: number,
  maxAttendees: number,
) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (eventDate < today) return "PAST" as const;
  if (registeredCount >= maxAttendees) return "FULL" as const;
  return "UPCOMING" as const;
}

async function summarizeEvent(
  event: Awaited<ReturnType<typeof findEventById>>,
): Promise<EventSummary> {
  if (!event) {
    throw new AppError(404, "Event not found.");
  }

  const registeredCount = await countConfirmedRegistrations(prisma, event.id);
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    eventDate: formatDate(event.eventDate),
    maxAttendees: event.maxAttendees,
    registeredCount,
    availableSlots: Math.max(event.maxAttendees - registeredCount, 0),
    status: getStatus(event.eventDate, registeredCount, event.maxAttendees),
  };
}

export async function listEvents(
  date?: string,
  status?: EventSummary["status"],
): Promise<EventSummary[]> {
  const events = await findEvents(prisma, date ? toDate(date) : undefined);
  const summaries = await Promise.all(events.map(summarizeEvent));
  return summaries.filter((event) => !status || event.status === status);
}

export async function getEvent(eventId: number): Promise<EventSummary> {
  return summarizeEvent(await findEventById(prisma, eventId));
}
