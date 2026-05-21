import { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';

import { hasSupabaseConfig } from '../lib/config';
import { supabase } from '../lib/supabase';

type AuthSessionState = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
};

export function useAuthSession(): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>({
    configured: hasSupabaseConfig,
    loading: hasSupabaseConfig,
    session: null,
    user: null,
  });

  useEffect(() => {
    if (!supabase) {
      setState({
        configured: false,
        loading: false,
        session: null,
        user: null,
      });
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setState({
        configured: true,
        loading: false,
        session: data.session,
        user: data.session?.user ?? null,
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        configured: true,
        loading: false,
        session,
        user: session?.user ?? null,
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
