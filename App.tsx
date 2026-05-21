import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AuthScreen } from './src/features/auth/AuthScreen';
import { SchoolAccessScreen } from './src/features/onboarding/SchoolAccessScreen';
import { useAuthSession } from './src/hooks/useAuthSession';
import { colors } from './src/theme/tokens';

export default function App() {
  const { configured, loading, user } = useAuthSession();

  if (loading) {
    return <BootScreen />;
  }

  return (
    <>
      <StatusBar style="dark" />
      {configured && user ? <SchoolAccessScreen user={user} /> : <AuthScreen />}
    </>
  );
}

function BootScreen() {
  return (
    <View style={styles.bootScreen}>
      <ActivityIndicator color={colors.tealDark} />
      <Text style={styles.bootText}>Opening Chivo AI</Text>
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
