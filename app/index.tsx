import { Redirect } from 'expo-router';

import { BootScreen } from '../src/features/shell/BootScreen';
import { useAppSession } from '../src/features/shell/AppSessionProvider';

export default function IndexRoute() {
  const { configured, loading, user } = useAppSession();

  if (loading) {
    return <BootScreen />;
  }

  if (!configured || !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/home" />;
}
