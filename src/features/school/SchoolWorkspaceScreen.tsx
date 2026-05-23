import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, BookOpen, GraduationCap, LogOut, ShieldCheck } from 'lucide-react-native';

import { AppNavigation, AppNavItem } from '../../components/AppNavigation';
import { signOut } from '../../services/auth';
import { fetchSchoolSetupState, SchoolSetupState } from '../../services/school';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership } from '../../types';
import { LearnerScreen } from '../learner/LearnerScreen';
import { TeacherScreen } from '../teacher/TeacherScreen';

type WorkspaceSurface = 'learn' | 'teach';

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
      icon: <BookOpen size={19} color={activeSurface === 'learn' ? colors.tealDark : '#dce7e1'} />,
    },
    {
      id: 'teach',
      label: 'Teach',
      description: 'Live class work',
      group: 'School',
      visible: canTeach,
      icon: <GraduationCap size={19} color={activeSurface === 'teach' ? colors.tealDark : '#dce7e1'} />,
    },
    {
      id: 'admin',
      label: 'Admin',
      description: 'School console',
      group: 'School',
      visible: isAdmin,
      icon: <ShieldCheck size={19} color="#dce7e1" />,
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

  const loadWorkspace = useCallback(async () => {
    setError(null);
    const nextSetup = await fetchSchoolSetupState(membership.schoolId, isAdmin);
    setSetup(nextSetup);
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
              <ArrowLeft size={20} color={colors.tealDark} />
            </Pressable>

            <View style={styles.flexText}>
              <Text style={styles.title}>{schoolName}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {schoolUsername || schoolPlace || formatRole(membership.role)}
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
            <View style={styles.banner}>
              {school.bannerUrl ? <Image source={{ uri: school.bannerUrl }} style={styles.bannerImage} /> : null}
            </View>
            <View style={styles.heroHeader}>
              <IdentityMark imageUrl={school.logoUrl} label={schoolName} />
              <View style={styles.flexText}>
                <Text style={styles.heroTitle}>
                  {activeSurface === 'teach' ? 'Teaching studio' : 'Learning space'}
                </Text>
                <Text style={styles.heroBody}>
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

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.tealDark} />
              <Text style={styles.meta}>Loading school data</Text>
            </View>
          ) : activeSurface === 'teach' ? (
            <TeacherScreen membership={membership} setup={setup} onWorkspaceChanged={loadWorkspace} />
          ) : (
            <LearnerScreen membership={membership} setup={setup} onWorkspaceChanged={loadWorkspace} />
          )}
        </View>
      </ScrollView>
    </AppNavigation>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
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
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 106,
    backgroundColor: colors.canvas,
  },
  shell: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: 16,
  },
  topRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: colors.line,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  signOutButton: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: colors.line,
  },
  signOutText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  heroPanel: {
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#101916',
    borderWidth: 1,
    borderColor: '#20352f',
  },
  banner: {
    height: 104,
    backgroundColor: colors.tealDark,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  heroHeader: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  identityMark: {
    overflow: 'hidden',
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  identityImage: {
    width: '100%',
    height: '100%',
  },
  identityInitials: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '900',
  },
  heroBody: {
    color: '#dce7e1',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    minWidth: 130,
    flex: 1,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
  },
  loadingCard: {
    minHeight: 118,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
});
