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

export type LearningMode = 'simple' | 'balanced' | 'exam' | 'story' | 'catch_up';

export type LessonPersonalizationRow = {
  id: string;
  lesson_id: string;
  student_membership_id: string;
  output_id: string | null;
  language: string;
  learning_mode: LearningMode;
  summary: string;
  content: Record<string, unknown>;
  audio_path: string | null;
  created_at: string;
};

export type QuizRow = {
  id: string;
  lesson_id: string;
  title: string;
  learning_mode: LearningMode;
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

export type QuizAttemptAnswer = {
  questionId: string;
  prompt: string;
  selectedAnswer: string;
  correctAnswer: string | null;
  isCorrect: boolean;
};

export type QuizAttemptRow = {
  id: string;
  quiz_id: string;
  student_membership_id: string;
  score: number | null;
  answers: QuizAttemptAnswer[];
  completed_at: string | null;
  created_at: string;
};

export type LessonDetail = {
  lesson: LessonRow;
  output: LessonOutputRow | null;
  personalization: LessonPersonalizationRow | null;
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

type StartLessonInput = Omit<CreateLessonInput, 'transcript'>;

type EndLessonInput = {
  lessonId: string;
  language: string;
  transcript?: string;
  recording?: LessonRecordingUpload | null;
};

export type LessonRecordingUpload = {
  uri: string;
  mimeType?: string;
  durationSeconds?: number | null;
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

export async function fetchLessonDetail(lessonId: string, studentMembershipId?: string | null): Promise<LessonDetail> {
  const db = client() as any;
  const [lesson, output, quizzes, flashcards, personalization] = await Promise.all([
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
    studentMembershipId
      ? db
          .from('lesson_personalizations')
          .select('id, lesson_id, student_membership_id, output_id, language, learning_mode, summary, content, audio_path, created_at')
          .eq('lesson_id', lessonId)
          .eq('student_membership_id', studentMembershipId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
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

  if (personalization.error) {
    throw personalization.error;
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
    personalization: (personalization.data ?? null) as LessonPersonalizationRow | null,
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

export async function startLessonSession(input: StartLessonInput) {
  requireFields([
    ['Class', input.classId],
    ['Teacher', input.teacherMembershipId],
    ['Lesson title', input.title],
  ]);

  const { data, error } = await (client() as any)
    .from('lessons')
    .insert({
      school_id: input.schoolId,
      class_id: input.classId,
      subject_id: input.subjectId,
      teacher_membership_id: input.teacherMembershipId,
      title: input.title.trim(),
      status: 'recording',
      language: input.language.trim() || 'English',
      recorded_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function endLessonSession(input: EndLessonInput) {
  requireFields([['Lesson', input.lessonId]]);

  const db = client() as any;
  const transcript = input.transcript?.trim();

  if (transcript) {
    await addLessonTranscript(input.lessonId, input.language, transcript);
  }

  if (input.recording?.uri) {
    await uploadLessonRecording({
      lessonId: input.lessonId,
      recording: input.recording,
    });
  }

  const { error: lessonError } = await db
    .from('lessons')
    .update({ status: 'uploaded' })
    .eq('id', input.lessonId);

  if (lessonError) {
    throw lessonError;
  }
}

export async function uploadLessonRecording(input: {
  lessonId: string;
  recording: LessonRecordingUpload;
}) {
  requireFields([
    ['Lesson', input.lessonId],
    ['Recording', input.recording.uri],
  ]);

  const db = client() as any;
  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error('Sign in before saving lesson audio.');
  }

  const audio = await readAudioFile(input.recording);
  const path = `${user.id}/${input.lessonId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${audio.extension}`;

  const { error: uploadError } = await db.storage.from('chivo-lesson-audio').upload(path, audio.file, {
    contentType: audio.mimeType,
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { error: recordingError } = await db.from('lesson_recordings').insert({
    lesson_id: input.lessonId,
    uploaded_by: user.id,
    storage_path: path,
    mime_type: audio.mimeType,
    size_bytes: audio.sizeBytes,
    duration_seconds: input.recording.durationSeconds ?? null,
  });

  if (recordingError) {
    throw recordingError;
  }
}

export async function addLessonTranscript(lessonId: string, language: string, transcript: string) {
  requireFields([
    ['Lesson', lessonId],
    ['Transcript', transcript],
  ]);

  const { error } = await (client() as any).from('lesson_transcripts').insert({
    lesson_id: lessonId,
    provider: 'manual',
    language: language.trim() || 'English',
    raw_text: transcript.trim(),
    cleaned_text: transcript.trim(),
  });

  if (error && error.code !== '23505') {
    throw error;
  }
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

export async function personalizeLesson(input: {
  lessonId: string;
  studentMembershipId: string;
  language: string;
  learningMode: LearningMode;
}) {
  requireFields([
    ['Lesson', input.lessonId],
    ['Student', input.studentMembershipId],
    ['Language', input.language],
    ['Learning mode', input.learningMode],
  ]);

  const { data, error } = await client().functions.invoke('personalize-lesson', {
    body: {
      lessonId: input.lessonId,
      studentMembershipId: input.studentMembershipId,
      language: input.language.trim(),
      learningMode: input.learningMode,
    },
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

export async function submitQuizAttempt(input: {
  quizId: string;
  studentMembershipId: string;
  answers: Array<Pick<QuizAttemptAnswer, 'questionId' | 'selectedAnswer'>>;
}) {
  requireFields([
    ['Quiz', input.quizId],
    ['Student', input.studentMembershipId],
  ]);

  const { data, error } = await client().functions.invoke('submit-quiz-attempt', {
    body: {
      quizId: input.quizId,
      studentMembershipId: input.studentMembershipId,
      answers: input.answers,
    },
  });

  if (error) {
    throw error;
  }

  return data as {
    attempt: QuizAttemptRow;
    score: number;
    correct: number;
    total: number;
  };
}

export async function fetchQuizAttempts(quizId: string): Promise<QuizAttemptRow[]> {
  requireFields([['Quiz', quizId]]);

  const { data, error } = await (client() as any)
    .from('quiz_attempts')
    .select('id, quiz_id, student_membership_id, score, answers, completed_at, created_at')
    .eq('quiz_id', quizId)
    .order('completed_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as QuizAttemptRow[];
}

function requireFields(fields: Array<[string, string | null | undefined]>) {
  const missing = fields.find(([, value]) => !value?.trim());

  if (missing) {
    throw new Error(`${missing[0]} is required.`);
  }
}

async function readAudioFile(recording: LessonRecordingUpload) {
  const response = await fetch(recording.uri);
  const file = await response.arrayBuffer();
  const mimeType = recording.mimeType ?? response.headers.get('content-type') ?? audioMimeTypeFromUri(recording.uri);

  return {
    file,
    mimeType,
    extension: audioExtension(mimeType, recording.uri),
    sizeBytes: file.byteLength,
  };
}

function audioMimeTypeFromUri(uri: string) {
  const lower = uri.split('?')[0]?.toLowerCase() ?? '';

  if (lower.endsWith('.webm')) {
    return 'audio/webm';
  }

  if (lower.endsWith('.wav')) {
    return 'audio/wav';
  }

  if (lower.endsWith('.mp3')) {
    return 'audio/mpeg';
  }

  if (lower.endsWith('.aac')) {
    return 'audio/aac';
  }

  if (lower.endsWith('.3gp')) {
    return 'audio/3gpp';
  }

  return 'audio/mp4';
}

function audioExtension(mimeType: string, uri: string) {
  const lower = uri.split('?')[0]?.toLowerCase() ?? '';
  const fromName = lower.split('.').pop();

  if (fromName && ['m4a', 'mp4', 'webm', 'wav', 'mp3', 'aac', '3gp'].includes(fromName)) {
    return fromName;
  }

  if (mimeType.includes('webm')) {
    return 'webm';
  }

  if (mimeType.includes('wav')) {
    return 'wav';
  }

  if (mimeType.includes('mpeg')) {
    return 'mp3';
  }

  if (mimeType.includes('aac')) {
    return 'aac';
  }

  if (mimeType.includes('3gpp')) {
    return '3gp';
  }

  return 'm4a';
}
