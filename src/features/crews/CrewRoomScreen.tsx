import { router } from 'expo-router';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ArrowLeft,
  BookOpen,
  Copy,
  MessageCircle,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Users,
} from 'lucide-react-native';

import {
  addCrewResource,
  crewAiPackFromResource,
  CrewAiPack,
  CrewRoom,
  fetchCrewRoom,
  processCrewStudyPack,
  sendCrewMessage,
} from '../../services/crews';
import { colors } from '../../theme/tokens';

export function CrewRoomScreen({ crewId }: { crewId: string }) {
  const [room, setRoom] = useState<CrewRoom | null>(null);
  const [messageText, setMessageText] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceNote, setResourceNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'message' | 'resource' | 'ai' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeMembers = useMemo(
    () => room?.members.filter((member) => member.status === 'active') ?? [],
    [room?.members]
  );
  const aiResources = useMemo(
    () => room?.resources.filter((resource) => resource.resourceType === 'ai_pack') ?? [],
    [room?.resources]
  );
  const noteResources = useMemo(
    () => room?.resources.filter((resource) => resource.resourceType !== 'ai_pack') ?? [],
    [room?.resources]
  );
  const latestAiPack = useMemo(
    () => aiResources.map(crewAiPackFromResource).find(Boolean) ?? null,
    [aiResources]
  );

  const load = useCallback(async () => {
    if (!crewId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextRoom = await fetchCrewRoom(crewId);
      setRoom(nextRoom);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load crew.');
    } finally {
      setLoading(false);
    }
  }, [crewId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendMessage() {
    if (!room || !messageText.trim()) {
      return;
    }

    setSaving('message');
    setError(null);

    try {
      await sendCrewMessage(room.crew.id, messageText);
      setMessageText('');
      await load();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
    } finally {
      setSaving(null);
    }
  }

  async function saveResource() {
    if (!room || !resourceTitle.trim() || !resourceNote.trim()) {
      return;
    }

    setSaving('resource');
    setError(null);

    try {
      await addCrewResource({
        crewId: room.crew.id,
        title: resourceTitle,
        note: resourceNote,
      });
      setResourceTitle('');
      setResourceNote('');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save resource.');
    } finally {
      setSaving(null);
    }
  }

  async function generateSharedAiPack() {
    if (!room) {
      return;
    }

    setSaving('ai');
    setError(null);

    try {
      await processCrewStudyPack(room.crew.id);
      await load();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Unable to generate crew AI pack.');
    } finally {
      setSaving(null);
    }
  }

  if (loading && !room) {
    return (
      <View style={styles.centerPanel}>
        <ActivityIndicator color={colors.tealDark} />
        <Text style={styles.emptyMeta}>Opening crew room...</Text>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.centerPanel}>
        <Users size={28} color={colors.tealDark} />
        <Text style={styles.emptyTitle}>Crew unavailable</Text>
        <Text style={styles.emptyMeta}>{error ?? 'This crew could not be opened.'}</Text>
        <PrimaryAction label="Back to crews" icon={<ArrowLeft size={17} color="#ffffff" />} onPress={() => router.push('/crews' as never)} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Pressable onPress={() => router.push('/crews' as never)} style={styles.backButton}>
          <ArrowLeft size={19} color="#ffffff" />
        </Pressable>

        <View style={styles.heroCopy}>
          <View style={styles.heroPill}>
            <Sparkles size={15} color={colors.ink} />
            <Text style={styles.heroPillText}>{room.crew.scope === 'cross_school' ? 'Cross-school crew' : 'School crew'}</Text>
          </View>
          <Text style={styles.heroTitle}>{room.crew.name}</Text>
          <Text style={styles.heroBody}>Message, share notes, and create a shared AI study pack for the whole crew.</Text>
          <Pressable disabled={saving === 'ai'} onPress={generateSharedAiPack} style={[styles.aiHeroButton, saving === 'ai' && styles.buttonDisabled]}>
            {saving === 'ai' ? <ActivityIndicator color="#ffffff" /> : <Sparkles size={17} color="#ffffff" />}
            <Text style={styles.aiHeroButtonText}>Generate AI pack</Text>
          </Pressable>
        </View>

        <View style={styles.heroStats}>
          <StatBox icon={<Users size={20} color={colors.ink} />} label="Members" value={activeMembers.length} />
          <StatBox icon={<BookOpen size={20} color={colors.ink} />} label="Notes" value={noteResources.length} />
          <StatBox icon={<Sparkles size={20} color={colors.ink} />} label="AI packs" value={aiResources.length} />
          <View style={styles.inviteBox}>
            <Copy size={17} color={colors.ink} />
            <View style={styles.flexText}>
              <Text style={styles.inviteLabel}>Invite code</Text>
              <Text style={styles.inviteCode}>{room.crew.inviteCode}</Text>
            </View>
          </View>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.roomGrid}>
        <View style={styles.chatPanel}>
          <PanelTitle icon={<MessageCircle size={20} color={colors.tealDark} />} title="Crew messages" action={<RefreshButton loading={loading} onPress={load} />} />

          <View style={styles.messageList}>
            {room.messages.length ? room.messages.map((message) => {
              const mine = message.senderProfileId === room.viewerProfileId;
              return (
                <View key={message.id} style={[styles.messageBubble, mine && styles.messageBubbleMine]}>
                  <Text style={[styles.messageBody, mine && styles.messageBodyMine]}>{message.body}</Text>
                  <Text style={[styles.messageTime, mine && styles.messageTimeMine]}>{formatTime(message.createdAt)}</Text>
                </View>
              );
            }) : (
              <View style={styles.emptyThread}>
                <MessageCircle size={22} color={colors.tealDark} />
                <Text style={styles.emptyMeta}>No messages yet. Start the study thread.</Text>
              </View>
            )}
          </View>

          <View style={styles.composer}>
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Ask a question or share an update"
              placeholderTextColor="#7b8983"
              style={styles.composerInput}
              multiline
            />
            <Pressable disabled={saving === 'message' || !messageText.trim()} onPress={sendMessage} style={[styles.sendButton, (!messageText.trim() || saving === 'message') && styles.buttonDisabled]}>
              {saving === 'message' ? <ActivityIndicator color="#ffffff" /> : <Send size={18} color="#ffffff" />}
            </Pressable>
          </View>
        </View>

        <View style={styles.sideStack}>
          <View style={styles.aiPanel}>
            <PanelTitle icon={<Sparkles size={20} color={colors.gold} />} title="Shared Chivo AI pack" />
            {latestAiPack ? (
              <CrewAiPackView pack={latestAiPack} />
            ) : (
              <View style={styles.aiEmpty}>
                <Sparkles size={24} color={colors.tealDark} />
                <Text style={styles.emptyMeta}>Generate one shared summary, quiz, and flashcard set from crew notes and messages.</Text>
              </View>
            )}
            <PrimaryAction
              label={latestAiPack ? 'Regenerate shared pack' : 'Generate shared pack'}
              icon={<Sparkles size={17} color="#ffffff" />}
              loading={saving === 'ai'}
              onPress={generateSharedAiPack}
            />
          </View>

          <View style={styles.resourcePanel}>
            <PanelTitle icon={<Plus size={20} color={colors.blue} />} title="Add study note" />
            <TextInput
              value={resourceTitle}
              onChangeText={setResourceTitle}
              placeholder="Title"
              placeholderTextColor="#7b8983"
              style={styles.input}
            />
            <TextInput
              value={resourceNote}
              onChangeText={setResourceNote}
              placeholder="What should the crew remember?"
              placeholderTextColor="#7b8983"
              style={[styles.input, styles.noteInput]}
              multiline
            />
            <PrimaryAction
              label="Save note"
              icon={<BookOpen size={17} color="#ffffff" />}
              loading={saving === 'resource'}
              disabled={!resourceTitle.trim() || !resourceNote.trim()}
              onPress={saveResource}
            />
          </View>

          <View style={styles.resourcePanel}>
            <PanelTitle icon={<BookOpen size={20} color={colors.gold} />} title="Shared notes" />
            {noteResources.length ? noteResources.map((resource) => (
              <View key={resource.id} style={styles.resourceCard}>
                <Text style={styles.resourceTitle}>{resource.title}</Text>
                <Text style={styles.resourceBody}>{resourceNoteText(resource.content)}</Text>
                <Text style={styles.resourceMeta}>{formatDate(resource.createdAt)}</Text>
              </View>
            )) : (
              <Text style={styles.emptyMeta}>No shared notes yet.</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function PanelTitle({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <View style={styles.panelTitleRow}>
      <View style={styles.panelTitleIcon}>{icon}</View>
      <Text style={styles.panelTitle}>{title}</Text>
      {action}
    </View>
  );
}

function CrewAiPackView({ pack }: { pack: CrewAiPack }) {
  return (
    <View style={styles.aiPack}>
      <View style={styles.aiPackHeader}>
        <Text style={styles.aiPackTitle}>{pack.title}</Text>
        <Text style={styles.aiPackBadge}>Shared</Text>
      </View>

      {pack.summary ? <Text style={styles.aiSummary}>{pack.summary}</Text> : null}

      {pack.keyPoints.length ? (
        <View style={styles.aiBlock}>
          <Text style={styles.aiBlockTitle}>Summary points</Text>
          {pack.keyPoints.slice(0, 5).map((point, index) => (
            <View key={`${point}-${index}`} style={styles.aiPoint}>
              <Text style={styles.aiPointNumber}>{index + 1}</Text>
              <Text style={styles.aiPointText}>{point}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {pack.quiz.length ? (
        <View style={styles.aiBlock}>
          <Text style={styles.aiBlockTitle}>Crew quiz</Text>
          {pack.quiz.slice(0, 3).map((question, index) => (
            <View key={`${question.prompt}-${index}`} style={styles.quizCard}>
              <Text style={styles.quizPrompt}>{index + 1}. {question.prompt}</Text>
              {question.options.length ? <Text style={styles.quizOptions}>{question.options.join(' / ')}</Text> : null}
              {question.answer ? <Text style={styles.quizAnswer}>Answer: {question.answer}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {pack.flashcards.length ? (
        <View style={styles.aiBlock}>
          <Text style={styles.aiBlockTitle}>Flashcards</Text>
          {pack.flashcards.slice(0, 4).map((card, index) => (
            <View key={`${card.front}-${index}`} style={styles.flashcard}>
              <Text style={styles.flashFront}>{card.front}</Text>
              <Text style={styles.flashBack}>{card.back}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {pack.studyTasks.length ? (
        <View style={styles.aiBlock}>
          <Text style={styles.aiBlockTitle}>Group tasks</Text>
          {pack.studyTasks.slice(0, 4).map((task, index) => (
            <Text key={`${task}-${index}`} style={styles.taskText}>{index + 1}. {task}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StatBox({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <View style={styles.statBox}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RefreshButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.refreshButton}>
      {loading ? <ActivityIndicator color={colors.tealDark} /> : <RefreshCcw size={17} color={colors.tealDark} />}
    </Pressable>
  );
}

function PrimaryAction({
  label,
  icon,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  loading?: boolean;
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

function resourceNoteText(content: Record<string, unknown>) {
  const note = content.note;
  return typeof note === 'string' && note.trim() ? note : 'Study note';
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: {
    gap: 18,
  },
  hero: {
    minHeight: 220,
    borderRadius: 30,
    padding: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#101916',
    borderWidth: 1,
    borderColor: '#20352f',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222a21',
    borderWidth: 1,
    borderColor: '#3d4738',
  },
  heroCopy: {
    flex: 1.4,
    minWidth: 240,
    gap: 10,
  },
  heroPill: {
    alignSelf: 'flex-start',
    minHeight: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
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
    fontSize: 35,
    lineHeight: 41,
    fontWeight: '900',
  },
  heroBody: {
    color: '#dce7e1',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '800',
  },
  aiHeroButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.tealDark,
  },
  aiHeroButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  heroStats: {
    flex: 1,
    minWidth: 250,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    minWidth: 96,
    flex: 1,
    borderRadius: 22,
    padding: 13,
    gap: 6,
    backgroundColor: colors.softGold,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  statValue: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  inviteBox: {
    minWidth: 172,
    flex: 1.2,
    borderRadius: 22,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#e8f8ee',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  inviteLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  inviteCode: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 12,
  },
  chatPanel: {
    minWidth: 310,
    flex: 1.35,
    borderRadius: 26,
    padding: 16,
    gap: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  sideStack: {
    minWidth: 280,
    flex: 0.85,
    gap: 12,
  },
  resourcePanel: {
    borderRadius: 26,
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  aiPanel: {
    borderRadius: 26,
    padding: 16,
    gap: 12,
    backgroundColor: '#fff8df',
    borderWidth: 1,
    borderColor: '#f2d995',
  },
  panelTitleRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panelTitleIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  panelTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  messageList: {
    minHeight: 280,
    gap: 10,
  },
  messageBubble: {
    maxWidth: '88%',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 5,
    backgroundColor: colors.softTeal,
  },
  messageBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.tealDark,
  },
  messageBody: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  messageBodyMine: {
    color: '#ffffff',
  },
  messageTime: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  messageTimeMine: {
    color: '#dce7e1',
  },
  emptyThread: {
    minHeight: 200,
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f8fbf8',
    borderWidth: 1,
    borderColor: colors.line,
  },
  aiEmpty: {
    minHeight: 124,
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f2d995',
  },
  aiPack: {
    gap: 12,
  },
  aiPackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiPackTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  aiPackBadge: {
    overflow: 'hidden',
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 5,
    color: '#ffffff',
    backgroundColor: colors.tealDark,
    fontSize: 10,
    fontWeight: '900',
  },
  aiSummary: {
    color: '#443d26',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
  },
  aiBlock: {
    gap: 8,
  },
  aiBlockTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  aiPoint: {
    borderRadius: 17,
    padding: 11,
    flexDirection: 'row',
    gap: 9,
    backgroundColor: '#ffffff',
  },
  aiPointNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    textAlign: 'center',
    color: '#ffffff',
    backgroundColor: colors.tealDark,
    fontSize: 12,
    lineHeight: 24,
    fontWeight: '900',
  },
  aiPointText: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  quizCard: {
    borderRadius: 17,
    padding: 11,
    gap: 5,
    backgroundColor: '#ffffff',
  },
  quizPrompt: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
  },
  quizOptions: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
  },
  quizAnswer: {
    color: colors.tealDark,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '900',
  },
  flashcard: {
    borderRadius: 17,
    padding: 11,
    gap: 5,
    backgroundColor: '#ffffff',
  },
  flashFront: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
  },
  flashBack: {
    color: '#443d26',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  taskText: {
    color: '#443d26',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  composer: {
    minHeight: 54,
    borderRadius: 20,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#f8fbf8',
    borderWidth: 1,
    borderColor: colors.line,
  },
  composerInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 110,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: colors.ink,
    backgroundColor: '#f8fbf8',
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 15,
    fontWeight: '800',
  },
  noteInput: {
    minHeight: 116,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.tealDark,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  resourceCard: {
    borderRadius: 19,
    padding: 13,
    gap: 7,
    backgroundColor: colors.softGold,
  },
  resourceTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  resourceBody: {
    color: '#4a4638',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  resourceMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  centerPanel: {
    minHeight: 320,
    borderRadius: 26,
    padding: 16,
    alignItems: 'center',
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
  emptyMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    color: '#a13c33',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '900',
  },
});
