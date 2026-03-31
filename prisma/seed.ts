import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
