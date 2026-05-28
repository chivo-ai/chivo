import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type RequestSchoolAccessBody = {
  schoolCode: string;
  requestedRole?: 'student' | 'teacher' | 'guardian';
  message?: string;
};

type AccessPolicyResult = {
  allowed?: boolean;
  reason?: string;
  paymentRequired?: boolean;
  amount?: number | string | null;
  currency?: string | null;
  billingPeriod?: string | null;
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
    const rawSchoolCode = body.schoolCode?.trim() ?? '';
    const schoolCode = normalizeSchoolCode(rawSchoolCode);
    const requestedRole = body.requestedRole ?? 'student';

    if (!schoolCode) {
      return json({ error: 'School code is required' }, 400);
    }

    if (!['student', 'teacher', 'guardian'].includes(requestedRole)) {
      return json({ error: 'Choose student, teacher, or guardian access' }, 400);
    }

    const { data: matchingInvite, error: inviteError } = await supabase
      .from('school_invites')
      .select('id')
      .eq('code', rawSchoolCode.toUpperCase())
      .maybeSingle();

    if (inviteError) {
      throw inviteError;
    }

    if (matchingInvite) {
      return json({ error: 'That is an invite code. Open Join and use the code there.' }, 400);
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
      return json({ error: 'School code was not found. Use the school code from the school profile, or use Join if you have an invite code.' }, 404);
    }

    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'New user',
      preferred_language: user.user_metadata?.preferred_language ?? 'English',
      learning_level: user.user_metadata?.learning_level ?? 'balanced',
      audio_enabled: user.user_metadata?.audio_enabled ?? true,
    });

    const accessPolicy = await evaluateAccessPolicy(supabase, school.id, user.id);
    if (accessPolicy && accessPolicy.allowed === false) {
      return json(accessPolicyError(accessPolicy, school.name), accessPolicy.paymentRequired ? 402 : 403);
    }

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

async function evaluateAccessPolicy(
  supabase: SupabaseClient,
  schoolId: string,
  profileId: string
): Promise<AccessPolicyResult | null> {
  const { data, error } = await supabase.rpc('evaluate_access_policy', {
    target_entity_type: 'school',
    target_entity_id: schoolId,
    target_profile_id: profileId,
  });

  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202' || error.code === '42P01') {
      return null;
    }

    throw error;
  }

  return data as AccessPolicyResult;
}

function accessPolicyError(policy: AccessPolicyResult, targetName: string) {
  if (policy.paymentRequired) {
    const amount = policy.amount ? `${policy.amount}${policy.currency ? ` ${policy.currency}` : ''}` : 'payment';
    return {
      error: `Payment is required to enter ${targetName}.`,
      paymentRequired: true,
      amount,
      billingPeriod: policy.billingPeriod ?? null,
    };
  }

  return {
    error: accessPolicyMessage(policy.reason, targetName),
    paymentRequired: false,
  };
}

function accessPolicyMessage(reason: string | undefined, targetName: string) {
  if (reason === 'ban') {
    return `Access to ${targetName} is not available for this account.`;
  }

  if (reason === 'suspension') {
    return `Access to ${targetName} is paused for this account.`;
  }

  if (reason === 'payment_freeze' || reason === 'payout_freeze') {
    return `Access to ${targetName} is under review.`;
  }

  if (reason === 'override_denied') {
    return `Access to ${targetName} has been restricted.`;
  }

  if (reason === 'access_disabled') {
    return `${targetName} is not accepting access right now.`;
  }

  return `Access to ${targetName} is not available right now.`;
}

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
