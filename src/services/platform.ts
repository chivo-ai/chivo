import { supabase } from '../lib/supabase';

export type SchoolCreationAvailability = {
  enabled: boolean;
  message: string | null;
};

export type PlatformBranding = {
  name: string;
  subtitle: string | null;
  logoUrl: string | null;
};

const defaultSchoolCreation: SchoolCreationAvailability = {
  enabled: true,
  message: null,
};

const defaultPlatformBranding: PlatformBranding = {
  name: 'Chivo AI',
  subtitle: 'Learn smarter',
  logoUrl: null,
};

export async function fetchSchoolCreationAvailability(): Promise<SchoolCreationAvailability> {
  if (!supabase) {
    return defaultSchoolCreation;
  }

  const { data, error } = await (supabase as any)
    .from('platform_settings')
    .select('value')
    .eq('key', 'school_creation')
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') {
      return defaultSchoolCreation;
    }

    throw error;
  }

  const value = data?.value;
  if (!value || typeof value !== 'object') {
    return defaultSchoolCreation;
  }

  return {
    enabled: value.enabled !== false,
    message: typeof value.message === 'string' && value.message.trim() ? value.message.trim() : null,
  };
}

export async function fetchPlatformBranding(): Promise<PlatformBranding> {
  if (!supabase) {
    return defaultPlatformBranding;
  }

  const { data, error } = await (supabase as any)
    .from('platform_settings')
    .select('value')
    .eq('key', 'company_branding')
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') {
      return defaultPlatformBranding;
    }

    throw error;
  }

  const value = data?.value;
  if (!value || typeof value !== 'object') {
    return defaultPlatformBranding;
  }

  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : defaultPlatformBranding.name;
  const subtitle =
    typeof value.subtitle === 'string' && value.subtitle.trim() ? value.subtitle.trim() : defaultPlatformBranding.subtitle;
  const logoUrl =
    typeof value.logoUrl === 'string' && value.logoUrl.trim()
      ? value.logoUrl.trim()
      : typeof value.logo_url === 'string' && value.logo_url.trim()
        ? value.logo_url.trim()
        : null;

  return {
    name,
    subtitle,
    logoUrl,
  };
}
