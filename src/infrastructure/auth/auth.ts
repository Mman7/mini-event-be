import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../database/prisma.js";
import { env } from "../../config/env.js";

const secondaryStorage = new Map<
  string,
  { value: string; expiresAt: number | null }
>();

const getStoredValue = (key: string) => {
  const entry = secondaryStorage.get(key);
  if (!entry || (entry.expiresAt !== null && entry.expiresAt <= Date.now())) {
    secondaryStorage.delete(key);
    return undefined;
  }
  return entry.value;
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql",
    transaction: true,
  }),
  secondaryStorage: {
    get: getStoredValue,
    getAndDelete: (key) => {
      const value = getStoredValue(key);
      secondaryStorage.delete(key);
      return value;
    },
    set: (key, value, ttl) => {
      secondaryStorage.set(key, {
        value,
        expiresAt: ttl === undefined ? null : Date.now() + ttl * 1000,
      });
    },
    delete: (key) => {
      secondaryStorage.delete(key);
    },
    increment: (key, ttl) => {
      const current = Number(getStoredValue(key) ?? "0") + 1;
      secondaryStorage.set(key, {
        value: String(current),
        expiresAt: Date.now() + ttl * 1000,
      });
      return current;
    },
  },
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL, env.FRONTEND_URL, "http://127.0.0.1:*"],
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "USER",
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    database: {
      generateId: "serial",
    },
  },
});
