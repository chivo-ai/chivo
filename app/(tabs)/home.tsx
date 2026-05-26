import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookOpen, Bot, Building2, DoorOpen, Layers, Mic, QrCode, Send, Sparkles, Trophy, UserPlus, Volume2, X } from 'lucide-react-native';

import { RouteScreen } from '../../src/features/app/RouteScreen';
import { useAppSession } from '../../src/features/app/AppSessionProvider';
import { useAccessMemberships } from '../../src/features/onboarding/useAccessMemberships';
import { askChivoGuide, fetchChivoGuideHistory } from '../../src/services/chivoGuide';
import { colors } from '../../src/theme/tokens';

type GuideMessage = {
  role: 'assistant' | 'user';
  content: string;
};

type HomeSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start: () => void;
  stop: () => void;
};

const tones = [
  { background: '#fff4d4', accent: colors.gold },
  { background: '#e9f6ff', accent: '#4aa6d9' },
  { background: '#f3eaff', accent: '#8d68d8' },
  { background: '#e8f8ee', accent: '#39a96b' },
];

const suggestedQuestions = [
  'What is Chivo AI?',
  'Why should a school use Chivo?',
  'How do students learn with Chivo?',
  'How can AI help my class?',
];

const firstGuideMessage: GuideMessage = {
  role: 'assistant',
  content: 'Hi, I am Chivo AI. Ask me about schools, classes, lessons, study support, science, art, nature, or how this platform helps students learn better.',
};

export default function HomeTabRoute() {
  const { user } = useAppSession();
  const { activeMemberships, pendingMemberships } = useAccessMemberships(user);
  const schoolsCount = activeMemberships.length;
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideInput, setGuideInput] = useState('');
  const [guideSending, setGuideSending] = useState(false);
  const [guideNotice, setGuideNotice] = useState<string | null>(null);
  const [guideMessages, setGuideMessages] = useState<GuideMessage[]>([firstGuideMessage]);
  const [guideThreadId, setGuideThreadId] = useState<string | null>(null);
  const [guideHistoryLoading, setGuideHistoryLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<HomeSpeechRecognition | null>(null);

  const guidePreview = useMemo(
    () => [
      'Ask about Chivo AI, lesson recording, school flow, or any study subject.',
      'Turn live teaching into audio, transcript, quiz, cards, and progress.',
      'Review in a preferred language and learning style.',
      'Organize schools, classes, subjects, lessons, crews, and shared study packs.',
      'Prepare for future publishing, payments, verification, and on-chain learning records.',
      'Continue later with saved Chivo AI chat history.',
    ],
    []
  );

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      setGuideHistoryLoading(true);

      try {
        const history = await fetchChivoGuideHistory();

        if (!active) {
          return;
        }

        setGuideThreadId(history?.id ?? null);
        setGuideMessages(history?.messages.length ? history.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })) : [firstGuideMessage]);
      } catch (error) {
        if (active) {
          setGuideNotice(error instanceof Error ? error.message : 'Unable to load Chivo AI history.');
        }
      } finally {
        if (active) {
          setGuideHistoryLoading(false);
        }
      }
    }

    if (user) {
      void loadHistory();
    }

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    void Speech.stop().catch(() => undefined);
  }, []);

  if (!user) {
    return null;
  }

  async function sendGuideQuestion(questionValue?: string, inputType: 'text' | 'voice' = 'text') {
    const question = (questionValue ?? guideInput).trim();

    if (!question || guideSending) {
      return;
    }

    setGuideOpen(true);
    setGuideInput('');
    setGuideNotice(null);
    setGuideSending(true);
    setGuideMessages((current) => [...current, { role: 'user', content: question }]);

    try {
      const response = await askChivoGuide({ question, threadId: guideThreadId, inputType });
      setGuideThreadId(response.threadId);
      const answer = response.answer;
      setGuideMessages((current) => [...current, { role: 'assistant', content: answer }]);
      await speakGuideAnswer(answer);
    } catch (error) {
      setGuideMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Chivo AI could not answer right now. Please try again.',
        },
      ]);
    } finally {
      setGuideSending(false);
    }
  }

  async function speakGuideAnswer(answer: string) {
    await Speech.stop().catch(() => undefined);
    const maxLength = Number.isFinite(Speech.maxSpeechInputLength) ? Speech.maxSpeechInputLength : 3000;
    Speech.speak(answer.slice(0, Math.max(1, maxLength)), {
      rate: 0.95,
      pitch: 1,
    });
  }

  function startVoiceQuestion() {
    const Recognition = getSpeechRecognition();

    if (!Recognition) {
      setGuideOpen(true);
      setGuideNotice('Voice input works in supported web browsers. On mobile, use your keyboard microphone, then send your question.');
      return;
    }

    recognitionRef.current?.stop();
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let transcript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript ?? '';
      }

      const question = transcript.trim();
      setGuideInput(question);

      if (question) {
        void sendGuideQuestion(question, 'voice');
      }
    };
    recognition.onerror = () => {
      setListening(false);
      setGuideNotice('I could not hear that clearly. Try again or type your question.');
    };
    recognition.onend = () => setListening(false);
    setGuideOpen(true);
    setGuideNotice('Listening for your Chivo AI question...');
    setListening(true);
    recognition.start();
  }

  return (
    <RouteScreen>
      <View style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <View style={styles.heroPill}>
              <Sparkles size={12} color={colors.ink} />
              <Text style={styles.heroPillText}>Chivo AI</Text>
            </View>
            <Text style={styles.heroTitle}>Learn from every real lesson</Text>
            <Text style={styles.heroBody}>Audio, transcript, quiz, cards, and progress shaped from your school classes.</Text>
            <View style={styles.heroActions}>
              <HeroButton label="My schools" icon={<Building2 size={14} color="#ffffff" />} onPress={() => router.push('/school/my-school' as never)} />
              <HeroButton label="Join" icon={<QrCode size={14} color={colors.ink} />} onPress={() => router.push('/join' as never)} light />
            </View>
          </View>

          <View style={styles.stickerBoard}>
            <Sticker icon={<BookOpen size={15} color={colors.ink} />} label="Schools" value={schoolsCount} tone={tones[0]} />
            <Sticker icon={<Layers size={15} color={colors.ink} />} label="Cards" value={4} tone={tones[2]} />
            <Sticker icon={<Trophy size={15} color={colors.ink} />} label="Requests" value={pendingMemberships.length} tone={tones[3]} />
          </View>
        </View>

        <View style={styles.guidePanel}>
          <View style={styles.guideTop}>
            <View style={styles.guideIcon}>
              <Bot size={20} color={colors.ink} />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.guideTitle}>Ask Chivo AI</Text>
              <Text style={styles.guideMeta}>Understand the platform, lessons, study methods, and education ideas.</Text>
            </View>
          </View>

          <View style={styles.guidePoints}>
            {guidePreview.map((item) => (
              <View key={item} style={styles.guidePoint}>
                <Sparkles size={11} color={colors.tealDark} />
                <Text style={styles.guidePointText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.guideActions}>
            <Pressable onPress={() => setGuideOpen(true)} style={styles.primaryMiniAction}>
              <Bot size={14} color="#ffffff" />
              <Text style={styles.primaryMiniActionText}>Learn more</Text>
            </Pressable>
            <Pressable onPress={startVoiceQuestion} style={styles.secondaryMiniAction}>
              <Mic size={14} color={colors.ink} />
              <Text style={styles.secondaryMiniActionText}>{listening ? 'Listening' : 'Voice'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Quick access</Text>
            <Text style={styles.sectionMeta}>Open the places you use most.</Text>
          </View>
        </View>

        <View style={styles.toolGrid}>
          <QuickTool label="Classes" body="Open class rooms" icon={<DoorOpen size={19} color={colors.ink} />} tone={tones[1]} onPress={() => router.push('/school/class' as never)} />
          <QuickTool label="Lessons" body="Study library" icon={<BookOpen size={19} color={colors.ink} />} tone={tones[0]} onPress={() => router.push('/lessons' as never)} />
          <QuickTool label="Crews" body="Study groups" icon={<Sparkles size={19} color={colors.ink} />} tone={tones[2]} onPress={() => router.push('/crews' as never)} />
          <QuickTool label="Requests" body={`${pendingMemberships.length} waiting`} icon={<UserPlus size={19} color={colors.ink} />} tone={tones[3]} onPress={() => router.push('/request' as never)} />
        </View>
      </View>

      <Modal visible={guideOpen} transparent animationType="slide" onRequestClose={() => setGuideOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.guideModal}>
            <View style={styles.modalHeader}>
              <View style={styles.guideTopCompact}>
                <View style={styles.guideIconSmall}>
                  <Bot size={18} color={colors.ink} />
                </View>
                <View style={styles.flexText}>
                  <Text style={styles.modalTitle}>Chivo AI guide</Text>
                  <Text style={styles.modalMeta}>Ask with text or voice.</Text>
                </View>
              </View>
              <Pressable onPress={() => setGuideOpen(false)} style={styles.iconButton}>
                <X size={18} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
              {guideHistoryLoading ? (
                <View style={styles.typingBubble}>
                  <ActivityIndicator color={colors.tealDark} />
                  <Text style={styles.typingText}>Loading saved chat...</Text>
                </View>
              ) : null}
              {guideMessages.map((message, index) => (
                <View key={`${message.role}-${index}`} style={[styles.messageBubble, message.role === 'user' && styles.userBubble]}>
                  <Text style={[styles.messageText, message.role === 'user' && styles.userMessageText]}>{message.content}</Text>
                  {message.role === 'assistant' ? (
                    <Pressable onPress={() => speakGuideAnswer(message.content)} style={styles.listenAgain}>
                      <Volume2 size={12} color={colors.tealDark} />
                      <Text style={styles.listenAgainText}>Read aloud</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {guideSending ? (
                <View style={styles.typingBubble}>
                  <ActivityIndicator color={colors.tealDark} />
                  <Text style={styles.typingText}>Chivo AI is thinking...</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.suggestionRow}>
              {suggestedQuestions.map((question) => (
                <Pressable key={question} onPress={() => sendGuideQuestion(question)} style={styles.suggestionChip}>
                  <Text style={styles.suggestionText}>{question}</Text>
                </Pressable>
              ))}
            </View>

            {guideNotice ? <Text style={styles.noticeText}>{guideNotice}</Text> : null}

            <View style={styles.chatInputRow}>
              <Pressable onPress={startVoiceQuestion} style={[styles.voiceButton, listening && styles.voiceButtonActive]}>
                <Mic size={18} color={listening ? '#ffffff' : colors.ink} />
              </Pressable>
              <TextInput
                value={guideInput}
                onChangeText={setGuideInput}
                placeholder="Ask about Chivo AI, lessons, study, science..."
                placeholderTextColor="#6f7d78"
                multiline
                style={styles.chatInput}
              />
              <Pressable disabled={guideSending || !guideInput.trim()} onPress={() => sendGuideQuestion()} style={[styles.sendButton, (!guideInput.trim() || guideSending) && styles.sendButtonDisabled]}>
                <Send size={17} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </RouteScreen>
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

function getSpeechRecognition(): (new () => HomeSpeechRecognition) | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  return (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null) as (new () => HomeSpeechRecognition) | null;
}

const styles = StyleSheet.create({
  screen: {
    gap: 10,
  },
  hero: {
    borderRadius: 16,
    padding: 12,
    gap: 10,
    backgroundColor: '#101916',
    borderWidth: 1,
    borderColor: '#20352f',
  },
  heroCopy: {
    gap: 8,
  },
  heroPill: {
    alignSelf: 'flex-start',
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.gold,
  },
  heroPillText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
  },
  heroBody: {
    color: '#dce7e1',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroButton: {
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.tealDark,
  },
  heroButtonLight: {
    backgroundColor: '#ffffff',
  },
  heroButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  heroButtonTextLight: {
    color: colors.ink,
  },
  stickerBoard: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  sticker: {
    minWidth: 0,
    flex: 1,
    borderRadius: 13,
    padding: 8,
    gap: 3,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  stickerIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerValue: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '700',
  },
  stickerLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  guidePanel: {
    borderRadius: 16,
    padding: 12,
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  guideTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  guideTopCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minWidth: 0,
  },
  guideIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  guideIconSmall: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  guideTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '700',
  },
  guideMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  guidePoints: {
    gap: 6,
  },
  guidePoint: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
  },
  guidePointText: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  guideActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryMiniAction: {
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.tealDark,
  },
  primaryMiniActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryMiniAction: {
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondaryMiniActionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  toolCard: {
    minWidth: 150,
    flex: 1,
    borderRadius: 16,
    padding: 12,
    gap: 7,
    borderWidth: 2,
  },
  toolIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  toolBody: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5, 15, 12, 0.45)',
  },
  guideModal: {
    maxHeight: '88%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 12,
    gap: 10,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: '#dce8e2',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '700',
  },
  modalMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  messages: {
    maxHeight: 360,
  },
  messagesContent: {
    gap: 8,
    paddingBottom: 3,
  },
  messageBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    borderRadius: 15,
    padding: 10,
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  messageText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  userMessageText: {
    color: '#ffffff',
  },
  listenAgain: {
    alignSelf: 'flex-start',
    minHeight: 25,
    borderRadius: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.softTeal,
  },
  listenAgainText: {
    color: colors.tealDark,
    fontSize: 10,
    fontWeight: '700',
  },
  typingBubble: {
    alignSelf: 'flex-start',
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  typingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  suggestionChip: {
    minHeight: 30,
    borderRadius: 11,
    paddingHorizontal: 9,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  suggestionText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  noticeText: {
    color: colors.tealDark,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  voiceButtonActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 86,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
