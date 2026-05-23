import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { SchoolWorkspaceScreen } from '../../../src/features/school/SchoolWorkspaceScreen';
import { BootScreen } from '../../../src/features/shell/BootScreen';
import { useAppSession } from '../../../src/features/shell/AppSessionProvider';

export default function MySchoolRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, activeMembership, openMembershipBySchoolId, setActiveMembership } = useAppSession();
  const [opening, setOpening] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id || activeMembership?.schoolId === id) {
      setOpening(false);
      return;
    }

    let alive = true;
    setOpening(true);
    openMembershipBySchoolId(id)
      .then((membership) => {
        if (alive && !membership) {
          setNotFound(true);
        }
      })
      .finally(() => {
        if (alive) {
          setOpening(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [activeMembership?.schoolId, id, openMembershipBySchoolId]);

  if (loading || opening) {
    return <BootScreen />;
  }

  if (notFound || !activeMembership) {
    return <Redirect href="/home" />;
  }

  return (
    <SchoolWorkspaceScreen
      membership={activeMembership}
      onSwitchSchool={async () => {
        await setActiveMembership(null);
        router.replace('/home');
      }}
    />
  );
}
