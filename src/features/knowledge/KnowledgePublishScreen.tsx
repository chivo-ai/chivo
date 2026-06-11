import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookOpen, FileText, PenLine, Send, ShieldCheck, Sparkles } from 'lucide-react-native';

import { RouteScreen } from '../app/RouteScreen';
import {
  fetchMyKnowledgeAssets,
  publishKnowledgeAsset,
  saveKnowledgeDraft,
  submitKnowledgeAssetForReview,
} from '../../services/knowledgePublishing';
import type {
  PublishedKnowledgeAsset,
  PublishAccessMode,
  PublishAssetType,
  PublishOwnershipMode,
  PublishVisibility,
} from '../../services/knowledgePublishing';
import { colors } from '../../theme/tokens';

type PublishForm = {
  assetId?: string;
  assetType: PublishAssetType;
  title: string;
  summary: string;
  body: string;
  visibility: Exclude<PublishVisibility, 'chivo_approved'>;
  accessMode: PublishAccessMode;
  ownershipMode: PublishOwnershipMode;
};

const assetTypeOptions: PublishAssetType[] = ['article', 'story', 'research_paper', 'study', 'report', 'lesson', 'publication'];
const visibilityOptions: PublishForm['visibility'][] = ['public', 'unlisted', 'private'];
const accessModeOptions: PublishAccessMode[] = ['free', 'paid', 'holders_only', 'sponsors_only', 'disabled'];
const ownershipModeOptions: PublishOwnershipMode[] = ['none', 'membership_pass', 'limited_editions', 'open_editions', 'certificate'];

const emptyPublishForm: PublishForm = {
  assetType: 'article',
  title: '',
  summary: '',
  body: '',
  visibility: 'public',
  accessMode: 'free',
  ownershipMode: 'none',
};

export function KnowledgePublishScreen() {
  const [assets, setAssets] = useState<PublishedKnowledgeAsset[]>([]);
  const [form, setForm] = useState<PublishForm>(emptyPublishForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      setAssets(await fetchMyKnowledgeAssets());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load your publishing workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action: string, task: () => Promise<PublishedKnowledgeAsset>) {
    setSaving(action);
    setMessage(null);

    try {
      const asset = await task();
      setForm(formFromAsset(asset));
      setAssets(await fetchMyKnowledgeAssets());
      setMessage(action === 'review' ? 'Submitted for Chivo review.' : 'Knowledge saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Publishing action failed.');
    } finally {
      setSaving(null);
    }
  }

  function resetForm() {
    setForm(emptyPublishForm);
    setMessage(null);
  }

  return (
    <RouteScreen>
      <View style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <PenLine size={24} color={colors.ink} />
          </View>
          <View style={styles.flexText}>
            <View style={styles.pill}>
              <Sparkles size={12} color={colors.ink} />
              <Text style={styles.pillText} numberOfLines={1}>Creator studio</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>Publish articles, stories, research, studies, reports, and lessons.</Text>
            <Text style={styles.subtitle} numberOfLines={3}>Write once, then decide access, review status, ownership edition mode, and future monetization without changing app code.</Text>
          </View>
        </View>

        {message ? <Text style={styles.noticeText}>{message}</Text> : null}

        <View style={styles.editorShell}>
          <View style={styles.editorHeader}>
            <View style={styles.flexText}>
              <Text style={styles.sectionTitle} numberOfLines={1}>{form.assetId ? 'Edit knowledge' : 'New knowledge'}</Text>
              <Text style={styles.sectionMeta} numberOfLines={1}>Draft, publish, or submit for Chivo approval.</Text>
            </View>
            <Pressable onPress={resetForm} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText} numberOfLines={1}>New</Text>
            </Pressable>
          </View>

          <ChoiceRow values={assetTypeOptions} selected={form.assetType} onSelect={(assetType) => setForm((current) => ({ ...current, assetType }))} />

          <View style={styles.formGrid}>
            <TextInput
              value={form.title}
              onChangeText={(title) => setForm((current) => ({ ...current, title }))}
              placeholder="Title"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <TextInput
              value={form.summary}
              onChangeText={(summary) => setForm((current) => ({ ...current, summary }))}
              placeholder="Short summary"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>

          <TextInput
            value={form.body}
            onChangeText={(body) => setForm((current) => ({ ...current, body }))}
            placeholder="Write the full article, story, study, report, lesson, or research body..."
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, styles.bodyInput]}
          />

          <View style={styles.optionBlock}>
            <Text style={styles.optionLabel}>Visibility</Text>
            <ChoiceRow values={visibilityOptions} selected={form.visibility} onSelect={(visibility) => setForm((current) => ({ ...current, visibility }))} />
          </View>
          <View style={styles.optionBlock}>
            <Text style={styles.optionLabel}>Access</Text>
            <ChoiceRow values={accessModeOptions} selected={form.accessMode} onSelect={(accessMode) => setForm((current) => ({ ...current, accessMode }))} />
          </View>
          <View style={styles.optionBlock}>
            <Text style={styles.optionLabel}>Ownership</Text>
            <ChoiceRow values={ownershipModeOptions} selected={form.ownershipMode} onSelect={(ownershipMode) => setForm((current) => ({ ...current, ownershipMode }))} />
          </View>

          <View style={styles.actionRow}>
            <ActionButton
              label={saving === 'draft' ? 'Saving' : 'Save draft'}
              icon={saving === 'draft' ? <ActivityIndicator color={colors.ink} /> : <BookOpen size={15} color={colors.ink} />}
              disabled={saving !== null || !form.title.trim()}
              onPress={() => runAction('draft', () => saveKnowledgeDraft(form))}
            />
            <ActionButton
              label={saving === 'publish' ? 'Publishing' : 'Publish'}
              icon={saving === 'publish' ? <ActivityIndicator color="#ffffff" /> : <Send size={15} color="#ffffff" />}
              disabled={saving !== null || !form.title.trim() || !form.body.trim()}
              onPress={() => runAction('publish', () => publishKnowledgeAsset(form))}
              primary
            />
            <ActionButton
              label={saving === 'review' ? 'Submitting' : 'Submit review'}
              icon={saving === 'review' ? <ActivityIndicator color={colors.ink} /> : <ShieldCheck size={15} color={colors.ink} />}
              disabled={saving !== null || !form.assetId}
              onPress={() => form.assetId ? runAction('review', () => submitKnowledgeAssetForReview(form.assetId as string)) : undefined}
            />
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View style={styles.flexText}>
            <Text style={styles.sectionTitle} numberOfLines={1}>My knowledge</Text>
            <Text style={styles.sectionMeta} numberOfLines={1}>Drafts, published assets, and review status.</Text>
          </View>
        </View>

        <View style={styles.assetList}>
          {loading ? (
            <EmptyPanel icon={<ActivityIndicator color={colors.brandDeep} />} text="Loading your drafts..." />
          ) : assets.length ? assets.map((asset) => (
            <Pressable key={asset.id} onPress={() => setForm(formFromAsset(asset))} style={styles.assetRow}>
              <View style={styles.assetIcon}>
                <FileText size={18} color={colors.ink} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.assetTitle} numberOfLines={1}>{asset.title}</Text>
                <Text style={styles.assetMeta} numberOfLines={1}>{cleanLabel(asset.assetType)} - {asset.status} - {asset.aiReviewStatus}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText} numberOfLines={1}>{asset.accessMode}</Text>
              </View>
            </Pressable>
          )) : (
            <EmptyPanel icon={<FileText size={20} color={colors.ink} />} text="Your drafts and published knowledge will appear here." />
          )}
        </View>
      </View>
    </RouteScreen>
  );
}

function ChoiceRow<T extends string>({ values, selected, onSelect }: { values: T[]; selected: T; onSelect: (value: T) => void }) {
  return (
    <View style={styles.choiceRow}>
      {values.map((value) => {
        const active = selected === value;
        return (
          <Pressable key={value} onPress={() => onSelect(value)} style={[styles.choiceChip, active && styles.choiceChipActive]}>
            <Text style={[styles.choiceText, active && styles.choiceTextActive]} numberOfLines={1}>{cleanLabel(value)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ActionButton({ icon, label, disabled, onPress, primary }: { icon: ReactNode; label: string; disabled?: boolean; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.actionButton, primary && styles.actionButtonPrimary, disabled && styles.actionButtonDisabled]}>
      {icon}
      <Text style={[styles.actionButtonText, primary && styles.actionButtonTextPrimary]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function EmptyPanel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.emptyPanel}>
      {icon}
      <Text style={styles.emptyText} numberOfLines={2}>{text}</Text>
    </View>
  );
}

function formFromAsset(asset: PublishedKnowledgeAsset): PublishForm {
  return {
    assetId: asset.id,
    assetType: asset.assetType,
    title: asset.title,
    summary: asset.summary ?? '',
    body: asset.body,
    visibility: asset.visibility === 'chivo_approved' ? 'public' : asset.visibility,
    accessMode: asset.accessMode,
    ownershipMode: asset.ownershipMode,
  };
}

function cleanLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  screen: {
    gap: 14,
  },
  hero: {
    minHeight: 180,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
  },
  pill: {
    alignSelf: 'flex-start',
    minHeight: 28,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
  },
  pillText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: '#ffffff',
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
  },
  subtitle: {
    color: '#d8e0ef',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  noticeText: {
    color: colors.brandDeep,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  editorShell: {
    borderRadius: 8,
    padding: 14,
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  editorHeader: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionHeading: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  secondaryButtonText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  choiceChip: {
    minHeight: 32,
    borderRadius: 8,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  choiceChipActive: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandGlow,
  },
  choiceText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  choiceTextActive: {
    color: '#ffffff',
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  input: {
    flex: 1,
    minWidth: 240,
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  bodyInput: {
    minHeight: 170,
    textAlignVertical: 'top',
  },
  optionBlock: {
    gap: 7,
  },
  optionLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  actionButtonPrimary: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  actionButtonTextPrimary: {
    color: '#ffffff',
  },
  assetList: {
    gap: 9,
  },
  assetRow: {
    minHeight: 72,
    borderRadius: 8,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  assetIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  assetTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  assetMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  badge: {
    maxWidth: 108,
    minHeight: 28,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  badgeText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  emptyPanel: {
    flex: 1,
    minHeight: 76,
    minWidth: 220,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  emptyText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
});
