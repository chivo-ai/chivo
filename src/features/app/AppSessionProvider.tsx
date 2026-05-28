import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuthSession } from '../../hooks/useAuthSession';
import { supabase } from '../../lib/supabase';
import { evaluateAccessPolicy } from '../../services/accessControl';
import { ActiveSchoolMembership } from '../../types';
import { mapMembershipRow, MembershipRow } from '../onboarding/accessTypes';

const ACTIVE_MEMBERSHIP_KEY = 'chivo.active_membership_id';

type AppSessionContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  activeMembership: ActiveSchoolMembership | null;
  setActiveMembership: (membership: ActiveSchoolMembership | null) => Promise<void>;
  openMembershipById: (membershipId: string) => Promise<ActiveSchoolMembership | null>;
  openMembershipBySchoolId: (schoolId: string) => Promise<ActiveSchoolMembership | null>;
  openMembershipBySchoolUsername: (username: string) => Promise<ActiveSchoolMembership | null>;
};

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const { configured, loading, user } = useAuthSession();
  const [activeMembership, setActiveMembershipState] = useState<ActiveSchoolMembership | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!user) {
      setActiveMembershipState(null);
      void AsyncStorage.removeItem(ACTIVE_MEMBERSHIP_KEY);
      return;
    }

    let alive = true;
    setRestoring(true);

    AsyncStorage.getItem(ACTIVE_MEMBERSHIP_KEY)
      .then(async (membershipId) => {
        if (!alive || !membershipId) {
          return null;
        }

        return fetchActiveMembershipById(membershipId);
      })
      .then((membership) => {
        if (alive && membership) {
          setActiveMembershipState(membership);
        }
      })
      .finally(() => {
        if (alive) {
          setRestoring(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const setActiveMembership = useCallback(async (membership: ActiveSchoolMembership | null) => {
    setActiveMembershipState(membership);

    if (membership) {
      await AsyncStorage.setItem(ACTIVE_MEMBERSHIP_KEY, membership.id);
    } else {
      await AsyncStorage.removeItem(ACTIVE_MEMBERSHIP_KEY);
    }
  }, []);

  const openMembershipById = useCallback(async (membershipId: string) => {
    const membership = await fetchActiveMembershipById(membershipId);
    if (membership) {
      await setActiveMembership(membership);
    }

    return membership;
  }, [setActiveMembership]);

  const openMembershipBySchoolId = useCallback(async (schoolId: string) => {
    const membership = await fetchActiveMembershipBySchoolId(schoolId);
    if (membership) {
      await setActiveMembership(membership);
    }

    return membership;
  }, [setActiveMembership]);

  const openMembershipBySchoolUsername = useCallback(async (username: string) => {
    const membership = await fetchActiveMembershipBySchoolUsername(username);
    if (membership) {
      await setActiveMembership(membership);
    }

    return membership;
  }, [setActiveMembership]);

  const value = useMemo(
    () => ({
      configured,
      loading: loading || restoring,
      user,
      activeMembership,
      setActiveMembership,
      openMembershipById,
      openMembershipBySchoolId,
      openMembershipBySchoolUsername,
    }),
    [activeMembership, configured, loading, openMembershipById, openMembershipBySchoolId, openMembershipBySchoolUsername, restoring, setActiveMembership, user]
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const value = useContext(AppSessionContext);
  if (!value) {
    throw new Error('useAppSession must be used inside AppSessionProvider.');
  }

  return value;
}

async function fetchActiveMembershipById(membershipId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await (supabase as any)
    .from('school_memberships')
    .select('id, school_id, role, status, schools(id, name, slug, city, country, logo_url, banner_url, sticker_key, subscription_status, external_crews_allowed)')
    .eq('id', membershipId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const policy = await evaluateAccessPolicy('school', data.school_id);
  if (!policy.allowed) {
    return null;
  }

  return mapMembershipRow(data as MembershipRow);
}

async function fetchActiveMembershipBySchoolId(schoolId: string) {
  if (!supabase) {
    return null;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data, error } = await (supabase as any)
    .from('school_memberships')
    .select('id, school_id, role, status, schools(id, name, slug, city, country, logo_url, banner_url, sticker_key, subscription_status, external_crews_allowed)')
    .eq('school_id', schoolId)
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const policy = await evaluateAccessPolicy('school', data.school_id, user.id);
  if (!policy.allowed) {
    return null;
  }

  return mapMembershipRow(data as MembershipRow);
}

async function fetchActiveMembershipBySchoolUsername(username: string) {
  if (!supabase) {
    return null;
  }

  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) {
    return null;
  }

  const { data: school, error: schoolError } = await (supabase as any)
    .from('schools')
    .select('id')
    .eq('slug', cleanUsername)
    .maybeSingle();

  if (schoolError || !school?.id) {
    return null;
  }

  return fetchActiveMembershipBySchoolId(school.id);
}
