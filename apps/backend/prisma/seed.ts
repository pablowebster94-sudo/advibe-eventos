import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Crea (o reusa) el evento en curso y escupe su token por stdout. */
async function main() {
  const slug = process.env.SEED_SLUG ?? "circuito-gualaceo";
  const existing = await prisma.event.findUnique({ where: { slug } });

  const event =
    existing ??
    (await prisma.event.create({
      data: {
        slug,
        name: process.env.SEED_NAME ?? "Circuito Gualaceo",
        brandName: process.env.SEED_BRAND ?? "AdVibe",
        token: randomBytes(9).toString("base64url"),
      },
    }));

  console.log("");
  console.log("  evento : " + event.name);
  console.log("  slug   : " + event.slug);
  console.log("  TOKEN  : " + event.token);
  console.log("  galería: /g/" + event.slug);
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
