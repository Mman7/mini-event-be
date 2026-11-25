import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { app } from "./app.js";
import { prisma } from "./infrastructure/database/prisma.js";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function signUp(baseUrl: string, email: string, name: string) {
  const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ name, email, password: "password1234" }),
  });
  const responseBody = await response.text();
  assert.equal(response.status, 200, responseBody);
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .join("; ");
}

test("get-session returns only the public session and user fields", async () => {
  const suffix = Date.now().toString();
  const email = `session-${suffix}@example.com`;
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const cookie = await signUp(baseUrl, email, "Session User");
    const response = await fetch(`${baseUrl}/api/auth/get-session`, {
      headers: { cookie },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(body).sort(), ["session", "user"]);
    assert.deepEqual(Object.keys(body.session).sort(), [
      "createdAt",
      "expiresAt",
      "id",
      "userId",
    ]);
    assert.deepEqual(Object.keys(body.user).sort(), ["email", "id", "name"]);
    assert.equal(body.user.email, email);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});

test("sign-in returns only the user and a success message", async () => {
  const suffix = Date.now().toString();
  const email = `sign-in-${suffix}@example.com`;
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await signUp(baseUrl, email, "Sign In User");

    const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ email, password: "password1234" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(body).sort(), ["message", "success", "user"]);
    assert.deepEqual(body, {
      success: true,
      message: "Signed in successfully.",
      user: body.user,
    });
    assert.equal(body.user.email, email);
    assert.notEqual(response.headers.getSetCookie().length, 0);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});

test("admin event pagination uses numeric query values", async () => {
  const suffix = Date.now().toString();
  const email = `admin-pagination-${suffix}@example.com`;
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const cookie = await signUp(baseUrl, email, "Admin Pagination User");
    await prisma.user.update({
      where: { email },
      data: { role: "ADMIN" },
    });

    const response = await fetch(
      `${baseUrl}/api/admin/events?page=1&pageSize=100`,
      { headers: { cookie } },
    );
    const body = await response.json();

    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.data.page, 1);
    assert.equal(body.data.pageSize, 100);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});

test("users can cancel their own event registration", async () => {
  const suffix = Date.now().toString();
  const email = `cancel-${suffix}@example.com`;
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let eventId: number | undefined;

  try {
    const event = await prisma.event.create({
      data: {
        title: `Cancellation ${suffix}`,
        eventDate: date("2030-02-01"),
        maxAttendees: 5,
      },
    });
    eventId = event.id;
    const cookie = await signUp(baseUrl, email, "Cancellation User");

    const registration = await fetch(
      `${baseUrl}/api/events/${event.id}/registrations`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({}),
      },
    );
    assert.equal(registration.status, 201);

    const cancellation = await fetch(
      `${baseUrl}/api/events/${event.id}/registrations`,
      { method: "DELETE", headers: { cookie } },
    );
    assert.equal(cancellation.status, 200);
    assert.deepEqual(await cancellation.json(), {
      success: true,
      message: "Registration cancelled successfully.",
    });

    const registrations = await fetch(`${baseUrl}/api/registrations`, {
      headers: { cookie },
    });
    assert.deepEqual(await registrations.json(), { success: true, data: [] });

    const repeatedCancellation = await fetch(
      `${baseUrl}/api/events/${event.id}/registrations`,
      { method: "DELETE", headers: { cookie } },
    );
    assert.equal(repeatedCancellation.status, 404);
  } finally {
    if (eventId !== undefined) {
      await prisma.registration.deleteMany({ where: { eventId } });
      await prisma.event.delete({ where: { id: eventId } });
    }
    await prisma.user.deleteMany({ where: { email } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});

test("registration API enforces capacity, same-date, duplicate, and past-event rules", async () => {
  const suffix = Date.now().toString();
  const email = `booking-${suffix}@example.com`;
  const fullEmail = `full-${suffix}@example.com`;
  const anotherEmail = `another-${suffix}@example.com`;
  const pastEmail = `past-${suffix}@example.com`;
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const eventIds: number[] = [];

  try {
    const [available, sameDate, full, past] = await Promise.all([
      prisma.event.create({
        data: {
          title: `Available ${suffix}`,
          eventDate: date("2030-01-10"),
          maxAttendees: 1,
        },
      }),
      prisma.event.create({
        data: {
          title: `Same date ${suffix}`,
          eventDate: date("2030-01-10"),
          maxAttendees: 5,
        },
      }),
      prisma.event.create({
        data: {
          title: `Full ${suffix}`,
          eventDate: date("2030-01-11"),
          maxAttendees: 1,
        },
      }),
      prisma.event.create({
        data: {
          title: `Past ${suffix}`,
          eventDate: date("2020-01-01"),
          maxAttendees: 5,
        },
      }),
    ]);
    eventIds.push(available.id, sameDate.id, full.id, past.id);

    const unauthenticated = await fetch(
      `${baseUrl}/api/events/${available.id}/registrations`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    assert.equal(unauthenticated.status, 401);

    const cookie = await signUp(baseUrl, email, "Test User");
    const fullCookie = await signUp(baseUrl, fullEmail, "Full User");
    const anotherCookie = await signUp(baseUrl, anotherEmail, "Another User");
    const pastCookie = await signUp(baseUrl, pastEmail, "Past User");

    const first = await fetch(
      `${baseUrl}/api/events/${available.id}/registrations`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({}),
      },
    );
    assert.equal(first.status, 201);

    const sameDateResponse = await fetch(
      `${baseUrl}/api/events/${sameDate.id}/registrations`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({}),
      },
    );
    assert.equal(sameDateResponse.status, 409);

    const duplicateResponse = await fetch(
      `${baseUrl}/api/events/${available.id}/registrations`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({}),
      },
    );
    assert.equal(duplicateResponse.status, 409);

    const fullResponse = await fetch(
      `${baseUrl}/api/events/${full.id}/registrations`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: fullCookie },
        body: JSON.stringify({}),
      },
    );
    assert.equal(fullResponse.status, 201);

    const fullyBookedResponse = await fetch(
      `${baseUrl}/api/events/${full.id}/registrations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: anotherCookie,
        },
        body: JSON.stringify({}),
      },
    );
    assert.equal(fullyBookedResponse.status, 409);

    const pastResponse = await fetch(
      `${baseUrl}/api/events/${past.id}/registrations`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: pastCookie },
        body: JSON.stringify({}),
      },
    );
    assert.equal(pastResponse.status, 409);
  } finally {
    await prisma.registration.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
