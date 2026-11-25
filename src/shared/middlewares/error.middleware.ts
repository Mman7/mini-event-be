import type { ErrorRequestHandler } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

export const errorMiddleware: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    success: false,
    message:
      env.NODE_ENV === "production"
        ? "Internal server error."
        : "Internal server error.",
  });
};
