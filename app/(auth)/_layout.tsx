import { Redirect, Stack } from 'expo-router';

import { BootScreen } from '../../src/features/app/BootScreen';
import { useAppSession } from '../../src/features/app/AppSessionProvider';

export default function AuthLayout() {
  const { loading, user } = useAppSession();

  if (loading) {
    return <BootScreen />;
  }

  if (user) {
    return <Redirect href="/discover" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
