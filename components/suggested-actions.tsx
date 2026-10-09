'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import type { ChatRequestOptions, CreateMessage, Message } from 'ai';
import { memo, useState } from 'react';

interface SuggestedActionsProps {
  chatId: string;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
}

const suggestedActions = [
  { title: 'Build a React component', label: 'with a step-by-step explanation', action: 'Help me build an accessible React contact form. Explain each step and include validation.' },
  { title: 'Help me debug', label: 'an error in my code', action: 'Help me debug my code. Ask me for the error message, relevant code, and what I expected to happen.' },
  { title: 'Explain a coding concept', label: 'using a simple example', action: 'Teach me how async and await work in JavaScript, using a simple example and a short practice exercise.' },
  { title: 'Plan my learning', label: 'to become an AI developer', action: 'Help me plan a practical learning week for AI-assisted full-stack development. First ask about my experience and available time.' },
  { title: 'Design an API', label: 'for a full-stack app', action: 'Help me design a REST API for a task manager, including endpoints, validation, authentication, and example requests.' },
  { title: 'Practice Python', label: 'with a beginner-friendly challenge', action: 'Give me a beginner-friendly Python exercise, a few hints, and a way to check my answer. Let me try before showing the solution.' },
  { title: 'Improve my app', label: 'with a useful testing checklist', action: 'Help me create a practical testing checklist for a chatbot with sign-in, saved conversations, and streamed replies.' },
  { title: 'Prepare for an interview', label: 'with coding questions and feedback', action: 'Run a junior full-stack developer mock interview. Ask one question at a time and give constructive feedback on my answers.' },
  { title: 'Write a professional email', label: 'in a clear, friendly tone', action: 'Help me write a clear, friendly professional email. First ask who it is for, what I want to say, and the outcome I need.' },
  { title: 'Summarize something', label: 'into the key points and next steps', action: 'Help me summarize some text into key points and next steps. Ask me to paste the text and tell you who the summary is for.' },
  { title: 'Brainstorm a project', label: 'I can build for my portfolio', action: 'Help me brainstorm three useful AI app ideas for my portfolio. Ask about my interests and skill level, then suggest a small first version of each.' },
  { title: 'Organize my day', label: 'into realistic, focused work blocks', action: 'Help me organize my day into realistic work blocks with breaks. Ask about my priorities, deadlines, and available hours first.' },
];

function PureSuggestedActions({ chatId, append }: SuggestedActionsProps) {
  const [page, setPage] = useState(0);
  const pageSize = 4;
  const pageCount = Math.ceil(suggestedActions.length / pageSize);
  const visibleActions = suggestedActions.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <section aria-label="Conversation starters" className="w-full space-y-2">
      <div className="grid sm:grid-cols-2 gap-2 w-full">
        {visibleActions.map((suggestedAction, index) => (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 * index }}
            key={suggestedAction.title}
          >
            <Button
              variant="ghost"
              onClick={() => {
                window.history.replaceState({}, '', `/chat/${chatId}`);
                void append({ role: 'user', content: suggestedAction.action });
              }}
              className="text-left border rounded-xl px-4 py-3 text-sm flex-col gap-1 w-full h-full whitespace-normal justify-start items-start"
            >
              <span className="font-medium">{suggestedAction.title}</span>
              <span className="text-muted-foreground">{suggestedAction.label}</span>
            </Button>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span aria-live="polite" className="text-xs text-muted-foreground">Ideas {page * pageSize + 1}–{Math.min((page + 1) * pageSize, suggestedActions.length)} of {suggestedActions.length}</span>
        <Button variant="ghost" size="sm" type="button" onClick={() => setPage((current) => (current + 1) % pageCount)}>More ideas</Button>
      </div>
    </section>
  );
}

export const SuggestedActions = memo(PureSuggestedActions);
