import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { UniversalTopBar, useTopBarProvided } from '../../components/UniversalTopBar';
import { colors } from '../../theme/tokens';

export function RouteScreen({ children }: { children: ReactNode }) {
  const topBarProvided = useTopBarProvided();

  return (
    <View style={styles.screen}>
      {topBarProvided ? null : <UniversalTopBar />}
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.shell}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 64,
    backgroundColor: colors.canvas,
  },
  shell: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
  },
});
