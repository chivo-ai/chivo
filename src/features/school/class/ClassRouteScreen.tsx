import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookOpen, Brain, Headphones, Layers, Link2, Plus, Sparkles, UserMinus, UserPlus, Users, X } from 'lucide-react-native';

import { LessonWorkspace } from '../../lessons/LessonWorkspace';
import { ClassStudyRoom } from './ClassStudyRoom';
import {
  assignMemberToClass,
  createClassSubject,
  createSubject,
  removeMemberFromClass,
  SchoolMemberRow,
  SchoolSetupState,
  SubjectRow,
} from '../../../services/school';
import { colors } from '../../../theme/tokens';
import { ActiveSchoolMembership } from '../../../types';

type SchoolClassRouteScreenProps = {
  classId: string;
  membership: ActiveSchoolMembership;
  setup: SchoolSetupState;
  mode: 'learn' | 'teach';
  initialPanel?: ClassPanel;
  openSubjectSetup?: boolean;
  onWorkspaceChanged: () => void | Promise<void>;
};

type ClassPanel = 'studio' | 'library' | 'people' | 'tools';

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
  initialPanel,
  openSubjectSetup,
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
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [rosterSaving, setRosterSaving] = useState<string | null>(null);
  const [rosterMessage, setRosterMessage] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const openedSetupRef = useRef(false);
  const classIndex = Math.max(setup.classes.findIndex((item) => item.id === classId), 0);
  const tone = tones[classIndex % tones.length];
  const classSubjects = setup.classSubjects.filter((link) => link.class_id === classId);
  const activeClassMemberships = setup.classMemberships.filter((item) => item.class_id === classId && item.status === 'active');
  const classMemberIds = new Set(activeClassMemberships.map((item) => item.school_membership_id));
  const availableMembers = setup.members.filter((member) => member.status === 'active' && !classMemberIds.has(member.id));
  const linkedSubjectIds = useMemo(
    () => new Set(classSubjects.map((link) => link.subject_id)),
    [classSubjects]
  );
  const availableSubjects = setup.subjects.filter((subject) => !linkedSubjectIds.has(subject.id));
  const subjectNames = classSubjects
    .map((link) => setup.subjects.find((subject) => subject.id === link.subject_id)?.name)
    .filter(Boolean) as string[];
  const classMemberCount = activeClassMemberships.length;
  const classRoster = activeClassMemberships.map((classMembership) => {
    const member = setup.members.find((item) => item.id === classMembership.school_membership_id);
    return {
      id: classMembership.id,
      name: member?.profiles?.full_name || formatRole(classMembership.role),
      language: member?.profiles?.preferred_language || 'Language not set',
      role: classMembership.role,
      status: member?.status ?? classMembership.status,
    };
  });
  const panelItems = mode === 'teach'
    ? [
        {
          id: 'studio' as ClassPanel,
          label: 'Teach',
          description: 'Record and publish',
          icon: <BookOpen size={17} color={activePanel === 'studio' ? '#ffffff' : colors.tealDark} />,
        },
        {
          id: 'library' as ClassPanel,
          label: 'Lessons',
          description: 'Published and live',
          icon: <Headphones size={17} color={activePanel === 'library' ? '#ffffff' : colors.tealDark} />,
        },
        {
          id: 'people' as ClassPanel,
          label: 'Students',
          description: 'Roster and access',
          icon: <Users size={17} color={activePanel === 'people' ? '#ffffff' : colors.tealDark} />,
        },
        {
          id: 'tools' as ClassPanel,
          label: 'Tools',
          description: 'Chat, voice, AI',
          icon: <Brain size={17} color={activePanel === 'tools' ? '#ffffff' : colors.tealDark} />,
        },
      ]
    : [
        {
          id: 'studio' as ClassPanel,
          label: 'Learn',
          description: 'Start lessons',
          icon: <BookOpen size={17} color={activePanel === 'studio' ? '#ffffff' : colors.tealDark} />,
        },
        {
          id: 'library' as ClassPanel,
          label: 'Library',
          description: 'All lessons',
          icon: <Headphones size={17} color={activePanel === 'library' ? '#ffffff' : colors.tealDark} />,
        },
        {
          id: 'people' as ClassPanel,
          label: 'Practice',
          description: 'Quiz and cards',
          icon: <Sparkles size={17} color={activePanel === 'people' ? '#ffffff' : colors.tealDark} />,
        },
        {
          id: 'tools' as ClassPanel,
          label: 'Class',
          description: 'Chat and voice',
          icon: <Brain size={17} color={activePanel === 'tools' ? '#ffffff' : colors.tealDark} />,
        },
      ];

  useEffect(() => {
    if (selectedMemberId && availableMembers.some((member) => member.id === selectedMemberId)) {
      return;
    }

    setSelectedMemberId(availableMembers[0]?.id ?? null);
  }, [availableMembers, selectedMemberId]);

  useEffect(() => {
    if (initialPanel) {
      setActivePanel(initialPanel);
    }
  }, [initialPanel]);

  useEffect(() => {
    if (!openSubjectSetup || !canManageClass || openedSetupRef.current) {
      return;
    }

    openedSetupRef.current = true;
    setSubjectModalOpen(true);
  }, [canManageClass, openSubjectSetup]);

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
      if (mode === 'teach') {
        setActivePanel('studio');
      }
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
      if (mode === 'teach') {
        setSubjectModalOpen(false);
        setActivePanel('studio');
      }
    } catch (caught) {
      setSubjectError(caught instanceof Error ? caught.message : 'Could not attach subject.');
    } finally {
      setSubjectSaving(null);
    }
  }

  async function handleAddMember() {
    const member = setup.members.find((item) => item.id === selectedMemberId);
    setRosterSaving('add-member');
    setRosterMessage(null);
    setRosterError(null);

    try {
      await assignMemberToClass({
        classId,
        schoolMembershipId: member?.id ?? '',
        role: member?.role ?? 'student',
      });
      setRosterMessage('Member added to this class.');
      await onWorkspaceChanged();
    } catch (caught) {
      setRosterError(caught instanceof Error ? caught.message : 'Could not add this member.');
    } finally {
      setRosterSaving(null);
    }
  }

  async function handleRemoveMember(classMembershipId: string) {
    setRosterSaving(`remove-${classMembershipId}`);
    setRosterMessage(null);
    setRosterError(null);

    try {
      await removeMemberFromClass(classMembershipId);
      setRosterMessage('Member removed from this class.');
      await onWorkspaceChanged();
    } catch (caught) {
      setRosterError(caught instanceof Error ? caught.message : 'Could not remove this member.');
    } finally {
      setRosterSaving(null);
    }
  }

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        {schoolClass?.banner_url ? <Image source={{ uri: schoolClass.banner_url }} style={styles.heroImage} /> : null}
        <View style={styles.heroShade} />
        <View style={styles.heroBody}>
          <View style={[styles.classMark, { backgroundColor: tone.accent, borderColor: tone.background }]}>
            {schoolClass?.logo_url ? (
              <Image source={{ uri: schoolClass.logo_url }} style={styles.markImage} />
            ) : (
              <Text style={styles.markText}>{initials(schoolClass?.name ?? 'Class')}</Text>
            )}
          </View>

          <View style={styles.flexText}>
            <View style={styles.heroPill}>
              <Sparkles size={12} color={colors.ink} />
              <Text style={styles.heroPillText}>{mode === 'teach' ? 'Teacher studio' : 'Student classroom'}</Text>
            </View>
            <Text style={styles.title}>{schoolClass?.name ?? 'Class'}</Text>
            <Text style={styles.meta}>{schoolClass?.grade_level ?? 'Learning group'} - {membership.school.name}</Text>
            <View style={styles.classChips}>
              <Text style={styles.classChip}>{subjectNames.length} subjects</Text>
              <Text style={styles.classChip}>{classMemberCount} members</Text>
              <Text style={styles.classChip}>{schoolClass?.username ?? 'class'}</Text>
            </View>
          </View>

        </View>

        <View style={styles.subjectStrip}>
          {subjectNames.length ? subjectNames.slice(0, 6).map((subject) => (
            <View key={subject} style={styles.heroSubjectPill}>
              <Text style={styles.heroSubjectText}>{subject}</Text>
            </View>
          )) : (
            <Text style={styles.heroEmptyText}>No subjects yet. Add subjects to organize lessons.</Text>
          )}
        </View>
      </View>

      <ClassControlCenter
        mode={mode}
        subjectCount={subjectNames.length}
        memberCount={classMemberCount}
        canManage={canManageClass}
        activePanel={activePanel}
        onOpenStudio={() => {
          if (mode === 'teach' && !subjectNames.length) {
            setSubjectModalOpen(true);
            return;
          }

          setActivePanel(mode === 'teach' ? 'studio' : 'library');
        }}
        onOpenLibrary={() => setActivePanel('library')}
        onOpenPeople={() => setActivePanel('people')}
        onOpenTools={() => setActivePanel('tools')}
        onSetup={() => setSubjectModalOpen(true)}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.panelScroller} contentContainerStyle={styles.panelRail}>
        {panelItems.map((item) => (
          <ClassPanelButton
            key={item.id}
            id={item.id}
            activeId={activePanel}
            label={item.label}
            description={item.description}
            icon={item.icon}
            onPress={setActivePanel}
          />
        ))}
        {canManageClass ? (
          <Pressable onPress={() => setSubjectModalOpen(true)} style={styles.createSubjectAction}>
            <Plus size={18} color="#ffffff" />
            <Text style={styles.createSubjectText}>Setup</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {activePanel === 'studio' ? (
        <View style={styles.lessonLane}>
        <View style={styles.laneHeader}>
          <View style={styles.laneIcon}>
            <BookOpen size={22} color="#ffffff" />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.laneEyebrow}>{mode === 'teach' ? 'Live teaching console' : 'Class lesson space'}</Text>
            <Text style={styles.laneTitle}>
              {mode === 'teach' ? 'Record, prepare, and publish lessons' : 'Start with published lessons'}
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
          classPanel={mode === 'teach' ? 'studio' : 'library'}
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

      {activePanel === 'people' ? (
        mode === 'teach' ? (
          <ClassRosterPanel
            className={schoolClass?.name ?? 'Class'}
            roster={classRoster}
            availableMembers={availableMembers}
            selectedMemberId={selectedMemberId}
            saving={rosterSaving}
            message={rosterMessage}
            error={rosterError}
            subjectCount={subjectNames.length}
            canManage={canManageClass}
            onSetup={() => setSubjectModalOpen(true)}
            onSelectMember={setSelectedMemberId}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
          />
        ) : (
          <StudentPracticePanel
            subjectNames={subjectNames}
            classMemberCount={classMemberCount}
            onOpenLibrary={() => setActivePanel('library')}
            onOpenTools={() => setActivePanel('tools')}
          />
        )
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

function ClassControlCenter({
  mode,
  subjectCount,
  memberCount,
  canManage,
  activePanel,
  onOpenStudio,
  onOpenLibrary,
  onOpenPeople,
  onOpenTools,
  onSetup,
}: {
  mode: 'learn' | 'teach';
  subjectCount: number;
  memberCount: number;
  canManage: boolean;
  activePanel: ClassPanel;
  onOpenStudio: () => void;
  onOpenLibrary: () => void;
  onOpenPeople: () => void;
  onOpenTools: () => void;
  onSetup: () => void;
}) {
  const teacherMode = mode === 'teach';

  return (
    <View style={styles.commandCenter}>
      <Pressable onPress={onOpenStudio} style={[styles.missionCard, teacherMode ? styles.teacherMission : styles.studentMission]}>
        <View style={styles.missionIcon}>
          {teacherMode ? <BookOpen size={20} color="#ffffff" /> : <Headphones size={20} color="#ffffff" />}
        </View>
        <View style={styles.flexText}>
          <Text style={styles.missionEyebrow}>{teacherMode ? 'Teacher next step' : 'Student next step'}</Text>
          <Text style={styles.missionTitle}>
            {teacherMode ? (subjectCount ? 'Record the next lesson' : 'Add a subject first') : 'Open published lessons'}
          </Text>
          <Text style={styles.missionMeta}>
            {teacherMode ? `${subjectCount} subjects ready - ${memberCount} class members` : 'Listen, read, translate, quiz, and revise'}
          </Text>
        </View>
      </Pressable>

      <View style={styles.commandGrid}>
        <ControlCard
          active={activePanel === 'library'}
          icon={<Headphones size={17} color={activePanel === 'library' ? '#ffffff' : colors.tealDark} />}
          title={teacherMode ? 'Published' : 'Lessons'}
          meta={teacherMode ? 'Live and published' : 'Study library'}
          onPress={onOpenLibrary}
        />
        <ControlCard
          active={activePanel === 'people'}
          icon={<Users size={17} color={activePanel === 'people' ? '#ffffff' : colors.tealDark} />}
          title={teacherMode ? 'Students' : 'Practice'}
          meta={teacherMode ? `${memberCount} active` : 'Quiz and cards'}
          onPress={onOpenPeople}
        />
        <ControlCard
          active={activePanel === 'tools'}
          icon={<Brain size={17} color={activePanel === 'tools' ? '#ffffff' : colors.tealDark} />}
          title="Tools"
          meta="Chat, voice, AI"
          onPress={onOpenTools}
        />
        {canManage ? (
          <ControlCard
            active={false}
            icon={<Layers size={17} color={colors.tealDark} />}
            title="Subject"
            meta={subjectCount ? `${subjectCount} linked` : 'Setup needed'}
            onPress={onSetup}
          />
        ) : null}
      </View>
    </View>
  );
}

function ControlCard({
  active,
  icon,
  title,
  meta,
  onPress,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.controlCard, active && styles.controlCardActive]}>
      <View style={[styles.controlIcon, active && styles.controlIconActive]}>{icon}</View>
      <View style={styles.flexText}>
        <Text style={[styles.controlTitle, active && styles.controlTextActive]}>{title}</Text>
        <Text style={[styles.controlMeta, active && styles.controlMetaActive]}>{meta}</Text>
      </View>
    </Pressable>
  );
}

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

function ClassRosterPanel({
  className,
  roster,
  availableMembers,
  selectedMemberId,
  saving,
  message,
  error,
  subjectCount,
  canManage,
  onSetup,
  onSelectMember,
  onAddMember,
  onRemoveMember,
}: {
  className: string;
  roster: Array<{ id: string; name: string; language: string; role: string; status: string }>;
  availableMembers: SchoolMemberRow[];
  selectedMemberId: string | null;
  saving: string | null;
  message: string | null;
  error: string | null;
  subjectCount: number;
  canManage: boolean;
  onSetup: () => void;
  onSelectMember: (id: string) => void;
  onAddMember: () => void;
  onRemoveMember: (id: string) => void;
}) {
  return (
    <View style={styles.rosterPanel}>
      <View style={styles.rosterHeader}>
        <View style={styles.rosterIcon}>
          <Users size={19} color="#ffffff" />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.rosterEyebrow}>Class roster</Text>
          <Text style={styles.rosterTitle}>{className}</Text>
        </View>
        <Pressable onPress={onSetup} style={styles.rosterAction}>
          <Plus size={15} color={colors.ink} />
          <Text style={styles.rosterActionText}>Subject</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.successText}>{message}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.rosterStats}>
        <View style={styles.compactStat}>
          <Text style={styles.compactStatValue}>{roster.length}</Text>
          <Text style={styles.compactStatLabel}>Students</Text>
        </View>
        <View style={styles.compactStat}>
          <Text style={styles.compactStatValue}>{subjectCount}</Text>
          <Text style={styles.compactStatLabel}>Subjects</Text>
        </View>
      </View>

      <View style={styles.rosterList}>
        {roster.length ? roster.map((member) => (
          <View key={member.id} style={styles.rosterItem}>
            <View style={styles.rosterAvatar}>
              <Text style={styles.rosterAvatarText}>{initials(member.name)}</Text>
            </View>
            <View style={styles.flexText}>
              <Text style={styles.rosterName}>{member.name}</Text>
              <Text style={styles.rosterMeta}>{formatRole(member.role)} - {member.language}</Text>
            </View>
            {canManage ? (
              <Pressable
                disabled={saving === `remove-${member.id}`}
                onPress={() => onRemoveMember(member.id)}
                style={styles.rosterRemove}
              >
                {saving === `remove-${member.id}` ? (
                  <ActivityIndicator color={colors.tealDark} />
                ) : (
                  <>
                    <UserMinus size={14} color={colors.tealDark} />
                    <Text style={styles.rosterRemoveText}>Remove</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Text style={styles.rosterStatus}>{member.status}</Text>
            )}
          </View>
        )) : (
          <Text style={styles.emptyText}>No active students in this class yet.</Text>
        )}
      </View>

      {canManage ? (
        <View style={styles.addMemberPanel}>
          <View style={styles.addMemberHeader}>
            <UserPlus size={17} color={colors.tealDark} />
            <Text style={styles.addMemberTitle}>Add school member</Text>
          </View>
          <View style={styles.memberChoiceWrap}>
            {availableMembers.length ? availableMembers.map((member) => {
              const active = member.id === selectedMemberId;
              const label = member.profiles?.full_name || formatRole(member.role);

              return (
                <Pressable
                  key={member.id}
                  onPress={() => onSelectMember(member.id)}
                  style={[styles.memberChoice, active && styles.memberChoiceActive]}
                >
                  <Text style={[styles.memberChoiceText, active && styles.memberChoiceTextActive]} numberOfLines={1}>{label}</Text>
                  <Text style={[styles.memberChoiceMeta, active && styles.memberChoiceTextActive]}>{formatRole(member.role)}</Text>
                </Pressable>
              );
            }) : (
              <Text style={styles.emptyText}>Every active school member is already in this class.</Text>
            )}
          </View>
          <Pressable
            disabled={!selectedMemberId || saving === 'add-member'}
            onPress={onAddMember}
            style={[styles.addMemberButton, (!selectedMemberId || saving === 'add-member') && styles.disabledAction]}
          >
            {saving === 'add-member' ? <ActivityIndicator color="#ffffff" /> : <UserPlus size={16} color="#ffffff" />}
            <Text style={styles.addMemberButtonText}>Add to class</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function StudentPracticePanel({
  subjectNames,
  classMemberCount,
  onOpenLibrary,
  onOpenTools,
}: {
  subjectNames: string[];
  classMemberCount: number;
  onOpenLibrary: () => void;
  onOpenTools: () => void;
}) {
  return (
    <View style={styles.practicePanel}>
      <View style={styles.practiceHeader}>
        <View style={styles.practiceIcon}>
          <Sparkles size={19} color={colors.ink} />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.practiceEyebrow}>Practice lane</Text>
          <Text style={styles.practiceTitle}>Review the lesson, then quiz yourself</Text>
        </View>
      </View>

      <View style={styles.practiceGrid}>
        <Pressable onPress={onOpenLibrary} style={styles.practiceCard}>
          <BookOpen size={18} color={colors.tealDark} />
          <Text style={styles.practiceCardTitle}>Open lessons</Text>
          <Text style={styles.practiceCardMeta}>Listen, read, cards, quiz</Text>
        </Pressable>
        <Pressable onPress={onOpenTools} style={styles.practiceCard}>
          <Brain size={18} color={colors.tealDark} />
          <Text style={styles.practiceCardTitle}>Study together</Text>
          <Text style={styles.practiceCardMeta}>{classMemberCount} classmates available</Text>
        </Pressable>
      </View>

      <View style={styles.subjectWrap}>
        {subjectNames.length ? subjectNames.slice(0, 8).map((subject) => (
          <View key={subject} style={styles.subjectPill}>
            <Text style={styles.subjectText}>{subject}</Text>
          </View>
        )) : (
          <Text style={styles.emptyText}>Your teacher has not attached subjects yet.</Text>
        )}
      </View>
    </View>
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

function formatRole(value: string) {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  stack: {
    gap: 8,
  },
  hero: {
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 16,
    backgroundColor: colors.night,
    borderWidth: 1,
    borderColor: 'rgba(25, 209, 163, 0.22)',
  },
  heroImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.26,
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 21, 17, 0.82)',
  },
  heroBody: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  classMark: {
    overflow: 'hidden',
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  markImage: {
    width: '100%',
    height: '100%',
  },
  markText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  heroPill: {
    alignSelf: 'flex-start',
    minHeight: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.gold,
  },
  heroPillText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  meta: {
    color: '#d9e5de',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  classChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  classChip: {
    minHeight: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    paddingTop: 4,
    color: '#e9f4ef',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  heroAction: {
    minHeight: 34,
    borderRadius: 13,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.gold,
  },
  heroActionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  subjectStrip: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heroSubjectPill: {
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroSubjectText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  heroEmptyText: {
    color: '#d9e5de',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  commandCenter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    alignItems: 'stretch',
  },
  missionCard: {
    flex: 1.15,
    minWidth: 240,
    minHeight: 72,
    borderRadius: 15,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
  },
  teacherMission: {
    backgroundColor: colors.brandDeep,
    borderColor: '#1d6f5f',
  },
  studentMission: {
    backgroundColor: '#123047',
    borderColor: '#245372',
  },
  missionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal,
  },
  missionEyebrow: {
    color: colors.gold,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  missionTitle: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  missionMeta: {
    color: '#dce7e1',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  commandGrid: {
    flex: 1,
    minWidth: 270,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  controlCard: {
    minWidth: 118,
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  controlCardActive: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandDeep,
  },
  controlIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  controlIconActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  controlTitle: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  controlMeta: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  controlTextActive: {
    color: '#ffffff',
  },
  controlMetaActive: {
    color: '#dce7e1',
  },
  panelScroller: {
    maxHeight: 42,
  },
  panelRail: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    alignItems: 'stretch',
    paddingVertical: 2,
  },
  panelTab: {
    minHeight: 36,
    minWidth: 108,
    borderRadius: 13,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  panelTabActive: {
    backgroundColor: colors.brandDeep,
    borderColor: colors.brandDeep,
  },
  panelTabIcon: {
    width: 26,
    height: 26,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  panelTabIconActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  panelTabTitle: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  panelTabTitleActive: {
    color: '#ffffff',
  },
  panelTabMeta: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600',
  },
  panelTabMetaActive: {
    color: '#dce7e1',
  },
  createSubjectAction: {
    minHeight: 36,
    minWidth: 88,
    borderRadius: 13,
    paddingHorizontal: 10,
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
    fontSize: 12,
    fontWeight: '700',
  },
  lessonLane: {
    gap: 8,
  },
  laneHeader: {
    minHeight: 52,
    borderRadius: 15,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: '#1d6f5f',
  },
  laneIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal,
  },
  laneEyebrow: {
    color: colors.gold,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  laneTitle: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  primaryBadge: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.gold,
  },
  primaryBadgeText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  libraryHeader: {
    minHeight: 50,
    borderRadius: 15,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#e9f6ff',
    borderWidth: 1,
    borderColor: '#bce0f4',
  },
  libraryIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4aa6d9',
  },
  libraryEyebrow: {
    color: colors.tealDark,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  libraryTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  secondaryLane: {
    gap: 8,
  },
  secondaryHeader: {
    minHeight: 50,
    borderRadius: 15,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#fff6da',
    borderWidth: 1,
    borderColor: '#f0d489',
  },
  secondaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  secondaryTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  roomStat: {
    minWidth: 130,
    flex: 1,
    borderRadius: 17,
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
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
  },
  roomStatLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  subjectPanel: {
    borderRadius: 15,
    padding: 10,
    gap: 8,
    backgroundColor: colors.surface,
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
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
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
    fontWeight: '700',
  },
  subjectWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectPill: {
    minHeight: 30,
    borderRadius: 14,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  subjectText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  rosterPanel: {
    borderRadius: 16,
    padding: 11,
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  rosterHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  rosterIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  rosterEyebrow: {
    color: colors.tealDark,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  rosterTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  rosterAction: {
    minHeight: 32,
    borderRadius: 14,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.gold,
  },
  rosterActionText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  rosterStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactStat: {
    minWidth: 120,
    flex: 1,
    borderRadius: 14,
    padding: 9,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  compactStatValue: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '700',
  },
  compactStatLabel: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  rosterList: {
    gap: 7,
  },
  rosterItem: {
    minHeight: 50,
    borderRadius: 14,
    padding: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#f8fbf9',
    borderWidth: 1,
    borderColor: colors.line,
  },
  rosterAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal,
  },
  rosterAvatarText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  rosterName: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  rosterMeta: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  rosterStatus: {
    overflow: 'hidden',
    borderRadius: 11,
    paddingHorizontal: 7,
    paddingVertical: 4,
    color: colors.tealDark,
    backgroundColor: colors.softTeal,
    fontSize: 10,
    fontWeight: '700',
  },
  rosterRemove: {
    minHeight: 30,
    borderRadius: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.softGold,
  },
  rosterRemoveText: {
    color: colors.tealDark,
    fontSize: 10,
    fontWeight: '700',
  },
  addMemberPanel: {
    borderRadius: 15,
    padding: 10,
    gap: 9,
    backgroundColor: '#f8fbf9',
    borderWidth: 1,
    borderColor: colors.line,
  },
  addMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  addMemberTitle: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  memberChoiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  memberChoice: {
    minWidth: 112,
    flex: 1,
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  memberChoiceActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  memberChoiceText: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  memberChoiceMeta: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  memberChoiceTextActive: {
    color: '#ffffff',
  },
  addMemberButton: {
    minHeight: 38,
    borderRadius: 13,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.tealDark,
  },
  addMemberButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  practicePanel: {
    borderRadius: 16,
    padding: 11,
    gap: 10,
    backgroundColor: '#fff8e3',
    borderWidth: 1,
    borderColor: '#efd58f',
  },
  practiceHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  practiceIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  practiceEyebrow: {
    color: colors.tealDark,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  practiceTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  practiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  practiceCard: {
    minWidth: 160,
    flex: 1,
    borderRadius: 15,
    padding: 10,
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  practiceCardTitle: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  practiceCardMeta: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(7, 12, 10, 0.6)',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
    borderRadius: 20,
    padding: 12,
    gap: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
  },
  modalMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalPanel: {
    flex: 1,
    minWidth: 260,
    borderRadius: 17,
    padding: 14,
    gap: 10,
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
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: '#f8fbf9',
    borderWidth: 1,
    borderColor: colors.line,
  },
  primaryAction: {
    minHeight: 48,
    borderRadius: 15,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.tealDark,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  disabledAction: {
    opacity: 0.55,
  },
  attachList: {
    gap: 8,
  },
  attachItem: {
    minHeight: 52,
    borderRadius: 15,
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
    fontWeight: '700',
  },
  attachMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
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
    fontWeight: '700',
  },
  errorText: {
    color: colors.coral,
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
