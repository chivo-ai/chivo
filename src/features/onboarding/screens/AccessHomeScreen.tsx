import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Building2, School, UserCircle, UserPlus, Users } from 'lucide-react-native';
import { User } from '@supabase/supabase-js';

import { ActiveSchoolMembership, MembershipStatus, SchoolMembershipRole } from '../../../types';
import { colors } from '../../../theme/tokens';
import { BannerStrip, Card, CardHeader, IdentityMark, ScreenHeader, ScreenShell } from '../accessUi';
import { formatRole, MembershipRow } from '../accessTypes';

type AccessHomeScreenProps = {
  user: User;
  activeMemberships: MembershipRow[];
  pendingMemberships: MembershipRow[];
  loading: boolean;
  onEnterSchool: (membership: ActiveSchoolMembership) => void;
  onRequestAccess: () => void;
  onOpenCrews: () => void;
};

export function AccessHomeScreen({
  user,
  activeMemberships,
  pendingMemberships,
  loading,
  onEnterSchool,
  onRequestAccess,
  onOpenCrews,
}: AccessHomeScreenProps) {
  return (
    <ScreenShell>
      <ScreenHeader
        icon={<School size={25} color="#ffffff" />}
        title="School spaces"
        body="Open a school, create a new one, use an invite code, or request access from an admin."
      />

      <View style={styles.layout}>
        <View style={styles.mainColumn}>
          <Card>
            <CardHeader icon={<Building2 size={20} color={colors.teal} />} title="Your schools" />
            {loading ? (
              <ActivityIndicator color={colors.tealDark} />
            ) : activeMemberships.length ? (
              <View style={styles.list}>
                {activeMemberships.map((membership) => (
                  <SchoolRow key={membership.id} membership={membership} onEnter={() => onEnterSchool(mapMembershipRow(membership))} />
                ))}
              </View>
            ) : (
              <EmptyState
                title="No active school yet"
                body="Create a school workspace, use an invite code, or request access from your school."
                actionLabel="Request access"
                onAction={onRequestAccess}
              />
            )}
          </Card>

          <Card>
            <CardHeader icon={<UserPlus size={20} color={colors.coral} />} title="Pending access" />
            {pendingMemberships.length ? (
              <View style={styles.list}>
                {pendingMemberships.map((membership) => <PendingRow key={membership.id} membership={membership} />)}
              </View>
            ) : (
              <Text style={styles.cardBody}>Requests and invitations waiting for approval will appear here.</Text>
            )}
          </Card>

          <Card>
            <CardHeader icon={<Users size={20} color={colors.blue} />} title="Crews" />
            <Text style={styles.cardBody}>Study crews will appear here when you create or join one inside a school.</Text>
            <Pressable onPress={onOpenCrews} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>Open crews</Text>
            </Pressable>
          </Card>
        </View>

        <View style={styles.sideColumn}>
          <View style={styles.profileCard}>
            <View style={styles.profileIcon}>
              <UserCircle size={28} color={colors.tealDark} />
            </View>
            <Text style={styles.profileName}>{user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Your profile'}</Text>
            <Text style={styles.profileMeta}>{user.email}</Text>
            <View style={styles.profileStatRow}>
              <ProfileStat label="Schools" value={activeMemberships.length} />
              <ProfileStat label="Pending" value={pendingMemberships.length} />
            </View>
          </View>
        </View>
      </View>
    </ScreenShell>
  );
}

function SchoolRow({ membership, onEnter }: { membership: MembershipRow; onEnter: () => void }) {
  return (
    <View style={styles.schoolCardRow}>
      <BannerStrip imageUrl={membership.schools?.banner_url ?? null} stickerKey={membership.schools?.sticker_key ?? 'spark'} />
      <View style={styles.schoolRowBody}>
        <IdentityMark
          imageUrl={membership.schools?.logo_url ?? null}
          stickerKey={membership.schools?.sticker_key ?? 'spark'}
          label={membership.schools?.name ?? 'School'}
          size="small"
        />
        <View style={styles.flexText}>
          <Text style={styles.schoolName}>{membership.schools?.name ?? 'School workspace'}</Text>
          <Text style={styles.meta}>
            {formatRole(membership.role)}
            {membership.schools?.city ? ` - ${membership.schools.city}` : ''}
          </Text>
          {membership.schools?.slug ? <Text style={styles.schoolCode}>{membership.schools.slug}</Text> : null}
        </View>
        <Pressable onPress={onEnter} style={styles.enterButton}>
          <Text style={styles.enterButtonText}>Enter</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PendingRow({ membership }: { membership: MembershipRow }) {
  return (
    <View style={styles.schoolRow}>
      <View style={styles.schoolIcon}>
        <Building2 size={20} color={colors.tealDark} />
      </View>
      <View style={styles.flexText}>
        <Text style={styles.schoolName}>{membership.schools?.name ?? 'School workspace'}</Text>
        <Text style={styles.meta}>{formatRole(membership.role)} - {formatRole(membership.status)}</Text>
      </View>
      <View style={styles.statusPill}>
        <Text style={styles.statusPillText}>{formatRole(membership.status)}</Text>
      </View>
    </View>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
      <Pressable onPress={onAction} style={styles.emptyAction}>
        <Text style={styles.emptyActionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.profileStat}>
      <Text style={styles.profileStatValue}>{value}</Text>
      <Text style={styles.profileStatLabel}>{label}</Text>
    </View>
  );
}

function mapMembershipRow(row: MembershipRow): ActiveSchoolMembership {
  return {
    id: row.id,
    schoolId: row.school_id,
    role: row.role as SchoolMembershipRole,
    status: row.status as MembershipStatus,
    school: {
      id: row.schools?.id ?? row.school_id,
      name: row.schools?.name ?? 'School workspace',
      slug: row.schools?.slug ?? null,
      city: row.schools?.city ?? null,
      country: row.schools?.country ?? null,
      logoUrl: row.schools?.logo_url ?? null,
      bannerUrl: row.schools?.banner_url ?? null,
      stickerKey: row.schools?.sticker_key ?? null,
      subscriptionStatus: row.schools?.subscription_status ?? null,
      externalCrewsAllowed: row.schools?.external_crews_allowed ?? null,
    },
  };
}

const styles = StyleSheet.create({
  layout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  mainColumn: {
    flex: 2,
    minWidth: 320,
    gap: 16,
  },
  sideColumn: {
    flex: 1,
    minWidth: 260,
  },
  list: {
    gap: 10,
  },
  schoolCardRow: {
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  schoolRowBody: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  schoolRow: {
    minHeight: 60,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  schoolIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  schoolName: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  schoolCode: {
    color: colors.tealDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  enterButton: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  enterButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  statusPill: {
    minHeight: 30,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softGold,
  },
  statusPillText: {
    color: '#6f5520',
    fontSize: 12,
    fontWeight: '900',
  },
  cardBody: {
    color: '#33413b',
    fontSize: 14,
    lineHeight: 21,
  },
  emptyBox: {
    borderRadius: 18,
    padding: 14,
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
  },
  emptyAction: {
    alignSelf: 'flex-start',
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  emptyActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  smallButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  smallButtonText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  profileCard: {
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  profileName: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  profileMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  profileStatRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  profileStat: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    backgroundColor: colors.softTeal,
  },
  profileStatValue: {
    color: colors.tealDark,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  profileStatLabel: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '900',
  },
});
