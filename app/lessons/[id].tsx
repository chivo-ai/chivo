import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';

import { LessonReaderScreen } from '../../src/features/lessons/LessonReaderScreen';
import { BootScreen } from '../../src/features/app/BootScreen';
import { RouteScreen } from '../../src/features/app/RouteScreen';
import { useAppSession } from '../../src/features/app/AppSessionProvider';
import { SchoolSetupState, fetchSchoolSetupState } from '../../src/services/school';
import { colors } from '../../src/theme/tokens';

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

export default function LessonDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lessonId = Array.isArray(id) ? id[0] : id;
  const { loading, activeMembership } = useAppSession();
  const [setup, setSetup] = useState<SchoolSetupState>(emptySetup);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load lesson.'))
      .finally(() => setLoadingSetup(false));
  }, [activeMembership, loadSetup]);

  if (loading || loadingSetup) {
    return <BootScreen text="Opening lesson" />;
  }

  if (!activeMembership || !lessonId) {
    return <Redirect href="/home" />;
  }

  return (
    <RouteScreen>
      {error ? <Text style={{ color: colors.coral, fontWeight: '700' }}>{error}</Text> : null}
      <LessonReaderScreen
        lessonId={lessonId}
        membership={activeMembership}
        setup={setup}
      />
    </RouteScreen>
  );
}
