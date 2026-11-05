import { auth } from '@/app/(auth)/auth';
import {
  getChatById,
  getMessageById,
  getVotesByChatId,
  voteMessage,
} from '@/lib/db/queries';
import { z } from 'zod';

const voteSchema = z.object({
  chatId: z.string().uuid(),
  messageId: z.string().uuid(),
  type: z.enum(['up', 'down']),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId || !z.string().uuid().safeParse(chatId).success) {
    return new Response('Valid chatId is required', { status: 400 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const chat = await getChatById({ id: chatId });
  // A new chat exists in browser state before the first successful send.
  if (!chat) return Response.json([], { status: 200 });
  if (chat.userId !== session.user.id && chat.visibility !== 'public') {
    return new Response('Forbidden', { status: 403 });
  }

  const votes = await getVotesByChatId({ id: chatId });

  return Response.json(votes, { status: 200 });
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) return new Response('Invalid vote', { status: 400 });
  const { chatId, messageId, type } = parsed.data;

  const chat = await getChatById({ id: chatId });
  if (!chat) return new Response('Not Found', { status: 404 });
  if (chat.userId !== session.user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  const [message] = await getMessageById({ id: messageId });
  if (!message || message.chatId !== chatId) {
    return new Response('Not Found', { status: 404 });
  }

  await voteMessage({
    chatId,
    messageId,
    type: type,
  });

  return new Response('Message voted', { status: 200 });
}
