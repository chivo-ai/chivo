import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { colors } from '../../theme/tokens';

export function BootScreen({ text = 'Opening Chivo AI' }: { text?: string }) {
  return (
    <View style={styles.bootScreen}>
      <View style={styles.bootMark}>
        <Sparkles size={26} color="#ffffff" />
      </View>
      <View style={styles.bootPanel}>
        <ActivityIndicator color={colors.brandGlow} />
        <Text style={styles.bootText} numberOfLines={1}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: colors.brandDeep,
  },
  bootMark: {
    width: 58,
    height: 58,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.34)',
  },
  bootPanel: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  bootText: {
    color: '#d8e0ef',
    fontSize: 14,
    fontWeight: '800',
  },
});
