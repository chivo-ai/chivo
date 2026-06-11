import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Banknote, BookOpen, Layers, RefreshCw, ShieldCheck, Trophy, Wallet } from 'lucide-react-native';

import { RouteScreen } from '../app/RouteScreen';
import { fetchKnowledgeMarketplaceCatalog } from '../../services/knowledgeMarketplace';
import type {
  FundingCampaign,
  KnowledgeAsset,
  KnowledgeMarketplaceCatalog,
  OwnershipProviderSetting,
} from '../../services/knowledgeMarketplace';
import { colors } from '../../theme/tokens';

const emptyCatalog: KnowledgeMarketplaceCatalog = {
  ownershipProviders: [],
  marketplaceProviders: [],
  fundingProviders: [],
  feePolicies: [],
  publicAssets: [],
  fundingCampaigns: [],
};

const tones = [
  { background: '#e9f1ff', accent: colors.brand },
  { background: '#e3fbf7', accent: colors.teal },
  { background: '#f3efff', accent: colors.violet },
  { background: '#fff4c2', accent: colors.amber },
];

export function KnowledgeMarketplaceScreen() {
  const [catalog, setCatalog] = useState<KnowledgeMarketplaceCatalog>(emptyCatalog);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const providers = useMemo(
    () => [
      ...catalog.ownershipProviders,
      ...catalog.marketplaceProviders,
      ...catalog.fundingProviders,
    ],
    [catalog],
  );
  const enabledProviders = useMemo(() => providers.filter((provider) => provider.status === 'enabled').length, [providers]);
  const averageFeeBps = useMemo(() => {
    if (!catalog.feePolicies.length) {
      return 50;
    }

    return Math.round(catalog.feePolicies.reduce((sum, policy) => sum + policy.basisPoints, 0) / catalog.feePolicies.length);
  }, [catalog.feePolicies]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      setCatalog(await fetchKnowledgeMarketplaceCatalog());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load knowledge marketplace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RouteScreen>
      <View style={styles.screen}>
        <View style={styles.headerBand}>
          <View style={styles.headerCopy}>
            <View style={styles.pill}>
              <ShieldCheck size={14} color={colors.ink} />
              <Text style={styles.pillText} numberOfLines={1}>Crypto-native</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>Knowledge</Text>
            <Text style={styles.subtitle} numberOfLines={2}>Ownership, funding, donations, and paid access.</Text>
          </View>

          <View style={styles.statGrid}>
            <StatTile icon={<BookOpen size={18} color={colors.ink} />} label="Assets" value={catalog.publicAssets.length} tone={tones[0]} />
            <StatTile icon={<Trophy size={18} color={colors.ink} />} label="Funding" value={catalog.fundingCampaigns.length} tone={tones[3]} />
            <StatTile icon={<Wallet size={18} color={colors.ink} />} label="Providers" value={enabledProviders} tone={tones[1]} />
            <StatTile icon={<Banknote size={18} color={colors.ink} />} label="Fee bps" value={averageFeeBps} tone={tones[2]} />
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View style={styles.flexText}>
            <Text style={styles.sectionTitle} numberOfLines={1}>Provider layer</Text>
            <Text style={styles.sectionMeta} numberOfLines={1}>{providers.length ? `${providers.length} configured adapter${providers.length === 1 ? '' : 's'}` : 'No adapters configured yet'}</Text>
          </View>
          <Pressable onPress={load} disabled={loading} style={[styles.refreshButton, loading && styles.disabledButton]}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <RefreshCw size={16} color="#ffffff" />}
          </Pressable>
        </View>

        {message ? <Text style={styles.errorText}>{message}</Text> : null}

        <View style={styles.providerGrid}>
          {loading ? (
            <EmptyPanel icon={<ActivityIndicator color={colors.brandDeep} />} text="Loading knowledge rails..." />
          ) : providers.length ? providers.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          )) : (
            <EmptyPanel icon={<Wallet size={19} color={colors.ink} />} text="Run Group 15 to load provider settings." />
          )}
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle} numberOfLines={1}>Public assets</Text>
            <Text style={styles.sectionMeta} numberOfLines={1}>{catalog.publicAssets.length ? 'Published and visible' : 'Nothing published yet'}</Text>
          </View>
        </View>

        <View style={styles.list}>
          {catalog.publicAssets.length ? catalog.publicAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          )) : (
            <EmptyPanel icon={<BookOpen size={19} color={colors.ink} />} text="Published knowledge assets will appear here." />
          )}
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle} numberOfLines={1}>Funding campaigns</Text>
            <Text style={styles.sectionMeta} numberOfLines={1}>{catalog.fundingCampaigns.length ? 'Active, funded, or closed' : 'No campaigns yet'}</Text>
          </View>
        </View>

        <View style={styles.list}>
          {catalog.fundingCampaigns.length ? catalog.fundingCampaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          )) : (
            <EmptyPanel icon={<Trophy size={19} color={colors.ink} />} text="Research funding campaigns will appear here." />
          )}
        </View>
      </View>
    </RouteScreen>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: { background: string; accent: string };
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <View style={[styles.statIcon, { backgroundColor: tone.accent }]}>{icon}</View>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function ProviderCard({ provider }: { provider: OwnershipProviderSetting }) {
  const enabled = provider.status === 'enabled';

  return (
    <View style={styles.providerCard}>
      <View style={styles.cardTop}>
        <View style={styles.providerIcon}>
          <Layers size={18} color={colors.ink} />
        </View>
        <View style={[styles.statusPill, enabled && styles.statusPillEnabled]}>
          <Text style={[styles.statusText, enabled && styles.statusTextEnabled]} numberOfLines={1}>{provider.status}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{provider.displayName}</Text>
      <Text style={styles.cardMeta} numberOfLines={1}>{provider.providerType} - {provider.chain}</Text>
    </View>
  );
}

function AssetCard({ asset }: { asset: KnowledgeAsset }) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowIcon}>
        <BookOpen size={18} color={colors.ink} />
      </View>
      <View style={styles.flexText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{asset.title}</Text>
        <Text style={styles.rowMeta} numberOfLines={2}>{asset.summary ?? `${asset.assetType} - ${asset.ownershipMode}`}</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText} numberOfLines={1}>{asset.accessMode}</Text>
      </View>
    </View>
  );
}

function CampaignCard({ campaign }: { campaign: FundingCampaign }) {
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
        <Text style={styles.rowMeta} numberOfLines={1}>{raised} / {campaign.goalAmount} {campaign.currency}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText} numberOfLines={1}>{campaign.status}</Text>
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

const styles = StyleSheet.create({
  screen: {
    gap: 14,
  },
  headerBand: {
    minHeight: 210,
    borderRadius: 8,
    padding: 16,
    gap: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  headerCopy: {
    flex: 1.2,
    minWidth: 260,
    gap: 10,
  },
  pill: {
    alignSelf: 'flex-start',
    minHeight: 30,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.mint,
  },
  pillText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  subtitle: {
    color: '#d8e0ef',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  statGrid: {
    flex: 1.25,
    minWidth: 280,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  statTile: {
    minWidth: 122,
    flex: 1,
    borderRadius: 8,
    padding: 12,
    gap: 6,
    borderWidth: 1,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  sectionHeading: {
    minHeight: 40,
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
  errorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  providerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  providerCard: {
    minWidth: 185,
    flex: 1,
    borderRadius: 8,
    padding: 13,
    gap: 9,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  cardTop: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  providerIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  statusPill: {
    minHeight: 26,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  statusPillEnabled: {
    backgroundColor: colors.softTeal,
    borderColor: '#85e4d5',
  },
  statusText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusTextEnabled: {
    color: colors.tealDark,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  list: {
    gap: 9,
  },
  rowCard: {
    minHeight: 76,
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
  badge: {
    maxWidth: 112,
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
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
});
