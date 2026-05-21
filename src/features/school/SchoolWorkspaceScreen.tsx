import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LogOut,
  QrCode,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { signOut } from '../../services/auth';
import {
  AcademicTermRow,
  AcademicYearRow,
  ClassMembershipRow,
  ClassSubjectRow,
  ClassRow,
  InviteRow,
  SchoolSetupState,
  SchoolMemberRow,
  SubjectRow,
  assignMemberToClass,
  createClassSubject,
  createAcademicTerm,
  createAcademicYear,
  createClass,
  createSchoolInvite,
  createSubject,
  fetchSchoolSetupState,
  removeClassSubject,
  removeMemberFromClass,
  reviewJoinRequest,
  updateSchoolMemberStatus,
} from '../../services/school';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership, SchoolMembershipRole } from '../../types';

type SchoolWorkspaceScreenProps = {
  membership: ActiveSchoolMembership;
  onSwitchSchool: () => void;
};

type WorkspaceCounts = {
  activeMembers: number;
  classes: number;
  subjects: number;
  invites: number;
  pendingRequests: number;
  lessons: number;
};

const emptyCounts: WorkspaceCounts = {
  activeMembers: 0,
  classes: 0,
  subjects: 0,
  invites: 0,
  pendingRequests: 0,
  lessons: 0,
};

const emptySetup: SchoolSetupState = {
  academicYears: [],
  academicTerms: [],
  subjects: [],
  classes: [],
  members: [],
  classMemberships: [],
  classSubjects: [],
  invites: [],
  joinRequests: [],
};

const inviteRoles: SchoolMembershipRole[] = ['student', 'teacher', 'admin'];

export function SchoolWorkspaceScreen({ membership, onSwitchSchool }: SchoolWorkspaceScreenProps) {
  const [counts, setCounts] = useState<WorkspaceCounts>(emptyCounts);
  const [setup, setSetup] = useState<SchoolSetupState>(emptySetup);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [yearName, setYearName] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);

  const [termName, setTermName] = useState('');
  const [termStart, setTermStart] = useState('');
  const [termEnd, setTermEnd] = useState('');
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  const [subjectName, setSubjectName] = useState('');
  const [subjectDepartment, setSubjectDepartment] = useState('');

  const [className, setClassName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');

  const [inviteClassId, setInviteClassId] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<SchoolMembershipRole>('student');
  const [inviteMaxUses, setInviteMaxUses] = useState('');

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberClassId, setSelectedMemberClassId] = useState<string | null>(null);
  const [selectedSubjectClassId, setSelectedSubjectClassId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  const isAdmin = membership.role === 'owner' || membership.role === 'admin';

  const selectedYear = useMemo(
    () => setup.academicYears.find((year) => year.id === selectedYearId) ?? setup.academicYears[0],
    [selectedYearId, setup.academicYears]
  );

  const selectedTerm = useMemo(
    () => setup.academicTerms.find((term) => term.id === selectedTermId) ?? setup.academicTerms[0],
    [selectedTermId, setup.academicTerms]
  );

  const selectedMember = useMemo(
    () => setup.members.find((member) => member.id === selectedMemberId) ?? null,
    [selectedMemberId, setup.members]
  );

  const loadWorkspace = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setError(null);

    const [setupState, activeMembers, lessons] = await Promise.all([
      fetchSchoolSetupState(membership.schoolId, isAdmin),
      countRows('school_memberships', membership.schoolId, 'school_id', { status: 'active' }),
      countRows('lessons', membership.schoolId, 'school_id'),
    ]);

    if (activeMembers.error || lessons.error) {
      setError(activeMembers.error ?? lessons.error);
    }

    setSetup(setupState);
    setCounts({
      activeMembers: setupState.members.filter((member) => member.status === 'active').length || activeMembers.count,
      classes: setupState.classes.length,
      subjects: setupState.subjects.length,
      invites: setupState.invites.filter((invite) => invite.status === 'active').length,
      pendingRequests: setupState.joinRequests.filter((request) => request.status === 'review').length,
      lessons: lessons.count,
    });

    setSelectedYearId((current) => current ?? setupState.academicYears[0]?.id ?? null);
    setSelectedTermId((current) => current ?? setupState.academicTerms[0]?.id ?? null);
    setSelectedMemberId((current) => current ?? setupState.members[0]?.id ?? null);
    setSelectedMemberClassId((current) => current ?? setupState.classes[0]?.id ?? null);
    setSelectedSubjectClassId((current) => current ?? setupState.classes[0]?.id ?? null);
    setSelectedSubjectId((current) => current ?? setupState.subjects[0]?.id ?? null);
    setSelectedTeacherId((current) => {
      const teacher = setupState.members.find((member) =>
        member.status === 'active' && ['owner', 'admin', 'teacher'].includes(member.role)
      );
      return current ?? teacher?.id ?? null;
    });
  }, [
    isAdmin,
    membership.schoolId,
  ]);

  useEffect(() => {
    setLoading(true);
    loadWorkspace()
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load school.'))
      .finally(() => setLoading(false));
  }, [loadWorkspace]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadWorkspace().catch((caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not refresh school.')
    );
    setRefreshing(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  async function save(action: string, work: () => Promise<void>, successMessage: string | (() => string)) {
    setSaving(action);
    setError(null);
      setMessage(null);
    try {
      await work();
      setMessage(typeof successMessage === 'function' ? successMessage() : successMessage);
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save changes.');
    } finally {
      setSaving(null);
    }
  }

  async function handleCreateAcademicYear() {
    await save(
      'year',
      async () => {
        await createAcademicYear({
          schoolId: membership.schoolId,
          name: yearName,
          startsAt: yearStart,
          endsAt: yearEnd,
        });
        setYearName('');
        setYearStart('');
        setYearEnd('');
      },
      'Academic year added.'
    );
  }

  async function handleCreateAcademicTerm() {
    await save(
      'term',
      async () => {
        await createAcademicTerm({
          schoolId: membership.schoolId,
          academicYearId: selectedYear?.id ?? '',
          name: termName,
          startsAt: termStart,
          endsAt: termEnd,
        });
        setTermName('');
        setTermStart('');
        setTermEnd('');
      },
      'Term added.'
    );
  }

  async function handleCreateSubject() {
    await save(
      'subject',
      async () => {
        await createSubject({
          schoolId: membership.schoolId,
          name: subjectName,
          department: subjectDepartment,
        });
        setSubjectName('');
        setSubjectDepartment('');
      },
      'Subject added.'
    );
  }

  async function handleCreateClass() {
    await save(
      'class',
      async () => {
        await createClass({
          schoolId: membership.schoolId,
          academicTermId: selectedTerm?.id ?? null,
          name: className,
          gradeLevel,
        });
        setClassName('');
        setGradeLevel('');
      },
      'Class added.'
    );
  }

  async function handleCreateInvite() {
    let createdCode = '';
    await save(
      'invite',
      async () => {
        createdCode = await createSchoolInvite({
          schoolId: membership.schoolId,
          classId: inviteClassId,
          role: inviteRole,
          maxUses: inviteMaxUses,
        });
        setInviteMaxUses('');
      },
      () => `Invite code created: ${createdCode}`
    );
  }

  async function handleAssignMemberToClass() {
    await save(
      'assign-member',
      async () => {
        await assignMemberToClass({
          classId: selectedMemberClassId ?? '',
          schoolMembershipId: selectedMember?.id ?? '',
          role: selectedMember?.role ?? 'student',
        });
      },
      'Class access updated.'
    );
  }

  async function handleRemoveMemberFromClass(classMembershipId: string) {
    await save(
      `remove-member-${classMembershipId}`,
      async () => {
        await removeMemberFromClass(classMembershipId);
      },
      'Class access removed.'
    );
  }

  async function handleCreateClassSubject() {
    await save(
      'class-subject',
      async () => {
        await createClassSubject({
          classId: selectedSubjectClassId ?? '',
          subjectId: selectedSubjectId ?? '',
          teacherMembershipId: selectedTeacherId,
        });
      },
      'Class subject added.'
    );
  }

  async function handleRemoveClassSubject(classSubjectId: string) {
    await save(
      `remove-subject-${classSubjectId}`,
      async () => {
        await removeClassSubject(classSubjectId);
      },
      'Class subject removed.'
    );
  }

  async function handleReviewJoinRequest(requestId: string, decision: 'approve' | 'decline') {
    await save(
      `${decision}-request-${requestId}`,
      async () => {
        await reviewJoinRequest(requestId, decision);
      },
      decision === 'approve' ? 'Request approved.' : 'Request declined.'
    );
  }

  async function handleUpdateMemberStatus(member: SchoolMemberRow, status: 'active' | 'suspended') {
    await save(
      `${status}-member-${member.id}`,
      async () => {
        await updateSchoolMemberStatus(member.id, status);
      },
      status === 'active' ? 'Member restored.' : 'Member suspended.'
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.shell}>
        <View style={styles.topRow}>
          <Pressable onPress={onSwitchSchool} style={styles.iconButton}>
            <ArrowLeft size={20} color={colors.tealDark} />
          </Pressable>
          <View style={styles.flexText}>
            <Text style={styles.title}>{membership.school.name}</Text>
            <Text style={styles.meta}>
              {formatRole(membership.role)} access - {membership.school.slug ?? membership.school.city ?? 'Location not set'}
            </Text>
          </View>
          <Pressable onPress={handleSignOut} style={styles.signOutButton}>
            {signingOut ? (
              <ActivityIndicator color={colors.tealDark} />
            ) : (
              <>
                <LogOut size={17} color={colors.tealDark} />
                <Text style={styles.signOutText}>Sign out</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.heroPanel}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIcon}>
              <ShieldCheck size={26} color="#ffffff" />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.heroTitle}>School workspace</Text>
              <Text style={styles.heroBody}>
                Manage the school structure, class access, and invitation codes from one place.
              </Text>
            </View>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {message ? <Text style={styles.successText}>{message}</Text> : null}

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.tealDark} />
            <Text style={styles.meta}>Loading school data</Text>
          </View>
        ) : (
          <>
            <View style={styles.metricGrid}>
              <Metric label="Active members" value={counts.activeMembers} icon={<Users size={20} color={colors.teal} />} />
              <Metric label="Classes" value={counts.classes} icon={<BookOpen size={20} color={colors.blue} />} />
              <Metric label="Subjects" value={counts.subjects} icon={<ClipboardList size={20} color={colors.gold} />} />
              <Metric label="Active invites" value={counts.invites} icon={<UserPlus size={20} color={colors.teal} />} />
              <Metric label="Join requests" value={counts.pendingRequests} icon={<Users size={20} color={colors.coral} />} />
              <Metric label="Lessons" value={counts.lessons} icon={<BookOpen size={20} color={colors.blue} />} />
            </View>

            {isAdmin ? (
              <AdminSetup
                setup={setup}
                selectedYearId={selectedYear?.id ?? null}
                selectedTermId={selectedTerm?.id ?? null}
                inviteClassId={inviteClassId}
                inviteRole={inviteRole}
                selectedMemberId={selectedMemberId}
                selectedMemberClassId={selectedMemberClassId}
                selectedSubjectClassId={selectedSubjectClassId}
                selectedSubjectId={selectedSubjectId}
                selectedTeacherId={selectedTeacherId}
                values={{
                  yearName,
                  yearStart,
                  yearEnd,
                  termName,
                  termStart,
                  termEnd,
                  subjectName,
                  subjectDepartment,
                  className,
                  gradeLevel,
                  inviteMaxUses,
                }}
                saving={saving}
                onSelectYear={setSelectedYearId}
                onSelectTerm={setSelectedTermId}
                onSelectInviteClass={setInviteClassId}
                onSelectInviteRole={setInviteRole}
                onSelectMember={setSelectedMemberId}
                onSelectMemberClass={setSelectedMemberClassId}
                onSelectSubjectClass={setSelectedSubjectClassId}
                onSelectSubject={setSelectedSubjectId}
                onSelectTeacher={setSelectedTeacherId}
                onChange={{
                  setYearName,
                  setYearStart,
                  setYearEnd,
                  setTermName,
                  setTermStart,
                  setTermEnd,
                  setSubjectName,
                  setSubjectDepartment,
                  setClassName,
                  setGradeLevel,
                  setInviteMaxUses,
                }}
                onCreateYear={handleCreateAcademicYear}
                onCreateTerm={handleCreateAcademicTerm}
                onCreateSubject={handleCreateSubject}
                onCreateClass={handleCreateClass}
                onCreateInvite={handleCreateInvite}
                onAssignMemberToClass={handleAssignMemberToClass}
                onRemoveMemberFromClass={handleRemoveMemberFromClass}
                onCreateClassSubject={handleCreateClassSubject}
                onRemoveClassSubject={handleRemoveClassSubject}
                onReviewJoinRequest={handleReviewJoinRequest}
                onUpdateMemberStatus={handleUpdateMemberStatus}
              />
            ) : (
              <MemberWorkspace setup={setup} membership={membership} />
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

type AdminSetupProps = {
  setup: SchoolSetupState;
  selectedYearId: string | null;
  selectedTermId: string | null;
  inviteClassId: string | null;
  inviteRole: SchoolMembershipRole;
  selectedMemberId: string | null;
  selectedMemberClassId: string | null;
  selectedSubjectClassId: string | null;
  selectedSubjectId: string | null;
  selectedTeacherId: string | null;
  values: {
    yearName: string;
    yearStart: string;
    yearEnd: string;
    termName: string;
    termStart: string;
    termEnd: string;
    subjectName: string;
    subjectDepartment: string;
    className: string;
    gradeLevel: string;
    inviteMaxUses: string;
  };
  saving: string | null;
  onSelectYear: (id: string) => void;
  onSelectTerm: (id: string) => void;
  onSelectInviteClass: (id: string | null) => void;
  onSelectInviteRole: (role: SchoolMembershipRole) => void;
  onSelectMember: (id: string) => void;
  onSelectMemberClass: (id: string) => void;
  onSelectSubjectClass: (id: string) => void;
  onSelectSubject: (id: string) => void;
  onSelectTeacher: (id: string | null) => void;
  onChange: {
    setYearName: (value: string) => void;
    setYearStart: (value: string) => void;
    setYearEnd: (value: string) => void;
    setTermName: (value: string) => void;
    setTermStart: (value: string) => void;
    setTermEnd: (value: string) => void;
    setSubjectName: (value: string) => void;
    setSubjectDepartment: (value: string) => void;
    setClassName: (value: string) => void;
    setGradeLevel: (value: string) => void;
    setInviteMaxUses: (value: string) => void;
  };
  onCreateYear: () => void;
  onCreateTerm: () => void;
  onCreateSubject: () => void;
  onCreateClass: () => void;
  onCreateInvite: () => void;
  onAssignMemberToClass: () => void;
  onRemoveMemberFromClass: (classMembershipId: string) => void;
  onCreateClassSubject: () => void;
  onRemoveClassSubject: (classSubjectId: string) => void;
  onReviewJoinRequest: (requestId: string, decision: 'approve' | 'decline') => void;
  onUpdateMemberStatus: (member: SchoolMemberRow, status: 'active' | 'suspended') => void;
};

function MemberWorkspace({
  setup,
  membership,
}: {
  setup: SchoolSetupState;
  membership: ActiveSchoolMembership;
}) {
  const assignedClasses = setup.classMemberships
    .filter((item) => item.school_membership_id === membership.id && item.status === 'active')
    .map((item) => setup.classes.find((schoolClass) => schoolClass.id === item.class_id))
    .filter(Boolean) as ClassRow[];

  return (
    <View style={styles.card}>
      <SectionTitle icon={<BookOpen size={22} color={colors.blue} />} title="Class access" />
      {assignedClasses.length ? (
        <View style={styles.recordList}>
          {assignedClasses.map((schoolClass) => {
            const subjectNames = setup.classSubjects
              .filter((item) => item.class_id === schoolClass.id)
              .map((item) => setup.subjects.find((subject) => subject.id === item.subject_id)?.name)
              .filter(Boolean);

            return (
              <View key={schoolClass.id} style={styles.recordRow}>
                <View style={styles.flexText}>
                  <Text style={styles.recordTitle}>{schoolClass.name}</Text>
                  <Text style={styles.recordMeta}>
                    {schoolClass.grade_level ?? 'Grade not set'}
                    {subjectNames.length ? ` - ${subjectNames.join(', ')}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.cardBody}>
          Your school account is active. Classes will appear here when an admin adds you.
        </Text>
      )}
    </View>
  );
}

function AdminSetup({
  setup,
  selectedYearId,
  selectedTermId,
  inviteClassId,
  inviteRole,
  selectedMemberId,
  selectedMemberClassId,
  selectedSubjectClassId,
  selectedSubjectId,
  selectedTeacherId,
  values,
  saving,
  onSelectYear,
  onSelectTerm,
  onSelectInviteClass,
  onSelectInviteRole,
  onSelectMember,
  onSelectMemberClass,
  onSelectSubjectClass,
  onSelectSubject,
  onSelectTeacher,
  onChange,
  onCreateYear,
  onCreateTerm,
  onCreateSubject,
  onCreateClass,
  onCreateInvite,
  onAssignMemberToClass,
  onRemoveMemberFromClass,
  onCreateClassSubject,
  onRemoveClassSubject,
  onReviewJoinRequest,
  onUpdateMemberStatus,
}: AdminSetupProps) {
  return (
    <View style={styles.setupGrid}>
      <View style={styles.card}>
        <SectionTitle icon={<CalendarDays size={22} color={colors.teal} />} title="Academic year" />
        <Field label="Name" value={values.yearName} onChangeText={onChange.setYearName} placeholder="2026 Academic Year" />
        <View style={styles.formRow}>
          <Field label="Starts" value={values.yearStart} onChangeText={onChange.setYearStart} placeholder="2026-01-12" />
          <Field label="Ends" value={values.yearEnd} onChangeText={onChange.setYearEnd} placeholder="2026-12-11" />
        </View>
        <SubmitButton label="Add academic year" loading={saving === 'year'} onPress={onCreateYear} />
        <RecordList
          emptyText="No academic years yet."
          items={setup.academicYears}
          renderItem={(year) => (
            <SelectableRow
              key={year.id}
              selected={year.id === selectedYearId}
              title={year.name}
              meta={`${year.starts_at} to ${year.ends_at}`}
              onPress={() => onSelectYear(year.id)}
            />
          )}
        />
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<ClipboardList size={22} color={colors.blue} />} title="Term" />
        <Text style={styles.helperText}>
          {selectedYearId ? 'Terms are attached to the selected academic year.' : 'Add an academic year before adding terms.'}
        </Text>
        <Field label="Name" value={values.termName} onChangeText={onChange.setTermName} placeholder="First Term" />
        <View style={styles.formRow}>
          <Field label="Starts" value={values.termStart} onChangeText={onChange.setTermStart} placeholder="2026-01-12" />
          <Field label="Ends" value={values.termEnd} onChangeText={onChange.setTermEnd} placeholder="2026-04-03" />
        </View>
        <SubmitButton label="Add term" loading={saving === 'term'} onPress={onCreateTerm} disabled={!selectedYearId} />
        <RecordList
          emptyText="No terms yet."
          items={setup.academicTerms}
          renderItem={(term) => (
            <SelectableRow
              key={term.id}
              selected={term.id === selectedTermId}
              title={term.name}
              meta={`${term.starts_at} to ${term.ends_at}`}
              onPress={() => onSelectTerm(term.id)}
            />
          )}
        />
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<GraduationCap size={22} color={colors.gold} />} title="Subjects" />
        <Field label="Subject" value={values.subjectName} onChangeText={onChange.setSubjectName} placeholder="Basic Science" />
        <Field label="Department" value={values.subjectDepartment} onChangeText={onChange.setSubjectDepartment} placeholder="Science" />
        <SubmitButton label="Add subject" loading={saving === 'subject'} onPress={onCreateSubject} />
        <SubjectList subjects={setup.subjects} />
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<BookOpen size={22} color={colors.blue} />} title="Classes" />
        <Text style={styles.helperText}>
          {selectedTermId ? 'New classes will use the selected term.' : 'Select or create a term for term-based class tracking.'}
        </Text>
        <Field label="Class name" value={values.className} onChangeText={onChange.setClassName} placeholder="JSS 2 Blue" />
        <Field label="Grade level" value={values.gradeLevel} onChangeText={onChange.setGradeLevel} placeholder="Junior secondary" />
        <SubmitButton label="Add class" loading={saving === 'class'} onPress={onCreateClass} />
        <ClassList classes={setup.classes} terms={setup.academicTerms} selectedClassId={inviteClassId} onSelectClass={onSelectInviteClass} />
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<ClipboardList size={22} color={colors.gold} />} title="Class subjects" />
        <Text style={styles.helperText}>Attach subjects to a class and choose the teacher responsible.</Text>
        <PickerRow
          emptyText="Create a class first."
          items={setup.classes}
          selectedId={selectedSubjectClassId}
          getLabel={(schoolClass) => schoolClass.name}
          onSelect={onSelectSubjectClass}
        />
        <PickerRow
          emptyText="Create a subject first."
          items={setup.subjects}
          selectedId={selectedSubjectId}
          getLabel={(subject) => subject.name}
          onSelect={onSelectSubject}
        />
        <PickerRow
          emptyText="Add a teacher or admin first."
          items={setup.members.filter((member) => member.status === 'active' && ['owner', 'admin', 'teacher'].includes(member.role))}
          selectedId={selectedTeacherId}
          getLabel={(member) => member.profiles?.full_name ?? formatRole(member.role)}
          onSelect={onSelectTeacher}
        />
        <SubmitButton
          label="Add class subject"
          loading={saving === 'class-subject'}
          onPress={onCreateClassSubject}
          disabled={!selectedSubjectClassId || !selectedSubjectId}
        />
        <ClassSubjectList
          classSubjects={setup.classSubjects}
          classes={setup.classes}
          subjects={setup.subjects}
          members={setup.members}
          saving={saving}
          onRemove={onRemoveClassSubject}
        />
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<Users size={22} color={colors.teal} />} title="People" />
        <Text style={styles.helperText}>Select a member, then give access to one or more classes.</Text>
        <MemberList
          members={setup.members}
          classMemberships={setup.classMemberships}
          classes={setup.classes}
          selectedMemberId={selectedMemberId}
          saving={saving}
          onSelectMember={onSelectMember}
          onRemoveClass={onRemoveMemberFromClass}
          onUpdateStatus={onUpdateMemberStatus}
        />
        <PickerRow
          emptyText="Create a class before assigning members."
          items={setup.classes}
          selectedId={selectedMemberClassId}
          getLabel={(schoolClass) => schoolClass.name}
          onSelect={onSelectMemberClass}
        />
        <SubmitButton
          label="Add selected member to class"
          loading={saving === 'assign-member'}
          onPress={onAssignMemberToClass}
          disabled={!selectedMemberId || !selectedMemberClassId}
        />
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<QrCode size={22} color={colors.teal} />} title="Invite codes" />
        <Text style={styles.helperText}>Choose a role and optional class before creating a code.</Text>
        <View style={styles.pillRow}>
          {inviteRoles.map((role) => (
            <ChoicePill
              key={role}
              selected={role === inviteRole}
              label={formatRole(role)}
              onPress={() => onSelectInviteRole(role)}
            />
          ))}
        </View>
        <View style={styles.pillRow}>
          <ChoicePill selected={inviteClassId === null} label="Whole school" onPress={() => onSelectInviteClass(null)} />
          {setup.classes.map((schoolClass) => (
            <ChoicePill
              key={schoolClass.id}
              selected={schoolClass.id === inviteClassId}
              label={schoolClass.name}
              onPress={() => onSelectInviteClass(schoolClass.id)}
            />
          ))}
        </View>
        <Field label="Max uses" value={values.inviteMaxUses} onChangeText={onChange.setInviteMaxUses} placeholder="Leave blank for no limit" keyboardType="number-pad" />
        <SubmitButton label="Create invite code" loading={saving === 'invite'} onPress={onCreateInvite} />
        <InviteList invites={setup.invites} classes={setup.classes} />
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<Users size={22} color={colors.coral} />} title="Join requests" />
        <JoinRequestList
          requests={setup.joinRequests}
          saving={saving}
          onReview={onReviewJoinRequest}
        />
      </View>
    </View>
  );
}

async function countRows(
  table: string,
  schoolId: string,
  schoolColumn: string,
  filters: Record<string, string> = {}
) {
  if (!supabase) {
    return { count: 0, error: 'School access is not available right now.' };
  }

  let query = (supabase as any).from(table).select('id', { count: 'exact', head: true }).eq(schoolColumn, schoolId);

  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

  const { count, error } = await query;

  return {
    count: count ?? 0,
    error: error?.message ?? null,
  };
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      {icon}
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8b9691"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function SubmitButton({
  label,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={loading || disabled}
      onPress={onPress}
      style={[styles.submitButton, (loading || disabled) && styles.disabledButton]}
    >
      {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>{label}</Text>}
    </Pressable>
  );
}

function ChoicePill({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choicePill, selected && styles.choicePillActive]}>
      <Text style={[styles.choicePillText, selected && styles.choicePillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SelectableRow({
  selected,
  title,
  meta,
  onPress,
}: {
  selected: boolean;
  title: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.recordRow, selected && styles.recordRowSelected]}>
      <View style={styles.flexText}>
        <Text style={styles.recordTitle}>{title}</Text>
        <Text style={styles.recordMeta}>{meta}</Text>
      </View>
      {selected ? <Text style={styles.selectedText}>Selected</Text> : null}
    </Pressable>
  );
}

function RecordList<T>({
  emptyText,
  items,
  renderItem,
}: {
  emptyText: string;
  items: T[];
  renderItem: (item: T) => ReactNode;
}) {
  if (!items.length) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return <View style={styles.recordList}>{items.map(renderItem)}</View>;
}

function SubjectList({ subjects }: { subjects: SubjectRow[] }) {
  return (
    <RecordList
      emptyText="No subjects yet."
      items={subjects}
      renderItem={(subject) => (
        <View key={subject.id} style={styles.recordRow}>
          <View style={styles.flexText}>
            <Text style={styles.recordTitle}>{subject.name}</Text>
            <Text style={styles.recordMeta}>{subject.department ?? 'No department'}</Text>
          </View>
        </View>
      )}
    />
  );
}

function ClassList({
  classes,
  terms,
  selectedClassId,
  onSelectClass,
}: {
  classes: ClassRow[];
  terms: AcademicTermRow[];
  selectedClassId: string | null;
  onSelectClass: (id: string) => void;
}) {
  return (
    <RecordList
      emptyText="No classes yet."
      items={classes}
      renderItem={(schoolClass) => {
        const term = terms.find((item) => item.id === schoolClass.academic_term_id);
        return (
          <SelectableRow
            key={schoolClass.id}
            selected={schoolClass.id === selectedClassId}
            title={schoolClass.name}
            meta={`${schoolClass.grade_level ?? 'Grade not set'}${term ? ` - ${term.name}` : ''}`}
            onPress={() => onSelectClass(schoolClass.id)}
          />
        );
      }}
    />
  );
}

function PickerRow<T extends { id: string }>({
  emptyText,
  items,
  selectedId,
  getLabel,
  onSelect,
}: {
  emptyText: string;
  items: T[];
  selectedId: string | null;
  getLabel: (item: T) => string;
  onSelect: (id: string) => void;
}) {
  if (!items.length) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.pillRow}>
      {items.map((item) => (
        <ChoicePill
          key={item.id}
          selected={item.id === selectedId}
          label={getLabel(item)}
          onPress={() => onSelect(item.id)}
        />
      ))}
    </View>
  );
}

function ClassSubjectList({
  classSubjects,
  classes,
  subjects,
  members,
  saving,
  onRemove,
}: {
  classSubjects: ClassSubjectRow[];
  classes: ClassRow[];
  subjects: SubjectRow[];
  members: SchoolMemberRow[];
  saving: string | null;
  onRemove: (classSubjectId: string) => void;
}) {
  return (
    <RecordList
      emptyText="No class subjects yet."
      items={classSubjects}
      renderItem={(classSubject) => {
        const schoolClass = classes.find((item) => item.id === classSubject.class_id);
        const subject = subjects.find((item) => item.id === classSubject.subject_id);
        const teacher = members.find((item) => item.id === classSubject.teacher_membership_id);

        return (
          <View key={classSubject.id} style={styles.recordRow}>
            <View style={styles.flexText}>
              <Text style={styles.recordTitle}>
                {schoolClass?.name ?? 'Class'} - {subject?.name ?? 'Subject'}
              </Text>
              <Text style={styles.recordMeta}>
                {teacher?.profiles?.full_name ? `Teacher: ${teacher.profiles.full_name}` : 'Teacher not assigned'}
              </Text>
            </View>
            <ActionButton
              label="Remove"
              tone="muted"
              loading={saving === `remove-subject-${classSubject.id}`}
              onPress={() => onRemove(classSubject.id)}
            />
          </View>
        );
      }}
    />
  );
}

function MemberList({
  members,
  classMemberships,
  classes,
  selectedMemberId,
  saving,
  onSelectMember,
  onRemoveClass,
  onUpdateStatus,
}: {
  members: SchoolMemberRow[];
  classMemberships: ClassMembershipRow[];
  classes: ClassRow[];
  selectedMemberId: string | null;
  saving: string | null;
  onSelectMember: (id: string) => void;
  onRemoveClass: (classMembershipId: string) => void;
  onUpdateStatus: (member: SchoolMemberRow, status: 'active' | 'suspended') => void;
}) {
  return (
    <RecordList
      emptyText="No members yet."
      items={members}
      renderItem={(member) => {
        const memberClasses = classMemberships.filter((item) => item.school_membership_id === member.id);

        return (
          <SelectableRowShell
            key={member.id}
            selected={member.id === selectedMemberId}
            onPress={() => onSelectMember(member.id)}
          >
            <View style={styles.flexText}>
              <Text style={styles.recordTitle}>{member.profiles?.full_name ?? 'School member'}</Text>
              <Text style={styles.recordMeta}>
                {formatRole(member.role)} - {formatRole(member.status)}
                {member.profiles?.preferred_language ? ` - ${member.profiles.preferred_language}` : ''}
              </Text>
              <View style={styles.memberClassWrap}>
                {memberClasses.length ? (
                  memberClasses.map((membership) => {
                    const schoolClass = classes.find((item) => item.id === membership.class_id);
                    return (
                      <Pressable
                        key={membership.id}
                        onPress={() => onRemoveClass(membership.id)}
                        style={styles.memberClassPill}
                      >
                        <Text style={styles.memberClassPillText}>{schoolClass?.name ?? 'Class'} x</Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.recordMeta}>No class assigned</Text>
                )}
              </View>
            </View>
            {member.role === 'owner' ? null : member.status === 'active' ? (
              <ActionButton
                label="Suspend"
                tone="danger"
                loading={saving === `suspended-member-${member.id}`}
                onPress={() => onUpdateStatus(member, 'suspended')}
              />
            ) : (
              <ActionButton
                label="Restore"
                tone="primary"
                loading={saving === `active-member-${member.id}`}
                onPress={() => onUpdateStatus(member, 'active')}
              />
            )}
          </SelectableRowShell>
        );
      }}
    />
  );
}

function JoinRequestList({
  requests,
  saving,
  onReview,
}: {
  requests: SchoolSetupState['joinRequests'];
  saving: string | null;
  onReview: (requestId: string, decision: 'approve' | 'decline') => void;
}) {
  const visibleRequests = requests.filter((request) => request.status === 'review');

  return (
    <RecordList
      emptyText="No pending requests."
      items={visibleRequests}
      renderItem={(request) => (
        <View key={request.id} style={styles.recordRow}>
          <View style={styles.flexText}>
            <Text style={styles.recordTitle}>{request.profiles?.full_name ?? 'New request'}</Text>
            <Text style={styles.recordMeta}>
              {formatRole(request.requested_role)} - {request.classes?.name ?? 'Whole school'}
            </Text>
            {request.message ? <Text style={styles.requestMessage}>{request.message}</Text> : null}
          </View>
          <View style={styles.actionRow}>
            <ActionButton
              label="Approve"
              tone="primary"
              loading={saving === `approve-request-${request.id}`}
              onPress={() => onReview(request.id, 'approve')}
            />
            <ActionButton
              label="Decline"
              tone="danger"
              loading={saving === `decline-request-${request.id}`}
              onPress={() => onReview(request.id, 'decline')}
            />
          </View>
        </View>
      )}
    />
  );
}

function SelectableRowShell({
  selected,
  onPress,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.recordRow, selected && styles.recordRowSelected]}>
      {children}
    </Pressable>
  );
}

function ActionButton({
  label,
  tone,
  loading,
  onPress,
}: {
  label: string;
  tone: 'primary' | 'danger' | 'muted';
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={[
        styles.actionButton,
        tone === 'primary' && styles.actionButtonPrimary,
        tone === 'danger' && styles.actionButtonDanger,
        tone === 'muted' && styles.actionButtonMuted,
        loading && styles.disabledButton,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone === 'muted' ? colors.tealDark : '#ffffff'} />
      ) : (
        <Text style={[styles.actionButtonText, tone === 'muted' && styles.actionButtonTextMuted]}>{label}</Text>
      )}
    </Pressable>
  );
}

function InviteList({ invites, classes }: { invites: InviteRow[]; classes: ClassRow[] }) {
  return (
    <RecordList
      emptyText="No invite codes yet."
      items={invites}
      renderItem={(invite) => {
        const schoolClass = classes.find((item) => item.id === invite.class_id);
        return (
          <View key={invite.id} style={styles.recordRow}>
            <View style={styles.flexText}>
              <Text style={styles.recordTitle}>{invite.code}</Text>
              <Text style={styles.recordMeta}>
                {formatRole(invite.role)} - {schoolClass?.name ?? 'Whole school'} - {invite.use_count}
                {invite.max_uses ? `/${invite.max_uses}` : ''} used
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        {icon}
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function formatRole(role: string) {
  return role
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 30,
    backgroundColor: colors.canvas,
  },
  shell: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    gap: 18,
  },
  topRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  signOutButton: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.softTeal,
  },
  signOutText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  heroPanel: {
    borderRadius: 24,
    padding: 20,
    gap: 12,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: '#e2dccd',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  heroBody: {
    color: '#33413b',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
  loadingCard: {
    minHeight: 120,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    minWidth: 150,
    flex: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  setupGrid: {
    gap: 16,
  },
  card: {
    borderRadius: 22,
    padding: 18,
    gap: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sectionTitleRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  cardBody: {
    color: '#33413b',
    fontSize: 14,
    lineHeight: 21,
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  field: {
    flex: 1,
    minWidth: 170,
    gap: 7,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.ink,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 15,
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.5,
  },
  recordList: {
    gap: 8,
  },
  recordRow: {
    minHeight: 48,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e1e9e3',
  },
  recordRowSelected: {
    borderColor: colors.teal,
    backgroundColor: colors.softTeal,
  },
  recordTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },
  recordMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  requestMessage: {
    color: '#33413b',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: colors.tealDark,
  },
  actionButtonDanger: {
    backgroundColor: colors.coral,
  },
  actionButtonMuted: {
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  actionButtonTextMuted: {
    color: colors.tealDark,
  },
  memberClassWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  memberClassPill: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ee',
  },
  memberClassPillText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  selectedText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  choicePillActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  choicePillText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  choicePillTextActive: {
    color: '#ffffff',
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  successText: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
});
