import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppSessionProvider } from '../src/features/app/AppSessionProvider';

export default function RootLayout() {
  return (
    <AppSessionProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </AppSessionProvider>
  );
}
