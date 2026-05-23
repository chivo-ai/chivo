import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, DoorOpen } from 'lucide-react-native';

import { RouteScreen } from '../../../src/features/app/RouteScreen';
import { useAppSession } from '../../../src/features/app/AppSessionProvider';
import { SchoolSetupState, fetchSchoolSetupState } from '../../../src/services/school';
import { Card, CardHeader, ScreenHeader, ScreenShell } from '../../../src/features/onboarding/accessUi';
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

export default function ClassesIndexRoute() {
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
    setSetup(await fetchSchoolSetupState(activeMembership.schoolId, isAdmin));
  }, [activeMembership, isAdmin]);

  useEffect(() => {
    if (!activeMembership) {
      setLoadingSetup(false);
      return;
    }

    setLoadingSetup(true);
    loadSetup()
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load classes.'))
      .finally(() => setLoadingSetup(false));
  }, [activeMembership, loadSetup]);

  if (loading) {
    return null;
  }

  if (!activeMembership) {
    return <Redirect href="/school/my-school" />;
  }

  return (
    <RouteScreen>
      <ScreenShell>
        <ScreenHeader
          icon={<DoorOpen size={25} color="#ffffff" />}
          title="Classes"
          body="Open a class inside the active school."
        />
        <Card>
          <CardHeader icon={<BookOpen size={20} color={colors.blue} />} title={activeMembership.school.name} />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {loadingSetup ? (
            <ActivityIndicator color={colors.tealDark} />
          ) : setup.classes.length ? (
            <View style={styles.list}>
              {setup.classes.map((schoolClass) => (
                <Pressable
                  key={schoolClass.id}
                  onPress={() => router.push(`/school/class/${schoolClass.username}` as never)}
                  style={styles.classRow}
                >
                  <View style={styles.classIcon}>
                    <BookOpen size={19} color={colors.tealDark} />
                  </View>
                  <View style={styles.flexText}>
                    <Text style={styles.className}>{schoolClass.name}</Text>
                    <Text style={styles.classMeta}>
                      {schoolClass.username} - {schoolClass.grade_level ?? 'Grade not set'}
                    </Text>
                  </View>
                  <Text style={styles.enterText}>Enter</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Classes will appear after the school creates them.</Text>
          )}
        </Card>
      </ScreenShell>
    </RouteScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  classRow: {
    minHeight: 68,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  classIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  className: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
  },
  classMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  enterText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
});
