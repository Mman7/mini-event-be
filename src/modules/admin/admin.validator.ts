import { z } from "zod";
import { eventIdSchema, toDate } from "../events/event.validator.js";

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return date.toISOString().startsWith(value);
  }, "Use a valid calendar date.");

const pagination = {
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
};

export const adminEventQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  date: calendarDate.optional(),
  status: z.enum(["UPCOMING", "FULL", "PAST"]).optional(),
  ...pagination,
});

export const adminRegistrationQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
  eventId: z.coerce.number().int().positive().optional(),
  ...pagination,
});

export type AdminEventQuery = z.infer<typeof adminEventQuerySchema>;
export type AdminRegistrationQuery = z.infer<
  typeof adminRegistrationQuerySchema
>;

export const eventInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  eventDate: calendarDate,
  maxAttendees: z.coerce.number().int().positive(),
});

export const adminEventIdSchema = eventIdSchema;
export const adminRegistrationIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function toEventDate(value: string) {
  return toDate(value);
}
