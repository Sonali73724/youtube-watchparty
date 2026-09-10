import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
});

export let isDbConnected = false;

export async function connectDb(): Promise<boolean> {
  try {
    await prisma.$connect();
    // Test a basic query
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ PostgreSQL / Prisma Database connected successfully.');
    isDbConnected = true;
    return true;
  } catch (error) {
    console.warn('⚠️ PostgreSQL not reachable locally. Operating in resilient in-memory domain mode.');
    console.warn('💡 Tip: To enable PostgreSQL persistence, start Postgres and configure DATABASE_URL in .env');
    isDbConnected = false;
    return false;
  }
}

export async function disconnectDb(): Promise<void> {
  if (isDbConnected) {
    try {
      await prisma.$disconnect();
    } catch {}
  }
}
