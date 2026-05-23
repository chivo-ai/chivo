import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type QuizAttemptAnswerInput = {
  questionId: string;
  selectedAnswer: string;
};

type SubmitQuizAttemptRequest = {
  quizId: string;
  studentMembershipId: string;
  answers: QuizAttemptAnswerInput[];
};

type QuizQuestion = {
  id: string;
  prompt: string;
  answer: string | null;
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

    const body = (await request.json()) as SubmitQuizAttemptRequest;

    if (!body.quizId || !body.studentMembershipId || !Array.isArray(body.answers)) {
      return json({ error: 'quizId, studentMembershipId, and answers are required' }, 400);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session' }, 401);
    }

    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('id, lesson_id')
      .eq('id', body.quizId)
      .single();

    if (quizError) {
      throw quizError;
    }

    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, school_id, class_id, subject_id, title, status')
      .eq('id', quiz.lesson_id)
      .single();

    if (lessonError) {
      throw lessonError;
    }

    if (lesson.status !== 'published') {
      return json({ error: 'This lesson is not published yet' }, 400);
    }

    const { data: membership, error: membershipError } = await supabase
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

    if (!membership) {
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

    const { data: questions, error: questionsError } = await supabase
      .from('quiz_questions')
      .select('id, prompt, answer')
      .eq('quiz_id', body.quizId)
      .order('position', { ascending: true });

    if (questionsError) {
      throw questionsError;
    }

    const checkedAnswers = ((questions ?? []) as QuizQuestion[]).map((question) => {
      const submitted = body.answers.find((answer) => answer.questionId === question.id);
      const selectedAnswer = submitted?.selectedAnswer ?? '';
      const isCorrect = normalizeAnswer(selectedAnswer) === normalizeAnswer(question.answer ?? '');

      return {
        questionId: question.id,
        prompt: question.prompt,
        selectedAnswer,
        correctAnswer: question.answer,
        isCorrect,
      };
    });

    const correct = checkedAnswers.filter((answer) => answer.isCorrect).length;
    const score = checkedAnswers.length ? Number(((correct / checkedAnswers.length) * 100).toFixed(2)) : 0;

    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: body.quizId,
        student_membership_id: body.studentMembershipId,
        score,
        answers: checkedAnswers,
        completed_at: new Date().toISOString(),
      })
      .select('id, quiz_id, student_membership_id, score, answers, completed_at, created_at')
      .single();

    if (attemptError) {
      throw attemptError;
    }

    await updateProgress(supabase, {
      studentMembershipId: body.studentMembershipId,
      lessonId: lesson.id,
      subjectId: lesson.subject_id,
      topic: lesson.title,
      score,
      wrongAnswers: checkedAnswers.filter((answer) => !answer.isCorrect),
    });

    return json({ attempt, score, correct, total: checkedAnswers.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

async function updateProgress(
  supabase: any,
  input: {
    studentMembershipId: string;
    lessonId: string;
    subjectId: string | null;
    topic: string;
    score: number;
    wrongAnswers: Array<{ prompt: string; selectedAnswer: string; correctAnswer: string | null }>;
  }
) {
  const now = new Date().toISOString();

  await supabase.from('student_topic_progress').upsert(
    {
      student_membership_id: input.studentMembershipId,
      subject_id: input.subjectId,
      topic: input.topic,
      mastery_score: input.score,
      confidence_score: input.score >= 80 ? 90 : input.score >= 60 ? 65 : 35,
      last_practiced_at: now,
      updated_at: now,
    },
    { onConflict: 'student_membership_id,subject_id,topic' }
  );

  if (input.score >= 70) {
    await supabase
      .from('student_weak_areas')
      .update({ status: 'resolved', resolved_at: now })
      .eq('student_membership_id', input.studentMembershipId)
      .eq('lesson_id', input.lessonId)
      .eq('status', 'open');
    return;
  }

  const weakRows = input.wrongAnswers.slice(0, 5).map((answer) => ({
    student_membership_id: input.studentMembershipId,
    lesson_id: input.lessonId,
    subject_id: input.subjectId,
    topic: answer.prompt.slice(0, 180),
    reason: answer.correctAnswer
      ? `Chose "${answer.selectedAnswer}". Correct answer: "${answer.correctAnswer}".`
      : `Chose "${answer.selectedAnswer}".`,
    status: 'open',
  }));

  if (weakRows.length) {
    await supabase.from('student_weak_areas').insert(weakRows);
  }
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase();
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
