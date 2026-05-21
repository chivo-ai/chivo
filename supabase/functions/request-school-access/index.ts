import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type RequestSchoolAccessBody = {
  schoolCode: string;
  requestedRole?: 'student' | 'teacher' | 'guardian';
  message?: string;
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
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return json({ error: 'Authentication is required' }, 401);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', getServiceRoleKey());
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session' }, 401);
    }

    const body = (await request.json()) as RequestSchoolAccessBody;
    const schoolCode = normalizeSchoolCode(body.schoolCode);
    const requestedRole = body.requestedRole ?? 'student';

    if (!schoolCode) {
      return json({ error: 'School code is required' }, 400);
    }

    if (!['student', 'teacher', 'guardian'].includes(requestedRole)) {
      return json({ error: 'Choose student, teacher, or guardian access' }, 400);
    }

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, slug')
      .eq('slug', schoolCode)
      .maybeSingle();

    if (schoolError) {
      throw schoolError;
    }

    if (!school) {
      return json({ error: 'School code was not found' }, 404);
    }

    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'New user',
      preferred_language: user.user_metadata?.preferred_language ?? 'English',
      learning_level: user.user_metadata?.learning_level ?? 'balanced',
      audio_enabled: user.user_metadata?.audio_enabled ?? true,
    });

    const { data: membership, error: membershipError } = await supabase
      .from('school_memberships')
      .select('id, role, status')
      .eq('school_id', school.id)
      .eq('profile_id', user.id)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (membership?.status === 'active') {
      return json({ school, membership, alreadyMember: true });
    }

    const { data: existingRequest, error: requestLookupError } = await supabase
      .from('school_join_requests')
      .select('id, status')
      .eq('school_id', school.id)
      .eq('profile_id', user.id)
      .eq('status', 'review')
      .maybeSingle();

    if (requestLookupError) {
      throw requestLookupError;
    }

    if (existingRequest) {
      return json({ school, request: existingRequest, alreadyRequested: true });
    }

    const { data: joinRequest, error: requestError } = await supabase
      .from('school_join_requests')
      .insert({
        school_id: school.id,
        profile_id: user.id,
        requested_role: requestedRole,
        status: 'review',
        message: body.message?.trim() || null,
      })
      .select('id, status')
      .single();

    if (requestError) {
      throw requestError;
    }

    await supabase.from('audit_logs').insert({
      school_id: school.id,
      actor_profile_id: user.id,
      action: 'school_access.requested',
      entity_type: 'school_join_request',
      entity_id: joinRequest.id,
      metadata: { requested_role: requestedRole },
    });

    return json({ school, request: joinRequest });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

function normalizeSchoolCode(value: string) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getServiceRoleKey() {
  return Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
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
