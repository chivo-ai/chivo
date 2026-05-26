import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type ChivoGuideMessage = {
  role?: 'assistant' | 'user';
  content?: string;
};

type ChivoGuideRequest = {
  question?: string;
  threadId?: string | null;
  scope?: string;
  inputType?: 'text' | 'voice';
};

type AiChatThreadRow = {
  id: string;
  profile_id: string;
  scope: string;
  title: string;
};

type AiChatMessageRow = {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  input_type: 'text' | 'voice';
  created_at: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const serviceRoleKey = getServiceRoleKey();

  if (!serviceRoleKey) {
    return json({ error: 'Missing SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY function secret for Chivo AI chat memory.' }, 500);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey);

  try {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return json({ error: 'Authentication is required' }, 401);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session' }, 401);
    }

    const body = (await request.json()) as ChivoGuideRequest;
    const question = body.question?.trim();

    if (!question) {
      return json({ error: 'Ask Chivo AI a question first.' }, 400);
    }

    const scope = guideScope(body.scope);
    const thread = await getOrCreateThread(supabase, {
      profileId: user.id,
      threadId: body.threadId,
      scope,
      question,
    });

    const { error: userMessageError } = await supabase.from('ai_chat_messages').insert({
      thread_id: thread.id,
      profile_id: user.id,
      role: 'user',
      content: question,
      input_type: body.inputType === 'voice' ? 'voice' : 'text',
    });

    if (userMessageError) {
      throw userMessageError;
    }

    const history = await fetchThreadMessages(supabase, thread.id);
    const answer = await generateGuideAnswer({
      question,
      history,
    });

    const { error: assistantMessageError } = await supabase.from('ai_chat_messages').insert({
      thread_id: thread.id,
      profile_id: user.id,
      role: 'assistant',
      content: answer,
      input_type: 'text',
      metadata: {
        model: 'gemini-2.5-flash',
      },
    });

    if (assistantMessageError) {
      throw assistantMessageError;
    }

    await supabase
      .from('ai_chat_threads')
      .update({
        title: thread.title === 'Chivo AI guide' ? titleFromQuestion(question) : thread.title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', thread.id)
      .eq('profile_id', user.id);

    return json({
      answer,
      threadId: thread.id,
    });
  } catch (error) {
    return json({ error: readableError(error) }, 500);
  }
});

async function getOrCreateThread(
  supabase: any,
  input: {
    profileId: string;
    threadId?: string | null;
    scope: string;
    question: string;
  }
): Promise<AiChatThreadRow> {
  if (input.threadId) {
    const { data, error } = await supabase
      .from('ai_chat_threads')
      .select('id, profile_id, scope, title')
      .eq('id', input.threadId)
      .eq('profile_id', input.profileId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data as AiChatThreadRow;
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from('ai_chat_threads')
    .select('id, profile_id, scope, title')
    .eq('profile_id', input.profileId)
    .eq('scope', input.scope)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing as AiChatThreadRow;
  }

  const { data: created, error: createError } = await supabase
    .from('ai_chat_threads')
    .insert({
      profile_id: input.profileId,
      scope: input.scope,
      title: titleFromQuestion(input.question),
      metadata: {
        origin: 'home',
      },
    })
    .select('id, profile_id, scope, title')
    .single();

  if (createError) {
    throw createError;
  }

  return created as AiChatThreadRow;
}

async function fetchThreadMessages(supabase: any, threadId: string): Promise<ChivoGuideMessage[]> {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('id, role, content, input_type, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(18);

  if (error) {
    throw error;
  }

  return ((data ?? []) as AiChatMessageRow[])
    .slice()
    .reverse()
    .filter((message) => message.role === 'assistant' || message.role === 'user')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

async function generateGuideAnswer(input: {
  question: string;
  history: ChivoGuideMessage[];
}) {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (!geminiKey) {
    throw new Error('Missing GEMINI_API_KEY function secret');
  }

  const historyText = input.history
    .filter((message) => message.content?.trim())
    .map((message) => `${message.role === 'user' ? 'User' : 'Chivo AI'}: ${message.content?.trim()}`)
    .join('\n');

  const prompt = [
    'You are Chivo AI, the friendly product and learning guide inside the Chivo AI app.',
    'Chivo AI helps schools, teachers, students, creators, and study crews turn real lessons into audio, transcripts, summaries, quizzes, flashcards, progress, and multilingual study experiences.',
    'The product supports school spaces, class spaces, teacher lesson recording, uploaded lessons, AI summaries, quizzes, flashcards, study progress, crew study tools, class chat, voice notes, and shared AI packs. Some payment, publishing, moderation, rewards, and on-chain features are planned future phases.',
    'Answer clearly and practically. Keep the tone warm, confident, and education-focused.',
    'You can discuss Chivo AI, schools, classes, study methods, AI learning, science, art, nature, research, lesson planning, classroom support, and student learning.',
    'If a question is far outside education, school, research, learning, or Chivo AI, briefly redirect it back to learning or how Chivo AI can help.',
    'Do not claim features are fully available if they are future roadmap items. Say "planned" or "future" when needed.',
    'Keep answers compact unless the user asks for deep detail.',
    historyText ? `Recent chat:\n${historyText}` : 'Recent chat: none',
    `User question: ${input.question}`,
  ].join('\n\n');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: 600,
        },
      }),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini request failed: ${details}`);
  }

  const generated = await response.json();
  return generated.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Chivo AI is ready, but I could not form an answer for that question.';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getServiceRoleKey() {
  return Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

function readableError(error: unknown) {
  if (error instanceof Error) {
    return withSetupHint(error.message);
  }

  if (error && typeof error === 'object') {
    const payload = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const message = [payload.message, payload.details, payload.hint, payload.code]
      .filter(Boolean)
      .map(String)
      .join(' ');

    if (message) {
      return withSetupHint(message);
    }
  }

  try {
    return withSetupHint(JSON.stringify(error));
  } catch {
    return 'Chivo AI chat failed, but the function did not return a readable error.';
  }
}

function withSetupHint(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes('ai_chat_threads')
    || lower.includes('ai_chat_messages')
    || lower.includes('relation')
  ) {
    return `AI chat memory is not ready. Run supabase/group12-ai-chat-memory-upgrade.sql in Supabase SQL, then retry. Details: ${message}`;
  }

  if (lower.includes('invalid api key') || lower.includes('service_role')) {
    return `Chivo AI chat memory needs the SERVICE_ROLE_KEY function secret. Details: ${message}`;
  }

  return message || 'Chivo AI chat failed.';
}

function guideScope(value?: string) {
  if (['home_guide', 'lesson_tutor', 'class_tutor', 'crew_tutor', 'school_guide'].includes(value ?? '')) {
    return value as string;
  }

  return 'home_guide';
}

function titleFromQuestion(question: string) {
  const clean = question.replace(/\s+/g, ' ').trim();

  if (!clean) {
    return 'Chivo AI guide';
  }

  return clean.length > 48 ? `${clean.slice(0, 45)}...` : clean;
}
