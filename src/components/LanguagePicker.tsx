import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, Languages, X } from 'lucide-react-native';

import { colors } from '../theme/tokens';

export type LanguageOption = {
  label: string;
  locale: string;
};

export const languageOptions: LanguageOption[] = [
  { label: 'English', locale: 'en-US' },
  { label: 'French', locale: 'fr-FR' },
  { label: 'Spanish', locale: 'es-ES' },
  { label: 'Portuguese', locale: 'pt-BR' },
  { label: 'Arabic', locale: 'ar' },
  { label: 'Chinese', locale: 'zh-CN' },
  { label: 'German', locale: 'de-DE' },
  { label: 'Italian', locale: 'it-IT' },
  { label: 'Yoruba', locale: 'yo-NG' },
  { label: 'Igbo', locale: 'ig-NG' },
  { label: 'Hausa', locale: 'ha-NG' },
  { label: 'Hindi', locale: 'hi-IN' },
  { label: 'Swahili', locale: 'sw' },
  { label: 'Japanese', locale: 'ja-JP' },
  { label: 'Korean', locale: 'ko-KR' },
];

export function LanguagePicker({
  label = 'Language',
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = languageOptions.find((option) => option.label.toLowerCase() === value.toLowerCase()) ?? languageOptions[0];

  return (
    <View style={styles.wrap}>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={styles.trigger}>
        <View style={styles.triggerIcon}>
          <Languages size={17} color={colors.brandDeep} />
        </View>
        <View style={styles.triggerCopy}>
          <Text style={styles.triggerTitle} numberOfLines={1}>{selected.label}</Text>
          <Text style={styles.triggerMeta} numberOfLines={1}>{selected.locale}</Text>
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle} numberOfLines={1}>Select language</Text>
                <Text style={styles.sheetMeta} numberOfLines={2}>Chivo will write and speak in this language.</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={styles.closeButton}>
                <X size={18} color={colors.brandDeep} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.languageGrid} showsVerticalScrollIndicator={false}>
              {languageOptions.map((option) => {
                const active = option.label === selected.label;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => {
                      onChange(option.label);
                      setOpen(false);
                    }}
                    style={[styles.languageCard, active && styles.languageCardActive]}
                  >
                    <View style={[styles.languageIcon, active && styles.languageIconActive]}>
                      {active ? <Check size={14} color="#ffffff" /> : <Languages size={14} color={colors.brandDeep} />}
                    </View>
                    <View style={styles.languageCopy}>
                      <Text style={[styles.languageTitle, active && styles.languageTitleActive]} numberOfLines={1}>{option.label}</Text>
                      <Text style={[styles.languageMeta, active && styles.languageMetaActive]} numberOfLines={1}>{option.locale}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function speechLocaleForLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  return languageOptions.find((option) => option.label.toLowerCase() === normalized)?.locale ?? 'en-US';
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 190,
    gap: 7,
  },
  label: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  trigger: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  triggerIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  triggerCopy: {
    flex: 1,
    minWidth: 0,
  },
  triggerTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  triggerMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11, 13, 18, 0.58)',
  },
  sheet: {
    maxHeight: '82%',
    margin: 12,
    borderRadius: 8,
    padding: 12,
    gap: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  sheetHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  sheetMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    paddingBottom: 4,
  },
  languageCard: {
    minWidth: 132,
    flex: 1,
    minHeight: 56,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  languageIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  languageIconActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  languageCopy: {
    flex: 1,
    minWidth: 0,
  },
  languageCardActive: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandDeep,
  },
  languageTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  languageTitleActive: {
    color: '#ffffff',
  },
  languageMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  languageMetaActive: {
    color: '#d8e0ef',
  },
});
