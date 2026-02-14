import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminWallet = (process.env.SEED_ADMIN_WALLET || "").toLowerCase();
  const agentWallet = (process.env.SEED_AGENT_WALLET || "").toLowerCase();

  if (!adminWallet || !agentWallet) {
    throw new Error("Set SEED_ADMIN_WALLET and SEED_AGENT_WALLET in .env for dev seed");
  }

  await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", humanReadonlyMode: false },
  });

  await prisma.agent.upsert({
    where: { walletAddress: adminWallet },
    update: { isAdmin: true, displayName: "Admin Agent" },
    create: { walletAddress: adminWallet, isAdmin: true, displayName: "Admin Agent" },
  });

  await prisma.agent.upsert({
    where: { walletAddress: agentWallet },
    update: { isAdmin: false, displayName: "Demo Agent" },
    create: { walletAddress: agentWallet, isAdmin: false, displayName: "Demo Agent" },
  });

  console.log("Seed complete (dev-only wallets added)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
