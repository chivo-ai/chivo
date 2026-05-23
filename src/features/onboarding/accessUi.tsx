import { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ImageUploadButton } from '../../components/ImageUploadButton';
import { colors } from '../../theme/tokens';

export const stickerPack = [
  { key: 'spark', label: 'Spark', accent: colors.gold },
  { key: 'orbit', label: 'Orbit', accent: colors.blue },
  { key: 'leaf', label: 'Leaf', accent: colors.teal },
  { key: 'coral', label: 'Coral', accent: colors.coral },
];

export function ScreenShell({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function ScreenHeader({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerIcon}>{icon}</View>
      <View style={styles.flexText}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerBody}>{body}</Text>
      </View>
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function CardHeader({ icon, title }: { icon?: ReactNode; title: string }) {
  return (
    <View style={styles.cardHeader}>
      {icon}
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8b9691"
        autoCapitalize={autoCapitalize}
        style={styles.input}
      />
    </View>
  );
}

export function SubmitButton({
  label,
  loading,
  onPress,
  disabled,
}: {
  label: string;
  loading: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable disabled={loading || disabled} onPress={onPress} style={[styles.primaryButton, (loading || disabled) && styles.buttonDisabled]}>
      {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

export function ChoicePill({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choicePill, selected && styles.choicePillActive]}>
      <Text style={[styles.choicePillText, selected && styles.choicePillTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function IdentityMark({
  imageUrl,
  stickerKey,
  label,
  size,
}: {
  imageUrl?: string | null;
  stickerKey?: string | null;
  label: string;
  size: 'small' | 'large';
}) {
  const sticker = stickerPack.find((item) => item.key === stickerKey) ?? stickerPack[0];
  const initials = label
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CH';

  return (
    <View style={[styles.identityMark, size === 'large' && styles.identityMarkLarge, { backgroundColor: sticker.accent }]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.identityImage} resizeMode="cover" />
      ) : (
        <Text style={styles.identityInitials}>{initials}</Text>
      )}
    </View>
  );
}

export function BannerStrip({ imageUrl, stickerKey }: { imageUrl?: string | null; stickerKey?: string | null }) {
  const sticker = stickerPack.find((item) => item.key === stickerKey) ?? stickerPack[0];

  return (
    <View style={[styles.bannerStrip, { backgroundColor: sticker.accent }]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.bannerImage} resizeMode="cover" /> : null}
    </View>
  );
}

export function StickerPicker({ selectedKey, onSelect }: { selectedKey: string; onSelect: (key: string) => void }) {
  return (
    <View style={styles.stickerRow}>
      {stickerPack.map((sticker) => (
        <Pressable
          key={sticker.key}
          onPress={() => onSelect(sticker.key)}
          style={[
            styles.stickerChoice,
            { borderColor: selectedKey === sticker.key ? sticker.accent : colors.line },
          ]}
        >
          <View style={[styles.stickerSwatch, { backgroundColor: sticker.accent }]} />
          <Text style={styles.stickerText}>{sticker.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function UploadPair({
  logoUrl,
  bannerUrl,
  logoPrefix,
  bannerPrefix,
  onLogoUploaded,
  onBannerUploaded,
  onError,
}: {
  logoUrl: string;
  bannerUrl: string;
  logoPrefix: string;
  bannerPrefix: string;
  onLogoUploaded: (value: string) => void;
  onBannerUploaded: (value: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <View style={styles.formRow}>
      <ImageUploadButton
        label={logoUrl ? 'Replace logo' : 'Upload logo'}
        pathPrefix={logoPrefix}
        onUploaded={onLogoUploaded}
        onError={onError}
      />
      <ImageUploadButton
        label={bannerUrl ? 'Replace banner' : 'Upload banner'}
        pathPrefix={bannerPrefix}
        onUploaded={onBannerUploaded}
        onError={onError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 16,
  },
  header: {
    minHeight: 112,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.ink,
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  headerBody: {
    color: '#dce7e1',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
  },
  card: {
    borderRadius: 22,
    padding: 18,
    gap: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardHeader: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.ink,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 15,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  choicePill: {
    minHeight: 36,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  choicePillActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  choicePillText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  choicePillTextActive: {
    color: '#ffffff',
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  identityMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityMarkLarge: {
    width: 76,
    height: 76,
    borderRadius: 24,
  },
  identityImage: {
    width: '100%',
    height: '100%',
  },
  identityInitials: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  bannerStrip: {
    height: 76,
    borderRadius: 18,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  stickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stickerChoice: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
  },
  stickerSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  stickerText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
});
