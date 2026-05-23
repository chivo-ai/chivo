import { StyleSheet, Text, View } from 'react-native';
import { BookOpen } from 'lucide-react-native';

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

export function SchoolClassRouteScreen({
  classId,
  membership,
  setup,
  mode,
  onWorkspaceChanged,
}: SchoolClassRouteScreenProps) {
  const schoolClass = setup.classes.find((item) => item.id === classId);

  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <BookOpen size={22} color="#ffffff" />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.title}>{schoolClass?.name ?? 'Class'}</Text>
          <Text style={styles.meta}>{schoolClass?.grade_level ?? 'Grade not set'}</Text>
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

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  header: {
    minHeight: 76,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.ink,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  meta: {
    color: '#dce7e1',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
});
