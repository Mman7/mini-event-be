import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { toEventDate } from "./admin.validator.js";

type EventStatus = "UPCOMING" | "FULL" | "PAST";

function todayUtc() {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function eventStatus(
  eventDate: Date,
  registeredCount: number,
  maxAttendees: number,
): EventStatus {
  if (eventDate.getTime() < todayUtc().getTime()) return "PAST";
  if (registeredCount >= maxAttendees) return "FULL";
  return "UPCOMING";
}

function formatEvent(event: {
  id: number;
  title: string;
  description: string | null;
  eventDate: Date;
  maxAttendees: number;
  _count: { registrations: number };
}) {
  const registeredCount = event._count.registrations;
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    eventDate: event.eventDate.toISOString().slice(0, 10),
    maxAttendees: event.maxAttendees,
    registeredCount,
    availableSlots: Math.max(event.maxAttendees - registeredCount, 0),
    status: eventStatus(event.eventDate, registeredCount, event.maxAttendees),
  };
}

export async function listAdminEvents(query: {
  search?: string;
  date?: string;
  status?: EventStatus;
  page: number;
  pageSize: number;
}) {
  const where = {
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search } },
            { description: { contains: query.search } },
          ],
        }
      : {}),
    ...(query.date ? { eventDate: toEventDate(query.date) } : {}),
  };
  const [events, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      include: {
        _count: {
          select: { registrations: { where: { status: "CONFIRMED" } } },
        },
      },
      orderBy: [{ eventDate: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.event.count({ where }),
  ]);
  const data = events
    .map(formatEvent)
    .filter((event) => !query.status || event.status === query.status);
  return {
    items: data,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

export async function getAdminEvent(eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      _count: { select: { registrations: { where: { status: "CONFIRMED" } } } },
    },
  });
  if (!event) throw new AppError(404, "Event not found.");
  return formatEvent(event);
}

export async function createAdminEvent(input: {
  title: string;
  description?: string | null;
  eventDate: string;
  maxAttendees: number;
}) {
  const event = await prisma.event.create({
    data: { ...input, eventDate: toEventDate(input.eventDate) },
  });
  return getAdminEvent(event.id);
}

export async function updateAdminEvent(
  eventId: number,
  input: {
    title: string;
    description?: string | null;
    eventDate: string;
    maxAttendees: number;
  },
) {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      _count: { select: { registrations: { where: { status: "CONFIRMED" } } } },
    },
  });
  if (!existing) throw new AppError(404, "Event not found.");
  if (input.maxAttendees < existing._count.registrations)
    throw new AppError(
      409,
      "Capacity cannot be lower than confirmed registrations.",
    );

  const eventDate = toEventDate(input.eventDate);
  const conflictingRegistration = await prisma.registration.findFirst({
    where: {
      eventId,
      status: "CONFIRMED",
      user: {
        registrations: {
          some: {
            eventId: { not: eventId },
            status: "CONFIRMED",
            event: { eventDate },
          },
        },
      },
    },
  });
  if (conflictingRegistration) {
    throw new AppError(
      409,
      "An attendee is already registered for an event on this date.",
    );
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { ...input, eventDate },
  });
  return getAdminEvent(eventId);
}

export async function deleteAdminEvent(eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { registrations: true } } },
  });
  if (!event) throw new AppError(404, "Event not found.");
  if (event._count.registrations > 0)
    throw new AppError(409, "Events with registrations cannot be deleted.");
  await prisma.event.delete({ where: { id: eventId } });
}

export async function listAdminRegistrations(query: {
  search?: string;
  status?: "CONFIRMED" | "CANCELLED";
  eventId?: number;
  page: number;
  pageSize: number;
}) {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.eventId ? { eventId: query.eventId } : {}),
    ...(query.search
      ? {
          OR: [
            { user: { name: { contains: query.search } } },
            { user: { email: { contains: query.search } } },
            { event: { title: { contains: query.search } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.registration.findMany({
      where,
      include: { user: true, event: true },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.registration.count({ where }),
  ]);
  return {
    items: items.map((item) => ({
      id: item.id,
      status: item.status,
      registeredAt: item.createdAt.toISOString(),
      user: { id: item.user.id, name: item.user.name, email: item.user.email },
      event: {
        id: item.event.id,
        title: item.event.title,
        eventDate: item.event.eventDate.toISOString().slice(0, 10),
      },
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

export async function cancelAdminRegistration(registrationId: number) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
  });
  if (!registration) throw new AppError(404, "Registration not found.");
  if (registration.status === "CANCELLED")
    throw new AppError(409, "Registration is already cancelled.");
  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: "CANCELLED" },
  });
}

export async function getDashboard() {
  const [events, registrations, users, upcoming] = await prisma.$transaction([
    prisma.event.count(),
    prisma.registration.count({ where: { status: "CONFIRMED" } }),
    prisma.user.count(),
    prisma.event.count({ where: { eventDate: { gte: todayUtc() } } }),
  ]);
  return {
    totalEvents: events,
    confirmedRegistrations: registrations,
    totalUsers: users,
    upcomingEvents: upcoming,
  };
}
