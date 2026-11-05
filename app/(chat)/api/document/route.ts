import { auth } from '@/app/(auth)/auth';
import { z } from 'zod';
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentsById,
  saveDocument,
} from '@/lib/db/queries';

const idSchema = z.string().uuid();
const documentSchema = z.object({
  content: z.string(),
  title: z.string().min(1),
  kind: z.enum(['text', 'code', 'image', 'sheet']),
});
const rollbackSchema = z.object({
  timestamp: z.string().datetime({ offset: true }),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !idSchema.safeParse(id).success) {
    return new Response('Invalid document id', { status: 400 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const documents = await getDocumentsById({ id });

  const [document] = documents;

  if (!document) {
    return new Response('Not Found', { status: 404 });
  }

  const userId = session.user.id;
  if (documents.some((version) => version.userId !== userId)) {
    return new Response('Forbidden', { status: 403 });
  }

  return Response.json(documents, { status: 200 });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !idSchema.safeParse(id).success) {
    return new Response('Invalid document id', { status: 400 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = documentSchema.safeParse(body);
  if (!parsed.success) {
    return new Response('Invalid document', { status: 400 });
  }

  const documents = await getDocumentsById({ id });
  const userId = session.user.id;
  if (documents.some((version) => version.userId !== userId)) {
    return new Response('Forbidden', { status: 403 });
  }

  const document = await saveDocument({
    id,
    ...parsed.data,
    userId: session.user.id,
  });

  return Response.json(document, { status: 200 });
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !idSchema.safeParse(id).success) {
    return new Response('Invalid document id', { status: 400 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = rollbackSchema.safeParse(body);
  if (!parsed.success) {
    return new Response('Invalid rollback timestamp', { status: 400 });
  }

  const documents = await getDocumentsById({ id });

  const [document] = documents;

  if (!document) {
    return new Response('Not Found', { status: 404 });
  }

  const userId = session.user.id;
  if (documents.some((version) => version.userId !== userId)) {
    return new Response('Forbidden', { status: 403 });
  }

  await deleteDocumentsByIdAfterTimestamp({
    id,
    timestamp: new Date(parsed.data.timestamp),
  });

  return new Response('Deleted', { status: 200 });
}
