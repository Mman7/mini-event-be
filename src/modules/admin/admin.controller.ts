import type { Request, Response } from "express";
import { sendMessage, sendSuccess } from "../../shared/utils/api-response.js";
import {
  cancelAdminRegistration,
  createAdminEvent,
  deleteAdminEvent,
  getAdminEvent,
  getDashboard,
  listAdminEvents,
  listAdminRegistrations,
  updateAdminEvent,
} from "./admin.service.js";
import type {
  AdminEventQuery,
  AdminRegistrationQuery,
} from "./admin.validator.js";

export async function dashboard(_request: Request, response: Response) {
  return sendSuccess(response, await getDashboard());
}

export async function events(request: Request, response: Response) {
  return sendSuccess(
    response,
    await listAdminEvents(request.validatedQuery as AdminEventQuery),
  );
}

export async function eventDetails(request: Request, response: Response) {
  return sendSuccess(response, await getAdminEvent(Number(request.params.id)));
}

export async function createEvent(request: Request, response: Response) {
  return sendSuccess(response, await createAdminEvent(request.body), 201);
}

export async function updateEvent(request: Request, response: Response) {
  return sendSuccess(
    response,
    await updateAdminEvent(Number(request.params.id), request.body),
  );
}

export async function deleteEvent(request: Request, response: Response) {
  await deleteAdminEvent(Number(request.params.id));
  return sendMessage(response, "Event deleted successfully.");
}

export async function registrations(request: Request, response: Response) {
  return sendSuccess(
    response,
    await listAdminRegistrations(
      request.validatedQuery as AdminRegistrationQuery,
    ),
  );
}

export async function cancelRegistration(request: Request, response: Response) {
  await cancelAdminRegistration(Number(request.params.id));
  return sendMessage(response, "Registration cancelled successfully.");
}
