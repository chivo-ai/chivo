import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, BookOpen } from 'lucide-react-native';

import { LessonRow } from '../../services/lessons';
import { colors } from '../../theme/tokens';

type LessonRouteScreenProps = {
  lesson: LessonRow;
  subjectName: string;
  children: ReactNode;
  onBack: () => void;
};

export function LessonRouteScreen({
  lesson,
  subjectName,
  children,
  onBack,
}: LessonRouteScreenProps) {
  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={18} color={colors.tealDark} />
          <Text style={styles.backButtonText}>Lessons</Text>
        </Pressable>
        <View style={styles.icon}>
          <BookOpen size={20} color="#ffffff" />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.title}>{lesson.title}</Text>
          <Text style={styles.meta}>{subjectName}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

export default LessonRouteScreen;

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  header: {
    minHeight: 76,
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  backButton: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.softTeal,
  },
  backButtonText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
});
