import { Router } from "express";
import { requireAdmin } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import {
  adminEventIdSchema,
  adminEventQuerySchema,
  adminRegistrationIdSchema,
  adminRegistrationQuerySchema,
  eventInputSchema,
} from "./admin.validator.js";
import {
  cancelRegistration,
  createEvent,
  dashboard,
  deleteEvent,
  eventDetails,
  events,
  registrations,
  updateEvent,
} from "./admin.controller.js";

export const adminRoutes = Router();
adminRoutes.use(requireAdmin);
adminRoutes.get("/dashboard", dashboard);
adminRoutes.get("/events", validate("query", adminEventQuerySchema), events);
adminRoutes.get(
  "/events/:id",
  validate("params", adminEventIdSchema),
  eventDetails,
);
adminRoutes.post("/events", validate("body", eventInputSchema), createEvent);
adminRoutes.put(
  "/events/:id",
  validate("params", adminEventIdSchema),
  validate("body", eventInputSchema),
  updateEvent,
);
adminRoutes.delete(
  "/events/:id",
  validate("params", adminEventIdSchema),
  deleteEvent,
);
adminRoutes.get(
  "/registrations",
  validate("query", adminRegistrationQuerySchema),
  registrations,
);
adminRoutes.delete(
  "/registrations/:id",
  validate("params", adminRegistrationIdSchema),
  cancelRegistration,
);
