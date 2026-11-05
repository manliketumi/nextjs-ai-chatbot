const assert = require('node:assert/strict');
const { before, after, beforeEach, test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { migrate } = require('drizzle-orm/pglite/migrator');
const { z } = require('zod');
const { loadTypescript } = require('./helpers/load-typescript.cjs');
const { accountFixtures, ids } = require('./fixtures/accounts.cjs');

// Real schema, migrations and production queries against disposable memory-only
// PostgreSQL. Authentication and AI are explicit test boundaries; no keys needed.
const client = new PGlite();
const db = drizzle(client);
const bcrypt = {};
const schema = loadTypescript('lib/db/schema.ts', {
  'drizzle-orm/pg-core': require('drizzle-orm/pg-core'),
});
const queries = loadTypescript('lib/db/queries.ts', {
  'server-only': {},
  'bcrypt-ts': bcrypt,
  'drizzle-orm': require('drizzle-orm'),
  './client': { createDatabase: () => db },
  './schema': schema,
});
let fixtures, session, aiCalls, streamed, toolUpdates;
const imports = {
  '@/app/(auth)/auth': { auth: async () => session },
  '@/lib/db/queries': queries,
  zod: { z },
};
const actions = loadTypescript('app/(chat)/actions.ts', {
  ...imports,
  ai: {},
  'next/headers': {},
  '@/lib/ai/models': {},
});
const documents = loadTypescript('app/(chat)/api/document/route.ts', imports);
const votes = loadTypescript('app/(chat)/api/vote/route.ts', imports);
const chats = loadTypescript('app/(chat)/api/chat/route.ts', {
  ...imports,
  ai: {},
  '@/lib/ai/models': {},
  '@/lib/ai/prompts': {},
  '@/lib/utils': {},
  '../../actions': {},
  '@/lib/ai/tools/create-document': {},
  '@/lib/ai/tools/update-document': {},
  '@/lib/ai/tools/request-suggestions': {},
  '@/lib/ai/tools/get-weather': {},
});
const update = loadTypescript('lib/ai/tools/update-document.ts', {
  ...imports,
  ai: { tool: (definition) => definition },
  '@/lib/artifacts/server': {
    documentHandlersByArtifactKind: [
      {
        kind: 'text',
        onUpdateDocument: async ({ document, session }) => {
          toolUpdates++;
          await queries.saveDocument({
            ...document,
            userId: session.user.id,
            content: 'AI updated owner text.',
          });
        },
      },
    ],
  },
});
const suggestions = loadTypescript('lib/ai/tools/request-suggestions.ts', {
  ...imports,
  ai: {
    tool: (definition) => definition,
    streamObject: (input) => {
      aiCalls.push(input.prompt);
      return {
        elementStream: (async function* () {
          yield {
            originalSentence: input.prompt,
            suggestedSentence: 'Clearer owner text.',
            description: 'Clarity',
          };
        })(),
      };
    },
  },
  '@/lib/utils': { generateUUID: () => ids.missing },
  '../models': { myProvider: { languageModel: () => 'fixture-model' } },
});

function request(route, method, body, query = '') {
  return new Request(`http://test.local/api/${route}${query}`, {
    method,
    ...(body === undefined
      ? {}
      : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
}
const docBody = {
  title: 'Saved document',
  content: 'Saved text.',
  kind: 'text',
};
const rollbackBody = () => ({ timestamp: fixtures.first.toISOString() });
const dataStream = { writeData: (data) => streamed.push(data) };

async function snapshot() {
  const result = {};
  for (const table of ['chat', 'message', 'vote', 'document', 'suggestion']) {
    result[table] = await db.select().from(schema[table]);
  }
  return JSON.stringify(result);
}

before(async () => {
  Object.assign(bcrypt, await import('bcrypt-ts'));
  await migrate(db, { migrationsFolder: './lib/db/migrations' });
});
after(async () => {
  await client.close();
});
beforeEach(async () => {
  await client.exec(
    'TRUNCATE "Suggestion", "Document", "Vote", "Message", "Chat", "User" CASCADE',
  );
  fixtures = accountFixtures();
  session = fixtures.ownerSession;
  aiCalls = [];
  streamed = [];
  toolUpdates = 0;
  for (const [name, rows] of Object.entries({
    user: fixtures.users,
    chat: fixtures.chats,
    message: fixtures.messages,
    vote: fixtures.votes,
    document: fixtures.documents,
    suggestion: fixtures.suggestions,
  }))
    await db.insert(schema[name]).values(rows);
});

test('an unsaved-message edit is a safe no-op', async () => {
  const initial = await snapshot();
  await actions.deleteTrailingMessages({ id: ids.missing });
  assert.equal(await snapshot(), initial);
});
test('editing removes the selected message and later replies/votes only from its chat', async () => {
  await actions.deleteTrailingMessages({ id: ids.message });
  assert.equal((await queries.getMessagesByChatId({ id: ids.chat })).length, 0);
  assert.equal((await queries.getVotesByChatId({ id: ids.chat })).length, 0);
  assert.equal(
    (await queries.getMessagesByChatId({ id: ids.otherChat })).length,
    1,
  );
});
for (const [label, getSession] of [
  ['signed out', () => null],
  ['missing user id', () => ({ user: {} })],
  ['another account', () => fixtures.otherSession],
]) {
  test(`${label} cannot edit another account's messages or change visibility`, async () => {
    session = getSession();
    const initial = await snapshot();
    await assert.rejects(
      actions.deleteTrailingMessages({ id: ids.message }),
      /Unauthorized/,
    );
    await assert.rejects(
      actions.updateChatVisibility({ chatId: ids.chat, visibility: 'public' }),
      /Unauthorized/,
    );
    assert.equal(await snapshot(), initial);
  });
}
test('owners can persist public and private visibility', async () => {
  for (const visibility of ['public', 'private']) {
    await actions.updateChatVisibility({ chatId: ids.chat, visibility });
    assert.equal(
      (await queries.getChatById({ id: ids.chat })).visibility,
      visibility,
    );
  }
});
test('a public chat is read-only for another account', async () => {
  const initial = await snapshot();
  await assert.rejects(
    actions.deleteTrailingMessages({ id: ids.publicMessage }),
    /Unauthorized/,
  );
  await assert.rejects(
    actions.updateChatVisibility({
      chatId: ids.publicChat,
      visibility: 'private',
    }),
    /Unauthorized/,
  );
  assert.equal(await snapshot(), initial);
});
test('invalid visibility, invalid ids and a missing chat cannot cause writes', async () => {
  const initial = await snapshot();
  await assert.rejects(
    actions.updateChatVisibility({ chatId: ids.chat, visibility: 'invalid' }),
  );
  await assert.rejects(
    actions.updateChatVisibility({ chatId: 'invalid', visibility: 'public' }),
  );
  await assert.rejects(
    actions.updateChatVisibility({ chatId: ids.missing, visibility: 'public' }),
  );
  await assert.rejects(actions.deleteTrailingMessages({ id: 'invalid' }));
  assert.equal(await snapshot(), initial);
});

test('rolling back a missing document returns 404 without crashing', async () => {
  assert.equal(
    (
      await documents.PATCH(
        request('document', 'PATCH', rollbackBody(), `?id=${ids.missing}`),
      )
    ).status,
    404,
  );
});
test('owners can read versions, save a version and roll back with dependent suggestions', async () => {
  const response = await documents.GET(
    request('document', 'GET', undefined, `?id=${ids.document}`),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).length, 2);
  assert.equal(
    (
      await documents.POST(
        request('document', 'POST', docBody, `?id=${ids.document}`),
      )
    ).status,
    200,
  );
  assert.equal(
    (await queries.getDocumentsById({ id: ids.document })).length,
    3,
  );
  assert.equal(
    (
      await documents.PATCH(
        request('document', 'PATCH', rollbackBody(), `?id=${ids.document}`),
      )
    ).status,
    200,
  );
  assert.equal(
    (await queries.getDocumentsById({ id: ids.document })).length,
    1,
  );
  assert.equal(
    (await queries.getSuggestionsByDocumentId({ documentId: ids.document }))
      .length,
    0,
  );
  assert.equal(
    (await queries.getDocumentsById({ id: ids.otherDocument })).length,
    1,
  );
});
test('owners can create a new document id', async () => {
  assert.equal(
    (
      await documents.POST(
        request('document', 'POST', docBody, `?id=${ids.missing}`),
      )
    ).status,
    200,
  );
  assert.equal(
    (await queries.getDocumentById({ id: ids.missing })).userId,
    ids.owner,
  );
});
for (const [label, getSession, status] of [
  ['signed out', () => null, 401],
  ['missing user id', () => ({ user: {} }), 401],
  ['another account', () => fixtures.otherSession, 403],
]) {
  test(`${label} cannot read, append to or roll back an owner's document`, async () => {
    session = getSession();
    const initial = await snapshot();
    for (const [method, body] of [
      ['GET', undefined],
      ['POST', docBody],
      ['PATCH', rollbackBody()],
    ]) {
      assert.equal(
        (
          await documents[method](
            request('document', method, body, `?id=${ids.document}`),
          )
        ).status,
        status,
      );
    }
    assert.equal(await snapshot(), initial);
  });
}
for (const [label, method, body, id] of [
  ['malformed JSON', 'POST', '{', ids.document],
  ['missing body fields', 'POST', {}, ids.document],
  ['invalid kind', 'POST', { ...docBody, kind: 'invalid' }, ids.document],
  ['invalid date', 'PATCH', { timestamp: 'yesterday' }, ids.document],
  ['null body', 'PATCH', null, ids.document],
  ['malformed rollback JSON', 'PATCH', '{', ids.document],
  ['invalid id', 'PATCH', { timestamp: '2026-01-01T10:00:00Z' }, 'invalid'],
]) {
  test(`document endpoint rejects ${label} with 400 and no writes`, async () => {
    const initial = await snapshot();
    assert.equal(
      (await documents[method](request('document', method, body, `?id=${id}`)))
        .status,
      400,
    );
    assert.equal(await snapshot(), initial);
  });
}
test('mixed-owner legacy document versions cannot be read or mutated', async () => {
  await db
    .insert(schema.document)
    .values({
      ...fixtures.documents[0],
      userId: ids.other,
      createdAt: fixtures.third,
    });
  const initial = await snapshot();
  for (const [method, body] of [
    ['GET', undefined],
    ['POST', docBody],
    ['PATCH', rollbackBody()],
  ]) {
    assert.equal(
      (
        await documents[method](
          request('document', method, body, `?id=${ids.document}`),
        )
      ).status,
      403,
    );
  }
  assert.equal(await snapshot(), initial);
});

test('deleting a missing chat returns 404', async () => {
  assert.equal(
    (
      await chats.DELETE(
        request('chat', 'DELETE', undefined, `?id=${ids.missing}`),
      )
    ).status,
    404,
  );
});
test('deleting a chat requires its owner and preserves other chats', async () => {
  let initial = await snapshot();
  session = fixtures.otherSession;
  assert.equal(
    (
      await chats.DELETE(
        request('chat', 'DELETE', undefined, `?id=${ids.chat}`),
      )
    ).status,
    403,
  );
  assert.equal(await snapshot(), initial);
  session = null;
  assert.equal(
    (
      await chats.DELETE(
        request('chat', 'DELETE', undefined, `?id=${ids.chat}`),
      )
    ).status,
    401,
  );
  session = fixtures.ownerSession;
  assert.equal(
    (
      await chats.DELETE(
        request('chat', 'DELETE', undefined, `?id=${ids.chat}`),
      )
    ).status,
    200,
  );
  assert.equal(await queries.getChatById({ id: ids.chat }), undefined);
  assert.equal((await queries.getMessagesByChatId({ id: ids.chat })).length, 0);
  assert.ok(await queries.getChatById({ id: ids.otherChat }));
});

test('owners can read and change their vote', async () => {
  assert.equal(
    (await votes.GET(request('vote', 'GET', undefined, `?chatId=${ids.chat}`)))
      .status,
    200,
  );
  assert.equal(
    (
      await votes.PATCH(
        request('vote', 'PATCH', {
          chatId: ids.chat,
          messageId: ids.reply,
          type: 'down',
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (await queries.getVotesByChatId({ id: ids.chat }))[0].isUpvoted,
    false,
  );
});
test('an unsaved chat has no votes and does not trigger fetch errors', async () => {
  const response = await votes.GET(
    request('vote', 'GET', undefined, `?chatId=${ids.missing}`),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
});
test('private votes require ownership; public viewers cannot overwrite votes', async () => {
  const initial = await snapshot();
  assert.equal(
    (
      await votes.GET(
        request('vote', 'GET', undefined, `?chatId=${ids.otherChat}`),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await votes.GET(
        request('vote', 'GET', undefined, `?chatId=${ids.publicChat}`),
      )
    ).status,
    200,
  );
  for (const [chatId, messageId] of [
    [ids.otherChat, ids.otherMessage],
    [ids.publicChat, ids.publicMessage],
  ]) {
    assert.equal(
      (
        await votes.PATCH(
          request('vote', 'PATCH', { chatId, messageId, type: 'down' }),
        )
      ).status,
      403,
    );
  }
  assert.equal(await snapshot(), initial);
});
test('votes reject missing and mismatched messages, invalid types and malformed JSON', async () => {
  const initial = await snapshot();
  for (const messageId of [ids.missing, ids.otherMessage]) {
    assert.equal(
      (
        await votes.PATCH(
          request('vote', 'PATCH', { chatId: ids.chat, messageId, type: 'up' }),
        )
      ).status,
      404,
    );
  }
  for (const body of [
    '{',
    { chatId: ids.chat, messageId: ids.reply, type: 'invalid' },
  ]) {
    assert.equal(
      (await votes.PATCH(request('vote', 'PATCH', body))).status,
      400,
    );
  }
  session = null;
  assert.equal(
    (
      await votes.PATCH(
        request('vote', 'PATCH', {
          chatId: ids.chat,
          messageId: ids.reply,
          type: 'up',
        }),
      )
    ).status,
    401,
  );
  assert.equal(await snapshot(), initial);
});

for (const [label, getSession, documentId] of [
  ['another owner', () => fixtures.ownerSession, ids.otherDocument],
  ['signed out', () => null, ids.document],
  ['missing user id', () => ({ user: {} }), ids.document],
  ['missing document', () => fixtures.ownerSession, ids.missing],
]) {
  test(`AI tools reject ${label} before streaming, AI calls or database writes`, async () => {
    const initial = await snapshot();
    const session = getSession();
    const updated = await update
      .updateDocument({ session, dataStream })
      .execute({ id: documentId, description: 'Rewrite' });
    const suggested = await suggestions
      .requestSuggestions({ session, dataStream })
      .execute({ documentId });
    assert.ok(updated.error);
    assert.ok(suggested.error);
    assert.equal(toolUpdates, 0);
    assert.equal(aiCalls.length, 0);
    assert.equal(streamed.length, 0);
    assert.equal(await snapshot(), initial);
  });
}
test('AI tools can update owned documents and persist owned suggestions', async () => {
  const result = await update
    .updateDocument({ session, dataStream })
    .execute({ id: ids.document, description: 'Rewrite' });
  assert.equal(result.id, ids.document);
  assert.equal(toolUpdates, 1);
  const latest = await queries.getDocumentById({ id: ids.document });
  assert.equal(latest.content, 'AI updated owner text.');
  await suggestions
    .requestSuggestions({ session, dataStream })
    .execute({ documentId: ids.document });
  assert.deepEqual(aiCalls, [latest.content]);
  const rows = await queries.getSuggestionsByDocumentId({
    documentId: ids.document,
  });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.userId === ids.owner));
});
