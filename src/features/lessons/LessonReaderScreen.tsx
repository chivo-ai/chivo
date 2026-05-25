import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import {
  BookOpen,
  Brain,
  CheckCircle2,
  FileText,
  Headphones,
  Languages,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Trophy,
  Volume2,
  X,
} from 'lucide-react-native';

import { LanguagePicker, speechLocaleForLanguage } from '../../components/LanguagePicker';
import {
  fetchLessonDetail,
  LearningMode,
  LessonDetail,
  personalizeLesson,
  QuizQuestionRow,
  submitQuizAttempt,
} from '../../services/lessons';
import { SchoolSetupState } from '../../services/school';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership } from '../../types';

type LessonReaderScreenProps = {
  lessonId: string;
  membership: ActiveSchoolMembership;
  setup: SchoolSetupState;
};

type ReaderTab = 'listen' | 'read' | 'quiz' | 'cards';
type SpeechState = 'idle' | 'speaking' | 'paused';
type FullPanel = 'guide' | 'path' | 'vocabulary' | 'transcript' | null;

type PersonalContent = {
  title: string;
  transcript: string;
  keyPoints: string[];
  studySteps: string[];
  vocabulary: Array<{ term: string; meaning: string }>;
  quickCheck: Array<{ prompt: string; answer: string }>;
  encouragement: string;
};

const learningModeOptions: Array<{ id: LearningMode; label: string; body: string }> = [
  { id: 'balanced', label: 'Balanced', body: 'Clear lesson notes' },
  { id: 'simple', label: 'Simple', body: 'Gentle explanation' },
  { id: 'exam', label: 'Exam', body: 'Practice focused' },
  { id: 'story', label: 'Story', body: 'Teach like a story' },
  { id: 'catch_up', label: 'Catch up', body: 'For missed parts' },
];

const tones = {
  gold: { background: '#fff2c8', accent: colors.gold },
  blue: { background: '#e6f3ff', accent: '#4aa6d9' },
  purple: { background: '#f3eaff', accent: '#8d68d8' },
  green: { background: '#e8f8ee', accent: '#39a96b' },
  coral: { background: '#ffe9e5', accent: colors.coral },
};

export function LessonReaderScreen({ lessonId, membership, setup }: LessonReaderScreenProps) {
  const [detail, setDetail] = useState<LessonDetail | null>(null);
  const [activeTab, setActiveTab] = useState<ReaderTab>('listen');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [languageValue, setLanguageValue] = useState('English');
  const [learningMode, setLearningMode] = useState<LearningMode>('balanced');
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
  const [fullPanel, setFullPanel] = useState<FullPanel>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadLesson = useCallback(async () => {
    setError(null);
    const nextDetail = await fetchLessonDetail(lessonId, membership.id);
    setDetail(nextDetail);
  }, [lessonId, membership.id]);

  useEffect(() => {
    setLoading(true);
    loadLesson()
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not open lesson.'))
      .finally(() => setLoading(false));
  }, [loadLesson]);

  useEffect(() => {
    if (!detail) {
      return;
    }

    setLanguageValue(detail.personalization?.language ?? detail.lesson.language ?? 'English');
    setLearningMode(detail.personalization?.learning_mode ?? 'balanced');
    setSpeechState('idle');
    setSpeechMessage(null);
    void Speech.stop().catch(() => undefined);
  }, [detail?.lesson.id, detail?.personalization?.id]);

  useEffect(
    () => () => {
      void Speech.stop().catch(() => undefined);
    },
    []
  );

  const className = useMemo(() => {
    const schoolClass = setup.classes.find((item) => item.id === detail?.lesson.class_id);
    return schoolClass?.name ?? 'Class lesson';
  }, [detail?.lesson.class_id, setup.classes]);

  const subjectName = useMemo(() => {
    const subject = setup.subjects.find((item) => item.id === detail?.lesson.subject_id);
    return subject?.name ?? 'Study';
  }, [detail?.lesson.subject_id, setup.subjects]);

  const personalContent = useMemo(() => readPersonalContent(detail?.personalization ?? null), [detail?.personalization]);
  const originalTranscript = detail?.transcript?.cleaned_text || detail?.transcript?.raw_text || '';
  const transcriptText = personalContent.transcript || originalTranscript;
  const summary = detail?.personalization?.summary || detail?.output?.summary || 'This lesson is still preparing.';
  const keyPoints = personalContent.keyPoints.length ? personalContent.keyPoints : detail?.output?.key_points ?? [];
  const questions = detail?.questions ?? [];
  const flashcards = detail?.flashcards ?? [];
  const latestAttempt = detail?.attempts[0] ?? null;
  const allAnswered = Boolean(questions.length) && questions.every((question) => answers[question.id]);
  const spokenText = buildSpokenLesson(detail, personalContent, transcriptText, summary, keyPoints);
  const isPersonalizing = saving === 'personalize';
  const isSavingQuiz = saving === 'quiz';

  async function createPersonalLesson() {
    if (!detail || !languageValue.trim()) {
      return;
    }

    setSaving('personalize');
    setError(null);
    setMessage(null);

    try {
      await personalizeLesson({
        lessonId: detail.lesson.id,
        studentMembershipId: membership.id,
        language: languageValue.trim(),
        learningMode,
      });
      await loadLesson();
      setActiveTab('listen');
      setMessage('Your personalized lesson is ready.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create your lesson.');
    } finally {
      setSaving(null);
    }
  }

  async function playLesson() {
    if (!spokenText.trim()) {
      setSpeechMessage('Create or open a lesson with text first.');
      return;
    }

    await Speech.stop().catch(() => undefined);
    const speechLimit = typeof (Speech as unknown as { maxSpeechInputLength?: number }).maxSpeechInputLength === 'number'
      ? (Speech as unknown as { maxSpeechInputLength: number }).maxSpeechInputLength
      : 3500;
    const text = spokenText.slice(0, Math.max(1, speechLimit));

    Speech.speak(text, {
      language: speechLocaleForLanguage(detail?.personalization?.language ?? languageValue),
      rate: 0.92,
      pitch: 1,
      onStart: () => {
        setSpeechState('speaking');
        setSpeechMessage(null);
      },
      onDone: () => setSpeechState('idle'),
      onStopped: () => setSpeechState('idle'),
      onError: () => {
        setSpeechState('idle');
        setSpeechMessage('Audio playback is not available here.');
      },
    });
  }

  async function pauseLesson() {
    if (Platform.OS === 'android') {
      await stopLesson();
      return;
    }

    try {
      await Speech.pause();
      setSpeechState('paused');
    } catch {
      await stopLesson();
    }
  }

  async function resumeLesson() {
    try {
      await Speech.resume();
      setSpeechState('speaking');
    } catch {
      await playLesson();
    }
  }

  async function stopLesson() {
    await Speech.stop().catch(() => undefined);
    setSpeechState('idle');
  }

  async function submitQuiz() {
    if (!detail?.quiz || !allAnswered) {
      return;
    }

    setSaving('quiz');
    setError(null);
    setMessage(null);

    try {
      const submitted = await submitQuizAttempt({
        quizId: detail.quiz.id,
        studentMembershipId: membership.id,
        answers: detail.questions.map((question) => ({
          questionId: question.id,
          selectedAnswer: answers[question.id],
        })),
      });

      setResult({
        score: submitted.score,
        correct: submitted.correct,
        total: submitted.total,
      });
      setMessage(`Quiz saved: ${Math.round(submitted.score)}%.`);
      await loadLesson();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save quiz.');
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingPanel}>
        <ActivityIndicator color={colors.tealDark} />
        <Text style={styles.metaStrong}>Opening lesson</Text>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.loadingPanel}>
        <Text style={styles.errorText}>{error ?? 'Lesson not found.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={styles.heroPill}>
            <Sparkles size={15} color={colors.ink} />
            <Text style={styles.heroPillText}>{subjectName}</Text>
          </View>
          <Text style={styles.heroTitle}>{personalContent.title || detail.output?.title || detail.lesson.title}</Text>
          <Text style={styles.heroBody}>
            {className} - {formatDate(detail.lesson.published_at ?? detail.lesson.recorded_at ?? detail.lesson.created_at)}
          </Text>
          <View style={styles.heroActions}>
            {speechState === 'paused' ? (
              <ActionButton label="Resume" icon={<Play size={16} color="#ffffff" />} onPress={resumeLesson} />
            ) : (
              <ActionButton
                label={speechState === 'speaking' ? 'Pause' : 'Listen'}
                icon={speechState === 'speaking' ? <Pause size={16} color="#ffffff" /> : <Volume2 size={16} color="#ffffff" />}
                onPress={speechState === 'speaking' ? pauseLesson : playLesson}
              />
            )}
            <ActionButton label="Stop" variant="soft" icon={<Square size={15} color={colors.tealDark} />} onPress={stopLesson} />
          </View>
          {speechMessage ? <Text style={styles.speechMessage}>{speechMessage}</Text> : null}
        </View>

        <View style={styles.heroStats}>
          <MiniStat icon={<Headphones size={19} color={colors.ink} />} label="Audio" value={speechState === 'speaking' ? 'Playing' : 'Ready'} tone={tones.blue} />
          <MiniStat icon={<Languages size={19} color={colors.ink} />} label="Language" value={detail.personalization?.language ?? detail.lesson.language} tone={tones.green} />
          <MiniStat icon={<Trophy size={19} color={colors.ink} />} label="Score" value={latestAttempt?.score == null ? '--' : `${Math.round(Number(latestAttempt.score))}%`} tone={tones.gold} />
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {message ? <Text style={styles.successText}>{message}</Text> : null}

      <View style={styles.learningPanel}>
        <View style={styles.panelTitleRow}>
          <View style={styles.panelIcon}>
            <Sparkles size={20} color="#ffffff" />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.panelTitle}>Personalize this lesson</Text>
            <Text style={styles.panelMeta}>Choose a language and study style before listening or reading.</Text>
          </View>
        </View>

        <View style={styles.personalizeGrid}>
          <LanguagePicker label="Preferred language" value={languageValue} onChange={setLanguageValue} />
          <Pressable
            disabled={isPersonalizing || !detail.output || !languageValue.trim()}
            onPress={createPersonalLesson}
            style={[styles.personalizeButton, (isPersonalizing || !detail.output || !languageValue.trim()) && styles.disabledButton]}
          >
            {isPersonalizing ? <ActivityIndicator color={colors.ink} /> : <RefreshCw size={17} color={colors.ink} />}
            <Text style={styles.personalizeText}>{detail.personalization ? 'Refresh' : 'Create'}</Text>
          </Pressable>
        </View>

        <View style={styles.modeGrid}>
          {learningModeOptions.map((mode) => (
            <Pressable
              key={mode.id}
              onPress={() => setLearningMode(mode.id)}
              style={[styles.modeCard, learningMode === mode.id && styles.modeCardActive]}
            >
              <Text style={[styles.modeTitle, learningMode === mode.id && styles.modeTitleActive]}>{mode.label}</Text>
              <Text style={[styles.modeBody, learningMode === mode.id && styles.modeBodyActive]}>{mode.body}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ProgressStrip detail={detail} latestScore={result?.score ?? (latestAttempt?.score == null ? null : Number(latestAttempt.score))} />

      <View style={styles.tabRow}>
        <ReaderTabButton active={activeTab === 'listen'} label="Listen" icon={<Headphones size={16} color={activeTab === 'listen' ? '#ffffff' : colors.tealDark} />} onPress={() => setActiveTab('listen')} />
        <ReaderTabButton active={activeTab === 'read'} label="Transcript" icon={<FileText size={16} color={activeTab === 'read' ? '#ffffff' : colors.tealDark} />} onPress={() => setActiveTab('read')} />
        <ReaderTabButton active={activeTab === 'quiz'} label="Quiz" icon={<Brain size={16} color={activeTab === 'quiz' ? '#ffffff' : colors.tealDark} />} onPress={() => setActiveTab('quiz')} />
        <ReaderTabButton active={activeTab === 'cards'} label="Cards" icon={<Layers size={16} color={activeTab === 'cards' ? '#ffffff' : colors.tealDark} />} onPress={() => setActiveTab('cards')} />
      </View>

      {activeTab === 'listen' ? (
        <ListenPane
          summary={summary}
          keyPoints={keyPoints}
          content={personalContent}
          hasPersonalLesson={Boolean(detail.personalization)}
          onOpenFull={setFullPanel}
        />
      ) : activeTab === 'read' ? (
        <TranscriptPane
          transcript={transcriptText}
          originalLanguage={detail.lesson.language}
          personalLanguage={detail.personalization?.language ?? null}
          onOpenFull={() => setFullPanel('transcript')}
        />
      ) : activeTab === 'quiz' ? (
        <QuizPane
          questions={questions}
          answers={answers}
          result={result}
          latestScore={latestAttempt?.score == null ? null : Number(latestAttempt.score)}
          saving={isSavingQuiz}
          allAnswered={allAnswered}
          onAnswer={(questionId, answer) => setAnswers((current) => ({ ...current, [questionId]: answer }))}
          onSubmit={submitQuiz}
        />
      ) : (
        <CardsPane cards={flashcards} flippedCardId={flippedCardId} onFlip={setFlippedCardId} />
      )}

      <FullLessonPanel
        panel={fullPanel}
        onClose={() => setFullPanel(null)}
        summary={summary}
        keyPoints={keyPoints}
        content={personalContent}
        transcript={transcriptText}
        originalLanguage={detail.lesson.language}
        personalLanguage={detail.personalization?.language ?? null}
      />
    </View>
  );
}

function ListenPane({
  summary,
  keyPoints,
  content,
  hasPersonalLesson,
  onOpenFull,
}: {
  summary: string;
  keyPoints: string[];
  content: PersonalContent;
  hasPersonalLesson: boolean;
  onOpenFull: (panel: Exclude<FullPanel, null>) => void;
}) {
  return (
    <View style={styles.contentGrid}>
      <View style={[styles.panel, styles.panelWide]}>
        <View style={styles.panelTitleRow}>
          <BookOpen size={21} color={colors.blue} />
          <View style={styles.flexText}>
            <Text style={styles.panelTitle}>Lesson guide</Text>
            <Text style={styles.panelMeta}>{hasPersonalLesson ? 'Personalized for this student' : 'Master lesson version'}</Text>
          </View>
          <ViewFullButton onPress={() => onOpenFull('guide')} />
        </View>
        <RichText text={summary} style={styles.summaryText} />
        {keyPoints.length ? (
          <View style={styles.pointGrid}>
            {keyPoints.map((point, index) => (
              <View key={`${point}-${index}`} style={styles.pointCard}>
                <Text style={styles.pointIndex}>{index + 1}</Text>
                <RichText text={point} style={styles.pointText} />
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelTitleRow}>
          <Sparkles size={21} color={colors.gold} />
          <Text style={styles.panelTitle}>Study path</Text>
          <ViewFullButton onPress={() => onOpenFull('path')} />
        </View>
        {content.studySteps.length ? (
          <View style={styles.studyStepList}>
            {content.studySteps.map((step, index) => (
              <View key={`${step}-${index}`} style={styles.studyStep}>
                <Text style={styles.studyStepNumber}>{index + 1}</Text>
                <RichText text={step} style={styles.studyStepText} />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>Create a personalized lesson to get a study path.</Text>
        )}
        {content.encouragement ? <Text style={styles.encouragement}>{content.encouragement}</Text> : null}
      </View>

      {content.vocabulary.length ? (
        <View style={styles.panel}>
          <View style={styles.panelTitleRow}>
          <Languages size={21} color={colors.tealDark} />
          <Text style={styles.panelTitle}>Vocabulary</Text>
          <ViewFullButton onPress={() => onOpenFull('vocabulary')} />
        </View>
        <View style={styles.vocabGrid}>
          {content.vocabulary.map((item) => (
            <View key={`${item.term}-${item.meaning}`} style={styles.vocabCard}>
                <RichText text={item.term} style={styles.vocabTerm} />
                <RichText text={item.meaning} style={styles.vocabMeaning} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function TranscriptPane({
  transcript,
  originalLanguage,
  personalLanguage,
  onOpenFull,
}: {
  transcript: string;
  originalLanguage: string;
  personalLanguage: string | null;
  onOpenFull: () => void;
}) {
  const paragraphs = transcript
    .split(/\n{2,}|(?<=\.)\s+(?=[A-Z0-9])/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <View style={styles.panel}>
      <View style={styles.panelTitleRow}>
        <FileText size={21} color={colors.tealDark} />
        <View style={styles.flexText}>
          <Text style={styles.panelTitle}>Transcript</Text>
          <Text style={styles.panelMeta}>{personalLanguage ? `${personalLanguage} version` : `${originalLanguage} original`}</Text>
        </View>
        <ViewFullButton onPress={onOpenFull} />
      </View>
      {paragraphs.length ? (
        <View style={styles.transcriptStack}>
          {paragraphs.map((paragraph, index) => (
            <View key={`${paragraph}-${index}`} style={styles.transcriptBlock}>
              <Text style={styles.transcriptNumber}>{String(index + 1).padStart(2, '0')}</Text>
              <RichText text={paragraph} style={styles.transcriptText} />
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.meta}>The transcript will appear after the lesson audio or text has been processed.</Text>
      )}
    </View>
  );
}

function QuizPane({
  questions,
  answers,
  result,
  latestScore,
  saving,
  allAnswered,
  onAnswer,
  onSubmit,
}: {
  questions: QuizQuestionRow[];
  answers: Record<string, string>;
  result: { score: number; correct: number; total: number } | null;
  latestScore: number | null;
  saving: boolean;
  allAnswered: boolean;
  onAnswer: (questionId: string, answer: string) => void;
  onSubmit: () => void;
}) {
  if (!questions.length) {
    return (
      <View style={styles.panel}>
        <Text style={styles.emptyTitle}>Quiz is preparing</Text>
        <Text style={styles.meta}>Questions will appear after Chivo AI builds the study pack.</Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelTitleRow}>
        <Brain size={21} color={colors.gold} />
        <View style={styles.flexText}>
          <Text style={styles.panelTitle}>Quiz quest</Text>
          <Text style={styles.panelMeta}>Answer every question to update your progress.</Text>
        </View>
      </View>

      {result || latestScore !== null ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultValue}>{Math.round(result?.score ?? latestScore ?? 0)}%</Text>
          <Text style={styles.resultMeta}>{result ? `${result.correct} of ${result.total} correct` : 'Latest saved score'}</Text>
        </View>
      ) : null}

      <View style={styles.quizStack}>
        {questions.map((question, index) => (
          <QuizCard
            key={question.id}
            question={question}
            index={index}
            selectedAnswer={answers[question.id]}
            locked={Boolean(result)}
            onAnswer={(answer) => onAnswer(question.id, answer)}
          />
        ))}
      </View>

      <Pressable disabled={!allAnswered || saving || Boolean(result)} onPress={onSubmit} style={[styles.submitButton, (!allAnswered || saving || Boolean(result)) && styles.disabledButton]}>
        {saving ? <ActivityIndicator color="#ffffff" /> : <CheckCircle2 size={17} color="#ffffff" />}
        <Text style={styles.submitText}>{result ? 'Quiz submitted' : 'Submit quiz'}</Text>
      </Pressable>
    </View>
  );
}

function QuizCard({
  question,
  index,
  selectedAnswer,
  locked,
  onAnswer,
}: {
  question: QuizQuestionRow;
  index: number;
  selectedAnswer?: string;
  locked: boolean;
  onAnswer: (answer: string) => void;
}) {
  return (
    <View style={styles.quizCard}>
      <Text style={styles.quizPrompt}>{index + 1}. {question.prompt}</Text>
      <View style={styles.optionGrid}>
        {question.options.map((option) => {
          const selected = selectedAnswer === option;
          const correct = locked && question.answer === option;
          const wrong = locked && selected && question.answer !== option;
          return (
            <Pressable
              key={option}
              disabled={locked}
              onPress={() => onAnswer(option)}
              style={[
                styles.optionButton,
                selected && styles.optionSelected,
                correct && styles.optionCorrect,
                wrong && styles.optionWrong,
              ]}
            >
              <Text style={[styles.optionText, (selected || correct || wrong) && styles.optionTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {locked && question.explanation ? <Text style={styles.explanationText}>{question.explanation}</Text> : null}
    </View>
  );
}

function CardsPane({
  cards,
  flippedCardId,
  onFlip,
}: {
  cards: LessonDetail['flashcards'];
  flippedCardId: string | null;
  onFlip: (id: string | null) => void;
}) {
  if (!cards.length) {
    return (
      <View style={styles.panel}>
        <Text style={styles.emptyTitle}>Cards are preparing</Text>
        <Text style={styles.meta}>Flashcards will appear after Chivo AI builds the study pack.</Text>
      </View>
    );
  }

  return (
    <View style={styles.cardGrid}>
      {cards.map((card, index) => {
        const flipped = flippedCardId === card.id;
        const tone = [tones.gold, tones.blue, tones.purple, tones.green, tones.coral][index % 5];
        return (
          <Pressable
            key={card.id}
            onPress={() => onFlip(flipped ? null : card.id)}
            style={[styles.flashcard, { backgroundColor: tone.background, borderColor: tone.accent }]}
          >
            <Text style={styles.flashCounter}>Card {index + 1}</Text>
            <Text style={styles.flashFront}>{flipped ? card.back : card.front}</Text>
            <Text style={styles.flashBack}>{flipped ? 'Tap to see the question' : 'Tap to reveal the answer'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FullLessonPanel({
  panel,
  onClose,
  summary,
  keyPoints,
  content,
  transcript,
  originalLanguage,
  personalLanguage,
}: {
  panel: FullPanel;
  onClose: () => void;
  summary: string;
  keyPoints: string[];
  content: PersonalContent;
  transcript: string;
  originalLanguage: string;
  personalLanguage: string | null;
}) {
  const title =
    panel === 'guide'
      ? 'Lesson guide'
      : panel === 'path'
        ? 'Study path'
        : panel === 'vocabulary'
          ? 'Vocabulary'
          : 'Transcript';

  return (
    <Modal visible={Boolean(panel)} animationType="slide" onRequestClose={onClose}>
      <View style={styles.fullScreen}>
        <View style={styles.fullHeader}>
          <View style={styles.flexText}>
            <Text style={styles.fullTitle}>{title}</Text>
            <Text style={styles.fullMeta}>
              {panel === 'transcript' ? (personalLanguage ? `${personalLanguage} version` : `${originalLanguage} original`) : 'Full view'}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.fullClose}>
            <X size={20} color={colors.tealDark} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.fullBody}>
          {panel === 'guide' ? (
            <>
              <RichText text={summary} style={styles.fullText} />
              {keyPoints.map((point, index) => (
                <View key={`${point}-${index}`} style={styles.fullPoint}>
                  <Text style={styles.pointIndex}>{index + 1}</Text>
                  <RichText text={point} style={styles.pointText} />
                </View>
              ))}
            </>
          ) : null}

          {panel === 'path' ? (
            content.studySteps.length ? (
              content.studySteps.map((step, index) => (
                <View key={`${step}-${index}`} style={styles.fullPoint}>
                  <Text style={styles.pointIndex}>{index + 1}</Text>
                  <RichText text={step} style={styles.pointText} />
                </View>
              ))
            ) : (
              <Text style={styles.meta}>Create a personalized lesson to get a study path.</Text>
            )
          ) : null}

          {panel === 'vocabulary' ? (
            content.vocabulary.length ? (
              content.vocabulary.map((item) => (
                <View key={`${item.term}-${item.meaning}`} style={styles.fullVocab}>
                  <RichText text={item.term} style={styles.vocabTerm} />
                  <RichText text={item.meaning} style={styles.vocabMeaning} />
                </View>
              ))
            ) : (
              <Text style={styles.meta}>Vocabulary will appear after personalization.</Text>
            )
          ) : null}

          {panel === 'transcript' ? (
            transcript ? (
              transcript
                .split(/\n{2,}|(?<=\.)\s+(?=[A-Z0-9])/)
                .map((item) => item.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <View key={`${paragraph}-${index}`} style={styles.transcriptBlock}>
                    <Text style={styles.transcriptNumber}>{String(index + 1).padStart(2, '0')}</Text>
                    <RichText text={paragraph} style={styles.transcriptText} />
                  </View>
                ))
            ) : (
              <Text style={styles.meta}>The transcript will appear after processing.</Text>
            )
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ProgressStrip({ detail, latestScore }: { detail: LessonDetail; latestScore: number | null }) {
  const weakAreas = detail.weakAreas.filter((item) => item.status !== 'resolved');
  const averageMastery = detail.progress.length
    ? detail.progress.reduce((total, item) => total + Number(item.mastery_score ?? 0), 0) / detail.progress.length
    : null;

  return (
    <View style={styles.progressGrid}>
      <ProgressTile label="Personal lesson" value={detail.personalization ? 'Ready' : 'Needed'} tone={detail.personalization ? tones.green : tones.gold} />
      <ProgressTile label="Quiz score" value={latestScore === null ? '--' : `${Math.round(latestScore)}%`} tone={tones.purple} />
      <ProgressTile label="Mastery" value={averageMastery === null ? '--' : `${Math.round(averageMastery)}%`} tone={tones.blue} />
      <ProgressTile label="Focus areas" value={weakAreas.length} tone={weakAreas.length ? tones.coral : tones.green} />
    </View>
  );
}

function ReaderTabButton({ active, label, icon, onPress }: { active: boolean; label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      {icon}
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ViewFullButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.viewFullButton}>
      <Text style={styles.viewFullText}>View full</Text>
    </Pressable>
  );
}

function RichText({ text, style }: { text: string; style: object }) {
  const cleanText = text.replace(/^[-*]\s+/gm, '').trim();
  const parts = cleanText.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        const bold = part.startsWith('**') && part.endsWith('**');
        const value = bold ? part.slice(2, -2).trim() : part;
        return (
          <Text key={`${value}-${index}`} style={bold ? styles.richBold : undefined}>
            {value}
          </Text>
        );
      })}
    </Text>
  );
}

function ActionButton({
  label,
  icon,
  variant = 'strong',
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  variant?: 'strong' | 'soft';
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, variant === 'soft' && styles.actionButtonSoft]}>
      {icon}
      <Text style={[styles.actionButtonText, variant === 'soft' && styles.actionButtonTextSoft]}>{label}</Text>
    </Pressable>
  );
}

function MiniStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: { background: string; accent: string } }) {
  return (
    <View style={[styles.miniStat, { backgroundColor: tone.background }]}>
      <View style={[styles.miniStatIcon, { backgroundColor: tone.accent }]}>{icon}</View>
      <Text style={styles.miniValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function ProgressTile({ label, value, tone }: { label: string; value: string | number; tone: { background: string; accent: string } }) {
  return (
    <View style={[styles.progressTile, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <Text style={styles.progressValue}>{value}</Text>
      <Text style={styles.progressLabel}>{label}</Text>
    </View>
  );
}

function readPersonalContent(personalization: LessonDetail['personalization']): PersonalContent {
  const content = personalization?.content ?? {};
  const record = content as Record<string, unknown>;

  return {
    title: stringValue(record.title),
    transcript: stringValue(record.transcript),
    keyPoints: stringArray(record.key_points),
    studySteps: stringArray(record.study_steps),
    vocabulary: objectArray(record.vocabulary).map((item) => ({
      term: stringValue(item.term),
      meaning: stringValue(item.meaning),
    })).filter((item) => item.term || item.meaning),
    quickCheck: objectArray(record.quick_check).map((item) => ({
      prompt: stringValue(item.prompt),
      answer: stringValue(item.answer),
    })).filter((item) => item.prompt || item.answer),
    encouragement: stringValue(record.encouragement),
  };
}

function buildSpokenLesson(
  detail: LessonDetail | null,
  content: PersonalContent,
  transcript: string,
  summary: string,
  keyPoints: string[]
) {
  if (!detail) {
    return '';
  }

  return [
    content.title || detail.lesson.title,
    'Summary.',
    summary,
    keyPoints.length ? 'Key points.' : '',
    ...keyPoints,
    content.studySteps.length ? 'Study steps.' : '',
    ...content.studySteps,
    transcript ? 'Transcript.' : '',
    transcript,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
}

function objectArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  hero: {
    minHeight: 236,
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
    gap: 10,
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
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  heroBody: {
    color: '#dce7e1',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '800',
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroStats: {
    flex: 1,
    minWidth: 250,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    minHeight: 42,
    borderRadius: 15,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.tealDark,
  },
  actionButtonSoft: {
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  actionButtonTextSoft: {
    color: colors.tealDark,
  },
  miniStat: {
    minWidth: 106,
    flex: 1,
    borderRadius: 22,
    padding: 13,
    gap: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  miniStatIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniValue: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  miniLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  learningPanel: {
    borderRadius: 26,
    padding: 16,
    gap: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#16251f',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  panelTitleRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panelIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  panelMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  viewFullButton: {
    minHeight: 34,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  viewFullText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  personalizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 10,
  },
  field: {
    flex: 1,
    minWidth: 220,
    gap: 7,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderRadius: 15,
    paddingHorizontal: 13,
    color: colors.ink,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e1e9e3',
    fontSize: 14,
    fontWeight: '800',
  },
  personalizeButton: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
  },
  personalizeText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeCard: {
    minWidth: 128,
    flex: 1,
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 3,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  modeCardActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  modeTitle: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  modeTitleActive: {
    color: '#ffffff',
  },
  modeBody: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  modeBodyActive: {
    color: '#dce7e1',
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  progressTile: {
    minWidth: 132,
    flex: 1,
    borderRadius: 20,
    padding: 14,
    gap: 4,
    borderWidth: 2,
  },
  progressValue: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  progressLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    padding: 6,
    borderRadius: 22,
    backgroundColor: '#eef2ee',
  },
  tabButton: {
    minHeight: 42,
    flex: 1,
    minWidth: 108,
    borderRadius: 16,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  tabButtonActive: {
    backgroundColor: colors.tealDark,
  },
  tabText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  contentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  panel: {
    minWidth: 280,
    flex: 1,
    borderRadius: 24,
    padding: 16,
    gap: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  panelWide: {
    flex: 1.5,
    minWidth: 320,
  },
  summaryText: {
    color: '#33413b',
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '700',
  },
  pointGrid: {
    gap: 10,
  },
  pointCard: {
    minHeight: 58,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.softTeal,
  },
  pointIndex: {
    width: 34,
    height: 34,
    borderRadius: 13,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#ffffff',
    backgroundColor: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  pointText: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
  },
  studyStepList: {
    gap: 8,
  },
  studyStep: {
    minHeight: 42,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.softTeal,
  },
  studyStepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#ffffff',
    backgroundColor: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  studyStepText: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  vocabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vocabCard: {
    minWidth: 140,
    flex: 1,
    borderRadius: 15,
    padding: 12,
    gap: 4,
    backgroundColor: colors.softGold,
  },
  vocabTerm: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  vocabMeaning: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  transcriptStack: {
    gap: 10,
  },
  transcriptBlock: {
    borderRadius: 18,
    padding: 13,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e1e9e3',
  },
  transcriptNumber: {
    width: 34,
    color: colors.tealDark,
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '900',
  },
  transcriptText: {
    flex: 1,
    color: '#33413b',
    fontSize: 14,
    lineHeight: 23,
    fontWeight: '700',
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  fullHeader: {
    minHeight: 76,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  fullTitle: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  fullMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  fullClose: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  fullBody: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    padding: 18,
    gap: 12,
  },
  fullText: {
    color: '#33413b',
    fontSize: 17,
    lineHeight: 27,
    fontWeight: '700',
  },
  fullPoint: {
    minHeight: 58,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  fullVocab: {
    borderRadius: 18,
    padding: 14,
    gap: 5,
    backgroundColor: colors.softGold,
    borderWidth: 1,
    borderColor: '#efd27f',
  },
  resultCard: {
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.softGold,
    borderWidth: 1,
    borderColor: '#efd27f',
  },
  resultValue: {
    color: colors.ink,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '900',
  },
  resultMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  quizStack: {
    gap: 12,
  },
  quizCard: {
    borderRadius: 22,
    padding: 14,
    gap: 10,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e1e9e3',
  },
  quizPrompt: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '900',
  },
  optionGrid: {
    gap: 8,
  },
  optionButton: {
    minHeight: 42,
    borderRadius: 15,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  optionSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  optionCorrect: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  optionWrong: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
  optionText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '900',
  },
  optionTextActive: {
    color: '#ffffff',
  },
  explanationText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  submitButton: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.tealDark,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  flashcard: {
    minWidth: 250,
    flex: 1,
    minHeight: 178,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    borderWidth: 2,
  },
  flashCounter: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  flashFront: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '900',
  },
  flashBack: {
    color: '#33413b',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  loadingPanel: {
    minHeight: 160,
    borderRadius: 24,
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
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  metaStrong: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '900',
  },
  encouragement: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '900',
  },
  speechMessage: {
    color: colors.gold,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
  },
  successText: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '900',
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.55,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  richBold: {
    color: colors.tealDark,
    fontWeight: '900',
  },
});
