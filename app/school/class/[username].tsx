import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';

import { SchoolClassRouteScreen } from '../../../src/features/school/class/ClassRouteScreen';
import { BootScreen } from '../../../src/features/app/BootScreen';
import { RouteScreen } from '../../../src/features/app/RouteScreen';
import { useAppSession } from '../../../src/features/app/AppSessionProvider';
import { SchoolSetupState, fetchSchoolSetupState } from '../../../src/services/school';
import { colors } from '../../../src/theme/tokens';

const emptySetup: SchoolSetupState = {
  academicYears: [],
  academicTerms: [],
  subjects: [],
  classes: [],
  members: [],
  classMemberships: [],
  classSubjects: [],
  invites: [],
  joinRequests: [],
};

export default function ClassRoute() {
  const { username, panel, setup: setupTarget } = useLocalSearchParams<{
    username: string;
    panel?: string;
    setup?: string;
  }>();
  const classUsername = Array.isArray(username) ? username[0] : username;
  const panelParam = Array.isArray(panel) ? panel[0] : panel;
  const setupParam = Array.isArray(setupTarget) ? setupTarget[0] : setupTarget;
  const { loading, activeMembership } = useAppSession();
  const [setup, setSetup] = useState<SchoolSetupState>(emptySetup);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isStaff = activeMembership
    ? ['owner', 'admin', 'teacher'].includes(activeMembership.role)
    : false;
  const isAdmin = activeMembership ? ['owner', 'admin'].includes(activeMembership.role) : false;

  const loadSetup = useCallback(async () => {
    if (!activeMembership) {
      return;
    }

    setError(null);
    const nextSetup = await fetchSchoolSetupState(activeMembership.schoolId, isAdmin);
    setSetup(nextSetup);
  }, [activeMembership, isAdmin]);

  useEffect(() => {
    if (!activeMembership) {
      setLoadingSetup(false);
      return;
    }

    setLoadingSetup(true);
    loadSetup()
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load class.'))
      .finally(() => setLoadingSetup(false));
  }, [activeMembership, loadSetup]);

  if (loading || loadingSetup) {
    return <BootScreen text="Opening class" />;
  }

  if (!activeMembership || !classUsername) {
    return <Redirect href="/home" />;
  }

  const schoolClass = setup.classes.find((item) => item.username === classUsername);

  if (!schoolClass) {
    return <Redirect href="/school/class" />;
  }

  return (
    <RouteScreen>
      {error ? <Text style={{ color: colors.coral, fontWeight: '700' }}>{error}</Text> : null}
      <SchoolClassRouteScreen
        classId={schoolClass.id}
        membership={activeMembership}
        setup={setup}
        mode={isStaff ? 'teach' : 'learn'}
        initialPanel={panelParam === 'studio' || panelParam === 'library' || panelParam === 'people' || panelParam === 'tools' ? panelParam : undefined}
        openSubjectSetup={setupParam === 'subject'}
        onWorkspaceChanged={loadSetup}
      />
    </RouteScreen>
  );
}
