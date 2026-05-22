import { ReactNode, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Grid3X3, Menu, X } from 'lucide-react-native';

import { colors } from '../theme/tokens';

export type AppNavItem<T extends string> = {
  id: T;
  label: string;
  description?: string;
  icon: ReactNode;
  group?: string;
  visible?: boolean;
};

type AppNavigationProps<T extends string> = {
  title: string;
  subtitle: string;
  items: AppNavItem<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  children: ReactNode;
};

const WEB_BREAKPOINT = 860;

export function AppNavigation<T extends string>({
  title,
  subtitle,
  items,
  activeId,
  onSelect,
  children,
}: AppNavigationProps<T>) {
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleItems = useMemo(() => items.filter((item) => item.visible !== false), [items]);
  const primaryMobileItems = visibleItems.slice(0, 4);
  const isWebShell = Platform.OS === 'web' && width >= WEB_BREAKPOINT;

  function select(id: T) {
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
            <View style={styles.sidebarBrand}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>C</Text>
              </View>
              {expanded ? (
                <View style={styles.brandCopy}>
                  <Text style={styles.sidebarTitle}>{title}</Text>
                  <Text style={styles.sidebarSubtitle}>{subtitle}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.sidebarItems}>
              {visibleItems.map((item, index) => {
                const previous = visibleItems[index - 1];
                const showGroup = expanded && item.group && item.group !== previous?.group;

                return (
                  <View key={item.id}>
                    {showGroup ? <Text style={styles.groupLabel}>{item.group}</Text> : null}
                    <Pressable
                      onPress={() => select(item.id)}
                      style={[styles.sidebarItem, activeId === item.id && styles.sidebarItemActive]}
                    >
                      <View style={styles.navIcon}>{item.icon}</View>
                      {expanded ? (
                        <View style={styles.navCopy}>
                          <Text style={[styles.navLabel, activeId === item.id && styles.navLabelActive]}>{item.label}</Text>
                          {item.description ? <Text style={styles.navDescription}>{item.description}</Text> : null}
                        </View>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </Pressable>
        </View>

        <View style={styles.contentPane}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.mobileShell}>
      <View style={styles.mobileContent}>{children}</View>

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
        <Pressable onPress={() => setMenuOpen(true)} style={styles.bottomItem}>
          <Grid3X3 size={20} color="#dce7e1" />
          <Text style={styles.bottomLabel}>More</Text>
        </Pressable>
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
    width: 72,
    minHeight: '100%',
    zIndex: 20,
  },
  sidebarSurface: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 72,
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 16,
    backgroundColor: '#101916',
    borderRightWidth: 1,
    borderRightColor: '#20352f',
    overflow: 'hidden',
  },
  sidebarSurfaceExpanded: {
    width: 238,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 8, height: 0 },
  },
  sidebarBrand: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  brandBadgeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  sidebarTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  sidebarSubtitle: {
    color: '#a7b6b0',
    fontSize: 11,
    lineHeight: 16,
  },
  sidebarItems: {
    gap: 6,
  },
  groupLabel: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 10,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  sidebarItem: {
    minHeight: 46,
    borderRadius: 13,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  sidebarItemActive: {
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  navIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCopy: {
    flex: 1,
    minWidth: 0,
  },
  navLabel: {
    color: '#dce7e1',
    fontSize: 13,
    fontWeight: '900',
  },
  navLabelActive: {
    color: colors.ink,
  },
  navDescription: {
    color: '#82928c',
    fontSize: 11,
    lineHeight: 15,
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
    left: 14,
    right: 14,
    bottom: 14,
    minHeight: 62,
    borderRadius: 22,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#101916',
    borderWidth: 1,
    borderColor: '#20352f',
  },
  bottomItem: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bottomItemActive: {
    backgroundColor: colors.gold,
  },
  bottomLabel: {
    color: '#dce7e1',
    fontSize: 10,
    fontWeight: '900',
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
    borderRadius: 24,
    padding: 16,
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
    fontSize: 18,
    fontWeight: '900',
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
    fontWeight: '900',
  },
});
