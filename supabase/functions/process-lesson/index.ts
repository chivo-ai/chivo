import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type ProcessLessonRequest = {
  lessonId: string;
};

type GeneratedLesson = {
  transcript?: string;
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

type AudioInput = {
  mimeType: string;
  buffer: ArrayBuffer;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const lessonResponseSchema = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING' },
    title: { type: 'STRING' },
    summary: { type: 'STRING' },
    key_points: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    quiz: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          prompt: { type: 'STRING' },
          options: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          answer: { type: 'STRING' },
          explanation: { type: 'STRING' },
        },
        required: ['prompt', 'options', 'answer', 'explanation'],
      },
    },
    flashcards: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          front: { type: 'STRING' },
          back: { type: 'STRING' },
        },
        required: ['front', 'back'],
      },
    },
  },
  required: ['title', 'summary', 'key_points', 'quiz', 'flashcards'],
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

    const { data: recording, error: recordingError } = transcriptText?.trim()
      ? { data: null, error: null }
      : await supabase
          .from('lesson_recordings')
          .select('storage_path, mime_type')
          .eq('lesson_id', lessonId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

    if (recordingError) {
      throw recordingError;
    }

    if (!transcriptText?.trim() && !recording?.storage_path) {
      return json({ error: 'Lesson transcript or audio is required before Chivo can prepare it' }, 400);
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

    const audio = transcriptText?.trim() ? null : await fetchLessonAudio(supabase, recording);
    const generated = await generateWithGemini({
      title: lesson.title,
      language: lesson.language,
      transcript: transcriptText?.trim() ? transcriptText : null,
      audio,
    });

    if (!transcriptText?.trim() && generated.transcript?.trim()) {
      await saveGeneratedTranscript(supabase, lesson.id, lesson.language, generated.transcript);
    }

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
  transcript: string | null;
  audio: AudioInput | null;
}): Promise<GeneratedLesson> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (!geminiKey) {
    throw new Error('Missing GEMINI_API_KEY function secret');
  }

  const prompt = [
    'You are Chivo AI, a classroom learning assistant.',
    input.audio
      ? 'Listen to the classroom audio, write a clean transcript, then create a student-friendly study pack.'
      : 'Create a student-friendly study pack from this classroom transcript.',
    'Return JSON only with: transcript, title, summary, key_points, quiz, flashcards.',
    'quiz should contain 5 questions. Each question must include prompt, options, answer, explanation.',
    'flashcards should contain 6 compact flashcards with front and back.',
    `Lesson title: ${input.title}`,
    `Language: ${input.language}`,
    input.transcript ?? '',
  ].join('\n\n');
  const parts = input.audio
    ? [{ text: prompt }, await createAudioPart(geminiKey, input.audio, input.title)]
    : [{ text: prompt }];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: lessonResponseSchema,
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
  const parsed = await parseGeneratedLesson(geminiKey, text, input);

  return {
    transcript: parsed.transcript ?? input.transcript ?? '',
    title: parsed.title ?? input.title,
    summary: parsed.summary ?? '',
    key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
    quiz: Array.isArray(parsed.quiz) ? parsed.quiz : [],
    flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
  };
}

async function parseGeneratedLesson(
  geminiKey: string,
  text: string,
  input: {
    title: string;
    language: string;
    transcript: string | null;
  }
): Promise<GeneratedLesson> {
  try {
    return JSON.parse(extractJson(text)) as GeneratedLesson;
  } catch (error) {
    const repaired = await repairGeneratedLessonJson(geminiKey, text, input);

    try {
      return JSON.parse(extractJson(repaired)) as GeneratedLesson;
    } catch {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      throw new Error(`Chivo AI returned malformed lesson JSON and repair failed: ${message}`);
    }
  }
}

async function repairGeneratedLessonJson(
  geminiKey: string,
  brokenJson: string,
  input: {
    title: string;
    language: string;
    transcript: string | null;
  }
) {
  const prompt = [
    'Repair this malformed JSON into valid JSON only.',
    'It must match this object shape: transcript, title, summary, key_points, quiz, flashcards.',
    'Do not add markdown, comments, or explanation.',
    'If one quiz or flashcard item is broken, fix it or remove that item.',
    `Lesson title: ${input.title}`,
    `Language: ${input.language}`,
    input.transcript ? `Transcript source: ${input.transcript.slice(0, 6000)}` : 'Transcript source: audio lesson',
    'Malformed JSON:',
    brokenJson,
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
          responseSchema: lessonResponseSchema,
        },
      }),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini JSON repair failed: ${details}`);
  }

  const repaired = await response.json();
  return repaired.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
}

function extractJson(value: string) {
  const trimmed = value.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

  if (trimmed.startsWith('{')) {
    return trimmed;
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

async function fetchLessonAudio(
  supabase: any,
  recording: { storage_path: string; mime_type: string | null } | null
): Promise<AudioInput | null> {
  if (!recording?.storage_path) {
    return null;
  }

  const { data, error } = await supabase.storage.from('chivo-lesson-audio').download(recording.storage_path);

  if (error) {
    throw error;
  }

  const buffer = await data.arrayBuffer();
  return {
    mimeType: geminiAudioMimeType(recording.mime_type ?? data.type ?? 'audio/aac'),
    buffer,
  };
}

function geminiAudioMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase().split(';')[0].trim();

  if (['audio/m4a', 'audio/x-m4a', 'audio/mp4'].includes(normalized)) {
    return 'audio/aac';
  }

  if (normalized === 'audio/mpeg') {
    return 'audio/mp3';
  }

  if (normalized === 'audio/webm') {
    throw new Error('This browser audio format needs a transcript before Chivo can prepare it.');
  }

  return normalized;
}

async function createAudioPart(geminiKey: string, audio: AudioInput, displayName: string) {
  const inlineLimitBytes = 18 * 1024 * 1024;

  if (audio.buffer.byteLength <= inlineLimitBytes) {
    return {
      inline_data: {
        mime_type: audio.mimeType,
        data: arrayBufferToBase64(audio.buffer),
      },
    };
  }

  const file = await uploadAudioToGemini(geminiKey, audio, displayName);
  return {
    file_data: {
      mime_type: file.mimeType,
      file_uri: file.uri,
    },
  };
}

async function uploadAudioToGemini(geminiKey: string, audio: AudioInput, displayName: string) {
  const startResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': `${audio.buffer.byteLength}`,
      'X-Goog-Upload-Header-Content-Type': audio.mimeType,
    },
    body: JSON.stringify({
      file: {
        display_name: displayName.slice(0, 80) || 'lesson-audio',
      },
    }),
  });

  if (!startResponse.ok) {
    const details = await startResponse.text();
    throw new Error(`Gemini audio upload failed: ${details}`);
  }

  const uploadUrl = startResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('Gemini audio upload URL was not returned');
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': `${audio.buffer.byteLength}`,
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: audio.buffer,
  });

  if (!uploadResponse.ok) {
    const details = await uploadResponse.text();
    throw new Error(`Gemini audio upload failed: ${details}`);
  }

  const payload = await uploadResponse.json();
  const file = payload.file;

  if (!file?.uri) {
    throw new Error('Gemini audio file URI was not returned');
  }

  return {
    uri: file.uri as string,
    mimeType: (file.mimeType as string | undefined) ?? audio.mimeType,
  };
}

async function saveGeneratedTranscript(
  supabase: any,
  lessonId: string,
  language: string,
  transcript: string
) {
  const { error } = await supabase.from('lesson_transcripts').upsert(
    {
      lesson_id: lessonId,
      provider: 'gemini',
      language,
      raw_text: transcript.trim(),
      cleaned_text: transcript.trim(),
    },
    { onConflict: 'lesson_id,provider,language' }
  );

  if (error) {
    throw error;
  }
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

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
