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

import { useAppSession } from '../app/AppSessionProvider';
import { mapMembershipRow } from '../onboarding/accessTypes';
import { useAccessMemberships } from '../onboarding/useAccessMemberships';
import { createCrew, CrewListItem, fetchCrewsForUser, joinCrewByCode } from '../../services/crews';
import { CrewScope } from '../../types';
import { colors } from '../../theme/tokens';

const tones = [
  { background: '#fff4d4', accent: colors.gold },
  { background: '#e9f6ff', accent: '#4aa6d9' },
  { background: '#f3eaff', accent: '#8d68d8' },
  { background: '#e8f8ee', accent: '#39a96b' },
];

type CrewModal = 'create' | 'join' | null;

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'create' | 'join' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedSchool = schools.find((school) => school.id === selectedSchoolId) ?? schools[0] ?? null;
  const canCreateCrossSchool = Boolean(selectedSchool?.school.externalCrewsAllowed);

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
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={styles.heroPill}>
            <Sparkles size={15} color={colors.ink} />
            <Text style={styles.heroPillText}>Study crews</Text>
          </View>
          <Text style={styles.heroTitle}>Small circles for serious learning</Text>
          <Text style={styles.heroBody}>Open a crew, share study notes, ask lesson questions, and keep revision moving with classmates.</Text>
          <View style={styles.heroActions}>
            <IconAction label="Create" icon={<Plus size={19} color="#ffffff" />} onPress={() => setActiveModal('create')} />
            <IconAction label="Join" icon={<QrCode size={19} color={colors.ink} />} onPress={() => setActiveModal('join')} light />
          </View>
        </View>

        <View style={styles.heroStats}>
          <StatSticker icon={<Users size={21} color={colors.ink} />} label="Crews" value={crews.length} tone={tones[0]} />
          <StatSticker icon={<MessageCircle size={21} color={colors.ink} />} label="Chat" value="Live" tone={tones[3]} />
          <StatSticker icon={<BookOpen size={21} color={colors.ink} />} label="Notes" value="Share" tone={tones[1]} />
        </View>
      </View>

      {message && !activeModal ? <Text style={styles.errorText}>{message}</Text> : null}

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionTitle}>Your crews</Text>
          <Text style={styles.sectionMeta}>{crews.length ? 'Tap a crew slug to enter the room' : 'Create or join your first crew'}</Text>
        </View>
        <View style={styles.headingActions}>
          <Pressable onPress={() => setActiveModal('create')} style={styles.roundAction}>
            <Plus size={19} color="#ffffff" />
          </Pressable>
          <Pressable onPress={() => setActiveModal('join')} style={[styles.roundAction, styles.roundActionLight]}>
            <QrCode size={19} color={colors.tealDark} />
          </Pressable>
        </View>
      </View>

      <View style={styles.crewGrid}>
        {loading ? (
          <View style={styles.emptyPanel}>
            <ActivityIndicator color={colors.tealDark} />
            <Text style={styles.emptyMeta}>Loading crews...</Text>
          </View>
        ) : crews.length ? crews.map((crew, index) => (
          <CrewCard key={crew.id} crew={crew} tone={tones[index % tones.length]} />
        )) : (
          <View style={styles.emptyPanel}>
            <Users size={28} color={colors.tealDark} />
            <Text style={styles.emptyTitle}>No crew yet</Text>
            <Text style={styles.emptyMeta}>Create a revision group, class circle, or focused study team.</Text>
          </View>
        )}
      </View>

      <Modal visible={activeModal === 'create'} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={styles.modalSheet}>
            <ModalHeader title="Create crew" body="Start a study room inside a school." icon={<Plus size={21} color="#ffffff" />} onClose={closeModal} />
            {message ? <Text style={styles.errorText}>{message}</Text> : null}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Crew name</Text>
              <TextInput
                value={crewName}
                onChangeText={setCrewName}
                placeholder="e.g. JSS 1 revision club"
                placeholderTextColor="#7b8983"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>School</Text>
              <View style={styles.schoolPicker}>
                {schools.length ? schools.map((school) => (
                  <Pressable
                    key={school.id}
                    onPress={() => setSelectedSchoolId(school.id)}
                    style={[styles.schoolPill, selectedSchoolId === school.id && styles.schoolPillActive]}
                  >
                    <School size={16} color={selectedSchoolId === school.id ? '#ffffff' : colors.tealDark} />
                    <Text style={[styles.schoolPillText, selectedSchoolId === school.id && styles.schoolPillTextActive]} numberOfLines={1}>
                      {school.school.name}
                    </Text>
                  </Pressable>
                )) : (
                  <Text style={styles.emptyMeta}>Join or create a school first.</Text>
                )}
              </View>
            </View>

            <View style={styles.scopeRow}>
              <ScopeButton
                selected={crewScope === 'school'}
                title="School crew"
                body="Members from this school"
                icon={<ShieldCheck size={18} color={crewScope === 'school' ? '#ffffff' : colors.tealDark} />}
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
              <Hash size={18} color={colors.tealDark} />
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
          <Text style={styles.crewName}>{crew.name}</Text>
          <Text style={styles.crewMeta}>/{crew.username} - {formatScope(crew.scope)} - {formatRole(crew.membershipRole)}</Text>
        </View>
      </View>
      <View style={styles.crewStats}>
        <MiniStat label="Members" value={crew.memberCount} />
        <MiniStat label="Notes" value={crew.resourceCount} />
        <View style={styles.codePill}>
          <Copy size={14} color={colors.ink} />
          <Text style={styles.codePillText}>{crew.inviteCode}</Text>
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
        <Text style={styles.modalTitle}>{title}</Text>
        <Text style={styles.modalBody}>{body}</Text>
      </View>
      <Pressable onPress={onClose} style={styles.modalClose}>
        <X size={18} color={colors.tealDark} />
      </Pressable>
    </View>
  );
}

function IconAction({ label, icon, onPress, light }: { label: string; icon: ReactNode; onPress: () => void; light?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.iconAction, light && styles.iconActionLight]}>
      {icon}
      <Text style={[styles.iconActionText, light && styles.iconActionTextLight]}>{label}</Text>
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
      <Text style={[styles.scopeTitle, selected && styles.scopeTitleActive]}>{title}</Text>
      <Text style={[styles.scopeBody, selected && styles.scopeBodyActive]}>{body}</Text>
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
      {loading ? <ActivityIndicator color="#ffffff" /> : icon}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function StatSticker({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone: { background: string; accent: string } }) {
  return (
    <View style={[styles.statSticker, { backgroundColor: tone.background }]}>
      <View style={[styles.statIcon, { backgroundColor: tone.accent }]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
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
    gap: 14,
  },
  hero: {
    minHeight: 136,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#101916',
    borderWidth: 1,
    borderColor: '#20352f',
  },
  heroCopy: {
    flex: 1.5,
    minWidth: 260,
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
    fontWeight: '700',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
  },
  heroBody: {
    color: '#dce7e1',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconAction: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.tealDark,
  },
  iconActionLight: {
    backgroundColor: '#ffffff',
  },
  iconActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  iconActionTextLight: {
    color: colors.ink,
  },
  heroStats: {
    flex: 1,
    minWidth: 250,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statSticker: {
    minWidth: 108,
    flex: 1,
    borderRadius: 18,
    padding: 14,
    gap: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeading: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  headingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  roundAction: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  roundActionLight: {
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  crewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  crewCard: {
    overflow: 'hidden',
    minWidth: 260,
    flex: 1,
    borderRadius: 20,
    borderWidth: 2,
  },
  crewBanner: {
    height: 61,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  crewBody: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  crewMark: {
    overflow: 'hidden',
    width: 54,
    height: 54,
    borderRadius: 15,
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
    fontWeight: '700',
  },
  crewMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  crewStats: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniStat: {
    minWidth: 70,
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
  },
  miniStatValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  miniStatLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  codePill: {
    minHeight: 38,
    borderRadius: 15,
    paddingHorizontal: 10,
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
    backgroundColor: 'rgba(7, 12, 10, 0.58)',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    borderRadius: 20,
    padding: 14,
    gap: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
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
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 15,
    fontWeight: '700',
  },
  schoolPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  schoolPill: {
    minHeight: 38,
    maxWidth: '100%',
    borderRadius: 14,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  schoolPillActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  schoolPillText: {
    maxWidth: 210,
    color: colors.tealDark,
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
    borderRadius: 16,
    padding: 12,
    gap: 7,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  scopeButtonActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  scopeButtonDisabled: {
    opacity: 0.55,
  },
  scopeIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
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
    color: '#dce7e1',
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.tealDark,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  codeBox: {
    minHeight: 50,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  codeInput: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyPanel: {
    minHeight: 95,
    flex: 1,
    minWidth: 260,
    borderRadius: 20,
    padding: 12,
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  emptyMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  errorText: {
    color: '#a13c33',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});
