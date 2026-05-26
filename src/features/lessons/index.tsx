import { BookOpen, Brain, Headphones, Layers } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { ChivoCard, ChivoMetric } from '../../components/chivo/ChivoUI';
import { LessonWorkspace } from './LessonWorkspace';
import { SchoolSetupState } from '../../services/school';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership } from '../../types';

type LessonsRouteScreenProps = {
  membership: ActiveSchoolMembership;
  setup: SchoolSetupState;
  mode: 'learn' | 'teach';
  initialClassId?: string | null;
  initialLessonId?: string | null;
  onWorkspaceChanged: () => void | Promise<void>;
};

export function LessonsRouteScreen({
  membership,
  setup,
  mode,
  initialClassId,
  initialLessonId,
  onWorkspaceChanged,
}: LessonsRouteScreenProps) {
  const joinedClassIds = new Set(
    setup.classMemberships
      .filter((item) => item.school_membership_id === membership.id && item.status === 'active')
      .map((item) => item.class_id)
  );
  const visibleClassCount = ['owner', 'admin', 'teacher'].includes(membership.role)
    ? setup.classes.length
    : setup.classes.filter((schoolClass) => joinedClassIds.has(schoolClass.id)).length;

  return (
    <View style={styles.stack}>
      <ChivoCard tone="night" compact style={styles.hero}>
        <View style={styles.heroIcon}>
          <BookOpen size={19} color="#ffffff" />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.heroTitle}>Study library</Text>
          <Text style={styles.heroMeta}>Open class lessons with audio, transcript, quiz, cards, and translation.</Text>
        </View>
        <View style={styles.statRail}>
          <MiniStat icon={<Headphones size={15} color={colors.tealDark} />} label="Classes" value={visibleClassCount} />
          <MiniStat icon={<Brain size={15} color={colors.tealDark} />} label="Subjects" value={setup.subjects.length} />
          <MiniStat icon={<Layers size={15} color={colors.tealDark} />} label="Mode" value={mode === 'teach' ? 'Teach' : 'Learn'} />
        </View>
      </ChivoCard>

      <LessonWorkspace
        membership={membership}
        setup={setup}
        mode={mode}
        initialClassId={initialClassId}
        initialLessonId={initialLessonId}
        onLessonsChanged={onWorkspaceChanged}
      />
    </View>
  );
}

export default LessonsRouteScreen;

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return <ChivoMetric icon={icon} label={label} value={value} tone="surface" />;
}

const styles = StyleSheet.create({
  stack: {
    gap: 8,
  },
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 9,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  flexText: {
    flex: 1,
    minWidth: 190,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  heroMeta: {
    color: '#dce7e1',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  statRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
});
