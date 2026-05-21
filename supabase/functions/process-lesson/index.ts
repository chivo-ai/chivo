import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type ProcessLessonRequest = {
  lessonId: string;
  studentId?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { lessonId, studentId } = (await request.json()) as ProcessLessonRequest;

    if (!lessonId) {
      return json({ error: 'lessonId is required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      getServiceRoleKey()
    );

    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('id, title, transcript, master_summary, language')
      .eq('id', lessonId)
      .single();

    if (error) {
      throw error;
    }

    const prompt = [
      'You are Chivo AI, a classroom learning assistant.',
      'Create a student-friendly lesson output from this classroom transcript.',
      'Return compact JSON with: summary, key_points, quiz, flashcards.',
      studentId ? `Personalize for student id: ${studentId}.` : 'Create the master lesson version.',
      `Lesson title: ${lesson.title}`,
      `Language: ${lesson.language}`,
      lesson.transcript ?? lesson.master_summary ?? '',
    ].join('\n\n');

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return json({ error: 'Missing GEMINI_API_KEY function secret' }, 500);
    }

    const geminiResponse = await fetch(
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

    if (!geminiResponse.ok) {
      const details = await geminiResponse.text();
      return json({ error: 'Gemini request failed', details }, 502);
    }

    const generated = await geminiResponse.json();
    const text = generated.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    return json({ lessonId, studentId, result: JSON.parse(text) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

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
