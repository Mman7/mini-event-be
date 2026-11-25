import { Router } from "express";
import { requireAuth } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { eventIdSchema } from "../events/event.validator.js";
import { cancel, list, register } from "./registration.controller.js";
import { registrationSchema } from "./registration.validator.js";

export const registrationRoutes = Router();

registrationRoutes.get("/registrations", requireAuth, list);

registrationRoutes.post(
  "/events/:id/registrations",
  requireAuth,
  validate("params", eventIdSchema),
  validate("body", registrationSchema),
  register,
);

registrationRoutes.delete(
  "/events/:id/registrations",
  requireAuth,
  validate("params", eventIdSchema),
  cancel,
);
