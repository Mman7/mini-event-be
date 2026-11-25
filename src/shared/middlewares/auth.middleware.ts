import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../infrastructure/auth/auth.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../errors/app-error.js";

declare global {
  namespace Express {
    interface Request {
      authUserId?: number;
      authUserRole?: "USER" | "ADMIN";
    }
  }
}

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    next(new AppError(401, "Authentication required."));
    return;
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    next(new AppError(401, "Invalid authentication session."));
    return;
  }

  request.authUserId = userId;
  next();
};

export const requireAdmin: RequestHandler = async (
  request,
  _response,
  next,
) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    next(new AppError(401, "Authentication required."));
    return;
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    next(new AppError(401, "Invalid authentication session."));
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    next(new AppError(401, "Authenticated user no longer exists."));
    return;
  }

  if (user.role !== "ADMIN") {
    next(new AppError(403, "Admin access required."));
    return;
  }

  request.authUserId = user.id;
  request.authUserRole = user.role;
  next();
};
