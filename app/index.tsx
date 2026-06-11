import { Redirect } from 'expo-router';

import { BootScreen } from '../src/features/app/BootScreen';
import { useAppSession } from '../src/features/app/AppSessionProvider';

export default function IndexRoute() {
  const { configured, loading, user } = useAppSession();

  if (loading) {
    return <BootScreen />;
  }

  if (!configured || !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/discover" />;
}
