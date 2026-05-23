import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/tokens';

export function BootScreen({ text = 'Opening Chivo AI' }: { text?: string }) {
  return (
    <View style={styles.bootScreen}>
      <ActivityIndicator color={colors.tealDark} />
      <Text style={styles.bootText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.canvas,
  },
  bootText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '800',
  },
});
