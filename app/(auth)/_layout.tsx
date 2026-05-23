import { Redirect, Stack } from 'expo-router';

import { BootScreen } from '../../src/features/shell/BootScreen';
import { useAppSession } from '../../src/features/shell/AppSessionProvider';

export default function AuthLayout() {
  const { loading, user } = useAppSession();

  if (loading) {
    return <BootScreen />;
  }

  if (user) {
    return <Redirect href="/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
