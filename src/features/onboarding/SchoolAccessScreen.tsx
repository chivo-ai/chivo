import { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Building2, LogOut, QrCode, School, ShieldCheck, UserPlus } from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { acceptInvite, createSchool, requestSchoolAccess, signOut } from '../../services/auth';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership, MembershipStatus, SchoolMembershipRole } from '../../types';

type MembershipRow = {
  id: string;
  school_id: string;
  role: string;
  status: string;
  schools?: {
    id?: string;
    name?: string;
    slug?: string | null;
    city?: string | null;
    country?: string | null;
    subscription_status?: string | null;
    external_crews_allowed?: boolean | null;
  } | null;
};

type SchoolAccessScreenProps = {
  user: User;
  onEnterSchool: (membership: ActiveSchoolMembership) => void;
};

export function SchoolAccessScreen({ user, onEnterSchool }: SchoolAccessScreenProps) {
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(true);
  const [schoolName, setSchoolName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [requestSchoolCode, setRequestSchoolCode] = useState('');
  const [requestRole, setRequestRole] = useState<SchoolMembershipRole>('student');
  const [requestMessage, setRequestMessage] = useState('');
  const [submitting, setSubmitting] = useState<'create' | 'join' | 'request' | 'sign_out' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadMemberships = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setLoadingMemberships(true);
    const { data, error: queryError } = await (supabase as any)
      .from('school_memberships')
      .select('id, school_id, role, status, schools(id, name, slug, city, country, subscription_status, external_crews_allowed)')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
    } else {
      setMemberships((data ?? []) as MembershipRow[]);
    }

    setLoadingMemberships(false);
  }, [user.id]);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  async function handleCreateSchool() {
    setError(null);
    setMessage(null);

    if (!schoolName.trim()) {
      setError('School name is required.');
      return;
    }

    setSubmitting('create');
    try {
      const result = await createSchool({ name: schoolName, country, city });
      setSchoolName('');
      setCountry('');
      setCity('');
      setMessage('School workspace created.');
      await loadMemberships();
      const membership = membershipFromCreateResult(result);
      if (membership) {
        onEnterSchool(membership);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create school.');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleAcceptInvite() {
    setError(null);
    setMessage(null);

    if (!inviteCode.trim()) {
      setError('Enter an invite or class code.');
      return;
    }

    setSubmitting('join');
    try {
      const result = await acceptInvite(inviteCode);
      setInviteCode('');
      setMessage('School access added.');
      await loadMemberships();
      const membership = membershipFromInviteResult(result);
      if (membership) {
        onEnterSchool(membership);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not use that code.');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleRequestAccess() {
    setError(null);
    setMessage(null);

    if (!requestSchoolCode.trim()) {
      setError('School code is required.');
      return;
    }

    setSubmitting('request');
    try {
      await requestSchoolAccess({
        schoolCode: requestSchoolCode,
        requestedRole: requestRole,
        message: requestMessage,
      });
      setRequestSchoolCode('');
      setRequestMessage('');
      setMessage('Request sent to the school.');
      await loadMemberships();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send request.');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleSignOut() {
    setSubmitting('sign_out');
    try {
      await signOut();
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.shell}>
        <View style={styles.topRow}>
          <View style={styles.brandMark}>
            <ShieldCheck size={24} color="#ffffff" />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.title}>School access</Text>
            <Text style={styles.meta}>{user.email}</Text>
          </View>
          <Pressable onPress={handleSignOut} style={styles.signOutButton}>
            {submitting === 'sign_out' ? (
              <ActivityIndicator color={colors.tealDark} />
            ) : (
              <>
                <LogOut size={17} color={colors.tealDark} />
                <Text style={styles.signOutText}>Sign out</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.introPanel}>
          <Text style={styles.introTitle}>Connect this account to a school</Text>
          <Text style={styles.introBody}>
            Accounts are global. School membership decides what classes, lessons, admin tools, and
            crews this person can access.
          </Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
        {message && <Text style={styles.successText}>{message}</Text>}

        <View style={styles.grid}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Building2 size={22} color={colors.teal} />
              <Text style={styles.cardTitle}>Create school</Text>
            </View>
            <Field label="School name" value={schoolName} onChangeText={setSchoolName} placeholder="BestCity Academy" />
            <Field label="Country" value={country} onChangeText={setCountry} placeholder="Nigeria" />
            <Field label="City" value={city} onChangeText={setCity} placeholder="Lagos" />
            <Pressable
              disabled={submitting === 'create'}
              onPress={handleCreateSchool}
              style={[styles.primaryButton, submitting === 'create' && styles.buttonDisabled]}
            >
              {submitting === 'create' ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <School size={18} color="#ffffff" />
                  <Text style={styles.primaryButtonText}>Create workspace</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <QrCode size={22} color={colors.blue} />
              <Text style={styles.cardTitle}>Join school or class</Text>
            </View>
            <Text style={styles.cardBody}>
              Use a school invite, class code, or QR code value from an admin or teacher.
            </Text>
            <Field
              label="Invite or class code"
              value={inviteCode}
              onChangeText={(value) => setInviteCode(value.toUpperCase())}
              placeholder="J2B-318"
              autoCapitalize="characters"
            />
            <Pressable
              disabled={submitting === 'join'}
              onPress={handleAcceptInvite}
              style={[styles.secondaryButton, submitting === 'join' && styles.buttonDisabled]}
            >
              {submitting === 'join' ? (
                <ActivityIndicator color={colors.tealDark} />
              ) : (
                <>
                  <UserPlus size={18} color={colors.tealDark} />
                  <Text style={styles.secondaryButtonText}>Use code</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <UserPlus size={22} color={colors.coral} />
              <Text style={styles.cardTitle}>Request access</Text>
            </View>
            <Text style={styles.cardBody}>
              Use the school code from an admin when you do not have an invite code yet.
            </Text>
            <Field
              label="School code"
              value={requestSchoolCode}
              onChangeText={(value) => setRequestSchoolCode(value.toLowerCase())}
              placeholder="bestcity-academy"
              autoCapitalize="none"
            />
            <View style={styles.pillRow}>
              {(['student', 'teacher', 'guardian'] as SchoolMembershipRole[]).map((role) => (
                <Pressable
                  key={role}
                  onPress={() => setRequestRole(role)}
                  style={[styles.choicePill, requestRole === role && styles.choicePillActive]}
                >
                  <Text style={[styles.choicePillText, requestRole === role && styles.choicePillTextActive]}>
                    {formatRole(role)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field
              label="Message"
              value={requestMessage}
              onChangeText={setRequestMessage}
              placeholder="Your class, child name, or staff note"
            />
            <Pressable
              disabled={submitting === 'request'}
              onPress={handleRequestAccess}
              style={[styles.secondaryButton, submitting === 'request' && styles.buttonDisabled]}
            >
              {submitting === 'request' ? (
                <ActivityIndicator color={colors.tealDark} />
              ) : (
                <>
                  <UserPlus size={18} color={colors.tealDark} />
                  <Text style={styles.secondaryButtonText}>Send request</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ShieldCheck size={22} color={colors.teal} />
            <Text style={styles.cardTitle}>Your memberships</Text>
          </View>

          {loadingMemberships ? (
            <ActivityIndicator color={colors.tealDark} />
          ) : memberships.length > 0 ? (
            memberships.map((membership) => (
              <View key={membership.id} style={styles.membershipRow}>
                <View style={styles.membershipIcon}>
                  <Building2 size={18} color={colors.tealDark} />
                </View>
                <View style={styles.flexText}>
                  <Text style={styles.membershipName}>{membership.schools?.name ?? 'School workspace'}</Text>
                  <Text style={styles.meta}>
                    {formatRole(membership.role)} - {formatRole(membership.status)}
                  </Text>
                </View>
                {membership.status === 'active' ? (
                  <Pressable
                    onPress={() => onEnterSchool(mapMembershipRow(membership))}
                    style={styles.enterButton}
                  >
                    <Text style={styles.enterButtonText}>Enter</Text>
                  </Pressable>
                ) : (
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{membership.status}</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.cardBody}>
              No school membership yet. Create a workspace or use an invite code.
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8b9691"
        autoCapitalize={autoCapitalize}
        style={styles.input}
      />
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
      subscriptionStatus: row.schools?.subscription_status ?? null,
      externalCrewsAllowed: row.schools?.external_crews_allowed ?? null,
    },
  };
}

function membershipFromCreateResult(result: unknown): ActiveSchoolMembership | null {
  const payload = result as {
    school?: {
      id?: string;
      name?: string;
      slug?: string | null;
      city?: string | null;
      country?: string | null;
    };
    membership?: {
      id?: string;
      role?: string;
      status?: string;
    };
  };

  if (!payload.school?.id || !payload.membership?.id) {
    return null;
  }

  return {
    id: payload.membership.id,
    schoolId: payload.school.id,
    role: (payload.membership.role ?? 'owner') as SchoolMembershipRole,
    status: (payload.membership.status ?? 'active') as MembershipStatus,
    school: {
      id: payload.school.id,
      name: payload.school.name ?? 'School workspace',
      slug: payload.school.slug ?? null,
      city: payload.school.city ?? null,
      country: payload.school.country ?? null,
      subscriptionStatus: 'trial',
      externalCrewsAllowed: false,
    },
  };
}

function membershipFromInviteResult(result: unknown): ActiveSchoolMembership | null {
  const payload = result as {
    school?: {
      id?: string;
      name?: string;
      slug?: string | null;
      city?: string | null;
      country?: string | null;
      subscription_status?: string | null;
      external_crews_allowed?: boolean | null;
    };
    membership?: {
      id?: string;
      role?: string;
      status?: string;
      school_id?: string;
    };
  };

  const schoolId = payload.school?.id ?? payload.membership?.school_id;

  if (!schoolId || !payload.membership?.id) {
    return null;
  }

  return {
    id: payload.membership.id,
    schoolId,
    role: (payload.membership.role ?? 'student') as SchoolMembershipRole,
    status: (payload.membership.status ?? 'active') as MembershipStatus,
    school: {
      id: schoolId,
      name: payload.school?.name ?? 'School workspace',
      slug: payload.school?.slug ?? null,
      city: payload.school?.city ?? null,
      country: payload.school?.country ?? null,
      subscriptionStatus: payload.school?.subscription_status ?? null,
      externalCrewsAllowed: payload.school?.external_crews_allowed ?? null,
    },
  };
}

function formatRole(value: string) {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 30,
    backgroundColor: colors.canvas,
  },
  shell: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    gap: 18,
  },
  topRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  signOutButton: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.softTeal,
  },
  signOutText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  introPanel: {
    borderRadius: 24,
    padding: 20,
    gap: 10,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: '#e2dccd',
  },
  introTitle: {
    color: colors.ink,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  introBody: {
    color: '#33413b',
    fontSize: 15,
    lineHeight: 23,
  },
  grid: {
    gap: 16,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  choicePillActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  choicePillText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  choicePillTextActive: {
    color: '#ffffff',
  },
  card: {
    borderRadius: 22,
    padding: 18,
    gap: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardHeader: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  cardBody: {
    color: '#33413b',
    fontSize: 14,
    lineHeight: 21,
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.ink,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 15,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.tealDark,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  secondaryButtonText: {
    color: colors.tealDark,
    fontSize: 15,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  successText: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  membershipRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  membershipIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  membershipName: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  enterButton: {
    minHeight: 36,
    borderRadius: 13,
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
    minHeight: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softGold,
  },
  statusPillText: {
    color: '#76510c',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
});
