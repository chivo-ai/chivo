import { Redirect, router } from 'expo-router';

import { SchoolWorkspaceScreen } from '../school/SchoolWorkspaceScreen';
import { BootScreen } from './BootScreen';
import { useAppSession } from './AppSessionProvider';

type SchoolWorkspaceRouteProps = {
  surface: 'learn' | 'teach';
};

export function SchoolWorkspaceRoute({ surface }: SchoolWorkspaceRouteProps) {
  const { loading, activeMembership, setActiveMembership } = useAppSession();

  if (loading) {
    return <BootScreen />;
  }

  if (!activeMembership) {
    return <Redirect href="/discover" />;
  }

  return (
    <SchoolWorkspaceScreen
      membership={activeMembership}
      initialSurface={surface}
      onSwitchSchool={async () => {
        await setActiveMembership(null);
        router.replace('/discover');
      }}
    />
  );
}
