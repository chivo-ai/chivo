import { Image, StyleSheet, Text, View } from 'react-native';
import { BookOpen, Brain, Headphones, Layers, Sparkles, Users } from 'lucide-react-native';

import { LessonWorkspace } from '../../lessons/LessonWorkspace';
import { SchoolSetupState } from '../../../services/school';
import { colors } from '../../../theme/tokens';
import { ActiveSchoolMembership } from '../../../types';

type SchoolClassRouteScreenProps = {
  classId: string;
  membership: ActiveSchoolMembership;
  setup: SchoolSetupState;
  mode: 'learn' | 'teach';
  onWorkspaceChanged: () => void | Promise<void>;
};

const tones = [
  { background: '#fff4d4', accent: colors.gold },
  { background: '#e9f6ff', accent: '#4aa6d9' },
  { background: '#f3eaff', accent: '#8d68d8' },
  { background: '#e8f8ee', accent: '#39a96b' },
];

export function SchoolClassRouteScreen({
  classId,
  membership,
  setup,
  mode,
  onWorkspaceChanged,
}: SchoolClassRouteScreenProps) {
  const schoolClass = setup.classes.find((item) => item.id === classId);
  const classIndex = Math.max(setup.classes.findIndex((item) => item.id === classId), 0);
  const tone = tones[classIndex % tones.length];
  const classSubjects = setup.classSubjects.filter((link) => link.class_id === classId);
  const subjectNames = classSubjects
    .map((link) => setup.subjects.find((subject) => subject.id === link.subject_id)?.name)
    .filter(Boolean) as string[];
  const classMemberCount = setup.classMemberships.filter((item) => item.class_id === classId && item.status === 'active').length;

  return (
    <View style={styles.stack}>
      <View style={[styles.hero, { backgroundColor: tone.background, borderColor: tone.accent }]}>
        <View style={[styles.banner, { backgroundColor: tone.accent }]}>
          {schoolClass?.banner_url ? <Image source={{ uri: schoolClass.banner_url }} style={styles.bannerImage} /> : null}
        </View>

        <View style={styles.heroBody}>
          <View style={[styles.classMark, { backgroundColor: tone.accent }]}>
            {schoolClass?.logo_url ? (
              <Image source={{ uri: schoolClass.logo_url }} style={styles.markImage} />
            ) : (
              <Text style={styles.markText}>{initials(schoolClass?.name ?? 'Class')}</Text>
            )}
          </View>

          <View style={styles.flexText}>
            <View style={styles.heroPill}>
              <Sparkles size={14} color={colors.ink} />
              <Text style={styles.heroPillText}>{mode === 'teach' ? 'Teaching room' : 'Learning room'}</Text>
            </View>
            <Text style={styles.title}>{schoolClass?.name ?? 'Class'}</Text>
            <Text style={styles.meta}>{schoolClass?.grade_level ?? 'Learning group'} - {membership.school.name}</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickGrid}>
        <RoomStat icon={<BookOpen size={19} color={colors.ink} />} label="Subjects" value={subjectNames.length} tone={tones[0]} />
        <RoomStat icon={<Users size={19} color={colors.ink} />} label="Members" value={classMemberCount} tone={tones[3]} />
        <RoomStat icon={<Headphones size={19} color={colors.ink} />} label="Audio" value={1} tone={tones[1]} />
        <RoomStat icon={<Brain size={19} color={colors.ink} />} label="Quiz" value={1} tone={tones[2]} />
      </View>

      <View style={styles.subjectPanel}>
        <View style={styles.panelTitleRow}>
          <Layers size={20} color={colors.coral} />
          <Text style={styles.panelTitle}>Study lanes</Text>
        </View>
        <View style={styles.subjectWrap}>
          {subjectNames.length ? subjectNames.map((subject) => (
            <View key={subject} style={styles.subjectPill}>
              <Text style={styles.subjectText}>{subject}</Text>
            </View>
          )) : (
            <Text style={styles.emptyText}>Subjects will appear after this class is assigned.</Text>
          )}
        </View>
      </View>

      <LessonWorkspace
        membership={membership}
        setup={setup}
        onLessonsChanged={onWorkspaceChanged}
        mode={mode}
        initialClassId={classId}
      />
    </View>
  );
}

export default SchoolClassRouteScreen;

function RoomStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: { background: string; accent: string };
}) {
  return (
    <View style={[styles.roomStat, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <View style={[styles.roomStatIcon, { backgroundColor: tone.accent }]}>{icon}</View>
      <Text style={styles.roomStatValue}>{value}</Text>
      <Text style={styles.roomStatLabel}>{label}</Text>
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
    gap: 16,
  },
  hero: {
    overflow: 'hidden',
    borderRadius: 30,
    borderWidth: 2,
  },
  banner: {
    height: 112,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  heroBody: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  classMark: {
    overflow: 'hidden',
    width: 76,
    height: 76,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  markImage: {
    width: '100%',
    height: '100%',
  },
  markText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  heroPill: {
    alignSelf: 'flex-start',
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
  },
  heroPillText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roomStat: {
    minWidth: 130,
    flex: 1,
    borderRadius: 22,
    padding: 13,
    gap: 6,
    borderWidth: 2,
  },
  roomStatIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomStatValue: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  roomStatLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  subjectPanel: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  panelTitleRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  subjectWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectPill: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  subjectText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
});
