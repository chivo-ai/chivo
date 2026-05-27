import { router } from 'expo-router';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCircle2,
  Copy,
  FileText,
  Headphones,
  MessageCircle,
  Mic,
  MicOff,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCcw,
  Send,
  Sparkles,
  Square,
  UserCircle,
  Users,
  Volume2,
  X,
} from 'lucide-react-native';

import { ChivoMetric } from '../../components/chivo/ChivoUI';
import { LanguagePicker, speechLocaleForLanguage } from '../../components/LanguagePicker';
import {
  addCrewResource,
  createCrewLiveSession,
  crewAiPackFromResource,
  CrewAiPack,
  CrewRecordingUpload,
  CrewResource,
  CrewRoom,
  endCrewLiveSession,
  fetchCrewRoom,
  processCrewStudyPack,
  processCrewVoiceNote,
  sendCrewMessage,
  uploadCrewVoiceNote,
} from '../../services/crews';
import { colors } from '../../theme/tokens';

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type CrewTab = 'chat' | 'ai' | 'notes' | 'voice' | 'live' | 'members';
type SavingState = 'message' | 'resource' | 'ai' | 'voice' | 'transcribe' | 'live' | 'endLive' | null;
type SpeechState = 'idle' | 'speaking' | 'paused';

const tabs: Array<{ id: CrewTab; label: string; icon: ReactNode }> = [
  { id: 'chat', label: 'Chat', icon: <MessageCircle size={16} color={colors.brandDeep} /> },
  { id: 'ai', label: 'AI pack', icon: <Sparkles size={16} color={colors.gold} /> },
  { id: 'notes', label: 'Notes', icon: <BookOpen size={16} color={colors.blue} /> },
  { id: 'voice', label: 'Voice', icon: <Mic size={16} color={colors.coral} /> },
  { id: 'live', label: 'Live', icon: <Radio size={16} color={colors.teal} /> },
  { id: 'members', label: 'Members', icon: <Users size={16} color={colors.brandDeep} /> },
];

const tones = {
  gold: { background: '#f1ffd7', accent: '#a3e635' },
  blue: { background: '#e9f1ff', accent: colors.brand },
  violet: { background: '#f3efff', accent: colors.violet },
  green: { background: '#e3fbf7', accent: colors.teal },
  coral: { background: '#fff1f4', accent: colors.coral },
};

export function CrewRoomScreen({ crewId }: { crewId: string }) {
  const [room, setRoom] = useState<CrewRoom | null>(null);
  const [activeTab, setActiveTab] = useState<CrewTab>('chat');
  const [messageText, setMessageText] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceNote, setResourceNote] = useState('');
  const [voiceTitle, setVoiceTitle] = useState('Crew voice note');
  const [voiceDraft, setVoiceDraft] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState('English');
  const [liveTitle, setLiveTitle] = useState('Live study circle');
  const [capturedAudio, setCapturedAudio] = useState<CrewRecordingUpload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SavingState>(null);
  const [transcribingResourceId, setTranscribingResourceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const voiceDraftRef = useRef('');
  const voiceBaseDraftRef = useRef('');
  const voiceInterimRef = useRef('');
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioState = useAudioRecorderState(audioRecorder);

  const activeMembers = useMemo(
    () => room?.members.filter((member) => member.status === 'active') ?? [],
    [room?.members]
  );
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
  const activeLiveSession = useMemo(
    () => liveResources.find((resource) => resource.content.status === 'live') ?? null,
    [liveResources]
  );
  const latestAiPack = useMemo(
    () => aiResources.map(crewAiPackFromResource).find(Boolean) ?? null,
    [aiResources]
  );
  const speechCaptureAvailable =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const canEndLive = Boolean(activeLiveSession?.createdBy && activeLiveSession.createdBy === room?.viewerProfileId);
  const audioDurationLabel = formatDuration(audioState.durationMillis);

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

  useEffect(
    () => () => {
      stopSpeechCapture();
      void Speech.stop().catch(() => undefined);
      if (audioRecorder.isRecording) {
        void audioRecorder.stop().catch(() => undefined);
      }
    },
    [audioRecorder]
  );

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

    setAiModalOpen(true);
    setSaving('ai');
    setError(null);

    try {
      await processCrewStudyPack(room.crew.id);
      await load();
      setActiveTab('ai');
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Unable to generate crew AI pack.');
    } finally {
      setSaving(null);
    }
  }

  async function startAudioCapture() {
    setSpeechNotice(null);

    try {
      if (audioState.canRecord) {
        audioRecorder.record();
        setListening(true);
        setCapturedAudio(null);
        setSpeechNotice('Recording voice note.');
        return;
      }

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setSpeechNotice('Microphone access is needed.');
        return;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setCapturedAudio(null);
      setListening(true);
      setSpeechNotice('Recording voice note.');
    } catch {
      setListening(false);
      setSpeechNotice('Recording could not start.');
    }
  }

  async function stopAudioCapture() {
    try {
      const status = audioRecorder.getStatus();
      const durationSeconds = Math.max(1, Math.round((status.durationMillis ?? audioState.durationMillis) / 1000));

      if (audioRecorder.isRecording || audioState.isRecording || status.canRecord) {
        await audioRecorder.stop();
      }

      const uri = audioRecorder.uri ?? status.url;
      setListening(false);

      if (!uri) {
        setSpeechNotice('Recording stopped, but no file was saved.');
        return;
      }

      setCapturedAudio({
        uri,
        mimeType: 'audio/aac',
        durationSeconds,
      });
      setSpeechNotice('Voice note saved locally. Upload it to share.');
    } catch {
      setListening(false);
      setSpeechNotice('Recording could not be saved.');
    }
  }

  function cleanVoiceText(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  function mergeVoiceParts(...parts: string[]) {
    return parts.map(cleanVoiceText).filter(Boolean).join(' ');
  }

  function setVoiceDraftText(value: string) {
    voiceDraftRef.current = value;
    setVoiceDraft(value);
  }

  function flushVoiceInterim() {
    const merged = mergeVoiceParts(voiceDraftRef.current, voiceInterimRef.current);
    setVoiceDraftText(merged);
    voiceInterimRef.current = '';
    voiceBaseDraftRef.current = merged;
    return merged;
  }

  function syncVoiceSpeech(finalText: string, interimText: string) {
    const merged = mergeVoiceParts(voiceBaseDraftRef.current, finalText);
    setVoiceDraftText(merged);
    voiceInterimRef.current = cleanVoiceText(interimText);
  }

  function startSpeechCapture() {
    if (!speechCaptureAvailable) {
      setSpeechNotice('Speech-to-text is available in supported web browsers. On mobile, record voice instead.');
      return;
    }

    stopSpeechCapture();
    voiceBaseDraftRef.current = voiceDraftRef.current;
    voiceInterimRef.current = '';

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechNotice('Speech-to-text is not available here.');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLocaleForLanguage(voiceLanguage);

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? '';

        if (result.isFinal) {
          finalText = `${finalText} ${text}`;
        } else {
          interimText = `${interimText} ${text}`;
        }
      }

      syncVoiceSpeech(finalText, interimText);
    };

    recognition.onerror = (event) => {
      setSpeechNotice(event.error === 'not-allowed' ? 'Microphone access is blocked.' : 'Speech-to-text paused.');
      setListening(false);
      listeningRef.current = false;
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition && listeningRef.current) {
        try {
          voiceBaseDraftRef.current = flushVoiceInterim();
          recognition.start();
          setListening(true);
          return;
        } catch {
          // Browser may already be stopping the session.
        }
      }

      setListening(false);
      listeningRef.current = false;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      listeningRef.current = true;
      setListening(true);
      setSpeechNotice('Listening and writing for the crew.');
    } catch {
      setSpeechNotice('Speech-to-text could not start.');
    }
  }

  function stopSpeechCapture() {
    const recognition = recognitionRef.current;
    flushVoiceInterim();
    recognitionRef.current = null;
    listeningRef.current = false;
    setListening(false);

    if (recognition) {
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;

      try {
        recognition.stop();
      } catch {
        // The browser may already have stopped listening.
      }
    }
  }

  async function saveVoiceStudy() {
    if (recognitionRef.current) {
      stopSpeechCapture();
    }

    const finalVoiceDraft = voiceDraftRef.current.trim();

    if (!room || (!capturedAudio && !finalVoiceDraft)) {
      return;
    }

    setSaving('voice');
    setError(null);

    try {
      if (capturedAudio) {
        await uploadCrewVoiceNote({
          crewId: room.crew.id,
          title: voiceTitle,
          recording: capturedAudio,
        });
      }

      if (finalVoiceDraft) {
        await addCrewResource({
          crewId: room.crew.id,
          title: `${voiceTitle || 'Crew voice transcript'} transcript`,
          resourceType: 'voice_transcript',
          content: {
            transcript: finalVoiceDraft,
            language: voiceLanguage,
            note: finalVoiceDraft,
          },
        });
      }

      setCapturedAudio(null);
      setVoiceDraftText('');
      voiceInterimRef.current = '';
      voiceBaseDraftRef.current = '';
      setSpeechNotice('Voice study saved.');
      await load();
    } catch (voiceError) {
      setError(voiceError instanceof Error ? voiceError.message : 'Unable to save voice study.');
    } finally {
      setSaving(null);
    }
  }

  async function transcribeVoiceNote(resourceId: string) {
    setSaving('transcribe');
    setTranscribingResourceId(resourceId);
    setError(null);

    try {
      await processCrewVoiceNote({
        resourceId,
        language: voiceLanguage,
      });
      setSpeechNotice('Voice note transcribed for the crew.');
      await load();
    } catch (voiceError) {
      setError(voiceError instanceof Error ? voiceError.message : 'Unable to transcribe voice note.');
    } finally {
      setSaving(null);
      setTranscribingResourceId(null);
    }
  }

  async function startLiveSession() {
    if (!room || activeLiveSession) {
      return;
    }

    setSaving('live');
    setError(null);

    try {
      await createCrewLiveSession({
        crewId: room.crew.id,
        title: liveTitle,
      });
      await sendCrewMessage(room.crew.id, `Live study circle started: ${liveTitle}`);
      await load();
    } catch (liveError) {
      setError(liveError instanceof Error ? liveError.message : 'Unable to start live session.');
    } finally {
      setSaving(null);
    }
  }

  async function endLiveSession() {
    if (!activeLiveSession) {
      return;
    }

    setSaving('endLive');
    setError(null);

    try {
      await endCrewLiveSession(activeLiveSession.id);
      if (room) {
        await sendCrewMessage(room.crew.id, `Live study circle ended: ${activeLiveSession.title}`);
      }
      await load();
    } catch (liveError) {
      setError(liveError instanceof Error ? liveError.message : 'Unable to end live session.');
    } finally {
      setSaving(null);
    }
  }

  function copyInviteCode() {
    const code = room?.crew.inviteCode;
    if (!code) {
      return;
    }

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(code);
      setNotice('Invite code copied.');
      return;
    }

    setNotice(`Invite code: ${code}`);
  }

  async function speakText(text: string) {
    const spokenText = text.trim();
    if (!spokenText) {
      setSpeechNotice('Choose text to read first.');
      return;
    }

    await Speech.stop().catch(() => undefined);
    const speechLimit = typeof (Speech as unknown as { maxSpeechInputLength?: number }).maxSpeechInputLength === 'number'
      ? (Speech as unknown as { maxSpeechInputLength: number }).maxSpeechInputLength
      : spokenText.length;

    Speech.speak(spokenText.slice(0, Math.max(1, speechLimit)), {
      language: speechLocaleForLanguage(voiceLanguage),
      onStart: () => {
        setSpeechState('speaking');
        setSpeechNotice(null);
      },
      onDone: () => setSpeechState('idle'),
      onStopped: () => setSpeechState('idle'),
      onError: () => {
        setSpeechState('idle');
        setSpeechNotice('Audio playback is not available here.');
      },
    });
  }

  async function pauseSpeech() {
    if (speechState !== 'speaking') {
      return;
    }

    try {
      await Speech.pause();
      setSpeechState('paused');
    } catch {
      setSpeechNotice('Pause is not available here.');
    }
  }

  async function resumeSpeech() {
    if (speechState !== 'paused') {
      return;
    }

    try {
      await Speech.resume();
      setSpeechState('speaking');
    } catch {
      setSpeechNotice('Resume is not available here.');
    }
  }

  async function stopSpeech() {
    await Speech.stop().catch(() => undefined);
    setSpeechState('idle');
  }

  if (loading && !room) {
    return (
      <View style={styles.centerPanel}>
        <ActivityIndicator color={colors.brandDeep} />
        <Text style={styles.emptyMeta} numberOfLines={1}>Opening crew room...</Text>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.centerPanel}>
        <Users size={28} color={colors.brandDeep} />
        <Text style={styles.emptyTitle} numberOfLines={1}>Crew unavailable</Text>
        <Text style={styles.emptyMeta} numberOfLines={2}>{error ?? 'This crew could not be opened.'}</Text>
        <PrimaryAction label="Back to crews" icon={<ArrowLeft size={17} color="#ffffff" />} onPress={() => router.push('/crews' as never)} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable onPress={() => router.push('/crews' as never)} style={styles.backButton}>
            <ArrowLeft size={19} color="#ffffff" />
          </Pressable>
          <View style={styles.flexText}>
            <View style={styles.heroPill}>
              <Sparkles size={15} color={colors.ink} />
              <Text style={styles.heroPillText} numberOfLines={1}>{room.crew.scope === 'cross_school' ? 'Cross-school crew' : 'School crew'}</Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={1}>{room.crew.name}</Text>
            <Text style={styles.heroSlug} numberOfLines={1}>/{room.crew.username}</Text>
          </View>
          <Pressable onPress={() => setAiModalOpen(true)} style={styles.heroAiButton}>
            <Bot size={18} color="#ffffff" />
            <Text style={styles.heroAiText} numberOfLines={1}>AI</Text>
          </Pressable>
        </View>

        <View style={styles.heroStats}>
          <StatBox icon={<Users size={20} color={colors.ink} />} label="Members" value={activeMembers.length} tone={tones.green} />
          <StatBox icon={<BookOpen size={20} color={colors.ink} />} label="Notes" value={noteResources.length} tone={tones.gold} />
          <StatBox icon={<Mic size={20} color={colors.ink} />} label="Voice" value={voiceResources.length} tone={tones.blue} />
          <StatBox icon={<Sparkles size={20} color={colors.ink} />} label="AI packs" value={aiResources.length} tone={tones.violet} />
        </View>

        <View style={styles.inviteStrip}>
          <View style={styles.inviteCopy}>
            <Text style={styles.inviteLabel} numberOfLines={1}>Invite code</Text>
            <Text style={styles.inviteCode} numberOfLines={1}>{room.crew.inviteCode}</Text>
          </View>
          <Pressable onPress={copyInviteCode} style={styles.copyButton}>
            <Copy size={17} color={colors.brandDeep} />
          </Pressable>
        </View>
      </View>

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroller} contentContainerStyle={styles.tabBar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tabButton, active && styles.tabButtonActive]}>
              <View style={[styles.tabIcon, active && styles.tabIconActive]}>{tab.icon}</View>
              <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeTab === 'chat' ? (
        <ChatSection
          room={room}
          messageText={messageText}
          saving={saving}
          loading={loading}
          onChangeMessage={setMessageText}
          onSend={sendMessage}
          onRefresh={load}
          onOpenAi={() => setAiModalOpen(true)}
          onOpenVoice={() => setActiveTab('voice')}
          onOpenLive={() => setActiveTab('live')}
        />
      ) : null}

      {activeTab === 'ai' ? (
        <AiSection
          latestAiPack={latestAiPack}
          aiResources={aiResources}
          saving={saving}
          voiceLanguage={voiceLanguage}
          speechState={speechState}
          onGenerate={() => setAiModalOpen(true)}
          onSpeak={(text) => speakText(text)}
          onPause={pauseSpeech}
          onResume={resumeSpeech}
          onStop={stopSpeech}
        />
      ) : null}

      {activeTab === 'notes' ? (
        <NotesSection
          resourceTitle={resourceTitle}
          resourceNote={resourceNote}
          noteResources={noteResources}
          saving={saving}
          onChangeTitle={setResourceTitle}
          onChangeNote={setResourceNote}
          onSave={saveResource}
          onSpeak={(text) => speakText(text)}
        />
      ) : null}

      {activeTab === 'voice' ? (
        <VoiceSection
          voiceTitle={voiceTitle}
          voiceDraft={voiceDraft}
          voiceLanguage={voiceLanguage}
          voiceResources={voiceResources}
          capturedAudio={capturedAudio}
          listening={listening}
          saving={saving}
          speechNotice={speechNotice}
          speechState={speechState}
          audioDurationLabel={audioDurationLabel}
          speechCaptureAvailable={speechCaptureAvailable}
          onChangeTitle={setVoiceTitle}
          onChangeDraft={setVoiceDraftText}
          onChangeLanguage={setVoiceLanguage}
          onStartAudio={startAudioCapture}
          onStopAudio={stopAudioCapture}
          onStartSpeech={startSpeechCapture}
          onStopSpeech={stopSpeechCapture}
          onSave={saveVoiceStudy}
          onTranscribe={transcribeVoiceNote}
          onSpeak={(text) => speakText(text)}
          onPause={pauseSpeech}
          onResume={resumeSpeech}
          onStopRead={stopSpeech}
          transcribingResourceId={transcribingResourceId}
        />
      ) : null}

      {activeTab === 'live' ? (
        <LiveSection
          liveTitle={liveTitle}
          activeLiveSession={activeLiveSession}
          liveResources={liveResources}
          saving={saving}
          canEndLive={canEndLive}
          onChangeTitle={setLiveTitle}
          onStart={startLiveSession}
          onEnd={endLiveSession}
          onOpenVoice={() => setActiveTab('voice')}
          onOpenChat={() => setActiveTab('chat')}
        />
      ) : null}

      {activeTab === 'members' ? <MembersSection room={room} /> : null}

      <AiPackModal
        visible={aiModalOpen}
        saving={saving}
        latestAiPack={latestAiPack}
        error={error}
        onClose={() => setAiModalOpen(false)}
        onGenerate={generateSharedAiPack}
        onSpeak={(text) => speakText(text)}
      />
    </View>
  );
}

function ChatSection({
  room,
  messageText,
  saving,
  loading,
  onChangeMessage,
  onSend,
  onRefresh,
  onOpenAi,
  onOpenVoice,
  onOpenLive,
}: {
  room: CrewRoom;
  messageText: string;
  saving: SavingState;
  loading: boolean;
  onChangeMessage: (value: string) => void;
  onSend: () => void;
  onRefresh: () => void;
  onOpenAi: () => void;
  onOpenVoice: () => void;
  onOpenLive: () => void;
}) {
  return (
    <View style={styles.section}>
      <PanelTitle icon={<MessageCircle size={20} color={colors.brandDeep} />} title="Study chat" action={<RefreshButton loading={loading} onPress={onRefresh} />} />

      <View style={styles.utilityRow}>
        <UtilityButton label="AI pack" icon={<Sparkles size={16} color="#ffffff" />} onPress={onOpenAi} />
        <UtilityButton label="Voice" icon={<Mic size={16} color={colors.ink} />} onPress={onOpenVoice} light />
        <UtilityButton label="Live" icon={<Radio size={16} color={colors.ink} />} onPress={onOpenLive} light />
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
          <View style={styles.emptyThread}>
            <MessageCircle size={22} color={colors.brandDeep} />
            <Text style={styles.emptyMeta}>No messages yet.</Text>
          </View>
        )}
      </View>

      <View style={styles.composer}>
        <TextInput
          value={messageText}
          onChangeText={onChangeMessage}
          placeholder="Ask, answer, or share a study update"
          placeholderTextColor="#7b8983"
          style={styles.composerInput}
          multiline
        />
        <Pressable disabled={saving === 'message' || !messageText.trim()} onPress={onSend} style={[styles.sendButton, (!messageText.trim() || saving === 'message') && styles.buttonDisabled]}>
          {saving === 'message' ? <ActivityIndicator color="#ffffff" /> : <Send size={18} color="#ffffff" />}
        </Pressable>
      </View>
    </View>
  );
}

function AiSection({
  latestAiPack,
  aiResources,
  saving,
  speechState,
  onGenerate,
  onSpeak,
  onPause,
  onResume,
  onStop,
}: {
  latestAiPack: CrewAiPack | null;
  aiResources: CrewResource[];
  saving: SavingState;
  voiceLanguage: string;
  speechState: SpeechState;
  onGenerate: () => void;
  onSpeak: (text: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const spoken = latestAiPack ? buildAiPackSpeech(latestAiPack) : '';

  return (
    <View style={styles.section}>
      <PanelTitle icon={<Sparkles size={20} color={colors.gold} />} title="Shared Chivo AI pack" />
      <View style={styles.aiActionBand}>
        <View style={styles.flexText}>
          <Text style={styles.bandTitle}>{latestAiPack ? latestAiPack.title : 'Generate one study pack for this crew'}</Text>
          <Text style={styles.bandMeta}>{aiResources.length} saved AI pack{aiResources.length === 1 ? '' : 's'}</Text>
        </View>
        <PrimaryAction label={latestAiPack ? 'Open AI' : 'Create'} icon={<Sparkles size={17} color="#ffffff" />} loading={saving === 'ai'} onPress={onGenerate} />
      </View>

      {latestAiPack ? (
        <>
          <CrewAiPackView pack={latestAiPack} compact />
          <SpeechControls speechState={speechState} onSpeak={() => onSpeak(spoken)} onPause={onPause} onResume={onResume} onStop={onStop} />
        </>
      ) : (
        <EmptyPanel icon={<Bot size={28} color={colors.brandDeep} />} title="No shared AI pack yet" body="Open Chivo AI to create one from crew notes and messages." />
      )}
    </View>
  );
}

function NotesSection({
  resourceTitle,
  resourceNote,
  noteResources,
  saving,
  onChangeTitle,
  onChangeNote,
  onSave,
  onSpeak,
}: {
  resourceTitle: string;
  resourceNote: string;
  noteResources: CrewResource[];
  saving: SavingState;
  onChangeTitle: (value: string) => void;
  onChangeNote: (value: string) => void;
  onSave: () => void;
  onSpeak: (text: string) => void;
}) {
  return (
    <View style={styles.twoColumn}>
      <View style={styles.section}>
        <PanelTitle icon={<Plus size={20} color={colors.blue} />} title="Add study note" />
        <TextInput
          value={resourceTitle}
          onChangeText={onChangeTitle}
          placeholder="Title"
          placeholderTextColor="#7b8983"
          style={styles.input}
        />
        <TextInput
          value={resourceNote}
          onChangeText={onChangeNote}
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
          onPress={onSave}
        />
      </View>

      <View style={styles.section}>
        <PanelTitle icon={<BookOpen size={20} color={colors.gold} />} title="Shared notes" />
        {noteResources.length ? noteResources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} onSpeak={() => onSpeak(resourceNoteText(resource.content))} />
        )) : (
          <EmptyPanel icon={<FileText size={28} color={colors.brandDeep} />} title="No shared notes yet" body="Notes saved here can power the shared AI pack." />
        )}
      </View>
    </View>
  );
}

function VoiceSection({
  voiceTitle,
  voiceDraft,
  voiceLanguage,
  voiceResources,
  capturedAudio,
  listening,
  saving,
  speechNotice,
  speechState,
  audioDurationLabel,
  speechCaptureAvailable,
  onChangeTitle,
  onChangeDraft,
  onChangeLanguage,
  onStartAudio,
  onStopAudio,
  onStartSpeech,
  onStopSpeech,
  onSave,
  onTranscribe,
  onSpeak,
  onPause,
  onResume,
  onStopRead,
  transcribingResourceId,
}: {
  voiceTitle: string;
  voiceDraft: string;
  voiceLanguage: string;
  voiceResources: CrewResource[];
  capturedAudio: CrewRecordingUpload | null;
  listening: boolean;
  saving: SavingState;
  speechNotice: string | null;
  speechState: SpeechState;
  audioDurationLabel: string;
  speechCaptureAvailable: boolean;
  onChangeTitle: (value: string) => void;
  onChangeDraft: (value: string) => void;
  onChangeLanguage: (value: string) => void;
  onStartAudio: () => void;
  onStopAudio: () => void;
  onStartSpeech: () => void;
  onStopSpeech: () => void;
  onSave: () => void;
  onTranscribe: (resourceId: string) => void;
  onSpeak: (text: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStopRead: () => void;
  transcribingResourceId: string | null;
}) {
  return (
    <View style={styles.twoColumn}>
      <View style={styles.section}>
        <PanelTitle icon={<Mic size={20} color={colors.coral} />} title="Voice study" />
        <TextInput
          value={voiceTitle}
          onChangeText={onChangeTitle}
          placeholder="Voice title"
          placeholderTextColor="#7b8983"
          style={styles.input}
        />
        <View style={styles.voiceControls}>
          {listening ? (
            <UtilityButton label="Stop record" icon={<Square size={16} color="#ffffff" />} onPress={onStopAudio} />
          ) : (
            <UtilityButton label="Record" icon={<Mic size={16} color="#ffffff" />} onPress={onStartAudio} />
          )}
          <UtilityButton
            label={speechCaptureAvailable ? 'Speech text' : 'Text mode'}
            icon={<Headphones size={16} color={colors.ink} />}
            onPress={listening ? onStopSpeech : onStartSpeech}
            light
          />
        </View>

        <View style={styles.audioStatus}>
          <View style={styles.audioStatusIcon}>
            {capturedAudio ? <CheckCircle2 size={18} color="#ffffff" /> : listening ? <MicOff size={18} color="#ffffff" /> : <Mic size={18} color="#ffffff" />}
          </View>
          <View style={styles.flexText}>
            <Text style={styles.audioStatusTitle}>{capturedAudio ? 'Audio ready' : listening ? 'Recording' : 'Ready'}</Text>
            <Text style={styles.audioStatusMeta}>{capturedAudio?.durationSeconds ? formatDuration((capturedAudio.durationSeconds ?? 0) * 1000) : audioDurationLabel}</Text>
          </View>
        </View>

        <LanguagePicker label="Voice language" value={voiceLanguage} onChange={onChangeLanguage} />
        <TextInput
          value={voiceDraft}
          onChangeText={onChangeDraft}
          placeholder="Transcript, spoken idea, or revision note"
          placeholderTextColor="#7b8983"
          style={[styles.input, styles.voiceInput]}
          multiline
        />

        <View style={styles.voiceControls}>
          <PrimaryAction
            label="Save voice study"
            icon={<Mic size={17} color="#ffffff" />}
            loading={saving === 'voice'}
            disabled={!capturedAudio && !voiceDraft.trim()}
            onPress={onSave}
          />
          <SpeechControls speechState={speechState} onSpeak={() => onSpeak(voiceDraft)} onPause={onPause} onResume={onResume} onStop={onStopRead} compact />
        </View>
        {speechNotice ? <Text style={styles.noticeText}>{speechNotice}</Text> : null}
      </View>

      <View style={styles.section}>
        <PanelTitle icon={<Headphones size={20} color={colors.blue} />} title="Voice notes" />
        {voiceResources.length ? voiceResources.map((resource) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            onSpeak={voiceResourceText(resource) ? () => onSpeak(voiceResourceText(resource)) : undefined}
            action={(
              <Pressable
                disabled={saving === 'transcribe' && transcribingResourceId === resource.id}
                onPress={() => onTranscribe(resource.id)}
                style={[styles.miniActionButton, saving === 'transcribe' && transcribingResourceId === resource.id && styles.buttonDisabled]}
              >
                {saving === 'transcribe' && transcribingResourceId === resource.id ? (
                  <ActivityIndicator color={colors.brandDeep} />
                ) : (
                  <Sparkles size={14} color={colors.brandDeep} />
                )}
                <Text style={styles.miniActionText}>{voiceResourceText(resource) ? 'Refresh' : 'Transcribe'}</Text>
              </Pressable>
            )}
          />
        )) : (
          <EmptyPanel icon={<Headphones size={28} color={colors.brandDeep} />} title="No voice notes yet" body="Record and save the first crew voice note." />
        )}
      </View>
    </View>
  );
}

function LiveSection({
  liveTitle,
  activeLiveSession,
  liveResources,
  saving,
  canEndLive,
  onChangeTitle,
  onStart,
  onEnd,
  onOpenVoice,
  onOpenChat,
}: {
  liveTitle: string;
  activeLiveSession: CrewResource | null;
  liveResources: CrewResource[];
  saving: SavingState;
  canEndLive: boolean;
  onChangeTitle: (value: string) => void;
  onStart: () => void;
  onEnd: () => void;
  onOpenVoice: () => void;
  onOpenChat: () => void;
}) {
  return (
    <View style={styles.twoColumn}>
      <View style={styles.section}>
        <PanelTitle icon={<Radio size={20} color={colors.teal} />} title="Live study floor" />
        {activeLiveSession ? (
          <View style={styles.livePanel}>
            <View style={styles.livePulse}>
              <Radio size={26} color="#ffffff" />
            </View>
            <Text style={styles.liveTitle}>{activeLiveSession.title}</Text>
            <Text style={styles.liveMeta}>{canEndLive ? 'You have the speaker floor' : 'Speaker floor is active'}</Text>
            <View style={styles.utilityRow}>
              <UtilityButton label="Voice" icon={<Mic size={16} color="#ffffff" />} onPress={onOpenVoice} />
              <UtilityButton label="Chat" icon={<MessageCircle size={16} color={colors.ink} />} onPress={onOpenChat} light />
            </View>
            {canEndLive ? (
              <PrimaryAction label="End live circle" icon={<Square size={17} color="#ffffff" />} loading={saving === 'endLive'} onPress={onEnd} />
            ) : null}
          </View>
        ) : (
          <>
            <TextInput
              value={liveTitle}
              onChangeText={onChangeTitle}
              placeholder="Live study title"
              placeholderTextColor="#7b8983"
              style={styles.input}
            />
            <PrimaryAction label="Start live circle" icon={<Radio size={17} color="#ffffff" />} loading={saving === 'live'} onPress={onStart} />
          </>
        )}
      </View>

      <View style={styles.section}>
        <PanelTitle icon={<FileText size={20} color={colors.gold} />} title="Live history" />
        {liveResources.length ? liveResources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        )) : (
          <EmptyPanel icon={<Radio size={28} color={colors.brandDeep} />} title="No live circles yet" body="Start a session when the crew is ready." />
        )}
      </View>
    </View>
  );
}

function MembersSection({ room }: { room: CrewRoom }) {
  return (
    <View style={styles.section}>
      <PanelTitle icon={<Users size={20} color={colors.brandDeep} />} title="Crew members" />
      <View style={styles.memberGrid}>
        {room.members.map((member) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberIcon}>
              <UserCircle size={22} color="#ffffff" />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.memberTitle}>{member.profileId === room.viewerProfileId ? 'You' : shortId(member.profileId)}</Text>
              <Text style={styles.memberMeta}>{formatRole(member.role)} - {formatRole(member.status)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function AiPackModal({
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
  latestAiPack: CrewAiPack | null;
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
            <View style={styles.modalIcon}>
              <Bot size={22} color="#ffffff" />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.modalTitle}>Shared Chivo AI</Text>
              <Text style={styles.modalMeta}>Summary, quiz, cards, and group tasks</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={18} color={colors.brandDeep} />
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryAction
            label={latestAiPack ? 'Generate fresh pack' : 'Generate shared pack'}
            icon={<Sparkles size={17} color="#ffffff" />}
            loading={saving === 'ai'}
            onPress={onGenerate}
          />

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {latestAiPack ? (
              <>
                <CrewAiPackView pack={latestAiPack} />
                <UtilityButton label="Read aloud" icon={<Volume2 size={16} color="#ffffff" />} onPress={() => onSpeak(buildAiPackSpeech(latestAiPack))} />
              </>
            ) : (
              <EmptyPanel icon={<Sparkles size={28} color={colors.brandDeep} />} title="Ready when the crew is ready" body="Add notes or chat messages, then generate." />
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CrewAiPackView({ pack, compact }: { pack: CrewAiPack; compact?: boolean }) {
  const keyPoints = compact ? pack.keyPoints.slice(0, 4) : pack.keyPoints;
  const quiz = compact ? pack.quiz.slice(0, 3) : pack.quiz;
  const flashcards = compact ? pack.flashcards.slice(0, 4) : pack.flashcards;
  const studyTasks = compact ? pack.studyTasks.slice(0, 4) : pack.studyTasks;

  return (
    <View style={styles.aiPack}>
      <View style={styles.aiPackHeader}>
        <Text style={styles.aiPackTitle}>{pack.title}</Text>
        <Text style={styles.aiPackBadge}>Shared</Text>
      </View>

      {pack.summary ? <Text style={styles.aiSummary}>{pack.summary}</Text> : null}

      {keyPoints.length ? (
        <View style={styles.aiBlock}>
          <Text style={styles.aiBlockTitle}>Key points</Text>
          {keyPoints.map((point, index) => (
            <View key={`${point}-${index}`} style={styles.aiPoint}>
              <Text style={styles.aiPointNumber}>{index + 1}</Text>
              <Text style={styles.aiPointText}>{point}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {quiz.length ? (
        <View style={styles.aiBlock}>
          <Text style={styles.aiBlockTitle}>Crew quiz</Text>
          {quiz.map((question, index) => (
            <View key={`${question.prompt}-${index}`} style={styles.quizCard}>
              <Text style={styles.quizPrompt}>{index + 1}. {question.prompt}</Text>
              {question.options.length ? <Text style={styles.quizOptions}>{question.options.join(' / ')}</Text> : null}
              {question.answer ? <Text style={styles.quizAnswer}>Answer: {question.answer}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {flashcards.length ? (
        <View style={styles.aiBlock}>
          <Text style={styles.aiBlockTitle}>Flashcards</Text>
          <View style={styles.flashGrid}>
            {flashcards.map((card, index) => (
              <View key={`${card.front}-${index}`} style={styles.flashcard}>
                <Text style={styles.flashFront}>{card.front}</Text>
                <Text style={styles.flashBack}>{card.back}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {studyTasks.length ? (
        <View style={styles.aiBlock}>
          <Text style={styles.aiBlockTitle}>Group tasks</Text>
          {studyTasks.map((task, index) => (
            <Text key={`${task}-${index}`} style={styles.taskText}>{index + 1}. {task}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ResourceCard({ resource, onSpeak, action }: { resource: CrewResource; onSpeak?: () => void; action?: ReactNode }) {
  return (
    <View style={styles.resourceCard}>
      <View style={styles.resourceHeader}>
        <View style={styles.resourceIcon}>{iconForResource(resource)}</View>
        <View style={styles.flexText}>
          <Text style={styles.resourceTitle} numberOfLines={1}>{resource.title}</Text>
          <Text style={styles.resourceMeta} numberOfLines={1}>{formatResourceType(resource.resourceType)} - {formatDate(resource.createdAt)}</Text>
        </View>
        {action}
        {onSpeak ? (
          <Pressable onPress={onSpeak} style={styles.miniIconButton}>
            <Volume2 size={15} color={colors.brandDeep} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.resourceBody} numberOfLines={4}>{resourcePreview(resource)}</Text>
    </View>
  );
}

function SpeechControls({
  speechState,
  onSpeak,
  onPause,
  onResume,
  onStop,
  compact,
}: {
  speechState: SpeechState;
  onSpeak: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.speechControls, compact && styles.speechControlsCompact]}>
      {speechState === 'paused' ? (
        <UtilityButton label="Resume" icon={<Play size={16} color="#ffffff" />} onPress={onResume} />
      ) : (
        <UtilityButton label={speechState === 'speaking' ? 'Pause' : 'Read aloud'} icon={speechState === 'speaking' ? <Pause size={16} color="#ffffff" /> : <Volume2 size={16} color="#ffffff" />} onPress={speechState === 'speaking' ? onPause : onSpeak} />
      )}
      <UtilityButton label="Stop" icon={<Square size={16} color={colors.ink} />} onPress={onStop} light />
    </View>
  );
}

function PanelTitle({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <View style={styles.panelTitleRow}>
      <View style={styles.panelTitleIcon}>{icon}</View>
      <Text style={styles.panelTitle} numberOfLines={1}>{title}</Text>
      {action}
    </View>
  );
}

function StatBox({ icon, label, value }: { icon: ReactNode; label: string; value: string | number; tone: { background: string; accent: string } }) {
  return <ChivoMetric icon={icon} label={label} value={value} tone="surface" />;
}

function RefreshButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.refreshButton}>
      {loading ? <ActivityIndicator color={colors.brandDeep} /> : <RefreshCcw size={17} color={colors.brandDeep} />}
    </Pressable>
  );
}

function UtilityButton({ label, icon, onPress, light }: { label: string; icon: ReactNode; onPress: () => void; light?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.utilityButton, light && styles.utilityButtonLight]}>
      <View style={[styles.utilityIcon, light && styles.utilityIconLight]}>{icon}</View>
      <Text style={[styles.utilityText, light && styles.utilityTextLight]} numberOfLines={1}>{label}</Text>
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
      {loading ? <ActivityIndicator color="#ffffff" /> : <View style={styles.primaryButtonIcon}>{icon}</View>}
      <Text style={styles.primaryButtonText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function EmptyPanel({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <View style={styles.emptyPanel}>
      {icon}
      <Text style={styles.emptyTitle} numberOfLines={2}>{title}</Text>
      <Text style={styles.emptyMeta} numberOfLines={3}>{body}</Text>
    </View>
  );
}

function resourceNoteText(content: Record<string, unknown>) {
  const note = content.note;
  const transcript = content.transcript;

  if (typeof note === 'string' && note.trim()) {
    return note;
  }

  if (typeof transcript === 'string' && transcript.trim()) {
    return transcript;
  }

  return 'Study note';
}

function resourcePreview(resource: CrewResource) {
  if (resource.resourceType === 'voice_note') {
    const text = voiceResourceText(resource);
    if (text) {
      return text;
    }

    const duration = typeof resource.content.duration_seconds === 'number' ? formatDuration(resource.content.duration_seconds * 1000) : 'Audio';
    return `${duration} voice note`;
  }

  if (resource.resourceType === 'live_session') {
    const status = typeof resource.content.status === 'string' ? resource.content.status : 'saved';
    return `Status: ${formatRole(status)}`;
  }

  return resourceNoteText(resource.content);
}

function voiceResourceText(resource: CrewResource) {
  const transcript = resource.content.transcript;
  const summary = resource.content.summary;

  if (typeof transcript === 'string' && transcript.trim()) {
    return transcript.trim();
  }

  if (typeof summary === 'string' && summary.trim()) {
    return summary.trim();
  }

  return '';
}

function iconForResource(resource: CrewResource) {
  if (resource.resourceType === 'voice_note') {
    return <Headphones size={18} color="#ffffff" />;
  }

  if (resource.resourceType === 'voice_transcript') {
    return <Mic size={18} color="#ffffff" />;
  }

  if (resource.resourceType === 'live_session') {
    return <Radio size={18} color="#ffffff" />;
  }

  return <FileText size={18} color="#ffffff" />;
}

function formatResourceType(value: string) {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatRole(value: string) {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function shortId(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function buildAiPackSpeech(pack: CrewAiPack) {
  return [
    pack.title,
    pack.summary,
    pack.keyPoints.length ? `Key points. ${pack.keyPoints.join('. ')}` : '',
    pack.studyTasks.length ? `Group tasks. ${pack.studyTasks.join('. ')}` : '',
  ].filter(Boolean).join('\n\n');
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(milliseconds: number | null | undefined) {
  const totalSeconds = Math.max(0, Math.round((milliseconds ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const styles = StyleSheet.create({
  screen: {
    gap: 12,
  },
  hero: {
    minHeight: 126,
    borderRadius: 8,
    padding: 14,
    gap: 12,
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  heroPill: {
    alignSelf: 'flex-start',
    minHeight: 22,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.mint,
  },
  heroPillText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  heroSlug: {
    color: colors.brandGlow,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  heroAiButton: {
    minWidth: 48,
    height: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    borderWidth: 1,
    borderColor: '#6b8cff',
  },
  heroAiText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  inviteStrip: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  inviteCopy: {
    flex: 1,
    minWidth: 0,
  },
  inviteLabel: {
    color: '#aebcb6',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  inviteCode: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  copyButton: {
    width: 31,
    height: 31,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  tabScroller: {
    maxHeight: 43,
  },
  tabBar: {
    minHeight: 38,
    paddingVertical: 3,
    paddingHorizontal: 2,
    flexDirection: 'row',
    gap: 6,
  },
  tabButton: {
    minWidth: 78,
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  tabButtonActive: {
    backgroundColor: colors.brandDeep,
  },
  tabIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  tabIconActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  tabText: {
    color: colors.brandDeep,
    fontSize: 11,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  section: {
    borderRadius: 8,
    padding: 12,
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  twoColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 8,
  },
  panelTitleRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panelTitleIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  panelTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  refreshButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  utilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  utilityButton: {
    minHeight: 32,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.brand,
  },
  utilityIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  utilityIconLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5f2',
  },
  utilityButtonLight: {
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  utilityText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  utilityTextLight: {
    color: colors.ink,
  },
  messageList: {
    minHeight: 112,
    gap: 7,
  },
  messageBubble: {
    maxWidth: '88%',
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 4,
    backgroundColor: colors.softBlue,
  },
  messageBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand,
  },
  messageBody: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  messageBodyMine: {
    color: '#ffffff',
  },
  messageTime: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  messageTimeMine: {
    color: '#d8e0ef',
  },
  emptyThread: {
    minHeight: 86,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  composer: {
    minHeight: 44,
    borderRadius: 10,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  composerInput: {
    flex: 1,
    minHeight: 34,
    maxHeight: 92,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  aiActionBand: {
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.brandDeep,
  },
  bandTitle: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
  },
  bandMeta: {
    color: '#d8e0ef',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  aiPack: {
    gap: 8,
  },
  aiPackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiPackTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  aiPackBadge: {
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    color: '#ffffff',
    backgroundColor: colors.brand,
    fontSize: 10,
    fontWeight: '700',
  },
  aiSummary: {
    color: '#33413b',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  aiBlock: {
    gap: 7,
  },
  aiBlockTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
  },
  aiPoint: {
    borderRadius: 8,
    padding: 9,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.softBlue,
  },
  aiPointNumber: {
    width: 22,
    height: 22,
    borderRadius: 8,
    overflow: 'hidden',
    textAlign: 'center',
    color: '#ffffff',
    backgroundColor: colors.brand,
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '700',
  },
  aiPointText: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  quizCard: {
    borderRadius: 10,
    padding: 11,
    gap: 5,
    backgroundColor: colors.softGold,
  },
  quizPrompt: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  quizOptions: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  quizAnswer: {
    color: colors.brandDeep,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  flashGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flashcard: {
    minWidth: 138,
    flex: 1,
    borderRadius: 10,
    padding: 10,
    gap: 5,
    backgroundColor: colors.softBlue,
  },
  flashFront: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  flashBack: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  taskText: {
    color: '#33413b',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  input: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: colors.ink,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dfe6f0',
    fontSize: 14,
    fontWeight: '600',
  },
  noteInput: {
    minHeight: 68,
    paddingTop: 9,
    textAlignVertical: 'top',
  },
  voiceInput: {
    minHeight: 72,
    paddingTop: 9,
    textAlignVertical: 'top',
  },
  voiceControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  audioStatus: {
    minHeight: 44,
    borderRadius: 10,
    padding: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.softBlue,
  },
  audioStatusIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  audioStatusTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  audioStatusMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  speechControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speechControlsCompact: {
    flex: 1,
  },
  livePanel: {
    borderRadius: 8,
    padding: 10,
    gap: 8,
    alignItems: 'center',
    backgroundColor: colors.brandDeep,
  },
  livePulse: {
    width: 50,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coral,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  liveTitle: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  liveMeta: {
    color: '#d8e0ef',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  memberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  memberCard: {
    minWidth: 190,
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  memberIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandDeep,
  },
  memberTitle: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  memberMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  resourceCard: {
    borderRadius: 8,
    padding: 9,
    gap: 6,
    backgroundColor: colors.softGold,
  },
  resourceHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resourceIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandDeep,
  },
  resourceTitle: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  resourceMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  resourceBody: {
    color: '#4a4638',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  miniIconButton: {
    width: 31,
    height: 31,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  miniActionButton: {
    minHeight: 31,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
  },
  miniActionText: {
    color: colors.brandDeep,
    fontSize: 11,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brandDeep,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButtonIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  emptyPanel: {
    minHeight: 82,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: colors.line,
  },
  centerPanel: {
    minHeight: 132,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(11, 13, 18, 0.62)',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 860,
    maxHeight: '88%',
    alignSelf: 'center',
    borderRadius: 10,
    padding: 10,
    gap: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandDeep,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  modalMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
  },
  modalScroll: {
    gap: 10,
    paddingBottom: 6,
  },
  noticeText: {
    color: colors.brandDeep,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  errorText: {
    color: '#a13c33',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});
