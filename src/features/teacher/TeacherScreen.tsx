import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, DoorOpen, GraduationCap, Layers, Settings2, Sparkles, Users } from 'lucide-react-native';

import { ChivoAction, ChivoCard, ChivoMetric } from '../../components/chivo/ChivoUI';
import { ClassRow, SchoolSetupState } from '../../services/school';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership } from '../../types';

type TeacherScreenProps = {
  membership: ActiveSchoolMembership;
  setup: SchoolSetupState;
  onWorkspaceChanged: () => void | Promise<void>;
};

export function TeacherScreen({ membership, setup }: TeacherScreenProps) {
  const canManageAll = membership.role === 'owner' || membership.role === 'admin';
  const manageableClasses = classesForTeacher(setup, membership.id, canManageAll);
  const totalStudents = setup.classMemberships.filter((item) => item.status === 'active').length;
  const totalSubjects = setup.subjects.length;

  return (
    <View style={styles.stack}>
      <ChivoCard compact style={styles.launchPanel}>
        <View style={styles.launchIcon}>
          <GraduationCap size={20} color="#ffffff" />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.launchTitle}>Teacher launchpad</Text>
          <Text style={styles.launchMeta}>Open a class studio to record lessons, manage students, publish, and use class tools.</Text>
        </View>
        <ChivoAction
          compact
          variant="ghost"
          label="All classes"
          icon={<DoorOpen size={15} color={colors.tealDark} />}
          onPress={() => router.push('/school/class' as never)}
        />
      </ChivoCard>

      <View style={styles.statGrid}>
        <TeacherStat icon={<BookOpen size={17} color={colors.tealDark} />} label="Classes" value={manageableClasses.length} />
        <TeacherStat icon={<Layers size={17} color={colors.tealDark} />} label="Subjects" value={totalSubjects} />
        <TeacherStat icon={<Users size={17} color={colors.tealDark} />} label="Seats" value={totalStudents} />
      </View>

      <View style={styles.classGrid}>
        {manageableClasses.length ? manageableClasses.map((schoolClass, index) => (
          <TeacherClassCard
            key={schoolClass.id}
            schoolClass={schoolClass}
            index={index}
            subjectCount={setup.classSubjects.filter((item) => item.class_id === schoolClass.id).length}
            memberCount={setup.classMemberships.filter((item) => item.class_id === schoolClass.id && item.status === 'active').length}
          />
        )) : (
          <ChivoCard compact style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No teaching classes yet</Text>
            <Text style={styles.emptyMeta}>An admin can assign you to a class, or you can create one from school setup.</Text>
          </ChivoCard>
        )}
      </View>
    </View>
  );
}

function TeacherStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <ChivoMetric icon={icon} label={label} value={value} tone="surface" />;
}

function TeacherClassCard({
  schoolClass,
  index,
  subjectCount,
  memberCount,
}: {
  schoolClass: ClassRow;
  index: number;
  subjectCount: number;
  memberCount: number;
}) {
  const tone = cardTones[index % cardTones.length];

  return (
    <View style={[styles.classCard, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <View style={styles.classHeader}>
        <View style={[styles.classMark, { backgroundColor: tone.accent }]}>
          <Text style={styles.classMarkText}>{initials(schoolClass.name)}</Text>
        </View>
        <View style={styles.flexText}>
          <Text style={styles.classTitle}>{schoolClass.name}</Text>
          <Text style={styles.classMeta}>{schoolClass.grade_level ?? schoolClass.username}</Text>
        </View>
        <View style={styles.classBadge}>
          <Sparkles size={13} color={colors.ink} />
          <Text style={styles.classBadgeText}>Studio</Text>
        </View>
      </View>

      <View style={styles.miniStats}>
        <Text style={styles.miniStat}>{subjectCount} subjects</Text>
        <Text style={styles.miniStat}>{memberCount} students</Text>
      </View>

      <Pressable onPress={() => router.push(`/school/class/${schoolClass.username}` as never)} style={styles.openButton}>
        <Settings2 size={15} color="#ffffff" />
        <Text style={styles.openButtonText}>Open class studio</Text>
      </Pressable>
    </View>
  );
}

function classesForTeacher(setup: SchoolSetupState, membershipId: string, canManageAll: boolean) {
  if (canManageAll) {
    return setup.classes;
  }

  const classIds = new Set<string>();

  setup.classSubjects
    .filter((item) => item.teacher_membership_id === membershipId)
    .forEach((item) => classIds.add(item.class_id));

  setup.classMemberships
    .filter((item) => item.school_membership_id === membershipId && item.status === 'active' && ['owner', 'admin', 'teacher'].includes(item.role))
    .forEach((item) => classIds.add(item.class_id));

  return setup.classes.filter((schoolClass) => classIds.has(schoolClass.id));
}

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CH';
}

const cardTones = [
  { background: '#fff4d4', accent: colors.gold },
  { background: '#e9f6ff', accent: '#4aa6d9' },
  { background: '#f3eaff', accent: '#8d68d8' },
  { background: '#e8f8ee', accent: '#39a96b' },
];

const styles = StyleSheet.create({
  stack: {
    gap: 8,
  },
  launchPanel: {
    borderRadius: 15,
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  launchIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  launchTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  launchMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  launchAction: {
    minHeight: 34,
    borderRadius: 13,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  launchActionText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '700',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    minWidth: 106,
    flex: 1,
    borderRadius: 14,
    padding: 9,
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  statValue: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  classCard: {
    minWidth: 230,
    flex: 1,
    borderRadius: 16,
    padding: 10,
    gap: 9,
    borderWidth: 1,
  },
  classHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  classMark: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classMarkText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  classTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  classMeta: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  classBadge: {
    minHeight: 28,
    borderRadius: 13,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
  },
  classBadgeText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  miniStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniStat: {
    overflow: 'hidden',
    borderRadius: 11,
    paddingHorizontal: 7,
    paddingVertical: 4,
    color: colors.tealDark,
    backgroundColor: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '700',
  },
  openButton: {
    minHeight: 38,
    borderRadius: 13,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.tealDark,
  },
  openButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyPanel: {
    flex: 1,
    borderRadius: 15,
    padding: 12,
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
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
