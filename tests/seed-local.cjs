const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { migrate } = require('drizzle-orm/pglite/migrator');
const { loadTypescript } = require('./helpers/load-typescript.cjs');
const { accountFixtures } = require('./fixtures/accounts.cjs');

async function main() {
  // Never seed the application's configured database or overwrite an existing one.
  const dataPath = path.resolve('.local-data/fixture-review');
  if (fs.existsSync(dataPath))
    throw new Error(
      'Fixture database already exists; refusing to overwrite it.',
    );
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  const client = new PGlite(dataPath);
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: './lib/db/migrations' });
    const schema = loadTypescript('lib/db/schema.ts', {
      'drizzle-orm/pg-core': require('drizzle-orm/pg-core'),
    });
    const fixtures = accountFixtures();
    const { hashSync } = await import('bcrypt-ts');
    const password = hashSync('fixture-only-password', 10);
    for (const [name, rows] of Object.entries({
      user: fixtures.users.map((user) => ({ ...user, password })),
      chat: fixtures.chats,
      message: fixtures.messages,
      vote: fixtures.votes,
      document: fixtures.documents,
      suggestion: fixtures.suggestions,
    }))
      await db.insert(schema[name]).values(rows);
    console.log(
      'Created .local-data/fixture-review for local browser testing.',
    );
    console.log('Accounts: owner@example.test and other@example.test');
    console.log('Fixture-only password: fixture-only-password');
  } finally {
    await client.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
