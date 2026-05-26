import { supabase } from '../lib/supabase';

export type AppNotification = {
  id: string;
  profileId: string;
  schoolId: string | null;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  profile_id: string;
  school_id: string | null;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await (supabase as any)
    .from('notifications')
    .select('id, profile_id, school_id, type, title, body, data, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as NotificationRow[]).map(mapNotification);
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  if (!supabase) {
    return 0;
  }

  const { count, error } = await (supabase as any)
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  if (!supabase) {
    return;
  }

  const { error } = await (supabase as any)
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAllNotificationsRead() {
  if (!supabase) {
    return;
  }

  const { error } = await (supabase as any)
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export function notificationTargetRoute(notification: AppNotification) {
  const target = notification.data.target_route;

  return typeof target === 'string' && target.startsWith('/') ? target : null;
}

function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    profileId: row.profile_id,
    schoolId: row.school_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
