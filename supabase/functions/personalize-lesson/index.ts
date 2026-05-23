import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type PersonalizeLessonRequest = {
  lessonId: string;
  studentMembershipId: string;
  language: string;
  learningMode: 'simple' | 'balanced' | 'exam' | 'story' | 'catch_up';
};

type GeneratedPersonalLesson = {
  title?: string;
  summary?: string;
  key_points?: string[];
  study_steps?: string[];
  vocabulary?: Array<{ term: string; meaning: string }>;
  quick_check?: Array<{ prompt: string; answer: string }>;
  encouragement?: string;
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

    const body = (await request.json()) as PersonalizeLessonRequest;

    if (!body.lessonId || !body.studentMembershipId || !body.language || !body.learningMode) {
      return json({ error: 'lessonId, studentMembershipId, language, and learningMode are required' }, 400);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session' }, 401);
    }

    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, school_id, class_id, subject_id, title, language, status')
      .eq('id', body.lessonId)
      .single();

    if (lessonError) {
      throw lessonError;
    }

    if (lesson.status !== 'published') {
      return json({ error: 'This lesson is not published yet' }, 400);
    }

    const { data: studentMembership, error: membershipError } = await supabase
      .from('school_memberships')
      .select('id, school_id, profile_id, role, status')
      .eq('id', body.studentMembershipId)
      .eq('school_id', lesson.school_id)
      .eq('profile_id', user.id)
      .eq('role', 'student')
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!studentMembership) {
      return json({ error: 'Student access is required' }, 403);
    }

    const { data: classMembership, error: classMembershipError } = await supabase
      .from('class_memberships')
      .select('id')
      .eq('class_id', lesson.class_id)
      .eq('school_membership_id', body.studentMembershipId)
      .eq('status', 'active')
      .maybeSingle();

    if (classMembershipError) {
      throw classMembershipError;
    }

    if (!classMembership) {
      return json({ error: 'Class access is required' }, 403);
    }

    const { data: output, error: outputError } = await supabase
      .from('lesson_outputs')
      .select('id, title, summary, key_points, content')
      .eq('lesson_id', lesson.id)
      .eq('output_type', 'master')
      .maybeSingle();

    if (outputError) {
      throw outputError;
    }

    if (!output?.summary) {
      return json({ error: 'Lesson materials are not ready yet' }, 400);
    }

    const generated = await generatePersonalLesson({
      title: output.title ?? lesson.title,
      sourceLanguage: lesson.language,
      targetLanguage: body.language,
      learningMode: body.learningMode,
      summary: output.summary,
      keyPoints: Array.isArray(output.key_points) ? output.key_points : [],
      content: output.content ?? {},
    });

    const { data: personalization, error: upsertError } = await supabase
      .from('lesson_personalizations')
      .upsert(
        {
          lesson_id: lesson.id,
          student_membership_id: body.studentMembershipId,
          output_id: output.id,
          language: body.language,
          learning_mode: body.learningMode,
          summary: generated.summary ?? output.summary,
          content: {
            title: generated.title ?? output.title ?? lesson.title,
            key_points: generated.key_points ?? [],
            study_steps: generated.study_steps ?? [],
            vocabulary: generated.vocabulary ?? [],
            quick_check: generated.quick_check ?? [],
            encouragement: generated.encouragement ?? '',
          },
        },
        { onConflict: 'lesson_id,student_membership_id,language,learning_mode' }
      )
      .select('id, lesson_id, student_membership_id, output_id, language, learning_mode, summary, content, audio_path, created_at')
      .single();

    if (upsertError) {
      throw upsertError;
    }

    return json({ personalization });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

async function generatePersonalLesson(input: {
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  learningMode: string;
  summary: string;
  keyPoints: string[];
  content: Record<string, unknown>;
}): Promise<GeneratedPersonalLesson> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (!geminiKey) {
    throw new Error('Missing GEMINI_API_KEY function secret');
  }

  const prompt = [
    'You are Chivo AI, a classroom learning assistant.',
    'Create a personalized study version for one student.',
    'Return JSON only with: title, summary, key_points, study_steps, vocabulary, quick_check, encouragement.',
    'vocabulary should contain term and meaning.',
    'quick_check should contain prompt and answer.',
    `Lesson title: ${input.title}`,
    `Original language: ${input.sourceLanguage}`,
    `Student language: ${input.targetLanguage}`,
    `Learning mode: ${learningModeLabel(input.learningMode)}`,
    'Master summary:',
    input.summary,
    'Master key points:',
    JSON.stringify(input.keyPoints),
    'Master content:',
    JSON.stringify(input.content),
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
  const parsed = JSON.parse(text) as GeneratedPersonalLesson;

  return {
    title: parsed.title ?? input.title,
    summary: parsed.summary ?? input.summary,
    key_points: Array.isArray(parsed.key_points) && parsed.key_points.length ? parsed.key_points : input.keyPoints,
    study_steps: Array.isArray(parsed.study_steps) ? parsed.study_steps : [],
    vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
    quick_check: Array.isArray(parsed.quick_check) ? parsed.quick_check : [],
    encouragement: parsed.encouragement ?? '',
  };
}

function learningModeLabel(mode: string) {
  const labels: Record<string, string> = {
    simple: 'simple and gentle',
    balanced: 'clear and balanced',
    exam: 'exam practice focused',
    story: 'story-like explanation',
    catch_up: 'catch-up for a student who missed parts of class',
  };

  return labels[mode] ?? labels.balanced;
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
