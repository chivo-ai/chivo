import { router, usePathname } from 'expo-router';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Bell,
  BookOpen,
  Building2,
  GraduationCap,
  Home,
  Layers,
  Menu,
  QrCode,
  ShieldCheck,
  UserCircle,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';

import { useAppSession } from '../features/app/AppSessionProvider';
import { fetchUnreadNotificationCount } from '../services/notifications';
import { fetchPlatformBranding, PlatformBranding } from '../services/platform';
import { colors } from '../theme/tokens';

type TopRoute = {
  label: string;
  route: string;
  icon: ReactNode;
  visible?: boolean;
};

const fallbackCompanyLogo = require('../../assets/icon.png');
const TopBarContext = createContext(false);

export function TopBarProvider({ children }: { children: ReactNode }) {
  return <TopBarContext.Provider value>{children}</TopBarContext.Provider>;
}

export function useTopBarProvided() {
  return useContext(TopBarContext);
}

export function UniversalTopBar() {
  const pathname = usePathname();
  const { activeMembership, user } = useAppSession();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [branding, setBranding] = useState<PlatformBranding>({
    name: 'Chivo AI',
    subtitle: 'Learn smarter',
    logoUrl: null,
  });
  const canTeach = activeMembership ? ['owner', 'admin', 'teacher'].includes(activeMembership.role) : false;
  const canAdmin = activeMembership ? ['owner', 'admin'].includes(activeMembership.role) : false;

  const routes = useMemo<TopRoute[]>(() => [
    { label: 'Home', route: '/home', icon: <Home size={18} color={colors.tealDark} /> },
    { label: 'Activity', route: '/notifications', icon: <Bell size={18} color={colors.coral} /> },
    { label: 'Learn', route: '/learn', icon: <BookOpen size={18} color={colors.blue} />, visible: Boolean(activeMembership) },
    { label: 'Teach', route: '/teach', icon: <GraduationCap size={18} color={colors.gold} />, visible: canTeach },
    { label: 'Admin', route: '/admin', icon: <ShieldCheck size={18} color={colors.teal} />, visible: canAdmin },
    { label: 'My schools', route: '/school/my-school', icon: <Building2 size={18} color={colors.tealDark} /> },
    { label: 'Classes', route: '/school/class', icon: <Layers size={18} color={colors.coral} />, visible: Boolean(activeMembership) },
    { label: 'Lessons', route: '/lessons', icon: <BookOpen size={18} color={colors.blue} />, visible: Boolean(activeMembership) },
    { label: 'Create', route: '/create', icon: <Building2 size={18} color={colors.gold} /> },
    { label: 'Join', route: '/join', icon: <QrCode size={18} color={colors.teal} /> },
    { label: 'Request', route: '/request', icon: <UserPlus size={18} color={colors.coral} /> },
    { label: 'Crews', route: '/crews', icon: <Users size={18} color={colors.blue} /> },
    { label: 'Account', route: '/account', icon: <UserCircle size={18} color={colors.tealDark} /> },
  ].filter((item) => item.visible !== false), [activeMembership, canAdmin, canTeach]);

  function go(route: string) {
    setOpen(false);
    router.push(route as never);
  }

  useEffect(() => {
    let isMounted = true;

    fetchPlatformBranding()
      .then((nextBranding) => {
        if (isMounted) {
          setBranding(nextBranding);
        }
      })
      .catch(() => {
        if (isMounted) {
          setBranding({ name: 'Chivo AI', subtitle: 'Learn smarter', logoUrl: null });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setUnreadCount(0);
      return () => {
        isMounted = false;
      };
    }

    fetchUnreadNotificationCount()
      .then((count) => {
        if (isMounted) {
          setUnreadCount(count);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUnreadCount(0);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pathname, user?.id]);

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen(true)} style={styles.menuButton}>
        <Menu size={22} color="#ffffff" />
      </Pressable>

      <Pressable onPress={() => go('/home')} style={styles.brand}>
        <View style={styles.logoMark}>
          <Image
            source={branding.logoUrl ? { uri: branding.logoUrl } : fallbackCompanyLogo}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandTitle} numberOfLines={1}>
            {branding.name}
          </Text>
          <Text style={styles.brandMeta} numberOfLines={1}>
            {activeMembership?.school.name ?? branding.subtitle ?? 'Learn smarter'}
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={() => go('/notifications')} style={styles.notificationButton}>
        <Bell size={22} color="#ffffff" />
        {unreadCount ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable onPress={() => go('/account')} style={styles.accountButton}>
        <UserCircle size={23} color="#ffffff" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{branding.name}</Text>
                <Text style={styles.sheetMeta}>Routes</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={styles.closeButton}>
                <X size={18} color={colors.tealDark} />
              </Pressable>
            </View>

            <View style={styles.routeGrid}>
              {routes.map((item) => (
                <Pressable key={item.route} onPress={() => go(item.route)} style={styles.routeItem}>
                  <View style={styles.routeIcon}>{item.icon}</View>
                  <Text style={styles.routeLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 48,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.night,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(25, 209, 163, 0.18)',
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.nightSoft,
    borderWidth: 1,
    borderColor: '#3d4738',
  },
  brand: {
    flex: 1,
    minWidth: 0,
    height: 38,
    borderRadius: 14,
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#0a201b',
    borderWidth: 1,
    borderColor: '#0ef4b4',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '800',
  },
  brandMeta: {
    color: '#f6d979',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  notificationButton: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.nightSoft,
    borderWidth: 1,
    borderColor: '#3d4738',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coral,
    borderWidth: 2,
    borderColor: '#111710',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  accountButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: '#0ef4b4',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(7, 12, 10, 0.5)',
  },
  sheet: {
    margin: 10,
    marginTop: 52,
    borderRadius: 16,
    padding: 10,
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sheetHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  sheetMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  routeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  routeItem: {
    minWidth: 122,
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  routeIcon: {
    width: 28,
    alignItems: 'center',
  },
  routeLabel: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
});
