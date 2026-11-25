import type { Request, Response } from "express";
import { sendMessage, sendSuccess } from "../../shared/utils/api-response.js";
import {
  cancelRegistrationForEvent,
  listRegistrationsForUser,
  registerForEvent,
} from "./registration.service.js";

export async function list(request: Request, response: Response) {
  if (!request.authUserId) {
    throw new Error("Authenticated user was not attached to the request.");
  }

  return sendSuccess(
    response,
    await listRegistrationsForUser(request.authUserId),
  );
}

export async function register(request: Request, response: Response) {
  if (!request.authUserId) {
    throw new Error("Authenticated user was not attached to the request.");
  }

  await registerForEvent(Number(request.params.id), request.authUserId);
  return sendMessage(response, "Registered successfully.", 201);
}

export async function cancel(request: Request, response: Response) {
  if (!request.authUserId) {
    throw new Error("Authenticated user was not attached to the request.");
  }

  await cancelRegistrationForEvent(
    Number(request.params.id),
    request.authUserId,
  );
  return sendMessage(response, "Registration cancelled successfully.");
}
