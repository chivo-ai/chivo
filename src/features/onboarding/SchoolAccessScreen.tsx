import { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Building2,
  Home,
  LogOut,
  Plus,
  QrCode,
  School,
  ShieldCheck,
  UserCircle,
  UserPlus,
  Users,
} from 'lucide-react-native';

import { AppNavigation, AppNavItem } from '../../components/AppNavigation';
import { ImageUploadButton } from '../../components/ImageUploadButton';
import { supabase } from '../../lib/supabase';
import { acceptInvite, createSchool, requestSchoolAccess, signOut } from '../../services/auth';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership, MembershipStatus, SchoolMembershipRole } from '../../types';
import { AccessAccountScreen } from './screens/AccessAccountScreen';
import { AccessCrewsScreen } from './screens/AccessCrewsScreen';
import { AccessHomeScreen } from './screens/AccessHomeScreen';
import { CreateSchoolScreen } from './screens/CreateSchoolScreen';
import { JoinSchoolScreen } from './screens/JoinSchoolScreen';
import { RequestSchoolScreen } from './screens/RequestSchoolScreen';

type AccessAction = 'create' | 'join' | 'request' | null;
type HomeView = 'home' | 'account' | 'crews';
type HomeNav = HomeView | 'create' | 'join' | 'request' | 'crews';

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
    logo_url?: string | null;
    banner_url?: string | null;
    sticker_key?: string | null;
  } | null;
};

type SchoolAccessScreenProps = {
  user: User;
  onEnterSchool: (membership: ActiveSchoolMembership) => void;
};

const requestRoles: SchoolMembershipRole[] = ['student', 'teacher', 'guardian'];
const stickerPack = [
  { key: 'spark', label: 'Spark', accent: colors.gold },
  { key: 'orbit', label: 'Orbit', accent: colors.blue },
  { key: 'leaf', label: 'Leaf', accent: colors.teal },
  { key: 'coral', label: 'Coral', accent: colors.coral },
];

export function SchoolAccessScreen({ user, onEnterSchool }: SchoolAccessScreenProps) {
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [activeView, setActiveView] = useState<HomeView>('home');
  const [activeAction, setActiveAction] = useState<AccessAction>(null);
  const [loadingMemberships, setLoadingMemberships] = useState(true);
  const [profileName, setProfileName] = useState(user.user_metadata?.full_name ?? '');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [learningLevel, setLearningLevel] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [profileStickerKey, setProfileStickerKey] = useState('spark');
  const [schoolName, setSchoolName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState('');
  const [schoolBannerUrl, setSchoolBannerUrl] = useState('');
  const [schoolStickerKey, setSchoolStickerKey] = useState('spark');
  const [inviteCode, setInviteCode] = useState('');
  const [requestSchoolCode, setRequestSchoolCode] = useState('');
  const [requestRole, setRequestRole] = useState<SchoolMembershipRole>('student');
  const [requestMessage, setRequestMessage] = useState('');
  const [submitting, setSubmitting] = useState<'create' | 'join' | 'request' | 'sign_out' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeMemberships = useMemo(
    () => memberships.filter((membership) => membership.status === 'active'),
    [memberships]
  );
  const pendingMemberships = useMemo(
    () => memberships.filter((membership) => membership.status !== 'active'),
    [memberships]
  );
  const activeNavId: HomeNav = activeAction ?? activeView;
  const navItems: AppNavItem<HomeNav>[] = [
    {
      id: 'home',
      label: 'Home',
      description: 'Schools and access',
      group: 'Main',
      icon: <Home size={19} color={activeNavId === 'home' ? colors.tealDark : '#dce7e1'} />,
    },
    {
      id: 'account',
      label: 'Account',
      description: 'Personal profile',
      group: 'Main',
      icon: <UserCircle size={19} color={activeNavId === 'account' ? colors.tealDark : '#dce7e1'} />,
    },
    {
      id: 'create',
      label: 'Create',
      description: 'Start a school',
      group: 'School',
      icon: <Plus size={19} color={activeNavId === 'create' ? colors.tealDark : '#dce7e1'} />,
    },
    {
      id: 'join',
      label: 'Join',
      description: 'Use an invite code',
      group: 'School',
      icon: <QrCode size={19} color={activeNavId === 'join' ? colors.tealDark : '#dce7e1'} />,
    },
    {
      id: 'request',
      label: 'Request',
      description: 'Ask a school admin',
      group: 'School',
      icon: <UserPlus size={19} color={activeNavId === 'request' ? colors.tealDark : '#dce7e1'} />,
    },
    {
      id: 'crews',
      label: 'Crews',
      description: 'Study groups',
      group: 'Learning',
      icon: <Users size={19} color={activeNavId === 'crews' ? colors.tealDark : '#dce7e1'} />,
    },
  ];

  const loadHomeData = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setLoadingMemberships(true);
    const [membershipResult, profileResult] = await Promise.all([
      (supabase as any)
        .from('school_memberships')
        .select('id, school_id, role, status, schools(id, name, slug, city, country, logo_url, banner_url, sticker_key, subscription_status, external_crews_allowed)')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false }),
      (supabase as any)
        .from('profiles')
        .select('full_name, preferred_language, learning_level, avatar_url, sticker_key')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    if (membershipResult.error) {
      setError(membershipResult.error.message);
    } else {
      setMemberships((membershipResult.data ?? []) as MembershipRow[]);
    }

    if (!profileResult.error && profileResult.data) {
      setProfileName(profileResult.data.full_name ?? '');
      setPreferredLanguage(profileResult.data.preferred_language ?? 'English');
      setLearningLevel(profileResult.data.learning_level ?? 'balanced');
      setProfileAvatarUrl(profileResult.data.avatar_url ?? '');
      setProfileStickerKey(profileResult.data.sticker_key ?? 'spark');
    }

    setLoadingMemberships(false);
  }, [user.id]);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  async function handleCreateSchool() {
    setError(null);
    setMessage(null);

    if (!schoolName.trim()) {
      setError('School name is required.');
      return;
    }

    setSubmitting('create');
    try {
      const result = await createSchool({
        name: schoolName,
        country,
        city,
        logoUrl: schoolLogoUrl,
        bannerUrl: schoolBannerUrl,
        stickerKey: schoolStickerKey,
      });
      setSchoolName('');
      setCountry('');
      setCity('');
      setSchoolLogoUrl('');
      setSchoolBannerUrl('');
      setSchoolStickerKey('spark');
      setActiveAction(null);
      setMessage('School workspace created.');
      await loadHomeData();
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
      setActiveAction(null);
      setMessage('School access added.');
      await loadHomeData();
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
      setActiveAction(null);
      setMessage('Request sent to the school.');
      await loadHomeData();
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

  function handleNavSelect(id: HomeNav) {
    if (id === 'create' || id === 'join' || id === 'request') {
      setActiveView('home');
      setActiveAction(id);
      return;
    }

    setActiveAction(null);
    setActiveView(id);
  }

  async function handleSaveProfile() {
    if (!supabase) {
      setError('Account access is not available right now.');
      return;
    }

    setError(null);
    setMessage(null);

    if (!profileName.trim()) {
      setError('Full name is required.');
      return;
    }

    setSubmitting('request');
    try {
      const { error: updateError } = await (supabase as any)
        .from('profiles')
        .update({
          full_name: profileName.trim(),
          preferred_language: preferredLanguage.trim() || 'English',
          learning_level: learningLevel.trim() || 'balanced',
          avatar_url: profileAvatarUrl.trim() || null,
          sticker_key: profileStickerKey,
        })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setMessage('Account updated.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update account.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <AppNavigation
      title="Chivo AI"
      subtitle="Schools, crews, account"
      items={navItems}
      activeId={activeNavId}
      onSelect={handleNavSelect}
    >
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.shell}>
        <View style={styles.topRow}>
          <View style={styles.brandMark}>
            <ShieldCheck size={22} color="#ffffff" />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.title}>Chivo AI</Text>
            <Text style={styles.meta}>Your schools, crews, and learning account</Text>
          </View>
          <View style={styles.iconActionRow}>
            <IconAction active={activeAction === 'create'} label="Create school" onPress={() => setActiveAction(activeAction === 'create' ? null : 'create')}>
              <Plus size={18} color={activeAction === 'create' ? '#ffffff' : colors.tealDark} />
            </IconAction>
            <IconAction active={activeAction === 'join'} label="Join with code" onPress={() => setActiveAction(activeAction === 'join' ? null : 'join')}>
              <QrCode size={18} color={activeAction === 'join' ? '#ffffff' : colors.tealDark} />
            </IconAction>
            <IconAction
              active={!activeAction && activeView === 'account'}
              label="Account"
              onPress={() => {
                setActiveAction(null);
                setActiveView(activeView === 'account' ? 'home' : 'account');
              }}
            >
              <UserCircle size={18} color={!activeAction && activeView === 'account' ? '#ffffff' : colors.tealDark} />
            </IconAction>
            <Pressable onPress={handleSignOut} style={styles.iconButton}>
              {submitting === 'sign_out' ? <ActivityIndicator color={colors.tealDark} /> : <LogOut size={18} color={colors.tealDark} />}
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {message ? <Text style={styles.successText}>{message}</Text> : null}

        {activeAction === 'create' ? (
          <CreateSchoolScreen
            userId={user.id}
            values={{ schoolName, country, city, schoolLogoUrl, schoolBannerUrl, schoolStickerKey }}
            submitting={submitting}
            onChange={{
              setSchoolName,
              setCountry,
              setCity,
              setSchoolLogoUrl,
              setSchoolBannerUrl,
              setSchoolStickerKey,
            }}
            onCreate={handleCreateSchool}
            onError={setError}
          />
        ) : activeAction === 'join' ? (
          <JoinSchoolScreen
            inviteCode={inviteCode}
            submitting={submitting}
            onChangeInviteCode={setInviteCode}
            onJoin={handleAcceptInvite}
          />
        ) : activeAction === 'request' ? (
          <RequestSchoolScreen
            schoolCode={requestSchoolCode}
            requestRole={requestRole}
            requestMessage={requestMessage}
            submitting={submitting}
            onChangeSchoolCode={setRequestSchoolCode}
            onChangeRole={setRequestRole}
            onChangeMessage={setRequestMessage}
            onRequest={handleRequestAccess}
          />
        ) : activeView === 'account' ? (
          <AccessAccountScreen
            user={user}
            values={{ profileName, preferredLanguage, learningLevel }}
            imageValues={{ profileAvatarUrl, profileStickerKey }}
            imagePathPrefix={`profiles/${user.id}`}
            submitting={submitting}
            onChange={{ setProfileName, setPreferredLanguage, setLearningLevel }}
            onImageChange={{ setProfileAvatarUrl, setProfileStickerKey }}
            onError={setError}
            onSave={handleSaveProfile}
          />
        ) : activeView === 'crews' ? (
          <AccessCrewsScreen />
        ) : (
          <AccessHomeScreen
            user={user}
            activeMemberships={activeMemberships}
            pendingMemberships={pendingMemberships}
            loading={loadingMemberships}
            onEnterSchool={onEnterSchool}
            onRequestAccess={() => setActiveAction('request')}
            onOpenCrews={() => setActiveView('crews')}
          />
        )}
      </View>
    </ScrollView>
    </AppNavigation>
  );
}

function CrewsScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.accountScreen}>
      <View style={styles.accountHeader}>
        <View style={styles.profileIconLarge}>
          <Users size={32} color={colors.tealDark} />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.heroTitle}>Crews</Text>
          <Text style={styles.heroBody}>Study crews connected to your schools will live here.</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>No crews yet</Text>
        <Text style={styles.cardBody}>
          After school setup, crews will let students study together without exposing unrelated schools to each other.
        </Text>
      </View>
      <Pressable onPress={onBack} style={styles.emptyAction}>
        <Text style={styles.emptyActionText}>Back to home</Text>
      </Pressable>
    </View>
  );
}

function AccountScreen({
  user,
  values,
  imageValues,
  imagePathPrefix,
  submitting,
  onChange,
  onImageChange,
  onError,
  onBack,
  onSave,
}: {
  user: User;
  values: {
    profileName: string;
    preferredLanguage: string;
    learningLevel: string;
  };
  imageValues: {
    profileAvatarUrl: string;
    profileStickerKey: string;
  };
  imagePathPrefix: string;
  submitting: boolean;
  onChange: {
    setProfileName: (value: string) => void;
    setPreferredLanguage: (value: string) => void;
    setLearningLevel: (value: string) => void;
  };
  onImageChange: {
    setProfileAvatarUrl: (value: string) => void;
    setProfileStickerKey: (value: string) => void;
  };
  onError: (message: string) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.accountScreen}>
      <View style={styles.accountHeader}>
        <IdentityMark
          imageUrl={imageValues.profileAvatarUrl}
          stickerKey={imageValues.profileStickerKey}
          label={values.profileName || user.email || 'Account'}
          size="large"
        />
        <View style={styles.flexText}>
          <Text style={styles.heroTitle}>Personal account</Text>
          <Text style={styles.heroBody}>{user.email}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Profile</Text>
        </View>
        <Field label="Full name" value={values.profileName} onChangeText={onChange.setProfileName} placeholder="Your name" />
        <View style={styles.formRow}>
          <Field label="Preferred language" value={values.preferredLanguage} onChangeText={onChange.setPreferredLanguage} placeholder="English" />
          <Field label="Learning level" value={values.learningLevel} onChangeText={onChange.setLearningLevel} placeholder="balanced" />
        </View>
        <ImageUploadButton
          label={imageValues.profileAvatarUrl ? 'Replace profile image' : 'Upload profile image'}
          pathPrefix={imagePathPrefix}
          onUploaded={onImageChange.setProfileAvatarUrl}
          onError={onError}
        />
        <StickerPicker selectedKey={imageValues.profileStickerKey} onSelect={onImageChange.setProfileStickerKey} />
        <SubmitButton label="Save account" loading={submitting} onPress={onSave} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Access</Text>
        <Text style={styles.cardBody}>
          Your personal account is separate from school access. Schools decide which classes, lessons,
          crews, and admin tools this account can use.
        </Text>
      </View>

      <Pressable onPress={onBack} style={styles.emptyAction}>
        <Text style={styles.emptyActionText}>Back to home</Text>
      </Pressable>
    </View>
  );
}

function ActionPanel({
  action,
  submitting,
  values,
  onChange,
  onCancel,
  onCreate,
  onJoin,
  onRequest,
  userId,
  onError,
}: {
  action: Exclude<AccessAction, null>;
  submitting: 'create' | 'join' | 'request' | 'sign_out' | null;
  values: {
    schoolName: string;
    country: string;
    city: string;
    schoolLogoUrl: string;
    schoolBannerUrl: string;
    schoolStickerKey: string;
    inviteCode: string;
    requestSchoolCode: string;
    requestMessage: string;
    requestRole: SchoolMembershipRole;
  };
  onChange: {
    setSchoolName: (value: string) => void;
    setCountry: (value: string) => void;
    setCity: (value: string) => void;
    setSchoolLogoUrl: (value: string) => void;
    setSchoolBannerUrl: (value: string) => void;
    setSchoolStickerKey: (value: string) => void;
    setInviteCode: (value: string) => void;
    setRequestSchoolCode: (value: string) => void;
    setRequestMessage: (value: string) => void;
    setRequestRole: (value: SchoolMembershipRole) => void;
  };
  onCancel: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onRequest: () => void;
  userId: string;
  onError: (message: string) => void;
}) {
  const title = action === 'create' ? 'Create school' : action === 'join' ? 'Join with code' : 'Request school access';

  return (
    <View style={styles.actionPanel}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Close</Text>
        </Pressable>
      </View>

      {action === 'create' ? (
        <>
          <Field label="School name" value={values.schoolName} onChangeText={onChange.setSchoolName} placeholder="BestCity Academy" />
          <View style={styles.formRow}>
            <Field label="Country" value={values.country} onChangeText={onChange.setCountry} placeholder="Nigeria" />
            <Field label="City" value={values.city} onChangeText={onChange.setCity} placeholder="Lagos" />
          </View>
          <View style={styles.identityPreview}>
            <IdentityMark imageUrl={values.schoolLogoUrl} stickerKey={values.schoolStickerKey} label={values.schoolName || 'School'} size="large" />
            <View style={styles.flexText}>
              <Text style={styles.recordTitle}>{values.schoolName || 'School identity'}</Text>
              <Text style={styles.recordMeta}>Upload a logo, upload a banner, or choose a sticker.</Text>
            </View>
          </View>
          <View style={styles.formRow}>
            <ImageUploadButton
              label={values.schoolLogoUrl ? 'Replace logo' : 'Upload logo'}
              pathPrefix={`drafts/${userId}/school-logo`}
              onUploaded={onChange.setSchoolLogoUrl}
              onError={onError}
            />
            <ImageUploadButton
              label={values.schoolBannerUrl ? 'Replace banner' : 'Upload banner'}
              pathPrefix={`drafts/${userId}/school-banner`}
              onUploaded={onChange.setSchoolBannerUrl}
              onError={onError}
            />
          </View>
          <StickerPicker selectedKey={values.schoolStickerKey} onSelect={onChange.setSchoolStickerKey} />
          <SubmitButton label="Create school" loading={submitting === 'create'} onPress={onCreate} />
        </>
      ) : action === 'join' ? (
        <>
          <Text style={styles.cardBody}>Use the invite or class code from your school.</Text>
          <Field
            label="Invite or class code"
            value={values.inviteCode}
            onChangeText={(value) => onChange.setInviteCode(value.toUpperCase())}
            placeholder="STU-ABC-123"
            autoCapitalize="characters"
          />
          <SubmitButton label="Use code" loading={submitting === 'join'} onPress={onJoin} />
        </>
      ) : (
        <>
          <Text style={styles.cardBody}>Use the school code when you do not have an invite code.</Text>
          <Field
            label="School code"
            value={values.requestSchoolCode}
            onChangeText={(value) => onChange.setRequestSchoolCode(value.toLowerCase())}
            placeholder="bestcity-academy"
            autoCapitalize="none"
          />
          <View style={styles.pillRow}>
            {requestRoles.map((role) => (
              <ChoicePill
                key={role}
                selected={role === values.requestRole}
                label={formatRole(role)}
                onPress={() => onChange.setRequestRole(role)}
              />
            ))}
          </View>
          <Field
            label="Message"
            value={values.requestMessage}
            onChangeText={onChange.setRequestMessage}
            placeholder="Your class, child name, or staff note"
          />
          <SubmitButton label="Send request" loading={submitting === 'request'} onPress={onRequest} />
        </>
      )}
    </View>
  );
}

function HubSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {icon}
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
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
            {formatRole(membership.role)} access
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

function IdentityMark({
  imageUrl,
  stickerKey,
  label,
  size,
}: {
  imageUrl?: string | null;
  stickerKey?: string | null;
  label: string;
  size: 'small' | 'large';
}) {
  const sticker = stickerPack.find((item) => item.key === stickerKey) ?? stickerPack[0];
  const initials = label
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CH';

  return (
    <View style={[styles.identityMark, size === 'large' && styles.identityMarkLarge, { backgroundColor: sticker.accent }]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.identityImage} resizeMode="cover" />
      ) : (
        <Text style={styles.identityInitials}>{initials}</Text>
      )}
    </View>
  );
}

function BannerStrip({ imageUrl, stickerKey }: { imageUrl?: string | null; stickerKey?: string | null }) {
  const sticker = stickerPack.find((item) => item.key === stickerKey) ?? stickerPack[0];

  return (
    <View style={[styles.bannerStrip, { backgroundColor: sticker.accent }]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.bannerImage} resizeMode="cover" /> : null}
    </View>
  );
}

function StickerPicker({ selectedKey, onSelect }: { selectedKey: string; onSelect: (key: string) => void }) {
  return (
    <View style={styles.stickerRow}>
      {stickerPack.map((sticker) => (
        <Pressable
          key={sticker.key}
          onPress={() => onSelect(sticker.key)}
          style={[
            styles.stickerChoice,
            { borderColor: selectedKey === sticker.key ? sticker.accent : colors.line },
          ]}
        >
          <View style={[styles.stickerSwatch, { backgroundColor: sticker.accent }]} />
          <Text style={styles.stickerText}>{sticker.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function IconAction({
  active,
  label,
  onPress,
  children,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={[styles.iconButton, active && styles.iconButtonActive]}>
      {children}
    </Pressable>
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

function SubmitButton({ label, loading, onPress }: { label: string; loading: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={loading} onPress={onPress} style={[styles.primaryButton, loading && styles.buttonDisabled]}>
      {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

function ChoicePill({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choicePill, selected && styles.choicePillActive]}>
      <Text style={[styles.choicePillText, selected && styles.choicePillTextActive]}>{label}</Text>
    </Pressable>
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

function membershipFromCreateResult(result: unknown): ActiveSchoolMembership | null {
  const payload = result as {
    school?: {
      id?: string;
      name?: string;
      slug?: string | null;
      city?: string | null;
      country?: string | null;
      logo_url?: string | null;
      banner_url?: string | null;
      sticker_key?: string | null;
      subscription_status?: string | null;
      external_crews_allowed?: boolean | null;
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
      logoUrl: payload.school.logo_url ?? null,
      bannerUrl: payload.school.banner_url ?? null,
      stickerKey: payload.school.sticker_key ?? null,
      subscriptionStatus: payload.school.subscription_status ?? 'trial',
      externalCrewsAllowed: payload.school.external_crews_allowed ?? false,
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
      logo_url?: string | null;
      banner_url?: string | null;
      sticker_key?: string | null;
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
      logoUrl: payload.school?.logo_url ?? null,
      bannerUrl: payload.school?.banner_url ?? null,
      stickerKey: payload.school?.sticker_key ?? null,
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
    paddingTop: 36,
    paddingBottom: 30,
    backgroundColor: colors.canvas,
  },
  shell: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    gap: 16,
  },
  topRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 14,
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
  iconActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  iconButtonActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  layout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  accountScreen: {
    gap: 16,
  },
  accountHeader: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: '#e2dccd',
  },
  mainColumn: {
    flex: 2,
    minWidth: 320,
    gap: 16,
  },
  sideColumn: {
    flex: 1,
    minWidth: 260,
    gap: 16,
  },
  heroPanel: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: '#e2dccd',
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  heroBody: {
    color: '#33413b',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
  actionPanel: {
    borderRadius: 22,
    padding: 18,
    gap: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.teal,
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
    flex: 1,
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
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  field: {
    flex: 1,
    minWidth: 170,
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
    minHeight: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  cancelButton: {
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  cancelButtonText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  schoolRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  schoolCardRow: {
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e1e9e3',
  },
  schoolRowBody: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerStrip: {
    height: 58,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  schoolIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  schoolName: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  schoolCode: {
    color: colors.tealDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
  },
  identityPreview: {
    minHeight: 78,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e1e9e3',
  },
  identityMark: {
    overflow: 'hidden',
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityMarkLarge: {
    width: 64,
    height: 64,
    borderRadius: 22,
  },
  identityImage: {
    width: '100%',
    height: '100%',
  },
  identityInitials: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  stickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stickerChoice: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ffffff',
    borderWidth: 2,
  },
  stickerSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  stickerText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  recordTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },
  recordMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
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
  profileCard: {
    borderRadius: 22,
    padding: 18,
    gap: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  profileIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  profileIconLarge: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  profileName: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  profileMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  profileStatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  profileStat: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#f7faf7',
  },
  profileStatValue: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  profileStatLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  emptyBox: {
    gap: 10,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
  },
  emptyAction: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: 13,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  emptyActionText: {
    color: colors.tealDark,
    fontSize: 12,
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
});
