import { Redirect, router } from 'expo-router';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  DoorOpen,
  GraduationCap,
  ImagePlus,
  Link2,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react-native';

import { AppNavigation, AppNavItem } from '../../components/AppNavigation';
import { ImageUploadButton } from '../../components/ImageUploadButton';
import { fetchSchoolBilling, SchoolBillingState } from '../../services/billing';
import { useAppSession } from '../app/AppSessionProvider';
import { BootScreen } from '../app/BootScreen';
import {
  AcademicTermRow,
  AcademicYearRow,
  ClassMembershipRow,
  ClassRow,
  ClassSubjectRow,
  InviteRow,
  SchoolMemberRow,
  SchoolSetupState,
  SubjectRow,
  assignMemberToClass,
  createAcademicTerm,
  createAcademicYear,
  createClass,
  createClassSubject,
  createSchoolInvite,
  createSubject,
  fetchSchoolSetupState,
  removeClassSubject,
  removeMemberFromClass,
  reviewJoinRequest,
  updateClassUsername,
  updateSchoolDetails,
  updateSchoolMemberStatus,
} from '../../services/school';
import { colors } from '../../theme/tokens';
import { SchoolMembershipRole } from '../../types';

export type AdminSection = 'overview' | 'profile' | 'academic' | 'classes' | 'subjects' | 'people' | 'invites' | 'requests' | 'billing';

type CountState = {
  activeMembers: number;
  classes: number;
  subjects: number;
  activeInvites: number;
  pendingRequests: number;
  classSubjects: number;
};

type SchoolIdentityState = {
  name: string;
  username: string;
  country: string;
  city: string;
  logoUrl: string;
  bannerUrl: string;
  stickerKey: string;
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

const emptyBilling: SchoolBillingState = {
  subscription: null,
  payments: [],
};

const stickerPack = [
  { key: 'spark', label: 'Spark', accent: colors.gold },
  { key: 'orbit', label: 'Orbit', accent: colors.blue },
  { key: 'leaf', label: 'Leaf', accent: colors.teal },
  { key: 'coral', label: 'Coral', accent: colors.coral },
];

const adminRoutes: Record<AdminSection, string> = {
  overview: '/admin',
  profile: '/admin/profile',
  academic: '/admin/academic',
  classes: '/admin/classes',
  subjects: '/admin/subjects',
  people: '/admin/people',
  invites: '/admin/invites',
  requests: '/admin/requests',
  billing: '/admin/billing',
};

const inviteRoles: SchoolMembershipRole[] = ['student', 'teacher', 'admin'];

export function AdminConsoleRoute({ section }: { section: AdminSection }) {
  const { loading, activeMembership } = useAppSession();
  const [setup, setSetup] = useState<SchoolSetupState>(emptySetup);
  const [billing, setBilling] = useState<SchoolBillingState>(emptyBilling);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [schoolIdentity, setSchoolIdentity] = useState<SchoolIdentityState>({
    name: activeMembership?.school.name ?? '',
    username: activeMembership?.school.slug ?? '',
    country: activeMembership?.school.country ?? '',
    city: activeMembership?.school.city ?? '',
    logoUrl: activeMembership?.school.logoUrl ?? '',
    bannerUrl: activeMembership?.school.bannerUrl ?? '',
    stickerKey: activeMembership?.school.stickerKey ?? 'spark',
  });

  const [yearName, setYearName] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [termName, setTermName] = useState('');
  const [termStart, setTermStart] = useState('');
  const [termEnd, setTermEnd] = useState('');
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  const [subjectName, setSubjectName] = useState('');
  const [subjectDepartment, setSubjectDepartment] = useState('');

  const [className, setClassName] = useState('');
  const [classUsername, setClassUsername] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [classLogoUrl, setClassLogoUrl] = useState('');
  const [classBannerUrl, setClassBannerUrl] = useState('');
  const [classStickerKey, setClassStickerKey] = useState('orbit');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [classUsernameDrafts, setClassUsernameDrafts] = useState<Record<string, string>>({});

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberClassId, setSelectedMemberClassId] = useState<string | null>(null);

  const [inviteRole, setInviteRole] = useState<SchoolMembershipRole>('student');
  const [inviteClassId, setInviteClassId] = useState<string | null>(null);
  const [inviteMaxUses, setInviteMaxUses] = useState('');

  const canAdmin = activeMembership?.role === 'owner' || activeMembership?.role === 'admin';

  const counts = useMemo<CountState>(() => ({
    activeMembers: setup.members.filter((member) => member.status === 'active').length,
    classes: setup.classes.length,
    subjects: setup.subjects.length,
    activeInvites: setup.invites.filter((invite) => invite.status === 'active').length,
    pendingRequests: setup.joinRequests.filter((request) => request.status === 'review').length,
    classSubjects: setup.classSubjects.length,
  }), [setup]);

  const completionItems = useMemo(() => [
    { label: 'Profile', done: Boolean(schoolIdentity.name && schoolIdentity.username) },
    { label: 'Calendar', done: setup.academicYears.length > 0 && setup.academicTerms.length > 0 },
    { label: 'Subjects', done: setup.subjects.length > 0 },
    { label: 'Classes', done: setup.classes.length > 0 },
    { label: 'People', done: setup.members.filter((member) => member.status === 'active').length > 1 },
    { label: 'Invites', done: setup.invites.some((invite) => invite.status === 'active') },
  ], [schoolIdentity.name, schoolIdentity.username, setup]);

  const completionPercent = Math.round(
    (completionItems.filter((item) => item.done).length / completionItems.length) * 100
  );

  const selectedYear = setup.academicYears.find((year) => year.id === selectedYearId) ?? setup.academicYears[0] ?? null;
  const selectedTerm = setup.academicTerms.find((term) => term.id === selectedTermId) ?? setup.academicTerms[0] ?? null;
  const selectedMember = setup.members.find((member) => member.id === selectedMemberId) ?? null;
  const selectedClass = setup.classes.find((schoolClass) => schoolClass.id === selectedClassId) ?? setup.classes[0] ?? null;

  const loadAdmin = useCallback(async () => {
    if (!activeMembership) {
      return;
    }

    setError(null);
    const [nextSetup, nextBilling] = await Promise.all([
      fetchSchoolSetupState(activeMembership.schoolId, true),
      fetchSchoolBilling(activeMembership.schoolId),
    ]);
    setSetup(nextSetup);
    setBilling(nextBilling);
    setSelectedYearId((current) => current ?? nextSetup.academicYears[0]?.id ?? null);
    setSelectedTermId((current) => current ?? nextSetup.academicTerms[0]?.id ?? null);
    setSelectedClassId((current) => current ?? nextSetup.classes[0]?.id ?? null);
    setSelectedSubjectId((current) => current ?? nextSetup.subjects[0]?.id ?? null);
    setSelectedMemberId((current) => current ?? nextSetup.members[0]?.id ?? null);
    setSelectedMemberClassId((current) => current ?? nextSetup.classes[0]?.id ?? null);
    setSelectedTeacherId((current) => {
      const teacher = nextSetup.members.find((member) =>
        member.status === 'active' && ['owner', 'admin', 'teacher'].includes(member.role)
      );
      return current ?? teacher?.id ?? null;
    });
    setClassUsernameDrafts((current) => {
      const next = { ...current };
      nextSetup.classes.forEach((schoolClass) => {
        if (!(schoolClass.id in next)) {
          next[schoolClass.id] = schoolClass.username;
        }
      });
      return next;
    });
  }, [activeMembership]);

  useEffect(() => {
    if (!activeMembership) {
      setLoadingSetup(false);
      return;
    }

    setSchoolIdentity({
      name: activeMembership.school.name,
      username: activeMembership.school.slug ?? '',
      country: activeMembership.school.country ?? '',
      city: activeMembership.school.city ?? '',
      logoUrl: activeMembership.school.logoUrl ?? '',
      bannerUrl: activeMembership.school.bannerUrl ?? '',
      stickerKey: activeMembership.school.stickerKey ?? 'spark',
    });
  }, [activeMembership]);

  useEffect(() => {
    if (!activeMembership) {
      return;
    }

    setLoadingSetup(true);
    loadAdmin()
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load admin console.'))
      .finally(() => setLoadingSetup(false));
  }, [activeMembership, loadAdmin]);

  async function refresh() {
    setRefreshing(true);
    await loadAdmin().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not refresh admin console.'));
    setRefreshing(false);
  }

  async function save(action: string, work: () => Promise<void>, success: string) {
    setSaving(action);
    setError(null);
    setMessage(null);
    try {
      await work();
      setMessage(success);
      await loadAdmin();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save changes.');
    } finally {
      setSaving(null);
    }
  }

  if (loading || loadingSetup) {
    return <BootScreen text="Opening admin console" />;
  }

  if (!activeMembership) {
    return <Redirect href="/home" />;
  }

  if (!canAdmin) {
    return <Redirect href="/learn" />;
  }

  const navItems = adminNavItems(section, counts);

  return (
    <AppNavigation
      title={activeMembership.school.name}
      subtitle="Admin console"
      items={navItems}
      activeId={section}
      onSelect={(id) => router.push(adminRoutes[id as AdminSection] as never)}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.shell}>
          <AdminHero
            schoolName={schoolIdentity.name}
            username={schoolIdentity.username}
            section={section}
            completionPercent={completionPercent}
            counts={counts}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {message ? <Text style={styles.successText}>{message}</Text> : null}

          {section === 'overview' ? (
            <OverviewSection
              counts={counts}
              completionItems={completionItems}
              completionPercent={completionPercent}
              onOpen={(target) => router.push(adminRoutes[target] as never)}
            />
          ) : null}

          {section === 'profile' ? (
            <ProfileSection
              schoolId={activeMembership.schoolId}
              values={schoolIdentity}
              saving={saving === 'school-profile'}
              onChange={setSchoolIdentity}
              onSave={() =>
                save(
                  'school-profile',
                  async () => {
                    await updateSchoolDetails({
                      schoolId: activeMembership.schoolId,
                      ...schoolIdentity,
                    });
                  },
                  'School profile saved.'
                )
              }
              onError={setError}
            />
          ) : null}

          {section === 'academic' ? (
            <AcademicSection
              years={setup.academicYears}
              terms={setup.academicTerms}
              selectedYearId={selectedYear?.id ?? null}
              selectedTermId={selectedTerm?.id ?? null}
              yearName={yearName}
              yearStart={yearStart}
              yearEnd={yearEnd}
              termName={termName}
              termStart={termStart}
              termEnd={termEnd}
              saving={saving}
              onSelectYear={setSelectedYearId}
              onSelectTerm={setSelectedTermId}
              onYearName={setYearName}
              onYearStart={setYearStart}
              onYearEnd={setYearEnd}
              onTermName={setTermName}
              onTermStart={setTermStart}
              onTermEnd={setTermEnd}
              onCreateYear={() =>
                save(
                  'year',
                  async () => {
                    await createAcademicYear({
                      schoolId: activeMembership.schoolId,
                      name: yearName,
                      startsAt: yearStart,
                      endsAt: yearEnd,
                    });
                    setYearName('');
                    setYearStart('');
                    setYearEnd('');
                  },
                  'Academic year created.'
                )
              }
              onCreateTerm={() =>
                save(
                  'term',
                  async () => {
                    await createAcademicTerm({
                      schoolId: activeMembership.schoolId,
                      academicYearId: selectedYear?.id ?? '',
                      name: termName,
                      startsAt: termStart,
                      endsAt: termEnd,
                    });
                    setTermName('');
                    setTermStart('');
                    setTermEnd('');
                  },
                  'Term created.'
                )
              }
            />
          ) : null}

          {section === 'classes' ? (
            <ClassesSection
              schoolId={activeMembership.schoolId}
              classes={setup.classes}
              terms={setup.academicTerms}
              subjects={setup.subjects}
              members={setup.members}
              classSubjects={setup.classSubjects}
              selectedTermId={selectedTerm?.id ?? null}
              selectedClassId={selectedClass?.id ?? null}
              selectedSubjectId={selectedSubjectId}
              selectedTeacherId={selectedTeacherId}
              name={className}
              username={classUsername}
              gradeLevel={gradeLevel}
              logoUrl={classLogoUrl}
              bannerUrl={classBannerUrl}
              stickerKey={classStickerKey}
              usernameDrafts={classUsernameDrafts}
              saving={saving}
              onName={setClassName}
              onUsername={setClassUsername}
              onGradeLevel={setGradeLevel}
              onLogo={setClassLogoUrl}
              onBanner={setClassBannerUrl}
              onSticker={setClassStickerKey}
              onSelectClass={setSelectedClassId}
              onSelectSubject={setSelectedSubjectId}
              onSelectTeacher={setSelectedTeacherId}
              onUsernameDraft={(classId, username) => setClassUsernameDrafts((current) => ({ ...current, [classId]: username }))}
              onError={setError}
              onCreateClass={() =>
                save(
                  'class',
                  async () => {
                    await createClass({
                      schoolId: activeMembership.schoolId,
                      academicTermId: selectedTerm?.id ?? null,
                      name: className,
                      username: classUsername,
                      gradeLevel,
                      logoUrl: classLogoUrl,
                      bannerUrl: classBannerUrl,
                      stickerKey: classStickerKey,
                    });
                    setClassName('');
                    setClassUsername('');
                    setGradeLevel('');
                    setClassLogoUrl('');
                    setClassBannerUrl('');
                    setClassStickerKey('orbit');
                  },
                  'Class created.'
                )
              }
              onUpdateUsername={(classId, username) =>
                save(
                  `class-username-${classId}`,
                  async () => updateClassUsername({ classId, username }),
                  'Class username saved.'
                )
              }
              onCreateClassSubject={() =>
                save(
                  'class-subject',
                  async () => {
                    await createClassSubject({
                      classId: selectedClass?.id ?? '',
                      subjectId: selectedSubjectId ?? '',
                      teacherMembershipId: selectedTeacherId,
                    });
                  },
                  'Class subject added.'
                )
              }
              onRemoveClassSubject={(classSubjectId) =>
                save(
                  `remove-subject-${classSubjectId}`,
                  async () => removeClassSubject(classSubjectId),
                  'Class subject removed.'
                )
              }
            />
          ) : null}

          {section === 'subjects' ? (
            <SubjectsSection
              subjects={setup.subjects}
              name={subjectName}
              department={subjectDepartment}
              saving={saving === 'subject'}
              onName={setSubjectName}
              onDepartment={setSubjectDepartment}
              onCreate={() =>
                save(
                  'subject',
                  async () => {
                    await createSubject({
                      schoolId: activeMembership.schoolId,
                      name: subjectName,
                      department: subjectDepartment,
                    });
                    setSubjectName('');
                    setSubjectDepartment('');
                  },
                  'Subject created.'
                )
              }
            />
          ) : null}

          {section === 'people' ? (
            <PeopleSection
              members={setup.members}
              classes={setup.classes}
              classMemberships={setup.classMemberships}
              selectedMemberId={selectedMember?.id ?? null}
              selectedClassId={selectedMemberClassId}
              saving={saving}
              onSelectMember={setSelectedMemberId}
              onSelectClass={setSelectedMemberClassId}
              onAssign={() =>
                save(
                  'assign-member',
                  async () => {
                    await assignMemberToClass({
                      classId: selectedMemberClassId ?? '',
                      schoolMembershipId: selectedMember?.id ?? '',
                      role: selectedMember?.role ?? 'student',
                    });
                  },
                  'Class access updated.'
                )
              }
              onRemove={(classMembershipId) =>
                save(
                  `remove-member-${classMembershipId}`,
                  async () => removeMemberFromClass(classMembershipId),
                  'Class access removed.'
                )
              }
              onStatus={(member, status) =>
                save(
                  `${status}-member-${member.id}`,
                  async () => updateSchoolMemberStatus(member.id, status),
                  status === 'active' ? 'Member restored.' : 'Member suspended.'
                )
              }
            />
          ) : null}

          {section === 'invites' ? (
            <InvitesSection
              invites={setup.invites}
              classes={setup.classes}
              role={inviteRole}
              classId={inviteClassId}
              maxUses={inviteMaxUses}
              saving={saving === 'invite'}
              onRole={setInviteRole}
              onClass={setInviteClassId}
              onMaxUses={setInviteMaxUses}
              onCreate={() => {
                let createdCode = '';
                return save(
                  'invite',
                  async () => {
                    createdCode = await createSchoolInvite({
                      schoolId: activeMembership.schoolId,
                      classId: inviteClassId,
                      role: inviteRole,
                      maxUses: inviteMaxUses,
                    });
                    setInviteMaxUses('');
                  },
                  createdCode ? `Invite created: ${createdCode}` : 'Invite created.'
                );
              }}
            />
          ) : null}

          {section === 'requests' ? (
            <RequestsSection
              requests={setup.joinRequests}
              saving={saving}
              onReview={(requestId, decision) =>
                save(
                  `${decision}-request-${requestId}`,
                  async () => reviewJoinRequest(requestId, decision),
                  decision === 'approve' ? 'Request approved.' : 'Request declined.'
                )
              }
            />
          ) : null}

          {section === 'billing' ? (
            <BillingSection
              billing={billing}
              schoolStatus={activeMembership.school.subscriptionStatus ?? 'trial'}
              members={counts.activeMembers}
              classes={counts.classes}
            />
          ) : null}
        </View>
      </ScrollView>
    </AppNavigation>
  );
}

function adminNavItems(section: AdminSection, counts: CountState): AppNavItem[] {
  const color = (id: AdminSection) => (section === id ? colors.brandDeep : '#d8e0ef');

  return [
    { id: 'overview', label: 'Overview', description: 'School status', group: 'Admin', icon: <Sparkles size={19} color={color('overview')} /> },
    { id: 'profile', label: 'Profile', description: 'Identity', group: 'Admin', icon: <ShieldCheck size={19} color={color('profile')} /> },
    { id: 'academic', label: 'Academic', description: 'Years and terms', group: 'Setup', icon: <CalendarDays size={19} color={color('academic')} /> },
    { id: 'classes', label: 'Classes', description: `${counts.classes} classes`, group: 'Setup', icon: <BookOpen size={19} color={color('classes')} /> },
    { id: 'subjects', label: 'Subjects', description: `${counts.subjects} subjects`, group: 'Setup', icon: <GraduationCap size={19} color={color('subjects')} /> },
    { id: 'people', label: 'People', description: `${counts.activeMembers} active`, group: 'Access', icon: <Users size={19} color={color('people')} /> },
    { id: 'invites', label: 'Invites', description: `${counts.activeInvites} active`, group: 'Access', icon: <QrCode size={19} color={color('invites')} /> },
    { id: 'requests', label: 'Requests', description: `${counts.pendingRequests} waiting`, group: 'Access', icon: <UserPlus size={19} color={color('requests')} /> },
    { id: 'billing', label: 'Billing', description: 'Plan and payments', group: 'Operations', icon: <CreditCard size={19} color={color('billing')} /> },
  ];
}

function AdminHero({
  schoolName,
  username,
  section,
  completionPercent,
  counts,
}: {
  schoolName: string;
  username: string;
  section: AdminSection;
  completionPercent: number;
  counts: CountState;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroCopy}>
        <Text style={styles.eyebrow} numberOfLines={1}>Admin console</Text>
        <Text style={styles.heroTitle} numberOfLines={1}>{sectionTitle(section)}</Text>
        <Text style={styles.heroBody} numberOfLines={2}>
          {schoolName} {username ? `- ${username}` : ''} is {completionPercent}% ready for structured teaching.
        </Text>
      </View>
      <View style={styles.heroStats}>
        <MetricTile label="Members" value={counts.activeMembers} tone="teal" />
        <MetricTile label="Classes" value={counts.classes} tone="blue" />
        <MetricTile label="Requests" value={counts.pendingRequests} tone="coral" />
      </View>
    </View>
  );
}

function OverviewSection({
  counts,
  completionItems,
  completionPercent,
  onOpen,
}: {
  counts: CountState;
  completionItems: Array<{ label: string; done: boolean }>;
  completionPercent: number;
  onOpen: (section: AdminSection) => void;
}) {
  return (
    <View style={styles.grid}>
      <Panel wide>
        <PanelTitle icon={<Sparkles size={21} color={colors.gold} />} title="Launch progress" />
        <View style={styles.progressRow}>
          <View style={styles.progressCircle}>
            <Text style={styles.progressNumber}>{completionPercent}%</Text>
            <Text style={styles.progressLabel}>Ready</Text>
          </View>
          <View style={styles.checkGrid}>
            {completionItems.map((item) => (
              <View key={item.label} style={[styles.checkItem, item.done && styles.checkItemDone]}>
                <CheckCircle2 size={16} color={item.done ? '#ffffff' : colors.muted} />
                <Text style={[styles.checkText, item.done && styles.checkTextDone]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </Panel>

      <Panel>
        <PanelTitle icon={<DoorOpen size={21} color={colors.teal} />} title="Quick actions" />
        <ActionRail
          actions={[
            { label: 'School profile', icon: <ShieldCheck size={17} color="#ffffff" />, onPress: () => onOpen('profile') },
            { label: 'Add class', icon: <BookOpen size={17} color="#ffffff" />, onPress: () => onOpen('classes') },
            { label: 'Invite people', icon: <QrCode size={17} color="#ffffff" />, onPress: () => onOpen('invites') },
            { label: 'Billing', icon: <CreditCard size={17} color="#ffffff" />, onPress: () => onOpen('billing') },
          ]}
        />
      </Panel>

      <Panel>
        <PanelTitle icon={<ClipboardList size={21} color={colors.blue} />} title="Access watch" />
        <View style={styles.metricGrid}>
          <MetricTile label="Subjects" value={counts.subjects} tone="blue" />
          <MetricTile label="Class links" value={counts.classSubjects} tone="gold" />
          <MetricTile label="Invites" value={counts.activeInvites} tone="teal" />
        </View>
      </Panel>
    </View>
  );
}

function ProfileSection({
  schoolId,
  values,
  saving,
  onChange,
  onSave,
  onError,
}: {
  schoolId: string;
  values: SchoolIdentityState;
  saving: boolean;
  onChange: (values: SchoolIdentityState) => void;
  onSave: () => void;
  onError: (message: string) => void;
}) {
  return (
    <View style={styles.grid}>
      <Panel wide>
        <PanelTitle icon={<ImagePlus size={21} color={colors.teal} />} title="School identity" />
        <View style={styles.identityPreview}>
          <BannerStrip imageUrl={values.bannerUrl} stickerKey={values.stickerKey} />
          <View style={styles.identityBody}>
            <IdentityMark imageUrl={values.logoUrl} stickerKey={values.stickerKey} label={values.name || 'School'} />
            <View style={styles.flexText}>
              <Text style={styles.identityTitle}>{values.name || 'School name'}</Text>
              <Text style={styles.identityMeta}>{values.username || 'school-username'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.formGrid}>
          <Field label="School name" value={values.name} onChangeText={(name) => onChange({ ...values, name })} placeholder="BestCity Academy" />
          <Field label="Username" value={values.username} onChangeText={(username) => onChange({ ...values, username })} placeholder="bestcity-academy" autoCapitalize="none" />
          <Field label="Country" value={values.country} onChangeText={(country) => onChange({ ...values, country })} placeholder="Nigeria" />
          <Field label="City" value={values.city} onChangeText={(city) => onChange({ ...values, city })} placeholder="Lagos" />
        </View>
        <View style={styles.actionRow}>
          <ImageUploadButton label={values.logoUrl ? 'Replace logo' : 'Upload logo'} pathPrefix={`schools/${schoolId}/logo`} onUploaded={(logoUrl) => onChange({ ...values, logoUrl })} onError={onError} />
          <ImageUploadButton label={values.bannerUrl ? 'Replace banner' : 'Upload banner'} pathPrefix={`schools/${schoolId}/banner`} onUploaded={(bannerUrl) => onChange({ ...values, bannerUrl })} onError={onError} />
        </View>
        <StickerPicker selectedKey={values.stickerKey} onSelect={(stickerKey) => onChange({ ...values, stickerKey })} />
        <PrimaryButton label="Save profile" loading={saving} onPress={onSave} />
      </Panel>
    </View>
  );
}

function AcademicSection(props: {
  years: AcademicYearRow[];
  terms: AcademicTermRow[];
  selectedYearId: string | null;
  selectedTermId: string | null;
  yearName: string;
  yearStart: string;
  yearEnd: string;
  termName: string;
  termStart: string;
  termEnd: string;
  saving: string | null;
  onSelectYear: (id: string) => void;
  onSelectTerm: (id: string) => void;
  onYearName: (value: string) => void;
  onYearStart: (value: string) => void;
  onYearEnd: (value: string) => void;
  onTermName: (value: string) => void;
  onTermStart: (value: string) => void;
  onTermEnd: (value: string) => void;
  onCreateYear: () => void;
  onCreateTerm: () => void;
}) {
  return (
    <View style={styles.grid}>
      <Panel>
        <PanelTitle icon={<CalendarDays size={21} color={colors.teal} />} title="Academic year" />
        <Field label="Name" value={props.yearName} onChangeText={props.onYearName} placeholder="2026 Academic Year" />
        <View style={styles.formGrid}>
          <Field label="Starts" value={props.yearStart} onChangeText={props.onYearStart} placeholder="2026-01-12" />
          <Field label="Ends" value={props.yearEnd} onChangeText={props.onYearEnd} placeholder="2026-12-11" />
        </View>
        <PrimaryButton label="Add year" loading={props.saving === 'year'} onPress={props.onCreateYear} />
      </Panel>
      <Panel>
        <PanelTitle icon={<ClipboardList size={21} color={colors.blue} />} title="Term" />
        <Field label="Name" value={props.termName} onChangeText={props.onTermName} placeholder="First Term" />
        <View style={styles.formGrid}>
          <Field label="Starts" value={props.termStart} onChangeText={props.onTermStart} placeholder="2026-01-12" />
          <Field label="Ends" value={props.termEnd} onChangeText={props.onTermEnd} placeholder="2026-04-03" />
        </View>
        <PrimaryButton label="Add term" loading={props.saving === 'term'} disabled={!props.selectedYearId} onPress={props.onCreateTerm} />
      </Panel>
      <Panel wide>
        <PanelTitle icon={<CalendarDays size={21} color={colors.gold} />} title="Calendar records" />
        <View style={styles.recordGrid}>
          {props.years.map((year) => (
            <SelectableRecord key={year.id} selected={year.id === props.selectedYearId} title={year.name} meta={`${year.starts_at} to ${year.ends_at}`} onPress={() => props.onSelectYear(year.id)} />
          ))}
          {props.terms.map((term) => (
            <SelectableRecord key={term.id} selected={term.id === props.selectedTermId} title={term.name} meta={`${term.starts_at} to ${term.ends_at}`} onPress={() => props.onSelectTerm(term.id)} />
          ))}
        </View>
      </Panel>
    </View>
  );
}

function ClassesSection(props: {
  schoolId: string;
  classes: ClassRow[];
  terms: AcademicTermRow[];
  subjects: SubjectRow[];
  members: SchoolMemberRow[];
  classSubjects: ClassSubjectRow[];
  selectedTermId: string | null;
  selectedClassId: string | null;
  selectedSubjectId: string | null;
  selectedTeacherId: string | null;
  name: string;
  username: string;
  gradeLevel: string;
  logoUrl: string;
  bannerUrl: string;
  stickerKey: string;
  usernameDrafts: Record<string, string>;
  saving: string | null;
  onName: (value: string) => void;
  onUsername: (value: string) => void;
  onGradeLevel: (value: string) => void;
  onLogo: (value: string) => void;
  onBanner: (value: string) => void;
  onSticker: (value: string) => void;
  onSelectClass: (id: string) => void;
  onSelectSubject: (id: string) => void;
  onSelectTeacher: (id: string | null) => void;
  onUsernameDraft: (classId: string, username: string) => void;
  onError: (message: string) => void;
  onCreateClass: () => void;
  onUpdateUsername: (classId: string, username: string) => void;
  onCreateClassSubject: () => void;
  onRemoveClassSubject: (classSubjectId: string) => void;
}) {
  const selectedClass = props.classes.find((item) => item.id === props.selectedClassId) ?? props.classes[0] ?? null;
  const teacherOptions = props.members.filter((member) => member.status === 'active' && ['owner', 'admin', 'teacher'].includes(member.role));

  return (
    <View style={styles.grid}>
      <Panel>
        <PanelTitle icon={<BookOpen size={21} color={colors.blue} />} title="Create class" />
        <Field label="Class name" value={props.name} onChangeText={props.onName} placeholder="JSS 2 Blue" />
        <Field label="Username" value={props.username} onChangeText={props.onUsername} placeholder="jss-2-blue" autoCapitalize="none" />
        <Field label="Grade level" value={props.gradeLevel} onChangeText={props.onGradeLevel} placeholder="Junior secondary" />
        <View style={styles.actionRow}>
          <ImageUploadButton label={props.logoUrl ? 'Replace logo' : 'Class logo'} pathPrefix={`schools/${props.schoolId}/class-logo`} onUploaded={props.onLogo} onError={props.onError} />
          <ImageUploadButton label={props.bannerUrl ? 'Replace banner' : 'Class banner'} pathPrefix={`schools/${props.schoolId}/class-banner`} onUploaded={props.onBanner} onError={props.onError} />
        </View>
        <StickerPicker selectedKey={props.stickerKey} onSelect={props.onSticker} />
        <PrimaryButton label="Create class" loading={props.saving === 'class'} onPress={props.onCreateClass} />
      </Panel>

      <Panel wide>
        <PanelTitle icon={<DoorOpen size={21} color={colors.teal} />} title="Class directory" />
        <View style={styles.classGrid}>
          {props.classes.map((schoolClass) => {
            const term = props.terms.find((item) => item.id === schoolClass.academic_term_id);
            return (
              <Pressable key={schoolClass.id} onPress={() => props.onSelectClass(schoolClass.id)} style={[styles.classCard, schoolClass.id === props.selectedClassId && styles.classCardActive]}>
                <View style={styles.classCardTop}>
                  <IdentityMark imageUrl={schoolClass.logo_url} stickerKey={schoolClass.sticker_key} label={schoolClass.name} />
                  <View style={styles.flexText}>
                    <Text style={styles.recordTitle}>{schoolClass.name}</Text>
                    <Text style={styles.recordMeta}>{schoolClass.grade_level ?? 'Grade not set'}{term ? ` - ${term.name}` : ''}</Text>
                  </View>
                </View>
                <View style={styles.inlineRow}>
                  <Field compact label="Username" value={props.usernameDrafts[schoolClass.id] ?? schoolClass.username} onChangeText={(value) => props.onUsernameDraft(schoolClass.id, value)} placeholder="class-username" autoCapitalize="none" />
                  <SmallButton label="Save" loading={props.saving === `class-username-${schoolClass.id}`} onPress={() => props.onUpdateUsername(schoolClass.id, props.usernameDrafts[schoolClass.id] ?? schoolClass.username)} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </Panel>

      <Panel wide>
        <PanelTitle icon={<Link2 size={21} color={colors.gold} />} title="Subject and teacher links" />
        <ChipRow items={props.classes} selectedId={selectedClass?.id ?? null} getLabel={(item) => item.name} onSelect={props.onSelectClass} emptyText="Create a class first." />
        <ChipRow items={props.subjects} selectedId={props.selectedSubjectId} getLabel={(item) => item.name} onSelect={props.onSelectSubject} emptyText="Create a subject first." />
        <ChipRow items={teacherOptions} selectedId={props.selectedTeacherId} getLabel={(item) => item.profiles?.full_name ?? formatRole(item.role)} onSelect={props.onSelectTeacher} emptyText="Add a teacher first." />
        <PrimaryButton label="Attach subject" loading={props.saving === 'class-subject'} disabled={!selectedClass || !props.selectedSubjectId} onPress={props.onCreateClassSubject} />
        <View style={styles.recordGrid}>
          {props.classSubjects.map((classSubject) => {
            const schoolClass = props.classes.find((item) => item.id === classSubject.class_id);
            const subject = props.subjects.find((item) => item.id === classSubject.subject_id);
            const teacher = props.members.find((item) => item.id === classSubject.teacher_membership_id);
            return (
              <View key={classSubject.id} style={styles.recordCard}>
                <View style={styles.flexText}>
                  <Text style={styles.recordTitle}>{schoolClass?.name ?? 'Class'} - {subject?.name ?? 'Subject'}</Text>
                  <Text style={styles.recordMeta}>{teacher?.profiles?.full_name ?? 'Teacher not assigned'}</Text>
                </View>
                <SmallButton label="Remove" loading={props.saving === `remove-subject-${classSubject.id}`} onPress={() => props.onRemoveClassSubject(classSubject.id)} />
              </View>
            );
          })}
        </View>
      </Panel>
    </View>
  );
}

function SubjectsSection({
  subjects,
  name,
  department,
  saving,
  onName,
  onDepartment,
  onCreate,
}: {
  subjects: SubjectRow[];
  name: string;
  department: string;
  saving: boolean;
  onName: (value: string) => void;
  onDepartment: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <View style={styles.grid}>
      <Panel>
        <PanelTitle icon={<GraduationCap size={21} color={colors.gold} />} title="Create subject" />
        <Field label="Subject" value={name} onChangeText={onName} placeholder="Basic Science" />
        <Field label="Department" value={department} onChangeText={onDepartment} placeholder="Science" />
        <PrimaryButton label="Create subject" loading={saving} onPress={onCreate} />
      </Panel>
      <Panel wide>
        <PanelTitle icon={<ClipboardList size={21} color={colors.blue} />} title="Subject directory" />
        <View style={styles.recordGrid}>
          {subjects.map((subject) => (
            <View key={subject.id} style={styles.recordCard}>
              <View style={styles.recordIcon}>
                <GraduationCap size={18} color={colors.brandDeep} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.recordTitle}>{subject.name}</Text>
                <Text style={styles.recordMeta}>{subject.department ?? 'No department'}</Text>
              </View>
            </View>
          ))}
        </View>
      </Panel>
    </View>
  );
}

function PeopleSection(props: {
  members: SchoolMemberRow[];
  classes: ClassRow[];
  classMemberships: ClassMembershipRow[];
  selectedMemberId: string | null;
  selectedClassId: string | null;
  saving: string | null;
  onSelectMember: (id: string) => void;
  onSelectClass: (id: string) => void;
  onAssign: () => void;
  onRemove: (classMembershipId: string) => void;
  onStatus: (member: SchoolMemberRow, status: 'active' | 'suspended') => void;
}) {
  return (
    <View style={styles.grid}>
      <Panel wide>
        <PanelTitle icon={<Users size={21} color={colors.teal} />} title="Members" />
        <View style={styles.recordGrid}>
          {props.members.map((member) => {
            const memberClasses = props.classMemberships.filter((item) => item.school_membership_id === member.id);
            return (
              <Pressable key={member.id} onPress={() => props.onSelectMember(member.id)} style={[styles.memberCard, member.id === props.selectedMemberId && styles.memberCardActive]}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitials}>{initials(member.profiles?.full_name ?? member.role)}</Text>
                </View>
                <View style={styles.flexText}>
                  <Text style={styles.recordTitle}>{member.profiles?.full_name ?? 'School member'}</Text>
                  <Text style={styles.recordMeta}>{formatRole(member.role)} - {formatRole(member.status)}</Text>
                  <View style={styles.chipWrap}>
                    {memberClasses.length ? memberClasses.map((membership) => {
                      const schoolClass = props.classes.find((item) => item.id === membership.class_id);
                      return (
                        <Pressable key={membership.id} onPress={() => props.onRemove(membership.id)} style={styles.softChip}>
                          <Text style={styles.softChipText}>{schoolClass?.name ?? 'Class'} x</Text>
                        </Pressable>
                      );
                    }) : <Text style={styles.recordMeta}>No class assigned</Text>}
                  </View>
                </View>
                {member.role !== 'owner' ? (
                  <SmallButton
                    label={member.status === 'active' ? 'Suspend' : 'Restore'}
                    loading={props.saving === `${member.status === 'active' ? 'suspended' : 'active'}-member-${member.id}`}
                    onPress={() => props.onStatus(member, member.status === 'active' ? 'suspended' : 'active')}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Panel>
      <Panel>
        <PanelTitle icon={<UserPlus size={21} color={colors.blue} />} title="Class access" />
        <ChipRow items={props.classes} selectedId={props.selectedClassId} getLabel={(item) => item.name} onSelect={props.onSelectClass} emptyText="Create a class first." />
        <PrimaryButton label="Add selected member" loading={props.saving === 'assign-member'} disabled={!props.selectedMemberId || !props.selectedClassId} onPress={props.onAssign} />
      </Panel>
    </View>
  );
}

function InvitesSection(props: {
  invites: InviteRow[];
  classes: ClassRow[];
  role: SchoolMembershipRole;
  classId: string | null;
  maxUses: string;
  saving: boolean;
  onRole: (role: SchoolMembershipRole) => void;
  onClass: (classId: string | null) => void;
  onMaxUses: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <View style={styles.grid}>
      <Panel>
        <PanelTitle icon={<QrCode size={21} color={colors.teal} />} title="Create invite" />
        <SegmentedRole value={props.role} onChange={props.onRole} />
        <ChipRow items={props.classes} selectedId={props.classId} getLabel={(item) => item.name} onSelect={props.onClass} emptyText="Class-specific invites can be added after classes exist." includeNoneLabel="Whole school" />
        <Field label="Max uses" value={props.maxUses} onChangeText={props.onMaxUses} placeholder="Leave blank" keyboardType="number-pad" />
        <PrimaryButton label="Create invite" loading={props.saving} onPress={props.onCreate} />
      </Panel>
      <Panel wide>
        <PanelTitle icon={<QrCode size={21} color={colors.gold} />} title="Invite directory" />
        <View style={styles.recordGrid}>
          {props.invites.map((invite) => {
            const schoolClass = props.classes.find((item) => item.id === invite.class_id);
            return (
              <View key={invite.id} style={styles.inviteCard}>
                <Text style={styles.inviteCode}>{invite.code}</Text>
                <Text style={styles.recordMeta}>{formatRole(invite.role)} - {schoolClass?.name ?? 'Whole school'} - {invite.use_count}{invite.max_uses ? `/${invite.max_uses}` : ''} used</Text>
              </View>
            );
          })}
        </View>
      </Panel>
    </View>
  );
}

function RequestsSection({
  requests,
  saving,
  onReview,
}: {
  requests: SchoolSetupState['joinRequests'];
  saving: string | null;
  onReview: (requestId: string, decision: 'approve' | 'decline') => void;
}) {
  const pending = requests.filter((request) => request.status === 'review');

  return (
    <View style={styles.grid}>
      <Panel wide>
        <PanelTitle icon={<UserPlus size={21} color={colors.coral} />} title="Access requests" />
        <View style={styles.recordGrid}>
          {pending.length ? pending.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <View style={styles.flexText}>
                <Text style={styles.recordTitle}>{request.profiles?.full_name ?? 'New request'}</Text>
                <Text style={styles.recordMeta}>{formatRole(request.requested_role)} - {request.classes?.name ?? 'Whole school'}</Text>
                {request.message ? <Text style={styles.requestMessage}>{request.message}</Text> : null}
              </View>
              <View style={styles.actionRow}>
                <SmallButton label="Approve" loading={saving === `approve-request-${request.id}`} onPress={() => onReview(request.id, 'approve')} />
                <SmallButton label="Decline" loading={saving === `decline-request-${request.id}`} onPress={() => onReview(request.id, 'decline')} />
              </View>
            </View>
          )) : <Text style={styles.emptyText}>No pending requests.</Text>}
        </View>
      </Panel>
    </View>
  );
}

function BillingSection({
  billing,
  schoolStatus,
  members,
  classes,
}: {
  billing: SchoolBillingState;
  schoolStatus: string;
  members: number;
  classes: number;
}) {
  const subscription = billing.subscription;
  const planName = subscription?.plan_name ?? 'Trial School';
  const status = subscription?.status ?? schoolStatus;
  const monthly = formatMoney(subscription?.monthly_usd ?? 0);
  const confirmedTotal = billing.payments
    .filter((payment) => payment.status === 'confirmed')
    .reduce((sum, payment) => sum + Number(payment.amount_usd || 0), 0);

  return (
    <View style={styles.grid}>
      <Panel wide>
        <PanelTitle icon={<CreditCard size={21} color={colors.teal} />} title="School plan" />
        <View style={styles.billingHero}>
          <View style={styles.flexText}>
            <Text style={styles.billingPlan}>{planName}</Text>
            <Text style={styles.billingMeta}>{formatRole(status)} - {monthly}/month</Text>
          </View>
          <View style={styles.billingBadge}>
            <Text style={styles.billingBadgeText}>{formatRole(status)}</Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <MetricTile label="Members" value={members} tone="teal" />
          <MetricTile label="Classes" value={classes} tone="blue" />
          <MetricTile label="Paid USD" value={Math.round(confirmedTotal)} tone="gold" />
        </View>

        <View style={styles.billingPeriod}>
          <Text style={styles.recordTitle}>Current period</Text>
          <Text style={styles.recordMeta}>
            {formatDate(subscription?.current_period_start)} - {formatDate(subscription?.current_period_end)}
          </Text>
        </View>
      </Panel>

      <Panel>
        <PanelTitle icon={<Wallet size={21} color={colors.gold} />} title="Plan ladder" />
        <View style={styles.recordGrid}>
          <PlanCard name="Pilot School" price="$0" detail="Trial access for early school setup." active={planName.toLowerCase().includes('pilot')} />
          <PlanCard name="Growth School" price="$49" detail="Live lessons, AI packs, quiz tracking, and crews." active={planName.toLowerCase().includes('growth')} />
          <PlanCard name="Network" price="Custom" detail="Multi-school controls, support, audit, and payment routing." active={planName.toLowerCase().includes('network')} />
        </View>
      </Panel>

      <Panel wide>
        <PanelTitle icon={<Receipt size={21} color={colors.blue} />} title="Payment history" />
        <View style={styles.recordGrid}>
          {billing.payments.length ? billing.payments.map((payment) => (
            <View key={payment.id} style={styles.paymentCard}>
              <View style={styles.flexText}>
                <Text style={styles.recordTitle}>{formatMoney(payment.amount_usd)} - {formatChain(payment.chain)}</Text>
                <Text style={styles.recordMeta}>{formatRole(payment.status)} - {formatDate(payment.paid_at ?? payment.created_at)}</Text>
                <Text style={styles.paymentHash} numberOfLines={1}>{payment.tx_hash}</Text>
              </View>
              <View style={[styles.paymentStatus, payment.status === 'confirmed' && styles.paymentStatusConfirmed]}>
                <Text style={[styles.paymentStatusText, payment.status === 'confirmed' && styles.paymentStatusTextConfirmed]}>
                  {formatRole(payment.status)}
                </Text>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>No payment records yet.</Text>}
        </View>
      </Panel>
    </View>
  );
}

function PlanCard({
  name,
  price,
  detail,
  active,
}: {
  name: string;
  price: string;
  detail: string;
  active: boolean;
}) {
  return (
    <View style={[styles.planCard, active && styles.planCardActive]}>
      <View style={styles.flexText}>
        <Text style={styles.recordTitle}>{name}</Text>
        <Text style={styles.recordMeta}>{detail}</Text>
      </View>
      <Text style={styles.planPrice}>{price}</Text>
    </View>
  );
}

function Panel({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <View style={[styles.panel, wide && styles.panelWide]}>{children}</View>;
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <View style={styles.panelTitleRow}>
      <View style={styles.panelTitleIcon}>{icon}</View>
      <Text style={styles.panelTitle} numberOfLines={1}>{title}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  compact,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  compact?: boolean;
}) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={styles.fieldLabel} numberOfLines={1}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#87938e"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[styles.input, compact && styles.inputCompact]}
      />
    </View>
  );
}

function PrimaryButton({ label, loading, disabled, onPress }: { label: string; loading: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={loading || disabled} onPress={onPress} style={[styles.primaryButton, (loading || disabled) && styles.disabledButton]}>
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <>
          <Text style={styles.primaryButtonText} numberOfLines={1}>{label}</Text>
          <View style={styles.primaryButtonIcon}>
            <ArrowRight size={15} color="#ffffff" />
          </View>
        </>
      )}
    </Pressable>
  );
}

function SmallButton({ label, loading, onPress }: { label: string; loading: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={loading} onPress={onPress} style={[styles.smallButton, loading && styles.disabledButton]}>
      {loading ? <ActivityIndicator color={colors.brandDeep} /> : <Text style={styles.smallButtonText} numberOfLines={1}>{label}</Text>}
    </Pressable>
  );
}

function ActionRail({ actions }: { actions: Array<{ label: string; icon: ReactNode; onPress: () => void }> }) {
  return (
    <View style={styles.actionRail}>
      {actions.map((action) => (
        <Pressable key={action.label} onPress={action.onPress} style={styles.railButton}>
          <View style={styles.railIcon}>{action.icon}</View>
          <Text style={styles.railButtonText} numberOfLines={1}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: number; tone: 'teal' | 'blue' | 'gold' | 'coral' }) {
  const toneColor = tone === 'teal' ? colors.teal : tone === 'blue' ? colors.blue : tone === 'gold' ? colors.gold : colors.coral;
  return (
    <View style={styles.metricTile}>
      <View style={[styles.metricDot, { backgroundColor: toneColor }]} />
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function SelectableRecord({ selected, title, meta, onPress }: { selected: boolean; title: string; meta: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.recordCard, selected && styles.recordCardSelected]}>
      <View style={styles.flexText}>
        <Text style={styles.recordTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.recordMeta} numberOfLines={1}>{meta}</Text>
      </View>
      {selected ? <Text style={styles.selectedText} numberOfLines={1}>Selected</Text> : null}
    </Pressable>
  );
}

function ChipRow<T extends { id: string }>({
  items,
  selectedId,
  getLabel,
  onSelect,
  emptyText,
  includeNoneLabel,
}: {
  items: T[];
  selectedId: string | null;
  getLabel: (item: T) => string;
  onSelect: (id: string) => void;
  emptyText: string;
  includeNoneLabel?: string;
}) {
  if (!items.length && !includeNoneLabel) {
    return <Text style={styles.emptyText} numberOfLines={2}>{emptyText}</Text>;
  }

  return (
    <View style={styles.chipWrap}>
      {includeNoneLabel ? <Pressable onPress={() => (onSelect as (id: string | null) => void)(null)} style={[styles.choiceChip, selectedId === null && styles.choiceChipActive]}><Text style={[styles.choiceChipText, selectedId === null && styles.choiceChipTextActive]} numberOfLines={1}>{includeNoneLabel}</Text></Pressable> : null}
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => onSelect(item.id)} style={[styles.choiceChip, item.id === selectedId && styles.choiceChipActive]}>
          <Text style={[styles.choiceChipText, item.id === selectedId && styles.choiceChipTextActive]} numberOfLines={1}>{getLabel(item)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SegmentedRole({ value, onChange }: { value: SchoolMembershipRole; onChange: (role: SchoolMembershipRole) => void }) {
  return (
    <View style={styles.segmented}>
      {inviteRoles.map((role) => (
        <Pressable key={role} onPress={() => onChange(role)} style={[styles.segment, value === role && styles.segmentActive]}>
          <Text style={[styles.segmentText, value === role && styles.segmentTextActive]} numberOfLines={1}>{formatRole(role)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function StickerPicker({ selectedKey, onSelect }: { selectedKey: string; onSelect: (key: string) => void }) {
  return (
    <View style={styles.chipWrap}>
      {stickerPack.map((sticker) => (
        <Pressable key={sticker.key} onPress={() => onSelect(sticker.key)} style={[styles.stickerChoice, selectedKey === sticker.key && styles.stickerChoiceActive, { borderColor: selectedKey === sticker.key ? sticker.accent : colors.line }]}>
          <View style={[styles.stickerSwatch, { backgroundColor: sticker.accent }]} />
          <Text style={styles.stickerText} numberOfLines={1}>{sticker.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function IdentityMark({ imageUrl, stickerKey, label }: { imageUrl?: string | null; stickerKey?: string | null; label: string }) {
  const sticker = stickerPack.find((item) => item.key === stickerKey) ?? stickerPack[0];
  return (
    <View style={[styles.identityMark, { backgroundColor: sticker.accent }]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.identityImage} /> : <Text style={styles.identityInitials}>{initials(label)}</Text>}
    </View>
  );
}

function BannerStrip({ imageUrl, stickerKey }: { imageUrl?: string | null; stickerKey?: string | null }) {
  const sticker = stickerPack.find((item) => item.key === stickerKey) ?? stickerPack[0];
  return (
    <View style={[styles.banner, { backgroundColor: sticker.accent }]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.bannerImage} /> : null}
    </View>
  );
}

function sectionTitle(section: AdminSection) {
  const labels: Record<AdminSection, string> = {
    overview: 'School command center',
    profile: 'School profile',
    academic: 'Academic calendar',
    classes: 'Classes and teaching',
    subjects: 'Subjects',
    people: 'People and access',
    invites: 'Invite codes',
    requests: 'Join requests',
    billing: 'Billing and plans',
  };
  return labels[section];
}

function formatMoney(value: number | string) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return '$0';
  }

  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Not set';
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatChain(value: string) {
  const labels: Record<string, string> = {
    solana: 'Solana',
    base: 'Base',
    bnb: 'BNB',
  };

  return labels[value] ?? formatRole(value);
}

function formatRole(value: string) {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CH';
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 106,
    backgroundColor: colors.canvas,
  },
  shell: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    gap: 14,
  },
  hero: {
    minHeight: 150,
    borderRadius: 8,
    padding: 18,
    gap: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  heroCopy: {
    flex: 1.4,
    minWidth: 280,
    gap: 8,
  },
  eyebrow: {
    color: colors.brandGlow,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 31,
    lineHeight: 38,
    fontWeight: '900',
  },
  heroBody: {
    color: '#d8e0ef',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  heroStats: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  panel: {
    minWidth: 260,
    flex: 1,
    borderRadius: 8,
    padding: 16,
    gap: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderTopWidth: 4,
    borderColor: '#dfe6f0',
    shadowColor: '#111318',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  panelWide: {
    flex: 2,
    minWidth: 280,
  },
  panelTitleRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panelTitleIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  progressRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  progressCircle: {
    width: 103,
    height: 98,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandDeep,
  },
  progressNumber: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  progressLabel: {
    color: '#d8e0ef',
    fontSize: 12,
    fontWeight: '700',
  },
  checkGrid: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkItem: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  checkItemDone: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandDeep,
  },
  checkText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  checkTextDone: {
    color: '#ffffff',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricTile: {
    minWidth: 110,
    flex: 1,
    borderRadius: 8,
    padding: 14,
    gap: 7,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderBottomWidth: 4,
    borderColor: '#e5ebf5',
  },
  metricDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  actionRail: {
    gap: 10,
  },
  railButton: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.brand,
  },
  railIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  railButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  identityPreview: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  identityBody: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  identityTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  identityMeta: {
    color: colors.brand,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  banner: {
    height: 82,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  identityMark: {
    overflow: 'hidden',
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityImage: {
    width: '100%',
    height: '100%',
  },
  identityInitials: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  field: {
    flex: 1,
    minWidth: 190,
    gap: 7,
  },
  fieldCompact: {
    minWidth: 120,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 13,
    color: colors.ink,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dfe6f0',
    fontSize: 14,
    fontWeight: '700',
  },
  inputCompact: {
    minHeight: 40,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButtonIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  smallButton: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  smallButtonText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  stickerChoice: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ffffff',
    borderWidth: 2,
  },
  stickerChoiceActive: {
    backgroundColor: colors.softGold,
  },
  stickerSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  stickerText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  classCard: {
    minWidth: 280,
    flex: 1,
    borderRadius: 8,
    padding: 14,
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderBottomWidth: 4,
    borderColor: '#e5ebf5',
  },
  classCardActive: {
    backgroundColor: colors.softBlue,
    borderColor: colors.brand,
  },
  classCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordGrid: {
    gap: 10,
  },
  recordCard: {
    minHeight: 50,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  recordCardSelected: {
    backgroundColor: colors.softBlue,
    borderColor: colors.brand,
  },
  recordIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  recordTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  recordMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  selectedText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  memberCard: {
    minHeight: 59,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  memberCardActive: {
    backgroundColor: colors.softBlue,
    borderColor: colors.brand,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandDeep,
  },
  memberInitials: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  softChip: {
    minHeight: 28,
    borderRadius: 8,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  softChipText: {
    color: colors.brandDeep,
    fontSize: 11,
    fontWeight: '700',
  },
  choiceChip: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  choiceChipActive: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandDeep,
  },
  choiceChipText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  choiceChipTextActive: {
    color: '#ffffff',
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    padding: 5,
    borderRadius: 8,
    backgroundColor: '#eef3fb',
    borderWidth: 1,
    borderColor: '#d9e1ee',
  },
  segment: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.brandDeep,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  inviteCard: {
    minHeight: 59,
    borderRadius: 8,
    padding: 14,
    gap: 4,
    backgroundColor: colors.brandDeep,
  },
  inviteCode: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  billingHero: {
    minHeight: 77,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.brandDeep,
  },
  billingPlan: {
    color: '#ffffff',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
  },
  billingMeta: {
    color: '#d8e0ef',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  billingBadge: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  billingBadgeText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  billingPeriod: {
    minHeight: 52,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  planCard: {
    minHeight: 58,
    borderRadius: 8,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  planCardActive: {
    backgroundColor: colors.softBlue,
    borderColor: colors.brand,
  },
  planPrice: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '700',
  },
  paymentCard: {
    minHeight: 61,
    borderRadius: 8,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  paymentHash: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  paymentStatus: {
    minHeight: 30,
    borderRadius: 8,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softGold,
  },
  paymentStatusConfirmed: {
    backgroundColor: colors.brandDeep,
  },
  paymentStatusText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  paymentStatusTextConfirmed: {
    color: '#ffffff',
  },
  requestCard: {
    minHeight: 69,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff1f4',
    borderWidth: 1,
    borderColor: '#ffc4cf',
  },
  requestMessage: {
    color: '#33413b',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 19,
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  successText: {
    color: colors.brandDeep,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});
