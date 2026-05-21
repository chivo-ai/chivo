import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { AuthScreen } from './src/features/auth/AuthScreen';
import { SchoolAccessScreen } from './src/features/onboarding/SchoolAccessScreen';
import { SchoolWorkspaceScreen } from './src/features/school/SchoolWorkspaceScreen';
import { useAuthSession } from './src/hooks/useAuthSession';
import { colors } from './src/theme/tokens';
import { ActiveSchoolMembership } from './src/types';

export default function App() {
  const { configured, loading, user } = useAuthSession();
  const [activeMembership, setActiveMembership] = useState<ActiveSchoolMembership | null>(null);

  useEffect(() => {
    if (!user) {
      setActiveMembership(null);
    }
  }, [user]);

  if (loading) {
    return <BootScreen />;
  }

  return (
    <>
      <StatusBar style="dark" />
      {configured && user && activeMembership ? (
        <SchoolWorkspaceScreen
          membership={activeMembership}
          onSwitchSchool={() => setActiveMembership(null)}
        />
      ) : configured && user ? (
        <SchoolAccessScreen user={user} onEnterSchool={setActiveMembership} />
      ) : (
        <AuthScreen />
      )}
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
