import { supabase } from '../lib/supabase';

export type CompanyAdminRole = 'super_admin' | 'owner' | 'admin' | 'finance' | 'reviewer' | 'operator';

export type CompanyAdminStatus = 'active' | 'suspended' | 'removed';

export type CompanyAdminSession = {
  profileId: string;
  role: CompanyAdminRole;
  status: CompanyAdminStatus;
  isActive: boolean;
  isSuperAdmin: boolean;
  dashboardPasswordSet: boolean;
  permissions: string[];
  metadata: Record<string, unknown>;
};

const missingTableCodes = new Set(['42P01', '42703', 'PGRST116', 'PGRST205']);

function isMissingAdminSchema(error: { code?: string } | null | undefined) {
  return Boolean(error?.code && missingTableCodes.has(error.code));
}

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeRole(value: unknown): CompanyAdminRole {
  if (
    value === 'super_admin' ||
    value === 'owner' ||
    value === 'admin' ||
    value === 'finance' ||
    value === 'reviewer' ||
    value === 'operator'
  ) {
    return value;
  }

  return 'operator';
}

function normalizeStatus(value: unknown): CompanyAdminStatus {
  if (value === 'suspended' || value === 'removed') {
    return value;
  }

  return 'active';
}

export function canUseCompanyPermission(session: CompanyAdminSession | null, permission: string) {
  if (!session?.isActive) {
    return false;
  }

  if (session.isSuperAdmin) {
    return true;
  }

  return session.permissions.includes(permission);
}

export async function fetchCurrentCompanyAdminSession(): Promise<CompanyAdminSession | null> {
  if (!supabase) {
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const profileId = userData.user?.id;
  if (!profileId) {
    return null;
  }

  const { data: admin, error: adminError } = await (supabase as any)
    .from('company_admins')
    .select('profile_id, role, status, metadata')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (adminError) {
    if (isMissingAdminSchema(adminError)) {
      return null;
    }

    throw adminError;
  }

  if (!admin) {
    return null;
  }

  const role = normalizeRole(admin.role);
  const status = normalizeStatus(admin.status);
  const isActive = status === 'active';
  const isSuperAdmin = role === 'super_admin' && isActive;

  if (!isActive) {
    return {
      profileId,
      role,
      status,
      isActive,
      isSuperAdmin: false,
      dashboardPasswordSet: false,
      permissions: [],
      metadata: readObject(admin.metadata),
    };
  }

  const dashboardPasswordSet = await fetchDashboardPasswordState();

  if (isSuperAdmin) {
    return {
      profileId,
      role,
      status,
      isActive,
      isSuperAdmin,
      dashboardPasswordSet,
      permissions: ['*'],
      metadata: readObject(admin.metadata),
    };
  }

  const { data: permissionRows, error: permissionsError } = await (supabase as any)
    .from('company_admin_role_permissions')
    .select('permission')
    .eq('role', role)
    .eq('enabled', true);

  if (permissionsError) {
    if (isMissingAdminSchema(permissionsError)) {
      return {
        profileId,
        role,
        status,
        isActive,
        isSuperAdmin,
        dashboardPasswordSet,
        permissions: [],
        metadata: readObject(admin.metadata),
      };
    }

    throw permissionsError;
  }

  const permissions = ((permissionRows ?? []) as { permission?: unknown }[])
    .map((row) => (typeof row.permission === 'string' ? row.permission : null))
    .filter((permission): permission is string => Boolean(permission));

  return {
    profileId,
    role,
    status,
    isActive,
    isSuperAdmin,
    dashboardPasswordSet,
    permissions,
    metadata: readObject(admin.metadata),
  };
}

async function fetchDashboardPasswordState() {
  if (!supabase) {
    return false;
  }

  const { data, error } = await (supabase as any).rpc('company_admin_dashboard_state');

  if (error) {
    if (isMissingAdminSchema(error) || error.code === '42883' || error.code === 'PGRST202') {
      return false;
    }

    throw error;
  }

  if (!data || typeof data !== 'object') {
    return false;
  }

  return data.passwordSet === true || data.password_set === true;
}
