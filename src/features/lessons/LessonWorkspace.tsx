import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BookOpen, Brain, CheckCircle2, ClipboardList, Layers, Sparkles } from 'lucide-react-native';

import {
  LessonDetail,
  LessonRow,
  createLesson,
  fetchLessonDetail,
  fetchLessons,
  processLesson,
  publishLesson,
} from '../../services/lessons';
import { ClassRow, ClassSubjectRow, SchoolSetupState, SubjectRow } from '../../services/school';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership } from '../../types';

type LessonWorkspaceProps = {
  membership: ActiveSchoolMembership;
  setup: SchoolSetupState;
  onLessonsChanged?: () => void;
};

export function LessonWorkspace({ membership, setup, onLessonsChanged }: LessonWorkspaceProps) {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [detail, setDetail] = useState<LessonDetail | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('English');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(setup.classes[0]?.id ?? null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(setup.subjects[0]?.id ?? null);
  const [transcript, setTranscript] = useState('');

  const isTeacher = ['owner', 'admin', 'teacher'].includes(membership.role);
  const teacherMembershipId = setup.members.find((member) => member.id === membership.id)?.id ?? membership.id;

  const visibleClasses = useMemo(() => {
    if (isTeacher) {
      return setup.classes;
    }

    const classIds = setup.classMemberships
      .filter((item) => item.school_membership_id === membership.id && item.status === 'active')
      .map((item) => item.class_id);

    return setup.classes.filter((schoolClass) => classIds.includes(schoolClass.id));
  }, [isTeacher, membership.id, setup.classMemberships, setup.classes]);

  useEffect(() => {
    loadLessons();
  }, [membership.schoolId]);

  useEffect(() => {
    if (!selectedClassId && visibleClasses[0]) {
      setSelectedClassId(visibleClasses[0].id);
    }
  }, [selectedClassId, visibleClasses]);

  async function loadLessons() {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchLessons(membership.schoolId, isTeacher);
      setLessons(rows);
      const firstLessonId = selectedLessonId ?? rows[0]?.id ?? null;
      setSelectedLessonId(firstLessonId);
      if (firstLessonId) {
        await loadLessonDetail(firstLessonId);
      } else {
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
      setDetail(await fetchLessonDetail(lessonId));
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
      const lessonId = await createLesson({
        schoolId: membership.schoolId,
        classId: selectedClassId ?? '',
        subjectId: selectedSubjectId,
        teacherMembershipId,
        title,
        language,
        transcript,
      });
      setTitle('');
      setTranscript('');
      setMessage('Lesson added. Run AI when ready.');
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

  async function handleProcessLesson(lessonId: string) {
    setSaving(`process-${lessonId}`);
    setError(null);
    setMessage(null);
    try {
      await processLesson(lessonId);
      setMessage('AI study pack generated.');
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

  return (
    <View style={styles.stack}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {message ? <Text style={styles.successText}>{message}</Text> : null}

      {isTeacher ? (
        <View style={styles.card}>
          <SectionTitle icon={<Sparkles size={22} color={colors.teal} />} title="Create lesson" />
          <Text style={styles.cardBody}>
            Paste a class transcript now. Audio recording will use the same lesson pipeline when added.
          </Text>
          <Field label="Lesson title" value={title} onChangeText={setTitle} placeholder="Photosynthesis recap" />
          <View style={styles.formRow}>
            <Picker
              label="Class"
              emptyText="Create a class first."
              items={visibleClasses}
              selectedId={selectedClassId}
              getLabel={(item) => item.name}
              onSelect={setSelectedClassId}
            />
            <Picker
              label="Subject"
              emptyText="Add a subject first."
              items={subjectsForClass(setup.classSubjects, setup.subjects, selectedClassId)}
              selectedId={selectedSubjectId}
              getLabel={(item) => item.name}
              onSelect={setSelectedSubjectId}
            />
          </View>
          <Field label="Language" value={language} onChangeText={setLanguage} placeholder="English" />
          <Field
            label="Transcript"
            value={transcript}
            onChangeText={setTranscript}
            placeholder="Paste the lesson transcript or teacher notes here"
            multiline
          />
          <SubmitButton
            label="Save lesson"
            loading={saving === 'create'}
            onPress={handleCreateLesson}
            disabled={!selectedClassId}
          />
        </View>
      ) : null}

      <View style={styles.layout}>
        <View style={styles.listColumn}>
          <View style={styles.card}>
            <SectionTitle icon={<BookOpen size={22} color={colors.blue} />} title="Lessons" />
            {loading ? (
              <ActivityIndicator color={colors.tealDark} />
            ) : lessons.length ? (
              <View style={styles.recordList}>
                {lessons.map((lesson) => (
                  <Pressable
                    key={lesson.id}
                    onPress={() => loadLessonDetail(lesson.id)}
                    style={[styles.lessonRow, lesson.id === selectedLessonId && styles.lessonRowActive]}
                  >
                    <View style={styles.flexText}>
                      <Text style={styles.recordTitle}>{lesson.title}</Text>
                      <Text style={styles.recordMeta}>
                        {className(setup.classes, lesson.class_id)} - {subjectName(setup.subjects, lesson.subject_id)} - {formatStatus(lesson.status)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.cardBody}>
                {isTeacher ? 'Create your first lesson to generate a study pack.' : 'Published class lessons will appear here.'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.detailColumn}>
          {loadingDetail ? (
            <View style={styles.card}>
              <ActivityIndicator color={colors.tealDark} />
            </View>
          ) : detail ? (
            <LessonDetailView
              detail={detail}
              isTeacher={isTeacher}
              saving={saving}
              onProcess={handleProcessLesson}
              onPublish={handlePublishLesson}
            />
          ) : (
            <View style={styles.card}>
              <SectionTitle icon={<Brain size={22} color={colors.gold} />} title="Study pack" />
              <Text style={styles.cardBody}>Select a lesson to view its AI summary, quiz, and flashcards.</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function LessonDetailView({
  detail,
  isTeacher,
  saving,
  onProcess,
  onPublish,
}: {
  detail: LessonDetail;
  isTeacher: boolean;
  saving: string | null;
  onProcess: (lessonId: string) => void;
  onPublish: (lessonId: string) => void;
}) {
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <SectionTitle icon={<Brain size={22} color={colors.gold} />} title={detail.lesson.title} />
        <Text style={styles.cardBody}>
          {formatStatus(detail.lesson.status)} - {detail.lesson.language}
        </Text>
        {isTeacher ? (
          <View style={styles.actionRow}>
            <SubmitButton
              label="Run AI"
              loading={saving === `process-${detail.lesson.id}`}
              onPress={() => onProcess(detail.lesson.id)}
            />
            <SubmitButton
              label="Publish"
              loading={saving === `publish-${detail.lesson.id}`}
              onPress={() => onPublish(detail.lesson.id)}
              disabled={!detail.output}
              tone="gold"
            />
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<ClipboardList size={22} color={colors.teal} />} title="Summary" />
        <Text style={styles.summaryText}>{detail.output?.summary ?? 'AI summary is not ready yet.'}</Text>
        {detail.output?.key_points?.length ? (
          <View style={styles.bulletList}>
            {detail.output.key_points.map((point, index) => (
              <Text key={`${point}-${index}`} style={styles.bulletText}>- {point}</Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<CheckCircle2 size={22} color={colors.blue} />} title="Quiz" />
        {detail.questions.length ? (
          <View style={styles.recordList}>
            {detail.questions.map((question) => (
              <View key={question.id} style={styles.quizCard}>
                <Text style={styles.recordTitle}>{question.position}. {question.prompt}</Text>
                {question.options.map((option) => (
                  <Text key={option} style={styles.recordMeta}>{option}</Text>
                ))}
                {question.explanation ? <Text style={styles.explanationText}>{question.explanation}</Text> : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.cardBody}>Quiz questions will appear after AI processing.</Text>
        )}
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<Layers size={22} color={colors.coral} />} title="Flashcards" />
        {detail.flashcards.length ? (
          <View style={styles.flashGrid}>
            {detail.flashcards.map((card) => (
              <View key={card.id} style={styles.flashCard}>
                <Text style={styles.recordTitle}>{card.front}</Text>
                <Text style={styles.recordMeta}>{card.back}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.cardBody}>Flashcards will appear after AI processing.</Text>
        )}
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

function Picker<T extends { id: string }>({
  label,
  emptyText,
  items,
  selectedId,
  getLabel,
  onSelect,
}: {
  label: string;
  emptyText: string;
  items: T[];
  selectedId: string | null;
  getLabel: (item: T) => string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.length ? (
        <View style={styles.pillRow}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item.id)}
              style={[styles.choicePill, selectedId === item.id && styles.choicePillActive]}
            >
              <Text style={[styles.choicePillText, selectedId === item.id && styles.choicePillTextActive]}>
                {getLabel(item)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>{emptyText}</Text>
      )}
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

function subjectsForClass(classSubjects: ClassSubjectRow[], subjects: SubjectRow[], classId: string | null) {
  if (!classId) {
    return subjects;
  }

  const subjectIds = classSubjects.filter((item) => item.class_id === classId).map((item) => item.subject_id);
  const filtered = subjects.filter((subject) => subjectIds.includes(subject.id));
  return filtered.length ? filtered : subjects;
}

function className(classes: ClassRow[], classId: string) {
  return classes.find((item) => item.id === classId)?.name ?? 'Class';
}

function subjectName(subjects: SubjectRow[], subjectId: string | null) {
  return subjects.find((item) => item.id === subjectId)?.name ?? 'No subject';
}

function formatStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  layout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  listColumn: {
    flex: 1,
    minWidth: 280,
  },
  detailColumn: {
    flex: 2,
    minWidth: 320,
  },
  card: {
    borderRadius: 22,
    padding: 18,
    gap: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sectionTitleRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  cardBody: {
    color: '#33413b',
    fontSize: 14,
    lineHeight: 21,
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  field: {
    flex: 1,
    minWidth: 180,
    gap: 7,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.ink,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 15,
  },
  textarea: {
    minHeight: 140,
    paddingTop: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  choicePillActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  choicePillText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  choicePillTextActive: {
    color: '#ffffff',
  },
  submitButton: {
    minHeight: 46,
    borderRadius: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  submitButtonGold: {
    backgroundColor: colors.gold,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.55,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recordList: {
    gap: 8,
  },
  lessonRow: {
    minHeight: 58,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  recordTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },
  recordMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  summaryText: {
    color: '#33413b',
    fontSize: 15,
    lineHeight: 23,
  },
  bulletList: {
    gap: 6,
  },
  bulletText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  quizCard: {
    borderRadius: 15,
    padding: 12,
    gap: 6,
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#e1e9e3',
  },
  explanationText: {
    color: colors.tealDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
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
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  successText: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
});
