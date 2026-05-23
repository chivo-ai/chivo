import { Redirect, router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Building2, School } from 'lucide-react-native';

import { RouteScreen } from '../../../src/features/app/RouteScreen';
import { useAppSession } from '../../../src/features/app/AppSessionProvider';
import { useAccessMemberships } from '../../../src/features/onboarding/useAccessMemberships';
import { mapMembershipRow } from '../../../src/features/onboarding/accessTypes';
import { BannerStrip, Card, CardHeader, IdentityMark, ScreenHeader, ScreenShell } from '../../../src/features/onboarding/accessUi';
import { colors } from '../../../src/theme/tokens';

export default function MySchoolsIndexRoute() {
  const { user, loading: sessionLoading, setActiveMembership } = useAppSession();
  const { activeMemberships, loading, error } = useAccessMemberships(user);

  if (sessionLoading) {
    return null;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <RouteScreen>
      <ScreenShell>
        <ScreenHeader
          icon={<School size={25} color="#ffffff" />}
          title="My schools"
          body="Open a school workspace by its username."
        />
        <Card>
          <CardHeader icon={<Building2 size={20} color={colors.teal} />} title="Schools" />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {loading ? (
            <ActivityIndicator color={colors.tealDark} />
          ) : activeMemberships.length ? (
            <View style={styles.list}>
              {activeMemberships.map((membership) => (
                <Pressable
                  key={membership.id}
                  onPress={async () => {
                    const activeMembership = mapMembershipRow(membership);
                    await setActiveMembership(activeMembership);
                    router.push(`/school/my-school/${activeMembership.school.slug}` as never);
                  }}
                  style={styles.schoolCard}
                >
                  <BannerStrip imageUrl={membership.schools?.banner_url ?? null} stickerKey={membership.schools?.sticker_key ?? 'spark'} />
                  <View style={styles.schoolBody}>
                    <IdentityMark
                      imageUrl={membership.schools?.logo_url ?? null}
                      stickerKey={membership.schools?.sticker_key ?? 'spark'}
                      label={membership.schools?.name ?? 'School'}
                      size="small"
                    />
                    <View style={styles.flexText}>
                      <Text style={styles.schoolName}>{membership.schools?.name ?? 'School workspace'}</Text>
                      <Text style={styles.schoolMeta}>{membership.schools?.slug ?? 'username-not-set'}</Text>
                    </View>
                    <Text style={styles.enterText}>Enter</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Create, join, or request access to a school first.</Text>
          )}
        </Card>
      </ScreenShell>
    </RouteScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  schoolCard: {
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  schoolBody: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  schoolName: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
  },
  schoolMeta: {
    color: colors.tealDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
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
