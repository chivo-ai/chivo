import { supabase } from '../lib/supabase';
import { MembershipStatus, SchoolMembershipRole } from '../types';

export type ClassStudyMember = {
  id: string;
  schoolMembershipId: string;
  role: SchoolMembershipRole;
  status: MembershipStatus;
  createdAt: string;
};

export type ClassStudyMessage = {
  id: string;
  classId: string;
  senderProfileId: string;
  resourceId: string | null;
  body: string;
  createdAt: string;
};

export type ClassStudyResource = {
  id: string;
  classId: string;
  createdBy: string | null;
  lessonId: string | null;
  title: string;
  resourceType: string;
  content: Record<string, unknown>;
  createdAt: string;
};

export type ClassRecordingUpload = {
  uri: string;
  mimeType?: string;
  durationSeconds?: number | null;
};

export type ClassAiPack = {
  title: string;
  summary: string;
  keyPoints: string[];
  quiz: Array<{
    prompt: string;
    options: string[];
    answer: string;
    explanation: string;
  }>;
  flashcards: Array<{
    front: string;
    back: string;
  }>;
  studyTasks: string[];
};

export type ClassStudyRoom = {
  classId: string;
  viewerProfileId: string;
  members: ClassStudyMember[];
  messages: ClassStudyMessage[];
  resources: ClassStudyResource[];
};

type ClassMembershipRow = {
  id: string;
  class_id: string;
  school_membership_id: string;
  role: SchoolMembershipRole;
  status: MembershipStatus;
  created_at: string;
};

type ClassMessageRow = {
  id: string;
  class_id: string;
  sender_profile_id: string;
  resource_id: string | null;
  body: string;
  created_at: string;
};

type ClassResourceRow = {
  id: string;
  class_id: string;
  created_by: string | null;
  lesson_id: string | null;
  title: string;
  resource_type: string;
  content: Record<string, unknown> | null;
  created_at: string;
};

export async function fetchClassStudyRoom(classId: string): Promise<ClassStudyRoom> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const viewerProfileId = await getCurrentUserId();
  const [membersResult, messagesResult, resourcesResult] = await Promise.all([
    (supabase as any)
      .from('class_memberships')
      .select('id, class_id, school_membership_id, role, status, created_at')
      .eq('class_id', classId)
      .order('created_at', { ascending: true }),
    (supabase as any)
      .from('class_messages')
      .select('id, class_id, sender_profile_id, resource_id, body, created_at')
      .eq('class_id', classId)
      .order('created_at', { ascending: true })
      .limit(100),
    (supabase as any)
      .from('class_resources')
      .select('id, class_id, created_by, lesson_id, title, resource_type, content, created_at')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const error = [membersResult.error, messagesResult.error, resourcesResult.error].find(Boolean);

  if (error) {
    throw new Error(error.message);
  }

  return {
    classId,
    viewerProfileId,
    members: ((membersResult.data ?? []) as ClassMembershipRow[]).map((row) => ({
      id: row.id,
      schoolMembershipId: row.school_membership_id,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
    })),
    messages: ((messagesResult.data ?? []) as ClassMessageRow[]).map(mapMessage),
    resources: ((resourcesResult.data ?? []) as ClassResourceRow[]).map(mapResource),
  };
}

export async function sendClassMessage(classId: string, body: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const senderProfileId = await getCurrentUserId();

  const { error } = await (supabase as any).from('class_messages').insert({
    class_id: classId,
    sender_profile_id: senderProfileId,
    body: body.trim(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function addClassResource(input: {
  classId: string;
  title: string;
  note?: string;
  resourceType?: string;
  content?: Record<string, unknown>;
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const createdBy = await getCurrentUserId();

  const { error } = await (supabase as any).from('class_resources').insert({
    class_id: input.classId,
    created_by: createdBy,
    title: input.title.trim(),
    resource_type: input.resourceType ?? 'note',
    content: input.content ?? { note: input.note?.trim() ?? '' },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadClassVoiceNote(input: {
  classId: string;
  title: string;
  recording: ClassRecordingUpload;
}): Promise<ClassStudyResource> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const createdBy = await getCurrentUserId();
  const audio = await readAudioFile(input.recording);
  const path = `${input.classId}/${createdBy}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${audio.extension}`;

  const { error: uploadError } = await (supabase as any).storage.from('chivo-class-audio').upload(path, audio.file, {
    contentType: audio.mimeType,
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await (supabase as any)
    .from('class_resources')
    .insert({
      class_id: input.classId,
      created_by: createdBy,
      title: input.title.trim() || 'Class voice note',
      resource_type: 'voice_note',
      content: {
        storage_path: path,
        mime_type: audio.mimeType,
        size_bytes: audio.sizeBytes,
        duration_seconds: input.recording.durationSeconds ?? null,
      },
    })
    .select('id, class_id, created_by, lesson_id, title, resource_type, content, created_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapResource(data as ClassResourceRow);
}

export async function createClassLiveSession(input: {
  classId: string;
  title?: string;
}): Promise<ClassStudyResource> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const createdBy = await getCurrentUserId();

  const { data, error } = await (supabase as any)
    .from('class_resources')
    .insert({
      class_id: input.classId,
      created_by: createdBy,
      title: input.title?.trim() || 'Live class study',
      resource_type: 'live_session',
      content: {
        status: 'live',
        speaker_profile_id: createdBy,
        started_at: new Date().toISOString(),
        rule: 'one_speaker',
      },
    })
    .select('id, class_id, created_by, lesson_id, title, resource_type, content, created_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapResource(data as ClassResourceRow);
}

export async function endClassLiveSession(resourceId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data: existing, error: fetchError } = await (supabase as any)
    .from('class_resources')
    .select('content')
    .eq('id', resourceId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const { error } = await (supabase as any)
    .from('class_resources')
    .update({
      content: {
        ...((existing?.content ?? {}) as Record<string, unknown>),
        status: 'ended',
        ended_at: new Date().toISOString(),
      },
    })
    .eq('id', resourceId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function processClassStudyPack(classId: string): Promise<ClassStudyResource> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.functions.invoke('process-class-study-pack', {
    body: { classId },
  });

  if (error) {
    throw new Error(await readableFunctionError(error));
  }

  const payload = data as { resource?: ClassResourceRow };

  if (!payload.resource) {
    throw new Error('Class AI pack was not returned.');
  }

  return mapResource(payload.resource);
}

export async function processClassVoiceNote(input: {
  resourceId: string;
  language?: string;
}): Promise<ClassStudyResource> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.functions.invoke('process-class-voice-note', {
    body: {
      resourceId: input.resourceId,
      language: input.language ?? 'English',
    },
  });

  if (error) {
    throw new Error(await readableFunctionError(error));
  }

  const payload = data as { resource?: ClassResourceRow };

  if (!payload.resource) {
    throw new Error('Class voice note was not returned.');
  }

  return mapResource(payload.resource);
}

export function classAiPackFromResource(resource: ClassStudyResource): ClassAiPack | null {
  if (resource.resourceType !== 'ai_pack') {
    return null;
  }

  const content = resource.content;
  const quiz = Array.isArray(content.quiz) ? content.quiz : [];
  const flashcards = Array.isArray(content.flashcards) ? content.flashcards : [];

  return {
    title: asText(content.title) || resource.title,
    summary: asText(content.summary),
    keyPoints: asTextArray(content.key_points),
    quiz: quiz.map((item) => {
      const question = item as Record<string, unknown>;
      return {
        prompt: asText(question.prompt),
        options: asTextArray(question.options),
        answer: asText(question.answer),
        explanation: asText(question.explanation),
      };
    }).filter((item) => item.prompt),
    flashcards: flashcards.map((item) => {
      const card = item as Record<string, unknown>;
      return {
        front: asText(card.front),
        back: asText(card.back),
      };
    }).filter((item) => item.front || item.back),
    studyTasks: asTextArray(content.study_tasks),
  };
}

async function getCurrentUserId() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error(error?.message ?? 'You must be signed in.');
  }

  return data.user.id;
}

function mapMessage(row: ClassMessageRow): ClassStudyMessage {
  return {
    id: row.id,
    classId: row.class_id,
    senderProfileId: row.sender_profile_id,
    resourceId: row.resource_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapResource(row: ClassResourceRow): ClassStudyResource {
  return {
    id: row.id,
    classId: row.class_id,
    createdBy: row.created_by,
    lessonId: row.lesson_id,
    title: row.title,
    resourceType: row.resource_type,
    content: row.content ?? {},
    createdAt: row.created_at,
  };
}

async function readableFunctionError(error: { message?: string; context?: unknown }) {
  const fallback = error.message ?? 'Class AI request failed.';
  const context = error.context as { json?: () => Promise<unknown>; text?: () => Promise<string> } | undefined;

  try {
    if (context?.json) {
      const payload = await context.json();
      if (payload && typeof payload === 'object' && 'error' in payload) {
        return String((payload as { error?: unknown }).error || fallback);
      }
    }

    if (context?.text) {
      const text = await context.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: unknown };
          return String(parsed.error || text || fallback);
        } catch {
          return text;
        }
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function asText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asTextArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

async function readAudioFile(recording: ClassRecordingUpload) {
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

  return 'm4a';
}
