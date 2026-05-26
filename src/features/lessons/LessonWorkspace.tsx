import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
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
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { ArrowLeft, BookOpen, Brain, CalendarDays, CheckCircle2, ClipboardList, Clock3, DoorOpen, Layers, Mic, MicOff, Pause, Play, Sparkles, Square, UserCheck, Volume2 } from 'lucide-react-native';

import { LanguagePicker, speechLocaleForLanguage } from '../../components/LanguagePicker';
import {
  LearningMode,
  LessonDetail,
  LessonPersonalizationRow,
  LessonRow,
  LessonRecordingUpload,
  QuizAttemptAnswer,
  QuizAttemptRow,
  TeacherLessonInsight,
  addLessonTranscript,
  createLesson,
  endLessonSession,
  fetchLessonDetail,
  fetchLessons,
  fetchQuizAttempts,
  fetchTeacherLessonInsights,
  personalizeLesson,
  processLesson,
  publishLesson,
  startLessonSession,
  submitQuizAttempt,
} from '../../services/lessons';
import { ClassRow, ClassSubjectRow, SchoolSetupState, SubjectRow } from '../../services/school';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership } from '../../types';

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

type LessonWorkspaceProps = {
  membership: ActiveSchoolMembership;
  setup: SchoolSetupState;
  onLessonsChanged?: () => void;
  mode?: 'learn' | 'teach';
  initialClassId?: string | null;
  initialLessonId?: string | null;
  classPanel?: 'all' | 'studio' | 'library';
};

type LessonRoomSection = 'live' | 'review' | 'published' | 'quiz' | 'cards' | 'insight';
type StudySection = 'summary' | 'quiz' | 'cards';
type LessonDateFilter = 'all' | 'today' | 'week' | 'month' | 'year';
type LessonTimeFilter = 'all' | 'morning' | 'afternoon' | 'evening';
type LessonSort = 'newest' | 'oldest';

export function LessonWorkspace({
  membership,
  setup,
  onLessonsChanged,
  mode,
  initialClassId,
  initialLessonId,
  classPanel = 'all',
}: LessonWorkspaceProps) {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [detail, setDetail] = useState<LessonDetail | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [roomSection, setRoomSection] = useState<LessonRoomSection>('published');
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptRow[]>([]);
  const [teacherInsights, setTeacherInsights] = useState<TeacherLessonInsight[]>([]);
  const [lessonDateFilter, setLessonDateFilter] = useState<LessonDateFilter>('all');
  const [lessonTimeFilter, setLessonTimeFilter] = useState<LessonTimeFilter>('all');
  const [lessonSort, setLessonSort] = useState<LessonSort>('newest');
  const [lessonYear, setLessonYear] = useState<string>('all');

  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('English');
  const [activeClassId, setActiveClassId] = useState<string | null>(initialClassId ?? null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [liveWords, setLiveWords] = useState('');
  const [listening, setListening] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<'speech' | 'audio' | null>(null);
  const [capturedAudio, setCapturedAudio] = useState<LessonRecordingUpload | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const transcriptRef = useRef('');
  const liveWordsRef = useRef('');
  const speechBaseTranscriptRef = useRef('');
  const initialLessonOpenedRef = useRef<string | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioState = useAudioRecorderState(audioRecorder);

  const canTeach = ['owner', 'admin', 'teacher'].includes(membership.role);
  const activeMode = mode ?? (canTeach ? 'teach' : 'learn');
  const isTeacher = canTeach && activeMode === 'teach';
  const canPersonalize = !canTeach && activeMode === 'learn';
  const classRouteFocus = Boolean(initialClassId);
  const studioPanel = classPanel === 'studio';
  const libraryPanel = classPanel === 'library';
  const teacherMembershipId = setup.members.find((member) => member.id === membership.id)?.id ?? membership.id;

  const visibleClasses = useMemo(() => {
    if (canTeach) {
      return setup.classes;
    }

    const classIds = setup.classMemberships
      .filter((item) => item.school_membership_id === membership.id && item.status === 'active')
      .map((item) => item.class_id);

    return setup.classes.filter((schoolClass) => classIds.includes(schoolClass.id));
  }, [canTeach, membership.id, setup.classMemberships, setup.classes]);

  const activeClass = visibleClasses.find((schoolClass) => schoolClass.id === activeClassId) ?? null;
  const activeClassSubjects = useMemo(
    () => subjectsForClass(setup.classSubjects, setup.subjects, activeClassId),
    [activeClassId, setup.classSubjects, setup.subjects]
  );
  const effectiveSubjectId = selectedSubjectId ?? activeClassSubjects[0]?.id ?? null;
  const baseFilteredLessons = lessons.filter((lesson) => {
    const inClass = activeClassId ? lesson.class_id === activeClassId : true;
    const inSubject = selectedSubjectId ? lesson.subject_id === selectedSubjectId : true;
    return inClass && inSubject;
  });
  const studioLessonIds = baseFilteredLessons.map((lesson) => lesson.id).join('|');
  const availableLessonYears = lessonYears(baseFilteredLessons);
  const filteredLessons = filterLessonsByTime(baseFilteredLessons, {
    dateFilter: lessonDateFilter,
    timeFilter: lessonTimeFilter,
    sort: lessonSort,
    year: lessonYear,
  });
  const openLiveLesson = lessons.find(
    (lesson) =>
      lesson.status === 'recording' &&
      lesson.class_id === activeClassId &&
      lesson.subject_id === effectiveSubjectId
  );
  const speechCaptureAvailable =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const isAudioCapture = captureMode === 'audio';
  const captureActionLabel = Platform.OS === 'web' ? 'Listen' : 'Record';
  const liveStatusTitle = listening ? (isAudioCapture ? 'Recording' : 'Listening') : 'Start lesson';
  const audioDurationLabel = formatDuration(audioState.durationMillis);
  const roomLessons = lessonsForRoomSection(filteredLessons, isTeacher, roomSection);
  const roomLessonIds = roomLessons.map((lesson) => lesson.id).join('|');
  const insightLessons = filteredLessons.filter((lesson) => lesson.status === 'published');
  const insightLessonIds = insightLessons.map((lesson) => lesson.id).join('|');
  const detailStudySection = roomSection === 'quiz' ? 'quiz' : roomSection === 'cards' ? 'cards' : 'summary';

  useEffect(() => {
    loadLessons();
  }, [membership.schoolId, activeMode]);

  useEffect(() => {
    setRoomSection(libraryPanel ? 'published' : isTeacher ? 'live' : 'published');
  }, [isTeacher, libraryPanel]);

  useEffect(() => {
    if (activeClassId && !visibleClasses.some((schoolClass) => schoolClass.id === activeClassId)) {
      leaveClass();
    }
  }, [activeClassId, visibleClasses]);

  useEffect(() => {
    if (!initialClassId || activeClassId === initialClassId) {
      return;
    }

    if (!visibleClasses.some((schoolClass) => schoolClass.id === initialClassId)) {
      return;
    }

    const subjects = subjectsForClass(setup.classSubjects, setup.subjects, initialClassId);
    setActiveClassId(initialClassId);
    setSelectedSubjectId(subjects[0]?.id ?? null);
    setSelectedLessonId(null);
    setDetail(null);
  }, [activeClassId, initialClassId, setup.classSubjects, setup.subjects, visibleClasses]);

  useEffect(() => {
    initialLessonOpenedRef.current = null;
  }, [initialLessonId]);

  useEffect(() => {
    if (!initialLessonId || loading || initialLessonOpenedRef.current === initialLessonId) {
      return;
    }

    const lesson = lessons.find((item) => item.id === initialLessonId);
    if (!lesson) {
      return;
    }

    initialLessonOpenedRef.current = initialLessonId;
    setActiveClassId(lesson.class_id);
    setSelectedSubjectId(lesson.subject_id);
    void loadLessonDetail(initialLessonId);
  }, [initialLessonId, lessons, loading]);

  useEffect(() => {
    if (activeClassId && !selectedSubjectId && activeClassSubjects[0]) {
      setSelectedSubjectId(activeClassSubjects[0].id);
    }
  }, [activeClassId, activeClassSubjects, selectedSubjectId]);

  useEffect(() => {
    if (!activeClassId) {
      return;
    }

    const selectedLessonStillInScope = studioPanel
      ? baseFilteredLessons.some((lesson) => lesson.id === selectedLessonId)
      : roomLessons.some((lesson) => lesson.id === selectedLessonId);

    if (!selectedLessonId || selectedLessonStillInScope) {
      return;
    }

    setSelectedLessonId(null);
    setDetail(null);
  }, [activeClassId, roomLessonIds, selectedLessonId, studioLessonIds, studioPanel]);

  useEffect(() => {
    if (!isTeacher || !activeClassId) {
      setTeacherInsights([]);
      return;
    }

    const lessonIds = insightLessonIds ? insightLessonIds.split('|') : [];
    if (!lessonIds.length) {
      setTeacherInsights([]);
      return;
    }

    let active = true;
    fetchTeacherLessonInsights(lessonIds)
      .then((rows) => {
        if (active) {
          setTeacherInsights(rows);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Could not load class insight.');
        }
      });

    return () => {
      active = false;
    };
  }, [activeClassId, insightLessonIds, isTeacher]);

  useEffect(
    () => () => {
      stopSpeechCapture();
      if (audioRecorder.isRecording) {
        void audioRecorder.stop().catch(() => undefined);
      }
    },
    [audioRecorder]
  );

  function cleanTranscriptText(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  function mergeTranscriptParts(...parts: string[]) {
    return parts.map(cleanTranscriptText).filter(Boolean).join(' ');
  }

  function setTranscriptText(value: string) {
    transcriptRef.current = value;
    setTranscript(value);
  }

  function setLiveWordsText(value: string) {
    const clean = cleanTranscriptText(value);
    liveWordsRef.current = clean;
    setLiveWords(clean);
  }

  function clearTranscriptDraft() {
    setTranscriptText('');
    setLiveWordsText('');
    speechBaseTranscriptRef.current = '';
  }

  function flushSpeechWords() {
    const merged = mergeTranscriptParts(transcriptRef.current, liveWordsRef.current);
    setTranscriptText(merged);
    setLiveWordsText('');
    speechBaseTranscriptRef.current = merged;
    return merged;
  }

  function syncSpeechTranscript(finalText: string, interimText: string) {
    const merged = mergeTranscriptParts(speechBaseTranscriptRef.current, finalText);
    setTranscriptText(merged);
    setLiveWordsText(interimText);
  }

  function startSpeechCapture() {
    if (!speechCaptureAvailable) {
      setSpeechNotice('Live listening is not available here. You can paste the transcript instead.');
      return false;
    }

    stopSpeechCapture();
    speechBaseTranscriptRef.current = transcriptRef.current;
    setLiveWordsText('');

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechNotice('Live listening is not available here. You can paste the transcript instead.');
      return false;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLocaleForLanguage(language);

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

      syncSpeechTranscript(finalText, interimText);
    };

    recognition.onerror = (event) => {
      setSpeechNotice(event.error === 'not-allowed'
        ? 'Microphone access is blocked. Allow microphone access, then start again.'
        : 'Live listening paused. You can continue with the transcript box.'
      );
      setListening(false);
      listeningRef.current = false;
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition && listeningRef.current) {
        try {
          speechBaseTranscriptRef.current = flushSpeechWords();
          recognition.start();
          setListening(true);
          return;
        } catch {
          // The browser may already have stopped listening.
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
      setCaptureMode('speech');
      setSpeechNotice('Listening. Chivo is writing the lesson transcript.');
      return true;
    } catch {
      setSpeechNotice('Live listening could not start. You can paste the transcript instead.');
      return false;
    }
  }

  function stopSpeechCapture() {
    const recognition = recognitionRef.current;
    const flushedTranscript = flushSpeechWords();
    recognitionRef.current = null;
    listeningRef.current = false;
    setListening(false);
    setCaptureMode(null);

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

    return flushedTranscript;
  }

  async function startAudioCapture() {
    try {
      if (captureMode === 'audio' && audioState.canRecord) {
        audioRecorder.record();
        setListening(true);
        setSpeechNotice('Recording lesson audio. Chivo will prepare it when class ends.');
        return true;
      }

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setSpeechNotice('Microphone access is needed to record the lesson.');
        return false;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setCapturedAudio(null);
      setCaptureMode('audio');
      setListening(true);
      setSpeechNotice('Recording lesson audio. Chivo will prepare it when class ends.');
      return true;
    } catch {
      setListening(false);
      setSpeechNotice('Audio recording could not start. You can add the transcript instead.');
      return false;
    }
  }

  function pauseLiveCapture() {
    if (captureMode === 'audio') {
      if (audioRecorder.isRecording || audioState.isRecording) {
        audioRecorder.pause();
      }
      setListening(false);
      setSpeechNotice('Recording paused. Tap Record to continue.');
      return;
    }

    stopSpeechCapture();
  }

  async function startLiveCapture() {
    if (Platform.OS === 'web') {
      const started = startSpeechCapture();
      if (started) {
        return true;
      }

      setSpeechNotice('Live listening is not available in this browser. Add the transcript to continue.');
      return false;
    }

    return startAudioCapture();
  }

  async function stopLiveCapture() {
    if (captureMode === 'speech') {
      stopSpeechCapture();
      return capturedAudio;
    }

    if (captureMode === 'audio' || audioRecorder.isRecording || audioState.isRecording || audioState.canRecord) {
      return stopAudioCapture();
    }

    return capturedAudio;
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
      setCaptureMode(null);

      if (!uri) {
        setSpeechNotice('Recording stopped, but no audio file was saved.');
        return capturedAudio;
      }

      const recording = {
        uri,
        mimeType: 'audio/aac',
        durationSeconds,
      };

      setCapturedAudio(recording);
      setSpeechNotice('Audio saved. Chivo can prepare the lesson now.');
      return recording;
    } catch {
      setListening(false);
      setCaptureMode(null);
      setSpeechNotice('Audio recording could not be saved. Add the transcript to continue.');
      return capturedAudio;
    }
  }

  function enterClass(classId: string) {
    const subjects = subjectsForClass(setup.classSubjects, setup.subjects, classId);
    const firstSubjectId = subjects[0]?.id ?? null;

    setActiveClassId(classId);
    setSelectedSubjectId(firstSubjectId);
    setSelectedLessonId(null);
    setDetail(null);
  }

  function leaveClass() {
    void stopLiveCapture();
    setActiveClassId(null);
    setSelectedSubjectId(null);
    setSelectedLessonId(null);
    setDetail(null);
    clearTranscriptDraft();
    setTitle('');
    setCapturedAudio(null);
  }

  async function loadLessons() {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchLessons(membership.schoolId, isTeacher);
      setLessons(rows);
      if (selectedLessonId && !rows.some((lesson) => lesson.id === selectedLessonId)) {
        setSelectedLessonId(null);
        setDetail(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load lessons.');
    } finally {
      setLoading(false);
    }
  }

  async function loadLessonDetail(lessonId: string) {
    setLoadingDetail(true);
    setError(null);
    try {
      setSelectedLessonId(lessonId);
      const nextDetail = await fetchLessonDetail(lessonId, canPersonalize ? membership.id : null);
      setDetail(nextDetail);
      if (isTeacher && nextDetail.quiz) {
        setQuizAttempts(await fetchQuizAttempts(nextDetail.quiz.id));
      } else {
        setQuizAttempts([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load lesson.');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleCreateLesson() {
    setSaving('create');
    setError(null);
    setMessage(null);
    try {
      if (recognitionRef.current) {
        stopSpeechCapture();
      }

      const transcriptText = transcriptRef.current.trim();
      const lessonId = await createLesson({
        schoolId: membership.schoolId,
        classId: activeClassId ?? '',
        subjectId: effectiveSubjectId,
        teacherMembershipId,
        title,
        language,
        transcript: transcriptText,
      });
      setTitle('');
      clearTranscriptDraft();
      setMessage('Lesson saved. Create study materials when ready.');
      setSelectedLessonId(lessonId);
      await loadLessons();
      await loadLessonDetail(lessonId);
      onLessonsChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create lesson.');
    } finally {
      setSaving(null);
    }
  }

  async function handleStartLesson() {
    setSaving('start');
    setError(null);
    setMessage(null);
    try {
      if (openLiveLesson) {
        setSelectedLessonId(openLiveLesson.id);
        await loadLessonDetail(openLiveLesson.id);
        setMessage('A live lesson is already open for this subject.');
        await startLiveCapture();
        return;
      }

      const lessonId = await startLessonSession({
        schoolId: membership.schoolId,
        classId: activeClassId ?? '',
        subjectId: effectiveSubjectId,
        teacherMembershipId,
        title,
        language,
      });
      setTitle('');
      clearTranscriptDraft();
      setCapturedAudio(null);
      setMessage('Lesson started.');
      setSelectedLessonId(lessonId);
      await startLiveCapture();
      await loadLessons();
      await loadLessonDetail(lessonId);
      onLessonsChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start lesson.');
    } finally {
      setSaving(null);
    }
  }

  async function handleEndLesson(lessonId: string, lessonLanguage: string) {
    setSaving(`end-${lessonId}`);
    setError(null);
    setMessage(null);
    try {
      const recording = await stopLiveCapture();
      const transcriptText = transcriptRef.current.trim();

      await endLessonSession({
        lessonId,
        language: lessonLanguage,
        transcript: transcriptText,
        recording,
      });
      clearTranscriptDraft();
      setCapturedAudio(null);

      if (transcriptText || recording?.uri) {
        setSaving(`process-${lessonId}`);
        await processLesson(lessonId);
        setMessage('Lesson ended. Study materials are ready for review.');
      } else {
        setMessage('Lesson ended. Add the transcript to prepare study materials.');
      }

      await loadLessons();
      await loadLessonDetail(lessonId);
      onLessonsChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not end lesson.');
    } finally {
      setSaving(null);
    }
  }

  async function handleProcessLesson(lessonId: string, lessonLanguage: string) {
    setSaving(`process-${lessonId}`);
    setError(null);
    setMessage(null);
    try {
      if (recognitionRef.current) {
        stopSpeechCapture();
      }

      const transcriptText = transcriptRef.current.trim();
      if (transcriptText) {
        await addLessonTranscript(lessonId, lessonLanguage, transcriptText);
        clearTranscriptDraft();
      }

      await processLesson(lessonId);
      setMessage('Study materials created.');
      await loadLessons();
      await loadLessonDetail(lessonId);
      onLessonsChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not process lesson.');
    } finally {
      setSaving(null);
    }
  }

  async function handlePublishLesson(lessonId: string) {
    setSaving(`publish-${lessonId}`);
    setError(null);
    setMessage(null);
    try {
      const currentDetail = detail?.lesson.id === lessonId ? detail : null;

      if (currentDetail && !currentDetail.output && ['uploaded', 'failed'].includes(currentDetail.lesson.status)) {
        setSaving(`process-${lessonId}`);
        await processLesson(lessonId);
        await loadLessonDetail(lessonId);
        setSaving(`publish-${lessonId}`);
      }

      await publishLesson(lessonId);
      setMessage('Lesson published.');
      await loadLessons();
      await loadLessonDetail(lessonId);
      onLessonsChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not publish lesson.');
    } finally {
      setSaving(null);
    }
  }

  async function handleSubmitQuiz(quizId: string, answers: Array<Pick<QuizAttemptAnswer, 'questionId' | 'selectedAnswer'>>, score: number) {
    if (isTeacher) {
      setMessage(`Quiz preview score: ${Math.round(score)}%.`);
      return;
    }

    setSaving(`quiz-${quizId}`);
    setError(null);
    setMessage(null);
    try {
      await submitQuizAttempt({
        quizId,
        studentMembershipId: membership.id,
        answers,
      });
      setMessage(`Quiz saved: ${Math.round(score)}%.`);
      onLessonsChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save quiz.');
    } finally {
      setSaving(null);
    }
  }

  async function handlePersonalizeLesson(lessonId: string, languageValue: string, learningMode: LearningMode) {
    setSaving(`personalize-${lessonId}`);
    setError(null);
    setMessage(null);
    try {
      if (!canPersonalize) {
        throw new Error('Student access is required.');
      }

      await personalizeLesson({
        lessonId,
        studentMembershipId: membership.id,
        language: languageValue,
        learningMode,
      });
      setMessage('Your lesson is ready.');
      await loadLessonDetail(lessonId);
      onLessonsChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create your lesson.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <View style={styles.stack}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {message ? <Text style={styles.successText}>{message}</Text> : null}

      {!activeClass && classRouteFocus ? (
        <View style={styles.card}>
          <ActivityIndicator color={colors.tealDark} />
          <Text style={styles.cardBody}>Opening class lessons.</Text>
        </View>
      ) : !activeClass ? (
        <View style={styles.card}>
          <SectionTitle
            icon={<DoorOpen size={22} color={colors.teal} />}
            title={isTeacher ? 'Choose a class to teach' : 'Your classes'}
          />
          <Text style={styles.cardBody}>
            {isTeacher
              ? 'Enter a class, choose a subject, then start or continue a lesson.'
              : 'Enter a class to read lessons, practise questions, and review flashcards.'}
          </Text>
          {visibleClasses.length ? (
            <View style={styles.classGrid}>
              {visibleClasses.map((schoolClass) => (
                <ClassCard
                  key={schoolClass.id}
                  schoolClass={schoolClass}
                  subjectCount={subjectsForClass(setup.classSubjects, setup.subjects, schoolClass.id).length}
                  lessonCount={lessons.filter((lesson) => lesson.class_id === schoolClass.id).length}
                  onEnter={() => router.push(`/school/class/${schoolClass.username}` as never)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              {isTeacher ? 'Classes will appear here after they are added in Admin.' : 'Your classes will appear here after an admin adds you.'}
            </Text>
          )}
        </View>
      ) : (
        <>
          {!classRouteFocus ? (
            <View style={styles.roomHeader}>
              <Pressable onPress={leaveClass} style={styles.backButton}>
                <ArrowLeft size={18} color={colors.tealDark} />
                <Text style={styles.backButtonText}>Classes</Text>
              </Pressable>
              <View style={styles.flexText}>
                <Text style={styles.roomTitle}>{activeClass.name}</Text>
                <Text style={styles.recordMeta}>{activeClass.grade_level ?? 'Grade not set'}</Text>
              </View>
              <View style={styles.roomStats}>
                <Text style={styles.roomStat}>{activeClassSubjects.length} subjects</Text>
                <Text style={styles.roomStat}>{lessons.filter((lesson) => lesson.class_id === activeClass.id).length} lessons</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <SectionTitle icon={<ClipboardList size={22} color={colors.blue} />} title="Subjects" />
            {activeClassSubjects.length ? (
              <View style={styles.subjectGrid}>
                {activeClassSubjects.map((subject) => (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                    selected={subject.id === selectedSubjectId}
                    teacherName={teacherNameForSubject(setup, activeClass.id, subject.id)}
                    lessonCount={lessons.filter((lesson) => lesson.class_id === activeClass.id && lesson.subject_id === subject.id).length}
                    onPress={() => {
                      setSelectedSubjectId(subject.id);
                      setSelectedLessonId(null);
                      setDetail(null);
                    }}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                {isTeacher ? 'Subjects can be added and assigned in Admin.' : 'Subjects will appear here when the school adds them.'}
              </Text>
            )}
          </View>

          {!studioPanel ? (
            <RoomSectionNav
              isTeacher={isTeacher}
              activeSection={roomSection}
              lessonCounts={lessonSectionCounts(filteredLessons)}
              variant={libraryPanel ? 'library' : 'full'}
              onSelect={(section) => {
                setRoomSection(section);
                setSelectedLessonId(null);
                setDetail(null);
              }}
            />
          ) : null}

          {isTeacher && roomSection === 'live' && !libraryPanel ? (
            <View style={styles.lessonLaunch}>
              <View style={styles.launchIntro}>
                <View style={[styles.launchIcon, listening && styles.launchIconListening]}>
                  {listening ? <Mic size={24} color="#ffffff" /> : <Play size={24} color="#ffffff" />}
                </View>
                <View style={styles.flexText}>
                  <Text style={styles.launchTitle}>{liveStatusTitle}</Text>
                  <Text style={styles.launchMeta}>
                    {effectiveSubjectId
                      ? `${subjectName(setup.subjects, effectiveSubjectId)} - ${activeClass.name}`
                      : `General lesson - ${activeClass.name}`}
                  </Text>
                </View>
                {openLiveLesson ? (
                  <View style={styles.liveControlGroup}>
                    <Pressable onPress={listening ? pauseLiveCapture : startLiveCapture} style={styles.listenButton}>
                      {listening ? <MicOff size={16} color="#ffffff" /> : <Mic size={16} color="#ffffff" />}
                      <Text style={styles.listenButtonText}>{listening ? 'Pause' : 'Resume'}</Text>
                    </Pressable>
                    <Pressable
                      disabled={saving === `end-${openLiveLesson.id}` || saving === `process-${openLiveLesson.id}`}
                      onPress={() => handleEndLesson(openLiveLesson.id, openLiveLesson.language)}
                      style={[styles.listenButton, styles.endLiveButton, (saving === `end-${openLiveLesson.id}` || saving === `process-${openLiveLesson.id}`) && styles.disabledButton]}
                    >
                      <Square size={14} color={colors.ink} />
                      <Text style={styles.endLiveButtonText}>End</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <View style={styles.launchFields}>
                {speechNotice ? <Text style={styles.listenNotice}>{speechNotice}</Text> : null}
                {isAudioCapture || capturedAudio ? (
                  <View style={styles.audioBox}>
                    <Mic size={16} color={colors.tealDark} />
                    <View style={styles.flexText}>
                      <Text style={styles.audioBoxTitle}>{capturedAudio ? 'Audio saved' : 'Audio recording'}</Text>
                      <Text style={styles.audioBoxText}>{capturedAudio ? 'Ready for Chivo' : audioDurationLabel}</Text>
                    </View>
                  </View>
                ) : null}
                {liveWords ? (
                  <View style={styles.liveWordsBox}>
                    <Text style={styles.liveWordsLabel}>Now hearing</Text>
                    <Text style={styles.liveWordsText}>{liveWords}</Text>
                  </View>
                ) : null}
                <View style={styles.formRow}>
                  <Field label="Lesson title" value={title} onChangeText={setTitle} placeholder="Photosynthesis recap" />
                  <LanguagePicker value={language} onChange={setLanguage} />
                </View>
                <Field
                  label="Transcript"
                  value={transcript}
                  onChangeText={setTranscriptText}
                  placeholder={
                    isAudioCapture
                      ? 'Audio is being recorded. You can also add notes here'
                      : listening
                        ? 'Chivo is writing the lesson here'
                        : 'Optional for a past lesson'
                  }
                  multiline
                />
                <View style={styles.actionRow}>
                {!openLiveLesson ? (
                  <SubmitButton
                    label="Start live lesson"
                    loading={saving === 'start'}
                    onPress={handleStartLesson}
                    disabled={!activeClassId || !title.trim()}
                  />
                ) : (
                  <View style={styles.liveOpenPill}>
                    <Mic size={14} color={colors.tealDark} />
                    <Text style={styles.liveOpenPillText}>Live session open</Text>
                  </View>
                )}
                  <SubmitButton
                    label="Prepare past lesson"
                    loading={saving === 'create'}
                    onPress={handleCreateLesson}
                    disabled={!activeClassId || !title.trim() || !transcript.trim()}
                    tone="gold"
                  />
                </View>
              </View>
            </View>
          ) : null}

          {isTeacher && roomSection === 'insight' && !studioPanel ? (
            <TeacherInsightDashboard lessons={insightLessons} insights={teacherInsights} />
          ) : selectedLessonId ? (
            <View style={styles.lessonRoute}>
              <View style={styles.lessonRouteHeader}>
                <Pressable
                  onPress={() => {
                    setSelectedLessonId(null);
                    setDetail(null);
                    setQuizAttempts([]);
                  }}
                  style={styles.backButton}
                >
                  <ArrowLeft size={18} color={colors.tealDark} />
                  <Text style={styles.backButtonText}>Lessons</Text>
                </Pressable>
                <View style={styles.flexText}>
                  <Text style={styles.lessonRouteTitle}>{detail?.lesson.title ?? 'Lesson'}</Text>
                  <Text style={styles.recordMeta}>
                    {detail ? `${subjectName(setup.subjects, detail.lesson.subject_id)} - ${lessonDateLabel(detail.lesson)}` : 'Opening lesson'}
                  </Text>
                </View>
              </View>

              {loadingDetail ? (
                <View style={styles.card}>
                  <ActivityIndicator color={colors.tealDark} />
                </View>
              ) : detail ? (
                <LessonDetailView
                  detail={detail}
                  isTeacher={isTeacher}
                  canPersonalize={canPersonalize}
                  saving={saving}
                  transcript={transcript}
                  onTranscriptChange={setTranscriptText}
                  openLiveLessonId={openLiveLesson?.id ?? null}
                  listening={listening}
                  liveWords={liveWords}
                  speechNotice={speechNotice}
                  captureMode={captureMode}
                  capturedAudio={capturedAudio}
                  audioDurationLabel={audioDurationLabel}
                  captureActionLabel={captureActionLabel}
                  studySection={detailStudySection}
                  quizAttempts={quizAttempts}
                  members={setup.members}
                  onStartListening={startLiveCapture}
                  onStopListening={pauseLiveCapture}
                  onEnd={handleEndLesson}
                  onProcess={handleProcessLesson}
                  onPublish={handlePublishLesson}
                  onSubmitQuiz={handleSubmitQuiz}
                  onPersonalize={handlePersonalizeLesson}
                />
              ) : (
                <View style={styles.card}>
                  <SectionTitle icon={<Brain size={22} color={colors.gold} />} title="Lesson" />
                  <Text style={styles.cardBody}>This lesson could not be opened.</Text>
                </View>
              )}
            </View>
          ) : studioPanel ? (
            <View style={styles.card}>
              <SectionTitle icon={<Sparkles size={22} color={colors.gold} />} title="Lesson studio ready" />
              <Text style={styles.cardBody}>
                {isTeacher
                  ? 'Choose a subject, start a live lesson, then end it for Chivo AI to prepare the class materials.'
                  : 'Published lessons for this class are in the lesson library.'}
              </Text>
            </View>
          ) : (
            <View style={styles.lessonLibrary}>
              <View style={styles.card}>
                <SectionTitle icon={<BookOpen size={22} color={colors.blue} />} title={roomSectionTitle(roomSection, isTeacher)} />
                <LessonFilterBar
                  dateFilter={lessonDateFilter}
                  timeFilter={lessonTimeFilter}
                  sort={lessonSort}
                  year={lessonYear}
                  years={availableLessonYears}
                  onDateFilterChange={(value) => {
                    setLessonDateFilter(value);
                    setSelectedLessonId(null);
                    setDetail(null);
                  }}
                  onTimeFilterChange={(value) => {
                    setLessonTimeFilter(value);
                    setSelectedLessonId(null);
                    setDetail(null);
                  }}
                  onSortChange={setLessonSort}
                  onYearChange={(value) => {
                    setLessonYear(value);
                    setSelectedLessonId(null);
                    setDetail(null);
                  }}
                />
                {loading ? (
                  <ActivityIndicator color={colors.tealDark} />
                ) : roomLessons.length ? (
                  <View style={styles.lessonLibraryGrid}>
                    {roomLessons.map((lesson) => (
                      <LessonLibraryCard
                        key={lesson.id}
                        lesson={lesson}
                        subject={subjectName(setup.subjects, lesson.subject_id)}
                        onOpen={() => router.push(`/lessons/${lesson.id}` as never)}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.cardBody}>
                    {roomSectionEmptyText(roomSection, isTeacher)}
                  </Text>
                )}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function RoomSectionNav({
  isTeacher,
  activeSection,
  lessonCounts,
  variant = 'full',
  onSelect,
}: {
  isTeacher: boolean;
  activeSection: LessonRoomSection;
  lessonCounts: Record<LessonRoomSection, number>;
  variant?: 'full' | 'library';
  onSelect: (section: LessonRoomSection) => void;
}) {
  const sections: Array<{ id: LessonRoomSection; label: string; count: number }> = variant === 'library'
    ? [
        { id: 'published', label: 'Published', count: lessonCounts.published },
        { id: 'live', label: 'Live', count: lessonCounts.live },
      ]
    : isTeacher
    ? [
        { id: 'live', label: 'Live', count: lessonCounts.live },
        { id: 'review', label: 'Review', count: lessonCounts.review },
        { id: 'published', label: 'Published', count: lessonCounts.published },
        { id: 'quiz', label: 'Quiz', count: lessonCounts.quiz },
        { id: 'cards', label: 'Cards', count: lessonCounts.cards },
        { id: 'insight', label: 'Insight', count: lessonCounts.insight },
      ]
    : [
        { id: 'published', label: 'Lessons', count: lessonCounts.published },
        { id: 'quiz', label: 'Quiz', count: lessonCounts.quiz },
        { id: 'cards', label: 'Cards', count: lessonCounts.cards },
      ];

  return (
    <View style={styles.roomSectionGrid}>
      {sections.map((section) => {
        const active = section.id === activeSection;

        return (
          <Pressable
            key={section.id}
            onPress={() => onSelect(section.id)}
            style={[styles.roomSectionButton, active && styles.roomSectionButtonActive]}
          >
            <Text style={[styles.roomSectionLabel, active && styles.roomSectionLabelActive]}>{section.label}</Text>
            <Text style={[styles.roomSectionCount, active && styles.roomSectionCountActive]}>{section.count}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LessonFilterBar({
  dateFilter,
  timeFilter,
  sort,
  year,
  years,
  onDateFilterChange,
  onTimeFilterChange,
  onSortChange,
  onYearChange,
}: {
  dateFilter: LessonDateFilter;
  timeFilter: LessonTimeFilter;
  sort: LessonSort;
  year: string;
  years: string[];
  onDateFilterChange: (value: LessonDateFilter) => void;
  onTimeFilterChange: (value: LessonTimeFilter) => void;
  onSortChange: (value: LessonSort) => void;
  onYearChange: (value: string) => void;
}) {
  const dateOptions: Array<{ id: LessonDateFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
  ];
  const timeOptions: Array<{ id: LessonTimeFilter; label: string }> = [
    { id: 'all', label: 'Any time' },
    { id: 'morning', label: 'Morning' },
    { id: 'afternoon', label: 'Afternoon' },
    { id: 'evening', label: 'Evening' },
  ];

  return (
    <View style={styles.lessonFilters}>
      <View style={styles.filterGroup}>
        <View style={styles.filterLabelRow}>
          <CalendarDays size={15} color={colors.tealDark} />
          <Text style={styles.filterLabel}>Date</Text>
        </View>
        <View style={styles.filterPillRow}>
          {dateOptions.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => onDateFilterChange(option.id)}
              style={[styles.filterPill, dateFilter === option.id && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, dateFilter === option.id && styles.filterPillTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.filterGroup}>
        <View style={styles.filterLabelRow}>
          <Clock3 size={15} color={colors.tealDark} />
          <Text style={styles.filterLabel}>Time</Text>
        </View>
        <View style={styles.filterPillRow}>
          {timeOptions.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => onTimeFilterChange(option.id)}
              style={[styles.filterPill, timeFilter === option.id && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, timeFilter === option.id && styles.filterPillTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Year</Text>
        <View style={styles.filterPillRow}>
          <Pressable onPress={() => onYearChange('all')} style={[styles.filterPill, year === 'all' && styles.filterPillActive]}>
            <Text style={[styles.filterPillText, year === 'all' && styles.filterPillTextActive]}>All years</Text>
          </Pressable>
          {years.map((item) => (
            <Pressable key={item} onPress={() => onYearChange(item)} style={[styles.filterPill, year === item && styles.filterPillActive]}>
              <Text style={[styles.filterPillText, year === item && styles.filterPillTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Order</Text>
        <View style={styles.filterPillRow}>
          <Pressable onPress={() => onSortChange('newest')} style={[styles.filterPill, sort === 'newest' && styles.filterPillActive]}>
            <Text style={[styles.filterPillText, sort === 'newest' && styles.filterPillTextActive]}>Newest</Text>
          </Pressable>
          <Pressable onPress={() => onSortChange('oldest')} style={[styles.filterPill, sort === 'oldest' && styles.filterPillActive]}>
            <Text style={[styles.filterPillText, sort === 'oldest' && styles.filterPillTextActive]}>Oldest</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function LessonLibraryCard({
  lesson,
  subject,
  onOpen,
}: {
  lesson: LessonRow;
  subject: string;
  onOpen: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={styles.lessonLibraryCard}>
      <View style={styles.lessonLibraryTop}>
        <View style={styles.lessonLibraryIcon}>
          <BookOpen size={20} color={colors.tealDark} />
        </View>
        <StatusBadge status={lesson.status} />
      </View>
      <Text style={styles.lessonLibraryTitle}>{lesson.title}</Text>
      <Text style={styles.lessonLibraryMeta}>{subject}</Text>
      <View style={styles.lessonLibraryFooter}>
        <Text style={styles.lessonLibraryDate}>{lessonDateLabel(lesson)}</Text>
        <Text style={styles.lessonLibraryDate}>{lessonTimeLabel(lesson)}</Text>
      </View>
    </Pressable>
  );
}

function ClassCard({
  schoolClass,
  subjectCount,
  lessonCount,
  onEnter,
}: {
  schoolClass: ClassRow;
  subjectCount: number;
  lessonCount: number;
  onEnter: () => void;
}) {
  return (
    <View style={styles.classCard}>
      <View style={styles.classIcon}>
        <BookOpen size={22} color="#ffffff" />
      </View>
      <View style={styles.flexText}>
        <Text style={styles.classTitle}>{schoolClass.name}</Text>
        <Text style={styles.recordMeta}>{schoolClass.grade_level ?? 'Grade not set'}</Text>
      </View>
      <View style={styles.classStats}>
        <View style={styles.classStatPill}>
          <Text style={styles.classStatValue}>{subjectCount}</Text>
          <Text style={styles.classStatText}>Subjects</Text>
        </View>
        <View style={styles.classStatPill}>
          <Text style={styles.classStatValue}>{lessonCount}</Text>
          <Text style={styles.classStatText}>Lessons</Text>
        </View>
      </View>
      <Pressable onPress={onEnter} style={styles.enterButton}>
        <DoorOpen size={17} color="#ffffff" />
        <Text style={styles.enterButtonText}>Enter class</Text>
      </Pressable>
    </View>
  );
}

function SubjectCard({
  subject,
  selected,
  teacherName,
  lessonCount,
  onPress,
}: {
  subject: SubjectRow;
  selected: boolean;
  teacherName: string;
  lessonCount: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.subjectCard, selected && styles.subjectCardActive]}>
      <View style={styles.subjectHeader}>
        <Text style={[styles.subjectTitle, selected && styles.subjectTitleActive]}>{subject.name}</Text>
        <Text style={[styles.subjectCount, selected && styles.subjectCountActive]}>{lessonCount}</Text>
      </View>
      <View style={styles.subjectTeacher}>
        <UserCheck size={15} color={selected ? '#ffffff' : colors.tealDark} />
        <Text style={[styles.subjectTeacherText, selected && styles.subjectTeacherTextActive]}>
          {teacherName}
        </Text>
      </View>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: LessonRow['status'] }) {
  const isPublished = status === 'published';
  const isLive = status === 'recording';
  const isReview = status === 'review';
  const isFailed = status === 'failed';

  return (
    <View
      style={[
        styles.statusBadge,
        isPublished && styles.statusBadgePublished,
        isLive && styles.statusBadgeLive,
        isReview && styles.statusBadgeReview,
        isFailed && styles.statusBadgeFailed,
      ]}
    >
      <Text
        style={[
          styles.statusBadgeText,
          (isPublished || isLive || isFailed) && styles.statusBadgeTextStrong,
        ]}
      >
        {lessonStatusLabel(status)}
      </Text>
    </View>
  );
}

function LessonDetailView({
  detail,
  isTeacher,
  canPersonalize,
  saving,
  transcript,
  onTranscriptChange,
  openLiveLessonId,
  listening,
  liveWords,
  speechNotice,
  captureMode,
  capturedAudio,
  audioDurationLabel,
  captureActionLabel,
  studySection,
  quizAttempts,
  members,
  onStartListening,
  onStopListening,
  onEnd,
  onProcess,
  onPublish,
  onSubmitQuiz,
  onPersonalize,
}: {
  detail: LessonDetail;
  isTeacher: boolean;
  canPersonalize: boolean;
  saving: string | null;
  transcript: string;
  onTranscriptChange: (value: string) => void;
  openLiveLessonId: string | null;
  listening: boolean;
  liveWords: string;
  speechNotice: string | null;
  captureMode: 'speech' | 'audio' | null;
  capturedAudio: LessonRecordingUpload | null;
  audioDurationLabel: string;
  captureActionLabel: string;
  studySection: StudySection;
  quizAttempts: QuizAttemptRow[];
  members: SchoolSetupState['members'];
  onStartListening: () => boolean | Promise<boolean>;
  onStopListening: () => void;
  onEnd: (lessonId: string, lessonLanguage: string) => void;
  onProcess: (lessonId: string, lessonLanguage: string) => void;
  onPublish: (lessonId: string) => void;
  onSubmitQuiz: (quizId: string, answers: Array<Pick<QuizAttemptAnswer, 'questionId' | 'selectedAnswer'>>, score: number) => void;
  onPersonalize: (lessonId: string, language: string, learningMode: LearningMode) => void;
}) {
  const [activeStudySection, setActiveStudySection] = useState<StudySection>(studySection);
  const canEndLesson = detail.lesson.status === 'recording';
  const canCreateMaterials = ['uploaded', 'failed'].includes(detail.lesson.status);
  const canPublishLesson = detail.lesson.status !== 'recording'
    && detail.lesson.status !== 'published'
    && (Boolean(detail.output) || canCreateMaterials || detail.lesson.status === 'review');
  const differentLiveLessonOpen = Boolean(openLiveLessonId && openLiveLessonId !== detail.lesson.id);
  const canAddTranscript = isTeacher && (canEndLesson || (canCreateMaterials && !detail.output));

  useEffect(() => {
    setActiveStudySection(studySection);
  }, [detail.lesson.id, studySection]);

  return (
    <View style={styles.stack}>
      <View style={[styles.card, isTeacher && styles.teacherReviewCard]}>
        <SectionTitle icon={<Brain size={22} color={colors.gold} />} title={detail.lesson.title} />
        <View style={styles.detailMetaRow}>
          <StatusBadge status={detail.lesson.status} />
          <Text style={styles.recordMeta}>{detail.lesson.language}</Text>
          {isTeacher ? (
            <Text style={styles.reviewMeta}>
              {detail.output ? 'AI study pack ready' : 'Waiting for Chivo AI'}
            </Text>
          ) : null}
        </View>
        {isTeacher ? (
          <View style={styles.reviewStrip}>
            <ReviewMetric label="Summary" value={detail.output?.summary ? 'Ready' : 'Empty'} />
            <ReviewMetric label="Quiz" value={detail.questions.length} />
            <ReviewMetric label="Cards" value={detail.flashcards.length} />
          </View>
        ) : null}
        {canAddTranscript ? (
          <View style={styles.inlineTranscript}>
            {speechNotice ? <Text style={styles.listenNotice}>{speechNotice}</Text> : null}
            {captureMode === 'audio' || capturedAudio ? (
              <View style={styles.audioBox}>
                <Mic size={16} color={colors.tealDark} />
                <View style={styles.flexText}>
                  <Text style={styles.audioBoxTitle}>{capturedAudio ? 'Audio saved' : 'Audio recording'}</Text>
                  <Text style={styles.audioBoxText}>{capturedAudio ? 'Ready for Chivo' : audioDurationLabel}</Text>
                </View>
              </View>
            ) : null}
            {liveWords ? (
              <View style={styles.liveWordsBox}>
                <Text style={styles.liveWordsLabel}>Now hearing</Text>
                <Text style={styles.liveWordsText}>{liveWords}</Text>
              </View>
            ) : null}
            <Field
              label={canEndLesson ? 'Transcript' : 'Class transcript'}
              value={transcript}
              onChangeText={onTranscriptChange}
              placeholder={
                captureMode === 'audio'
                  ? 'Audio is being recorded. You can also add notes here'
                  : canEndLesson
                    ? 'Paste what was taught, then Chivo will prepare the lesson'
                    : 'Add the lesson transcript here'
              }
              multiline
            />
          </View>
        ) : null}
        {differentLiveLessonOpen ? (
          <Text style={styles.warningText}>End the open live lesson before working on another lesson in this subject.</Text>
        ) : null}
        {isTeacher ? (
          <View style={styles.actionRow}>
            {canEndLesson ? (
              <>
                <SubmitButton
                  label={listening ? 'Pause' : 'Resume live'}
                  loading={false}
                  onPress={listening ? onStopListening : onStartListening}
                />
                <SubmitButton
                  label={transcript.trim() || capturedAudio || captureMode === 'audio' ? 'End and prepare' : 'End lesson'}
                  loading={saving === `end-${detail.lesson.id}`}
                  onPress={() => onEnd(detail.lesson.id, detail.lesson.language)}
                  tone={transcript.trim() || capturedAudio || captureMode === 'audio' ? 'gold' : 'teal'}
                />
              </>
            ) : (
              <SubmitButton
                label="Create study materials"
                loading={saving === `process-${detail.lesson.id}`}
                onPress={() => onProcess(detail.lesson.id, detail.lesson.language)}
                disabled={!canCreateMaterials || differentLiveLessonOpen}
              />
            )}
            <SubmitButton
              label={!detail.output && canCreateMaterials ? 'Prepare and publish' : detail.lesson.status === 'published' ? 'Published' : 'Publish'}
              loading={saving === `publish-${detail.lesson.id}` || saving === `process-${detail.lesson.id}`}
              onPress={() => onPublish(detail.lesson.id)}
              disabled={!canPublishLesson || differentLiveLessonOpen}
              tone="gold"
            />
            {detail.lesson.status === 'published' ? (
              <SubmitButton
                label="Open student view"
                loading={false}
                onPress={() => router.push(`/lessons/${detail.lesson.id}` as never)}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      <StudySectionNav activeSection={activeStudySection} onSelect={setActiveStudySection} />

      {activeStudySection === 'summary' ? (
        <SummaryPanel
          detail={detail}
          isTeacher={isTeacher}
          canPersonalize={canPersonalize}
          saving={saving}
          onPersonalize={onPersonalize}
        />
      ) : activeStudySection === 'quiz' ? (
        <QuizPanel
          detail={detail}
          isTeacher={isTeacher}
          saving={saving}
          quizAttempts={quizAttempts}
          members={members}
          onSubmitQuiz={onSubmitQuiz}
        />
      ) : (
        <FlashcardPanel flashcards={detail.flashcards} />
      )}
    </View>
  );
}

function StudySectionNav({
  activeSection,
  onSelect,
}: {
  activeSection: StudySection;
  onSelect: (section: StudySection) => void;
}) {
  const sections: Array<{ id: StudySection; label: string }> = [
    { id: 'summary', label: 'Summary' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'cards', label: 'Cards' },
  ];

  return (
    <View style={styles.studyTabs}>
      {sections.map((section) => (
        <Pressable
          key={section.id}
          onPress={() => onSelect(section.id)}
          style={[styles.studyTab, activeSection === section.id && styles.studyTabActive]}
        >
          <Text style={[styles.studyTabText, activeSection === section.id && styles.studyTabTextActive]}>
            {section.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SummaryPanel({
  detail,
  isTeacher,
  canPersonalize,
  saving,
  onPersonalize,
}: {
  detail: LessonDetail;
  isTeacher: boolean;
  canPersonalize: boolean;
  saving: string | null;
  onPersonalize: (lessonId: string, language: string, learningMode: LearningMode) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const keyPoints = detail.output?.key_points ?? [];
  const visiblePoints = showAll ? keyPoints : keyPoints.slice(0, 4);
  const hasMore = keyPoints.length > visiblePoints.length || Number(detail.output?.summary?.length ?? 0) > 780;

  return (
    <View style={styles.stack}>
      {canPersonalize ? (
        <PersonalLessonPanel
          detail={detail}
          saving={saving}
          onPersonalize={onPersonalize}
        />
      ) : null}
      <View style={styles.card}>
        <SectionTitle icon={<ClipboardList size={22} color={colors.teal} />} title={isTeacher ? 'Summary' : 'Class summary'} />
        <CollapsibleStudyText
          text={detail.output?.summary ?? 'Summary is not ready yet.'}
          expanded={showAll}
          limit={780}
          style={styles.summaryText}
        />
        {visiblePoints.length ? (
          <View style={styles.bulletList}>
            {visiblePoints.map((point, index) => (
              <View key={`${point}-${index}`} style={styles.aiPointCard}>
                <Text style={styles.aiPointNumber}>{index + 1}</Text>
                <RichStudyText text={point} style={styles.bulletText} />
              </View>
            ))}
          </View>
        ) : null}
        {hasMore ? (
          <Pressable onPress={() => setShowAll((current) => !current)} style={styles.showMoreButton}>
            <Text style={styles.showMoreText}>{showAll ? 'Show less' : 'Show more'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PersonalLessonPanel({
  detail,
  saving,
  onPersonalize,
}: {
  detail: LessonDetail;
  saving: string | null;
  onPersonalize: (lessonId: string, language: string, learningMode: LearningMode) => void;
}) {
  const [languageValue, setLanguageValue] = useState(detail.personalization?.language ?? detail.lesson.language ?? 'English');
  const [learningMode, setLearningMode] = useState<LearningMode>(detail.personalization?.learning_mode ?? 'balanced');
  const [speechState, setSpeechState] = useState<'idle' | 'speaking' | 'paused'>('idle');
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);
  const personalContent = readPersonalContent(detail.personalization);
  const spokenText = buildSpokenPersonalLesson(detail, personalContent);
  const isSaving = saving === `personalize-${detail.lesson.id}`;

  useEffect(() => {
    setLanguageValue(detail.personalization?.language ?? detail.lesson.language ?? 'English');
    setLearningMode(detail.personalization?.learning_mode ?? 'balanced');
    setSpeechState('idle');
    setSpeechMessage(null);
    void Speech.stop().catch(() => undefined);
  }, [detail.lesson.id, detail.personalization?.id]);

  useEffect(
    () => () => {
      void Speech.stop().catch(() => undefined);
    },
    []
  );

  async function playPersonalLesson() {
    if (!detail.personalization || !spokenText.trim()) {
      setSpeechMessage('Create your lesson first.');
      return;
    }

    await Speech.stop().catch(() => undefined);
    const maxLength = Number.isFinite(Speech.maxSpeechInputLength) ? Speech.maxSpeechInputLength : spokenText.length;
    const text = spokenText.slice(0, Math.max(1, maxLength));

    Speech.speak(text, {
      language: speechLocaleForLanguage(detail.personalization.language),
      rate: 0.92,
      pitch: 1,
      onStart: () => {
        setSpeechState('speaking');
        setSpeechMessage(null);
      },
      onDone: () => {
        setSpeechState('idle');
      },
      onStopped: () => {
        setSpeechState('idle');
      },
      onError: () => {
        setSpeechState('idle');
        setSpeechMessage('Could not play this lesson here.');
      },
    });
  }

  async function pausePersonalLesson() {
    if (Platform.OS === 'android') {
      await stopPersonalLesson();
      return;
    }

    try {
      await Speech.pause();
      setSpeechState('paused');
    } catch {
      await stopPersonalLesson();
    }
  }

  async function resumePersonalLesson() {
    try {
      await Speech.resume();
      setSpeechState('speaking');
    } catch {
      await playPersonalLesson();
    }
  }

  async function stopPersonalLesson() {
    await Speech.stop().catch(() => undefined);
    setSpeechState('idle');
  }

  return (
    <View style={styles.personalCard}>
      <View style={styles.personalHeader}>
        <View style={styles.personalIcon}>
          <Sparkles size={22} color="#ffffff" />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.personalTitle}>My lesson</Text>
          <Text style={styles.personalMeta}>
            {detail.personalization
              ? `${detail.personalization.language} - ${learningModeLabel(detail.personalization.learning_mode)}`
              : 'Choose how you want to study this lesson.'}
          </Text>
        </View>
      </View>

      <View style={styles.formRow}>
        <LanguagePicker value={languageValue} onChange={setLanguageValue} />
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
      <SubmitButton
        label={detail.personalization ? 'Refresh my lesson' : 'Create my lesson'}
        loading={isSaving}
        disabled={!detail.output || !languageValue.trim()}
        onPress={() => onPersonalize(detail.lesson.id, languageValue, learningMode)}
        tone="gold"
      />

      {detail.personalization ? (
        <View style={styles.personalOutput}>
          <Text style={styles.personalOutputTitle}>{personalContent.title || detail.lesson.title}</Text>
          <View style={styles.speechControls}>
            {speechState === 'paused' ? (
              <Pressable onPress={resumePersonalLesson} style={styles.speechButtonStrong}>
                <Play size={16} color="#ffffff" />
                <Text style={styles.speechButtonStrongText}>Resume</Text>
              </Pressable>
            ) : (
              <Pressable onPress={speechState === 'speaking' ? pausePersonalLesson : playPersonalLesson} style={styles.speechButtonStrong}>
                {speechState === 'speaking' ? <Pause size={16} color="#ffffff" /> : <Volume2 size={16} color="#ffffff" />}
                <Text style={styles.speechButtonStrongText}>{speechState === 'speaking' ? 'Pause' : 'Listen'}</Text>
              </Pressable>
            )}
            <Pressable onPress={stopPersonalLesson} style={styles.speechButton}>
              <Square size={15} color={colors.tealDark} />
              <Text style={styles.speechButtonText}>Stop</Text>
            </Pressable>
          </View>
          {speechMessage ? <Text style={styles.speechMessage}>{speechMessage}</Text> : null}
          <RichStudyText text={detail.personalization.summary} style={styles.personalSummary} />
          {personalContent.keyPoints.length ? (
            <View style={styles.bulletList}>
              {personalContent.keyPoints.map((point, index) => (
                <RichStudyText key={`${point}-${index}`} text={point} style={styles.personalBullet} />
              ))}
            </View>
          ) : null}
          {personalContent.studySteps.length ? (
            <View style={styles.studyStepList}>
              {personalContent.studySteps.map((step, index) => (
                <View key={`${step}-${index}`} style={styles.studyStep}>
                  <Text style={styles.studyStepNumber}>{index + 1}</Text>
                  <RichStudyText text={step} style={styles.studyStepText} />
                </View>
              ))}
            </View>
          ) : null}
          {personalContent.vocabulary.length ? (
            <View style={styles.vocabGrid}>
              {personalContent.vocabulary.map((item) => (
                <View key={`${item.term}-${item.meaning}`} style={styles.vocabCard}>
                  <RichStudyText text={item.term} style={styles.vocabTerm} />
                  <RichStudyText text={item.meaning} style={styles.vocabMeaning} />
                </View>
              ))}
            </View>
          ) : null}
          {personalContent.encouragement ? <Text style={styles.encouragement}>{personalContent.encouragement}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function QuizPanel({
  detail,
  isTeacher,
  saving,
  quizAttempts,
  members,
  onSubmitQuiz,
}: {
  detail: LessonDetail;
  isTeacher: boolean;
  saving: string | null;
  quizAttempts: QuizAttemptRow[];
  members: SchoolSetupState['members'];
  onSubmitQuiz: (quizId: string, answers: Array<Pick<QuizAttemptAnswer, 'questionId' | 'selectedAnswer'>>, score: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ correct: number; total: number; score: number } | null>(null);

  useEffect(() => {
    setAnswers({});
    setResult(null);
  }, [detail.lesson.id]);

  if (!detail.quiz || !detail.questions.length) {
    return (
      <View style={styles.card}>
        <SectionTitle icon={<CheckCircle2 size={22} color={colors.blue} />} title="Quiz" />
        <Text style={styles.cardBody}>Quiz questions will appear when study materials are ready.</Text>
      </View>
    );
  }

  const allAnswered = detail.questions.every((question) => answers[question.id]);
  const quizSaving = saving === `quiz-${detail.quiz.id}`;

  function submit() {
    if (!detail.quiz || !allAnswered) {
      return;
    }

    const checkedAnswers = detail.questions.map((question) => {
      const selectedAnswer = answers[question.id] ?? '';
      const correctAnswer = question.answer;
      const isCorrect = normalizeAnswer(selectedAnswer) === normalizeAnswer(correctAnswer ?? '');

      return {
        questionId: question.id,
        prompt: question.prompt,
        selectedAnswer,
        correctAnswer,
        isCorrect,
      };
    });
    const correct = checkedAnswers.filter((answer) => answer.isCorrect).length;
    const score = checkedAnswers.length ? (correct / checkedAnswers.length) * 100 : 0;
    const submitAnswers = checkedAnswers.map((answer) => ({
      questionId: answer.questionId,
      selectedAnswer: answer.selectedAnswer,
    }));

    setResult({ correct, total: checkedAnswers.length, score });
    onSubmitQuiz(detail.quiz.id, submitAnswers, score);
  }

  return (
    <View style={styles.card}>
      <SectionTitle icon={<CheckCircle2 size={22} color={colors.blue} />} title={isTeacher ? 'Quiz preview' : 'Quiz'} />
      {isTeacher ? <QuizInsightPanel attempts={quizAttempts} members={members} /> : null}
      {result ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>{Math.round(result.score)}%</Text>
          <Text style={styles.resultText}>{result.correct} of {result.total} correct</Text>
        </View>
      ) : null}
      <View style={styles.recordList}>
        {detail.questions.map((question) => (
          <View key={question.id} style={styles.quizCard}>
            <Text style={styles.recordTitle}>{question.position}. {question.prompt}</Text>
            <View style={styles.optionList}>
              {question.options.map((option) => {
                const selected = answers[question.id] === option;
                const correct = result && normalizeAnswer(option) === normalizeAnswer(question.answer ?? '');
                const wrong = result && selected && !correct;

                return (
                  <Pressable
                    key={option}
                    disabled={Boolean(result)}
                    onPress={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                    style={[
                      styles.optionButton,
                      selected && styles.optionButtonSelected,
                      correct && styles.optionButtonCorrect,
                      wrong && styles.optionButtonWrong,
                    ]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
            {result && question.explanation ? <Text style={styles.explanationText}>{question.explanation}</Text> : null}
          </View>
        ))}
      </View>
      <SubmitButton
        label={isTeacher ? 'Check preview' : 'Submit quiz'}
        loading={quizSaving}
        onPress={submit}
        disabled={!allAnswered || Boolean(result)}
      />
    </View>
  );
}

function QuizInsightPanel({
  attempts,
  members,
}: {
  attempts: QuizAttemptRow[];
  members: SchoolSetupState['members'];
}) {
  const average = attempts.length
    ? attempts.reduce((total, attempt) => total + Number(attempt.score ?? 0), 0) / attempts.length
    : 0;
  const needsHelp = attempts.filter((attempt) => Number(attempt.score ?? 0) < 60).length;
  const recentAttempts = attempts.slice(0, 5);

  return (
    <View style={styles.insightBox}>
      <View style={styles.insightStats}>
        <View style={styles.insightStat}>
          <Text style={styles.insightValue}>{attempts.length}</Text>
          <Text style={styles.insightLabel}>Attempts</Text>
        </View>
        <View style={styles.insightStat}>
          <Text style={styles.insightValue}>{Math.round(average)}%</Text>
          <Text style={styles.insightLabel}>Average</Text>
        </View>
        <View style={styles.insightStat}>
          <Text style={styles.insightValue}>{needsHelp}</Text>
          <Text style={styles.insightLabel}>Need help</Text>
        </View>
      </View>
      {recentAttempts.length ? (
        <View style={styles.attemptList}>
          {recentAttempts.map((attempt) => (
            <View key={attempt.id} style={styles.attemptRow}>
              <Text style={styles.attemptName}>{studentName(members, attempt.student_membership_id)}</Text>
              <Text style={styles.attemptScore}>{Math.round(Number(attempt.score ?? 0))}%</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.cardBody}>Student attempts will appear here.</Text>
      )}
    </View>
  );
}

function TeacherInsightDashboard({
  lessons,
  insights,
}: {
  lessons: LessonRow[];
  insights: TeacherLessonInsight[];
}) {
  const insightByLesson = new Map(insights.map((insight) => [insight.lessonId, insight]));
  const totalAttempts = insights.reduce((total, insight) => total + insight.attemptCount, 0);
  const averageScore = totalAttempts
    ? insights.reduce((total, insight) => total + insight.averageScore * insight.attemptCount, 0) / totalAttempts
    : 0;
  const needsHelp = insights.reduce((total, insight) => total + insight.needsHelpCount, 0);

  return (
    <View style={styles.insightDashboard}>
      <View style={styles.insightHero}>
        <View style={styles.insightHeroIcon}>
          <Brain size={25} color="#ffffff" />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.insightHeroTitle}>Class insight</Text>
          <Text style={styles.insightHeroBody}>Quiz results show where the class is ready and where to revisit.</Text>
        </View>
      </View>

      <View style={styles.insightStats}>
        <View style={styles.insightStat}>
          <Text style={styles.insightValue}>{lessons.length}</Text>
          <Text style={styles.insightLabel}>Lessons</Text>
        </View>
        <View style={styles.insightStat}>
          <Text style={styles.insightValue}>{totalAttempts}</Text>
          <Text style={styles.insightLabel}>Attempts</Text>
        </View>
        <View style={styles.insightStat}>
          <Text style={styles.insightValue}>{Math.round(averageScore)}%</Text>
          <Text style={styles.insightLabel}>Average</Text>
        </View>
        <View style={styles.insightStat}>
          <Text style={styles.insightValue}>{needsHelp}</Text>
          <Text style={styles.insightLabel}>Need help</Text>
        </View>
      </View>

      <View style={styles.insightLessonList}>
        {lessons.length ? (
          lessons.map((lesson) => {
            const insight = insightByLesson.get(lesson.id);
            const hasAttempts = Boolean(insight?.attemptCount);

            return (
              <View key={lesson.id} style={styles.insightLessonCard}>
                <View style={styles.flexText}>
                  <Text style={styles.insightLessonTitle}>{lesson.title}</Text>
                  <Text style={styles.insightLessonMeta}>
                    {hasAttempts
                      ? `${insight?.attemptCount ?? 0} attempts - ${Math.round(insight?.averageScore ?? 0)}% average`
                      : 'No attempts yet'}
                  </Text>
                </View>
                <View style={[styles.insightStatusPill, hasAttempts && styles.insightStatusPillActive]}>
                  <Text style={[styles.insightStatusText, hasAttempts && styles.insightStatusTextActive]}>
                    {hasAttempts ? `${insight?.needsHelpCount ?? 0} need help` : 'Waiting'}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardBody}>Publish lessons and collect quiz attempts to see class insight.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function FlashcardPanel({ flashcards }: { flashcards: LessonDetail['flashcards'] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const card = flashcards[activeIndex];

  useEffect(() => {
    setActiveIndex(0);
    setShowBack(false);
  }, [flashcards.map((item) => item.id).join('|')]);

  if (!card) {
    return (
      <View style={styles.card}>
        <SectionTitle icon={<Layers size={22} color={colors.coral} />} title="Cards" />
        <Text style={styles.cardBody}>Cards will appear when study materials are ready.</Text>
      </View>
    );
  }

  function move(offset: number) {
    const nextIndex = (activeIndex + offset + flashcards.length) % flashcards.length;
    setActiveIndex(nextIndex);
    setShowBack(false);
  }

  return (
    <View style={styles.card}>
      <SectionTitle icon={<Layers size={22} color={colors.coral} />} title="Cards" />
      <Text style={styles.flashCounter}>{activeIndex + 1} / {flashcards.length}</Text>
      <Pressable onPress={() => setShowBack((current) => !current)} style={styles.flashSessionCard}>
        <Text style={styles.flashFaceLabel}>{showBack ? 'Answer' : 'Question'}</Text>
        <Text style={styles.flashFaceText}>{showBack ? card.back : card.front}</Text>
      </Pressable>
      <View style={styles.flashNavRow}>
        <Pressable onPress={() => move(-1)} style={styles.flashNavButton}>
          <Text style={styles.flashNavText}>Previous</Text>
        </Pressable>
        <Pressable onPress={() => setShowBack((current) => !current)} style={styles.flashNavButtonStrong}>
          <Text style={styles.flashNavTextStrong}>{showBack ? 'Hide' : 'Reveal'}</Text>
        </Pressable>
        <Pressable onPress={() => move(1)} style={styles.flashNavButton}>
          <Text style={styles.flashNavText}>Next</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      {icon}
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

function ReviewMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.reviewMetric}>
      <Text style={styles.reviewMetricValue}>{value}</Text>
      <Text style={styles.reviewMetricLabel}>{label}</Text>
    </View>
  );
}

function CollapsibleStudyText({
  text,
  expanded,
  limit,
  style,
}: {
  text: string;
  expanded: boolean;
  limit: number;
  style: object;
}) {
  const cleaned = text.trim();
  const display = !expanded && cleaned.length > limit ? `${cleaned.slice(0, limit).trim()}...` : cleaned;
  return <RichStudyText text={display} style={style} />;
}

function RichStudyText({ text, style }: { text: string; style: object }) {
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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8b9691"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  );
}

function SubmitButton({
  label,
  loading,
  disabled,
  tone,
  onPress,
}: {
  label: string;
  loading: boolean;
  disabled?: boolean;
  tone?: 'teal' | 'gold';
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={loading || disabled}
      onPress={onPress}
      style={[
        styles.submitButton,
        tone === 'gold' && styles.submitButtonGold,
        (loading || disabled) && styles.disabledButton,
      ]}
    >
      {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>{label}</Text>}
    </Pressable>
  );
}

function lessonSectionCounts(lessons: LessonRow[]): Record<LessonRoomSection, number> {
  const published = lessons.filter((lesson) => lesson.status === 'published').length;

  return {
    live: lessons.filter((lesson) => lesson.status === 'recording').length,
    review: lessons.filter(isReviewLesson).length,
    published,
    quiz: published,
    cards: published,
    insight: published,
  };
}

function lessonsForRoomSection(lessons: LessonRow[], isTeacher: boolean, section: LessonRoomSection) {
  if (section === 'live') {
    return lessons.filter((lesson) => lesson.status === 'recording');
  }

  if (section === 'review') {
    return isTeacher ? lessons.filter(isReviewLesson) : [];
  }

  return lessons.filter((lesson) => lesson.status === 'published');
}

function isReviewLesson(lesson: LessonRow) {
  return ['uploaded', 'transcribing', 'review', 'failed'].includes(lesson.status);
}

function roomSectionTitle(section: LessonRoomSection, isTeacher: boolean) {
  const labels: Record<LessonRoomSection, string> = {
    live: 'Live lessons',
    review: 'Review queue',
    published: isTeacher ? 'Published lessons' : 'Lessons',
    quiz: 'Quiz',
    cards: 'Cards',
    insight: 'Class insight',
  };

  return labels[section];
}

function roomSectionEmptyText(section: LessonRoomSection, isTeacher: boolean) {
  if (section === 'live') {
    return 'Start a lesson here when class begins.';
  }

  if (section === 'review') {
    return 'Lessons waiting for review will appear here.';
  }

  if (section === 'quiz') {
    return isTeacher ? 'Published lessons with quizzes will appear here.' : 'Quizzes will appear after lessons are published.';
  }

  if (section === 'cards') {
    return isTeacher ? 'Published lessons with cards will appear here.' : 'Cards will appear after lessons are published.';
  }

  if (section === 'insight') {
    return 'Publish lessons and collect quiz attempts to see class insight.';
  }

  return isTeacher ? 'Published lessons will appear here.' : 'Published lessons for this subject will appear here.';
}

const learningModeOptions: Array<{ id: LearningMode; label: string; body: string }> = [
  { id: 'simple', label: 'Simple', body: 'Short and gentle' },
  { id: 'balanced', label: 'Balanced', body: 'Clear study notes' },
  { id: 'exam', label: 'Exam', body: 'Practice focused' },
  { id: 'story', label: 'Story', body: 'Easy to imagine' },
  { id: 'catch_up', label: 'Catch up', body: 'Fill the gaps' },
];

function learningModeLabel(mode: LearningMode) {
  return learningModeOptions.find((item) => item.id === mode)?.label ?? 'Balanced';
}

function readPersonalContent(personalization: LessonPersonalizationRow | null) {
  const content = personalization?.content ?? {};

  return {
    title: typeof content.title === 'string' ? content.title : '',
    keyPoints: stringArray(content.key_points),
    studySteps: stringArray(content.study_steps),
    vocabulary: vocabularyArray(content.vocabulary),
    encouragement: typeof content.encouragement === 'string' ? content.encouragement : '',
  };
}

function buildSpokenPersonalLesson(detail: LessonDetail, content: ReturnType<typeof readPersonalContent>) {
  if (!detail.personalization) {
    return '';
  }

  const parts = [
    content.title || detail.lesson.title,
    detail.personalization.summary,
    content.keyPoints.length ? `Key points. ${content.keyPoints.join('. ')}` : '',
    content.studySteps.length ? `Study steps. ${content.studySteps.join('. ')}` : '',
    content.vocabulary.length
      ? `Vocabulary. ${content.vocabulary.map((item) => `${item.term}: ${item.meaning}`).join('. ')}`
      : '',
    content.encouragement,
  ];

  return parts.filter(Boolean).join('. ');
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function vocabularyArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const entry = item as { term?: unknown; meaning?: unknown };
      return typeof entry.term === 'string' && typeof entry.meaning === 'string'
        ? { term: entry.term, meaning: entry.meaning }
        : null;
    })
    .filter((item): item is { term: string; meaning: string } => Boolean(item));
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase();
}

function subjectsForClass(classSubjects: ClassSubjectRow[], subjects: SubjectRow[], classId: string | null) {
  if (!classId) {
    return subjects;
  }

  const subjectIds = classSubjects.filter((item) => item.class_id === classId).map((item) => item.subject_id);
  const filtered = subjects.filter((subject) => subjectIds.includes(subject.id));
  return filtered.length ? filtered : subjects;
}

function subjectName(subjects: SubjectRow[], subjectId: string | null) {
  return subjects.find((item) => item.id === subjectId)?.name ?? 'No subject';
}

function teacherNameForSubject(setup: SchoolSetupState, classId: string, subjectId: string) {
  const classSubject = setup.classSubjects.find(
    (item) => item.class_id === classId && item.subject_id === subjectId
  );
  const teacher = setup.members.find((member) => member.id === classSubject?.teacher_membership_id);
  return teacher?.profiles?.full_name ?? 'Teacher not assigned';
}

function studentName(members: SchoolSetupState['members'], membershipId: string) {
  return members.find((member) => member.id === membershipId)?.profiles?.full_name ?? 'Student';
}

function lessonStatusLabel(status: LessonRow['status']) {
  const labels: Record<LessonRow['status'], string> = {
    draft: 'Draft',
    recording: 'Live',
    uploaded: 'Ready',
    transcribing: 'Creating',
    review: 'Review',
    published: 'Published',
    failed: 'Needs attention',
  };

  return labels[status];
}

function filterLessonsByTime(
  lessons: LessonRow[],
  filters: {
    dateFilter: LessonDateFilter;
    timeFilter: LessonTimeFilter;
    sort: LessonSort;
    year: string;
  }
) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfToday - now.getDay() * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  return [...lessons]
    .filter((lesson) => {
      const timestamp = lessonTimestamp(lesson);
      const date = new Date(timestamp);

      if (filters.year !== 'all' && String(date.getFullYear()) !== filters.year) {
        return false;
      }

      if (filters.dateFilter === 'today' && timestamp < startOfToday) {
        return false;
      }

      if (filters.dateFilter === 'week' && timestamp < startOfWeek) {
        return false;
      }

      if (filters.dateFilter === 'month' && timestamp < startOfMonth) {
        return false;
      }

      if (filters.dateFilter === 'year' && timestamp < startOfYear) {
        return false;
      }

      return timeFilterMatches(date, filters.timeFilter);
    })
    .sort((left, right) =>
      filters.sort === 'newest'
        ? lessonTimestamp(right) - lessonTimestamp(left)
        : lessonTimestamp(left) - lessonTimestamp(right)
    );
}

function timeFilterMatches(date: Date, filter: LessonTimeFilter) {
  const hour = date.getHours();

  if (filter === 'morning') {
    return hour >= 5 && hour < 12;
  }

  if (filter === 'afternoon') {
    return hour >= 12 && hour < 17;
  }

  if (filter === 'evening') {
    return hour >= 17 || hour < 5;
  }

  return true;
}

function lessonYears(lessons: LessonRow[]) {
  return Array.from(new Set(lessons.map((lesson) => new Date(lessonTimestamp(lesson)).getFullYear()).filter(Boolean)))
    .sort((left, right) => right - left)
    .map(String);
}

function lessonTimestamp(lesson: LessonRow) {
  const value = lesson.recorded_at ?? lesson.published_at ?? lesson.created_at;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function lessonDateLabel(lesson: LessonRow) {
  const date = new Date(lessonTimestamp(lesson));
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function lessonTimeLabel(lesson: LessonRow) {
  const date = new Date(lessonTimestamp(lesson));
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const styles = StyleSheet.create({
  stack: {
    gap: 8,
  },
  layout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  lessonLibrary: {
    gap: 8,
  },
  lessonRoute: {
    gap: 8,
  },
  lessonRouteHeader: {
    minHeight: 48,
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  lessonRouteTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  lessonFilters: {
    gap: 7,
  },
  filterGroup: {
    gap: 5,
  },
  filterLabelRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterLabel: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  filterPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterPill: {
    minHeight: 30,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterPillActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  filterPillText: {
    color: colors.tealDark,
    fontSize: 11,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  lessonLibraryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lessonLibraryCard: {
    minWidth: 200,
    flex: 1,
    borderRadius: 14,
    padding: 10,
    gap: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#16251f',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  lessonLibraryTop: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  lessonLibraryIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  lessonLibraryTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  lessonLibraryMeta: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  lessonLibraryFooter: {
    minHeight: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  lessonLibraryDate: {
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingTop: 5,
    color: colors.tealDark,
    backgroundColor: colors.softTeal,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  classCard: {
    minWidth: 210,
    flex: 1,
    borderRadius: 14,
    padding: 10,
    gap: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e1e9e3',
    shadowColor: '#16251f',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  classIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  classTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  classStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  classStatPill: {
    minHeight: 34,
    flex: 1,
    minWidth: 92,
    borderRadius: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  classStatValue: {
    color: colors.tealDark,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
  classStatText: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  enterButton: {
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.tealDark,
  },
  enterButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  roomHeader: {
    minHeight: 48,
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#16251f',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  backButton: {
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.softTeal,
  },
  backButtonText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '700',
  },
  roomTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '700',
  },
  roomStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  roomStat: {
    minHeight: 32,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingTop: 7,
    color: colors.tealDark,
    backgroundColor: colors.softTeal,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  roomSectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  roomSectionButton: {
    minHeight: 42,
    minWidth: 104,
    flex: 1,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  roomSectionButtonActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  roomSectionLabel: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  roomSectionLabelActive: {
    color: '#ffffff',
  },
  roomSectionCount: {
    color: colors.tealDark,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  roomSectionCountActive: {
    color: colors.gold,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectCard: {
    minWidth: 150,
    flex: 1,
    borderRadius: 14,
    padding: 10,
    gap: 7,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  subjectCardActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  subjectTitle: {
    flex: 1,
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  subjectTitleActive: {
    color: '#ffffff',
  },
  subjectCount: {
    minWidth: 24,
    minHeight: 24,
    borderRadius: 12,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: colors.tealDark,
    backgroundColor: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  subjectCountActive: {
    color: colors.tealDark,
  },
  subjectTeacher: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectTeacherText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  subjectTeacherTextActive: {
    color: '#ffffff',
  },
  listColumn: {
    flex: 1,
    minWidth: 280,
  },
  detailColumn: {
    flex: 2,
    minWidth: 320,
  },
  lessonLaunch: {
    overflow: 'hidden',
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(24, 36, 33, 0.12)',
    shadowColor: '#05110d',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  launchIntro: {
    minHeight: 54,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.night,
  },
  launchIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal,
  },
  launchIconListening: {
    backgroundColor: colors.coral,
  },
  launchTitle: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  launchMeta: {
    color: '#dce7e1',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  launchFields: {
    padding: 10,
    gap: 8,
  },
  liveControlGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 7,
  },
  listenButton: {
    minHeight: 32,
    borderRadius: 12,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  endLiveButton: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  listenButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  endLiveButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  liveOpenPill: {
    minHeight: 34,
    borderRadius: 13,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  liveOpenPillText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '700',
  },
  listenNotice: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  audioBox: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f7fbf9',
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  audioBoxTitle: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  audioBoxText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  liveWordsBox: {
    borderRadius: 14,
    padding: 10,
    gap: 4,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  liveWordsLabel: {
    color: colors.tealDark,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  liveWordsText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  card: {
    borderRadius: 14,
    padding: 9,
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  teacherReviewCard: {
    backgroundColor: colors.surface,
    borderColor: '#d8eadf',
    shadowColor: '#16251f',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  reviewMeta: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 6,
    color: colors.tealDark,
    backgroundColor: colors.softTeal,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  reviewStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewMetric: {
    minWidth: 92,
    flex: 1,
    borderRadius: 13,
    padding: 8,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e1e9e3',
  },
  reviewMetricValue: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  reviewMetricLabel: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  sectionTitleRow: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  cardBody: {
    color: '#33413b',
    fontSize: 12,
    lineHeight: 17,
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  field: {
    flex: 1,
    minWidth: 180,
    gap: 5,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 9,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 13,
  },
  textarea: {
    minHeight: 68,
    paddingTop: 9,
  },
  submitButton: {
    minHeight: 36,
    borderRadius: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandDeep,
  },
  submitButtonGold: {
    backgroundColor: colors.amber,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recordList: {
    gap: 8,
  },
  lessonRow: {
    minHeight: 50,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e1e9e3',
  },
  lessonRowActive: {
    borderColor: colors.teal,
    backgroundColor: colors.softTeal,
  },
  studyTabs: {
    minHeight: 52,
    borderRadius: 15,
    padding: 5,
    flexDirection: 'row',
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  studyTab: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  studyTabActive: {
    backgroundColor: colors.tealDark,
  },
  studyTabText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '700',
  },
  studyTabTextActive: {
    color: '#ffffff',
  },
  detailMetaRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineTranscript: {
    marginTop: 4,
  },
  warningText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  statusBadge: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#d7e4ef',
  },
  statusBadgePublished: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  statusBadgeLive: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
  statusBadgeReview: {
    backgroundColor: colors.softGold,
    borderColor: '#f2d995',
  },
  statusBadgeFailed: {
    backgroundColor: '#9d2e24',
    borderColor: '#9d2e24',
  },
  statusBadgeText: {
    color: colors.tealDark,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  statusBadgeTextStrong: {
    color: '#ffffff',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  recordTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  recordMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  personalCard: {
    overflow: 'hidden',
    borderRadius: 17,
    padding: 14,
    gap: 12,
    backgroundColor: '#101916',
    borderWidth: 1,
    borderColor: '#20352f',
  },
  personalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  personalIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  personalTitle: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  personalMeta: {
    color: '#dce7e1',
    fontSize: 12,
    lineHeight: 18,
  },
  personalFieldLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  personalInput: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    fontSize: 15,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeCard: {
    minWidth: 120,
    flex: 1,
    minHeight: 53,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  modeCardActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  modeTitle: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  modeTitleActive: {
    color: colors.ink,
  },
  modeBody: {
    color: '#aebcb6',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  modeBodyActive: {
    color: '#4b3a18',
  },
  personalOutput: {
    borderRadius: 15,
    padding: 14,
    gap: 10,
    backgroundColor: '#ffffff',
  },
  personalOutputTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  speechControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speechButtonStrong: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.tealDark,
  },
  speechButtonStrongText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  speechButton: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  speechButtonText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '700',
  },
  speechMessage: {
    color: '#9d2e24',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  personalSummary: {
    color: '#33413b',
    fontSize: 15,
    lineHeight: 21,
  },
  personalBullet: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
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
    fontWeight: '700',
  },
  studyStepText: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
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
    fontWeight: '700',
  },
  vocabMeaning: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  encouragement: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  summaryText: {
    color: '#33413b',
    fontSize: 15,
    lineHeight: 21,
  },
  bulletList: {
    gap: 6,
  },
  aiPointCard: {
    minHeight: 50,
    borderRadius: 16,
    padding: 11,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.softTeal,
  },
  aiPointNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#ffffff',
    backgroundColor: colors.tealDark,
    fontSize: 12,
    fontWeight: '700',
  },
  bulletText: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  showMoreButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    borderRadius: 15,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  showMoreText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  richBold: {
    color: colors.tealDark,
    fontWeight: '700',
  },
  quizCard: {
    borderRadius: 15,
    padding: 12,
    gap: 10,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e1e9e3',
  },
  optionList: {
    gap: 8,
  },
  optionButton: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce7e1',
  },
  optionButtonSelected: {
    borderColor: colors.teal,
    backgroundColor: colors.softTeal,
  },
  optionButtonCorrect: {
    borderColor: colors.tealDark,
    backgroundColor: '#dff2ea',
  },
  optionButtonWrong: {
    borderColor: '#d76659',
    backgroundColor: '#fde8e4',
  },
  optionText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: colors.tealDark,
  },
  resultBox: {
    borderRadius: 15,
    padding: 14,
    backgroundColor: colors.softGold,
    borderWidth: 1,
    borderColor: '#f2d995',
  },
  resultTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  resultText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  insightDashboard: {
    gap: 12,
  },
  insightHero: {
    minHeight: 79,
    borderRadius: 17,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.ink,
  },
  insightHeroIcon: {
    width: 54,
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  insightHeroTitle: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
  },
  insightHeroBody: {
    color: '#dce7e1',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  insightBox: {
    borderRadius: 15,
    padding: 12,
    gap: 10,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#d7e4ef',
  },
  insightStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  insightStat: {
    minWidth: 88,
    flex: 1,
    borderRadius: 15,
    padding: 10,
    backgroundColor: '#ffffff',
  },
  insightValue: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  insightLabel: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  attemptList: {
    gap: 6,
  },
  attemptRow: {
    minHeight: 36,
    borderRadius: 13,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#ffffff',
  },
  attemptName: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  attemptScore: {
    color: colors.tealDark,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  insightLessonList: {
    gap: 10,
  },
  insightLessonCard: {
    minHeight: 59,
    borderRadius: 15,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  insightLessonTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  insightLessonMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  insightStatusPill: {
    minHeight: 34,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softGold,
    borderWidth: 1,
    borderColor: '#f2d995',
  },
  insightStatusPillActive: {
    backgroundColor: colors.softTeal,
    borderColor: '#d4e8df',
  },
  insightStatusText: {
    color: '#6f5520',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  insightStatusTextActive: {
    color: colors.tealDark,
  },
  explanationText: {
    color: colors.tealDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  flashGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  flashCard: {
    minWidth: 180,
    flex: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    backgroundColor: colors.softGold,
  },
  flashCounter: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  flashSessionCard: {
    minHeight: 115,
    borderRadius: 17,
    padding: 14,
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.ink,
  },
  flashFaceLabel: {
    color: colors.gold,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  flashFaceText: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
  },
  flashNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  flashNavButton: {
    minHeight: 42,
    flex: 1,
    minWidth: 96,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  flashNavButtonStrong: {
    minHeight: 42,
    flex: 1,
    minWidth: 96,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  flashNavText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '700',
  },
  flashNavTextStrong: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  successText: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});
