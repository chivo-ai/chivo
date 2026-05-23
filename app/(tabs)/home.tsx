import { router } from 'expo-router';
import { Text } from 'react-native';

import { AccessHomeScreen } from '../../src/features/onboarding/screens/AccessHomeScreen';
import { useAccessMemberships } from '../../src/features/onboarding/useAccessMemberships';
import { RouteScreen } from '../../src/features/shell/RouteScreen';
import { useAppSession } from '../../src/features/shell/AppSessionProvider';

export default function HomeTabRoute() {
  const { user, setActiveMembership } = useAppSession();
  const { activeMemberships, pendingMemberships, loading, error } = useAccessMemberships(user);

  if (!user) {
    return null;
  }

  return (
    <RouteScreen>
      {error ? <Text>{error}</Text> : null}
      <AccessHomeScreen
        user={user}
        activeMemberships={activeMemberships}
        pendingMemberships={pendingMemberships}
        loading={loading}
        onEnterSchool={async (membership) => {
          await setActiveMembership(membership);
          router.push('/learn');
        }}
        onRequestAccess={() => router.push('/request')}
        onOpenCrews={() => router.push('/crews')}
      />
    </RouteScreen>
  );
}
