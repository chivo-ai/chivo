import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type ProcessCrewStudyPackRequest = {
  crewId: string;
};

type GeneratedCrewStudyPack = {
  title?: string;
  summary?: string;
  key_points?: string[];
  quiz?: Array<{
    prompt: string;
    options?: string[];
    answer?: string;
    explanation?: string;
  }>;
  flashcards?: Array<{
    front: string;
    back: string;
  }>;
  study_tasks?: string[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', getServiceRoleKey());

  try {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return json({ error: 'Authentication is required' }, 401);
    }

    const body = (await request.json()) as ProcessCrewStudyPackRequest;

    if (!body.crewId) {
      return json({ error: 'crewId is required' }, 400);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session' }, 401);
    }

    const { data: membership, error: membershipError } = await supabase
      .from('crew_memberships')
      .select('id, crew_id, role, status')
      .eq('crew_id', body.crewId)
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!membership) {
      return json({ error: 'Crew access is required' }, 403);
    }

    const { data: crew, error: crewError } = await supabase
      .from('lesson_crews')
      .select('id, name, username, school_id, scope')
      .eq('id', body.crewId)
      .single();

    if (crewError) {
      throw crewError;
    }

    const [messagesResult, resourcesResult] = await Promise.all([
      supabase
        .from('crew_messages')
        .select('body, created_at')
        .eq('crew_id', crew.id)
        .order('created_at', { ascending: false })
        .limit(80),
      supabase
        .from('crew_resources')
        .select('title, resource_type, content, created_at')
        .eq('crew_id', crew.id)
        .neq('resource_type', 'ai_pack')
        .order('created_at', { ascending: false })
        .limit(40),
    ]);

    if (messagesResult.error) {
      throw messagesResult.error;
    }

    if (resourcesResult.error) {
      throw resourcesResult.error;
    }

    const messages = (messagesResult.data ?? []) as Array<{ body: string; created_at: string }>;
    const resources = (resourcesResult.data ?? []) as Array<{
      title: string;
      resource_type: string;
      content: Record<string, unknown> | null;
      created_at: string;
    }>;

    const sourceText = buildCrewSource({ messages, resources });

    if (!sourceText.trim()) {
      return json({ error: 'Add crew messages or study notes before generating an AI pack.' }, 400);
    }

    const generated = await generateCrewStudyPack({
      crewName: crew.name,
      sourceText,
    });

    const { data: resource, error: insertError } = await supabase
      .from('crew_resources')
      .insert({
        crew_id: crew.id,
        created_by: user.id,
        title: generated.title ?? `${crew.name} study pack`,
        resource_type: 'ai_pack',
        content: {
          title: generated.title ?? `${crew.name} study pack`,
          summary: generated.summary ?? '',
          key_points: generated.key_points ?? [],
          quiz: generated.quiz ?? [],
          flashcards: generated.flashcards ?? [],
          study_tasks: generated.study_tasks ?? [],
          shared: true,
          generated_by: 'gemini',
          source: {
            message_count: messages.length,
            resource_count: resources.length,
          },
        },
      })
      .select('id, crew_id, created_by, lesson_id, title, resource_type, content, created_at')
      .single();

    if (insertError) {
      throw insertError;
    }

    await supabase.from('crew_messages').insert({
      crew_id: crew.id,
      sender_profile_id: user.id,
      body: `Chivo AI created a shared study pack: ${resource.title}`,
      resource_id: resource.id,
    });

    await notifyCrewMembers(supabase, {
      actorId: user.id,
      crew,
      resourceId: resource.id,
      resourceTitle: resource.title,
    });

    return json({ resource });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

async function generateCrewStudyPack(input: {
  crewName: string;
  sourceText: string;
}): Promise<GeneratedCrewStudyPack> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (!geminiKey) {
    throw new Error('Missing GEMINI_API_KEY function secret');
  }

  const prompt = [
    'You are Chivo AI, a study assistant for a learning crew.',
    'Create one shared crew study pack from the crew messages and shared notes.',
    'This is not personalized for one student. It must be useful for the whole crew.',
    'Return JSON only with: title, summary, key_points, quiz, flashcards, study_tasks.',
    'quiz should contain 5 questions. Each question must include prompt, options, answer, explanation.',
    'flashcards should contain 6 compact flashcards with front and back.',
    'study_tasks should contain 4 practical group revision actions.',
    `Crew name: ${input.crewName}`,
    'Crew source:',
    input.sourceText,
  ].join('\n\n');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini request failed: ${details}`);
  }

  const generated = await response.json();
  const text = generated.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const parsed = JSON.parse(text) as GeneratedCrewStudyPack;

  return {
    title: parsed.title ?? `${input.crewName} study pack`,
    summary: parsed.summary ?? '',
    key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
    quiz: Array.isArray(parsed.quiz) ? parsed.quiz : [],
    flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
    study_tasks: Array.isArray(parsed.study_tasks) ? parsed.study_tasks : [],
  };
}

function buildCrewSource(input: {
  messages: Array<{ body: string; created_at: string }>;
  resources: Array<{ title: string; resource_type: string; content: Record<string, unknown> | null; created_at: string }>;
}) {
  const resourceText = input.resources
    .map((resource) => {
      const note = typeof resource.content?.note === 'string' ? resource.content.note : JSON.stringify(resource.content ?? {});
      return [`Resource: ${resource.title}`, `Type: ${resource.resource_type}`, note].join('\n');
    })
    .join('\n\n');

  const messageText = input.messages
    .slice()
    .reverse()
    .map((message) => `Message: ${message.body}`)
    .join('\n');

  return [resourceText, messageText].filter(Boolean).join('\n\n');
}

async function notifyCrewMembers(
  supabaseClient: any,
  input: {
    actorId: string;
    crew: { id: string; name: string; username?: string | null; school_id: string | null };
    resourceId: string;
    resourceTitle: string;
  }
) {
  const { data: members, error } = await supabaseClient
    .from('crew_memberships')
    .select('profile_id')
    .eq('crew_id', input.crew.id)
    .eq('status', 'active');

  if (error) {
    console.error('Unable to load crew members for notifications', error.message);
    return;
  }

  const targetRoute = `/crews/${input.crew.username ?? input.crew.id}`;
  const rows = ((members ?? []) as Array<{ profile_id: string | null }>)
    .filter((member) => member.profile_id && member.profile_id !== input.actorId)
    .map((member) => ({
      profile_id: member.profile_id,
      school_id: input.crew.school_id,
      type: 'crew.ai_pack',
      title: `${input.crew.name} AI pack is ready`,
      body: input.resourceTitle,
      data: {
        crew_id: input.crew.id,
        crew_username: input.crew.username ?? null,
        resource_id: input.resourceId,
        target_route: targetRoute,
      },
    }));

  if (!rows.length) {
    return;
  }

  const { error: notificationError } = await supabaseClient.from('notifications').insert(rows);

  if (notificationError) {
    console.error('Unable to create crew AI notifications', notificationError.message);
  }
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
