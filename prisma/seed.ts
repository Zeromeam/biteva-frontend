import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const APP_CONFIG_DEFAULTS: Array<{ key: string; value: string }> = [
  { key: "big_day_order_threshold", value: "10" },
  { key: "release_window_hours", value: "3" },
  { key: "restaurant_notification_email", value: "" },
  { key: "min_schedule_advance_hours", value: "2" },
  { key: "max_schedule_days", value: "30" },
  { key: "day_before_reminder_enabled", value: "true" },
  { key: "operating_hours_start", value: "10:00" },
  { key: "operating_hours_end", value: "22:00" },
];

async function main() {
  await prisma.product.upsert({
    where: { slug: "biteva-box" },
    update: {
      name: "Biteva Box",
      description: "Test product for local order flow",
      priceCents: 3990,
      active: true,
    },
    create: {
      name: "Biteva Box",
      slug: "biteva-box",
      description: "Test product for local order flow",
      priceCents: 3990,
      active: true,
    },
  });

  console.log("Seeded product: biteva-box");

  for (const config of APP_CONFIG_DEFAULTS) {
    await prisma.appConfig.upsert({
      where: { key: config.key },
      update: {},  // don't overwrite existing values on re-seed
      create: { key: config.key, value: config.value },
    });
  }

  console.log(`Seeded ${APP_CONFIG_DEFAULTS.length} AppConfig defaults`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
