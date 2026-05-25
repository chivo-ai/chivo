import { router } from 'expo-router';
import { ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Headphones,
  Languages,
  Layers,
  PlayCircle,
  Sparkles,
  Star,
  Trophy,
  UserPlus,
} from 'lucide-react-native';

import { LessonWorkspace } from '../lessons/LessonWorkspace';
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
  text: string;
};

const classTones: ClassTone[] = [
  { background: '#fff4d4', accent: colors.gold, text: colors.ink },
  { background: '#e9f6ff', accent: '#4aa6d9', text: colors.ink },
  { background: '#f3eaff', accent: '#8d68d8', text: colors.ink },
  { background: '#e8f8ee', accent: '#39a96b', text: colors.ink },
  { background: '#fff0ed', accent: colors.coral, text: colors.ink },
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
      <StudentHero
        schoolName={membership.school.name}
        classCount={learnerClasses.length}
        subjectCount={subjectCount}
        openClassCount={openClassCount}
      />

      <StudyPath classCount={learnerClasses.length} subjectCount={subjectCount} />

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

      <LearnerClassList
        classes={learnerClasses}
        subjects={setup.subjects}
        classSubjects={setup.classSubjects}
      />

      <StudyTools />

      <View style={styles.libraryHeader}>
        <View style={styles.sectionIcon}>
          <BookOpen size={22} color="#ffffff" />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.sectionTitle}>Lesson library</Text>
          <Text style={styles.sectionMeta}>Audio, transcript, summary, quiz, and cards in one place.</Text>
        </View>
      </View>

      <LessonWorkspace membership={membership} setup={setup} onLessonsChanged={onWorkspaceChanged} mode="learn" />
    </View>
  );
}

function LearnerClassList({
  classes,
  subjects,
  classSubjects,
}: {
  classes: ClassRow[];
  subjects: SubjectRow[];
  classSubjects: SchoolSetupState['classSubjects'];
}) {
  return (
    <View style={styles.classListPanel}>
      <View style={styles.sectionHeadingRow}>
        <View>
          <Text style={styles.sectionTitle}>Your classes</Text>
          <Text style={styles.sectionMeta}>Open a class directly with its clean class link.</Text>
        </View>
      </View>

      {classes.length ? (
        <View style={styles.classListStack}>
          {classes.map((schoolClass) => {
            const subjectNames = classSubjects
              .filter((link) => link.class_id === schoolClass.id)
              .map((link) => subjects.find((subject) => subject.id === link.subject_id)?.name)
              .filter(Boolean) as string[];

            return (
              <Pressable
                key={schoolClass.id}
                onPress={() => router.push(`/school/class/${schoolClass.username}` as never)}
                style={styles.classListItem}
              >
                <View style={styles.classListIcon}>
                  <BookOpen size={18} color="#ffffff" />
                </View>
                <View style={styles.flexText}>
                  <Text style={styles.classListTitle}>{schoolClass.name}</Text>
                  <Text style={styles.classListMeta}>/{schoolClass.username} - {subjectNames.slice(0, 3).join(', ') || 'Subjects soon'}</Text>
                </View>
                <View style={styles.classListButton}>
                  <Text style={styles.classListButtonText}>Enter</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.sectionMeta}>Join a class to see direct class links here.</Text>
      )}
    </View>
  );
}

function StudentHero({
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
    <View style={styles.studentHero}>
      <View style={styles.heroCopy}>
        <View style={styles.heroLabel}>
          <Sparkles size={16} color={colors.ink} />
          <Text style={styles.heroLabelText}>Chivo learner</Text>
        </View>
        <Text style={styles.heroTitle}>Your study path is ready</Text>
        <Text style={styles.heroBody}>{schoolName} lessons become small, clear practice steps.</Text>
      </View>

      <View style={styles.heroStickerBoard}>
        <StickerStat icon={<Trophy size={20} color={colors.ink} />} label="Classes" value={classCount} tone={classTones[0]} />
        <StickerStat icon={<Brain size={20} color={colors.ink} />} label="Subjects" value={subjectCount} tone={classTones[2]} />
        <StickerStat icon={<DoorOpen size={20} color={colors.ink} />} label="Open" value={openClassCount} tone={classTones[3]} />
      </View>
    </View>
  );
}

function StickerStat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: ClassTone }) {
  return (
    <View style={[styles.stickerStat, { backgroundColor: tone.background }]}>
      <View style={[styles.stickerIcon, { backgroundColor: tone.accent }]}>
        {icon}
      </View>
      <Text style={[styles.stickerValue, { color: tone.text }]}>{value}</Text>
      <Text style={styles.stickerLabel}>{label}</Text>
    </View>
  );
}

function StudyPath({ classCount, subjectCount }: { classCount: number; subjectCount: number }) {
  const steps = [
    { label: 'Listen', icon: <Headphones size={19} color={colors.ink} />, tone: classTones[1], ready: classCount > 0 },
    { label: 'Read', icon: <BookOpen size={19} color={colors.ink} />, tone: classTones[0], ready: classCount > 0 },
    { label: 'Quiz', icon: <Brain size={19} color={colors.ink} />, tone: classTones[2], ready: subjectCount > 0 },
    { label: 'Cards', icon: <Layers size={19} color={colors.ink} />, tone: classTones[4], ready: subjectCount > 0 },
  ];

  return (
    <View style={styles.pathSection}>
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionTitle}>Today path</Text>
        <View style={styles.softBadge}>
          <Star size={14} color={colors.tealDark} />
          <Text style={styles.softBadgeText}>{classCount ? 'Active' : 'Join class'}</Text>
        </View>
      </View>
      <View style={styles.pathTrack}>
        {steps.map((step, index) => (
          <View key={step.label} style={styles.pathStepWrap}>
            <View style={[styles.pathStep, { backgroundColor: step.tone.background, borderColor: step.ready ? step.tone.accent : colors.line }]}>
              <View style={[styles.pathStepIcon, { backgroundColor: step.tone.accent }]}>{step.icon}</View>
              <Text style={styles.pathStepText}>{step.label}</Text>
              {step.ready ? <CheckCircle2 size={15} color={colors.tealDark} /> : <Clock3 size={15} color={colors.muted} />}
            </View>
            {index < steps.length - 1 ? <View style={styles.pathConnector} /> : null}
          </View>
        ))}
      </View>
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
  const visibleClasses = isStaff ? classes : classes;

  return (
    <View style={styles.classSection}>
      <View style={styles.sectionHeadingRow}>
        <View>
          <Text style={styles.sectionTitle}>Class map</Text>
          <Text style={styles.sectionMeta}>{learnerClasses.length ? `${learnerClasses.length} class${learnerClasses.length === 1 ? '' : 'es'} in your path` : 'Choose a class to begin'}</Text>
        </View>
        <Pressable onPress={() => router.push('/school/class' as never)} style={styles.iconAction}>
          <DoorOpen size={18} color={colors.tealDark} />
        </Pressable>
      </View>

      {message ? <Text style={styles.successText}>{message}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.classGrid}>
        {visibleClasses.length ? (
          visibleClasses.map((schoolClass, index) => {
            const joined = isStaff || joinedClassIds.has(schoolClass.id);
            const pending = pendingClassIds.has(schoolClass.id);
            const loading = savingClassId === schoolClass.id;
            const subjectNames = classSubjects
              .filter((link) => link.class_id === schoolClass.id)
              .map((link) => subjects.find((subject) => subject.id === link.subject_id)?.name)
              .filter(Boolean) as string[];

            return (
              <ClassJourneyCard
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
          <View style={styles.emptyClassState}>
            <Text style={styles.emptyTitle}>No classes yet</Text>
            <Text style={styles.sectionMeta}>Classes will appear when the school creates them.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ClassJourneyCard({
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
      <View style={styles.classCardTop}>
        <View style={[styles.classSticker, { backgroundColor: tone.accent }]}>
          {schoolClass.logo_url ? (
            <Image source={{ uri: schoolClass.logo_url }} style={styles.classImage} />
          ) : (
            <Text style={styles.classInitials}>{initials(schoolClass.name)}</Text>
          )}
        </View>
        <ClassStatus joined={joined} pending={pending} />
      </View>

      <Text style={styles.classTitle}>{schoolClass.name}</Text>
      <Text style={styles.classMeta}>{schoolClass.grade_level ?? 'Learning group'}</Text>

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
        <Pressable onPress={() => router.push(`/school/class/${schoolClass.username}` as never)} style={styles.enterButton}>
          <PlayCircle size={16} color="#ffffff" />
          <Text style={styles.enterButtonText}>Enter class</Text>
        </Pressable>
      ) : pending ? (
        <View style={styles.pendingButton}>
          <Clock3 size={16} color={colors.tealDark} />
          <Text style={styles.pendingButtonText}>Waiting</Text>
        </View>
      ) : (
        <Pressable disabled={loading} onPress={onRequest} style={styles.requestButton}>
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <UserPlus size={16} color="#ffffff" />
              <Text style={styles.enterButtonText}>Request</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

function ClassStatus({ joined, pending }: { joined: boolean; pending: boolean }) {
  if (joined) {
    return (
      <View style={styles.statusPillActive}>
        <CheckCircle2 size={14} color="#ffffff" />
        <Text style={styles.statusPillTextActive}>Joined</Text>
      </View>
    );
  }

  if (pending) {
    return (
      <View style={styles.statusPill}>
        <Clock3 size={14} color={colors.tealDark} />
        <Text style={styles.statusPillText}>Pending</Text>
      </View>
    );
  }

  return (
    <View style={styles.statusPill}>
      <DoorOpen size={14} color={colors.tealDark} />
      <Text style={styles.statusPillText}>Open</Text>
    </View>
  );
}

function StudyTools() {
  const tools = [
    { label: 'Audio', body: 'Listen back', icon: <Headphones size={21} color={colors.ink} />, tone: classTones[1] },
    { label: 'Translate', body: 'Switch language', icon: <Languages size={21} color={colors.ink} />, tone: classTones[3] },
    { label: 'Quiz', body: 'Check mastery', icon: <Brain size={21} color={colors.ink} />, tone: classTones[2] },
    { label: 'Cards', body: 'Review fast', icon: <Layers size={21} color={colors.ink} />, tone: classTones[4] },
  ];

  return (
    <View style={styles.toolsGrid}>
      {tools.map((tool) => (
        <View key={tool.label} style={[styles.toolCard, { backgroundColor: tool.tone.background, borderColor: tool.tone.accent }]}>
          <View style={[styles.toolIcon, { backgroundColor: tool.tone.accent }]}>{tool.icon}</View>
          <Text style={styles.toolTitle}>{tool.label}</Text>
          <Text style={styles.toolBody}>{tool.body}</Text>
        </View>
      ))}
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
    gap: 18,
  },
  studentHero: {
    minHeight: 210,
    borderRadius: 30,
    padding: 20,
    gap: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#ffe8a8',
    borderWidth: 1,
    borderColor: '#f0c75d',
  },
  heroCopy: {
    flex: 1.3,
    minWidth: 260,
    gap: 10,
  },
  heroLabel: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ffffff',
  },
  heroLabelText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  heroBody: {
    color: '#3f3726',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
  },
  heroStickerBoard: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stickerStat: {
    minWidth: 106,
    flex: 1,
    borderRadius: 22,
    padding: 14,
    gap: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  stickerIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerValue: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
  },
  stickerLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  pathSection: {
    gap: 12,
  },
  sectionHeadingRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  softBadge: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  softBadgeText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  pathTrack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pathStepWrap: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pathStep: {
    minHeight: 72,
    flex: 1,
    borderRadius: 21,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
  },
  pathStepIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathStepText: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  pathConnector: {
    width: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  classSection: {
    gap: 12,
  },
  classListPanel: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  classListStack: {
    gap: 9,
  },
  classListItem: {
    minHeight: 66,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e1e9e3',
  },
  classListIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  classListTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
  },
  classListMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  classListButton: {
    minHeight: 34,
    borderRadius: 14,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  classListButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  iconAction: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  classCard: {
    minWidth: 245,
    flex: 1,
    borderRadius: 24,
    padding: 15,
    gap: 10,
    borderWidth: 2,
  },
  classCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  classSticker: {
    overflow: 'hidden',
    width: 58,
    height: 58,
    borderRadius: 20,
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
    fontSize: 16,
    fontWeight: '900',
  },
  classTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  classMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  subjectPills: {
    minHeight: 30,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subjectPill: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(24, 36, 33, 0.08)',
  },
  subjectPillText: {
    color: colors.tealDark,
    fontSize: 11,
    fontWeight: '900',
  },
  enterButton: {
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.ink,
  },
  requestButton: {
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.tealDark,
  },
  enterButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  pendingButton: {
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  pendingButtonText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  statusPill: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
  },
  statusPillActive: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.tealDark,
  },
  statusPillText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  statusPillTextActive: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyClassState: {
    minHeight: 110,
    flex: 1,
    minWidth: 260,
    borderRadius: 24,
    padding: 16,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toolCard: {
    minWidth: 150,
    flex: 1,
    borderRadius: 22,
    padding: 14,
    gap: 8,
    borderWidth: 2,
  },
  toolIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  toolBody: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  libraryHeader: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  successText: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '900',
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
});
