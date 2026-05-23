import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors } from '../../theme/tokens';

export function RouteScreen({ children }: { children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.shell}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 92,
    backgroundColor: colors.canvas,
  },
  shell: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
  },
});
