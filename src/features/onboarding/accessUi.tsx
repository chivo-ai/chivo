import { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';

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
        <Text style={styles.headerTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.headerBody} numberOfLines={2}>{body}</Text>
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
      {icon ? <View style={styles.cardHeaderIcon}>{icon}</View> : null}
      <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
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
      <Text style={styles.fieldLabel} numberOfLines={1}>{label}</Text>
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
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <>
          <Text style={styles.primaryButtonText} numberOfLines={1}>{label}</Text>
          <View style={styles.primaryButtonIcon}>
            <ArrowRight size={15} color="#ffffff" />
          </View>
        </>
      )}
    </Pressable>
  );
}

export function ChoicePill({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choicePill, selected && styles.choicePillActive]}>
      <View style={[styles.choiceDot, selected && styles.choiceDotActive]} />
      <Text style={[styles.choicePillText, selected && styles.choicePillTextActive]} numberOfLines={1}>{label}</Text>
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
          <Text style={styles.stickerText} numberOfLines={1}>{sticker.label}</Text>
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
    gap: 14,
  },
  header: {
    minHeight: 96,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  headerBody: {
    color: '#d8e0ef',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  card: {
    borderRadius: 8,
    padding: 16,
    gap: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderTopWidth: 4,
    borderColor: '#dfe6f0',
    shadowColor: '#111318',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  cardHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  cardTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dfe6f0',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  primaryButtonIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  choicePill: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  choicePillActive: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandDeep,
  },
  choicePillText: {
    maxWidth: 140,
    color: colors.brandDeep,
    fontSize: 13,
    fontWeight: '800',
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
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityMarkLarge: {
    width: 65,
    height: 62,
    borderRadius: 8,
  },
  identityImage: {
    width: '100%',
    height: '100%',
  },
  identityInitials: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  bannerStrip: {
    height: 72,
    borderRadius: 8,
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
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
  },
  stickerSwatch: {
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  stickerText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  choiceDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  choiceDotActive: {
    backgroundColor: colors.mint,
    borderColor: colors.mint,
  },
});
