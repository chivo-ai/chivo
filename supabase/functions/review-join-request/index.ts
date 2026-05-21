import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type ReviewJoinRequestBody = {
  requestId: string;
  decision: 'approve' | 'decline';
};

type JoinRequestRow = {
  id: string;
  school_id: string;
  class_id: string | null;
  profile_id: string;
  requested_role: 'owner' | 'admin' | 'teacher' | 'student' | 'guardian';
  status: string;
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

    const body = (await request.json()) as ReviewJoinRequestBody;

    if (!body.requestId) {
      return json({ error: 'Request is required' }, 400);
    }

    if (!['approve', 'decline'].includes(body.decision)) {
      return json({ error: 'Choose approve or decline' }, 400);
    }

    const { data: joinRequest, error: requestError } = await supabase
      .from('school_join_requests')
      .select('id, school_id, class_id, profile_id, requested_role, status')
      .eq('id', body.requestId)
      .single<JoinRequestRow>();

    if (requestError || !joinRequest) {
      return json({ error: 'Request was not found' }, 404);
    }

    const { data: reviewer, error: reviewerError } = await supabase
      .from('school_memberships')
      .select('id')
      .eq('school_id', joinRequest.school_id)
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .in('role', ['owner', 'admin'])
      .maybeSingle();

    if (reviewerError) {
      throw reviewerError;
    }

    if (!reviewer) {
      return json({ error: 'Admin access is required' }, 403);
    }

    if (joinRequest.status !== 'review') {
      return json({ error: 'Request has already been reviewed' }, 400);
    }

    if (body.decision === 'decline') {
      const { data, error } = await supabase
        .from('school_join_requests')
        .update({
          status: 'declined',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', joinRequest.id)
        .select('id, status')
        .single();

      if (error) {
        throw error;
      }

      await supabase.from('audit_logs').insert({
        school_id: joinRequest.school_id,
        actor_profile_id: user.id,
        action: 'school_access.declined',
        entity_type: 'school_join_request',
        entity_id: joinRequest.id,
        metadata: { requested_role: joinRequest.requested_role },
      });

      return json({ request: data });
    }

    const { data: existingMembership, error: existingError } = await supabase
      .from('school_memberships')
      .select('id')
      .eq('school_id', joinRequest.school_id)
      .eq('profile_id', joinRequest.profile_id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const membership = existingMembership
      ? await activateExistingMembership(supabase, existingMembership.id, joinRequest.requested_role, user.id)
      : await createMembership(supabase, joinRequest, user.id);

    if (joinRequest.class_id) {
      const { error: classError } = await supabase.from('class_memberships').upsert(
        {
          class_id: joinRequest.class_id,
          school_membership_id: membership.id,
          role: joinRequest.requested_role,
          status: 'active',
        },
        { onConflict: 'class_id,school_membership_id' }
      );

      if (classError) {
        throw classError;
      }
    }

    const { data: reviewedRequest, error: reviewError } = await supabase
      .from('school_join_requests')
      .update({
        status: 'active',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', joinRequest.id)
      .select('id, status')
      .single();

    if (reviewError) {
      throw reviewError;
    }

    await supabase.from('audit_logs').insert({
      school_id: joinRequest.school_id,
      actor_profile_id: user.id,
      action: 'school_access.approved',
      entity_type: 'school_join_request',
      entity_id: joinRequest.id,
      metadata: { membership_id: membership.id, requested_role: joinRequest.requested_role },
    });

    return json({ request: reviewedRequest, membership });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

async function activateExistingMembership(
  supabase: any,
  membershipId: string,
  role: JoinRequestRow['requested_role'],
  reviewerId: string
) {
  const { data, error } = await supabase
    .from('school_memberships')
    .update({
      role,
      status: 'active',
      approved_by: reviewerId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', membershipId)
    .select('id, role, status')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function createMembership(
  supabase: any,
  joinRequest: JoinRequestRow,
  reviewerId: string
) {
  const { data, error } = await supabase
    .from('school_memberships')
    .insert({
      school_id: joinRequest.school_id,
      profile_id: joinRequest.profile_id,
      role: joinRequest.requested_role,
      status: 'active',
      approved_by: reviewerId,
      approved_at: new Date().toISOString(),
    })
    .select('id, role, status')
    .single();

  if (error) {
    throw error;
  }

  return data;
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
