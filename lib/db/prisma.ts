type PrismaClientLike = {
  $connect?: () => Promise<void>;
  $queryRawUnsafe?: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  [model: string]: unknown;
};

const globalForPrisma = globalThis as typeof globalThis & {
  civicLensPrisma?: Promise<PrismaClientLike | null>;
};

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function getPrisma(): Promise<PrismaClientLike | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (!globalForPrisma.civicLensPrisma) {
    globalForPrisma.civicLensPrisma = createPrismaClient();
  }

  return globalForPrisma.civicLensPrisma;
}

export async function getDatabaseStatus(): Promise<"ok" | "unconfigured" | "unavailable"> {
  const prisma = await getPrisma();
  if (!prisma) {
    return "unconfigured";
  }

  try {
    if (prisma.$queryRawUnsafe) {
      await prisma.$queryRawUnsafe("SELECT 1");
    } else if (prisma.$connect) {
      await prisma.$connect();
    }
    return "ok";
  } catch {
    return "unavailable";
  }
}

async function createPrismaClient(): Promise<PrismaClientLike | null> {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<{ PrismaClient?: new () => PrismaClientLike }>;
    const prismaModule = await dynamicImport("@prisma/client");
    if (!prismaModule.PrismaClient) {
      return null;
    }

    return new prismaModule.PrismaClient();
  } catch {
    return null;
  }
}
