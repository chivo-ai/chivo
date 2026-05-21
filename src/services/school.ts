import { supabase } from '../lib/supabase';
import { SchoolMembershipRole } from '../types';

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
  grade_level: string | null;
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
  class_id: string | null;
  requested_role: SchoolMembershipRole;
  status: string;
  message: string | null;
  created_at: string;
  profiles?: {
    full_name?: string;
  } | null;
};

export type SchoolSetupState = {
  academicYears: AcademicYearRow[];
  academicTerms: AcademicTermRow[];
  subjects: SubjectRow[];
  classes: ClassRow[];
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
  gradeLevel: string;
};

type CreateInviteInput = {
  schoolId: string;
  classId: string | null;
  role: SchoolMembershipRole;
  maxUses: string;
};

function client() {
  if (!supabase) {
    throw new Error('School access is not available right now.');
  }

  return supabase;
}

export async function fetchSchoolSetupState(schoolId: string): Promise<SchoolSetupState> {
  const db = client() as any;
  const [
    academicYears,
    academicTerms,
    subjects,
    classes,
    invites,
    joinRequests,
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
      .select('id, academic_term_id, name, grade_level')
      .eq('school_id', schoolId)
      .order('name', { ascending: true }),
    db
      .from('school_invites')
      .select('id, class_id, code, role, status, max_uses, use_count, expires_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false }),
    db
      .from('school_join_requests')
      .select('id, class_id, requested_role, status, message, created_at, profiles(full_name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false }),
  ]);

  const error = [
    academicYears.error,
    academicTerms.error,
    subjects.error,
    classes.error,
    invites.error,
    joinRequests.error,
  ].find(Boolean);

  if (error) {
    throw error;
  }

  return {
    academicYears: (academicYears.data ?? []) as AcademicYearRow[],
    academicTerms: (academicTerms.data ?? []) as AcademicTermRow[],
    subjects: (subjects.data ?? []) as SubjectRow[],
    classes: (classes.data ?? []) as ClassRow[],
    invites: (invites.data ?? []) as InviteRow[],
    joinRequests: (joinRequests.data ?? []) as JoinRequestRow[],
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

  const { error } = await (client() as any).from('subjects').insert({
    school_id: input.schoolId,
    name: input.name.trim(),
    department: input.department.trim() || null,
  });

  if (error) {
    throw error;
  }
}

export async function createClass(input: CreateClassInput) {
  requireFields([['Class name', input.name]]);
  const createdBy = await getCurrentUserId();

  const { error } = await (client() as any).from('classes').insert({
    school_id: input.schoolId,
    academic_term_id: input.academicTermId,
    name: input.name.trim(),
    grade_level: input.gradeLevel.trim() || null,
    created_by: createdBy,
  });

  if (error) {
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

function generateInviteCode(role: SchoolMembershipRole) {
  const prefix = role === 'teacher' ? 'TCH' : role === 'student' ? 'STU' : 'SCH';
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';

  for (let index = 0; index < 6; index += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return `${prefix}-${token.slice(0, 3)}-${token.slice(3)}`;
}
