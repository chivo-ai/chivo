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
import { chivoTheme, colors } from '../theme/tokens';
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
  const expanded = isWebShell;
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
          <View style={[styles.sidebarSurface, expanded && styles.sidebarSurfaceExpanded]}>
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
                          {item.description ? <Text style={styles.navDescription} numberOfLines={1}>{item.description}</Text> : null}
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
                  <Text style={styles.footerKicker}>Current mode</Text>
                  <Text style={styles.footerTitle} numberOfLines={1}>
                    {activeItem?.group ?? 'Workspace'}
                  </Text>
                </View>
              ) : (
                <View style={styles.footerDot} />
              )}
            </View>
          </View>
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
        {primaryMobileItems.map((item) => {
          const isActive = activeId === item.id;

          return (
            <Pressable
              key={item.id}
              onPress={() => select(item.id)}
              style={[styles.bottomItem, isActive && styles.bottomItemActive]}
            >
              <View style={[styles.bottomIcon, isActive && styles.bottomIconActive]}>{item.icon}</View>
              <Text style={[styles.bottomLabel, isActive && styles.bottomLabelActive]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
        {hasOverflowItems ? (
          <Pressable onPress={() => setMenuOpen(true)} style={styles.bottomItem}>
            <View style={styles.bottomIcon}>
              <Grid3X3 size={20} color="#d8e0ef" />
            </View>
            <Text style={styles.bottomLabel} numberOfLines={1}>More</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet}>
            <View style={styles.menuHeader}>
              <View style={styles.menuHeaderCopy}>
                <Text style={styles.menuTitle} numberOfLines={1}>{title}</Text>
                <Text style={styles.menuSubtitle} numberOfLines={1}>{subtitle}</Text>
              </View>
              <Pressable onPress={() => setMenuOpen(false)} style={styles.menuClose}>
                <X size={18} color={colors.brandDeep} />
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
                  <Text style={[styles.menuItemLabel, activeId === item.id && styles.navLabelActive]} numberOfLines={1}>{item.label}</Text>
                  {item.description ? <Text style={styles.navDescription} numberOfLines={1}>{item.description}</Text> : null}
                </View>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function MenuIcon({ color = colors.brandDeep }: { color?: string }) {
  return <Menu size={20} color={color} />;
}

const styles = StyleSheet.create({
  webShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.canvas,
  },
  sidebarSlot: {
    width: chivoTheme.sidebarWidth,
    minHeight: '100%',
    zIndex: 20,
  },
  sidebarSurface: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: chivoTheme.sidebarWidth,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 14,
    backgroundColor: colors.brandDeep,
    borderRightWidth: 1,
    borderRightColor: 'rgba(99, 230, 255, 0.22)',
    overflow: 'hidden',
  },
  sidebarSurfaceExpanded: {
    width: chivoTheme.sidebarExpandedWidth,
    shadowColor: '#111318',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 12, height: 0 },
  },
  sidebarTop: {
    gap: 12,
  },
  sidebarBrand: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandBadge: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: colors.brandGlow,
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
    lineHeight: 19,
    fontWeight: '800',
  },
  sidebarSubtitle: {
    color: '#a8b3c7',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  workspaceCard: {
    minHeight: 68,
    borderRadius: 8,
    padding: 12,
    gap: 5,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
    borderLeftWidth: 4,
    borderLeftColor: colors.mint,
  },
  workspaceKicker: {
    color: colors.brandGlow,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  workspaceTitle: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  workspaceMeta: {
    color: '#a8b3c7',
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
    marginHorizontal: -6,
    paddingHorizontal: 6,
  },
  groupLabel: {
    color: colors.brandGlow,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 5,
    paddingLeft: 10,
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
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sidebarItemActive: {
    backgroundColor: colors.surface,
    borderColor: '#b8c9ff',
    shadowColor: '#63e6ff',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  activeRail: {
    position: 'absolute',
    left: -14,
    width: 4,
    height: 28,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  activeRailOn: {
    backgroundColor: colors.brandGlow,
  },
  navIcon: {
    width: 36,
    height: 36,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  navIconActive: {
    backgroundColor: colors.softBlue,
    borderColor: '#c7d7ff',
  },
  navCopy: {
    flex: 1,
    minWidth: 0,
  },
  navLabel: {
    color: '#f7f9ff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  navLabelActive: {
    color: colors.ink,
  },
  navDescription: {
    color: '#8e9bb2',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  sidebarFooter: {
    minHeight: 46,
    justifyContent: 'flex-end',
  },
  footerCard: {
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  footerKicker: {
    color: '#8e9bb2',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  footerTitle: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  footerDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
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
    left: 10,
    right: 10,
    bottom: 10,
    height: 66,
    borderRadius: 8,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.24)',
    shadowColor: '#111318',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  bottomItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bottomItemActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  bottomIcon: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  bottomIconActive: {
    backgroundColor: colors.softBlue,
  },
  bottomLabel: {
    color: '#dce7f7',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  bottomLabelActive: {
    color: colors.brandDeep,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11, 13, 18, 0.58)',
  },
  menuSheet: {
    margin: 12,
    borderRadius: 8,
    padding: 12,
    gap: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  menuHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  menuHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  menuTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  menuSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  menuClose: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  menuItem: {
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  menuItemActive: {
    backgroundColor: colors.softBlue,
    borderColor: '#b8c9ff',
  },
  menuItemLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
});
