import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type ProcessClassVoiceNoteRequest = {
  resourceId: string;
  language?: string;
};

type AudioInput = {
  mimeType: string;
  buffer: ArrayBuffer;
};

type GeneratedVoiceNote = {
  title?: string;
  transcript?: string;
  summary?: string;
  key_points?: string[];
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

    const body = (await request.json()) as ProcessClassVoiceNoteRequest;

    if (!body.resourceId) {
      return json({ error: 'resourceId is required' }, 400);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session' }, 401);
    }

    const { data: resource, error: resourceError } = await supabase
      .from('class_resources')
      .select('id, class_id, created_by, title, resource_type, content, created_at')
      .eq('id', body.resourceId)
      .single();

    if (resourceError) {
      throw resourceError;
    }

    if (resource.resource_type !== 'voice_note') {
      return json({ error: 'Only class voice notes can be transcribed' }, 400);
    }

    const { data: schoolClass, error: classError } = await supabase
      .from('classes')
      .select('id, school_id')
      .eq('id', resource.class_id)
      .single();

    if (classError) {
      throw classError;
    }

    const hasAccess = await hasClassAccess(supabase, resource.class_id, schoolClass.school_id, user.id);

    if (!hasAccess) {
      return json({ error: 'Class access is required' }, 403);
    }

    const content = (resource.content ?? {}) as Record<string, unknown>;
    const storagePath = typeof content.storage_path === 'string' ? content.storage_path : '';
    const mimeType = typeof content.mime_type === 'string' ? content.mime_type : 'audio/aac';

    if (!storagePath) {
      return json({ error: 'Voice note audio was not found' }, 400);
    }

    const audio = await fetchClassAudio(supabase, storagePath, mimeType);
    const generated = await generateVoiceNote({
      title: resource.title,
      language: body.language ?? 'English',
      audio,
    });

    const { data: updatedResource, error: updateError } = await supabase
      .from('class_resources')
      .update({
        title: generated.title ?? resource.title,
        content: {
          ...content,
          transcript: generated.transcript ?? '',
          summary: generated.summary ?? '',
          key_points: generated.key_points ?? [],
          language: body.language ?? 'English',
          processed_by: 'gemini',
          processed_at: new Date().toISOString(),
        },
      })
      .eq('id', resource.id)
      .select('id, class_id, created_by, lesson_id, title, resource_type, content, created_at')
      .single();

    if (updateError) {
      throw updateError;
    }

    await supabase.from('class_messages').insert({
      class_id: resource.class_id,
      sender_profile_id: user.id,
      body: `Chivo AI transcribed a class voice note: ${updatedResource.title}`,
      resource_id: updatedResource.id,
    });

    return json({ resource: updatedResource });
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

async function fetchClassAudio(
  supabase: any,
  storagePath: string,
  mimeType: string
): Promise<AudioInput> {
  const { data, error } = await supabase.storage.from('chivo-class-audio').download(storagePath);

  if (error) {
    throw error;
  }

  return {
    mimeType: geminiAudioMimeType(mimeType || data.type || 'audio/aac'),
    buffer: await data.arrayBuffer(),
  };
}

async function generateVoiceNote(input: {
  title: string;
  language: string;
  audio: AudioInput;
}): Promise<GeneratedVoiceNote> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (!geminiKey) {
    throw new Error('Missing GEMINI_API_KEY function secret');
  }

  const prompt = [
    'You are Chivo AI, a classroom learning assistant.',
    'Listen to this class voice note and create a clean shared study transcript.',
    'Return JSON only with: title, transcript, summary, key_points.',
    'Keep the transcript faithful and useful for the whole class.',
    `Voice note title: ${input.title}`,
    `Output language: ${input.language}`,
  ].join('\n\n');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, await createAudioPart(geminiKey, input.audio, input.title)] }],
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
  const parsed = JSON.parse(text) as GeneratedVoiceNote;

  return {
    title: parsed.title ?? input.title,
    transcript: parsed.transcript ?? '',
    summary: parsed.summary ?? '',
    key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
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
    throw new Error('This browser audio format needs a text transcript before Chivo can process it.');
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
        display_name: displayName.slice(0, 80) || 'class-voice-note',
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

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
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
