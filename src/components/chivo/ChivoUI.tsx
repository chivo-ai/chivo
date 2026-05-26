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
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
        {body ? <Text style={styles.sectionBody}>{body}</Text> : null}
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
      {icon}
      <Text style={[styles.actionText, variant === 'secondary' || variant === 'ghost' ? styles.actionTextDark : null]}>
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
  return (
    <View style={[styles.metric, metricTones[tone]]}>
      {icon ? <View style={styles.metricIcon}>{icon}</View> : null}
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
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
            {item.icon}
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item.label}</Text>
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
        <Text style={styles.emptyTitle}>{title}</Text>
        {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
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
    backgroundColor: colors.surfaceSoft,
    borderColor: chivoTheme.hairline,
  },
  night: {
    backgroundColor: colors.night,
    borderColor: '#1e3a31',
  },
  brand: {
    backgroundColor: colors.brandDeep,
    borderColor: '#1d6f5f',
  },
  gold: {
    backgroundColor: colors.softGold,
    borderColor: '#efd178',
  },
  blue: {
    backgroundColor: colors.softBlue,
    borderColor: '#bcd8ea',
  },
  violet: {
    backgroundColor: '#f0e9ff',
    borderColor: '#d4c5ff',
  },
  success: {
    backgroundColor: '#e8f8ee',
    borderColor: '#b7e0ca',
  },
});

const metricTones = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderColor: chivoTheme.hairline,
  },
  soft: {
    backgroundColor: colors.surfaceSoft,
    borderColor: chivoTheme.hairline,
  },
  night: {
    backgroundColor: colors.nightSoft,
    borderColor: '#1e3a31',
  },
  brand: {
    backgroundColor: colors.softTeal,
    borderColor: '#cfe6dd',
  },
  gold: {
    backgroundColor: colors.softGold,
    borderColor: '#efd178',
  },
  blue: {
    backgroundColor: colors.softBlue,
    borderColor: '#bcd8ea',
  },
  violet: {
    backgroundColor: '#f0e9ff',
    borderColor: '#d4c5ff',
  },
  success: {
    backgroundColor: '#e8f8ee',
    borderColor: '#b7e0ca',
  },
});

const actionStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandDeep,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: chivoTheme.hairline,
  },
  ghost: {
    backgroundColor: colors.softTeal,
    borderColor: '#d4e8df',
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
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  cardCompact: {
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },
  sectionHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionHeaderCompact: {
    minHeight: 38,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.brandDeep,
    fontSize: typeScale.eyebrow,
    lineHeight: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typeScale.title,
    lineHeight: 20,
    fontWeight: '800',
  },
  sectionBody: {
    color: colors.muted,
    fontSize: typeScale.body,
    lineHeight: 16,
    fontWeight: '600',
  },
  action: {
    minHeight: 36,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
  },
  actionCompact: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  actionText: {
    color: '#ffffff',
    fontSize: typeScale.label,
    fontWeight: '800',
  },
  actionTextDark: {
    color: colors.brandDeep,
  },
  disabled: {
    opacity: 0.5,
  },
  metric: {
    minWidth: 96,
    flex: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  metricValue: {
    color: colors.ink,
    fontSize: typeScale.titleLg,
    lineHeight: 22,
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: typeScale.caption,
    lineHeight: 14,
    fontWeight: '700',
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: chivoTheme.hairline,
  },
  segment: {
    minHeight: 32,
    flex: 1,
    minWidth: 96,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  segmentActive: {
    backgroundColor: colors.brandDeep,
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
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: typeScale.title,
    lineHeight: 20,
    fontWeight: '800',
  },
  emptyBody: {
    color: colors.muted,
    fontSize: typeScale.body,
    lineHeight: 16,
    fontWeight: '600',
  },
});
