import { ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookOpen, Brain, Headphones, Layers, Link2, Plus, Sparkles, Users, X } from 'lucide-react-native';

import { LessonWorkspace } from '../../lessons/LessonWorkspace';
import { ClassStudyRoom } from './ClassStudyRoom';
import { createClassSubject, createSubject, SchoolSetupState, SubjectRow } from '../../../services/school';
import { colors } from '../../../theme/tokens';
import { ActiveSchoolMembership } from '../../../types';

type SchoolClassRouteScreenProps = {
  classId: string;
  membership: ActiveSchoolMembership;
  setup: SchoolSetupState;
  mode: 'learn' | 'teach';
  onWorkspaceChanged: () => void | Promise<void>;
};

type ClassPanel = 'studio' | 'library' | 'tools';

const tones = [
  { background: '#fff4d4', accent: colors.gold },
  { background: '#e9f6ff', accent: '#4aa6d9' },
  { background: '#f3eaff', accent: '#8d68d8' },
  { background: '#e8f8ee', accent: '#39a96b' },
];

export function SchoolClassRouteScreen({
  classId,
  membership,
  setup,
  mode,
  onWorkspaceChanged,
}: SchoolClassRouteScreenProps) {
  const schoolClass = setup.classes.find((item) => item.id === classId);
  const canManageClass = ['owner', 'admin', 'teacher'].includes(membership.role);
  const [activePanel, setActivePanel] = useState<ClassPanel>(mode === 'teach' ? 'studio' : 'library');
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectDepartment, setSubjectDepartment] = useState('');
  const [subjectSaving, setSubjectSaving] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const classIndex = Math.max(setup.classes.findIndex((item) => item.id === classId), 0);
  const tone = tones[classIndex % tones.length];
  const classSubjects = setup.classSubjects.filter((link) => link.class_id === classId);
  const linkedSubjectIds = useMemo(
    () => new Set(classSubjects.map((link) => link.subject_id)),
    [classSubjects]
  );
  const availableSubjects = setup.subjects.filter((subject) => !linkedSubjectIds.has(subject.id));
  const subjectNames = classSubjects
    .map((link) => setup.subjects.find((subject) => subject.id === link.subject_id)?.name)
    .filter(Boolean) as string[];
  const classMemberCount = setup.classMemberships.filter((item) => item.class_id === classId && item.status === 'active').length;

  async function handleCreateSubject() {
    setSubjectSaving('create');
    setSubjectError(null);

    try {
      const subject = await createSubject({
        schoolId: membership.schoolId,
        name: subjectName,
        department: subjectDepartment,
      });
      await createClassSubject({
        classId,
        subjectId: subject.id,
        teacherMembershipId: canManageClass ? membership.id : null,
      });
      setSubjectName('');
      setSubjectDepartment('');
      setSubjectModalOpen(false);
      await onWorkspaceChanged();
    } catch (caught) {
      setSubjectError(caught instanceof Error ? caught.message : 'Could not create subject.');
    } finally {
      setSubjectSaving(null);
    }
  }

  async function handleAttachSubject(subjectId: string) {
    setSubjectSaving(`attach-${subjectId}`);
    setSubjectError(null);

    try {
      await createClassSubject({
        classId,
        subjectId,
        teacherMembershipId: canManageClass ? membership.id : null,
      });
      await onWorkspaceChanged();
    } catch (caught) {
      setSubjectError(caught instanceof Error ? caught.message : 'Could not attach subject.');
    } finally {
      setSubjectSaving(null);
    }
  }

  return (
    <View style={styles.stack}>
      <View style={[styles.hero, { backgroundColor: tone.background, borderColor: tone.accent }]}>
        <View style={[styles.banner, { backgroundColor: tone.accent }]}>
          {schoolClass?.banner_url ? <Image source={{ uri: schoolClass.banner_url }} style={styles.bannerImage} /> : null}
        </View>

        <View style={styles.heroBody}>
          <View style={[styles.classMark, { backgroundColor: tone.accent }]}>
            {schoolClass?.logo_url ? (
              <Image source={{ uri: schoolClass.logo_url }} style={styles.markImage} />
            ) : (
              <Text style={styles.markText}>{initials(schoolClass?.name ?? 'Class')}</Text>
            )}
          </View>

          <View style={styles.flexText}>
            <View style={styles.heroPill}>
              <Sparkles size={14} color={colors.ink} />
              <Text style={styles.heroPillText}>{mode === 'teach' ? 'Teaching room' : 'Learning room'}</Text>
            </View>
            <Text style={styles.title}>{schoolClass?.name ?? 'Class'}</Text>
            <Text style={styles.meta}>{schoolClass?.grade_level ?? 'Learning group'} - {membership.school.name}</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickGrid}>
        <RoomStat icon={<BookOpen size={19} color={colors.ink} />} label="Subjects" value={subjectNames.length} tone={tones[0]} />
        <RoomStat icon={<Users size={19} color={colors.ink} />} label="Members" value={classMemberCount} tone={tones[3]} />
        <RoomStat icon={<Headphones size={19} color={colors.ink} />} label="Audio" value={1} tone={tones[1]} />
        <RoomStat icon={<Brain size={19} color={colors.ink} />} label="Quiz" value={1} tone={tones[2]} />
      </View>

      <View style={styles.panelRail}>
        <ClassPanelButton
          id="studio"
          activeId={activePanel}
          label="Lesson studio"
          description={mode === 'teach' ? 'Record and prepare' : 'Class lessons'}
          icon={<BookOpen size={18} color={activePanel === 'studio' ? '#ffffff' : colors.tealDark} />}
          onPress={setActivePanel}
        />
        <ClassPanelButton
          id="library"
          activeId={activePanel}
          label="Lesson library"
          description="Published and live"
          icon={<Headphones size={18} color={activePanel === 'library' ? '#ffffff' : colors.tealDark} />}
          onPress={setActivePanel}
        />
        <ClassPanelButton
          id="tools"
          activeId={activePanel}
          label="Class tools"
          description="Chat, voice, AI"
          icon={<Brain size={18} color={activePanel === 'tools' ? '#ffffff' : colors.tealDark} />}
          onPress={setActivePanel}
        />
        {canManageClass ? (
          <Pressable onPress={() => setSubjectModalOpen(true)} style={styles.createSubjectAction}>
            <Plus size={18} color="#ffffff" />
            <Text style={styles.createSubjectText}>Subject</Text>
          </Pressable>
        ) : null}
      </View>

      {activePanel === 'studio' ? (
        <View style={styles.lessonLane}>
        <View style={styles.laneHeader}>
          <View style={styles.laneIcon}>
            <BookOpen size={22} color="#ffffff" />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.laneEyebrow}>Main lesson lane</Text>
            <Text style={styles.laneTitle}>
              {mode === 'teach' ? 'Start, review, and publish lessons' : 'Teacher lessons and learning path'}
            </Text>
          </View>
          <View style={styles.primaryBadge}>
            <Sparkles size={13} color={colors.ink} />
            <Text style={styles.primaryBadgeText}>Primary</Text>
          </View>
        </View>

        <LessonWorkspace
          membership={membership}
          setup={setup}
          onLessonsChanged={onWorkspaceChanged}
          mode={mode}
          initialClassId={classId}
          classPanel="studio"
        />
      </View>
      ) : null}

      {activePanel === 'library' ? (
        <View style={styles.lessonLane}>
          <View style={styles.libraryHeader}>
            <View style={styles.libraryIcon}>
              <Headphones size={22} color={colors.ink} />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.libraryEyebrow}>Lesson library</Text>
              <Text style={styles.libraryTitle}>Published lessons and live sessions</Text>
            </View>
          </View>

          <LessonWorkspace
            membership={membership}
            setup={setup}
            onLessonsChanged={onWorkspaceChanged}
            mode={mode}
            initialClassId={classId}
            classPanel="library"
          />
        </View>
      ) : null}

      {activePanel === 'tools' ? (
        <View style={styles.secondaryLane}>
        <View style={styles.secondaryHeader}>
          <View style={styles.secondaryIcon}>
            <Brain size={22} color={colors.ink} />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.laneEyebrow}>Second lane</Text>
            <Text style={styles.secondaryTitle}>Class tools, study chat, voice notes, and shared AI</Text>
          </View>
        </View>

        <View style={styles.subjectPanel}>
          <View style={styles.panelTitleRow}>
            <Layers size={20} color={colors.coral} />
            <Text style={styles.panelTitle}>Study lanes</Text>
          </View>
          <View style={styles.subjectWrap}>
            {subjectNames.length ? subjectNames.map((subject) => (
              <View key={subject} style={styles.subjectPill}>
                <Text style={styles.subjectText}>{subject}</Text>
              </View>
            )) : (
              <Text style={styles.emptyText}>Subjects will appear after this class is assigned.</Text>
            )}
          </View>
        </View>

        {schoolClass ? (
          <ClassStudyRoom
            classId={schoolClass.id}
            className={schoolClass.name}
            classUsername={schoolClass.username}
            gradeLevel={schoolClass.grade_level}
            setup={setup}
          />
        ) : null}
      </View>
      ) : null}

      <SubjectBuilderModal
        visible={subjectModalOpen}
        subjectName={subjectName}
        subjectDepartment={subjectDepartment}
        availableSubjects={availableSubjects}
        saving={subjectSaving}
        error={subjectError}
        onName={setSubjectName}
        onDepartment={setSubjectDepartment}
        onAttach={handleAttachSubject}
        onCreate={handleCreateSubject}
        onClose={() => {
          setSubjectModalOpen(false);
          setSubjectError(null);
        }}
      />
    </View>
  );
}

export default SchoolClassRouteScreen;

function ClassPanelButton({
  id,
  activeId,
  label,
  description,
  icon,
  onPress,
}: {
  id: ClassPanel;
  activeId: ClassPanel;
  label: string;
  description: string;
  icon: ReactNode;
  onPress: (id: ClassPanel) => void;
}) {
  const active = id === activeId;

  return (
    <Pressable onPress={() => onPress(id)} style={[styles.panelTab, active && styles.panelTabActive]}>
      <View style={[styles.panelTabIcon, active && styles.panelTabIconActive]}>{icon}</View>
      <View style={styles.flexText}>
        <Text style={[styles.panelTabTitle, active && styles.panelTabTitleActive]}>{label}</Text>
        <Text style={[styles.panelTabMeta, active && styles.panelTabMetaActive]}>{description}</Text>
      </View>
    </Pressable>
  );
}

function SubjectBuilderModal({
  visible,
  subjectName,
  subjectDepartment,
  availableSubjects,
  saving,
  error,
  onName,
  onDepartment,
  onAttach,
  onCreate,
  onClose,
}: {
  visible: boolean;
  subjectName: string;
  subjectDepartment: string;
  availableSubjects: SubjectRow[];
  saving: string | null;
  error: string | null;
  onName: (value: string) => void;
  onDepartment: (value: string) => void;
  onAttach: (subjectId: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIcon}>
              <Layers size={22} color="#ffffff" />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.modalTitle}>Class subjects</Text>
              <Text style={styles.modalMeta}>Create a new subject or attach one already in this school.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <X size={18} color={colors.tealDark} />
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.modalGrid}>
            <View style={styles.modalPanel}>
              <View style={styles.modalPanelTitleRow}>
                <Plus size={18} color={colors.tealDark} />
                <Text style={styles.modalPanelTitle}>New subject</Text>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Subject name</Text>
                <TextInput
                  value={subjectName}
                  onChangeText={onName}
                  placeholder="Mathematics"
                  placeholderTextColor="#87938e"
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Department</Text>
                <TextInput
                  value={subjectDepartment}
                  onChangeText={onDepartment}
                  placeholder="Science"
                  placeholderTextColor="#87938e"
                  style={styles.input}
                />
              </View>
              <Pressable
                disabled={saving === 'create' || !subjectName.trim()}
                onPress={onCreate}
                style={[styles.primaryAction, (saving === 'create' || !subjectName.trim()) && styles.disabledAction]}
              >
                {saving === 'create' ? <ActivityIndicator color="#ffffff" /> : <Plus size={17} color="#ffffff" />}
                <Text style={styles.primaryActionText}>Create and attach</Text>
              </Pressable>
            </View>

            <View style={styles.modalPanel}>
              <View style={styles.modalPanelTitleRow}>
                <Link2 size={18} color={colors.tealDark} />
                <Text style={styles.modalPanelTitle}>Attach existing</Text>
              </View>
              {availableSubjects.length ? (
                <View style={styles.attachList}>
                  {availableSubjects.map((subject) => (
                    <View key={subject.id} style={styles.attachItem}>
                      <View style={styles.flexText}>
                        <Text style={styles.attachTitle}>{subject.name}</Text>
                        <Text style={styles.attachMeta}>{subject.department ?? 'No department'}</Text>
                      </View>
                      <Pressable
                        disabled={saving === `attach-${subject.id}`}
                        onPress={() => onAttach(subject.id)}
                        style={[styles.attachButton, saving === `attach-${subject.id}` && styles.disabledAction]}
                      >
                        {saving === `attach-${subject.id}` ? <ActivityIndicator color={colors.tealDark} /> : <Plus size={15} color={colors.tealDark} />}
                        <Text style={styles.attachButtonText}>Add</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>Every school subject is already attached to this class.</Text>
              )}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RoomStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: { background: string; accent: string };
}) {
  return (
    <View style={[styles.roomStat, { backgroundColor: tone.background, borderColor: tone.accent }]}>
      <View style={[styles.roomStatIcon, { backgroundColor: tone.accent }]}>{icon}</View>
      <Text style={styles.roomStatValue}>{value}</Text>
      <Text style={styles.roomStatLabel}>{label}</Text>
    </View>
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

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  hero: {
    overflow: 'hidden',
    borderRadius: 30,
    borderWidth: 2,
  },
  banner: {
    height: 112,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  heroBody: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  classMark: {
    overflow: 'hidden',
    width: 76,
    height: 76,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  markImage: {
    width: '100%',
    height: '100%',
  },
  markText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  heroPill: {
    alignSelf: 'flex-start',
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
  },
  heroPillText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  panelRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'stretch',
  },
  panelTab: {
    minHeight: 68,
    minWidth: 170,
    flex: 1,
    borderRadius: 22,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  panelTabActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  panelTabIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  panelTabIconActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  panelTabTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  panelTabTitleActive: {
    color: '#ffffff',
  },
  panelTabMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
  },
  panelTabMetaActive: {
    color: '#dce7e1',
  },
  createSubjectAction: {
    minHeight: 68,
    minWidth: 132,
    borderRadius: 22,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.teal,
    borderWidth: 1,
    borderColor: '#1e8f7d',
  },
  createSubjectText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  lessonLane: {
    gap: 12,
  },
  laneHeader: {
    minHeight: 86,
    borderRadius: 26,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0f2d25',
    borderWidth: 1,
    borderColor: '#1e574b',
  },
  laneIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal,
  },
  laneEyebrow: {
    color: colors.gold,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  laneTitle: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  primaryBadge: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.gold,
  },
  primaryBadgeText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  libraryHeader: {
    minHeight: 82,
    borderRadius: 26,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#e9f6ff',
    borderWidth: 1,
    borderColor: '#bce0f4',
  },
  libraryIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4aa6d9',
  },
  libraryEyebrow: {
    color: colors.tealDark,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  libraryTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  secondaryLane: {
    gap: 12,
  },
  secondaryHeader: {
    minHeight: 76,
    borderRadius: 24,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff6da',
    borderWidth: 1,
    borderColor: '#f0d489',
  },
  secondaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  secondaryTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
  },
  roomStat: {
    minWidth: 130,
    flex: 1,
    borderRadius: 22,
    padding: 13,
    gap: 6,
    borderWidth: 2,
  },
  roomStatIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomStatValue: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  roomStatLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  subjectPanel: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  panelTitleRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  panelAction: {
    marginLeft: 'auto',
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.tealDark,
  },
  panelActionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  subjectWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectPill: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  subjectText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(7, 12, 10, 0.6)',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
    borderRadius: 28,
    padding: 16,
    gap: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
  },
  modalMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modalPanel: {
    flex: 1,
    minWidth: 260,
    borderRadius: 22,
    padding: 14,
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalPanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalPanelTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    backgroundColor: '#f8fbf9',
    borderWidth: 1,
    borderColor: colors.line,
  },
  primaryAction: {
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.tealDark,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  disabledAction: {
    opacity: 0.55,
  },
  attachList: {
    gap: 8,
  },
  attachItem: {
    minHeight: 60,
    borderRadius: 18,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  attachTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  attachMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
  },
  attachButton: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
  },
  attachButtonText: {
    color: colors.tealDark,
    fontSize: 11,
    fontWeight: '900',
  },
  errorText: {
    color: colors.coral,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '900',
  },
});
