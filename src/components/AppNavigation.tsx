import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Grid3X3, Menu, X } from 'lucide-react-native';

import { fetchPlatformBranding, PlatformBranding } from '../services/platform';
import { colors } from '../theme/tokens';
import { TopBarProvider, UniversalTopBar } from './UniversalTopBar';

export type AppNavItem = {
  id: string;
  label: string;
  description?: string;
  icon: ReactNode;
  group?: string;
  visible?: boolean;
};

type AppNavigationProps = {
  title: string;
  subtitle: string;
  items: AppNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  children: ReactNode;
};

const WEB_BREAKPOINT = 860;
const fallbackCompanyLogo = require('../../assets/icon.png');

export function AppNavigation({
  title,
  subtitle,
  items,
  activeId,
  onSelect,
  children,
}: AppNavigationProps) {
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [branding, setBranding] = useState<PlatformBranding>({
    name: 'Chivo AI',
    subtitle: 'Learn smarter',
    logoUrl: null,
  });

  const visibleItems = useMemo(() => items.filter((item) => item.visible !== false), [items]);
  const primaryMobileItems = visibleItems.slice(0, 4);
  const hasOverflowItems = visibleItems.length > primaryMobileItems.length;
  const isWebShell = Platform.OS === 'web' && width >= WEB_BREAKPOINT;
  const activeItem = visibleItems.find((item) => item.id === activeId);

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

  function select(id: string) {
    onSelect(id);
    setMenuOpen(false);
  }

  if (isWebShell) {
    return (
      <View style={styles.webShell}>
        <View style={styles.sidebarSlot}>
          <Pressable
            onHoverIn={() => setExpanded(true)}
            onHoverOut={() => setExpanded(false)}
            style={[styles.sidebarSurface, expanded && styles.sidebarSurfaceExpanded]}
          >
            <View style={styles.sidebarTop}>
              <View style={styles.sidebarBrand}>
                <View style={styles.brandBadge}>
                  <Image
                    source={branding.logoUrl ? { uri: branding.logoUrl } : fallbackCompanyLogo}
                    style={styles.brandLogo}
                    resizeMode="cover"
                  />
                </View>
                {expanded ? (
                  <View style={styles.brandCopy}>
                    <Text style={styles.sidebarTitle} numberOfLines={1}>
                      {branding.name}
                    </Text>
                    <Text style={styles.sidebarSubtitle} numberOfLines={1}>
                      {branding.subtitle ?? subtitle}
                    </Text>
                  </View>
                ) : null}
              </View>

              {expanded ? (
                <View style={styles.workspaceCard}>
                  <Text style={styles.workspaceKicker}>Current space</Text>
                  <Text style={styles.workspaceTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.workspaceMeta} numberOfLines={1}>
                    {activeItem?.label ?? subtitle}
                  </Text>
                </View>
              ) : null}
            </View>

            <ScrollView
              style={styles.sidebarScroller}
              contentContainerStyle={styles.sidebarItems}
              showsVerticalScrollIndicator={expanded}
            >
              {visibleItems.map((item, index) => {
                const previous = visibleItems[index - 1];
                const startsGroup = item.group && item.group !== previous?.group;
                const showGroup = expanded && startsGroup;
                const isActive = activeId === item.id;

                return (
                  <View key={item.id}>
                    {showGroup ? <Text style={styles.groupLabel}>{item.group}</Text> : null}
                    {!expanded && startsGroup && index > 0 ? <View style={styles.groupDivider} /> : null}
                    <Pressable
                      onPress={() => select(item.id)}
                      style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                    >
                      <View style={[styles.activeRail, isActive && styles.activeRailOn]} />
                      <View style={[styles.navIcon, isActive && styles.navIconActive]}>{item.icon}</View>
                      {expanded ? (
                        <View style={styles.navCopy}>
                          <Text style={[styles.navLabel, isActive && styles.navLabelActive]} numberOfLines={1}>
                            {item.label}
                          </Text>
                          {item.description ? <Text style={styles.navDescription}>{item.description}</Text> : null}
                        </View>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.sidebarFooter}>
              {expanded ? (
                <View style={styles.footerCard}>
                  <Text style={styles.footerKicker}>Mode</Text>
                  <Text style={styles.footerTitle} numberOfLines={1}>
                    {activeItem?.group ?? 'Workspace'}
                  </Text>
                </View>
              ) : (
                <View style={styles.footerDot} />
              )}
            </View>
          </Pressable>
        </View>

        <View style={styles.contentPane}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.mobileShell}>
      <TopBarProvider>
        <UniversalTopBar />
        <View style={styles.mobileContent}>{children}</View>
      </TopBarProvider>

      <View style={styles.bottomNav}>
        {primaryMobileItems.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => select(item.id)}
            style={[styles.bottomItem, activeId === item.id && styles.bottomItemActive]}
          >
            {item.icon}
            <Text style={[styles.bottomLabel, activeId === item.id && styles.bottomLabelActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        ))}
        {hasOverflowItems ? (
          <Pressable onPress={() => setMenuOpen(true)} style={styles.bottomItem}>
            <Grid3X3 size={20} color="#dce7e1" />
            <Text style={styles.bottomLabel}>More</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet}>
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuTitle}>{title}</Text>
                <Text style={styles.menuSubtitle}>{subtitle}</Text>
              </View>
              <Pressable onPress={() => setMenuOpen(false)} style={styles.menuClose}>
                <X size={18} color={colors.tealDark} />
              </Pressable>
            </View>

            {visibleItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => select(item.id)}
                style={[styles.menuItem, activeId === item.id && styles.menuItemActive]}
              >
                <View style={styles.navIcon}>{item.icon}</View>
                <View style={styles.navCopy}>
                  <Text style={[styles.menuItemLabel, activeId === item.id && styles.navLabelActive]}>{item.label}</Text>
                  {item.description ? <Text style={styles.navDescription}>{item.description}</Text> : null}
                </View>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function MenuIcon({ color = colors.tealDark }: { color?: string }) {
  return <Menu size={20} color={color} />;
}

const styles = StyleSheet.create({
  webShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.canvas,
  },
  sidebarSlot: {
    width: 64,
    minHeight: '100%',
    zIndex: 20,
  },
  sidebarSurface: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 64,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 12,
    backgroundColor: '#081611',
    borderRightWidth: 1,
    borderRightColor: 'rgba(89, 121, 106, 0.32)',
    overflow: 'hidden',
  },
  sidebarSurfaceExpanded: {
    width: 201,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 26,
    shadowOffset: { width: 14, height: 0 },
  },
  sidebarTop: {
    gap: 10,
  },
  sidebarBrand: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  brandBadge: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#0d241c',
    borderWidth: 1,
    borderColor: '#12d2a2',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  sidebarTitle: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700',
  },
  sidebarSubtitle: {
    color: '#b9c8c0',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  workspaceCard: {
    minHeight: 61,
    borderRadius: 16,
    padding: 13,
    gap: 4,
    backgroundColor: '#12251d',
    borderWidth: 1,
    borderColor: 'rgba(18, 210, 162, 0.24)',
  },
  workspaceKicker: {
    color: colors.gold,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  workspaceTitle: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  workspaceMeta: {
    color: '#b9c8c0',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  sidebarItems: {
    gap: 6,
    paddingBottom: 10,
  },
  sidebarScroller: {
    flex: 1,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
  groupLabel: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
    paddingLeft: 9,
    textTransform: 'uppercase',
  },
  groupDivider: {
    width: 28,
    height: 1,
    marginVertical: 7,
    alignSelf: 'center',
    backgroundColor: 'rgba(222, 233, 226, 0.2)',
  },
  sidebarItem: {
    position: 'relative',
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sidebarItemActive: {
    backgroundColor: '#eaf8f1',
    borderColor: '#19c99b',
    shadowColor: '#16d7a4',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  activeRail: {
    position: 'absolute',
    left: -10,
    width: 4,
    height: 24,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  activeRailOn: {
    backgroundColor: colors.gold,
  },
  navIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  navIconActive: {
    backgroundColor: '#ffffff',
  },
  navCopy: {
    flex: 1,
    minWidth: 0,
  },
  navLabel: {
    color: '#f5fbf7',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  navLabelActive: {
    color: colors.ink,
  },
  navDescription: {
    color: '#8fa29a',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  sidebarFooter: {
    minHeight: 36,
    justifyContent: 'flex-end',
  },
  footerCard: {
    minHeight: 50,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerKicker: {
    color: '#8fa29a',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  footerTitle: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  footerDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignSelf: 'center',
    backgroundColor: colors.gold,
    borderWidth: 4,
    borderColor: '#1a2a22',
  },
  contentPane: {
    flex: 1,
    minWidth: 0,
  },
  mobileShell: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  mobileContent: {
    flex: 1,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 52,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#101916',
    borderWidth: 1,
    borderColor: '#20352f',
  },
  bottomItem: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bottomItemActive: {
    backgroundColor: colors.gold,
  },
  bottomLabel: {
    color: '#dce7e1',
    fontSize: 9,
    fontWeight: '700',
  },
  bottomLabelActive: {
    color: colors.ink,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(7, 12, 10, 0.5)',
  },
  menuSheet: {
    margin: 12,
    borderRadius: 18,
    padding: 12,
    gap: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  menuHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  menuTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  menuSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  menuClose: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  menuItem: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f7faf7',
  },
  menuItemActive: {
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  menuItemLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
});
