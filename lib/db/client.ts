// Modified by Tumi with AI assistance: local setup and authentication improvements, October 2026.
import { PGlite } from '@electric-sql/pglite';
import { drizzle as localDrizzle } from 'drizzle-orm/pglite';
import { drizzle as postgresDrizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const databaseGlobal = globalThis as unknown as {
  chatbotLocalDatabase?: PGlite;
};

export function createDatabase() {
  if (process.env.LOCAL_DATABASE_PATH) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('The embedded database is for local development only. Configure POSTGRES_URL for production.');
    }
    const dataPath = path.resolve(process.env.LOCAL_DATABASE_PATH);
    mkdirSync(path.dirname(dataPath), { recursive: true });
    const client = databaseGlobal.chatbotLocalDatabase ?? new PGlite(dataPath);
    databaseGlobal.chatbotLocalDatabase = client;
    return localDrizzle(client);
  }
  if (!process.env.POSTGRES_URL) {
    throw new Error('Configure LOCAL_DATABASE_PATH or POSTGRES_URL to use the chatbot.');
  }
  return postgresDrizzle(postgres(process.env.POSTGRES_URL));
}
