import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type CreateSchoolRequest = {
  name: string;
  country?: string;
  city?: string;
  logoUrl?: string;
  bannerUrl?: string;
  stickerKey?: string;
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
      getServiceRoleKey()
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session' }, 401);
    }

    const body = (await request.json()) as CreateSchoolRequest;
    const name = body.name?.trim();

    if (!name) {
      return json({ error: 'School name is required' }, 400);
    }

    const slug = await createUniqueSlug(supabase, name);

    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'School owner',
      preferred_language: user.user_metadata?.preferred_language ?? 'English',
      learning_level: user.user_metadata?.learning_level ?? 'balanced',
      audio_enabled: user.user_metadata?.audio_enabled ?? true,
    });

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .insert({
        name,
        slug,
        country: body.country?.trim() || null,
        city: body.city?.trim() || null,
        logo_url: cleanUrl(body.logoUrl),
        banner_url: cleanUrl(body.bannerUrl),
        sticker_key: cleanSticker(body.stickerKey),
        created_by: user.id,
      })
      .select('id, name, slug, city, country, logo_url, banner_url, sticker_key, subscription_status, external_crews_allowed')
      .single();

    if (schoolError) {
      throw schoolError;
    }

    const { data: membership, error: membershipError } = await supabase
      .from('school_memberships')
      .insert({
        school_id: school.id,
        profile_id: user.id,
        role: 'owner',
        status: 'active',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .select('id, role, status')
      .single();

    if (membershipError) {
      throw membershipError;
    }

    await supabase.from('subscriptions').insert({
      school_id: school.id,
      plan_name: 'Pilot School',
      status: 'trial',
      monthly_usd: 0,
    });

    await supabase.from('audit_logs').insert({
      school_id: school.id,
      actor_profile_id: user.id,
      action: 'school.created',
      entity_type: 'school',
      entity_id: school.id,
      metadata: { name: school.name, slug: school.slug },
    });

    return json({ school, membership });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

async function createUniqueSlug(supabase: SupabaseClient, name: string) {
  const base = slugify(name);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data, error } = await supabase.from('schools').select('id').eq('slug', slug).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return slug;
    }
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return slug || `school-${crypto.randomUUID().slice(0, 8)}`;
}

function cleanUrl(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function cleanSticker(value?: string) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
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
