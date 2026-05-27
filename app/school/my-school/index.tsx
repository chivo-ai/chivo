import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Building2, DoorOpen, Plus, School, Sparkles } from 'lucide-react-native';

import { RouteScreen } from '../../../src/features/app/RouteScreen';
import { useAppSession } from '../../../src/features/app/AppSessionProvider';
import { useAccessMemberships } from '../../../src/features/onboarding/useAccessMemberships';
import { formatRole, mapMembershipRow, MembershipRow } from '../../../src/features/onboarding/accessTypes';
import { IdentityMark } from '../../../src/features/onboarding/accessUi';
import { colors } from '../../../src/theme/tokens';

type SchoolFilter = 'all' | 'created' | 'joined';

export default function MySchoolsIndexRoute() {
  const { user, loading: sessionLoading, setActiveMembership } = useAppSession();
  const { activeMemberships, loading, error } = useAccessMemberships(user);
  const [filter, setFilter] = useState<SchoolFilter>('all');

  const createdCount = activeMemberships.filter((membership) => membership.role === 'owner').length;
  const joinedCount = activeMemberships.filter((membership) => membership.role !== 'owner').length;

  const filteredMemberships = useMemo(() => {
    if (filter === 'created') {
      return activeMemberships.filter((membership) => membership.role === 'owner');
    }

    if (filter === 'joined') {
      return activeMemberships.filter((membership) => membership.role !== 'owner');
    }

    return activeMemberships;
  }, [activeMemberships, filter]);

  async function openSchool(membership: MembershipRow) {
    const activeMembership = mapMembershipRow(membership);
    await setActiveMembership(activeMembership);
    router.push(`/school/my-school/${activeMembership.school.slug}` as never);
  }

  if (sessionLoading) {
    return null;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <RouteScreen>
      <View style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <School size={19} color="#ffffff" />
          </View>
          <View style={styles.flexText}>
            <View style={styles.heroPill}>
              <Sparkles size={12} color={colors.ink} />
              <Text style={styles.heroPillText}>School directory</Text>
            </View>
            <Text style={styles.heroTitle}>My schools</Text>
            <Text style={styles.heroMeta}>Open a school workspace, then teach or learn inside its classes.</Text>
          </View>
          <Pressable onPress={() => router.push('/create' as never)} style={styles.createButton}>
            <Plus size={15} color="#ffffff" />
            <Text style={styles.createButtonText}>Create</Text>
          </Pressable>
        </View>

        <View style={styles.statRow}>
          <MiniStat label="All" value={activeMemberships.length} />
          <MiniStat label="Created" value={createdCount} />
          <MiniStat label="Joined" value={joinedCount} />
        </View>

        <View style={styles.filterRail}>
          <FilterChip id="all" active={filter} label="All" count={activeMemberships.length} onPress={setFilter} />
          <FilterChip id="created" active={filter} label="Created" count={createdCount} onPress={setFilter} />
          <FilterChip id="joined" active={filter} label="Joined" count={joinedCount} onPress={setFilter} />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={colors.brandDeep} />
            <Text style={styles.metaText}>Loading schools</Text>
          </View>
        ) : filteredMemberships.length ? (
          <View style={styles.grid}>
            {filteredMemberships.map((membership) => (
              <SchoolCard
                key={membership.id}
                membership={membership}
                onPress={() => openSchool(membership)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No schools here</Text>
            <Text style={styles.metaText}>{activeMemberships.length ? 'Try another filter.' : 'Create, join, or request access to a school first.'}</Text>
          </View>
        )}
      </View>
    </RouteScreen>
  );
}

function FilterChip({
  id,
  active,
  label,
  count,
  onPress,
}: {
  id: SchoolFilter;
  active: SchoolFilter;
  label: string;
  count: number;
  onPress: (id: SchoolFilter) => void;
}) {
  const selected = active === id;

  return (
    <Pressable onPress={() => onPress(id)} style={[styles.filterChip, selected && styles.filterChipActive]}>
      <Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text>
      <Text style={[styles.filterCount, selected && styles.filterTextActive]}>{count}</Text>
    </Pressable>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function SchoolCard({ membership, onPress }: { membership: MembershipRow; onPress: () => void }) {
  const school = membership.schools;
  const place = [school?.city, school?.country].filter(Boolean).join(', ');

  return (
    <Pressable onPress={onPress} style={styles.schoolCard}>
      <View style={styles.cardStripe} />
      <View style={styles.schoolBody}>
        <IdentityMark
          imageUrl={school?.logo_url ?? null}
          stickerKey={school?.sticker_key ?? 'spark'}
          label={school?.name ?? 'School'}
          size="small"
        />
        <View style={styles.flexText}>
          <Text style={styles.schoolName} numberOfLines={1}>{school?.name ?? 'School workspace'}</Text>
          <Text style={styles.schoolMeta} numberOfLines={1}>{school?.slug ?? 'username-not-set'}</Text>
          <Text style={styles.schoolPlace} numberOfLines={1}>{formatRole(membership.role)}{place ? ` - ${place}` : ''}</Text>
        </View>
        <View style={styles.enterButton}>
          <DoorOpen size={14} color="#ffffff" />
          <Text style={styles.enterButtonText}>Open</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 12,
  },
  hero: {
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  heroPill: {
    alignSelf: 'flex-start',
    minHeight: 24,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.mint,
  },
  heroPillText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  heroMeta: {
    color: '#d8e0ef',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  createButton: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brand,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniStat: {
    minWidth: 92,
    flex: 1,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  miniStatValue: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  miniStatLabel: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  filterRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  filterChipActive: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandDeep,
  },
  filterText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  filterCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  schoolCard: {
    minWidth: 260,
    flex: 1,
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
    shadowColor: '#111318',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  cardStripe: {
    height: 10,
    backgroundColor: colors.brand,
  },
  schoolBody: {
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  schoolName: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  schoolMeta: {
    color: colors.brand,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  schoolPlace: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  enterButton: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.brandDeep,
  },
  enterButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  loadingPanel: {
    minHeight: 86,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  emptyPanel: {
    minHeight: 86,
    borderRadius: 10,
    padding: 14,
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
});
