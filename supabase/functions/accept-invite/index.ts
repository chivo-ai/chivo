import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type AcceptInviteRequest = {
  code: string;
};

type InviteRow = {
  id: string;
  school_id: string;
  class_id: string | null;
  role: 'owner' | 'admin' | 'teacher' | 'student' | 'guardian';
  status: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session' }, 401);
    }

    const body = (await request.json()) as AcceptInviteRequest;
    const code = body.code?.trim().toUpperCase();

    if (!code) {
      return json({ error: 'Invite code is required' }, 400);
    }

    const { data: invite, error: inviteError } = await supabase
      .from('school_invites')
      .select('id, school_id, class_id, role, status, max_uses, use_count, expires_at')
      .eq('code', code)
      .single<InviteRow>();

    if (inviteError || !invite) {
      return json({ error: 'Invite code was not found' }, 404);
    }

    if (invite.status !== 'active') {
      return json({ error: 'Invite code is no longer active' }, 400);
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      return json({ error: 'Invite code has expired' }, 400);
    }

    if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
      return json({ error: 'Invite code has reached its limit' }, 400);
    }

    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'New user',
      preferred_language: user.user_metadata?.preferred_language ?? 'English',
      learning_level: user.user_metadata?.learning_level ?? 'balanced',
      audio_enabled: user.user_metadata?.audio_enabled ?? true,
    });

    const { data: existingMembership, error: existingError } = await supabase
      .from('school_memberships')
      .select('id, role, status')
      .eq('school_id', invite.school_id)
      .eq('profile_id', user.id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const membership =
      existingMembership?.status === 'active'
        ? existingMembership
        : await activateMembership(supabase, invite, user.id, existingMembership?.id);

    if (invite.class_id) {
      const { error: classError } = await supabase.from('class_memberships').upsert(
        {
          class_id: invite.class_id,
          school_membership_id: membership.id,
          role: invite.role,
          status: 'active',
        },
        { onConflict: 'class_id,school_membership_id' }
      );

      if (classError) {
        throw classError;
      }
    }

    await supabase
      .from('school_invites')
      .update({ use_count: invite.use_count + 1 })
      .eq('id', invite.id);

    await supabase.from('audit_logs').insert({
      school_id: invite.school_id,
      actor_profile_id: user.id,
      action: 'invite.accepted',
      entity_type: 'school_invite',
      entity_id: invite.id,
      metadata: { code, role: invite.role, class_id: invite.class_id },
    });

    return json({ membership, classId: invite.class_id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

async function activateMembership(
  supabase: SupabaseClient,
  invite: InviteRow,
  profileId: string,
  existingMembershipId?: string
) {
  if (existingMembershipId) {
    const { data, error } = await supabase
      .from('school_memberships')
      .update({
        role: invite.role,
        status: 'active',
        approved_at: new Date().toISOString(),
      })
      .eq('id', existingMembershipId)
      .select('id, role, status')
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from('school_memberships')
    .insert({
      school_id: invite.school_id,
      profile_id: profileId,
      role: invite.role,
      status: 'active',
      approved_at: new Date().toISOString(),
    })
    .select('id, role, status')
    .single();

  if (error) {
    throw error;
  }

  return data;
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
