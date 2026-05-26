import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type ProcessClassStudyPackRequest = {
  classId: string;
};

type GeneratedClassStudyPack = {
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

    const body = (await request.json()) as ProcessClassStudyPackRequest;

    if (!body.classId) {
      return json({ error: 'classId is required' }, 400);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session' }, 401);
    }

    const { data: schoolClass, error: classError } = await supabase
      .from('classes')
      .select('id, school_id, name, username, grade_level')
      .eq('id', body.classId)
      .single();

    if (classError) {
      throw classError;
    }

    const hasAccess = await hasClassAccess(supabase, body.classId, schoolClass.school_id, user.id);

    if (!hasAccess) {
      return json({ error: 'Class access is required' }, 403);
    }

    const [messagesResult, resourcesResult] = await Promise.all([
      supabase
        .from('class_messages')
        .select('body, created_at')
        .eq('class_id', schoolClass.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('class_resources')
        .select('title, resource_type, content, created_at')
        .eq('class_id', schoolClass.id)
        .neq('resource_type', 'ai_pack')
        .order('created_at', { ascending: false })
        .limit(80),
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
    const sourceText = buildClassSource({ messages, resources });

    if (!sourceText.trim()) {
      return json({ error: 'Add class messages, notes, or voice transcripts before generating an AI pack.' }, 400);
    }

    const generated = await generateClassStudyPack({
      className: schoolClass.name,
      gradeLevel: schoolClass.grade_level ?? '',
      sourceText,
    });

    const { data: resource, error: insertError } = await supabase
      .from('class_resources')
      .insert({
        class_id: schoolClass.id,
        created_by: user.id,
        title: generated.title ?? `${schoolClass.name} study pack`,
        resource_type: 'ai_pack',
        content: {
          title: generated.title ?? `${schoolClass.name} study pack`,
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
      .select('id, class_id, created_by, lesson_id, title, resource_type, content, created_at')
      .single();

    if (insertError) {
      throw insertError;
    }

    await supabase.from('class_messages').insert({
      class_id: schoolClass.id,
      sender_profile_id: user.id,
      body: `Chivo AI created a shared class study pack: ${resource.title}`,
      resource_id: resource.id,
    });

    await notifyClassMembers(supabase, {
      actorId: user.id,
      classId: schoolClass.id,
      className: schoolClass.name,
      classUsername: schoolClass.username,
      schoolId: schoolClass.school_id,
      resourceId: resource.id,
      resourceTitle: resource.title,
    });

    return json({ resource });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

async function hasClassAccess(supabase: any, classId: string, schoolId: string, userId: string) {
  const [classMembership, schoolRole, subjectTeacher] = await Promise.all([
    supabase
      .from('class_memberships')
      .select('id, school_memberships!inner(profile_id, status)')
      .eq('class_id', classId)
      .eq('status', 'active')
      .eq('school_memberships.profile_id', userId)
      .eq('school_memberships.status', 'active')
      .maybeSingle(),
    supabase
      .from('school_memberships')
      .select('id')
      .eq('school_id', schoolId)
      .eq('profile_id', userId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin', 'teacher'])
      .maybeSingle(),
    supabase
      .from('class_subjects')
      .select('id, school_memberships!inner(profile_id, status)')
      .eq('class_id', classId)
      .eq('school_memberships.profile_id', userId)
      .eq('school_memberships.status', 'active')
      .maybeSingle(),
  ]);

  if (classMembership.error || schoolRole.error || subjectTeacher.error) {
    throw classMembership.error ?? schoolRole.error ?? subjectTeacher.error;
  }

  return Boolean(classMembership.data || schoolRole.data || subjectTeacher.data);
}

async function generateClassStudyPack(input: {
  className: string;
  gradeLevel: string;
  sourceText: string;
}): Promise<GeneratedClassStudyPack> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (!geminiKey) {
    throw new Error('Missing GEMINI_API_KEY function secret');
  }

  const prompt = [
    'You are Chivo AI, a classroom study assistant.',
    'Create one shared class study pack from class messages, notes, voice transcripts, and live-session records.',
    'This is for the whole class, not one student.',
    'Return JSON only with: title, summary, key_points, quiz, flashcards, study_tasks.',
    'quiz should contain 5 questions. Each question must include prompt, options, answer, explanation.',
    'flashcards should contain 6 compact flashcards with front and back.',
    'study_tasks should contain 4 practical revision actions for the class.',
    `Class name: ${input.className}`,
    `Grade level: ${input.gradeLevel || 'Not set'}`,
    'Class source:',
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
  const parsed = JSON.parse(text) as GeneratedClassStudyPack;

  return {
    title: parsed.title ?? `${input.className} study pack`,
    summary: parsed.summary ?? '',
    key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
    quiz: Array.isArray(parsed.quiz) ? parsed.quiz : [],
    flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
    study_tasks: Array.isArray(parsed.study_tasks) ? parsed.study_tasks : [],
  };
}

function buildClassSource(input: {
  messages: Array<{ body: string; created_at: string }>;
  resources: Array<{ title: string; resource_type: string; content: Record<string, unknown> | null; created_at: string }>;
}) {
  const resourceText = input.resources
    .map((resource) => {
      const content = resource.content ?? {};
      const text = typeof content.note === 'string'
        ? content.note
        : typeof content.transcript === 'string'
          ? content.transcript
          : typeof content.summary === 'string'
            ? content.summary
            : JSON.stringify(content);

      return [`Resource: ${resource.title}`, `Type: ${resource.resource_type}`, text].join('\n');
    })
    .join('\n\n');

  const messageText = input.messages
    .slice()
    .reverse()
    .map((message) => `Message: ${message.body}`)
    .join('\n');

  return [resourceText, messageText].filter(Boolean).join('\n\n');
}

async function notifyClassMembers(
  supabase: any,
  input: {
    actorId: string;
    classId: string;
    className: string;
    classUsername: string;
    schoolId: string;
    resourceId: string;
    resourceTitle: string;
  }
) {
  const { data: memberships, error } = await supabase
    .from('class_memberships')
    .select('school_memberships!inner(profile_id)')
    .eq('class_id', input.classId)
    .eq('status', 'active');

  if (error) {
    console.error('Unable to load class members for notifications', error.message);
    return;
  }

  const rows = ((memberships ?? []) as Array<{ school_memberships?: { profile_id?: string } | Array<{ profile_id?: string }> }>)
    .map((membership) => Array.isArray(membership.school_memberships)
      ? membership.school_memberships[0]?.profile_id
      : membership.school_memberships?.profile_id)
    .filter((profileId): profileId is string => Boolean(profileId && profileId !== input.actorId))
    .map((profileId) => ({
      profile_id: profileId,
      school_id: input.schoolId,
      type: 'class.ai_pack',
      title: `${input.className} AI pack is ready`,
      body: input.resourceTitle,
      data: {
        class_id: input.classId,
        class_username: input.classUsername,
        resource_id: input.resourceId,
        target_route: `/school/class/${input.classUsername}`,
      },
    }));

  if (!rows.length) {
    return;
  }

  const { error: notificationError } = await supabase.from('notifications').insert(rows);

  if (notificationError) {
    console.error('Unable to create class AI notifications', notificationError.message);
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
