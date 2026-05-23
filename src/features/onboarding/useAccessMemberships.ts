import { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '../../lib/supabase';
import { MembershipRow } from './accessTypes';

export function useAccessMemberships(user: User | null) {
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) {
      setLoading(false);
      setMemberships([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: loadError } = await (supabase as any)
      .from('school_memberships')
      .select('id, school_id, role, status, schools(id, name, slug, city, country, logo_url, banner_url, sticker_key, subscription_status, external_crews_allowed)')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setMemberships((data ?? []) as MembershipRow[]);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeMemberships = useMemo(
    () => memberships.filter((membership) => membership.status === 'active'),
    [memberships]
  );

  const pendingMemberships = useMemo(
    () => memberships.filter((membership) => membership.status !== 'active'),
    [memberships]
  );

  return {
    activeMemberships,
    pendingMemberships,
    loading,
    error,
    reload: load,
  };
}
