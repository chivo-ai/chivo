import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, CheckCircle2, Clock3, DoorOpen, PlayCircle, Sparkles, UserPlus } from 'lucide-react-native';

import { RouteScreen } from '../../../src/features/app/RouteScreen';
import { useAppSession } from '../../../src/features/app/AppSessionProvider';
import {
  ClassRow,
  SchoolSetupState,
  fetchSchoolSetupState,
  requestClassAccess,
} from '../../../src/services/school';
import { colors } from '../../../src/theme/tokens';

type ClassFilter = 'all' | 'joined' | 'waiting' | 'open';

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

const tones = [
  { background: '#e9f1ff', accent: colors.brand },
  { background: '#e3fbf7', accent: colors.teal },
  { background: '#f3efff', accent: colors.violet },
  { background: '#f1ffd7', accent: '#a3e635' },
  { background: '#fff1f4', accent: colors.coral },
];

export default function ClassesIndexRoute() {
  const { loading, activeMembership } = useAppSession();
  const [setup, setSetup] = useState<SchoolSetupState>(emptySetup);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [savingClassId, setSavingClassId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ClassFilter>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isStaff = activeMembership ? ['owner', 'admin', 'teacher'].includes(activeMembership.role) : false;
  const isAdmin = activeMembership ? ['owner', 'admin'].includes(activeMembership.role) : false;

  const joinedClassIds = useMemo(
    () =>
      new Set(
        setup.classMemberships
          .filter((item) => item.school_membership_id === activeMembership?.id && item.status === 'active')
          .map((item) => item.class_id)
      ),
    [activeMembership?.id, setup.classMemberships]
  );

  const pendingClassIds = useMemo(
    () =>
      new Set(
        setup.joinRequests
          .filter((request) => request.status === 'review' && request.class_id)
          .map((request) => request.class_id as string)
      ),
    [setup.joinRequests]
  );

  const loadSetup = useCallback(async () => {
    if (!activeMembership) {
      return;
    }

    setError(null);
    setSetup(await fetchSchoolSetupState(activeMembership.schoolId, isAdmin));
  }, [activeMembership, isAdmin]);

  useEffect(() => {
    if (!activeMembership) {
      setLoadingSetup(false);
      return;
    }

    setLoadingSetup(true);
    loadSetup()
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load classes.'))
      .finally(() => setLoadingSetup(false));
  }, [activeMembership, loadSetup]);

  async function requestClass(schoolClass: ClassRow) {
    if (!activeMembership) {
      return;
    }

    setSavingClassId(schoolClass.id);
    setError(null);
    setMessage(null);

    try {
      const result = await requestClassAccess({
        schoolId: activeMembership.schoolId,
        classId: schoolClass.id,
        schoolMembershipId: activeMembership.id,
        requestedRole: activeMembership.role === 'guardian' ? 'guardian' : 'student',
        message: `Request to join ${schoolClass.name}`,
      });

      setMessage(result.alreadyRequested ? 'Request already sent.' : result.alreadyMember ? 'Class already joined.' : 'Class request sent.');
      await loadSetup();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send class request.');
    } finally {
      setSavingClassId(null);
    }
  }

  if (loading) {
    return null;
  }

  if (!activeMembership) {
    return <Redirect href="/school/my-school" />;
  }

  const joinedCount = isStaff ? setup.classes.length : joinedClassIds.size;
  const waitingCount = pendingClassIds.size;
  const openCount = setup.classes.filter((schoolClass) => !joinedClassIds.has(schoolClass.id) && !pendingClassIds.has(schoolClass.id)).length;
  const visibleClasses = setup.classes.filter((schoolClass) => {
    if (activeFilter === 'joined') {
      return isStaff || joinedClassIds.has(schoolClass.id);
    }

    if (activeFilter === 'waiting') {
      return pendingClassIds.has(schoolClass.id);
    }

    if (activeFilter === 'open') {
      return !isStaff && !joinedClassIds.has(schoolClass.id) && !pendingClassIds.has(schoolClass.id);
    }

    return true;
  });

  return (
    <RouteScreen>
      <View style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <View style={styles.heroPill}>
              <Sparkles size={15} color={colors.ink} />
              <Text style={styles.heroPillText}>Class map</Text>
            </View>
            <Text style={styles.heroTitle}>{activeMembership.school.name}</Text>
            <Text style={styles.heroBody}>Pick a class, then learn inside the full classroom.</Text>
          </View>
          <View style={styles.heroStats}>
            <MiniStat label="Classes" value={setup.classes.length} tone={tones[0]} />
            <MiniStat label="Joined" value={joinedCount} tone={tones[3]} />
            <MiniStat label="Waiting" value={waitingCount} tone={tones[2]} />
          </View>
        </View>

        {message ? <Text style={styles.successText}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.filterRail}>
          <FilterButton id="all" active={activeFilter} label="All" count={setup.classes.length} onPress={setActiveFilter} />
          <FilterButton id="joined" active={activeFilter} label="Joined" count={joinedCount} onPress={setActiveFilter} />
          <FilterButton id="waiting" active={activeFilter} label="Waiting" count={waitingCount} onPress={setActiveFilter} />
          <FilterButton id="open" active={activeFilter} label="Open" count={isStaff ? 0 : openCount} onPress={setActiveFilter} />
        </View>

        {loadingSetup ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={colors.brandDeep} />
            <Text style={styles.meta}>Loading classes</Text>
          </View>
        ) : visibleClasses.length ? (
          <View style={styles.classGrid}>
            {visibleClasses.map((schoolClass, index) => {
              const joined = isStaff || joinedClassIds.has(schoolClass.id);
              const pending = pendingClassIds.has(schoolClass.id);
              const subjectNames = setup.classSubjects
                .filter((link) => link.class_id === schoolClass.id)
                .map((link) => setup.subjects.find((subject) => subject.id === link.subject_id)?.name)
                .filter(Boolean) as string[];

              return (
                <ClassMapCard
                  key={schoolClass.id}
                  schoolClass={schoolClass}
                  tone={tones[index % tones.length]}
                  joined={joined}
                  pending={pending}
                  loading={savingClassId === schoolClass.id}
                  subjectNames={subjectNames}
                  onEnter={() => router.push(`/school/class/${schoolClass.username}` as never)}
                  onRequest={() => requestClass(schoolClass)}
                />
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No classes here</Text>
            <Text style={styles.meta}>Try another filter or wait for the school to create more classes.</Text>
          </View>
        )}
      </View>
    </RouteScreen>
  );
}

function FilterButton({
  id,
  active,
  label,
  count,
  onPress,
}: {
  id: ClassFilter;
  active: ClassFilter;
  label: string;
  count: number;
  onPress: (id: ClassFilter) => void;
}) {
  const selected = id === active;

  return (
    <Pressable onPress={() => onPress(id)} style={[styles.filterButton, selected && styles.filterButtonActive]}>
      <Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text>
      <Text style={[styles.filterCount, selected && styles.filterTextActive]}>{count}</Text>
    </Pressable>
  );
}

function ClassMapCard({
  schoolClass,
  tone,
  joined,
  pending,
  loading,
  subjectNames,
  onEnter,
  onRequest,
}: {
  schoolClass: ClassRow;
  tone: { background: string; accent: string };
  joined: boolean;
  pending: boolean;
  loading: boolean;
  subjectNames: string[];
  onEnter: () => void;
  onRequest: () => void;
}) {
  return (
    <View style={[styles.classCard, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <View style={styles.classTop}>
        <View style={[styles.classMark, { backgroundColor: tone.accent }]}>
          {schoolClass.logo_url ? <Image source={{ uri: schoolClass.logo_url }} style={styles.markImage} /> : <Text style={styles.markText}>{initials(schoolClass.name)}</Text>}
        </View>
        <StatusPill joined={joined} pending={pending} />
      </View>

      <Text style={styles.className}>{schoolClass.name}</Text>
      <Text style={styles.classMeta}>{schoolClass.grade_level ?? 'Learning group'} - {schoolClass.username}</Text>

      <View style={styles.subjectPills}>
        {subjectNames.length ? subjectNames.slice(0, 3).map((subject) => (
          <View key={subject} style={styles.subjectPill}>
            <Text style={styles.subjectPillText}>{subject}</Text>
          </View>
        )) : (
          <View style={styles.subjectPill}>
            <Text style={styles.subjectPillText}>Subjects soon</Text>
          </View>
        )}
      </View>

      {joined ? (
        <Pressable onPress={onEnter} style={styles.enterButton}>
          <PlayCircle size={16} color="#ffffff" />
          <Text style={styles.buttonText}>Enter class</Text>
        </Pressable>
      ) : pending ? (
        <View style={styles.pendingButton}>
          <Clock3 size={16} color={colors.brandDeep} />
          <Text style={styles.pendingText}>Waiting</Text>
        </View>
      ) : (
        <Pressable disabled={loading} onPress={onRequest} style={styles.requestButton}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <UserPlus size={16} color="#ffffff" />}
          <Text style={styles.buttonText}>Request</Text>
        </Pressable>
      )}
    </View>
  );
}

function StatusPill({ joined, pending }: { joined: boolean; pending: boolean }) {
  if (joined) {
    return (
      <View style={styles.statusActive}>
        <CheckCircle2 size={14} color="#ffffff" />
        <Text style={styles.statusActiveText}>Joined</Text>
      </View>
    );
  }

  if (pending) {
    return (
      <View style={styles.statusSoft}>
        <Clock3 size={14} color={colors.brandDeep} />
        <Text style={styles.statusSoftText}>Pending</Text>
      </View>
    );
  }

  return (
    <View style={styles.statusSoft}>
      <DoorOpen size={14} color={colors.brandDeep} />
      <Text style={styles.statusSoftText}>Open</Text>
    </View>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: { background: string; accent: string } }) {
  return (
    <View style={[styles.statCard, { backgroundColor: tone.background }]}>
      <View style={[styles.statDot, { backgroundColor: tone.accent }]} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
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
  screen: {
    gap: 12,
  },
  hero: {
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  heroCopy: {
    flex: 1.4,
    minWidth: 190,
    gap: 10,
  },
  heroPill: {
    alignSelf: 'flex-start',
    minHeight: 26,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.mint,
  },
  heroPillText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  heroBody: {
    color: '#d8e0ef',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  heroStats: {
    flex: 1,
    minWidth: 180,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  statCard: {
    minWidth: 82,
    flex: 1,
    borderRadius: 10,
    padding: 11,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(17, 19, 24, 0.1)',
  },
  statDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statValue: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  filterRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  filterButton: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  filterButtonActive: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandDeep,
  },
  filterText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  filterCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  classCard: {
    minWidth: 240,
    flex: 1,
    borderRadius: 10,
    padding: 14,
    gap: 9,
    borderWidth: 1,
  },
  classTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  classMark: {
    overflow: 'hidden',
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  markImage: {
    width: '100%',
    height: '100%',
  },
  markText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  className: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  classMeta: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  subjectPills: {
    minHeight: 30,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subjectPill: {
    minHeight: 28,
    borderRadius: 8,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(24, 36, 33, 0.08)',
  },
  subjectPillText: {
    color: colors.brandDeep,
    fontSize: 11,
    fontWeight: '700',
  },
  enterButton: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.brandDeep,
  },
  requestButton: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.brand,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingButton: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  pendingText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  statusSoft: {
    minHeight: 26,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
  },
  statusSoftText: {
    color: colors.brandDeep,
    fontSize: 10,
    fontWeight: '700',
  },
  statusActive: {
    minHeight: 26,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brandDeep,
  },
  statusActiveText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  loadingPanel: {
    minHeight: 99,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  emptyPanel: {
    minHeight: 99,
    borderRadius: 10,
    padding: 14,
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  successText: {
    color: colors.brand,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});
