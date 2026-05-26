import { supabase } from '../lib/supabase';
import { CrewRole, CrewScope, MembershipStatus } from '../types';

export type Crew = {
  id: string;
  schoolId: string | null;
  ownerProfileId: string;
  name: string;
  username: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  stickerKey: string | null;
  scope: CrewScope;
  inviteCode: string;
  externalSharingEnabled: boolean;
  createdAt: string;
};

export type CrewListItem = Crew & {
  membershipId: string;
  membershipRole: CrewRole;
  membershipStatus: MembershipStatus;
  schoolMembershipId: string | null;
  memberCount: number;
  resourceCount: number;
};

export type CrewMember = {
  id: string;
  profileId: string;
  role: CrewRole;
  status: MembershipStatus;
  createdAt: string;
};

export type CrewMessage = {
  id: string;
  crewId: string;
  senderProfileId: string;
  resourceId: string | null;
  body: string;
  createdAt: string;
};

export type CrewResource = {
  id: string;
  crewId: string;
  createdBy: string | null;
  lessonId: string | null;
  title: string;
  resourceType: string;
  content: Record<string, unknown>;
  createdAt: string;
};

export type CrewRecordingUpload = {
  uri: string;
  mimeType?: string;
  durationSeconds?: number | null;
};

export type CrewAiPack = {
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

export type CrewRoom = {
  crew: Crew;
  viewerProfileId: string;
  members: CrewMember[];
  messages: CrewMessage[];
  resources: CrewResource[];
};

type CrewRow = {
  id: string;
  school_id: string | null;
  owner_profile_id: string;
  name: string;
  username: string;
  logo_url: string | null;
  banner_url: string | null;
  sticker_key: string | null;
  scope: CrewScope;
  invite_code: string;
  external_sharing_enabled: boolean;
  created_at: string;
};

type CrewMembershipRow = {
  id: string;
  crew_id: string;
  profile_id?: string;
  school_membership_id: string | null;
  role: CrewRole;
  status: MembershipStatus;
  created_at: string;
  lesson_crews?: CrewRow | CrewRow[] | null;
};

type CrewMessageRow = {
  id: string;
  crew_id: string;
  sender_profile_id: string;
  resource_id: string | null;
  body: string;
  created_at: string;
};

type CrewResourceRow = {
  id: string;
  crew_id: string;
  created_by: string | null;
  lesson_id: string | null;
  title: string;
  resource_type: string;
  content: Record<string, unknown> | null;
  created_at: string;
};

export async function fetchCrewsForUser(): Promise<CrewListItem[]> {
  if (!supabase) {
    return [];
  }

  const userId = await getCurrentUserId();

  const { data, error } = await (supabase as any)
    .from('crew_memberships')
    .select(
      'id, crew_id, school_membership_id, role, status, created_at, lesson_crews!inner(id, school_id, owner_profile_id, name, username, logo_url, banner_url, sticker_key, scope, invite_code, external_sharing_enabled, created_at)'
    )
    .eq('profile_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as CrewMembershipRow[];
  const crewIds = rows.map((row) => row.crew_id);
  const [memberCounts, resourceCounts] = await Promise.all([
    countActiveMembers(crewIds),
    countCrewResources(crewIds),
  ]);

  return rows
    .map((row) => {
      const crew = firstCrew(row.lesson_crews);
      if (!crew) {
        return null;
      }

      return {
        ...mapCrew(crew),
        membershipId: row.id,
        membershipRole: row.role,
        membershipStatus: row.status,
        schoolMembershipId: row.school_membership_id,
        memberCount: memberCounts.get(row.crew_id) ?? 1,
        resourceCount: resourceCounts.get(row.crew_id) ?? 0,
      } satisfies CrewListItem;
    })
    .filter(Boolean) as CrewListItem[];
}

export async function createCrew(input: {
  name: string;
  schoolMembershipId: string;
  scope?: CrewScope;
}): Promise<Crew> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await (supabase as any).rpc('create_crew_with_owner', {
    crew_name: input.name,
    school_membership: input.schoolMembershipId,
    crew_scope: input.scope ?? 'school',
  });

  if (error) {
    throw new Error(error.message);
  }

  return mapCrew(data as CrewRow);
}

export async function joinCrewByCode(input: {
  code: string;
  schoolMembershipId?: string | null;
}): Promise<Crew> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await (supabase as any).rpc('join_crew_by_code', {
    invite_code_input: input.code,
    school_membership: input.schoolMembershipId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return mapCrew(data as CrewRow);
}

export async function fetchCrewRoom(identifier: string): Promise<CrewRoom> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const viewerProfileId = await getCurrentUserId();
  const cleanIdentifier = identifier.trim();
  const crewQuery = (supabase as any)
    .from('lesson_crews')
    .select('id, school_id, owner_profile_id, name, username, logo_url, banner_url, sticker_key, scope, invite_code, external_sharing_enabled, created_at');
  const crewResult = await (isUuid(cleanIdentifier)
    ? crewQuery.eq('id', cleanIdentifier).single()
    : crewQuery.eq('username', cleanIdentifier.toLowerCase()).single());

  if (crewResult.error) {
    throw new Error(crewResult.error.message);
  }

  const crew = mapCrew(crewResult.data as CrewRow);
  const [membersResult, messagesResult, resourcesResult] = await Promise.all([
    (supabase as any)
      .from('crew_memberships')
      .select('id, profile_id, role, status, created_at')
      .eq('crew_id', crew.id)
      .order('created_at', { ascending: true }),
    (supabase as any)
      .from('crew_messages')
      .select('id, crew_id, sender_profile_id, resource_id, body, created_at')
      .eq('crew_id', crew.id)
      .order('created_at', { ascending: true })
      .limit(80),
    (supabase as any)
      .from('crew_resources')
      .select('id, crew_id, created_by, lesson_id, title, resource_type, content, created_at')
      .eq('crew_id', crew.id)
      .order('created_at', { ascending: false })
      .limit(80),
  ]);

  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  if (messagesResult.error) {
    throw new Error(messagesResult.error.message);
  }

  if (resourcesResult.error) {
    throw new Error(resourcesResult.error.message);
  }

  return {
    crew,
    viewerProfileId,
    members: ((membersResult.data ?? []) as Array<CrewMembershipRow & { profile_id: string }>).map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
    })),
    messages: ((messagesResult.data ?? []) as CrewMessageRow[]).map(mapMessage),
    resources: ((resourcesResult.data ?? []) as CrewResourceRow[]).map(mapResource),
  };
}

export async function sendCrewMessage(crewId: string, body: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const senderProfileId = await getCurrentUserId();

  const { error } = await (supabase as any).from('crew_messages').insert({
    crew_id: crewId,
    sender_profile_id: senderProfileId,
    body: body.trim(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function addCrewResource(input: {
  crewId: string;
  title: string;
  note?: string;
  resourceType?: string;
  content?: Record<string, unknown>;
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const createdBy = await getCurrentUserId();
  const content = input.content ?? { note: input.note?.trim() ?? '' };

  const { error } = await (supabase as any).from('crew_resources').insert({
    crew_id: input.crewId,
    created_by: createdBy,
    title: input.title.trim(),
    resource_type: input.resourceType ?? 'note',
    content,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadCrewVoiceNote(input: {
  crewId: string;
  title: string;
  recording: CrewRecordingUpload;
}): Promise<CrewResource> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const createdBy = await getCurrentUserId();
  const audio = await readAudioFile(input.recording);
  const path = `${input.crewId}/${createdBy}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${audio.extension}`;

  const { error: uploadError } = await (supabase as any).storage.from('chivo-crew-audio').upload(path, audio.file, {
    contentType: audio.mimeType,
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await (supabase as any)
    .from('crew_resources')
    .insert({
      crew_id: input.crewId,
      created_by: createdBy,
      title: input.title.trim() || 'Crew voice note',
      resource_type: 'voice_note',
      content: {
        storage_path: path,
        mime_type: audio.mimeType,
        size_bytes: audio.sizeBytes,
        duration_seconds: input.recording.durationSeconds ?? null,
      },
    })
    .select('id, crew_id, created_by, lesson_id, title, resource_type, content, created_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapResource(data as CrewResourceRow);
}

export async function createCrewLiveSession(input: {
  crewId: string;
  title?: string;
}): Promise<CrewResource> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const createdBy = await getCurrentUserId();

  const { data, error } = await (supabase as any)
    .from('crew_resources')
    .insert({
      crew_id: input.crewId,
      created_by: createdBy,
      title: input.title?.trim() || 'Live study circle',
      resource_type: 'live_session',
      content: {
        status: 'live',
        speaker_profile_id: createdBy,
        started_at: new Date().toISOString(),
        rule: 'one_speaker',
      },
    })
    .select('id, crew_id, created_by, lesson_id, title, resource_type, content, created_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapResource(data as CrewResourceRow);
}

export async function endCrewLiveSession(resourceId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data: existing, error: fetchError } = await (supabase as any)
    .from('crew_resources')
    .select('content')
    .eq('id', resourceId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const content = (existing?.content ?? {}) as Record<string, unknown>;

  const { error } = await (supabase as any)
    .from('crew_resources')
    .update({
      content: {
        ...content,
        status: 'ended',
        ended_at: new Date().toISOString(),
      },
    })
    .eq('id', resourceId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function processCrewStudyPack(crewId: string): Promise<CrewResource> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.functions.invoke('process-crew-study-pack', {
    body: { crewId },
  });

  if (error) {
    throw new Error(await readableFunctionError(error));
  }

  const payload = data as { resource?: CrewResourceRow };

  if (!payload.resource) {
    throw new Error('Crew AI pack was not returned.');
  }

  return mapResource(payload.resource);
}

export async function processCrewVoiceNote(input: {
  resourceId: string;
  language?: string;
}): Promise<CrewResource> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.functions.invoke('process-crew-voice-note', {
    body: {
      resourceId: input.resourceId,
      language: input.language ?? 'English',
    },
  });

  if (error) {
    throw new Error(await readableFunctionError(error));
  }

  const payload = data as { resource?: CrewResourceRow };

  if (!payload.resource) {
    throw new Error('Crew voice note was not returned.');
  }

  return mapResource(payload.resource);
}

export function crewAiPackFromResource(resource: CrewResource): CrewAiPack | null {
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

async function countActiveMembers(crewIds: string[]) {
  const counts = new Map<string, number>();

  if (!supabase || !crewIds.length) {
    return counts;
  }

  const { data } = await (supabase as any)
    .from('crew_memberships')
    .select('crew_id')
    .in('crew_id', crewIds)
    .eq('status', 'active');

  for (const row of (data ?? []) as { crew_id: string }[]) {
    counts.set(row.crew_id, (counts.get(row.crew_id) ?? 0) + 1);
  }

  return counts;
}

async function countCrewResources(crewIds: string[]) {
  const counts = new Map<string, number>();

  if (!supabase || !crewIds.length) {
    return counts;
  }

  const { data } = await (supabase as any)
    .from('crew_resources')
    .select('crew_id')
    .in('crew_id', crewIds);

  for (const row of (data ?? []) as { crew_id: string }[]) {
    counts.set(row.crew_id, (counts.get(row.crew_id) ?? 0) + 1);
  }

  return counts;
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

function firstCrew(value: CrewRow | CrewRow[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function mapCrew(row: CrewRow): Crew {
  return {
    id: row.id,
    schoolId: row.school_id,
    ownerProfileId: row.owner_profile_id,
    name: row.name,
    username: row.username,
    logoUrl: row.logo_url,
    bannerUrl: row.banner_url,
    stickerKey: row.sticker_key,
    scope: row.scope,
    inviteCode: row.invite_code,
    externalSharingEnabled: row.external_sharing_enabled,
    createdAt: row.created_at,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapMessage(row: CrewMessageRow): CrewMessage {
  return {
    id: row.id,
    crewId: row.crew_id,
    senderProfileId: row.sender_profile_id,
    resourceId: row.resource_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapResource(row: CrewResourceRow): CrewResource {
  return {
    id: row.id,
    crewId: row.crew_id,
    createdBy: row.created_by,
    lessonId: row.lesson_id,
    title: row.title,
    resourceType: row.resource_type,
    content: row.content ?? {},
    createdAt: row.created_at,
  };
}

async function readableFunctionError(error: { message?: string; context?: unknown }) {
  const fallback = error.message ?? 'Crew AI request failed.';
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

async function readAudioFile(recording: CrewRecordingUpload) {
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
