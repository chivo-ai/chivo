import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { UniversalTopBar, useTopBarProvided } from '../../components/UniversalTopBar';
import { chivoTheme, colors } from '../../theme/tokens';

export function RouteScreen({ children }: { children: ReactNode }) {
  const topBarProvided = useTopBarProvided();

  return (
    <View style={styles.screen}>
      <LinearGradient
        pointerEvents="none"
        colors={['#fbfcff', colors.surfaceSoft, '#e9eef7']}
        locations={[0, 0.48, 1]}
        style={styles.backdrop}
      />
      <View pointerEvents="none" style={styles.signalBand} />
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  signalBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 96,
    backgroundColor: colors.brandDeep,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 230, 255, 0.22)',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: chivoTheme.pagePadding,
    paddingTop: 14,
    paddingBottom: chivoTheme.mobileBottomNavHeight + 34,
  },
  shell: {
    width: '100%',
    maxWidth: chivoTheme.pageMaxWidth,
    alignSelf: 'center',
  },
});
