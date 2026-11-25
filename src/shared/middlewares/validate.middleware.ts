import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/app-error.js";

declare global {
  namespace Express {
    interface Request {
      validatedQuery?: unknown;
    }
  }
}

export function validate<T>(
  source: "body" | "params" | "query",
  schema: ZodType<T>,
): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source]);

    if (!result.success) {
      next(new AppError(422, "Validation failed.", result.error.flatten()));
      return;
    }

    if (source === "query") {
      request.validatedQuery = result.data;
    } else {
      request[source] = result.data;
    }
    next();
  };
}
