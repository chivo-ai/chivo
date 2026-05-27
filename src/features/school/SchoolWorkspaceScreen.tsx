import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, BookOpen, CheckCircle2, Circle, GraduationCap, Grid2X2, Layers, LogOut, Plus, Settings2, ShieldCheck, X } from 'lucide-react-native';

import { AppNavigation, AppNavItem } from '../../components/AppNavigation';
import { ChivoMetric } from '../../components/chivo/ChivoUI';
import { signOut } from '../../services/auth';
import { createClass, fetchSchoolSetupState, SchoolSetupState } from '../../services/school';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership } from '../../types';
import { LearnerScreen } from '../learner/LearnerScreen';
import { TeacherScreen } from '../teacher/TeacherScreen';

type WorkspaceSurface = 'learn' | 'teach';
type ClassModalIntent = 'default' | 'guided';

type SchoolWorkspaceScreenProps = {
  membership: ActiveSchoolMembership;
  onSwitchSchool: () => void;
  initialSurface?: WorkspaceSurface;
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

export function SchoolWorkspaceScreen({
  membership,
  onSwitchSchool,
  initialSurface,
}: SchoolWorkspaceScreenProps) {
  const isAdmin = membership.role === 'owner' || membership.role === 'admin';
  const canTeach = ['owner', 'admin', 'teacher'].includes(membership.role);
  const startingSurface = initialSurface === 'teach' && canTeach ? 'teach' : 'learn';
  const [activeSurface, setActiveSurface] = useState<WorkspaceSurface>(startingSurface);
  const [setup, setSetup] = useState<SchoolSetupState>(emptySetup);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [classModalIntent, setClassModalIntent] = useState<ClassModalIntent>('default');
  const [className, setClassName] = useState('');
  const [classUsername, setClassUsername] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const school = membership.school;
  const schoolName = school.name;
  const schoolUsername = school.slug ?? '';
  const schoolPlace = [school.city, school.country].filter(Boolean).join(', ');

  const navItems = useMemo<AppNavItem[]>(() => [
    {
      id: 'learn',
      label: 'Learn',
      description: 'Lessons and practice',
      group: 'School',
      icon: <BookOpen size={19} color={activeSurface === 'learn' ? colors.brandDeep : '#d8e0ef'} />,
    },
    {
      id: 'teach',
      label: 'Teach',
      description: 'Live class work',
      group: 'School',
      visible: canTeach,
      icon: <GraduationCap size={19} color={activeSurface === 'teach' ? colors.brandDeep : '#d8e0ef'} />,
    },
    {
      id: 'admin',
      label: 'Admin',
      description: 'School console',
      group: 'School',
      visible: isAdmin,
      icon: <ShieldCheck size={19} color="#d8e0ef" />,
    },
  ], [activeSurface, canTeach, isAdmin]);

  const counts = useMemo(() => {
    const activeMembers = setup.members.filter((member) => member.status === 'active').length;
    const joinedClasses = setup.classMemberships.filter(
      (item) => item.school_membership_id === membership.id && item.status === 'active'
    ).length;

    return {
      activeMembers,
      classes: setup.classes.length,
      subjects: setup.subjects.length,
      joinedClasses,
    };
  }, [membership.id, setup]);
  const firstClass = setup.classes[0] ?? null;

  const loadWorkspace = useCallback(async () => {
    setError(null);
    const nextSetup = await fetchSchoolSetupState(membership.schoolId, isAdmin);
    setSetup(nextSetup);
    return nextSetup;
  }, [isAdmin, membership.schoolId]);

  useEffect(() => {
    setLoading(true);
    loadWorkspace()
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load school.'))
      .finally(() => setLoading(false));
  }, [loadWorkspace]);

  useEffect(() => {
    if (activeSurface === 'teach' && !canTeach) {
      setActiveSurface('learn');
    }
  }, [activeSurface, canTeach]);

  useEffect(() => {
    if (initialSurface === 'teach' && canTeach) {
      setActiveSurface('teach');
      return;
    }

    if (initialSurface === 'learn') {
      setActiveSurface('learn');
    }
  }, [canTeach, initialSurface]);

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

  async function handleCreateClass() {
    setCreatingClass(true);
    setClassError(null);

    try {
      const createdClass = await createClass({
        schoolId: membership.schoolId,
        academicTermId: null,
        name: className,
        username: classUsername,
        gradeLevel,
        logoUrl: '',
        bannerUrl: '',
        stickerKey: 'orbit',
      });
      setClassName('');
      setClassUsername('');
      setGradeLevel('');
      setClassModalOpen(false);
      const nextSetup = await loadWorkspace();

      if (classModalIntent === 'guided') {
        const targetClass = createdClass ?? nextSetup.classes.find((item) => item.name.toLowerCase() === className.trim().toLowerCase());
        if (targetClass?.username) {
          router.push(`/school/class/${targetClass.username}?setup=subject&panel=people` as never);
        }
      }
    } catch (caught) {
      setClassError(caught instanceof Error ? caught.message : 'Could not create class.');
    } finally {
      setCreatingClass(false);
    }
  }

  function openClassModal(intent: ClassModalIntent) {
    setClassModalIntent(intent);
    setClassError(null);
    setClassModalOpen(true);
  }

  function openSubjectSetup() {
    if (!firstClass?.username) {
      openClassModal('guided');
      return;
    }

    router.push(`/school/class/${firstClass.username}?setup=subject&panel=people` as never);
  }

  function openLessonStudio() {
    if (!firstClass?.username) {
      openClassModal('guided');
      return;
    }

    router.push(`/school/class/${firstClass.username}?panel=studio` as never);
  }

  function selectSurface(id: string) {
    if (id === 'admin') {
      router.push('/admin');
      return;
    }

    if (id === 'teach' && !canTeach) {
      return;
    }

    const nextSurface = id === 'teach' ? 'teach' : 'learn';
    setActiveSurface(nextSurface);
    router.push(nextSurface === 'teach' ? '/teach' : '/learn');
  }

  return (
    <AppNavigation
      title={schoolName}
      subtitle={`${formatRole(membership.role)} access`}
      items={navItems}
      activeId={activeSurface}
      onSelect={selectSurface}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.shell}>
          <View style={styles.topRow}>
            <Pressable onPress={onSwitchSchool} style={styles.iconButton}>
              <ArrowLeft size={20} color={colors.brandDeep} />
            </Pressable>

            <View style={styles.flexText}>
              <Text style={styles.title} numberOfLines={1}>{schoolName}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {schoolUsername || schoolPlace || formatRole(membership.role)}
              </Text>
            </View>

            <Pressable onPress={handleSignOut} style={styles.signOutButton}>
              {signingOut ? (
                <ActivityIndicator color={colors.brandDeep} />
              ) : (
                <>
                  <LogOut size={17} color={colors.brandDeep} />
                  <Text style={styles.signOutText} numberOfLines={1}>Sign out</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.heroPanel}>
            <View style={styles.banner}>
              {school.bannerUrl ? <Image source={{ uri: school.bannerUrl }} style={styles.bannerImage} /> : null}
            </View>
            <View style={styles.heroHeader}>
              <IdentityMark imageUrl={school.logoUrl} label={schoolName} />
              <View style={styles.flexText}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {activeSurface === 'teach' ? 'Teaching studio' : 'Learning space'}
                </Text>
                <Text style={styles.heroBody} numberOfLines={2}>
                  {activeSurface === 'teach'
                    ? 'Start lessons, manage class work, and prepare materials for students.'
                    : 'Open classes, read lesson summaries, practise, and keep progress moving.'}
                </Text>
              </View>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.metricGrid}>
            <Metric label="Members" value={counts.activeMembers} />
            <Metric label="Classes" value={counts.classes} />
            <Metric label="Subjects" value={counts.subjects} />
            <Metric label="Joined" value={counts.joinedClasses} />
          </View>

          {canTeach ? (
            <SchoolSetupDock
              classCount={counts.classes}
              subjectCount={counts.subjects}
              linkedSubjectCount={setup.classSubjects.length}
              memberCount={counts.activeMembers}
              isAdmin={isAdmin}
              onCreateClass={() => openClassModal('guided')}
              onAddSubject={openSubjectSetup}
              onRecordLesson={openLessonStudio}
            />
          ) : null}

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.brandDeep} />
              <Text style={styles.meta}>Loading school data</Text>
            </View>
          ) : activeSurface === 'teach' ? (
            <TeacherScreen membership={membership} setup={setup} onWorkspaceChanged={async () => { await loadWorkspace(); }} />
          ) : (
            <LearnerScreen membership={membership} setup={setup} onWorkspaceChanged={async () => { await loadWorkspace(); }} />
          )}

          <QuickClassModal
            visible={classModalOpen}
            className={className}
            classUsername={classUsername}
            gradeLevel={gradeLevel}
            saving={creatingClass}
            error={classError}
            onName={setClassName}
            onUsername={setClassUsername}
            onGradeLevel={setGradeLevel}
            onClose={() => {
              setClassModalOpen(false);
              setClassModalIntent('default');
            }}
            onSubmit={handleCreateClass}
          />
        </View>
      </ScrollView>
    </AppNavigation>
  );
}

function SchoolSetupDock({
  classCount,
  subjectCount,
  linkedSubjectCount,
  memberCount,
  isAdmin,
  onCreateClass,
  onAddSubject,
  onRecordLesson,
}: {
  classCount: number;
  subjectCount: number;
  linkedSubjectCount: number;
  memberCount: number;
  isAdmin: boolean;
  onCreateClass: () => void;
  onAddSubject: () => void;
  onRecordLesson: () => void;
}) {
  const nextAction = classCount === 0
    ? { label: 'Create class', onPress: onCreateClass, icon: <Plus size={16} color="#ffffff" /> }
    : linkedSubjectCount === 0
      ? { label: 'Add subject', onPress: onAddSubject, icon: <Layers size={16} color="#ffffff" /> }
      : { label: 'Record lesson', onPress: onRecordLesson, icon: <BookOpen size={16} color="#ffffff" /> };
  const activeStep = classCount === 0 ? 2 : linkedSubjectCount === 0 ? 3 : 4;

  return (
    <View style={styles.setupDock}>
      <View style={styles.setupIntro}>
        <View style={styles.setupIcon}>
          <Settings2 size={18} color="#ffffff" />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.setupTitle} numberOfLines={1}>Setup path</Text>
          <Text style={styles.setupMeta} numberOfLines={2}>
            Step {activeStep}: {classCount === 0 ? 'create a class' : linkedSubjectCount === 0 ? 'add a subject' : 'record the first lesson'} - {classCount} classes, {subjectCount} subjects, {memberCount} members
          </Text>
        </View>
      </View>

      <View style={styles.setupSteps}>
        <SetupStep label="School" done />
        <SetupStep label="Class" done={classCount > 0} />
        <SetupStep label="Subject" done={linkedSubjectCount > 0} />
        <SetupStep label="Lesson" done={false} active={classCount > 0 && linkedSubjectCount > 0} />
      </View>

      <View style={styles.setupActions}>
        <Pressable onPress={nextAction.onPress} style={styles.setupPrimary}>
          <View style={styles.setupButtonIcon}>{nextAction.icon}</View>
          <Text style={styles.setupPrimaryText} numberOfLines={1}>{nextAction.label}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/school/class' as never)} style={styles.setupAction}>
          <Grid2X2 size={16} color={colors.brandDeep} />
          <Text style={styles.setupActionText} numberOfLines={1}>Classes</Text>
        </Pressable>
        {isAdmin ? (
          <Pressable onPress={() => router.push('/admin' as never)} style={styles.setupAction}>
            <ShieldCheck size={16} color={colors.brandDeep} />
            <Text style={styles.setupActionText} numberOfLines={1}>Admin</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function SetupStep({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <View style={[styles.setupStep, active && styles.setupStepActive]}>
      {done ? <CheckCircle2 size={14} color={colors.brandDeep} /> : <Circle size={14} color={active ? colors.ink : colors.muted} />}
      <Text style={[styles.setupStepText, active && styles.setupStepTextActive]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function QuickClassModal({
  visible,
  className,
  classUsername,
  gradeLevel,
  saving,
  error,
  onName,
  onUsername,
  onGradeLevel,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  className: string;
  classUsername: string;
  gradeLevel: string;
  saving: boolean;
  error: string | null;
  onName: (value: string) => void;
  onUsername: (value: string) => void;
  onGradeLevel: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIcon}>
              <Plus size={21} color="#ffffff" />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.modalTitle} numberOfLines={1}>Create class</Text>
              <Text style={styles.modalMeta} numberOfLines={2}>Add another class to this school.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <X size={18} color={colors.brandDeep} />
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.modalField}>
            <Text style={styles.modalLabel} numberOfLines={1}>Class name</Text>
            <TextInput
              value={className}
              onChangeText={onName}
              placeholder="JSS 2 Blue"
              placeholderTextColor="#87938e"
              style={styles.modalInput}
            />
          </View>

          <View style={styles.modalField}>
            <Text style={styles.modalLabel} numberOfLines={1}>Username</Text>
            <TextInput
              value={classUsername}
              onChangeText={onUsername}
              placeholder="jss-2-blue"
              placeholderTextColor="#87938e"
              autoCapitalize="none"
              style={styles.modalInput}
            />
          </View>

          <View style={styles.modalField}>
            <Text style={styles.modalLabel} numberOfLines={1}>Grade level</Text>
            <TextInput
              value={gradeLevel}
              onChangeText={onGradeLevel}
              placeholder="Junior secondary"
              placeholderTextColor="#87938e"
              style={styles.modalInput}
            />
          </View>

          <Pressable disabled={saving || !className.trim()} onPress={onSubmit} style={[styles.modalPrimary, (saving || !className.trim()) && styles.disabledButton]}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Plus size={17} color="#ffffff" />}
            <Text style={styles.modalPrimaryText} numberOfLines={1}>Create class</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <ChivoMetric label={label} value={value} tone="surface" />;
}

function IdentityMark({ imageUrl, label }: { imageUrl?: string | null; label: string }) {
  return (
    <View style={styles.identityMark}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.identityImage} />
      ) : (
        <Text style={styles.identityInitials}>{initials(label)}</Text>
      )}
    </View>
  );
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 90,
    backgroundColor: colors.canvas,
  },
  shell: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    gap: 12,
  },
  topRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  signOutButton: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  signOutText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  heroPanel: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  banner: {
    height: 62,
    backgroundColor: '#0f172a',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  heroHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identityMark: {
    overflow: 'hidden',
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  identityImage: {
    width: '100%',
    height: '100%',
  },
  identityInitials: {
    color: colors.brandDeep,
    fontSize: 17,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  heroBody: {
    color: '#d8e0ef',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    minWidth: 112,
    flex: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  setupDock: {
    borderRadius: 8,
    padding: 14,
    gap: 11,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderTopWidth: 4,
    borderColor: '#dfe6f0',
    shadowColor: '#111318',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  setupSteps: {
    flex: 1.2,
    minWidth: 250,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  setupStep: {
    minHeight: 32,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  setupStepActive: {
    backgroundColor: '#f1ffd7',
    borderColor: '#a3e635',
  },
  setupStepText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  setupStepTextActive: {
    color: colors.ink,
  },
  setupIntro: {
    flex: 1,
    minWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  setupIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  setupTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  setupMeta: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  setupActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  setupPrimary: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brand,
  },
  setupButtonIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  setupPrimaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  setupAction: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  setupActionText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingCard: {
    minHeight: 90,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(11, 13, 18, 0.62)',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 8,
    padding: 16,
    gap: 13,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  modalHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
  },
  modalMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  modalField: {
    gap: 7,
  },
  modalLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  modalInput: {
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
  modalPrimary: {
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
  },
  modalPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
});
