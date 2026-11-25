import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../src/config/env.js";

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(env.DATABASE_URL),
});
const date = (daysFromToday: number) => {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + daysFromToday);
  return value;
};

async function main() {
  await prisma.registration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const [alice, bob, cara] = await Promise.all([
    prisma.user.create({
      data: { name: "Alice Example", email: "alice@example.com" },
    }),
    prisma.user.create({
      data: { name: "Bob Example", email: "bob@example.com" },
    }),
    prisma.user.create({
      data: { name: "Cara Example", email: "cara@example.com" },
    }),
  ]);

  const past = await prisma.event.create({
    data: {
      title: "Past Community Meetup",
      eventDate: date(-5),
      maxAttendees: 30,
    },
  });
  const available = await prisma.event.create({
    data: {
      title: "React Workshop",
      description: "Hands-on React fundamentals.",
      eventDate: date(3),
      maxAttendees: 30,
    },
  });
  const sameDate = await prisma.event.create({
    data: {
      title: "TypeScript Deep Dive",
      eventDate: date(3),
      maxAttendees: 20,
    },
  });
  const full = await prisma.event.create({
    data: {
      title: "Database Fundamentals",
      eventDate: date(4),
      maxAttendees: 2,
    },
  });
  const future = await prisma.event.create({
    data: {
      title: "API Design Lab",
      eventDate: date(6),
      maxAttendees: 15,
    },
  });

  await prisma.event.createMany({
    data: Array.from({ length: 15 }, (_, index) => ({
      title: `Community Event ${index + 1}`,
      description: `Community event number ${index + 1}.`,
      eventDate: date(7 + index),
      maxAttendees: 20 + (index % 4) * 5,
    })),
  });

  await prisma.registration.createMany({
    data: [
      { userId: alice.id, eventId: available.id, status: "CONFIRMED" },
      { userId: bob.id, eventId: full.id, status: "CONFIRMED" },
      { userId: cara.id, eventId: full.id, status: "CONFIRMED" },
      { userId: alice.id, eventId: past.id, status: "CONFIRMED" },
      { userId: bob.id, eventId: future.id, status: "CANCELLED" },
    ],
  });

  console.log(
    `Seeded events: ${[past, available, sameDate, full, future].length + 15}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    return;
  })
  .finally(() => prisma.$disconnect());
