import type { Config } from 'drizzle-kit';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'No database connection string found.\n' +
    'Pass it at runtime: DATABASE_URL_UNPOOLED=postgresql://... npx drizzle-kit push\n' +
    'Secrets never live in .env files.'
  );
}

export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  tablesFilter: ['!auth.*', '!storage.*', '!realtime.*', '!supabase_*', '!_*'],
} satisfies Config;
