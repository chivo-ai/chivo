import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import {
  Bot,
  BookOpen,
  CheckCircle2,
  FileText,
  Headphones,
  MessageCircle,
  Mic,
  Pause,
  Play,
  Radio,
  Send,
  Sparkles,
  Square,
  UserCircle,
  Users,
  Volume2,
  X,
} from 'lucide-react-native';

import { LanguagePicker, speechLocaleForLanguage } from '../../../components/LanguagePicker';
import {
  addClassResource,
  ClassAiPack,
  ClassRecordingUpload,
  ClassStudyResource,
  ClassStudyRoom as ClassStudyRoomData,
  classAiPackFromResource,
  createClassLiveSession,
  endClassLiveSession,
  fetchClassStudyRoom,
  processClassStudyPack,
  processClassVoiceNote,
  sendClassMessage,
  uploadClassVoiceNote,
} from '../../../services/classroom';
import { SchoolSetupState } from '../../../services/school';
import { colors } from '../../../theme/tokens';

type ClassTab = 'chat' | 'ai' | 'notes' | 'voice' | 'live' | 'members';
type SavingState = 'message' | 'resource' | 'ai' | 'voice' | 'transcribe' | 'live' | 'endLive' | null;
type SpeechState = 'idle' | 'speaking' | 'paused';

const tabs: Array<{ id: ClassTab; label: string; icon: ReactNode }> = [
  { id: 'chat', label: 'Chat', icon: <MessageCircle size={16} color={colors.tealDark} /> },
  { id: 'ai', label: 'AI', icon: <Sparkles size={16} color={colors.gold} /> },
  { id: 'notes', label: 'Notes', icon: <BookOpen size={16} color={colors.blue} /> },
  { id: 'voice', label: 'Voice', icon: <Mic size={16} color={colors.coral} /> },
  { id: 'live', label: 'Live', icon: <Radio size={16} color={colors.teal} /> },
  { id: 'members', label: 'People', icon: <Users size={16} color={colors.tealDark} /> },
];

const tones = {
  gold: { background: '#fff4d4', accent: colors.gold },
  blue: { background: '#e9f6ff', accent: '#4aa6d9' },
  violet: { background: '#f3eaff', accent: '#8d68d8' },
  green: { background: '#e8f8ee', accent: '#39a96b' },
};

type ClassStudyRoomProps = {
  classId: string;
  className: string;
  classUsername: string;
  gradeLevel?: string | null;
  setup: SchoolSetupState;
};

export function ClassStudyRoom({
  classId,
  className,
  classUsername,
  gradeLevel,
  setup,
}: ClassStudyRoomProps) {
  const [room, setRoom] = useState<ClassStudyRoomData | null>(null);
  const [activeTab, setActiveTab] = useState<ClassTab>('chat');
  const [messageText, setMessageText] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceNote, setResourceNote] = useState('');
  const [voiceTitle, setVoiceTitle] = useState('Class voice note');
  const [voiceLanguage, setVoiceLanguage] = useState('English');
  const [liveTitle, setLiveTitle] = useState('Live class study');
  const [capturedAudio, setCapturedAudio] = useState<ClassRecordingUpload | null>(null);
  const [saving, setSaving] = useState<SavingState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribingResourceId, setTranscribingResourceId] = useState<string | null>(null);
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioState = useAudioRecorderState(audioRecorder);

  const aiResources = useMemo(
    () => room?.resources.filter((resource) => resource.resourceType === 'ai_pack') ?? [],
    [room?.resources]
  );
  const noteResources = useMemo(
    () => room?.resources.filter((resource) => ['note', 'voice_transcript'].includes(resource.resourceType)) ?? [],
    [room?.resources]
  );
  const voiceResources = useMemo(
    () => room?.resources.filter((resource) => resource.resourceType === 'voice_note') ?? [],
    [room?.resources]
  );
  const liveResources = useMemo(
    () => room?.resources.filter((resource) => resource.resourceType === 'live_session') ?? [],
    [room?.resources]
  );
  const latestAiPack = useMemo(
    () => aiResources.map(classAiPackFromResource).find(Boolean) ?? null,
    [aiResources]
  );
  const activeLiveSession = useMemo(
    () => liveResources.find((resource) => resource.content.status === 'live') ?? null,
    [liveResources]
  );
  const memberProfiles = useMemo(() => {
    const byMembershipId = new Map(setup.members.map((member) => [member.id, member]));
    return room?.members.map((member) => ({
      ...member,
      profile: byMembershipId.get(member.schoolMembershipId) ?? null,
    })) ?? [];
  }, [room?.members, setup.members]);
  const canEndLive = Boolean(activeLiveSession?.createdBy && activeLiveSession.createdBy === room?.viewerProfileId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setRoom(await fetchClassStudyRoom(classId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load classroom study room.');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () => () => {
      void Speech.stop().catch(() => undefined);
      if (audioRecorder.isRecording) {
        void audioRecorder.stop().catch(() => undefined);
      }
    },
    [audioRecorder]
  );

  async function sendMessage() {
    if (!messageText.trim()) {
      return;
    }

    setSaving('message');
    setError(null);

    try {
      await sendClassMessage(classId, messageText);
      setMessageText('');
      await load();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
    } finally {
      setSaving(null);
    }
  }

  async function saveNote() {
    if (!resourceTitle.trim() || !resourceNote.trim()) {
      return;
    }

    setSaving('resource');
    setError(null);

    try {
      await addClassResource({
        classId,
        title: resourceTitle,
        note: resourceNote,
      });
      setResourceTitle('');
      setResourceNote('');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save note.');
    } finally {
      setSaving(null);
    }
  }

  async function generateAiPack() {
    setAiModalOpen(true);
    setSaving('ai');
    setError(null);

    try {
      await processClassStudyPack(classId);
      await load();
      setActiveTab('ai');
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : 'Unable to generate class AI pack.');
    } finally {
      setSaving(null);
    }
  }

  async function startRecording() {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setNotice('Microphone access is needed.');
        return;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setCapturedAudio(null);
      setRecording(true);
      setNotice('Recording class voice note.');
    } catch {
      setRecording(false);
      setNotice('Recording could not start.');
    }
  }

  async function stopRecording() {
    try {
      const status = audioRecorder.getStatus();
      const durationSeconds = Math.max(1, Math.round((status.durationMillis ?? audioState.durationMillis) / 1000));

      if (audioRecorder.isRecording || audioState.isRecording || status.canRecord) {
        await audioRecorder.stop();
      }

      const uri = audioRecorder.uri ?? status.url;
      setRecording(false);

      if (!uri) {
        setNotice('Recording stopped, but no file was saved.');
        return;
      }

      setCapturedAudio({
        uri,
        mimeType: 'audio/aac',
        durationSeconds,
      });
      setNotice('Voice note is ready to share.');
    } catch {
      setRecording(false);
      setNotice('Recording could not be saved.');
    }
  }

  async function saveVoiceNote() {
    if (!capturedAudio) {
      return;
    }

    setSaving('voice');
    setError(null);

    try {
      await uploadClassVoiceNote({
        classId,
        title: voiceTitle,
        recording: capturedAudio,
      });
      setCapturedAudio(null);
      setNotice('Voice note shared.');
      await load();
    } catch (voiceError) {
      setError(voiceError instanceof Error ? voiceError.message : 'Unable to save voice note.');
    } finally {
      setSaving(null);
    }
  }

  async function transcribeVoice(resourceId: string) {
    setSaving('transcribe');
    setTranscribingResourceId(resourceId);
    setError(null);

    try {
      await processClassVoiceNote({
        resourceId,
        language: voiceLanguage,
      });
      setNotice('Class voice note transcribed.');
      await load();
    } catch (voiceError) {
      setError(voiceError instanceof Error ? voiceError.message : 'Unable to transcribe voice note.');
    } finally {
      setSaving(null);
      setTranscribingResourceId(null);
    }
  }

  async function startLive() {
    if (activeLiveSession) {
      return;
    }

    setSaving('live');
    setError(null);

    try {
      await createClassLiveSession({ classId, title: liveTitle });
      await sendClassMessage(classId, `Live class study started: ${liveTitle}`);
      await load();
    } catch (liveError) {
      setError(liveError instanceof Error ? liveError.message : 'Unable to start live session.');
    } finally {
      setSaving(null);
    }
  }

  async function endLive() {
    if (!activeLiveSession) {
      return;
    }

    setSaving('endLive');
    setError(null);

    try {
      await endClassLiveSession(activeLiveSession.id);
      await sendClassMessage(classId, `Live class study ended: ${activeLiveSession.title}`);
      await load();
    } catch (liveError) {
      setError(liveError instanceof Error ? liveError.message : 'Unable to end live session.');
    } finally {
      setSaving(null);
    }
  }

  async function speakText(text: string) {
    const spoken = text.trim();

    if (!spoken) {
      setNotice('Nothing to read yet.');
      return;
    }

    await Speech.stop().catch(() => undefined);
    const speechLimit = typeof (Speech as unknown as { maxSpeechInputLength?: number }).maxSpeechInputLength === 'number'
      ? (Speech as unknown as { maxSpeechInputLength: number }).maxSpeechInputLength
      : spoken.length;

    Speech.speak(spoken.slice(0, Math.max(1, speechLimit)), {
      language: speechLocaleForLanguage(voiceLanguage),
      onStart: () => setSpeechState('speaking'),
      onDone: () => setSpeechState('idle'),
      onStopped: () => setSpeechState('idle'),
      onError: () => {
        setSpeechState('idle');
        setNotice('Audio playback is not available here.');
      },
    });
  }

  async function pauseSpeech() {
    try {
      await Speech.pause();
      setSpeechState('paused');
    } catch {
      setNotice('Pause is not available here.');
    }
  }

  async function resumeSpeech() {
    try {
      await Speech.resume();
      setSpeechState('speaking');
    } catch {
      setNotice('Resume is not available here.');
    }
  }

  async function stopSpeech() {
    await Speech.stop().catch(() => undefined);
    setSpeechState('idle');
  }

  return (
    <View style={styles.shell}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={styles.heroPill}>
            <Sparkles size={15} color={colors.ink} />
            <Text style={styles.heroPillText}>Classroom studio</Text>
          </View>
          <Text style={styles.heroTitle}>Study together inside {className}</Text>
          <Text style={styles.heroMeta}>/{classUsername} - {gradeLevel ?? 'Learning group'}</Text>
        </View>
        <View style={styles.heroStats}>
          <MiniStat icon={<Users size={19} color={colors.ink} />} label="People" value={memberProfiles.length} tone={tones.green} />
          <MiniStat icon={<BookOpen size={19} color={colors.ink} />} label="Notes" value={noteResources.length} tone={tones.gold} />
          <MiniStat icon={<Mic size={19} color={colors.ink} />} label="Voice" value={voiceResources.length} tone={tones.blue} />
          <MiniStat icon={<Sparkles size={19} color={colors.ink} />} label="AI" value={aiResources.length} tone={tones.violet} />
        </View>
      </View>

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tabButton, active && styles.tabButtonActive]}>
              {tab.icon}
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !room ? (
        <View style={styles.panel}>
          <ActivityIndicator color={colors.tealDark} />
          <Text style={styles.emptyMeta}>Opening classroom tools...</Text>
        </View>
      ) : null}

      {room && activeTab === 'chat' ? (
        <View style={styles.panel}>
          <PanelTitle icon={<MessageCircle size={20} color={colors.tealDark} />} title="Class chat" />
          <View style={styles.quickRow}>
            <ActionButton label="AI pack" icon={<Sparkles size={16} color="#ffffff" />} onPress={() => setAiModalOpen(true)} />
            <ActionButton label="Voice" icon={<Mic size={16} color={colors.ink} />} onPress={() => setActiveTab('voice')} light />
            <ActionButton label="Live" icon={<Radio size={16} color={colors.ink} />} onPress={() => setActiveTab('live')} light />
          </View>
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
              <EmptyPanel icon={<MessageCircle size={26} color={colors.tealDark} />} title="No class messages yet" body="Start with a question, answer, or study update." />
            )}
          </View>
          <View style={styles.composer}>
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Send a class study message"
              placeholderTextColor="#7b8983"
              style={styles.composerInput}
              multiline
            />
            <Pressable disabled={saving === 'message' || !messageText.trim()} onPress={sendMessage} style={[styles.sendButton, (!messageText.trim() || saving === 'message') && styles.buttonDisabled]}>
              {saving === 'message' ? <ActivityIndicator color="#ffffff" /> : <Send size={18} color="#ffffff" />}
            </Pressable>
          </View>
        </View>
      ) : null}

      {room && activeTab === 'ai' ? (
        <View style={styles.panel}>
          <PanelTitle icon={<Bot size={20} color={colors.gold} />} title="Shared class AI" />
          {latestAiPack ? (
            <>
              <AiPackView pack={latestAiPack} compact />
              <SpeechControls speechState={speechState} onSpeak={() => speakText(aiPackText(latestAiPack))} onPause={pauseSpeech} onResume={resumeSpeech} onStop={stopSpeech} />
            </>
          ) : (
            <EmptyPanel icon={<Sparkles size={26} color={colors.tealDark} />} title="No class AI pack yet" body="Generate one from class notes, chat, and voice transcripts." />
          )}
          <PrimaryAction label={latestAiPack ? 'Open AI modal' : 'Generate class AI'} icon={<Sparkles size={17} color="#ffffff" />} loading={saving === 'ai'} onPress={() => setAiModalOpen(true)} />
        </View>
      ) : null}

      {room && activeTab === 'notes' ? (
        <View style={styles.twoColumn}>
          <View style={styles.panel}>
            <PanelTitle icon={<FileText size={20} color={colors.blue} />} title="Add class note" />
            <TextInput value={resourceTitle} onChangeText={setResourceTitle} placeholder="Title" placeholderTextColor="#7b8983" style={styles.input} />
            <TextInput value={resourceNote} onChangeText={setResourceNote} placeholder="What should this class remember?" placeholderTextColor="#7b8983" style={[styles.input, styles.textarea]} multiline />
            <PrimaryAction label="Save note" icon={<BookOpen size={17} color="#ffffff" />} loading={saving === 'resource'} disabled={!resourceTitle.trim() || !resourceNote.trim()} onPress={saveNote} />
          </View>
          <View style={styles.panel}>
            <PanelTitle icon={<BookOpen size={20} color={colors.gold} />} title="Class notes" />
            {noteResources.length ? noteResources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} onSpeak={() => speakText(resourceText(resource))} />
            )) : (
              <EmptyPanel icon={<FileText size={26} color={colors.tealDark} />} title="No notes yet" body="Saved notes appear here and can power class AI." />
            )}
          </View>
        </View>
      ) : null}

      {room && activeTab === 'voice' ? (
        <View style={styles.twoColumn}>
          <View style={styles.panel}>
            <PanelTitle icon={<Mic size={20} color={colors.coral} />} title="Class voice note" />
            <TextInput value={voiceTitle} onChangeText={setVoiceTitle} placeholder="Voice title" placeholderTextColor="#7b8983" style={styles.input} />
            <LanguagePicker label="Transcript language" value={voiceLanguage} onChange={setVoiceLanguage} />
            <View style={styles.voiceStatus}>
              <View style={styles.voiceIcon}>{capturedAudio ? <CheckCircle2 size={19} color="#ffffff" /> : <Mic size={19} color="#ffffff" />}</View>
              <View style={styles.flexText}>
                <Text style={styles.voiceTitle}>{capturedAudio ? 'Audio ready' : recording ? 'Recording' : 'Ready to record'}</Text>
                <Text style={styles.voiceMeta}>{capturedAudio?.durationSeconds ? formatDuration(capturedAudio.durationSeconds * 1000) : formatDuration(audioState.durationMillis)}</Text>
              </View>
            </View>
            <View style={styles.quickRow}>
              {recording ? (
                <ActionButton label="Stop" icon={<Square size={16} color="#ffffff" />} onPress={stopRecording} />
              ) : (
                <ActionButton label="Record" icon={<Mic size={16} color="#ffffff" />} onPress={startRecording} />
              )}
              <PrimaryAction label="Share" icon={<Headphones size={17} color="#ffffff" />} loading={saving === 'voice'} disabled={!capturedAudio} onPress={saveVoiceNote} />
            </View>
          </View>
          <View style={styles.panel}>
            <PanelTitle icon={<Headphones size={20} color={colors.blue} />} title="Voice notes" />
            {voiceResources.length ? voiceResources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onSpeak={voiceText(resource) ? () => speakText(voiceText(resource)) : undefined}
                action={(
                  <Pressable
                    disabled={saving === 'transcribe' && transcribingResourceId === resource.id}
                    onPress={() => transcribeVoice(resource.id)}
                    style={[styles.smallButton, saving === 'transcribe' && transcribingResourceId === resource.id && styles.buttonDisabled]}
                  >
                    {saving === 'transcribe' && transcribingResourceId === resource.id ? <ActivityIndicator color={colors.tealDark} /> : <Sparkles size={14} color={colors.tealDark} />}
                    <Text style={styles.smallButtonText}>{voiceText(resource) ? 'Refresh' : 'Transcribe'}</Text>
                  </Pressable>
                )}
              />
            )) : (
              <EmptyPanel icon={<Headphones size={26} color={colors.tealDark} />} title="No voice notes yet" body="Record a quick explanation or class reminder." />
            )}
          </View>
        </View>
      ) : null}

      {room && activeTab === 'live' ? (
        <View style={styles.twoColumn}>
          <View style={styles.panel}>
            <PanelTitle icon={<Radio size={20} color={colors.teal} />} title="Live class floor" />
            {activeLiveSession ? (
              <View style={styles.liveBox}>
                <View style={styles.liveIcon}><Radio size={25} color="#ffffff" /></View>
                <Text style={styles.liveTitle}>{activeLiveSession.title}</Text>
                <Text style={styles.liveMeta}>{canEndLive ? 'You have the speaker floor' : 'One speaker is live'}</Text>
                {canEndLive ? <PrimaryAction label="End live" icon={<Square size={17} color="#ffffff" />} loading={saving === 'endLive'} onPress={endLive} /> : null}
              </View>
            ) : (
              <>
                <TextInput value={liveTitle} onChangeText={setLiveTitle} placeholder="Live class title" placeholderTextColor="#7b8983" style={styles.input} />
                <PrimaryAction label="Start live class" icon={<Radio size={17} color="#ffffff" />} loading={saving === 'live'} onPress={startLive} />
              </>
            )}
          </View>
          <View style={styles.panel}>
            <PanelTitle icon={<FileText size={20} color={colors.gold} />} title="Live history" />
            {liveResources.length ? liveResources.map((resource) => <ResourceCard key={resource.id} resource={resource} />) : (
              <EmptyPanel icon={<Radio size={26} color={colors.tealDark} />} title="No live class yet" body="Start a focused live study floor when the class is ready." />
            )}
          </View>
        </View>
      ) : null}

      {room && activeTab === 'members' ? (
        <View style={styles.panel}>
          <PanelTitle icon={<Users size={20} color={colors.tealDark} />} title="Class members" />
          <View style={styles.memberGrid}>
            {memberProfiles.map((member) => (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberIcon}><UserCircle size={22} color="#ffffff" /></View>
                <View style={styles.flexText}>
                  <Text style={styles.memberName}>{member.profile?.profiles?.full_name ?? 'Class member'}</Text>
                  <Text style={styles.memberMeta}>{formatRole(member.role)} - {formatRole(member.status)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <AiModal
        visible={aiModalOpen}
        saving={saving}
        latestAiPack={latestAiPack}
        error={error}
        onClose={() => setAiModalOpen(false)}
        onGenerate={generateAiPack}
        onSpeak={(text) => speakText(text)}
      />
    </View>
  );
}

function AiModal({
  visible,
  saving,
  latestAiPack,
  error,
  onClose,
  onGenerate,
  onSpeak,
}: {
  visible: boolean;
  saving: SavingState;
  latestAiPack: ClassAiPack | null;
  error: string | null;
  onClose: () => void;
  onGenerate: () => void;
  onSpeak: (text: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIcon}><Bot size={22} color="#ffffff" /></View>
            <View style={styles.flexText}>
              <Text style={styles.modalTitle}>Shared classroom AI</Text>
              <Text style={styles.modalMeta}>Generates summary, quiz, flashcards, and tasks for the class.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}><X size={18} color={colors.tealDark} /></Pressable>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <PrimaryAction label={latestAiPack ? 'Generate fresh pack' : 'Generate class pack'} icon={<Sparkles size={17} color="#ffffff" />} loading={saving === 'ai'} onPress={onGenerate} />
          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {latestAiPack ? (
              <>
                <AiPackView pack={latestAiPack} />
                <ActionButton label="Read aloud" icon={<Volume2 size={16} color="#ffffff" />} onPress={() => onSpeak(aiPackText(latestAiPack))} />
              </>
            ) : (
              <EmptyPanel icon={<Sparkles size={26} color={colors.tealDark} />} title="Ready when class content is ready" body="Add notes, chat, or voice transcripts first." />
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AiPackView({ pack, compact }: { pack: ClassAiPack; compact?: boolean }) {
  const keyPoints = compact ? pack.keyPoints.slice(0, 4) : pack.keyPoints;
  const quiz = compact ? pack.quiz.slice(0, 3) : pack.quiz;
  const flashcards = compact ? pack.flashcards.slice(0, 4) : pack.flashcards;
  const tasks = compact ? pack.studyTasks.slice(0, 4) : pack.studyTasks;

  return (
    <View style={styles.aiPack}>
      <View style={styles.aiHeader}>
        <Text style={styles.aiTitle}>{pack.title}</Text>
        <Text style={styles.aiBadge}>Class</Text>
      </View>
      {pack.summary ? <Text style={styles.aiSummary}>{pack.summary}</Text> : null}
      {keyPoints.length ? <ListBlock title="Key points" items={keyPoints} /> : null}
      {quiz.length ? (
        <View style={styles.aiBlock}>
          <Text style={styles.aiBlockTitle}>Class quiz</Text>
          {quiz.map((question, index) => (
            <View key={`${question.prompt}-${index}`} style={styles.quizCard}>
              <Text style={styles.quizPrompt}>{index + 1}. {question.prompt}</Text>
              {question.options.length ? <Text style={styles.quizMeta}>{question.options.join(' / ')}</Text> : null}
              {question.answer ? <Text style={styles.quizAnswer}>Answer: {question.answer}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
      {flashcards.length ? (
        <View style={styles.flashGrid}>
          {flashcards.map((card, index) => (
            <View key={`${card.front}-${index}`} style={styles.flashCard}>
              <Text style={styles.flashFront}>{card.front}</Text>
              <Text style={styles.flashBack}>{card.back}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {tasks.length ? <ListBlock title="Class tasks" items={tasks} /> : null}
    </View>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.aiBlock}>
      <Text style={styles.aiBlockTitle}>{title}</Text>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.aiPoint}>
          <Text style={styles.aiPointNumber}>{index + 1}</Text>
          <Text style={styles.aiPointText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function ResourceCard({ resource, onSpeak, action }: { resource: ClassStudyResource; onSpeak?: () => void; action?: ReactNode }) {
  return (
    <View style={styles.resourceCard}>
      <View style={styles.resourceHeader}>
        <View style={styles.resourceIcon}>{resourceIcon(resource)}</View>
        <View style={styles.flexText}>
          <Text style={styles.resourceTitle}>{resource.title}</Text>
          <Text style={styles.resourceMeta}>{formatRole(resource.resourceType)} - {formatDate(resource.createdAt)}</Text>
        </View>
        {action}
        {onSpeak ? (
          <Pressable onPress={onSpeak} style={styles.iconButton}><Volume2 size={15} color={colors.tealDark} /></Pressable>
        ) : null}
      </View>
      <Text style={styles.resourceBody}>{resourcePreview(resource)}</Text>
    </View>
  );
}

function SpeechControls({ speechState, onSpeak, onPause, onResume, onStop }: { speechState: SpeechState; onSpeak: () => void; onPause: () => void; onResume: () => void; onStop: () => void }) {
  return (
    <View style={styles.quickRow}>
      {speechState === 'paused' ? (
        <ActionButton label="Resume" icon={<Play size={16} color="#ffffff" />} onPress={onResume} />
      ) : (
        <ActionButton label={speechState === 'speaking' ? 'Pause' : 'Read aloud'} icon={speechState === 'speaking' ? <Pause size={16} color="#ffffff" /> : <Volume2 size={16} color="#ffffff" />} onPress={speechState === 'speaking' ? onPause : onSpeak} />
      )}
      <ActionButton label="Stop" icon={<Square size={16} color={colors.ink} />} onPress={onStop} light />
    </View>
  );
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <View style={styles.panelTitleRow}>
      <View style={styles.panelIcon}>{icon}</View>
      <Text style={styles.panelTitle}>{title}</Text>
    </View>
  );
}

function MiniStat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone: { background: string; accent: string } }) {
  return (
    <View style={[styles.stat, { backgroundColor: tone.background }]}>
      <View style={[styles.statIcon, { backgroundColor: tone.accent }]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({ label, icon, onPress, light }: { label: string; icon: ReactNode; onPress: () => void; light?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, light && styles.actionButtonLight]}>
      {icon}
      <Text style={[styles.actionText, light && styles.actionTextLight]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryAction({ label, icon, loading, disabled, onPress }: { label: string; icon: ReactNode; loading?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={loading || disabled} onPress={onPress} style={[styles.primaryButton, (loading || disabled) && styles.buttonDisabled]}>
      {loading ? <ActivityIndicator color="#ffffff" /> : icon}
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function EmptyPanel({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <View style={styles.emptyPanel}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMeta}>{body}</Text>
    </View>
  );
}

function resourceText(resource: ClassStudyResource) {
  const note = resource.content.note;
  const transcript = resource.content.transcript;
  const summary = resource.content.summary;

  if (typeof note === 'string' && note.trim()) return note.trim();
  if (typeof transcript === 'string' && transcript.trim()) return transcript.trim();
  if (typeof summary === 'string' && summary.trim()) return summary.trim();
  return '';
}

function voiceText(resource: ClassStudyResource) {
  return resourceText(resource);
}

function resourcePreview(resource: ClassStudyResource) {
  const text = resourceText(resource);
  if (text) return text;

  if (resource.resourceType === 'voice_note') {
    const duration = typeof resource.content.duration_seconds === 'number' ? formatDuration(resource.content.duration_seconds * 1000) : 'Audio';
    return `${duration} class voice note`;
  }

  if (resource.resourceType === 'live_session') {
    return `Status: ${formatRole(String(resource.content.status ?? 'saved'))}`;
  }

  return 'Class resource';
}

function resourceIcon(resource: ClassStudyResource) {
  if (resource.resourceType === 'voice_note') return <Headphones size={18} color="#ffffff" />;
  if (resource.resourceType === 'live_session') return <Radio size={18} color="#ffffff" />;
  return <FileText size={18} color="#ffffff" />;
}

function aiPackText(pack: ClassAiPack) {
  return [pack.title, pack.summary, pack.keyPoints.join('. '), pack.studyTasks.join('. ')].filter(Boolean).join('\n\n');
}

function formatRole(value: string) {
  return value.split('_').map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(' ');
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(milliseconds: number | null | undefined) {
  const totalSeconds = Math.max(0, Math.round((milliseconds ?? 0) / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  shell: { gap: 12 },
  hero: {
    borderRadius: 22,
    padding: 14,
    gap: 12,
    backgroundColor: '#101916',
    borderWidth: 1,
    borderColor: '#20352f',
  },
  heroCopy: { gap: 8 },
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
  heroPillText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  heroTitle: { color: '#ffffff', fontSize: 24, lineHeight: 29, fontWeight: '700' },
  heroMeta: { color: '#f6d979', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    minWidth: 112,
    flex: 1,
    borderRadius: 17,
    padding: 13,
    gap: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  statIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: '700' },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  noticeText: { color: colors.tealDark, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  errorText: { color: '#a13c33', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  tabBar: {
    minHeight: 50,
    borderRadius: 17,
    padding: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabButton: {
    minWidth: 96,
    flex: 1,
    minHeight: 44,
    borderRadius: 17,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  tabButtonActive: { backgroundColor: colors.tealDark },
  tabText: { color: colors.tealDark, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#ffffff' },
  twoColumn: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 },
  panel: {
    flex: 1,
    minWidth: 290,
    borderRadius: 20,
    padding: 12,
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  panelTitleRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softTeal },
  panelTitle: { flex: 1, color: colors.ink, fontSize: 18, lineHeight: 23, fontWeight: '700' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: {
    minHeight: 40,
    borderRadius: 15,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.tealDark,
  },
  actionButtonLight: { backgroundColor: colors.softTeal, borderWidth: 1, borderColor: '#d4e8df' },
  actionText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  actionTextLight: { color: colors.ink },
  messageList: { minHeight: 150, gap: 10 },
  messageBubble: { maxWidth: '88%', alignSelf: 'flex-start', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9, gap: 5, backgroundColor: colors.softTeal },
  messageBubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.tealDark },
  messageBody: { color: colors.ink, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  messageBodyMine: { color: '#ffffff' },
  messageTime: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  messageTimeMine: { color: '#dce7e1' },
  composer: {
    minHeight: 54,
    borderRadius: 16,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#f8fbf8',
    borderWidth: 1,
    borderColor: colors.line,
  },
  composerInput: { flex: 1, minHeight: 38, maxHeight: 110, color: colors.ink, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  sendButton: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealDark },
  input: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: '#f8fbf8',
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 15,
    fontWeight: '700',
  },
  textarea: { minHeight: 95, paddingTop: 12, textAlignVertical: 'top' },
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
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  buttonDisabled: { opacity: 0.55 },
  aiPack: { gap: 10 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiTitle: { flex: 1, color: colors.ink, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  aiBadge: { overflow: 'hidden', borderRadius: 13, paddingHorizontal: 9, paddingVertical: 5, color: '#ffffff', backgroundColor: colors.tealDark, fontSize: 10, fontWeight: '700' },
  aiSummary: { color: '#33413b', fontSize: 15, lineHeight: 21, fontWeight: '700' },
  aiBlock: { gap: 8 },
  aiBlockTitle: { color: colors.ink, fontSize: 15, lineHeight: 18, fontWeight: '700' },
  aiPoint: { borderRadius: 17, padding: 11, flexDirection: 'row', gap: 9, backgroundColor: colors.softTeal },
  aiPointNumber: { width: 24, height: 24, borderRadius: 12, overflow: 'hidden', textAlign: 'center', color: '#ffffff', backgroundColor: colors.tealDark, fontSize: 12, lineHeight: 22, fontWeight: '700' },
  aiPointText: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  quizCard: { borderRadius: 17, padding: 11, gap: 5, backgroundColor: colors.softGold },
  quizPrompt: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  quizMeta: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  quizAnswer: { color: colors.tealDark, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  flashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flashCard: { minWidth: 160, flex: 1, borderRadius: 17, padding: 12, gap: 6, backgroundColor: colors.softBlue },
  flashFront: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  flashBack: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  voiceStatus: { minHeight: 50, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.softBlue },
  voiceIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blue },
  flexText: { flex: 1, minWidth: 0 },
  voiceTitle: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  voiceMeta: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  liveBox: { borderRadius: 20, padding: 14, gap: 10, alignItems: 'center', backgroundColor: '#101916' },
  liveIcon: { width: 60, height: 57, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.coral, borderWidth: 4, borderColor: '#ffffff' },
  liveTitle: { color: '#ffffff', fontSize: 20, lineHeight: 25, fontWeight: '700', textAlign: 'center' },
  liveMeta: { color: '#dce7e1', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  memberCard: { minWidth: 220, flex: 1, minHeight: 56, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.softTeal, borderWidth: 1, borderColor: '#d4e8df' },
  memberIcon: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealDark },
  memberName: { color: colors.ink, fontSize: 15, lineHeight: 18, fontWeight: '700' },
  memberMeta: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  resourceCard: { borderRadius: 16, padding: 13, gap: 9, backgroundColor: colors.softGold },
  resourceHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10 },
  resourceIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealDark },
  resourceTitle: { color: colors.ink, fontSize: 15, lineHeight: 18, fontWeight: '700' },
  resourceMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  resourceBody: { color: '#4a4638', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  iconButton: { width: 34, height: 34, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  smallButton: { minHeight: 34, borderRadius: 13, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#ffffff' },
  smallButtonText: { color: colors.tealDark, fontSize: 11, fontWeight: '700' },
  emptyPanel: { minHeight: 95, borderRadius: 18, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f8fbf8', borderWidth: 1, borderColor: colors.line },
  emptyTitle: { color: colors.ink, fontSize: 18, lineHeight: 23, fontWeight: '700', textAlign: 'center' },
  emptyMeta: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 12, backgroundColor: 'rgba(7, 12, 10, 0.6)' },
  modalSheet: { width: '100%', maxWidth: 860, maxHeight: '88%', alignSelf: 'center', borderRadius: 20, padding: 12, gap: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  modalHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealDark },
  modalTitle: { color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: '700' },
  modalMeta: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  closeButton: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softTeal },
  modalScroll: { gap: 12, paddingBottom: 6 },
});
