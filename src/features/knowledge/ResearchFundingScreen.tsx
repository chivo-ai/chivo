import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Banknote, FileText, RefreshCw, Rocket, Save, Trophy } from 'lucide-react-native';

import { RouteScreen } from '../app/RouteScreen';
import { fetchKnowledgeMarketplaceCatalog } from '../../services/knowledgeMarketplace';
import type { FundingCampaign, KnowledgeMarketplaceCatalog } from '../../services/knowledgeMarketplace';
import {
  fetchMyFundingCampaigns,
  saveFundingCampaign,
} from '../../services/knowledgePublishing';
import type { FundingCampaignStatus, PublishedFundingCampaign } from '../../services/knowledgePublishing';
import { colors } from '../../theme/tokens';

const emptyCatalog: KnowledgeMarketplaceCatalog = {
  ownershipProviders: [],
  marketplaceProviders: [],
  fundingProviders: [],
  feePolicies: [],
  publicAssets: [],
  fundingCampaigns: [],
};

type CampaignForm = {
  campaignId?: string;
  title: string;
  summary: string;
  goalAmount: string;
  currency: string;
  preferredChain: string;
  fundingStatus: FundingCampaignStatus;
  recognitionTiers: string;
};

const emptyForm: CampaignForm = {
  title: '',
  summary: '',
  goalAmount: '',
  currency: 'POL',
  preferredChain: 'polygon',
  fundingStatus: 'draft',
  recognitionTiers: 'early access, contributor badge, funding certificate',
};

const statusOptions: FundingCampaignStatus[] = ['draft', 'under_review', 'active'];

export function ResearchFundingScreen() {
  const [catalog, setCatalog] = useState<KnowledgeMarketplaceCatalog>(emptyCatalog);
  const [myCampaigns, setMyCampaigns] = useState<PublishedFundingCampaign[]>([]);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeCampaigns = useMemo(() => catalog.fundingCampaigns, [catalog.fundingCampaigns]);
  const totalRaised = useMemo(
    () => activeCampaigns.reduce((sum, campaign) => sum + (Number(campaign.raisedAmount) || 0), 0),
    [activeCampaigns],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [nextCatalog, nextMyCampaigns] = await Promise.all([
        fetchKnowledgeMarketplaceCatalog(),
        fetchMyFundingCampaigns(),
      ]);
      setCatalog(nextCatalog);
      setMyCampaigns(nextMyCampaigns);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load research funding.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveCampaign(nextStatus: FundingCampaignStatus) {
    setSaving(nextStatus);
    setMessage(null);

    try {
      const campaign = await saveFundingCampaign({
        campaignId: form.campaignId,
        title: form.title,
        summary: form.summary,
        goalAmount: form.goalAmount,
        currency: form.currency,
        preferredChain: form.preferredChain,
        fundingStatus: nextStatus,
        recognitionTiers: form.recognitionTiers.split(',').map((tier) => tier.trim()).filter(Boolean),
      });
      setForm(formFromCampaign(campaign));
      const [nextCatalog, nextMyCampaigns] = await Promise.all([
        fetchKnowledgeMarketplaceCatalog(),
        fetchMyFundingCampaigns(),
      ]);
      setCatalog(nextCatalog);
      setMyCampaigns(nextMyCampaigns);
      setMessage(nextStatus === 'active' ? 'Funding campaign launched.' : 'Funding campaign saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Funding campaign action failed.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <RouteScreen>
      <View style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Trophy size={25} color={colors.ink} />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.title} numberOfLines={2}>Research funding</Text>
            <Text style={styles.subtitle} numberOfLines={3}>Launch community-backed research projects with contributor recognition, crypto checkout, and future ownership rewards.</Text>
          </View>
          <View style={styles.heroStats}>
            <StatPill icon={<FileText size={14} color={colors.ink} />} label="Campaigns" value={activeCampaigns.length} />
            <StatPill icon={<Banknote size={14} color={colors.ink} />} label="Raised" value={totalRaised} />
          </View>
        </View>

        {message ? <Text style={styles.noticeText}>{message}</Text> : null}

        <View style={styles.formPanel}>
          <View style={styles.panelHeader}>
            <View style={styles.flexText}>
              <Text style={styles.sectionTitle} numberOfLines={1}>{form.campaignId ? 'Edit campaign' : 'New campaign'}</Text>
              <Text style={styles.sectionMeta} numberOfLines={1}>Campaign data is off-chain; payments and confirmations use enabled rails.</Text>
            </View>
            <Pressable onPress={() => setForm(emptyForm)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText} numberOfLines={1}>New</Text>
            </Pressable>
          </View>

          <View style={styles.formGrid}>
            <TextInput
              value={form.title}
              onChangeText={(title) => setForm((current) => ({ ...current, title }))}
              placeholder="Research project title"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <TextInput
              value={form.goalAmount}
              onChangeText={(goalAmount) => setForm((current) => ({ ...current, goalAmount }))}
              placeholder="Goal amount"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>

          <TextInput
            value={form.summary}
            onChangeText={(summary) => setForm((current) => ({ ...current, summary }))}
            placeholder="Research summary, purpose, and expected impact"
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, styles.summaryInput]}
          />

          <View style={styles.formGrid}>
            <TextInput
              value={form.currency}
              onChangeText={(currency) => setForm((current) => ({ ...current, currency: currency.toUpperCase() }))}
              placeholder="Currency"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <TextInput
              value={form.preferredChain}
              onChangeText={(preferredChain) => setForm((current) => ({ ...current, preferredChain }))}
              placeholder="Preferred chain"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>

          <TextInput
            value={form.recognitionTiers}
            onChangeText={(recognitionTiers) => setForm((current) => ({ ...current, recognitionTiers }))}
            placeholder="Recognition tiers, separated by commas"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <ChoiceRow values={statusOptions} selected={form.fundingStatus} onSelect={(fundingStatus) => setForm((current) => ({ ...current, fundingStatus }))} />

          <View style={styles.actionRow}>
            <ActionButton
              label={saving === 'draft' ? 'Saving' : 'Save draft'}
              icon={saving === 'draft' ? <ActivityIndicator color={colors.ink} /> : <Save size={15} color={colors.ink} />}
              disabled={saving !== null || !form.title.trim() || !form.goalAmount.trim()}
              onPress={() => saveCampaign('draft')}
            />
            <ActionButton
              label={saving === 'active' ? 'Launching' : 'Launch'}
              icon={saving === 'active' ? <ActivityIndicator color="#ffffff" /> : <Rocket size={15} color="#ffffff" />}
              disabled={saving !== null || !form.title.trim() || !form.goalAmount.trim()}
              onPress={() => saveCampaign('active')}
              primary
            />
          </View>
        </View>

        <SectionHeader title="My campaigns" meta="Draft, review, and active research funding." onRefresh={load} loading={loading} />
        <View style={styles.list}>
          {myCampaigns.length ? myCampaigns.map((campaign) => (
            <Pressable key={campaign.id} onPress={() => setForm(formFromCampaign(campaign))} style={styles.rowCard}>
              <View style={styles.rowIcon}>
                <Trophy size={18} color={colors.ink} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.rowTitle} numberOfLines={1}>{campaign.title}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>{campaign.raisedAmount} / {campaign.goalAmount} {campaign.currency} - {campaign.status}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText} numberOfLines={1}>Edit</Text>
              </View>
            </Pressable>
          )) : (
            <EmptyPanel icon={<Trophy size={20} color={colors.ink} />} text="Your research funding campaigns will appear here." />
          )}
        </View>

        <SectionHeader title="Public funding" meta="Campaigns visible to supporters." />
        <View style={styles.list}>
          {activeCampaigns.length ? activeCampaigns.map((campaign) => (
            <PublicCampaignCard key={campaign.id} campaign={campaign} />
          )) : (
            <EmptyPanel icon={<Trophy size={20} color={colors.ink} />} text="Public research campaigns will appear after creators launch them." />
          )}
        </View>
      </View>
    </RouteScreen>
  );
}

function SectionHeader({ title, meta, onRefresh, loading }: { title: string; meta: string; onRefresh?: () => void; loading?: boolean }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.flexText}>
        <Text style={styles.sectionTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.sectionMeta} numberOfLines={1}>{meta}</Text>
      </View>
      {onRefresh ? (
        <Pressable onPress={onRefresh} disabled={loading} style={[styles.refreshButton, loading && styles.disabledButton]}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <RefreshCw size={16} color="#ffffff" />}
        </Pressable>
      ) : null}
    </View>
  );
}

function PublicCampaignCard({ campaign }: { campaign: FundingCampaign }) {
  const goal = Number(campaign.goalAmount) || 0;
  const raised = Number(campaign.raisedAmount) || 0;
  const progress = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  return (
    <View style={styles.rowCard}>
      <View style={styles.rowIconGold}>
        <Trophy size={18} color={colors.ink} />
      </View>
      <View style={styles.flexText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{campaign.title}</Text>
        <Text style={styles.rowMeta} numberOfLines={2}>{campaign.summary ?? 'Support this research campaign.'}</Text>
        <Text style={styles.rowMetaStrong} numberOfLines={1}>{raised} / {campaign.goalAmount} {campaign.currency}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>
    </View>
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

function StatPill({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <View style={styles.statPill}>
      {icon}
      <View style={styles.flexText}>
        <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      </View>
    </View>
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

function formFromCampaign(campaign: PublishedFundingCampaign): CampaignForm {
  return {
    campaignId: campaign.id,
    title: campaign.title,
    summary: campaign.summary ?? '',
    goalAmount: String(campaign.goalAmount ?? ''),
    currency: campaign.currency,
    preferredChain: campaign.preferredChain ?? 'polygon',
    fundingStatus: campaign.status === 'active' || campaign.status === 'under_review' ? campaign.status : 'draft',
    recognitionTiers: campaign.recognitionTiers.join(', '),
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
    minHeight: 170,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softGold,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: '#d8e0ef',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  heroStats: {
    minWidth: 210,
    gap: 8,
  },
  statPill: {
    minHeight: 46,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
  },
  statValue: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  noticeText: {
    color: colors.brandDeep,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  formPanel: {
    borderRadius: 8,
    padding: 14,
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  panelHeader: {
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
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  input: {
    flex: 1,
    minWidth: 220,
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
  summaryInput: {
    minHeight: 104,
    textAlignVertical: 'top',
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
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandDeep,
  },
  disabledButton: {
    opacity: 0.55,
  },
  list: {
    gap: 9,
  },
  rowCard: {
    minHeight: 78,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  rowIconGold: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softGold,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  rowMetaStrong: {
    color: colors.ink,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '900',
  },
  badge: {
    maxWidth: 92,
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
  progressTrack: {
    height: 7,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#edf2f7',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.amber,
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
    gap: 5,
  },
});
