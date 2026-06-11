import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Banknote, BadgeCheck, Layers, RefreshCw, ShieldCheck, Store, Wallet } from 'lucide-react-native';

import { RouteScreen } from '../app/RouteScreen';
import { fetchKnowledgeMarketplaceCatalog } from '../../services/knowledgeMarketplace';
import type { KnowledgeAsset, KnowledgeMarketplaceCatalog, OwnershipProviderSetting, PlatformFeePolicy } from '../../services/knowledgeMarketplace';
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
  { background: '#fff4c2', accent: colors.amber },
  { background: '#f3efff', accent: colors.violet },
];

export function KnowledgeMarketScreen() {
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
  const ownableAssets = useMemo(
    () => catalog.publicAssets.filter((asset) => asset.ownershipMode !== 'none' || asset.accessMode !== 'free'),
    [catalog.publicAssets],
  );
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
      setMessage(error instanceof Error ? error.message : 'Unable to load marketplace.');
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
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Store size={25} color={colors.ink} />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.title} numberOfLines={2}>Knowledge marketplace</Text>
            <Text style={styles.subtitle} numberOfLines={3}>Paid access, ownership editions, membership passes, royalties, provider adapters, and platform fees stay configurable.</Text>
          </View>
          <View style={styles.statGrid}>
            <StatTile icon={<Wallet size={17} color={colors.ink} />} label="Providers" value={providers.length} tone={tones[0]} />
            <StatTile icon={<Banknote size={17} color={colors.ink} />} label="Fee bps" value={averageFeeBps} tone={tones[2]} />
            <StatTile icon={<ShieldCheck size={17} color={colors.ink} />} label="Ownable" value={ownableAssets.length} tone={tones[1]} />
          </View>
        </View>

        <SectionHeader title="Provider adapters" meta="Crossmint, thirdweb, marketplace, funding, storage, and future providers." loading={loading} onRefresh={load} />
        {message ? <Text style={styles.errorText}>{message}</Text> : null}

        <View style={styles.providerGrid}>
          {providers.length ? providers.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          )) : (
            <EmptyPanel icon={<Wallet size={20} color={colors.ink} />} text="Run Group 15 to load provider settings." />
          )}
        </View>

        <SectionHeader title="Fee policies" meta="Platform revenue rules are data, not hardcoded app constants." />
        <View style={styles.feeGrid}>
          {catalog.feePolicies.length ? catalog.feePolicies.slice(0, 8).map((policy) => (
            <FeeCard key={policy.id} policy={policy} />
          )) : (
            <EmptyPanel icon={<Banknote size={20} color={colors.ink} />} text="Fee policies will appear after the monetization migration is applied." />
          )}
        </View>

        <SectionHeader title="Ownable knowledge" meta="Paid access and ownership-enabled assets." />
        <View style={styles.list}>
          {ownableAssets.length ? ownableAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          )) : (
            <EmptyPanel icon={<BadgeCheck size={20} color={colors.ink} />} text="Ownership-enabled knowledge assets will appear after creators publish them." />
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

function ProviderCard({ provider }: { provider: OwnershipProviderSetting }) {
  const enabled = provider.status === 'enabled';

  return (
    <View style={styles.providerCard}>
      <View style={styles.cardTop}>
        <View style={styles.cardIcon}>
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

function FeeCard({ policy }: { policy: PlatformFeePolicy }) {
  return (
    <View style={styles.feeCard}>
      <Text style={styles.cardTitle} numberOfLines={1}>{policy.feeType.replace('_', ' ')}</Text>
      <Text style={styles.feeValue} numberOfLines={1}>{policy.basisPoints} bps</Text>
      <Text style={styles.cardMeta} numberOfLines={1}>{policy.chain ?? 'all chains'} - {policy.currency ?? 'all currencies'}</Text>
    </View>
  );
}

function AssetCard({ asset }: { asset: KnowledgeAsset }) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowIcon}>
        <BadgeCheck size={18} color={colors.ink} />
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

function StatTile({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: { background: string; accent: string } }) {
  return (
    <View style={[styles.statTile, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <View style={[styles.statIcon, { backgroundColor: tone.accent }]}>{icon}</View>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
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
  hero: {
    minHeight: 180,
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
    backgroundColor: colors.mint,
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
  statGrid: {
    minWidth: 260,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statTile: {
    minWidth: 112,
    flex: 1,
    borderRadius: 8,
    padding: 10,
    gap: 6,
    borderWidth: 1,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
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
  cardIcon: {
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
    textTransform: 'capitalize',
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  feeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  feeCard: {
    minWidth: 170,
    flex: 1,
    borderRadius: 8,
    padding: 13,
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  feeValue: {
    color: colors.brandDeep,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
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
    backgroundColor: colors.softTeal,
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
