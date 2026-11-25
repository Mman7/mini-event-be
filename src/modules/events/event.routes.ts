import { Router } from "express";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { getEventDetails, getEvents } from "./event.controller.js";
import { eventIdSchema, eventQuerySchema } from "./event.validator.js";

export const eventRoutes = Router();

eventRoutes.get("/", validate("query", eventQuerySchema), getEvents);
eventRoutes.get("/:id", validate("params", eventIdSchema), getEventDetails);
