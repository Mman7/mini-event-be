import { z } from "zod";

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return date.toISOString().startsWith(value);
  }, "Use a valid calendar date.");

export const eventIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const eventQuerySchema = z.object({
  date: calendarDate.optional(),
});

export function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
