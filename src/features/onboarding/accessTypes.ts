import { ActiveSchoolMembership, MembershipStatus, SchoolMembershipRole } from '../../types';

export type AccessSubmitting = 'create' | 'join' | 'request' | 'sign_out' | null;

export type MembershipRow = {
  id: string;
  school_id: string;
  role: string;
  status: string;
  schools?: {
    id?: string;
    name?: string;
    slug?: string | null;
    city?: string | null;
    country?: string | null;
    subscription_status?: string | null;
    external_crews_allowed?: boolean | null;
    logo_url?: string | null;
    banner_url?: string | null;
    sticker_key?: string | null;
  } | null;
};

export type AccessSchoolValues = {
  schoolName: string;
  country: string;
  city: string;
  schoolLogoUrl: string;
  schoolBannerUrl: string;
  schoolStickerKey: string;
};

export type AccessProfileValues = {
  profileName: string;
  preferredLanguage: string;
  learningLevel: string;
};

export type AccessProfileImageValues = {
  profileAvatarUrl: string;
  profileStickerKey: string;
};

export const requestRoles: SchoolMembershipRole[] = ['student', 'teacher', 'guardian'];

export function formatRole(value: string) {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

export function isActiveMembership(row: MembershipRow) {
  return row.status === 'active';
}

export function membershipStatus(row: MembershipRow) {
  return row.status as MembershipStatus;
}

export function mapMembershipRow(row: MembershipRow): ActiveSchoolMembership {
  return {
    id: row.id,
    schoolId: row.school_id,
    role: row.role as SchoolMembershipRole,
    status: row.status as MembershipStatus,
    school: {
      id: row.schools?.id ?? row.school_id,
      name: row.schools?.name ?? 'School workspace',
      slug: row.schools?.slug ?? null,
      city: row.schools?.city ?? null,
      country: row.schools?.country ?? null,
      logoUrl: row.schools?.logo_url ?? null,
      bannerUrl: row.schools?.banner_url ?? null,
      stickerKey: row.schools?.sticker_key ?? null,
      subscriptionStatus: row.schools?.subscription_status ?? null,
      externalCrewsAllowed: row.schools?.external_crews_allowed ?? null,
    },
  };
}

export function membershipFromCreateResult(result: unknown): ActiveSchoolMembership | null {
  const payload = result as {
    school?: {
      id?: string;
      name?: string;
      slug?: string | null;
      city?: string | null;
      country?: string | null;
      logo_url?: string | null;
      banner_url?: string | null;
      sticker_key?: string | null;
      subscription_status?: string | null;
      external_crews_allowed?: boolean | null;
    };
    membership?: {
      id?: string;
      role?: string;
      status?: string;
    };
  };

  if (!payload.school?.id || !payload.membership?.id) {
    return null;
  }

  return {
    id: payload.membership.id,
    schoolId: payload.school.id,
    role: (payload.membership.role ?? 'owner') as SchoolMembershipRole,
    status: (payload.membership.status ?? 'active') as MembershipStatus,
    school: {
      id: payload.school.id,
      name: payload.school.name ?? 'School workspace',
      slug: payload.school.slug ?? null,
      city: payload.school.city ?? null,
      country: payload.school.country ?? null,
      logoUrl: payload.school.logo_url ?? null,
      bannerUrl: payload.school.banner_url ?? null,
      stickerKey: payload.school.sticker_key ?? null,
      subscriptionStatus: payload.school.subscription_status ?? 'trial',
      externalCrewsAllowed: payload.school.external_crews_allowed ?? false,
    },
  };
}

export function membershipFromInviteResult(result: unknown): ActiveSchoolMembership | null {
  const payload = result as {
    school?: {
      id?: string;
      name?: string;
      slug?: string | null;
      city?: string | null;
      country?: string | null;
      subscription_status?: string | null;
      external_crews_allowed?: boolean | null;
      logo_url?: string | null;
      banner_url?: string | null;
      sticker_key?: string | null;
    };
    membership?: {
      id?: string;
      role?: string;
      status?: string;
      school_id?: string;
    };
  };

  const schoolId = payload.school?.id ?? payload.membership?.school_id;

  if (!schoolId || !payload.membership?.id) {
    return null;
  }

  return {
    id: payload.membership.id,
    schoolId,
    role: (payload.membership.role ?? 'student') as SchoolMembershipRole,
    status: (payload.membership.status ?? 'active') as MembershipStatus,
    school: {
      id: schoolId,
      name: payload.school?.name ?? 'School workspace',
      slug: payload.school?.slug ?? null,
      city: payload.school?.city ?? null,
      country: payload.school?.country ?? null,
      logoUrl: payload.school?.logo_url ?? null,
      bannerUrl: payload.school?.banner_url ?? null,
      stickerKey: payload.school?.sticker_key ?? null,
      subscriptionStatus: payload.school?.subscription_status ?? null,
      externalCrewsAllowed: payload.school?.external_crews_allowed ?? null,
    },
  };
}
