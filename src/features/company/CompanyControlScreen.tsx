import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BadgeCheck,
  Ban,
  Banknote,
  CheckCircle2,
  CircleSlash,
  CreditCard,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
  UserCog,
  Wallet,
} from 'lucide-react-native';

import { RouteScreen } from '../app/RouteScreen';
import {
  CompanyControlDashboard,
  createCompanyOverride,
  createCompanyRestriction,
  CreateOverrideInput,
  CreateRestrictionInput,
  fetchCompanyControlDashboard,
  setCompanyDashboardPassword,
  unlockCompanyDashboard,
  updateCompanyBillingControl,
  upsertCompanyAdmin,
} from '../../services/companyControl';
import {
  canUseCompanyPermission,
  CompanyAdminRole,
  CompanyAdminStatus,
} from '../../services/companyAdmin';
import { colors } from '../../theme/tokens';

type BillingForm = {
  billingEnabled: boolean;
  cryptoRailsEnabled: boolean;
  traditionalRailsEnabled: boolean;
  platformFeeBps: string;
  message: string;
};

type AdminForm = {
  profileId: string;
  role: CompanyAdminRole;
  status: CompanyAdminStatus;
};

const roleOptions: CompanyAdminRole[] = ['super_admin', 'owner', 'admin', 'finance', 'reviewer', 'operator'];
const statusOptions: CompanyAdminStatus[] = ['active', 'suspended', 'removed'];
const entityOptions: CreateRestrictionInput['entityType'][] = ['profile', 'school', 'class', 'crew', 'publication', 'wallet'];
const restrictionOptions: CreateRestrictionInput['restrictionType'][] = [
  'ban',
  'suspension',
  'payment_freeze',
  'payout_freeze',
  'review_hold',
  'hide',
];
const scopeOptions: CreateOverrideInput['scope'][] = ['platform', 'school', 'class', 'crew', 'verification', 'publication'];
const effectOptions: CreateOverrideInput['effect'][] = ['grant', 'deny', 'force_free', 'waive_fee', 'verified', 'remove_verified'];
const targetTypeOptions: NonNullable<CreateOverrideInput['targetEntityType']>[] = [
  'profile',
  'school',
  'class',
  'crew',
  'publication',
  'payment_rail',
];

const initialBillingForm: BillingForm = {
  billingEnabled: true,
  cryptoRailsEnabled: false,
  traditionalRailsEnabled: false,
  platformFeeBps: '50',
  message: '',
};

const initialAdminForm: AdminForm = {
  profileId: '',
  role: 'operator',
  status: 'active',
};

const initialRestrictionForm: CreateRestrictionInput = {
  entityType: 'profile',
  entityId: '',
  restrictionType: 'suspension',
  reason: '',
};

const initialOverrideForm: CreateOverrideInput = {
  scope: 'school',
  effect: 'grant',
  targetEntityType: 'school',
  targetEntityId: '',
  profileId: '',
  reason: '',
};

export function CompanyControlScreen() {
  const [dashboard, setDashboard] = useState<CompanyControlDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [billingForm, setBillingForm] = useState<BillingForm>(initialBillingForm);
  const [adminForm, setAdminForm] = useState<AdminForm>(initialAdminForm);
  const [restrictionForm, setRestrictionForm] = useState<CreateRestrictionInput>(initialRestrictionForm);
  const [overrideForm, setOverrideForm] = useState<CreateOverrideInput>(initialOverrideForm);
  const [dashboardSessionToken, setDashboardSessionToken] = useState<string | null>(null);
  const [dashboardPassword, setDashboardPassword] = useState('');
  const [currentDashboardPassword, setCurrentDashboardPassword] = useState('');
  const [confirmDashboardPassword, setConfirmDashboardPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');

  const session = dashboard?.session ?? null;
  const canManageBilling = canUseCompanyPermission(session, 'billing.manage');
  const canManagePolicy = canUseCompanyPermission(session, 'policy.manage');
  const canManageAccess = canUseCompanyPermission(session, 'access.manage') || canUseCompanyPermission(session, 'policy.manage');
  const canManageAdmins = Boolean(session?.isSuperAdmin);

  const loadDashboard = useCallback(async () => {
    setError(null);
    const nextDashboard = await fetchCompanyControlDashboard();
    setDashboard(nextDashboard);
    setBillingForm({
      billingEnabled: nextDashboard.billing.billingEnabled,
      cryptoRailsEnabled: nextDashboard.billing.cryptoRailsEnabled,
      traditionalRailsEnabled: nextDashboard.billing.traditionalRailsEnabled,
      platformFeeBps: String(nextDashboard.billing.platformFeeBps),
      message: nextDashboard.billing.message ?? '',
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    loadDashboard()
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Company controls could not be loaded.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    setDashboardSessionToken(null);
    setUnlockPassword('');
  }, [session?.profileId]);

  const railCounts = useMemo(() => {
    const rails = dashboard?.paymentRails ?? [];
    return {
      enabled: rails.filter((rail) => rail.status === 'enabled').length,
      paused: rails.filter((rail) => rail.status === 'paused').length,
      disabled: rails.filter((rail) => rail.status === 'disabled').length,
    };
  }, [dashboard?.paymentRails]);

  async function runAction(action: string, task: () => Promise<unknown>, success: string) {
    setSaving(action);
    setError(null);
    setMessage(null);

    try {
      await task();
      await loadDashboard();
      setMessage(success);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action could not be completed.');
    } finally {
      setSaving(null);
    }
  }

  function saveBillingControl() {
    runAction(
      'billing',
      () =>
        updateCompanyBillingControl({
          billingEnabled: billingForm.billingEnabled,
          cryptoRailsEnabled: billingForm.cryptoRailsEnabled,
          traditionalRailsEnabled: billingForm.traditionalRailsEnabled,
          platformFeeBps: Number(billingForm.platformFeeBps || 0),
          message: billingForm.message,
        }, dashboardSessionToken ?? ''),
      'Billing control updated.',
    );
  }

  function saveCompanyAdmin() {
    runAction(
      'admin',
      () =>
        upsertCompanyAdmin({
          profileId: adminForm.profileId,
          role: adminForm.role,
          status: adminForm.status,
        }, dashboardSessionToken ?? ''),
      'Company role saved.',
    );
  }

  function applyRestriction() {
    runAction(
      'restriction',
      () => createCompanyRestriction(restrictionForm, dashboardSessionToken ?? ''),
      'Restriction applied.',
    );
  }

  function applyOverride() {
    runAction(
      'override',
      () => createCompanyOverride(overrideForm, dashboardSessionToken ?? ''),
      'Override applied.',
    );
  }

  function saveDashboardPassword() {
    if (dashboardPassword !== confirmDashboardPassword) {
      setError('Dashboard passwords do not match.');
      return;
    }

    runAction(
      'dashboard-password',
      async () => {
        await setCompanyDashboardPassword({
          password: dashboardPassword,
          currentPassword: currentDashboardPassword || null,
        });
        setDashboardPassword('');
        setCurrentDashboardPassword('');
        setConfirmDashboardPassword('');
        setDashboardSessionToken(null);
      },
      'Dashboard password saved.',
    );
  }

  async function unlockDashboard() {
    setSaving('unlock');
    setError(null);
    setMessage(null);

    try {
      const result = await unlockCompanyDashboard(unlockPassword);
      setDashboardSessionToken(result.dashboardSessionToken);
      setUnlockPassword('');
      setMessage('Company controls unlocked.');
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Company controls could not be unlocked.');
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <RouteScreen>
        <View style={styles.loadingPanel}>
          <ActivityIndicator color={colors.brandDeep} />
          <Text style={styles.loadingText}>Opening company controls</Text>
        </View>
      </RouteScreen>
    );
  }

  if (!dashboard || !session?.isActive) {
    return (
      <RouteScreen>
        <View style={styles.lockedPanel}>
          <View style={styles.lockIcon}>
            <LockKeyhole size={24} color={colors.brandDeep} />
          </View>
          <Text style={styles.lockedTitle}>Company access required</Text>
          <Text style={styles.lockedCopy}>
            This space is reserved for active Chivo company administrators.
          </Text>
        </View>
      </RouteScreen>
    );
  }

  const activeDashboard = dashboard;

  if (!session.dashboardPasswordSet) {
    return (
      <RouteScreen>
        <View style={styles.stack}>
          <View style={styles.passwordPanel}>
            <View style={styles.lockIcon}>
              <LockKeyhole size={24} color={colors.brandDeep} />
            </View>
            <Text style={styles.lockedTitle}>Create dashboard password</Text>
            <Text style={styles.lockedCopy}>
              This password protects company controls after normal sign-in.
            </Text>
            {error ? <Notice tone="danger" text={error} /> : null}
            {message ? <Notice tone="success" text={message} /> : null}
            <Field label="Dashboard password">
              <TextInput
                value={dashboardPassword}
                onChangeText={setDashboardPassword}
                secureTextEntry
                placeholder="Minimum 10 characters"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </Field>
            <Field label="Confirm password">
              <TextInput
                value={confirmDashboardPassword}
                onChangeText={setConfirmDashboardPassword}
                secureTextEntry
                placeholder="Repeat password"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </Field>
            <IconButton
              icon={<Save size={17} color={colors.brandDeep} />}
              label={saving === 'dashboard-password' ? 'Saving' : 'Save password'}
              disabled={saving === 'dashboard-password'}
              onPress={saveDashboardPassword}
            />
          </View>
        </View>
      </RouteScreen>
    );
  }

  if (!dashboardSessionToken) {
    return (
      <RouteScreen>
        <View style={styles.stack}>
          <View style={styles.passwordPanel}>
            <View style={styles.lockIcon}>
              <LockKeyhole size={24} color={colors.brandDeep} />
            </View>
            <Text style={styles.lockedTitle}>Unlock company control</Text>
            <Text style={styles.lockedCopy}>
              Enter your dashboard password to manage billing, roles, restrictions, and overrides.
            </Text>
            {error ? <Notice tone="danger" text={error} /> : null}
            {message ? <Notice tone="success" text={message} /> : null}
            <Field label="Dashboard password">
              <TextInput
                value={unlockPassword}
                onChangeText={setUnlockPassword}
                secureTextEntry
                placeholder="Dashboard password"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </Field>
            <IconButton
              icon={<LockKeyhole size={17} color={colors.brandDeep} />}
              label={saving === 'unlock' ? 'Unlocking' : 'Unlock'}
              disabled={saving === 'unlock'}
              onPress={unlockDashboard}
            />
          </View>
        </View>
      </RouteScreen>
    );
  }

  return (
    <RouteScreen>
      <View style={styles.stack}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <View style={styles.heroBadge}>
              <ShieldCheck size={16} color={colors.brandDeep} />
              <Text style={styles.heroBadgeText}>{session.isSuperAdmin ? 'Full control' : cleanLabel(session.role)}</Text>
            </View>
            <Text style={styles.heroTitle}>Company control</Text>
            <Text style={styles.heroSubtitle}>Billing, access, policy, and roles</Text>
          </View>
          <Pressable onPress={loadDashboard} style={styles.refreshButton}>
            <RefreshCw size={18} color={colors.brandDeep} />
          </Pressable>
        </View>

        {error ? <Notice tone="danger" text={error} /> : null}
        {message ? <Notice tone="success" text={message} /> : null}

        <View style={styles.metricGrid}>
          <Metric icon={<Banknote size={18} color={colors.brandDeep} />} label="Billing" value={billingForm.billingEnabled ? 'On' : 'Off'} />
          <Metric icon={<Wallet size={18} color={colors.brandDeep} />} label="Enabled rails" value={String(railCounts.enabled)} />
          <Metric icon={<Ban size={18} color={colors.brandDeep} />} label="Restrictions" value={String(activeDashboard.restrictions.length)} />
          <Metric icon={<KeyRound size={18} color={colors.brandDeep} />} label="Overrides" value={String(activeDashboard.overrides.length)} />
        </View>

        <View style={styles.grid}>
          <Panel
            icon={<SlidersHorizontal size={18} color={colors.brandDeep} />}
            title="Billing authority"
            action={
              <IconButton
                icon={<Save size={17} color={canManageBilling ? colors.brandDeep : colors.muted} />}
                label="Save"
                disabled={!canManageBilling || saving === 'billing'}
                onPress={saveBillingControl}
              />
            }
          >
            <View style={styles.toggleGrid}>
              <ToggleTile
                icon={<Banknote size={18} color={billingForm.billingEnabled ? colors.brandDeep : colors.muted} />}
                label="Billing"
                active={billingForm.billingEnabled}
                disabled={!canManageBilling}
                onPress={() => setBillingForm((current) => ({ ...current, billingEnabled: !current.billingEnabled }))}
              />
              <ToggleTile
                icon={<Wallet size={18} color={billingForm.cryptoRailsEnabled ? colors.brandDeep : colors.muted} />}
                label="Crypto"
                active={billingForm.cryptoRailsEnabled}
                disabled={!canManageBilling}
                onPress={() => setBillingForm((current) => ({ ...current, cryptoRailsEnabled: !current.cryptoRailsEnabled }))}
              />
              <ToggleTile
                icon={<CreditCard size={18} color={billingForm.traditionalRailsEnabled ? colors.brandDeep : colors.muted} />}
                label="Card/bank"
                active={billingForm.traditionalRailsEnabled}
                disabled={!canManageBilling}
                onPress={() =>
                  setBillingForm((current) => ({
                    ...current,
                    traditionalRailsEnabled: !current.traditionalRailsEnabled,
                  }))
                }
              />
            </View>
            <Field label="Platform fee bps">
              <TextInput
                value={billingForm.platformFeeBps}
                onChangeText={(platformFeeBps) => setBillingForm((current) => ({ ...current, platformFeeBps }))}
                editable={canManageBilling}
                keyboardType="numeric"
                placeholder="50"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </Field>
            <Field label="Access note">
              <TextInput
                value={billingForm.message}
                onChangeText={(nextMessage) => setBillingForm((current) => ({ ...current, message: nextMessage }))}
                editable={canManageBilling}
                placeholder="Optional"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </Field>
          </Panel>

          <Panel icon={<Wallet size={18} color={colors.brandDeep} />} title="Payment rails">
            <View style={styles.railSummary}>
              <StatusPill label="Enabled" value={railCounts.enabled} tone="success" />
              <StatusPill label="Paused" value={railCounts.paused} tone="warning" />
              <StatusPill label="Disabled" value={railCounts.disabled} tone="neutral" />
            </View>
            <View style={styles.listStack}>
              {activeDashboard.paymentRails.length ? (
                activeDashboard.paymentRails.map((rail) => (
                  <View key={rail.id} style={styles.listRow}>
                    <View style={styles.rowIcon}>
                      {rail.railType === 'crypto' ? (
                        <Wallet size={16} color={colors.brandDeep} />
                      ) : (
                        <CreditCard size={16} color={colors.brandDeep} />
                      )}
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{rail.displayName}</Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>{rail.chain ?? rail.provider}</Text>
                    </View>
                    <Text style={styles.rowStatus}>{cleanLabel(rail.status)}</Text>
                  </View>
                ))
              ) : (
                <EmptyState text="No payment rails are active for this role." />
              )}
            </View>
          </Panel>

          <Panel
            icon={<UserCog size={18} color={colors.brandDeep} />}
            title="Company roles"
            action={
              <IconButton
                icon={<Save size={17} color={canManageAdmins ? colors.brandDeep : colors.muted} />}
                label="Save"
                disabled={!canManageAdmins || saving === 'admin'}
                onPress={saveCompanyAdmin}
              />
            }
          >
            <Field label="Profile ID">
              <TextInput
                value={adminForm.profileId}
                onChangeText={(profileId) => setAdminForm((current) => ({ ...current, profileId }))}
                editable={canManageAdmins}
                placeholder="User profile UUID"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={styles.input}
              />
            </Field>
            <ChoiceGrid
              values={roleOptions}
              selected={adminForm.role}
              disabled={!canManageAdmins}
              onSelect={(role) => setAdminForm((current) => ({ ...current, role }))}
            />
            <ChoiceGrid
              values={statusOptions}
              selected={adminForm.status}
              disabled={!canManageAdmins}
              onSelect={(status) => setAdminForm((current) => ({ ...current, status }))}
            />
            <View style={styles.listStack}>
              {activeDashboard.admins.length ? (
                activeDashboard.admins.slice(0, 6).map((admin) => (
                  <View key={admin.profileId} style={styles.listRow}>
                    <View style={styles.rowIcon}>
                      <BadgeCheck size={16} color={colors.brandDeep} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{admin.profileId}</Text>
                      <Text style={styles.rowMeta}>{cleanLabel(admin.role)}</Text>
                    </View>
                    <Text style={styles.rowStatus}>{cleanLabel(admin.status)}</Text>
                  </View>
                ))
              ) : (
                <EmptyState text="Only your company role is visible." />
              )}
            </View>
          </Panel>

          <Panel
            icon={<CircleSlash size={18} color={colors.brandDeep} />}
            title="Restrictions"
            action={
              <IconButton
                icon={<Ban size={17} color={canManagePolicy ? colors.brandDeep : colors.muted} />}
                label="Apply"
                disabled={!canManagePolicy || saving === 'restriction'}
                onPress={applyRestriction}
              />
            }
          >
            <ChoiceGrid
              values={entityOptions}
              selected={restrictionForm.entityType}
              disabled={!canManagePolicy}
              onSelect={(entityType) => setRestrictionForm((current) => ({ ...current, entityType }))}
            />
            <Field label="Entity ID">
              <TextInput
                value={restrictionForm.entityId}
                onChangeText={(entityId) => setRestrictionForm((current) => ({ ...current, entityId }))}
                editable={canManagePolicy}
                placeholder="UUID"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={styles.input}
              />
            </Field>
            <ChoiceGrid
              values={restrictionOptions}
              selected={restrictionForm.restrictionType}
              disabled={!canManagePolicy}
              onSelect={(restrictionType) => setRestrictionForm((current) => ({ ...current, restrictionType }))}
            />
            <Field label="Reason">
              <TextInput
                value={restrictionForm.reason ?? ''}
                onChangeText={(reason) => setRestrictionForm((current) => ({ ...current, reason }))}
                editable={canManagePolicy}
                placeholder="Policy reason"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </Field>
          </Panel>

          <Panel
            icon={<KeyRound size={18} color={colors.brandDeep} />}
            title="Access overrides"
            action={
              <IconButton
                icon={<CheckCircle2 size={17} color={canManageAccess ? colors.brandDeep : colors.muted} />}
                label="Apply"
                disabled={!canManageAccess || saving === 'override'}
                onPress={applyOverride}
              />
            }
          >
            <ChoiceGrid
              values={scopeOptions}
              selected={overrideForm.scope}
              disabled={!canManageAccess}
              onSelect={(scope) => setOverrideForm((current) => ({ ...current, scope }))}
            />
            <ChoiceGrid
              values={effectOptions}
              selected={overrideForm.effect}
              disabled={!canManageAccess}
              onSelect={(effect) => setOverrideForm((current) => ({ ...current, effect }))}
            />
            <ChoiceGrid
              values={targetTypeOptions}
              selected={overrideForm.targetEntityType ?? 'school'}
              disabled={!canManageAccess}
              onSelect={(targetEntityType) => setOverrideForm((current) => ({ ...current, targetEntityType }))}
            />
            <Field label="Target ID">
              <TextInput
                value={overrideForm.targetEntityId ?? ''}
                onChangeText={(targetEntityId) => setOverrideForm((current) => ({ ...current, targetEntityId }))}
                editable={canManageAccess}
                placeholder="UUID"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={styles.input}
              />
            </Field>
            <Field label="Profile ID">
              <TextInput
                value={overrideForm.profileId ?? ''}
                onChangeText={(profileId) => setOverrideForm((current) => ({ ...current, profileId }))}
                editable={canManageAccess}
                placeholder="Optional"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={styles.input}
              />
            </Field>
          </Panel>
        </View>

        <Panel icon={<ShieldCheck size={18} color={colors.brandDeep} />} title="Active policy">
          <View style={styles.policyGrid}>
            <View style={styles.policyColumn}>
              <Text style={styles.columnTitle}>Restrictions</Text>
              {activeDashboard.restrictions.length ? (
                activeDashboard.restrictions.map((restriction) => (
                  <PolicyRow
                    key={restriction.id}
                    icon={<Ban size={15} color={colors.danger} />}
                    title={`${cleanLabel(restriction.restrictionType)} · ${cleanLabel(restriction.entityType)}`}
                    meta={restriction.reason ?? restriction.entityId}
                  />
                ))
              ) : (
                <EmptyState text="No active restrictions." />
              )}
            </View>
            <View style={styles.policyColumn}>
              <Text style={styles.columnTitle}>Overrides</Text>
              {activeDashboard.overrides.length ? (
                activeDashboard.overrides.map((override) => (
                  <PolicyRow
                    key={override.id}
                    icon={<KeyRound size={15} color={colors.success} />}
                    title={`${cleanLabel(override.effect)} · ${cleanLabel(override.scope)}`}
                    meta={override.reason ?? override.targetEntityId ?? override.profileId ?? 'Platform'}
                  />
                ))
              ) : (
                <EmptyState text="No active overrides." />
              )}
            </View>
          </View>
        </Panel>
      </View>
    </RouteScreen>
  );
}

function Panel({ icon, title, action, children }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleWrap}>
          <View style={styles.panelIcon}>{icon}</View>
          <Text style={styles.panelTitle}>{title}</Text>
        </View>
        {action}
      </View>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChoiceGrid<T extends string>({
  values,
  selected,
  disabled,
  onSelect,
}: {
  values: readonly T[];
  selected: T;
  disabled?: boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.choiceGrid}>
      {values.map((value) => {
        const active = selected === value;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            disabled={disabled}
            style={[styles.choice, active && styles.choiceActive, disabled && styles.disabledControl]}
          >
            <Text style={[styles.choiceText, active && styles.choiceTextActive]} numberOfLines={1}>
              {cleanLabel(value)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleTile({
  icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.toggleTile, active && styles.toggleTileActive, disabled && styles.disabledControl]}
    >
      {icon}
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{label}</Text>
      {active ? <ToggleRight size={22} color={colors.success} /> : <ToggleLeft size={22} color={colors.muted} />}
    </Pressable>
  );
}

function IconButton({ icon, label, disabled, onPress }: { icon: ReactNode; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.iconButton, disabled && styles.iconButtonDisabled]}>
      {icon}
      <Text style={[styles.iconButtonText, disabled && styles.iconButtonTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricIcon}>{icon}</View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

function StatusPill({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'neutral' }) {
  return (
    <View style={[styles.statusPill, tone === 'success' && styles.statusSuccess, tone === 'warning' && styles.statusWarning]}>
      <Text style={styles.statusValue}>{value}</Text>
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );
}

function PolicyRow({ icon, title, meta }: { icon: ReactNode; title: string; meta: string }) {
  return (
    <View style={styles.policyRow}>
      <View style={styles.policyIcon}>{icon}</View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text>
      </View>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function Notice({ tone, text }: { tone: 'success' | 'danger'; text: string }) {
  return (
    <View style={[styles.notice, tone === 'danger' ? styles.noticeDanger : styles.noticeSuccess]}>
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

function cleanLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  loadingPanel: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  lockedPanel: {
    minHeight: 380,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  lockIcon: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
    borderWidth: 1,
    borderColor: '#c8ec68',
  },
  lockedTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  lockedCopy: {
    maxWidth: 360,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  passwordPanel: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    minHeight: 380,
    borderRadius: 8,
    padding: 18,
    gap: 14,
    alignItems: 'stretch',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hero: {
    minHeight: 160,
    borderRadius: 8,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.28)',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    minHeight: 32,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.mint,
  },
  heroBadgeText: {
    color: colors.brandDeep,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#a8b3c7',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  notice: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  noticeSuccess: {
    backgroundColor: '#e8fbf1',
    borderColor: '#b6efcd',
  },
  noticeDanger: {
    backgroundColor: '#fff0f0',
    borderColor: '#ffd0d0',
  },
  noticeText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    minWidth: 150,
    flex: 1,
    minHeight: 82,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  metricCopy: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  panel: {
    flexGrow: 1,
    flexBasis: 420,
    minWidth: 0,
    borderRadius: 8,
    padding: 14,
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  panelHeader: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  panelTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  panelIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  panelBody: {
    gap: 12,
  },
  iconButton: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  iconButtonDisabled: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
  },
  iconButtonText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  iconButtonTextDisabled: {
    color: colors.muted,
  },
  toggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleTile: {
    minWidth: 126,
    flex: 1,
    minHeight: 56,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  toggleTileActive: {
    backgroundColor: colors.softTeal,
    borderColor: '#9be8db',
  },
  toggleLabel: {
    flex: 1,
    minWidth: 0,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  toggleLabelActive: {
    color: colors.brandDeep,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4ef',
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  choiceActive: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandGlow,
  },
  choiceText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  choiceTextActive: {
    color: '#ffffff',
  },
  disabledControl: {
    opacity: 0.58,
  },
  railSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statusSuccess: {
    backgroundColor: '#e8fbf1',
    borderColor: '#b6efcd',
  },
  statusWarning: {
    backgroundColor: colors.softGold,
    borderColor: '#f5df80',
  },
  statusValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  statusLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  listStack: {
    gap: 8,
  },
  listRow: {
    minHeight: 52,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  rowStatus: {
    color: colors.brandDeep,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyState: {
    minHeight: 44,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  policyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  policyColumn: {
    flex: 1,
    minWidth: 280,
    gap: 8,
  },
  columnTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  policyRow: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  policyIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
