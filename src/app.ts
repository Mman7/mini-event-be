import express from "express";
import { toNodeHandler } from "better-auth/node";
import type { RequestHandler } from "express";
import { auth } from "./infrastructure/auth/auth.js";
import { env } from "./config/env.js";
import { eventRoutes } from "./modules/events/event.routes.js";
import { registrationRoutes } from "./modules/registrations/registration.routes.js";
import { errorMiddleware } from "./shared/middlewares/error.middleware.js";
import { notFoundMiddleware } from "./shared/middlewares/not-found.middleware.js";

export const app = express();

const betterAuthHandler = toNodeHandler(auth);
const frontendOrigins = new Set([
  env.FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const authResponseHandler: RequestHandler = (request, response, next) => {
  const isSignIn = request.path === "/api/auth/sign-in/email";
  const isGetSession = request.path === "/api/auth/get-session";

  // Keep Better Auth's native responses for unrelated auth endpoints.
  if (!isSignIn && !isGetSession) {
    void betterAuthHandler(request, response).catch(next);
    return;
  }

  const chunks: Buffer[] = [];
  const originalWrite = response.write.bind(response);
  const originalEnd = response.end.bind(response);

  // Buffer the body so the session cookie headers remain untouched.
  response.write = ((chunk: unknown) => {
    if (chunk) {
      chunks.push(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array),
      );
    }
    return true;
  }) as typeof response.write;

  response.end = ((chunk?: unknown) => {
    if (chunk) {
      chunks.push(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array),
      );
    }

    response.write = originalWrite;
    response.end = originalEnd;

    let payload: {
      message?: string;
      session?: {
        id?: unknown;
        expiresAt?: unknown;
        userId?: unknown;
        createdAt?: unknown;
      } | null;
      user?: {
        id?: unknown;
        name?: unknown;
        email?: unknown;
      } | null;
    } = {};
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      payload = {};
    }

    if (isGetSession && response.statusCode < 400) {
      return originalEnd(
        JSON.stringify({
          session: payload.session
            ? {
                id: payload.session.id,
                expiresAt: payload.session.expiresAt,
                userId: payload.session.userId,
                createdAt: payload.session.createdAt,
              }
            : null,
          user: payload.user
            ? {
                id: payload.user.id,
                name: payload.user.name,
                email: payload.user.email,
              }
            : null,
        }),
      );
    }

    if (isSignIn && response.statusCode < 400) {
      return originalEnd(
        JSON.stringify({
          success: true,
          message: "Signed in successfully.",
          user: payload.user,
        }),
      );
    }

    return originalEnd(
      JSON.stringify({
        success: false,
        message: payload.message ?? "Sign in failed.",
      }),
    );
  }) as typeof response.end;

  void betterAuthHandler(request, response).catch(next);
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && frontendOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.all("/api/auth/*splat", authResponseHandler);
app.use(express.json());
app.use("/api/events", eventRoutes);
app.use("/api", registrationRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);
