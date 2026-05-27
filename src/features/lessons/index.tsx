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
          <Text style={styles.heroTitle} numberOfLines={1}>Study library</Text>
          <Text style={styles.heroMeta} numberOfLines={2}>Open class lessons with audio, transcript, quiz, cards, and translation.</Text>
        </View>
        <View style={styles.statRail}>
          <MiniStat icon={<Headphones size={15} color={colors.brandDeep} />} label="Classes" value={visibleClassCount} />
          <MiniStat icon={<Brain size={15} color={colors.brandDeep} />} label="Subjects" value={setup.subjects.length} />
          <MiniStat icon={<Layers size={15} color={colors.brandDeep} />} label="Mode" value={mode === 'teach' ? 'Teach' : 'Learn'} />
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
    gap: 12,
  },
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    borderRadius: 8,
    padding: 16,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  flexText: {
    flex: 1,
    minWidth: 240,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  heroMeta: {
    color: '#d8e0ef',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  statRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
});
