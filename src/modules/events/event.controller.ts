import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/api-response.js";
import { getEvent, listEvents } from "./event.service.js";

export async function getEvents(request: Request, response: Response) {
  const events = await listEvents(request.query.date as string | undefined);
  return sendSuccess(response, events);
}

export async function getEventDetails(request: Request, response: Response) {
  const event = await getEvent(Number(request.params.id));
  return sendSuccess(response, event);
}
