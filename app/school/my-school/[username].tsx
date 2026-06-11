import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { SchoolWorkspaceScreen } from '../../../src/features/school/SchoolWorkspaceScreen';
import { BootScreen } from '../../../src/features/app/BootScreen';
import { useAppSession } from '../../../src/features/app/AppSessionProvider';

export default function MySchoolRoute() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const schoolUsername = Array.isArray(username) ? username[0] : username;
  const { loading, activeMembership, openMembershipBySchoolUsername, setActiveMembership } = useAppSession();
  const [opening, setOpening] = useState(Boolean(schoolUsername));
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!schoolUsername || activeMembership?.school.slug === schoolUsername) {
      setOpening(false);
      return;
    }

    let alive = true;
    setOpening(true);
    setNotFound(false);
    openMembershipBySchoolUsername(schoolUsername)
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
  }, [activeMembership?.school.slug, openMembershipBySchoolUsername, schoolUsername]);

  if (loading || opening) {
    return <BootScreen />;
  }

  if (notFound || !activeMembership) {
    return <Redirect href="/discover" />;
  }

  return (
    <SchoolWorkspaceScreen
      membership={activeMembership}
      onSwitchSchool={async () => {
        await setActiveMembership(null);
        router.replace('/discover');
      }}
    />
  );
}
