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
    backgroundColor: colors.surfaceSoft,
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
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: colors.night,
    borderRightWidth: 1,
    borderRightColor: 'rgba(25, 209, 163, 0.18)',
    overflow: 'hidden',
  },
  sidebarSurfaceExpanded: {
    width: chivoTheme.sidebarExpandedWidth,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 10, height: 0 },
  },
  sidebarTop: {
    gap: 8,
  },
  sidebarBrand: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.nightSoft,
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
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '800',
  },
  sidebarSubtitle: {
    color: '#bdd3ca',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  workspaceCard: {
    minHeight: 54,
    borderRadius: 14,
    padding: 10,
    gap: 4,
    backgroundColor: colors.nightSoft,
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
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '800',
  },
  workspaceMeta: {
    color: '#b9c8c0',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  sidebarItems: {
    gap: 5,
    paddingBottom: 8,
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
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sidebarItemActive: {
    backgroundColor: colors.surface,
    borderColor: colors.brandGlow,
    shadowColor: colors.brandGlow,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
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
    width: 32,
    height: 32,
    borderRadius: 12,
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  navLabelActive: {
    color: colors.ink,
  },
  navDescription: {
    color: '#8fa29a',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  sidebarFooter: {
    minHeight: 36,
    justifyContent: 'flex-end',
  },
  footerCard: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    backgroundColor: colors.surfaceSoft,
  },
  mobileContent: {
    flex: 1,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: chivoTheme.mobileBottomNavHeight,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.night,
    borderTopWidth: 1,
    borderColor: 'rgba(25, 209, 163, 0.2)',
  },
  bottomItem: {
    flex: 1,
    minHeight: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  bottomItemActive: {
    backgroundColor: colors.amber,
  },
  bottomLabel: {
    color: '#dce7e1',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
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
    margin: 10,
    borderRadius: 16,
    padding: 10,
    gap: 8,
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
  menuTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  menuSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  menuClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  menuItem: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 10,
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
    fontSize: 13,
    fontWeight: '800',
  },
});
