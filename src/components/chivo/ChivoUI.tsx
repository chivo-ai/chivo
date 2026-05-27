import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { chivoTheme, colors, radii, spacing, typeScale } from '../../theme/tokens';

type Tone = 'surface' | 'soft' | 'night' | 'brand' | 'gold' | 'blue' | 'violet' | 'success';
type ActionVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function ChivoStack({
  children,
  gap = 'md',
  style,
}: {
  children: ReactNode;
  gap?: keyof typeof spacing;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.stack, { gap: spacing[gap] }, style]}>{children}</View>;
}

export function ChivoCard({
  children,
  tone = 'surface',
  compact,
  onPress,
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  compact?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const cardStyle = [styles.card, toneStyles[tone], compact && styles.cardCompact, style];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

export function ChivoSectionHeader({
  eyebrow,
  title,
  body,
  icon,
  action,
  compact,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <View style={[styles.sectionHeader, compact && styles.sectionHeaderCompact]}>
      {icon ? <View style={styles.headerIcon}>{icon}</View> : null}
      <View style={styles.flexText}>
        {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle} numberOfLines={2}>{title}</Text>
        {body ? <Text style={styles.sectionBody} numberOfLines={3}>{body}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function ChivoAction({
  label,
  icon,
  onPress,
  disabled,
  variant = 'primary',
  compact,
  style,
}: {
  label: string;
  icon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ActionVariant;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const darkText = variant === 'secondary' || variant === 'ghost';

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        actionStyles[variant],
        compact && styles.actionCompact,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon ? <View style={[styles.actionIcon, darkText && styles.actionIconSoft]}>{icon}</View> : null}
      <Text style={[styles.actionText, darkText ? styles.actionTextDark : null]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChivoMetric({
  label,
  value,
  icon,
  tone = 'soft',
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: Tone;
}) {
  const darkTone = tone === 'night';

  return (
    <View style={[styles.metric, metricTones[tone]]}>
      <View style={styles.metricTop}>
        {icon ? <View style={styles.metricIcon}>{icon}</View> : <View style={styles.metricDot} />}
        <Text style={[styles.metricLabel, darkTone && styles.metricLabelDark]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, darkTone && styles.metricValueDark]} numberOfLines={1}>{value}</Text>
      <View style={styles.metricTrack}>
        <View style={styles.metricFill} />
      </View>
    </View>
  );
}

export function ChivoSegmented<T extends string>({
  items,
  activeId,
  onChange,
}: {
  items: Array<{ id: T; label: string; icon?: ReactNode }>;
  activeId: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {items.map((item) => {
        const active = item.id === activeId;

        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            {item.icon ? (
              <View style={[styles.segmentIcon, active && styles.segmentIconActive]}>{item.icon}</View>
            ) : null}
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ChivoEmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <ChivoCard tone="soft" compact style={styles.emptyState}>
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <View style={styles.flexText}>
        <Text style={styles.emptyTitle} numberOfLines={2}>{title}</Text>
        {body ? <Text style={styles.emptyBody} numberOfLines={3}>{body}</Text> : null}
      </View>
      {action}
    </ChivoCard>
  );
}

const toneStyles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderColor: chivoTheme.hairline,
  },
  soft: {
    backgroundColor: '#f8fafc',
    borderColor: '#dfe6f0',
  },
  night: {
    backgroundColor: colors.brandDeep,
    borderColor: '#2b3448',
  },
  brand: {
    backgroundColor: '#12224a',
    borderColor: '#315dff',
  },
  gold: {
    backgroundColor: colors.softGold,
    borderColor: '#f3d055',
  },
  blue: {
    backgroundColor: colors.softBlue,
    borderColor: '#aac6ff',
  },
  violet: {
    backgroundColor: '#f3efff',
    borderColor: '#c9bbff',
  },
  success: {
    backgroundColor: '#e8f9f0',
    borderColor: '#aee6c8',
  },
});

const metricTones = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderColor: chivoTheme.hairline,
  },
  soft: {
    backgroundColor: '#f8fafc',
    borderColor: '#dfe6f0',
  },
  night: {
    backgroundColor: '#0f172a',
    borderColor: '#2b3448',
  },
  brand: {
    backgroundColor: colors.softBlue,
    borderColor: '#aac6ff',
  },
  gold: {
    backgroundColor: colors.softGold,
    borderColor: '#f3d055',
  },
  blue: {
    backgroundColor: colors.softBlue,
    borderColor: '#aac6ff',
  },
  violet: {
    backgroundColor: '#f3efff',
    borderColor: '#c9bbff',
  },
  success: {
    backgroundColor: '#e8f9f0',
    borderColor: '#aee6c8',
  },
});

const actionStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: '#cfd8e5',
  },
  ghost: {
    backgroundColor: colors.softBlue,
    borderColor: '#c7d7ff',
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
});

const styles = StyleSheet.create({
  stack: {
    width: '100%',
  },
  card: {
    borderRadius: radii.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderTopWidth: 4,
    gap: spacing.lg,
    ...chivoTheme.shadow,
  },
  cardCompact: {
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  sectionHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  sectionHeaderCompact: {
    minHeight: 42,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
    shadowColor: colors.brand,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: typeScale.eyebrow,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typeScale.title,
    lineHeight: 22,
    fontWeight: '800',
  },
  sectionBody: {
    color: colors.muted,
    fontSize: typeScale.body,
    lineHeight: 18,
    fontWeight: '600',
  },
  action: {
    minHeight: 42,
    minWidth: 0,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
  },
  actionCompact: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  actionIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  actionIconSoft: {
    backgroundColor: '#eef3fb',
    borderWidth: 1,
    borderColor: '#d7e1ef',
  },
  actionText: {
    color: '#ffffff',
    fontSize: typeScale.label,
    lineHeight: 15,
    fontWeight: '800',
  },
  actionTextDark: {
    color: colors.brandDeep,
  },
  disabled: {
    opacity: 0.5,
  },
  metric: {
    minWidth: 126,
    flex: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderBottomWidth: 4,
    gap: spacing.md,
  },
  metricTop: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  metricDot: {
    width: 32,
    height: 32,
    borderRadius: radii.xs,
    backgroundColor: colors.brandDeep,
    borderWidth: 6,
    borderColor: colors.mint,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  metricValueDark: {
    color: '#ffffff',
  },
  metricLabel: {
    flex: 1,
    color: colors.muted,
    fontSize: typeScale.caption,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricLabelDark: {
    color: '#b8c4d8',
  },
  metricTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(17, 19, 24, 0.08)',
  },
  metricFill: {
    width: '58%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.brandDeep,
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: '#eef3fb',
    borderWidth: 1,
    borderColor: '#d9e1ee',
  },
  segment: {
    minHeight: 36,
    flex: 1,
    minWidth: 96,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  segmentActive: {
    backgroundColor: colors.brandDeep,
  },
  segmentIcon: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5f2',
  },
  segmentIconActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  segmentText: {
    color: colors.muted,
    fontSize: typeScale.label,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: typeScale.title,
    lineHeight: 22,
    fontWeight: '800',
  },
  emptyBody: {
    color: colors.muted,
    fontSize: typeScale.body,
    lineHeight: 18,
    fontWeight: '600',
  },
});
