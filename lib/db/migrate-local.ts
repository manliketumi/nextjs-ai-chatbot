// Modified by Tumi with AI assistance: local setup and authentication improvements, October 2026.
import { config } from 'dotenv';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

config({ path: '.env.local' });

async function main() {
  if (!process.env.LOCAL_DATABASE_PATH) {
    throw new Error('LOCAL_DATABASE_PATH is not configured');
  }
  const dataPath = path.resolve(process.env.LOCAL_DATABASE_PATH);
  mkdirSync(path.dirname(dataPath), { recursive: true });
  const client = new PGlite(dataPath);
  try {
    await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
    console.log('Local database is ready.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
