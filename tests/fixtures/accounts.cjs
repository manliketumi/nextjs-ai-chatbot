const ids = {
  owner: '00000000-0000-4000-8000-000000000001',
  other: '00000000-0000-4000-8000-000000000002',
  chat: '00000000-0000-4000-8000-000000000011',
  otherChat: '00000000-0000-4000-8000-000000000012',
  publicChat: '00000000-0000-4000-8000-000000000013',
  message: '00000000-0000-4000-8000-000000000021',
  reply: '00000000-0000-4000-8000-000000000022',
  otherMessage: '00000000-0000-4000-8000-000000000023',
  publicMessage: '00000000-0000-4000-8000-000000000024',
  document: '00000000-0000-4000-8000-000000000031',
  otherDocument: '00000000-0000-4000-8000-000000000032',
  suggestion: '00000000-0000-4000-8000-000000000041',
  missing: '00000000-0000-4000-8000-000000000099',
};

function accountFixtures() {
  const first = new Date('2026-01-01T10:00:00.000Z');
  const second = new Date('2026-01-01T10:01:00.000Z');
  const third = new Date('2026-01-01T10:02:00.000Z');
  return {
    ids,
    first,
    second,
    third,
    ownerSession: { user: { id: ids.owner, email: 'owner@example.test' } },
    otherSession: { user: { id: ids.other, email: 'other@example.test' } },
    users: [
      { id: ids.owner, email: 'owner@example.test' },
      { id: ids.other, email: 'other@example.test' },
    ],
    chats: [
      {
        id: ids.chat,
        userId: ids.owner,
        title: 'Owner private chat',
        visibility: 'private',
        createdAt: first,
      },
      {
        id: ids.otherChat,
        userId: ids.other,
        title: 'Other private chat',
        visibility: 'private',
        createdAt: first,
      },
      {
        id: ids.publicChat,
        userId: ids.other,
        title: 'Shared read-only chat',
        visibility: 'public',
        createdAt: first,
      },
    ],
    messages: [
      {
        id: ids.message,
        chatId: ids.chat,
        role: 'user',
        content: 'Original question',
        createdAt: first,
      },
      {
        id: ids.reply,
        chatId: ids.chat,
        role: 'assistant',
        content: 'Original answer',
        createdAt: second,
      },
      {
        id: ids.otherMessage,
        chatId: ids.otherChat,
        role: 'assistant',
        content: 'Private other account answer',
        createdAt: first,
      },
      {
        id: ids.publicMessage,
        chatId: ids.publicChat,
        role: 'assistant',
        content: 'Shared answer',
        createdAt: first,
      },
    ],
    votes: [
      { chatId: ids.chat, messageId: ids.reply, isUpvoted: true },
      { chatId: ids.otherChat, messageId: ids.otherMessage, isUpvoted: true },
      { chatId: ids.publicChat, messageId: ids.publicMessage, isUpvoted: true },
    ],
    documents: [
      {
        id: ids.document,
        userId: ids.owner,
        title: 'Owner document',
        content: 'Original owner text.',
        kind: 'text',
        createdAt: first,
      },
      {
        id: ids.document,
        userId: ids.owner,
        title: 'Owner document',
        content: 'Updated owner text.',
        kind: 'text',
        createdAt: second,
      },
      {
        id: ids.otherDocument,
        userId: ids.other,
        title: 'Other document',
        content: 'Confidential other account text.',
        kind: 'text',
        createdAt: first,
      },
    ],
    suggestions: [
      {
        id: ids.suggestion,
        documentId: ids.document,
        documentCreatedAt: second,
        userId: ids.owner,
        originalText: 'Updated owner text.',
        suggestedText: 'Improved owner text.',
        description: 'Make the text clearer',
        isResolved: false,
        createdAt: third,
      },
    ],
  };
}

module.exports = { accountFixtures, ids };
