'use client';

import { updateChatVisibility } from '@/app/(chat)/actions';
import { VisibilityType } from '@/components/visibility-selector';
import { Chat } from '@/lib/db/schema';
import { useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';

export function useChatVisibility({
  chatId,
  initialVisibility,
}: {
  chatId: string;
  initialVisibility: VisibilityType;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { mutate, cache } = useSWRConfig();
  const history: Array<Chat> = cache.get('/api/history')?.data;

  const { data: localVisibility, mutate: setLocalVisibility } = useSWR(
    `${chatId}-visibility`,
    null,
    {
      fallbackData: initialVisibility,
    },
  );

  const visibilityType = useMemo(() => {
    if (!history) return localVisibility;
    const chat = history.find((chat) => chat.id === chatId);
    if (!chat) return localVisibility;
    return chat.visibility;
  }, [history, chatId, localVisibility]);

  const setVisibilityType = async (updatedVisibilityType: VisibilityType) => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      await updateChatVisibility({
        chatId,
        visibility: updatedVisibilityType,
      });
      await setLocalVisibility(updatedVisibilityType);

      await mutate<Array<Chat>>(
        '/api/history',
        (history) => {
          return history?.map((chat) => {
            if (chat.id === chatId) {
              return { ...chat, visibility: updatedVisibilityType };
            }
            return chat;
          });
        },
        { revalidate: false },
      );
    } catch {
      toast.error('Could not change chat visibility. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return { visibilityType, setVisibilityType, isUpdating };
}
