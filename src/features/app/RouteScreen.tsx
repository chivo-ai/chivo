import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { UniversalTopBar, useTopBarProvided } from '../../components/UniversalTopBar';
import { chivoTheme, colors } from '../../theme/tokens';

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
    backgroundColor: colors.surfaceSoft,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: chivoTheme.pagePadding,
    paddingTop: 8,
    paddingBottom: 58,
    backgroundColor: colors.surfaceSoft,
  },
  shell: {
    width: '100%',
    maxWidth: chivoTheme.pageMaxWidth,
    alignSelf: 'center',
  },
});
