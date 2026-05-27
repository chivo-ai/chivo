import { router } from 'expo-router';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ArrowRight,
  BookOpen,
  Copy,
  Hash,
  MessageCircle,
  Plus,
  QrCode,
  School,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react-native';

import { ChivoCard, ChivoMetric } from '../../components/chivo/ChivoUI';
import { useAppSession } from '../app/AppSessionProvider';
import { mapMembershipRow } from '../onboarding/accessTypes';
import { useAccessMemberships } from '../onboarding/useAccessMemberships';
import { createCrew, CrewListItem, fetchCrewsForUser, joinCrewByCode } from '../../services/crews';
import { CrewScope } from '../../types';
import { colors } from '../../theme/tokens';

const tones = [
  { background: '#e9f1ff', accent: colors.brand },
  { background: '#e3fbf7', accent: colors.teal },
  { background: '#f3efff', accent: colors.violet },
  { background: '#f1ffd7', accent: '#a3e635' },
];

type CrewModal = 'create' | 'join' | null;
type CrewFilter = 'all' | 'created' | 'joined' | 'cross';

const crewFilters: Array<{ id: CrewFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'created', label: 'Created' },
  { id: 'joined', label: 'Joined' },
  { id: 'cross', label: 'Cross-school' },
];

export function CrewHubScreen() {
  const { user, activeMembership } = useAppSession();
  const { activeMemberships } = useAccessMemberships(user);
  const schools = useMemo(() => activeMemberships.map(mapMembershipRow), [activeMemberships]);
  const [crews, setCrews] = useState<CrewListItem[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(activeMembership?.id ?? '');
  const [crewName, setCrewName] = useState('');
  const [crewScope, setCrewScope] = useState<CrewScope>('school');
  const [joinCode, setJoinCode] = useState('');
  const [activeModal, setActiveModal] = useState<CrewModal>(null);
  const [activeFilter, setActiveFilter] = useState<CrewFilter>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'create' | 'join' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedSchool = schools.find((school) => school.id === selectedSchoolId) ?? schools[0] ?? null;
  const canCreateCrossSchool = Boolean(selectedSchool?.school.externalCrewsAllowed);
  const filteredCrews = useMemo(() => {
    if (activeFilter === 'created') {
      return crews.filter((crew) => crew.membershipRole === 'owner');
    }

    if (activeFilter === 'joined') {
      return crews.filter((crew) => crew.membershipRole !== 'owner');
    }

    if (activeFilter === 'cross') {
      return crews.filter((crew) => crew.scope === 'cross_school');
    }

    return crews;
  }, [activeFilter, crews]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const nextCrews = await fetchCrewsForUser();
      setCrews(nextCrews);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load crews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedSchoolId && schools[0]?.id) {
      setSelectedSchoolId(schools[0].id);
    }
  }, [schools, selectedSchoolId]);

  useEffect(() => {
    if (crewScope === 'cross_school' && !canCreateCrossSchool) {
      setCrewScope('school');
    }
  }, [canCreateCrossSchool, crewScope]);

  function closeModal() {
    setActiveModal(null);
    setMessage(null);
  }

  async function createNewCrew() {
    if (!selectedSchool?.id) {
      setMessage('Choose a school before creating a crew.');
      return;
    }

    setSaving('create');
    setMessage(null);

    try {
      const crew = await createCrew({
        name: crewName,
        schoolMembershipId: selectedSchool.id,
        scope: crewScope,
      });
      setCrewName('');
      closeModal();
      await load();
      router.push(`/crews/${crew.username || crew.id}` as never);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create crew.');
    } finally {
      setSaving(null);
    }
  }

  async function joinExistingCrew() {
    setSaving('join');
    setMessage(null);

    try {
      const crew = await joinCrewByCode({
        code: joinCode,
        schoolMembershipId: selectedSchool?.id ?? null,
      });
      setJoinCode('');
      closeModal();
      await load();
      router.push(`/crews/${crew.username || crew.id}` as never);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to join crew.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <View style={styles.screen}>
      <ChivoCard tone="night" compact style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={styles.heroPill}>
            <Sparkles size={15} color={colors.ink} />
            <Text style={styles.heroPillText} numberOfLines={1}>Study crews</Text>
          </View>
          <Text style={styles.heroTitle} numberOfLines={2}>Small circles for serious learning</Text>
          <Text style={styles.heroBody} numberOfLines={2}>Open a crew, share study notes, ask lesson questions, and keep revision moving with classmates.</Text>
          <View style={styles.heroActions}>
            <IconAction label="Create" icon={<Plus size={19} color="#ffffff" />} onPress={() => setActiveModal('create')} />
            <IconAction label="Join" icon={<QrCode size={19} color={colors.ink} />} onPress={() => setActiveModal('join')} light />
          </View>
        </View>

        <View style={styles.heroStats}>
          <StatSticker icon={<Users size={21} color={colors.ink} />} label="Crews" value={crews.length} tone={tones[0]} />
          <StatSticker icon={<MessageCircle size={21} color={colors.ink} />} label="Created" value={crews.filter((crew) => crew.membershipRole === 'owner').length} tone={tones[3]} />
          <StatSticker icon={<BookOpen size={21} color={colors.ink} />} label="Shared notes" value={crews.reduce((total, crew) => total + crew.resourceCount, 0)} tone={tones[1]} />
        </View>
      </ChivoCard>

      {message && !activeModal ? <Text style={styles.errorText}>{message}</Text> : null}

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionTitle} numberOfLines={1}>Your crews</Text>
          <Text style={styles.sectionMeta} numberOfLines={1}>{filteredCrews.length ? `${filteredCrews.length} room${filteredCrews.length === 1 ? '' : 's'} ready` : 'Create or join your first crew'}</Text>
        </View>
        <View style={styles.headingActions}>
          <Pressable onPress={() => setActiveModal('create')} style={styles.roundAction}>
            <Plus size={19} color="#ffffff" />
          </Pressable>
          <Pressable onPress={() => setActiveModal('join')} style={[styles.roundAction, styles.roundActionLight]}>
            <QrCode size={19} color={colors.brandDeep} />
          </Pressable>
        </View>
      </View>

      <View style={styles.filterRail}>
        {crewFilters.map((filter) => {
          const active = activeFilter === filter.id;
          return (
            <Pressable key={filter.id} onPress={() => setActiveFilter(filter.id)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.crewGrid}>
        {loading ? (
          <View style={styles.emptyPanel}>
            <ActivityIndicator color={colors.brandDeep} />
            <Text style={styles.emptyMeta} numberOfLines={1}>Loading crews...</Text>
          </View>
        ) : filteredCrews.length ? filteredCrews.map((crew, index) => (
          <CrewCard key={crew.id} crew={crew} tone={tones[index % tones.length]} />
        )) : (
          <View style={styles.emptyPanel}>
            <Users size={28} color={colors.brandDeep} />
            <Text style={styles.emptyTitle} numberOfLines={1}>No crew in this view</Text>
            <Text style={styles.emptyMeta} numberOfLines={2}>Switch filters or start a new study room.</Text>
          </View>
        )}
      </View>

      <Modal visible={activeModal === 'create'} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={styles.modalSheet}>
            <ModalHeader title="Create crew" body="Start a study room inside a school." icon={<Plus size={21} color="#ffffff" />} onClose={closeModal} />
            {message ? <Text style={styles.errorText}>{message}</Text> : null}

            <View style={styles.field}>
              <Text style={styles.fieldLabel} numberOfLines={1}>Crew name</Text>
              <TextInput
                value={crewName}
                onChangeText={setCrewName}
                placeholder="e.g. JSS 1 revision club"
                placeholderTextColor="#7b8983"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel} numberOfLines={1}>School</Text>
              <View style={styles.schoolPicker}>
                {schools.length ? schools.map((school) => (
                  <Pressable
                    key={school.id}
                    onPress={() => setSelectedSchoolId(school.id)}
                    style={[styles.schoolPill, selectedSchoolId === school.id && styles.schoolPillActive]}
                  >
                    <School size={16} color={selectedSchoolId === school.id ? '#ffffff' : colors.brandDeep} />
                    <Text style={[styles.schoolPillText, selectedSchoolId === school.id && styles.schoolPillTextActive]} numberOfLines={1}>
                      {school.school.name}
                    </Text>
                  </Pressable>
                )) : (
                  <Text style={styles.emptyMeta} numberOfLines={2}>Join or create a school first.</Text>
                )}
              </View>
            </View>

            <View style={styles.scopeRow}>
              <ScopeButton
                selected={crewScope === 'school'}
                title="School crew"
                body="Members from this school"
                icon={<ShieldCheck size={18} color={crewScope === 'school' ? '#ffffff' : colors.brandDeep} />}
                onPress={() => setCrewScope('school')}
              />
              <ScopeButton
                selected={crewScope === 'cross_school'}
                title="Cross-school"
                body={canCreateCrossSchool ? 'Open sharing enabled' : 'Disabled by school'}
                icon={<Sparkles size={18} color={crewScope === 'cross_school' ? '#ffffff' : colors.gold} />}
                onPress={() => canCreateCrossSchool ? setCrewScope('cross_school') : undefined}
                disabled={!canCreateCrossSchool}
              />
            </View>

            <PrimaryButton
              label="Create crew"
              icon={<Plus size={17} color="#ffffff" />}
              loading={saving === 'create'}
              disabled={!crewName.trim() || !selectedSchool}
              onPress={createNewCrew}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={activeModal === 'join'} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={styles.modalSheet}>
            <ModalHeader title="Join crew" body="Use a crew invite code from your teacher or study lead." icon={<QrCode size={21} color="#ffffff" />} onClose={closeModal} />
            {message ? <Text style={styles.errorText}>{message}</Text> : null}

            <View style={styles.codeBox}>
              <Hash size={18} color={colors.brandDeep} />
              <TextInput
                value={joinCode}
                onChangeText={setJoinCode}
                autoCapitalize="characters"
                placeholder="CRW-1234ABCD"
                placeholderTextColor="#7b8983"
                style={styles.codeInput}
              />
            </View>

            <PrimaryButton
              label="Join crew"
              icon={<ArrowRight size={17} color="#ffffff" />}
              loading={saving === 'join'}
              disabled={!joinCode.trim()}
              onPress={joinExistingCrew}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function CrewCard({ crew, tone }: { crew: CrewListItem; tone: { background: string; accent: string } }) {
  return (
    <Pressable onPress={() => router.push(`/crews/${crew.username || crew.id}` as never)} style={[styles.crewCard, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <View style={[styles.crewBanner, { backgroundColor: tone.accent }]}>
        {crew.bannerUrl ? <Image source={{ uri: crew.bannerUrl }} style={styles.bannerImage} /> : null}
      </View>
      <View style={styles.crewBody}>
        <View style={[styles.crewMark, { backgroundColor: tone.accent }]}>
          {crew.logoUrl ? <Image source={{ uri: crew.logoUrl }} style={styles.markImage} /> : <Users size={23} color="#ffffff" />}
        </View>
        <View style={styles.flexText}>
          <Text style={styles.crewName} numberOfLines={1}>{crew.name}</Text>
          <Text style={styles.crewMeta} numberOfLines={1}>/{crew.username} - {formatScope(crew.scope)} - {formatRole(crew.membershipRole)}</Text>
        </View>
      </View>
      <View style={styles.crewStats}>
        <MiniStat label="Members" value={crew.memberCount} />
        <MiniStat label="Notes" value={crew.resourceCount} />
        <View style={styles.codePill}>
          <Copy size={14} color={colors.ink} />
          <Text style={styles.codePillText} numberOfLines={1}>{crew.inviteCode}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function ModalHeader({ icon, title, body, onClose }: { icon: ReactNode; title: string; body: string; onClose: () => void }) {
  return (
    <View style={styles.modalHeader}>
      <View style={styles.modalIcon}>{icon}</View>
      <View style={styles.flexText}>
        <Text style={styles.modalTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.modalBody} numberOfLines={2}>{body}</Text>
      </View>
      <Pressable onPress={onClose} style={styles.modalClose}>
        <X size={18} color={colors.brandDeep} />
      </Pressable>
    </View>
  );
}

function IconAction({ label, icon, onPress, light }: { label: string; icon: ReactNode; onPress: () => void; light?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.iconAction, light && styles.iconActionLight]}>
      {icon}
      <Text style={[styles.iconActionText, light && styles.iconActionTextLight]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function ScopeButton({
  selected,
  disabled,
  title,
  body,
  icon,
  onPress,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  body: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.scopeButton, selected && styles.scopeButtonActive, disabled && styles.scopeButtonDisabled]}>
      <View style={[styles.scopeIcon, selected && styles.scopeIconActive]}>{icon}</View>
      <Text style={[styles.scopeTitle, selected && styles.scopeTitleActive]} numberOfLines={1}>{title}</Text>
      <Text style={[styles.scopeBody, selected && styles.scopeBodyActive]} numberOfLines={2}>{body}</Text>
    </Pressable>
  );
}

function PrimaryButton({
  label,
  icon,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={loading || disabled} onPress={onPress} style={[styles.primaryButton, (loading || disabled) && styles.buttonDisabled]}>
      {loading ? <ActivityIndicator color="#ffffff" /> : <View style={styles.primaryButtonIcon}>{icon}</View>}
      <Text style={styles.primaryButtonText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function StatSticker({ icon, label, value }: { icon: ReactNode; label: string; value: string | number; tone: { background: string; accent: string } }) {
  return <ChivoMetric icon={icon} label={label} value={value} tone="surface" />;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.miniStatLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function formatRole(value: string) {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatScope(value: CrewScope) {
  return value === 'cross_school' ? 'Cross-school' : 'School crew';
}

const styles = StyleSheet.create({
  screen: {
    gap: 12,
  },
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    borderRadius: 8,
    padding: 16,
  },
  heroCopy: {
    flex: 1.5,
    minWidth: 240,
    gap: 10,
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
    fontWeight: '700',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  heroBody: {
    color: '#d8e0ef',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  iconAction: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
  },
  iconActionLight: {
    backgroundColor: '#ffffff',
  },
  iconActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  iconActionTextLight: {
    color: colors.ink,
  },
  heroStats: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
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
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  headingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  roundAction: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  roundActionLight: {
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  filterRail: {
    minHeight: 36,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  filterChipActive: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandDeep,
  },
  filterChipText: {
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  crewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  crewCard: {
    overflow: 'hidden',
    minWidth: 230,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderBottomWidth: 4,
  },
  crewBanner: {
    height: 46,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  crewBody: {
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  crewMark: {
    overflow: 'hidden',
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  markImage: {
    width: '100%',
    height: '100%',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  crewName: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  crewMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  crewStats: {
    paddingHorizontal: 13,
    paddingBottom: 13,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniStat: {
    minWidth: 62,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
  },
  miniStatValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  miniStatLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  codePill: {
    minHeight: 32,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  codePillText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(11, 13, 18, 0.62)',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    borderRadius: 8,
    padding: 14,
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  modalHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  modalBody: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dfe6f0',
    fontSize: 14,
    fontWeight: '600',
  },
  schoolPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  schoolPill: {
    minHeight: 34,
    maxWidth: '100%',
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  schoolPillActive: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandDeep,
  },
  schoolPillText: {
    maxWidth: 210,
    color: colors.brandDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  schoolPillTextActive: {
    color: '#ffffff',
  },
  scopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scopeButton: {
    flex: 1,
    minWidth: 140,
    borderRadius: 8,
    padding: 12,
    gap: 7,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderBottomWidth: 4,
    borderColor: '#c7d7ff',
  },
  scopeButtonActive: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandDeep,
  },
  scopeButtonDisabled: {
    opacity: 0.55,
  },
  scopeIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  scopeIconActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  scopeTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  scopeTitleActive: {
    color: '#ffffff',
  },
  scopeBody: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  scopeBodyActive: {
    color: '#d8e0ef',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
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
  codeBox: {
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  codeInput: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyPanel: {
    minHeight: 82,
    flex: 1,
    minWidth: 238,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  emptyMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  errorText: {
    color: '#a13c33',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});
