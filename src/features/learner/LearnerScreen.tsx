import { router } from 'expo-router';
import { ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BookOpen,
  Brain,
  ChevronRight,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Headphones,
  Languages,
  Layers,
  PlayCircle,
  Sparkles,
  UserPlus,
} from 'lucide-react-native';

import { ChivoAction, ChivoCard, ChivoMetric } from '../../components/chivo/ChivoUI';
import { ClassRow, SchoolSetupState, SubjectRow, requestClassAccess } from '../../services/school';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership } from '../../types';

type LearnerScreenProps = {
  membership: ActiveSchoolMembership;
  setup: SchoolSetupState;
  onWorkspaceChanged: () => void | Promise<void>;
};

type ClassTone = {
  background: string;
  accent: string;
};

const classTones: ClassTone[] = [
  { background: '#e9f1ff', accent: colors.brand },
  { background: '#e3fbf7', accent: colors.teal },
  { background: '#f3efff', accent: colors.violet },
  { background: '#f1ffd7', accent: '#a3e635' },
  { background: '#fff1f4', accent: colors.coral },
];

export function LearnerScreen({ membership, setup, onWorkspaceChanged }: LearnerScreenProps) {
  const [savingClassId, setSavingClassId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isStaff = ['owner', 'admin', 'teacher'].includes(membership.role);

  const joinedClassIds = useMemo(
    () =>
      new Set(
        setup.classMemberships
          .filter((item) => item.school_membership_id === membership.id && item.status === 'active')
          .map((item) => item.class_id)
      ),
    [membership.id, setup.classMemberships]
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

  const learnerClasses = useMemo(
    () => (isStaff ? setup.classes : setup.classes.filter((schoolClass) => joinedClassIds.has(schoolClass.id))),
    [isStaff, joinedClassIds, setup.classes]
  );

  const subjectCount = useMemo(() => {
    const classIds = new Set(learnerClasses.map((schoolClass) => schoolClass.id));
    return new Set(
      setup.classSubjects
        .filter((link) => classIds.has(link.class_id))
        .map((link) => link.subject_id)
    ).size;
  }, [learnerClasses, setup.classSubjects]);

  const pendingCount = setup.classes.filter((schoolClass) => pendingClassIds.has(schoolClass.id)).length;
  const openClassCount = Math.max(setup.classes.length - joinedClassIds.size - pendingCount, 0);

  async function requestClass(schoolClass: ClassRow) {
    setSavingClassId(schoolClass.id);
    setError(null);
    setMessage(null);

    try {
      const result = await requestClassAccess({
        schoolId: membership.schoolId,
        classId: schoolClass.id,
        schoolMembershipId: membership.id,
        requestedRole: membership.role === 'guardian' ? 'guardian' : 'student',
        message: `Request to join ${schoolClass.name}`,
      });

      setMessage(result.alreadyRequested ? 'Request already sent.' : result.alreadyMember ? 'Class already joined.' : 'Class request sent.');
      await onWorkspaceChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send class request.');
    } finally {
      setSavingClassId(null);
    }
  }

  return (
    <View style={styles.stack}>
      <LearnerOverview
        schoolName={membership.school.name}
        classCount={learnerClasses.length}
        subjectCount={subjectCount}
        openClassCount={openClassCount}
      />

      <StudyToolRail />

      <ClassAccessPanel
        classes={setup.classes}
        learnerClasses={learnerClasses}
        subjects={setup.subjects}
        classSubjects={setup.classSubjects}
        joinedClassIds={joinedClassIds}
        pendingClassIds={pendingClassIds}
        savingClassId={savingClassId}
        message={message}
        error={error}
        isStaff={isStaff}
        onRequest={requestClass}
      />
    </View>
  );
}

function LearnerOverview({
  schoolName,
  classCount,
  subjectCount,
  openClassCount,
}: {
  schoolName: string;
  classCount: number;
  subjectCount: number;
  openClassCount: number;
}) {
  return (
    <ChivoCard compact style={styles.overview}>
      <View style={styles.overviewIcon}>
        <Sparkles size={19} color={colors.ink} />
      </View>
      <View style={styles.flexText}>
        <Text style={styles.overviewTitle} numberOfLines={1}>Learning launchpad</Text>
        <Text style={styles.overviewMeta} numberOfLines={3}>{schoolName} lessons are organized by class, with audio, transcript, quiz, cards, and progress inside each room.</Text>
      </View>
      <View style={styles.overviewActions}>
        <ChivoAction compact label="Classes" icon={<DoorOpen size={15} color="#ffffff" />} onPress={() => router.push('/school/class' as never)} />
        <ChivoAction compact variant="ghost" label="Lessons" icon={<BookOpen size={15} color={colors.brandDeep} />} onPress={() => router.push('/lessons' as never)} />
      </View>

      <View style={styles.statRow}>
        <MiniStat label="Joined" value={classCount} />
        <MiniStat label="Subjects" value={subjectCount} />
        <MiniStat label="Open" value={openClassCount} />
      </View>
    </ChivoCard>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <ChivoMetric label={label} value={value} tone="soft" />;
}

function StudyToolRail() {
  const tools = [
    { label: 'Listen', body: 'Audio lessons', icon: <Headphones size={18} color={colors.ink} />, tone: classTones[1] },
    { label: 'Translate', body: 'Language switch', icon: <Languages size={18} color={colors.ink} />, tone: classTones[3] },
    { label: 'Quiz', body: 'Check memory', icon: <Brain size={18} color={colors.ink} />, tone: classTones[2] },
    { label: 'Cards', body: 'Review fast', icon: <Layers size={18} color={colors.ink} />, tone: classTones[4] },
  ];

  return (
    <View style={styles.toolRail}>
      {tools.map((tool) => (
        <ToolChip key={tool.label} {...tool} />
      ))}
    </View>
  );
}

function ToolChip({ icon, label, body, tone }: { icon: ReactNode; label: string; body: string; tone: ClassTone }) {
  return (
    <View style={[styles.toolChip, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <View style={[styles.toolIcon, { backgroundColor: tone.accent }]}>{icon}</View>
      <View style={styles.flexText}>
        <Text style={styles.toolTitle} numberOfLines={1}>{label}</Text>
        <Text style={styles.toolBody} numberOfLines={1}>{body}</Text>
      </View>
      <ChevronRight size={16} color={colors.brandDeep} />
    </View>
  );
}

function ClassAccessPanel({
  classes,
  learnerClasses,
  subjects,
  classSubjects,
  joinedClassIds,
  pendingClassIds,
  savingClassId,
  message,
  error,
  isStaff,
  onRequest,
}: {
  classes: ClassRow[];
  learnerClasses: ClassRow[];
  subjects: SubjectRow[];
  classSubjects: SchoolSetupState['classSubjects'];
  joinedClassIds: Set<string>;
  pendingClassIds: Set<string>;
  savingClassId: string | null;
  message: string | null;
  error: string | null;
  isStaff: boolean;
  onRequest: (schoolClass: ClassRow) => void;
}) {
  return (
    <View style={styles.classSection}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Classes</Text>
          <Text style={styles.sectionMeta} numberOfLines={1}>{learnerClasses.length ? `${learnerClasses.length} active class${learnerClasses.length === 1 ? '' : 'es'}` : 'Join a class to begin learning'}</Text>
        </View>
        <Pressable onPress={() => router.push('/school/class' as never)} style={styles.iconAction}>
          <DoorOpen size={17} color={colors.brandDeep} />
        </Pressable>
      </View>

      {message ? <Text style={styles.successText}>{message}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.classGrid}>
        {classes.length ? (
          classes.map((schoolClass, index) => {
            const joined = isStaff || joinedClassIds.has(schoolClass.id);
            const pending = pendingClassIds.has(schoolClass.id);
            const loading = savingClassId === schoolClass.id;
            const subjectNames = classSubjects
              .filter((link) => link.class_id === schoolClass.id)
              .map((link) => subjects.find((subject) => subject.id === link.subject_id)?.name)
              .filter(Boolean) as string[];

            return (
              <ClassCard
                key={schoolClass.id}
                schoolClass={schoolClass}
                index={index}
                joined={joined}
                pending={pending}
                loading={loading}
                subjectNames={subjectNames}
                onRequest={() => onRequest(schoolClass)}
              />
            );
          })
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle} numberOfLines={1}>No classes yet</Text>
            <Text style={styles.emptyMeta} numberOfLines={2}>Classes will appear after the school creates them.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ClassCard({
  schoolClass,
  index,
  joined,
  pending,
  loading,
  subjectNames,
  onRequest,
}: {
  schoolClass: ClassRow;
  index: number;
  joined: boolean;
  pending: boolean;
  loading: boolean;
  subjectNames: string[];
  onRequest: () => void;
}) {
  const tone = classTones[index % classTones.length];

  return (
    <View style={[styles.classCard, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <View style={styles.classTop}>
        <View style={[styles.classMark, { backgroundColor: tone.accent }]}>
          {schoolClass.logo_url ? (
            <Image source={{ uri: schoolClass.logo_url }} style={styles.classImage} />
          ) : (
            <Text style={styles.classInitials}>{initials(schoolClass.name)}</Text>
          )}
        </View>
        <ClassStatus joined={joined} pending={pending} />
      </View>

      <Text style={styles.classTitle} numberOfLines={1}>{schoolClass.name}</Text>
      <Text style={styles.classMeta} numberOfLines={1}>{schoolClass.grade_level ?? schoolClass.username}</Text>

      <View style={styles.subjectRow}>
        {subjectNames.length ? subjectNames.slice(0, 3).map((subject) => (
          <View key={subject} style={styles.subjectPill}>
            <Text style={styles.subjectText} numberOfLines={1}>{subject}</Text>
          </View>
        )) : (
          <View style={styles.subjectPill}>
            <Text style={styles.subjectText} numberOfLines={1}>Subjects soon</Text>
          </View>
        )}
      </View>

      {joined ? (
        <Pressable onPress={() => router.push(`/school/class/${schoolClass.username}` as never)} style={styles.enterButton}>
          <PlayCircle size={15} color="#ffffff" />
          <Text style={styles.enterButtonText} numberOfLines={1}>Enter class</Text>
        </Pressable>
      ) : pending ? (
        <View style={styles.pendingButton}>
          <Clock3 size={15} color={colors.brandDeep} />
          <Text style={styles.pendingButtonText} numberOfLines={1}>Waiting</Text>
        </View>
      ) : (
        <Pressable disabled={loading} onPress={onRequest} style={styles.requestButton}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <UserPlus size={15} color="#ffffff" />}
          <Text style={styles.enterButtonText} numberOfLines={1}>Request</Text>
        </Pressable>
      )}
    </View>
  );
}

function ClassStatus({ joined, pending }: { joined: boolean; pending: boolean }) {
  if (joined) {
    return (
      <View style={styles.statusActive}>
        <CheckCircle2 size={13} color="#ffffff" />
        <Text style={styles.statusActiveText} numberOfLines={1}>Joined</Text>
      </View>
    );
  }

  if (pending) {
    return (
      <View style={styles.statusSoft}>
        <Clock3 size={13} color={colors.brandDeep} />
        <Text style={styles.statusSoftText} numberOfLines={1}>Pending</Text>
      </View>
    );
  }

  return (
    <View style={styles.statusSoft}>
      <DoorOpen size={13} color={colors.brandDeep} />
      <Text style={styles.statusSoftText} numberOfLines={1}>Open</Text>
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
  stack: {
    gap: 12,
  },
  overview: {
    borderRadius: 8,
    padding: 16,
    gap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  overviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  overviewTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  overviewMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  overviewActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  primaryAction: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brandDeep,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  softAction: {
    minHeight: 34,
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
  softActionText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  statRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  miniStat: {
    minWidth: 86,
    flex: 1,
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: colors.line,
  },
  miniStatValue: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  miniStatLabel: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  toolRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toolChip: {
    minWidth: 145,
    flex: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderBottomWidth: 4,
  },
  toolIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  toolBody: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  classSection: {
    gap: 10,
  },
  sectionHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  iconAction: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  successText: {
    color: colors.brandDeep,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11,
  },
  classCard: {
    minWidth: 230,
    flex: 1,
    borderRadius: 8,
    padding: 14,
    gap: 9,
    borderWidth: 1,
    borderBottomWidth: 4,
  },
  classTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 9,
  },
  classMark: {
    overflow: 'hidden',
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  classImage: {
    width: '100%',
    height: '100%',
  },
  classInitials: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  classTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  classMeta: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  subjectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subjectPill: {
    minHeight: 25,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(24, 36, 33, 0.08)',
  },
  subjectText: {
    color: colors.brandDeep,
    fontSize: 10,
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
  enterButtonText: {
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
  },
  pendingButtonText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  statusActive: {
    minHeight: 26,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.brandDeep,
  },
  statusActiveText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  statusSoft: {
    minHeight: 26,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
  },
  statusSoftText: {
    color: colors.brandDeep,
    fontSize: 10,
    fontWeight: '700',
  },
  emptyPanel: {
    flex: 1,
    borderRadius: 8,
    padding: 14,
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  emptyMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
});
