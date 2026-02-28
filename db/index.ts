import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. ' +
    'This secret lives in Vercel env vars, never in .env files. ' +
    'For local dev, set it as a runtime env var.'
  );
}

const client = postgres(connectionString, {
  prepare: false,
  max: 1,
});

export const db = drizzle(client, { schema });
export const sql = client;
