import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client instance.
 * Re-uses the existing client in development to avoid exhausting database connections
 * during hot-reloading with ts-node-dev.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
