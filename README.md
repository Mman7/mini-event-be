# Mini Event Booking API

Backend-only event booking API built with Node.js, Express, TypeScript, Prisma ORM 7, Zod, and MySQL.

## Architecture

The request flow is:

`route -> Zod validation -> controller -> service -> repository -> Prisma Client -> MySQL`

Feature code lives under `src/modules/events`, `src/modules/users`, and `src/modules/registrations`. Shared errors, validation middleware, and response helpers live under `src/shared`. Prisma is initialized once in `src/infrastructure/database/prisma.ts` with `@prisma/adapter-mariadb`.

## Setup

1. Install Node.js 20.19 or newer and MySQL.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Install dependencies:

```bash
npm install
```

4. Generate the Prisma client:

```bash
npm run generate
```

5. Apply migrations, including the Better Auth tables:

```bash
npm run migrate:dev -- --name init
```

6. Seed test data:

```bash
npm run seed
```

7. Start the API:

```bash
npm run dev
```

The default server URL is `http://localhost:5000`.

## Database

`User.email` is unique. Better Auth stores email/password accounts and HTTP-only sessions in the `Account` and `Session` tables. `Registration` has foreign keys to `User` and `Event`, a unique `(userId, eventId)` constraint, and status-aware indexes. `Event.eventDate` uses MySQL `DATE`; `availableSlots` is calculated from `maxAttendees` and confirmed registrations and is not stored.

The development database was inspected with `information_schema.TABLES` and currently reports `InnoDB` for `User`, `Event`, `Registration`, and `_prisma_migrations`. InnoDB supports the transactions and row-level locks used by registration.

## Concurrency strategy

Registration runs in one interactive Prisma transaction. It reads the authenticated Better Auth user, locks the user row, then locks the event row with `SELECT ... FOR UPDATE`. It checks same-date confirmed registrations and capacity while both locks are held, then inserts the registration. Requests acquire locks in the same user-then-event order to reduce deadlocks. The database unique constraint remains the final duplicate-registration safeguard.

If deployed against a non-InnoDB engine, these transaction and row-lock guarantees must be considered unavailable and the engine limitation must be addressed before claiming race-free registration.

## API

### Authentication

Better Auth provides email/password authentication under `/api/auth`. Sign up with `POST /api/auth/sign-up/email`, sign in with `POST /api/auth/sign-in/email`, and sign out with `POST /api/auth/sign-out`. Successful sign-up and sign-in responses set an HTTP-only session cookie. Send the cookie with protected requests.

Registration requires an authenticated session and accepts an empty JSON object. The authenticated account, rather than request-body identity fields, determines which user is registered.

### `GET /api/events`

Returns all events with `registeredCount` and calculated `availableSlots`. Add `?date=2026-11-28` to filter by calendar date.

### `GET /api/events/:id`

Returns one event or a 404 response.

### `POST /api/events/:id/registrations`

Requires the Better Auth session cookie. Request body:

```json
{}
```

Successful response:

```json
{
  "success": true,
  "message": "Registered successfully."
}
```

Unauthenticated requests return 401. Validation errors return 422. Missing events return 404. Same-date, duplicate, past-event, and full-event conflicts return 409. Unexpected errors return 500 without database credentials or production stack traces.

### `DELETE /api/events/:id/registrations`

Requires the Better Auth session cookie. Cancels the authenticated user's registration and returns:

```json
{
  "success": true,
  "message": "Registration cancelled successfully."
}
```

The registration is retained with `CANCELLED` status so its history is preserved.

## Verification

```bash
npm run typecheck
npm test
npm run build
```
