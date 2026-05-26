import { supabase } from '../lib/supabase';
import { MembershipStatus, SchoolMembershipRole } from '../types';

export type AcademicYearRow = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

export type AcademicTermRow = {
  id: string;
  academic_year_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

export type SubjectRow = {
  id: string;
  name: string;
  department: string | null;
};

export type ClassRow = {
  id: string;
  academic_term_id: string | null;
  name: string;
  username: string;
  grade_level: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  sticker_key?: string | null;
};

export type SchoolMemberRow = {
  id: string;
  profile_id: string;
  role: SchoolMembershipRole;
  status: MembershipStatus;
  created_at: string;
  profiles?: {
    full_name?: string;
    preferred_language?: string;
  } | null;
};

export type ClassMembershipRow = {
  id: string;
  class_id: string;
  school_membership_id: string;
  role: SchoolMembershipRole;
  status: MembershipStatus;
};

export type ClassSubjectRow = {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_membership_id: string | null;
};

export type InviteRow = {
  id: string;
  class_id: string | null;
  code: string;
  role: SchoolMembershipRole;
  status: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
};

export type JoinRequestRow = {
  id: string;
  profile_id: string;
  class_id: string | null;
  requested_role: SchoolMembershipRole;
  status: MembershipStatus;
  message: string | null;
  created_at: string;
  profiles?: {
    full_name?: string;
  } | null;
  classes?: {
    name?: string;
  } | null;
};

export type SchoolSetupState = {
  academicYears: AcademicYearRow[];
  academicTerms: AcademicTermRow[];
  subjects: SubjectRow[];
  classes: ClassRow[];
  members: SchoolMemberRow[];
  classMemberships: ClassMembershipRow[];
  classSubjects: ClassSubjectRow[];
  invites: InviteRow[];
  joinRequests: JoinRequestRow[];
};

type CreateAcademicYearInput = {
  schoolId: string;
  name: string;
  startsAt: string;
  endsAt: string;
};

type CreateAcademicTermInput = CreateAcademicYearInput & {
  academicYearId: string;
};

type CreateSubjectInput = {
  schoolId: string;
  name: string;
  department: string;
};

type CreateClassInput = {
  schoolId: string;
  academicTermId: string | null;
  name: string;
  username?: string;
  gradeLevel: string;
  logoUrl?: string;
  bannerUrl?: string;
  stickerKey?: string;
};

type UpdateSchoolDetailsInput = {
  schoolId: string;
  name: string;
  username: string;
  country: string;
  city: string;
  logoUrl: string;
  bannerUrl: string;
  stickerKey: string;
};

type UpdateClassUsernameInput = {
  classId: string;
  username: string;
};

type CreateInviteInput = {
  schoolId: string;
  classId: string | null;
  role: SchoolMembershipRole;
  maxUses: string;
};

type AssignMemberToClassInput = {
  classId: string;
  schoolMembershipId: string;
  role: SchoolMembershipRole;
};

type RequestClassAccessInput = {
  schoolId: string;
  classId: string;
  schoolMembershipId: string;
  requestedRole: SchoolMembershipRole;
  message: string;
};

type CreateClassSubjectInput = {
  classId: string;
  subjectId: string;
  teacherMembershipId: string | null;
};

function client() {
  if (!supabase) {
    throw new Error('School access is not available right now.');
  }

  return supabase;
}

export async function fetchSchoolSetupState(
  schoolId: string,
  includeAdminRecords = false
): Promise<SchoolSetupState> {
  const db = client() as any;
  const [
    academicYears,
    academicTerms,
    subjects,
    classes,
    members,
    accessRecords,
  ] = await Promise.all([
    db
      .from('academic_years')
      .select('id, name, starts_at, ends_at, status')
      .eq('school_id', schoolId)
      .order('starts_at', { ascending: false }),
    db
      .from('academic_terms')
      .select('id, academic_year_id, name, starts_at, ends_at, status')
      .eq('school_id', schoolId)
      .order('starts_at', { ascending: false }),
    db
      .from('subjects')
      .select('id, name, department')
      .eq('school_id', schoolId)
      .order('name', { ascending: true }),
    db
      .from('classes')
      .select('id, academic_term_id, name, username, grade_level, logo_url, banner_url, sticker_key')
      .eq('school_id', schoolId)
      .order('name', { ascending: true }),
    db
      .from('school_memberships')
      .select('id, profile_id, role, status, created_at, profiles!school_memberships_profile_id_fkey(full_name, preferred_language)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false }),
    includeAdminRecords ? fetchAdminRecords(db, schoolId) : fetchMemberAccessRecords(db, schoolId),
  ]);

  const classIds = ((classes.data ?? []) as ClassRow[]).map((schoolClass) => schoolClass.id);
  const [classMemberships, classSubjects] = classIds.length
    ? await Promise.all([
        db
          .from('class_memberships')
          .select('id, class_id, school_membership_id, role, status')
          .in('class_id', classIds),
        db
          .from('class_subjects')
          .select('id, class_id, subject_id, teacher_membership_id')
          .in('class_id', classIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  const error = [
    academicYears.error,
    academicTerms.error,
    subjects.error,
    classes.error,
    members.error,
    classMemberships.error,
    classSubjects.error,
    accessRecords.invites.error,
    accessRecords.joinRequests.error,
  ].find(Boolean);

  if (error) {
    throw error;
  }

  return {
    academicYears: (academicYears.data ?? []) as AcademicYearRow[],
    academicTerms: (academicTerms.data ?? []) as AcademicTermRow[],
    subjects: (subjects.data ?? []) as SubjectRow[],
    classes: (classes.data ?? []) as ClassRow[],
    members: (members.data ?? []) as SchoolMemberRow[],
    classMemberships: (classMemberships.data ?? []) as ClassMembershipRow[],
    classSubjects: (classSubjects.data ?? []) as ClassSubjectRow[],
    invites: (accessRecords.invites.data ?? []) as InviteRow[],
    joinRequests: (accessRecords.joinRequests.data ?? []) as JoinRequestRow[],
  };
}

async function fetchAdminRecords(db: any, schoolId: string) {
  const [invites, joinRequests] = await Promise.all([
    db
      .from('school_invites')
      .select('id, class_id, code, role, status, max_uses, use_count, expires_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false }),
    db
      .from('school_join_requests')
      .select('id, profile_id, class_id, requested_role, status, message, created_at, profiles!school_join_requests_profile_id_fkey(full_name), classes(name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false }),
  ]);

  return { invites, joinRequests };
}

async function fetchMemberAccessRecords(db: any, schoolId: string) {
  const joinRequests = await db
    .from('school_join_requests')
    .select('id, profile_id, class_id, requested_role, status, message, created_at, profiles!school_join_requests_profile_id_fkey(full_name), classes(name)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  return {
    invites: { data: [], error: null },
    joinRequests,
  };
}

export async function createAcademicYear(input: CreateAcademicYearInput) {
  requireFields([
    ['Academic year name', input.name],
    ['Start date', input.startsAt],
    ['End date', input.endsAt],
  ]);

  const { error } = await (client() as any).from('academic_years').insert({
    school_id: input.schoolId,
    name: input.name.trim(),
    starts_at: input.startsAt.trim(),
    ends_at: input.endsAt.trim(),
    status: 'active',
  });

  if (error) {
    throw error;
  }
}

export async function createAcademicTerm(input: CreateAcademicTermInput) {
  requireFields([
    ['Academic year', input.academicYearId],
    ['Term name', input.name],
    ['Start date', input.startsAt],
    ['End date', input.endsAt],
  ]);

  const { error } = await (client() as any).from('academic_terms').insert({
    school_id: input.schoolId,
    academic_year_id: input.academicYearId,
    name: input.name.trim(),
    starts_at: input.startsAt.trim(),
    ends_at: input.endsAt.trim(),
    status: 'active',
  });

  if (error) {
    throw error;
  }
}

export async function createSubject(input: CreateSubjectInput) {
  requireFields([['Subject name', input.name]]);

  const { data, error } = await (client() as any)
    .from('subjects')
    .insert({
      school_id: input.schoolId,
      name: input.name.trim(),
      department: input.department.trim() || null,
    })
    .select('id, name, department')
    .single();

  if (error) {
    throw error;
  }

  return data as SubjectRow;
}

export async function createClass(input: CreateClassInput) {
  requireFields([['Class name', input.name]]);

  const { error } = await (client() as any).rpc('create_class_for_school', {
    school_id_input: input.schoolId,
    class_name: input.name.trim(),
    academic_term_id_input: input.academicTermId,
    class_username_input: input.username?.trim() || null,
    grade_level_input: input.gradeLevel.trim() || null,
    logo_url_input: cleanUrl(input.logoUrl),
    banner_url_input: cleanUrl(input.bannerUrl),
    sticker_key_input: input.stickerKey?.trim() || null,
  });

  if (error) {
    if (error.code === '23505' || error.message?.toLowerCase().includes('already uses')) {
      throw new Error('A class in this school already uses that name or username.');
    }
    throw error;
  }
}

export async function updateSchoolDetails(input: UpdateSchoolDetailsInput) {
  requireFields([
    ['School name', input.name],
  ]);

  const { data, error } = await (client() as any)
    .from('schools')
    .update({
      name: input.name.trim(),
      slug: cleanUsername(input.username),
      country: input.country.trim() || null,
      city: input.city.trim() || null,
      logo_url: cleanUrl(input.logoUrl),
      banner_url: cleanUrl(input.bannerUrl),
      sticker_key: input.stickerKey.trim() || null,
    })
    .eq('id', input.schoolId)
    .select('id, name, slug, city, country, logo_url, banner_url, sticker_key, subscription_status, external_crews_allowed')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Another school already uses that username.');
    }
    throw error;
  }

  return data;
}

export async function updateClassUsername(input: UpdateClassUsernameInput) {
  requireFields([
    ['Class', input.classId],
    ['Class username', input.username],
  ]);

  const { error } = await (client() as any)
    .from('classes')
    .update({ username: cleanUsername(input.username) })
    .eq('id', input.classId);

  if (error) {
    if (error.code === '23505') {
      throw new Error('A class in this school already uses that username.');
    }
    throw error;
  }
}

export async function createSchoolInvite(input: CreateInviteInput) {
  const maxUses = input.maxUses.trim() ? Number(input.maxUses.trim()) : null;
  const createdBy = await getCurrentUserId();

  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
    throw new Error('Max uses must be a whole number.');
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateInviteCode(input.role);
    const { error } = await (client() as any).from('school_invites').insert({
      school_id: input.schoolId,
      class_id: input.classId,
      code,
      role: input.role,
      max_uses: maxUses,
      created_by: createdBy,
    });

    if (!error) {
      return code;
    }

    if (error.code !== '23505') {
      throw error;
    }
  }

  throw new Error('Could not generate a unique invite code. Try again.');
}

export async function assignMemberToClass(input: AssignMemberToClassInput) {
  requireFields([
    ['Class', input.classId],
    ['Member', input.schoolMembershipId],
  ]);

  const { error } = await (client() as any).from('class_memberships').upsert(
    {
      class_id: input.classId,
      school_membership_id: input.schoolMembershipId,
      role: input.role,
      status: 'active',
    },
    { onConflict: 'class_id,school_membership_id' }
  );

  if (error) {
    throw error;
  }
}

export async function requestClassAccess(input: RequestClassAccessInput) {
  requireFields([
    ['Class', input.classId],
    ['Member', input.schoolMembershipId],
  ]);

  const profileId = await getCurrentUserId();
  const db = client() as any;

  const { data: existingClassMembership, error: membershipError } = await db
    .from('class_memberships')
    .select('id, status')
    .eq('class_id', input.classId)
    .eq('school_membership_id', input.schoolMembershipId)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (existingClassMembership?.status === 'active') {
    return { alreadyMember: true };
  }

  const { data: existingRequest, error: requestLookupError } = await db
    .from('school_join_requests')
    .select('id, status')
    .eq('school_id', input.schoolId)
    .eq('class_id', input.classId)
    .eq('profile_id', profileId)
    .eq('status', 'review')
    .maybeSingle();

  if (requestLookupError) {
    throw requestLookupError;
  }

  if (existingRequest) {
    return { alreadyRequested: true, request: existingRequest };
  }

  const { data, error } = await db
    .from('school_join_requests')
    .insert({
      school_id: input.schoolId,
      class_id: input.classId,
      profile_id: profileId,
      requested_role: input.requestedRole,
      status: 'review',
      message: input.message.trim() || null,
    })
    .select('id, status')
    .single();

  if (error) {
    throw error;
  }

  return { request: data };
}

export async function removeMemberFromClass(classMembershipId: string) {
  requireFields([['Class membership', classMembershipId]]);

  const { error } = await (client() as any)
    .from('class_memberships')
    .delete()
    .eq('id', classMembershipId);

  if (error) {
    throw error;
  }
}

export async function createClassSubject(input: CreateClassSubjectInput) {
  requireFields([
    ['Class', input.classId],
    ['Subject', input.subjectId],
  ]);

  const { error } = await (client() as any).from('class_subjects').upsert(
    {
      class_id: input.classId,
      subject_id: input.subjectId,
      teacher_membership_id: input.teacherMembershipId,
    },
    { onConflict: 'class_id,subject_id' }
  );

  if (error) {
    throw error;
  }
}

export async function removeClassSubject(classSubjectId: string) {
  requireFields([['Class subject', classSubjectId]]);

  const { error } = await (client() as any)
    .from('class_subjects')
    .delete()
    .eq('id', classSubjectId);

  if (error) {
    throw error;
  }
}

export async function updateSchoolMemberStatus(
  membershipId: string,
  status: Extract<MembershipStatus, 'active' | 'suspended'>
) {
  requireFields([['Member', membershipId]]);

  const { error } = await (client() as any)
    .from('school_memberships')
    .update({ status })
    .eq('id', membershipId);

  if (error) {
    throw error;
  }
}

export async function reviewJoinRequest(
  requestId: string,
  decision: 'approve' | 'decline'
) {
  const { data, error } = await client().functions.invoke('review-join-request', {
    body: { requestId, decision },
  });

  if (error) {
    throw error;
  }

  return data;
}

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await client().auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error('Sign in again to continue.');
  }

  return user.id;
}

function requireFields(fields: Array<[string, string | null | undefined]>) {
  const missing = fields.find(([, value]) => !value?.trim());

  if (missing) {
    throw new Error(`${missing[0]} is required.`);
  }
}

function cleanUrl(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export function cleanUsername(value: string) {
  const username = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  if (!username) {
    throw new Error('Username is required.');
  }

  return username;
}

function generateInviteCode(role: SchoolMembershipRole) {
  const prefix = role === 'teacher' ? 'TCH' : role === 'student' ? 'STU' : 'SCH';
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';

  for (let index = 0; index < 6; index += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return `${prefix}-${token.slice(0, 3)}-${token.slice(3)}`;
}
