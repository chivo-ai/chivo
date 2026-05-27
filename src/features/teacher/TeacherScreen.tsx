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
          <Text style={styles.launchTitle} numberOfLines={1}>Teacher launchpad</Text>
          <Text style={styles.launchMeta} numberOfLines={2}>Open a class studio to record lessons, manage students, publish, and use class tools.</Text>
        </View>
        <ChivoAction
          compact
          variant="ghost"
          label="All classes"
          icon={<DoorOpen size={15} color={colors.brandDeep} />}
          onPress={() => router.push('/school/class' as never)}
        />
      </ChivoCard>

      <View style={styles.statGrid}>
        <TeacherStat icon={<BookOpen size={17} color={colors.brandDeep} />} label="Classes" value={manageableClasses.length} />
        <TeacherStat icon={<Layers size={17} color={colors.brandDeep} />} label="Subjects" value={totalSubjects} />
        <TeacherStat icon={<Users size={17} color={colors.brandDeep} />} label="Seats" value={totalStudents} />
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
            <Text style={styles.emptyTitle} numberOfLines={1}>No teaching classes yet</Text>
            <Text style={styles.emptyMeta} numberOfLines={2}>An admin can assign you to a class, or you can create one from school setup.</Text>
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
          <Text style={styles.classTitle} numberOfLines={1}>{schoolClass.name}</Text>
          <Text style={styles.classMeta} numberOfLines={1}>{schoolClass.grade_level ?? schoolClass.username}</Text>
        </View>
        <View style={styles.classBadge}>
          <Sparkles size={13} color={colors.ink} />
          <Text style={styles.classBadgeText} numberOfLines={1}>Studio</Text>
        </View>
      </View>

      <View style={styles.miniStats}>
        <Text style={styles.miniStat} numberOfLines={1}>{subjectCount} subjects</Text>
        <Text style={styles.miniStat} numberOfLines={1}>{memberCount} students</Text>
      </View>

      <Pressable onPress={() => router.push(`/school/class/${schoolClass.username}` as never)} style={styles.openButton}>
        <Settings2 size={15} color="#ffffff" />
          <Text style={styles.openButtonText} numberOfLines={1}>Open class studio</Text>
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
  { background: '#e9f1ff', accent: colors.brand },
  { background: '#e3fbf7', accent: colors.teal },
  { background: '#f3efff', accent: colors.violet },
  { background: '#f1ffd7', accent: '#a3e635' },
];

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  launchPanel: {
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  launchIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  launchTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  launchMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  launchAction: {
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
  launchActionText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    minWidth: 106,
    flex: 1,
    borderRadius: 8,
    padding: 9,
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
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
    gap: 11,
  },
  classCard: {
    minWidth: 250,
    flex: 1,
    borderRadius: 8,
    padding: 14,
    gap: 11,
    borderWidth: 1,
    borderBottomWidth: 4,
  },
  classHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  classMark: {
    width: 42,
    height: 42,
    borderRadius: 8,
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
  classBadge: {
    minHeight: 28,
    borderRadius: 8,
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
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    color: colors.brandDeep,
    backgroundColor: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '700',
  },
  openButton: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.brand,
  },
  openButtonText: {
    color: '#ffffff',
    fontSize: 12,
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
