import { router } from 'expo-router';
import { ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, Building2, DoorOpen, Layers, PlayCircle, QrCode, Sparkles, Trophy, UserPlus } from 'lucide-react-native';

import { useAccessMemberships } from '../../src/features/onboarding/useAccessMemberships';
import { mapMembershipRow } from '../../src/features/onboarding/accessTypes';
import { RouteScreen } from '../../src/features/app/RouteScreen';
import { useAppSession } from '../../src/features/app/AppSessionProvider';
import { ActiveSchoolMembership } from '../../src/types';
import { colors } from '../../src/theme/tokens';

const tones = [
  { background: '#fff4d4', accent: colors.gold },
  { background: '#e9f6ff', accent: '#4aa6d9' },
  { background: '#f3eaff', accent: '#8d68d8' },
  { background: '#e8f8ee', accent: '#39a96b' },
];

export default function HomeTabRoute() {
  const { user, openMembershipById } = useAppSession();
  const { activeMemberships, pendingMemberships } = useAccessMemberships(user);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const schools = useMemo(() => activeMemberships.map(mapMembershipRow), [activeMemberships]);

  if (!user) {
    return null;
  }

  async function openSchool(membership: ActiveSchoolMembership) {
    setOpeningId(membership.id);
    const opened = await openMembershipById(membership.id);
    setOpeningId(null);

    if (opened) {
      router.push('/learn');
    }
  }

  return (
    <RouteScreen>
      <View style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <View style={styles.heroPill}>
              <Sparkles size={15} color={colors.ink} />
              <Text style={styles.heroPillText}>Chivo AI</Text>
            </View>
            <Text style={styles.heroTitle}>Learn from every real lesson</Text>
            <Text style={styles.heroBody}>Audio, transcript, quiz, cards, and progress shaped from your school classes.</Text>
            <View style={styles.heroActions}>
              <HeroButton label="My schools" icon={<Building2 size={17} color="#ffffff" />} onPress={() => router.push('/school/my-school' as never)} />
              <HeroButton label="Join" icon={<QrCode size={17} color={colors.ink} />} onPress={() => router.push('/join' as never)} light />
            </View>
          </View>

          <View style={styles.stickerBoard}>
            <Sticker icon={<BookOpen size={21} color={colors.ink} />} label="Lessons" value={schools.length} tone={tones[0]} />
            <Sticker icon={<Layers size={21} color={colors.ink} />} label="Cards" value={4} tone={tones[2]} />
            <Sticker icon={<Trophy size={21} color={colors.ink} />} label="Quests" value={pendingMemberships.length} tone={tones[3]} />
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>School paths</Text>
            <Text style={styles.sectionMeta}>{schools.length ? 'Continue inside a school workspace' : 'Create, join, or request school access'}</Text>
          </View>
          <Pressable onPress={() => router.push('/create' as never)} style={styles.smallAction}>
            <Building2 size={17} color={colors.tealDark} />
          </Pressable>
        </View>

        <View style={styles.schoolGrid}>
          {schools.length ? schools.map((membership, index) => (
            <SchoolPathCard
              key={membership.id}
              membership={membership}
              tone={tones[index % tones.length]}
              loading={openingId === membership.id}
              onOpen={() => openSchool(membership)}
            />
          )) : (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No school yet</Text>
              <Text style={styles.sectionMeta}>Join with a code, request access, or create a new school workspace.</Text>
              <View style={styles.emptyActions}>
                <MiniButton label="Join" icon={<QrCode size={15} color="#ffffff" />} onPress={() => router.push('/join' as never)} />
                <MiniButton label="Request" icon={<UserPlus size={15} color="#ffffff" />} onPress={() => router.push('/request' as never)} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.toolGrid}>
          <QuickTool label="Classes" body="Open class rooms" icon={<DoorOpen size={21} color={colors.ink} />} tone={tones[1]} onPress={() => router.push('/school/class' as never)} />
          <QuickTool label="Lessons" body="Study library" icon={<BookOpen size={21} color={colors.ink} />} tone={tones[0]} onPress={() => router.push('/lessons' as never)} />
          <QuickTool label="Crews" body="Study groups" icon={<Sparkles size={21} color={colors.ink} />} tone={tones[2]} onPress={() => router.push('/crews' as never)} />
          <QuickTool label="Requests" body={`${pendingMemberships.length} waiting`} icon={<UserPlus size={21} color={colors.ink} />} tone={tones[3]} onPress={() => router.push('/request' as never)} />
        </View>
      </View>
    </RouteScreen>
  );
}

function SchoolPathCard({
  membership,
  tone,
  loading,
  onOpen,
}: {
  membership: ActiveSchoolMembership;
  tone: { background: string; accent: string };
  loading: boolean;
  onOpen: () => void;
}) {
  return (
    <View style={[styles.schoolCard, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <View style={[styles.schoolBanner, { backgroundColor: tone.accent }]}>
        {membership.school.bannerUrl ? <Image source={{ uri: membership.school.bannerUrl }} style={styles.bannerImage} /> : null}
      </View>
      <View style={styles.schoolBody}>
        <View style={[styles.schoolMark, { backgroundColor: tone.accent }]}>
          {membership.school.logoUrl ? (
            <Image source={{ uri: membership.school.logoUrl }} style={styles.markImage} />
          ) : (
            <Text style={styles.markText}>{initials(membership.school.name)}</Text>
          )}
        </View>
        <View style={styles.flexText}>
          <Text style={styles.schoolName}>{membership.school.name}</Text>
          <Text style={styles.schoolMeta}>{formatRole(membership.role)} - {membership.school.slug ?? 'school'}</Text>
        </View>
      </View>
      <Pressable disabled={loading} onPress={onOpen} style={styles.continueButton}>
        {loading ? <ActivityIndicator color="#ffffff" /> : <PlayCircle size={17} color="#ffffff" />}
        <Text style={styles.continueText}>Continue</Text>
      </Pressable>
    </View>
  );
}

function QuickTool({
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
    <Pressable onPress={onPress} style={[styles.toolCard, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <View style={[styles.toolIcon, { backgroundColor: tone.accent }]}>{icon}</View>
      <Text style={styles.toolTitle}>{label}</Text>
      <Text style={styles.toolBody}>{body}</Text>
    </Pressable>
  );
}

function Sticker({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: { background: string; accent: string } }) {
  return (
    <View style={[styles.sticker, { backgroundColor: tone.background }]}>
      <View style={[styles.stickerIcon, { backgroundColor: tone.accent }]}>{icon}</View>
      <Text style={styles.stickerValue}>{value}</Text>
      <Text style={styles.stickerLabel}>{label}</Text>
    </View>
  );
}

function HeroButton({ label, icon, onPress, light }: { label: string; icon: ReactNode; onPress: () => void; light?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.heroButton, light && styles.heroButtonLight]}>
      {icon}
      <Text style={[styles.heroButtonText, light && styles.heroButtonTextLight]}>{label}</Text>
    </Pressable>
  );
}

function MiniButton({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.miniButton}>
      {icon}
      <Text style={styles.miniButtonText}>{label}</Text>
    </Pressable>
  );
}

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CH';
}

function formatRole(value: string) {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  screen: {
    gap: 18,
  },
  hero: {
    minHeight: 230,
    borderRadius: 30,
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 18,
    backgroundColor: '#101916',
    borderWidth: 1,
    borderColor: '#20352f',
  },
  heroCopy: {
    flex: 1.4,
    minWidth: 270,
    gap: 11,
  },
  heroPill: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.gold,
  },
  heroPillText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '900',
  },
  heroBody: {
    color: '#dce7e1',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '800',
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroButton: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.tealDark,
  },
  heroButtonLight: {
    backgroundColor: '#ffffff',
  },
  heroButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  heroButtonTextLight: {
    color: colors.ink,
  },
  stickerBoard: {
    flex: 1,
    minWidth: 250,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sticker: {
    minWidth: 106,
    flex: 1,
    borderRadius: 24,
    padding: 14,
    gap: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  stickerIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerValue: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
  },
  stickerLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  sectionHeading: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  smallAction: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  schoolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  schoolCard: {
    overflow: 'hidden',
    minWidth: 260,
    flex: 1,
    borderRadius: 26,
    borderWidth: 2,
  },
  schoolBanner: {
    height: 86,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  schoolBody: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  schoolMark: {
    overflow: 'hidden',
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  markImage: {
    width: '100%',
    height: '100%',
  },
  markText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  schoolName: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  schoolMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  continueButton: {
    marginHorizontal: 14,
    marginBottom: 14,
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.ink,
  },
  continueText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  emptyPanel: {
    minHeight: 150,
    flex: 1,
    minWidth: 260,
    borderRadius: 26,
    padding: 16,
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  emptyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  miniButton: {
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.tealDark,
  },
  miniButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toolCard: {
    minWidth: 160,
    flex: 1,
    borderRadius: 24,
    padding: 14,
    gap: 8,
    borderWidth: 2,
  },
  toolIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  toolBody: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
});
