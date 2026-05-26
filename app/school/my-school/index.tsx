import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Building2, School } from 'lucide-react-native';

import { RouteScreen } from '../../../src/features/app/RouteScreen';
import { useAppSession } from '../../../src/features/app/AppSessionProvider';
import { useAccessMemberships } from '../../../src/features/onboarding/useAccessMemberships';
import { mapMembershipRow } from '../../../src/features/onboarding/accessTypes';
import { BannerStrip, Card, CardHeader, IdentityMark, ScreenHeader, ScreenShell } from '../../../src/features/onboarding/accessUi';
import { colors } from '../../../src/theme/tokens';

type SchoolFilter = 'all' | 'created' | 'joined';

export default function MySchoolsIndexRoute() {
  const { user, loading: sessionLoading, setActiveMembership } = useAppSession();
  const { activeMemberships, loading, error } = useAccessMemberships(user);
  const [filter, setFilter] = useState<SchoolFilter>('all');

  const filteredMemberships = useMemo(() => {
    if (filter === 'created') {
      return activeMemberships.filter((membership) => membership.role === 'owner');
    }

    if (filter === 'joined') {
      return activeMemberships.filter((membership) => membership.role !== 'owner');
    }

    return activeMemberships;
  }, [activeMemberships, filter]);

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
          <View style={styles.filterRow}>
            <FilterChip
              active={filter === 'all'}
              label={`All ${activeMemberships.length}`}
              onPress={() => setFilter('all')}
            />
            <FilterChip
              active={filter === 'created'}
              label={`Created ${activeMemberships.filter((membership) => membership.role === 'owner').length}`}
              onPress={() => setFilter('created')}
            />
            <FilterChip
              active={filter === 'joined'}
              label={`Joined ${activeMemberships.filter((membership) => membership.role !== 'owner').length}`}
              onPress={() => setFilter('joined')}
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {loading ? (
            <ActivityIndicator color={colors.tealDark} />
          ) : filteredMemberships.length ? (
            <View style={styles.list}>
              {filteredMemberships.map((membership) => (
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
            <Text style={styles.emptyText}>{activeMemberships.length ? 'No schools in this filter yet.' : 'Create, join, or request access to a school first.'}</Text>
          )}
        </Card>
      </ScreenShell>
    </RouteScreen>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  filterChip: {
    minHeight: 31,
    borderRadius: 11,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  filterChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  list: {
    gap: 10,
  },
  schoolCard: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  schoolBody: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  schoolName: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  schoolMeta: {
    color: colors.tealDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  enterText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 19,
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});
