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
import { acceptInvite, createSchool, signOut } from '../../services/auth';
import { colors } from '../../theme/tokens';

type MembershipRow = {
  id: string;
  role: string;
  status: string;
  schools?: {
    name?: string;
    city?: string | null;
    country?: string | null;
  } | null;
};

type SchoolAccessScreenProps = {
  user: User;
};

export function SchoolAccessScreen({ user }: SchoolAccessScreenProps) {
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(true);
  const [schoolName, setSchoolName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState<'create' | 'join' | 'sign_out' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadMemberships = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setLoadingMemberships(true);
    const { data, error: queryError } = await supabase
      .from('school_memberships')
      .select('id, role, status, schools(name, city, country)')
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
      await createSchool({ name: schoolName, country, city });
      setSchoolName('');
      setCountry('');
      setCity('');
      setMessage('School workspace created.');
      await loadMemberships();
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
      await acceptInvite(inviteCode);
      setInviteCode('');
      setMessage('School access added.');
      await loadMemberships();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not use that code.');
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
                    {membership.role} · {membership.status}
                  </Text>
                </View>
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
    textTransform: 'capitalize',
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
});
