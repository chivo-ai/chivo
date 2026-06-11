import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BadgeCheck, Banknote, BookOpen, Bot, ChevronRight, FileText, MessageCircle, PenLine, RefreshCw, Search, Sparkles, Trophy, Users } from 'lucide-react-native';

import { RouteScreen } from '../app/RouteScreen';
import { fetchKnowledgeMarketplaceCatalog } from '../../services/knowledgeMarketplace';
import type { FundingCampaign, KnowledgeAsset, KnowledgeMarketplaceCatalog } from '../../services/knowledgeMarketplace';
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

export function KnowledgeDiscoverScreen() {
  const [catalog, setCatalog] = useState<KnowledgeMarketplaceCatalog>(emptyCatalog);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const featuredAssets = useMemo(() => catalog.publicAssets.slice(0, 8), [catalog.publicAssets]);
  const activeCampaigns = useMemo(() => catalog.fundingCampaigns.slice(0, 4), [catalog.fundingCampaigns]);
  const enabledProviders = useMemo(
    () => [
      ...catalog.ownershipProviders,
      ...catalog.marketplaceProviders,
      ...catalog.fundingProviders,
    ].filter((provider) => provider.status === 'enabled').length,
    [catalog],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      setCatalog(await fetchKnowledgeMarketplaceCatalog());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load the knowledge network.');
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
          <View style={styles.heroCopy}>
            <View style={styles.heroPill}>
              <Sparkles size={12} color={colors.ink} />
              <Text style={styles.heroPillText} numberOfLines={1}>AI-native knowledge network</Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={3}>Discover, publish, fund, and own knowledge.</Text>
            <Text style={styles.heroBody} numberOfLines={3}>
              Follow schools, researchers, teachers, and creators. Read articles, stories, studies, reports, and research with AI-powered discovery.
            </Text>
            <View style={styles.heroActions}>
              <HeroButton label="Publish" icon={<PenLine size={15} color="#ffffff" />} onPress={() => router.push('/publish' as never)} />
              <HeroButton label="Research funding" icon={<Trophy size={15} color={colors.ink} />} onPress={() => router.push('/research' as never)} light />
            </View>
          </View>

          <View style={styles.statGrid}>
            <StatTile icon={<FileText size={18} color={colors.ink} />} label="Public assets" value={catalog.publicAssets.length} tone={tones[0]} />
            <StatTile icon={<Trophy size={18} color={colors.ink} />} label="Campaigns" value={catalog.fundingCampaigns.length} tone={tones[2]} />
            <StatTile icon={<Banknote size={18} color={colors.ink} />} label="Rails" value={enabledProviders} tone={tones[1]} />
            <StatTile icon={<BadgeCheck size={18} color={colors.ink} />} label="Reviewed" value={catalog.publicAssets.filter((asset) => asset.visibility === 'chivo_approved').length} tone={tones[3]} />
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickAction label="Explore feed" body="Articles, stories, studies, lessons" icon={<Search size={18} color={colors.ink} />} tone={tones[0]} onPress={load} />
          <QuickAction label="Create" body="Write and publish knowledge" icon={<PenLine size={18} color={colors.ink} />} tone={tones[1]} onPress={() => router.push('/publish' as never)} />
          <QuickAction label="Fund research" body="Campaigns and contributor badges" icon={<Trophy size={18} color={colors.ink} />} tone={tones[2]} onPress={() => router.push('/research' as never)} />
          <QuickAction label="AI studio" body="Tutor, research, teaching assistant" icon={<Bot size={18} color={colors.ink} />} tone={tones[3]} onPress={() => router.push('/learn' as never)} />
        </View>

        <View style={styles.sectionHeading}>
          <View style={styles.flexText}>
            <Text style={styles.sectionTitle} numberOfLines={1}>Knowledge feed</Text>
            <Text style={styles.sectionMeta} numberOfLines={1}>Public posts from the Chivo network.</Text>
          </View>
          <Pressable onPress={load} disabled={loading} style={[styles.refreshButton, loading && styles.disabledButton]}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <RefreshCw size={16} color="#ffffff" />}
          </Pressable>
        </View>

        {message ? <Text style={styles.errorText}>{message}</Text> : null}

        <View style={styles.feedList}>
          {featuredAssets.length ? featuredAssets.map((asset) => (
            <FeedCard key={asset.id} asset={asset} />
          )) : (
            <EmptyPanel icon={<BookOpen size={20} color={colors.ink} />} text="Published knowledge will appear here after creators publish articles, stories, studies, reports, lessons, or research." />
          )}
        </View>

        <View style={styles.sectionHeading}>
          <View style={styles.flexText}>
            <Text style={styles.sectionTitle} numberOfLines={1}>Research funding</Text>
            <Text style={styles.sectionMeta} numberOfLines={1}>Community-backed education and research projects.</Text>
          </View>
          <Pressable onPress={() => router.push('/research' as never)} style={styles.linkButton}>
            <Text style={styles.linkButtonText} numberOfLines={1}>Open</Text>
            <ChevronRight size={15} color={colors.brandDeep} />
          </Pressable>
        </View>

        <View style={styles.campaignGrid}>
          {activeCampaigns.length ? activeCampaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          )) : (
            <EmptyPanel icon={<Trophy size={20} color={colors.ink} />} text="Research funding campaigns will appear here." />
          )}
        </View>
      </View>
    </RouteScreen>
  );
}

function FeedCard({ asset }: { asset: KnowledgeAsset }) {
  return (
    <View style={styles.feedCard}>
      <View style={styles.feedIcon}>
        <FileText size={20} color={colors.ink} />
      </View>
      <View style={styles.flexText}>
        <View style={styles.feedMetaRow}>
          <Text style={styles.feedType} numberOfLines={1}>{asset.assetType.replace('_', ' ')}</Text>
          {asset.visibility === 'chivo_approved' ? (
            <View style={styles.approvedBadge}>
              <BadgeCheck size={12} color={colors.tealDark} />
              <Text style={styles.approvedText} numberOfLines={1}>Approved</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.feedTitle} numberOfLines={2}>{asset.title}</Text>
        <Text style={styles.feedSummary} numberOfLines={2}>{asset.summary ?? 'Open the knowledge asset to read, collect, fund, or support the creator.'}</Text>
        <View style={styles.socialRow}>
          <SocialPill icon={<Users size={12} color={colors.ink} />} label="Follow creator" />
          <SocialPill icon={<MessageCircle size={12} color={colors.ink} />} label="Discuss" />
          <SocialPill icon={<Banknote size={12} color={colors.ink} />} label={asset.accessMode} />
        </View>
      </View>
    </View>
  );
}

function CampaignCard({ campaign }: { campaign: FundingCampaign }) {
  const goal = Number(campaign.goalAmount) || 0;
  const raised = Number(campaign.raisedAmount) || 0;
  const progress = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  return (
    <View style={styles.campaignCard}>
      <View style={styles.campaignIcon}>
        <Trophy size={19} color={colors.ink} />
      </View>
      <View style={styles.flexText}>
        <Text style={styles.feedTitle} numberOfLines={1}>{campaign.title}</Text>
        <Text style={styles.feedSummary} numberOfLines={2}>{campaign.summary ?? 'Support this research project and receive contributor recognition.'}</Text>
        <Text style={styles.campaignMeta} numberOfLines={1}>{raised} / {campaign.goalAmount} {campaign.currency}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>
    </View>
  );
}

function SocialPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={styles.socialPill}>
      {icon}
      <Text style={styles.socialPillText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function QuickAction({
  label,
  body,
  icon,
  tone,
  onPress,
}: {
  label: string;
  body: string;
  icon: ReactNode;
  tone: { background: string; accent: string };
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.quickCard, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <View style={[styles.quickIcon, { backgroundColor: tone.accent }]}>{icon}</View>
      <Text style={styles.quickTitle} numberOfLines={1}>{label}</Text>
      <Text style={styles.quickBody} numberOfLines={2}>{body}</Text>
    </Pressable>
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

function HeroButton({ label, icon, onPress, light }: { label: string; icon: ReactNode; onPress: () => void; light?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.heroButton, light && styles.heroButtonLight]}>
      {icon}
      <Text style={[styles.heroButtonText, light && styles.heroButtonTextLight]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function EmptyPanel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.emptyPanel}>
      {icon}
      <Text style={styles.emptyText} numberOfLines={3}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 14,
  },
  hero: {
    minHeight: 260,
    borderRadius: 8,
    padding: 18,
    gap: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  heroCopy: {
    flex: 1.3,
    minWidth: 280,
    gap: 12,
  },
  heroPill: {
    alignSelf: 'flex-start',
    minHeight: 30,
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.mint,
  },
  heroPillText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  heroBody: {
    color: '#d8e0ef',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brand,
  },
  heroButtonLight: {
    backgroundColor: '#ffffff',
  },
  heroButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  heroButtonTextLight: {
    color: colors.ink,
  },
  statGrid: {
    flex: 1,
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
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    minWidth: 150,
    flex: 1,
    borderRadius: 8,
    padding: 13,
    gap: 8,
    borderWidth: 1,
    borderBottomWidth: 4,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  quickBody: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
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
  linkButton: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  linkButtonText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  feedList: {
    gap: 10,
  },
  feedCard: {
    minHeight: 128,
    borderRadius: 8,
    padding: 13,
    flexDirection: 'row',
    gap: 11,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  feedIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  feedMetaRow: {
    minHeight: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  feedType: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  approvedBadge: {
    minHeight: 22,
    borderRadius: 8,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#85e4d5',
  },
  approvedText: {
    color: colors.tealDark,
    fontSize: 10,
    fontWeight: '900',
  },
  feedTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  feedSummary: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  socialPill: {
    minHeight: 28,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5ebf5',
  },
  socialPillText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '800',
  },
  campaignGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  campaignCard: {
    minWidth: 260,
    flex: 1,
    borderRadius: 8,
    padding: 13,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  campaignIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softGold,
  },
  campaignMeta: {
    color: colors.ink,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '900',
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
    minHeight: 82,
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
