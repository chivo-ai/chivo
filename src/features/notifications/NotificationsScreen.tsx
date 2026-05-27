import { router } from 'expo-router';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, BellRing, BookOpen, CheckCheck, ChevronRight, MessageCircle, Sparkles, Users } from 'lucide-react-native';

import {
  AppNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationTargetRoute,
} from '../../services/notifications';
import { colors } from '../../theme/tokens';

const tones = [
  { background: '#e9f1ff', accent: colors.brand },
  { background: '#e3fbf7', accent: colors.teal },
  { background: '#f3efff', accent: colors.violet },
  { background: '#f1ffd7', accent: '#a3e635' },
];

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      setNotifications(await fetchNotifications());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openNotification(notification: AppNotification) {
    const route = notificationTargetRoute(notification);

    try {
      if (!notification.readAt) {
        await markNotificationRead(notification.id);
        setNotifications((items) => items.map((item) => (
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
        )));
      }

      if (route) {
        router.push(route as never);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update notification.');
    }
  }

  async function markEveryNotificationRead() {
    setSaving(true);
    setMessage(null);

    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to mark notifications read.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={styles.heroPill}>
            <BellRing size={15} color={colors.ink} />
            <Text style={styles.heroPillText} numberOfLines={1}>Activity center</Text>
          </View>
          <Text style={styles.heroTitle} numberOfLines={2}>Stay on top of every school move</Text>
          <Text style={styles.heroBody} numberOfLines={2}>Crew AI packs, class updates, requests, lesson events, and billing alerts land here.</Text>
        </View>

        <View style={styles.heroStats}>
          <StatCard icon={<Bell size={21} color={colors.ink} />} label="Unread" value={unreadCount} tone={tones[0]} />
          <StatCard icon={<Sparkles size={21} color={colors.ink} />} label="Total" value={notifications.length} tone={tones[3]} />
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionTitle} numberOfLines={1}>Notifications</Text>
          <Text style={styles.sectionMeta} numberOfLines={1}>{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'Everything is caught up'}</Text>
        </View>
        <Pressable disabled={!unreadCount || saving} onPress={markEveryNotificationRead} style={[styles.readButton, (!unreadCount || saving) && styles.disabledButton]}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <CheckCheck size={17} color="#ffffff" />}
          <Text style={styles.readButtonText} numberOfLines={1}>Mark read</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.errorText}>{message}</Text> : null}

      <View style={styles.list}>
        {loading ? (
          <View style={styles.emptyPanel}>
            <ActivityIndicator color={colors.brandDeep} />
            <Text style={styles.emptyMeta} numberOfLines={1}>Loading activity...</Text>
          </View>
        ) : notifications.length ? notifications.map((notification, index) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            tone={tones[index % tones.length]}
            onPress={() => openNotification(notification)}
          />
        )) : (
          <View style={styles.emptyPanel}>
            <Bell size={30} color={colors.brandDeep} />
            <Text style={styles.emptyTitle} numberOfLines={1}>No activity yet</Text>
            <Text style={styles.emptyMeta} numberOfLines={2}>When crews, lessons, classes, or requests move, they will appear here.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function NotificationCard({
  notification,
  tone,
  onPress,
}: {
  notification: AppNotification;
  tone: { background: string; accent: string };
  onPress: () => void;
}) {
  const unread = !notification.readAt;
  const target = notificationTargetRoute(notification);

  return (
    <Pressable onPress={onPress} style={[styles.notificationCard, { backgroundColor: tone.background, borderColor: unread ? tone.accent : colors.line }]}>
      <View style={[styles.notificationIcon, { backgroundColor: tone.accent }]}>
        {iconForType(notification.type)}
      </View>
      <View style={styles.notificationCopy}>
        <View style={styles.notificationTitleRow}>
          <Text style={styles.notificationTitle} numberOfLines={2}>{notification.title}</Text>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        {notification.body ? <Text style={styles.notificationBody} numberOfLines={3}>{notification.body}</Text> : null}
        <View style={styles.metaRow}>
          <Text style={styles.notificationMeta}>{formatDate(notification.createdAt)}</Text>
          {target ? (
            <View style={styles.openMetaPill}>
              <Text style={styles.openMeta} numberOfLines={1}>Open</Text>
              <ChevronRight size={12} color={colors.brand} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function StatCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: { background: string; accent: string } }) {
  return (
    <View style={[styles.statCard, { backgroundColor: tone.background }]}>
      <View style={[styles.statIcon, { backgroundColor: tone.accent }]}>{icon}</View>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function iconForType(type: string) {
  if (type.startsWith('crew.')) {
    return <Users size={21} color="#ffffff" />;
  }

  if (type.startsWith('lesson.')) {
    return <BookOpen size={21} color="#ffffff" />;
  }

  if (type.startsWith('request.')) {
    return <MessageCircle size={21} color="#ffffff" />;
  }

  return <Sparkles size={21} color="#ffffff" />;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  screen: {
    gap: 16,
  },
  hero: {
    minHeight: 150,
    borderRadius: 8,
    padding: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  heroCopy: {
    flex: 1.5,
    minWidth: 260,
    gap: 11,
  },
  heroPill: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.mint,
  },
  heroPillText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  heroBody: {
    color: '#d8e0ef',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  heroStats: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    minWidth: 108,
    flex: 1,
    borderRadius: 8,
    padding: 14,
    gap: 7,
    borderWidth: 1,
    borderBottomWidth: 4,
    borderColor: 'rgba(17, 19, 24, 0.1)',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeading: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  readButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.brand,
  },
  readButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  list: {
    gap: 10,
  },
  notificationCard: {
    minHeight: 75,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderBottomWidth: 4,
  },
  notificationIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  notificationCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.coral,
  },
  notificationBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  notificationMeta: {
    color: '#76837e',
    fontSize: 11,
    fontWeight: '700',
  },
  openMeta: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '700',
  },
  openMetaPill: {
    minHeight: 24,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  emptyPanel: {
    minHeight: 101,
    borderRadius: 8,
    padding: 14,
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  emptyMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  errorText: {
    color: '#a13c33',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});
