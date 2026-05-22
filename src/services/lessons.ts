import { supabase } from '../lib/supabase';

export type LessonRow = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string | null;
  teacher_membership_id: string | null;
  title: string;
  status: 'draft' | 'recording' | 'uploaded' | 'transcribing' | 'review' | 'published' | 'failed';
  language: string;
  duration_seconds: number | null;
  recorded_at: string | null;
  published_at: string | null;
  created_at: string;
};

export type LessonOutputRow = {
  id: string;
  lesson_id: string;
  output_type: string;
  language: string;
  learning_level: string | null;
  title: string | null;
  summary: string | null;
  key_points: string[];
  content: Record<string, unknown>;
};

export type QuizRow = {
  id: string;
  lesson_id: string;
  title: string;
  learning_mode: string;
};

export type QuizQuestionRow = {
  id: string;
  quiz_id: string;
  position: number;
  prompt: string;
  options: string[];
  answer: string | null;
  explanation: string | null;
};

export type FlashcardRow = {
  id: string;
  lesson_id: string;
  language: string;
  learning_level: string | null;
  front: string;
  back: string;
};

export type LessonDetail = {
  lesson: LessonRow;
  output: LessonOutputRow | null;
  quiz: QuizRow | null;
  questions: QuizQuestionRow[];
  flashcards: FlashcardRow[];
};

type CreateLessonInput = {
  schoolId: string;
  classId: string;
  subjectId: string | null;
  teacherMembershipId: string;
  title: string;
  language: string;
  transcript: string;
};

function client() {
  if (!supabase) {
    throw new Error('Lesson access is not available right now.');
  }

  return supabase;
}

export async function fetchLessons(schoolId: string, includeDrafts = false): Promise<LessonRow[]> {
  let query = (client() as any)
    .from('lessons')
    .select('id, school_id, class_id, subject_id, teacher_membership_id, title, status, language, duration_seconds, recorded_at, published_at, created_at')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (!includeDrafts) {
    query = query.eq('status', 'published');
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as LessonRow[];
}

export async function fetchLessonDetail(lessonId: string): Promise<LessonDetail> {
  const db = client() as any;
  const [lesson, output, quizzes, flashcards] = await Promise.all([
    db
      .from('lessons')
      .select('id, school_id, class_id, subject_id, teacher_membership_id, title, status, language, duration_seconds, recorded_at, published_at, created_at')
      .eq('id', lessonId)
      .single(),
    db
      .from('lesson_outputs')
      .select('id, lesson_id, output_type, language, learning_level, title, summary, key_points, content')
      .eq('lesson_id', lessonId)
      .eq('output_type', 'master')
      .maybeSingle(),
    db
      .from('quizzes')
      .select('id, lesson_id, title, learning_mode')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false }),
    db
      .from('flashcards')
      .select('id, lesson_id, language, learning_level, front, back')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true }),
  ]);

  if (lesson.error) {
    throw lesson.error;
  }

  if (output.error) {
    throw output.error;
  }

  if (quizzes.error) {
    throw quizzes.error;
  }

  if (flashcards.error) {
    throw flashcards.error;
  }

  const quiz = (quizzes.data?.[0] ?? null) as QuizRow | null;
  let questions: QuizQuestionRow[] = [];

  if (quiz) {
    const { data, error } = await db
      .from('quiz_questions')
      .select('id, quiz_id, position, prompt, options, answer, explanation')
      .eq('quiz_id', quiz.id)
      .order('position', { ascending: true });

    if (error) {
      throw error;
    }

    questions = (data ?? []) as QuizQuestionRow[];
  }

  return {
    lesson: lesson.data as LessonRow,
    output: (output.data ?? null) as LessonOutputRow | null,
    quiz,
    questions,
    flashcards: (flashcards.data ?? []) as FlashcardRow[],
  };
}

export async function createLesson(input: CreateLessonInput) {
  requireFields([
    ['Class', input.classId],
    ['Teacher', input.teacherMembershipId],
    ['Lesson title', input.title],
    ['Transcript', input.transcript],
  ]);

  const db = client() as any;
  const { data: lesson, error: lessonError } = await db
    .from('lessons')
    .insert({
      school_id: input.schoolId,
      class_id: input.classId,
      subject_id: input.subjectId,
      teacher_membership_id: input.teacherMembershipId,
      title: input.title.trim(),
      status: 'uploaded',
      language: input.language.trim() || 'English',
      recorded_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (lessonError) {
    throw lessonError;
  }

  const { error: transcriptError } = await db.from('lesson_transcripts').insert({
    lesson_id: lesson.id,
    provider: 'manual',
    language: input.language.trim() || 'English',
    raw_text: input.transcript.trim(),
    cleaned_text: input.transcript.trim(),
  });

  if (transcriptError) {
    throw transcriptError;
  }

  return lesson.id as string;
}

export async function processLesson(lessonId: string) {
  const { data, error } = await client().functions.invoke('process-lesson', {
    body: { lessonId },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function publishLesson(lessonId: string) {
  const { error } = await (client() as any)
    .from('lessons')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', lessonId);

  if (error) {
    throw error;
  }
}

function requireFields(fields: Array<[string, string | null | undefined]>) {
  const missing = fields.find(([, value]) => !value?.trim());

  if (missing) {
    throw new Error(`${missing[0]} is required.`);
  }
}
