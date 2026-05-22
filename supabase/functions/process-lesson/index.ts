import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type ProcessLessonRequest = {
  lessonId: string;
};

type GeneratedLesson = {
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
  let jobId: string | null = null;
  let lessonId: string | null = null;

  try {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return json({ error: 'Authentication is required' }, 401);
    }

    const body = (await request.json()) as ProcessLessonRequest;
    lessonId = body.lessonId;

    if (!lessonId) {
      return json({ error: 'lessonId is required' }, 400);
    }

    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, school_id, title, language')
      .eq('id', lessonId)
      .single();

    if (lessonError) {
      throw lessonError;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session' }, 401);
    }

    const { data: staffMembership, error: staffError } = await supabase
      .from('school_memberships')
      .select('id')
      .eq('school_id', lesson.school_id)
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .in('role', ['owner', 'admin', 'teacher'])
      .maybeSingle();

    if (staffError) {
      throw staffError;
    }

    if (!staffMembership) {
      return json({ error: 'Teacher access is required' }, 403);
    }

    const { data: transcript, error: transcriptError } = await supabase
      .from('lesson_transcripts')
      .select('cleaned_text, raw_text')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (transcriptError) {
      throw transcriptError;
    }

    const transcriptText = transcript?.cleaned_text ?? transcript?.raw_text;

    if (!transcriptText?.trim()) {
      return json({ error: 'Lesson transcript is required before AI processing' }, 400);
    }

    const { data: job, error: jobError } = await supabase
      .from('ai_processing_jobs')
      .insert({
        school_id: lesson.school_id,
        lesson_id: lesson.id,
        provider: 'gemini',
        job_type: 'lesson.study_pack',
        status: 'running',
        input: { lesson_id: lesson.id, title: lesson.title },
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (jobError) {
      throw jobError;
    }

    jobId = job.id;

    await supabase.from('lessons').update({ status: 'transcribing' }).eq('id', lesson.id);

    const generated = await generateWithGemini({
      title: lesson.title,
      language: lesson.language,
      transcript: transcriptText,
    });

    await replaceGeneratedLesson(supabase, lesson.id, lesson.language, generated);

    await supabase
      .from('lessons')
      .update({ status: 'review' })
      .eq('id', lesson.id);

    await supabase
      .from('ai_processing_jobs')
      .update({
        status: 'completed',
        output: generated,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return json({ lessonId: lesson.id, result: generated });
  } catch (error) {
    if (lessonId) {
      await supabase.from('lessons').update({ status: 'failed' }).eq('id', lessonId);
    }

    if (jobId) {
      await supabase
        .from('ai_processing_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

async function generateWithGemini(input: {
  title: string;
  language: string;
  transcript: string;
}): Promise<GeneratedLesson> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (!geminiKey) {
    throw new Error('Missing GEMINI_API_KEY function secret');
  }

  const prompt = [
    'You are Chivo AI, a classroom learning assistant.',
    'Create a student-friendly study pack from this classroom transcript.',
    'Return JSON only with: title, summary, key_points, quiz, flashcards.',
    'quiz should contain 5 questions. Each question must include prompt, options, answer, explanation.',
    'flashcards should contain 6 compact flashcards with front and back.',
    `Lesson title: ${input.title}`,
    `Language: ${input.language}`,
    input.transcript,
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
  const parsed = JSON.parse(text) as GeneratedLesson;

  return {
    title: parsed.title ?? input.title,
    summary: parsed.summary ?? '',
    key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
    quiz: Array.isArray(parsed.quiz) ? parsed.quiz : [],
    flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
  };
}

async function replaceGeneratedLesson(
  supabase: any,
  lessonId: string,
  language: string,
  generated: GeneratedLesson
) {
  const { data: existingQuizzes } = await supabase
    .from('quizzes')
    .select('id')
    .eq('lesson_id', lessonId);

  const quizIds = ((existingQuizzes ?? []) as Array<{ id: string }>).map((quiz) => quiz.id);

  if (quizIds.length) {
    await supabase.from('quiz_questions').delete().in('quiz_id', quizIds);
    await supabase.from('quizzes').delete().in('id', quizIds);
  }

  await supabase.from('flashcards').delete().eq('lesson_id', lessonId);
  await supabase.from('lesson_outputs').delete().eq('lesson_id', lessonId).eq('output_type', 'master');

  const { error: outputError } = await supabase.from('lesson_outputs').insert({
    lesson_id: lessonId,
    output_type: 'master',
    language,
    title: generated.title ?? null,
    summary: generated.summary ?? null,
    key_points: generated.key_points ?? [],
    content: {
      quiz: generated.quiz ?? [],
      flashcards: generated.flashcards ?? [],
    },
  });

  if (outputError) {
    throw outputError;
  }

  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .insert({
      lesson_id: lessonId,
      title: `${generated.title ?? 'Lesson'} quiz`,
      learning_mode: 'balanced',
    })
    .select('id')
    .single();

  if (quizError) {
    throw quizError;
  }

  const questions = (generated.quiz ?? []).map((question, index) => ({
    quiz_id: quiz.id,
    position: index + 1,
    prompt: question.prompt,
    options: question.options ?? [],
    answer: question.answer ?? null,
    explanation: question.explanation ?? null,
  }));

  if (questions.length) {
    const { error } = await supabase.from('quiz_questions').insert(questions);
    if (error) {
      throw error;
    }
  }

  const flashcards = (generated.flashcards ?? []).map((flashcard) => ({
    lesson_id: lessonId,
    language,
    front: flashcard.front,
    back: flashcard.back,
  }));

  if (flashcards.length) {
    const { error } = await supabase.from('flashcards').insert(flashcards);
    if (error) {
      throw error;
    }
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
