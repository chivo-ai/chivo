import { supabase } from '../lib/supabase';

export type ChivoGuideMessage = {
  role: 'assistant' | 'user';
  content: string;
};

export type ChivoGuideStoredMessage = ChivoGuideMessage & {
  id: string;
  inputType: 'text' | 'voice';
  createdAt: string;
};

export type ChivoGuideThread = {
  id: string;
  title: string;
  scope: string;
  messages: ChivoGuideStoredMessage[];
};

export async function askChivoGuide(input: {
  question: string;
  threadId?: string | null;
  scope?: string;
  inputType?: 'text' | 'voice';
}) {
  if (!supabase) {
    throw new Error('Chivo AI is not configured yet.');
  }

  const { data, error } = await supabase.functions.invoke('chivo-guide-chat', {
    body: {
      question: input.question,
      threadId: input.threadId ?? null,
      scope: input.scope ?? 'home_guide',
      inputType: input.inputType ?? 'text',
    },
  });

  if (error) {
    throw new Error(await readableFunctionError(error));
  }

  const payload = data as { answer?: string; threadId?: string };
  const answer = payload.answer?.trim();

  if (!answer) {
    throw new Error('Chivo AI did not return an answer.');
  }

  return {
    answer,
    threadId: payload.threadId ?? input.threadId ?? null,
  };
}

export async function fetchChivoGuideHistory(scope = 'home_guide'): Promise<ChivoGuideThread | null> {
  if (!supabase) {
    throw new Error('Chivo AI is not configured yet.');
  }

  const { data: thread, error: threadError } = await (supabase as any)
    .from('ai_chat_threads')
    .select('id, title, scope')
    .eq('scope', scope)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (threadError) {
    throw new Error(threadError.message);
  }

  if (!thread) {
    return null;
  }

  const { data: messages, error: messagesError } = await (supabase as any)
    .from('ai_chat_messages')
    .select('id, role, content, input_type, created_at')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })
    .limit(80);

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  return {
    id: thread.id,
    title: thread.title ?? 'Chivo AI guide',
    scope: thread.scope ?? scope,
    messages: ((messages ?? []) as Array<{
      id: string;
      role: 'assistant' | 'user';
      content: string;
      input_type: 'text' | 'voice';
      created_at: string;
    }>)
      .filter((message) => message.role === 'assistant' || message.role === 'user')
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        inputType: message.input_type ?? 'text',
        createdAt: message.created_at,
      })),
  };
}

async function readableFunctionError(error: { message?: string; context?: unknown }) {
  const fallback = error.message ?? 'Chivo AI request failed.';
  const context = error.context as { json?: () => Promise<unknown>; text?: () => Promise<string> } | undefined;

  try {
    if (context?.json) {
      const payload = await context.json();
      if (payload && typeof payload === 'object' && 'error' in payload) {
        return String((payload as { error?: unknown }).error || fallback);
      }
    }

    if (context?.text) {
      const text = await context.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: unknown };
          return String(parsed.error || text || fallback);
        } catch {
          return text;
        }
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}
