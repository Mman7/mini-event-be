# Mini Event Booking API

Backend-only event booking API built with Node.js, Express, TypeScript, Prisma ORM 7, Zod, Better Auth, and MySQL. A separate frontend can consume the API over HTTP; no frontend application is included in this repository.

## Architecture

Requests flow through:

`route -> Zod validation -> controller -> service -> repository -> Prisma Client -> MySQL`

Feature code is under `src/modules`. Shared errors, validation middleware, and response helpers are under `src/shared`. Prisma is initialized once in `src/infrastructure/database/prisma.ts` with the MariaDB driver adapter.

## Backend setup

### Requirements

- Node.js 20.19 or newer
- MySQL 8 or a compatible MariaDB server
- npm

Create an empty database, for example `mini_event_db`, then configure the connection string in `.env`.

### Install and configure

```bash
git clone <repository-url>
cd mini-event-backend
npm install
copy .env.example .env
```

On macOS or Linux, use `cp .env.example .env` instead of `copy`.

Update `.env` with the database credentials and admin account:

```dotenv
DATABASE_URL="mysql://username:password@localhost:3306/mini_event_db"
PORT=5000
NODE_ENV=development
BETTER_AUTH_SECRET="replace-with-at-least-32-characters"
BETTER_AUTH_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="replace-with-a-password-of-at-least-8-characters"
```

`DATABASE_URL` must use the `mysql://` scheme. `BETTER_AUTH_SECRET` must be at least 32 characters and `ADMIN_PASSWORD` must be at least 8 characters.

### Initialize the database

Generate the Prisma client, apply the checked-in migrations, and load development data:

```bash
npm run generate
npm run migrate:dev
npm run seed
```

The seed resets application data, creates the configured admin account, three sample users, and 20 events. Do not run it against a database whose data must be preserved.

### Run the backend

```bash
npm run dev
```

The API is available at `http://localhost:5000`. For a production-style run:

```bash
npm run build
npm start
```

## Database structure

| Table          | Purpose                                    | Important constraints                                              |
| -------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `User`         | Application users and roles                | Unique `email`; `role` is `USER` or `ADMIN`                        |
| `Account`      | Better Auth email/password account records | Unique `(providerId, accountId)`; belongs to `User`                |
| `Session`      | Better Auth HTTP-only login sessions       | Unique `token`; cascades when its user is deleted                  |
| `Event`        | Bookable events                            | `eventDate` is a MySQL `DATE`; `maxAttendees` must be positive     |
| `Registration` | User-to-event bookings and cancellations   | Unique `(userId, eventId)`; `status` is `CONFIRMED` or `CANCELLED` |

`Registration.userId` and `Registration.eventId` are foreign keys. User deletion cascades to accounts and sessions; registrations preserve their event history unless removed by the database relationship rules. Indexes support event-date queries, user registration lookups, and status-filtered registration queries.

`registeredCount`, `availableSlots`, and event `status` are calculated values, not columns. `availableSlots` is `maxAttendees` minus confirmed registrations. Event status is `PAST` when its date has passed, `FULL` when confirmed registrations reach capacity, and `UPCOMING` otherwise.

Registration uses one Prisma transaction with user and event row locks. It checks capacity, duplicate registration, past dates, and same-date bookings while the locks are held. Keep the tables on an InnoDB-compatible engine so these transaction guarantees remain valid.

## Validation logic

All validated input passes through the shared `validate` middleware. Zod failures return HTTP 422 with `message: "Validation failed."` and flattened field errors. Route parameters are coerced to positive integers, so IDs such as `0`, negative values, decimals, and non-numeric strings are rejected.

### Public event endpoints

- `GET /api/events` accepts an optional `date` in valid `YYYY-MM-DD` format and an optional `status` of `UPCOMING`, `FULL`, or `PAST`.
- `GET /api/events/:id` validates the positive integer `id`.
- Invalid calendar dates, including impossible dates such as `2026-02-30`, are rejected.

### Registration endpoints

- `POST /api/events/:id/registrations` requires authentication, a valid event ID, and an empty JSON object. Unknown body fields are rejected.
- `DELETE /api/events/:id/registrations` requires authentication and a valid event ID.
- Business conflicts such as duplicate registration, a full event, a past event, or another confirmed event on the same date return HTTP 409.

### Admin endpoints

- Event input requires a non-empty trimmed `title` up to 200 characters, an optional trimmed `description` up to 5,000 characters, a valid calendar `eventDate`, and a positive integer `maxAttendees`.
- Event queries support trimmed `search`, `date`, `status`, and positive `page` and `pageSize`; `pageSize` is capped at 100.
- Registration queries support trimmed `search`, `status` (`CONFIRMED` or `CANCELLED`), a positive `eventId`, `page`, and `pageSize`.
- Admin routes require an authenticated session and `User.role = ADMIN`; authenticated non-admin users receive HTTP 403.

## API overview

### Authentication

Better Auth provides email/password endpoints under `/api/auth`: `POST /sign-up/email`, `POST /sign-in/email`, `POST /sign-out`, and `GET /get-session`. Successful authentication sets an HTTP-only session cookie.

### Events and registrations

- `GET /api/events` lists events with calculated counts, availability, and status.
- `GET /api/events/:id` returns one event.
- `GET /api/registrations` lists the authenticated user's registrations.
- `POST /api/events/:id/registrations` registers the authenticated user.
- `DELETE /api/events/:id/registrations` cancels the authenticated user's registration while retaining its history.

### Admin

The admin API is under `/api/admin`: dashboard totals, event search and CRUD, registration search, and registration cancellation. Events with registrations cannot be deleted, and capacity cannot be lowered below the number of confirmed registrations.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run postman:generate
```
