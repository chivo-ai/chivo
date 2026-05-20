import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileAudio,
  GraduationCap,
  Headphones,
  Languages,
  LockKeyhole,
  Mic,
  PauseCircle,
  PlayCircle,
  Plus,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  WalletCards,
} from 'lucide-react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { ReactNode, useMemo, useState } from 'react';

import {
  classrooms,
  featuredLesson,
  lessonCrews,
  members,
  personalizedLesson,
  schoolPlan,
  schoolWorkspace,
  studentPreference,
  workflow,
} from './src/lib/demoData';
import { hasSupabaseConfig } from './src/lib/config';

type WorkspaceTab = 'student' | 'teacher' | 'admin' | 'crews';

const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'student', label: 'Learn' },
  { id: 'teacher', label: 'Teach' },
  { id: 'admin', label: 'Admin' },
  { id: 'crews', label: 'Crews' },
];

const colors = {
  ink: '#182421',
  muted: '#63706c',
  paper: '#fffdf8',
  canvas: '#f7f3ea',
  line: '#dde5df',
  teal: '#117865',
  tealDark: '#0c5b4e',
  gold: '#f4b740',
  blue: '#315f8c',
  coral: '#e85d4f',
  mint: '#dcefe9',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('student');
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const { width } = useWindowDimensions();
  const isWide = width >= 1040;
  const isCompact = width < 700;

  const recordingTime = useMemo(
    () => formatDuration(recorderState.durationMillis),
    [recorderState.durationMillis]
  );

  async function handleRecordPress() {
    if (recorderState.isRecording) {
      await recorder.stop();
      setLastRecordingUri(recorder.uri ?? recorderState.url);
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone needed', 'Chivo AI needs microphone access to record lessons.');
      return;
    }

    await recorder.prepareToRecordAsync();
    recorder.record();
    setLastRecordingUri(null);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.shell}>
          <TopBar isCompact={isCompact} />

          {!isWide && (
            <WorkspaceTabs activeTab={activeTab} onChange={setActiveTab} compact={isCompact} />
          )}

          <View style={[styles.workspace, isWide && styles.workspaceWide]}>
            {isWide && (
              <View style={styles.navColumn}>
                <SchoolIdentity />
                <WorkspaceTabs activeTab={activeTab} onChange={setActiveTab} vertical />
                <BoundaryPanel />
              </View>
            )}

            <View style={styles.mainColumn}>
              {activeTab === 'student' && <StudentView />}
              {activeTab === 'teacher' && (
                <TeacherView
                  isRecording={recorderState.isRecording}
                  recordingTime={recordingTime}
                  recordingUri={lastRecordingUri}
                  onRecordPress={handleRecordPress}
                />
              )}
              {activeTab === 'admin' && <AdminView />}
              {activeTab === 'crews' && <CrewsView />}
            </View>

            <View style={styles.sideColumn}>
              <WorkflowPanel />
              <GeminiPanel />
              {!isWide && <BoundaryPanel />}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function TopBar({ isCompact }: { isCompact: boolean }) {
  return (
    <View style={[styles.topBar, isCompact && styles.topBarCompact]}>
      <View style={styles.brandMark}>
        <Sparkles size={24} color="#ffffff" strokeWidth={2.5} />
      </View>
      <View style={styles.brandCopy}>
        <Text style={styles.brandName}>Chivo AI</Text>
        <Text style={styles.brandMeta}>Every class becomes a personal lesson.</Text>
      </View>
      <View style={styles.syncPill}>
        <ShieldCheck size={16} color={colors.teal} />
        <Text style={styles.syncText}>{hasSupabaseConfig ? 'Cloud ready' : 'Workspace mode'}</Text>
      </View>
    </View>
  );
}

type WorkspaceTabsProps = {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  compact?: boolean;
  vertical?: boolean;
};

function WorkspaceTabs({ activeTab, onChange, compact, vertical }: WorkspaceTabsProps) {
  return (
    <View style={[styles.tabs, vertical && styles.tabsVertical]}>
      {workspaceTabs.map((tab) => {
        const selected = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, vertical && styles.tabVertical, selected && styles.tabActive]}
          >
            <TabIcon id={tab.id} selected={selected} />
            <Text style={[styles.tabText, selected && styles.tabTextActive]} numberOfLines={1}>
              {compact ? tab.label : tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabIcon({ id, selected }: { id: WorkspaceTab; selected: boolean }) {
  const color = selected ? '#ffffff' : colors.muted;
  if (id === 'student') {
    return <GraduationCap size={18} color={color} />;
  }
  if (id === 'teacher') {
    return <BookOpen size={18} color={color} />;
  }
  if (id === 'admin') {
    return <Building2 size={18} color={color} />;
  }
  return <Users size={18} color={color} />;
}

function SchoolIdentity() {
  return (
    <View style={styles.identityPanel}>
      <View style={styles.identityIcon}>
        <Building2 size={25} color={colors.tealDark} />
      </View>
      <Text style={styles.identityName}>{schoolWorkspace.name}</Text>
      <Text style={styles.identityMeta}>
        {schoolWorkspace.city}, {schoolWorkspace.country}
      </Text>
      <View style={styles.inviteStrip}>
        <QrCode size={16} color={colors.tealDark} />
        <Text style={styles.inviteText}>{schoolWorkspace.inviteCode}</Text>
      </View>
    </View>
  );
}

function StudentView() {
  const [activeMode, setActiveMode] = useState(personalizedLesson.modes[1].id);
  const selectedMode =
    personalizedLesson.modes.find((mode) => mode.id === activeMode) ?? personalizedLesson.modes[0];

  return (
    <View style={styles.stack}>
      <LinearGradient colors={['#fff7df', '#dcefe9']} style={styles.heroPanel}>
        <View style={styles.panelHeader}>
          <View style={styles.flexText}>
            <Text style={styles.eyebrow}>Student space</Text>
            <Text style={styles.heroTitle}>Welcome back, {personalizedLesson.studentName}</Text>
          </View>
          <View style={styles.roundIconGold}>
            <Headphones size={24} color={colors.ink} />
          </View>
        </View>

        <Text style={styles.heroBody}>{personalizedLesson.dailyChallenge}</Text>

        <View style={styles.metricGrid}>
          <Metric label="Study streak" value={`${personalizedLesson.streakDays} days`} tone="gold" />
          <Metric label="Confidence" value={`${personalizedLesson.confidence}%`} tone="teal" />
          <Metric label="Needs practice" value={personalizedLesson.weakSpot} tone="blue" />
        </View>
      </LinearGradient>

      <View style={styles.card}>
        <View style={styles.panelHeader}>
          <View style={styles.flexText}>
            <Text style={styles.eyebrow}>Personal lesson</Text>
            <Text style={styles.title}>{featuredLesson.title}</Text>
          </View>
          <Languages size={25} color={colors.coral} />
        </View>

        <View style={styles.modeTabs}>
          {personalizedLesson.modes.map((mode) => {
            const selected = mode.id === selectedMode.id;
            return (
              <Pressable
                key={mode.id}
                onPress={() => setActiveMode(mode.id)}
                style={[styles.modeTab, selected && styles.modeTabActive]}
              >
                <Text style={[styles.modeTabText, selected && styles.modeTabTextActive]}>
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.lessonFocus}>
          <Text style={styles.sectionTitle}>{selectedMode.title}</Text>
          <Text style={styles.summaryText}>{selectedMode.body}</Text>
        </View>

        <View style={styles.actionRow}>
          <PrimaryAction icon={<PlayCircle size={18} color="#ffffff" />} label="Listen" />
          <SecondaryAction icon={<Brain size={18} color={colors.tealDark} />} label="Quiz me" />
          <SecondaryAction icon={<Send size={18} color={colors.tealDark} />} label="Ask lesson" />
        </View>

        <View style={styles.preferenceRow}>
          <Chip label={studentPreference.language} />
          <Chip label={studentPreference.level} />
          <Chip label={studentPreference.mode} />
          <Chip label={studentPreference.audioEnabled ? 'Audio on' : 'Text only'} />
        </View>
      </View>

      <View style={[styles.twoColumn, styles.twoColumnResponsive]}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Key points</Text>
          {featuredLesson.keyPoints.map((point) => (
            <Bullet key={point} text={point} />
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Practice quiz</Text>
            <Brain size={23} color={colors.blue} />
          </View>
          {featuredLesson.quiz.map((question, index) => (
            <Question key={question} index={index + 1} text={question} />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.panelHeader}>
          <View style={styles.flexText}>
            <Text style={styles.eyebrow}>Crew activity</Text>
            <Text style={styles.sectionTitle}>{lessonCrews[0].name}</Text>
          </View>
          <Users size={24} color={colors.teal} />
        </View>
        <Text style={styles.summaryText}>
          {lessonCrews[0].memberCount} classmates are revising this lesson together. Shared
          materials stay separate from private school records.
        </Text>
      </View>
    </View>
  );
}

type TeacherViewProps = {
  isRecording: boolean;
  recordingTime: string;
  recordingUri: string | null;
  onRecordPress: () => void;
};

function TeacherView({ isRecording, recordingTime, recordingUri, onRecordPress }: TeacherViewProps) {
  const currentClass = classrooms[0];

  return (
    <View style={styles.stack}>
      <LinearGradient colors={['#dcefe9', '#fff7df']} style={styles.recordPanel}>
        <View style={styles.panelHeader}>
          <View style={styles.flexText}>
            <Text style={styles.eyebrow}>Teacher console</Text>
            <Text style={styles.heroTitle}>Record today&apos;s lesson</Text>
          </View>
          <View style={[styles.statusBadge, isRecording && styles.statusBadgeLive]}>
            <Text style={[styles.statusBadgeText, isRecording && styles.statusBadgeTextLive]}>
              {isRecording ? 'Live' : 'Ready'}
            </Text>
          </View>
        </View>

        <View style={styles.recorderRow}>
          <Pressable
            onPress={onRecordPress}
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          >
            {isRecording ? (
              <PauseCircle size={34} color="#ffffff" strokeWidth={2.3} />
            ) : (
              <Mic size={34} color="#ffffff" strokeWidth={2.3} />
            )}
          </Pressable>
          <View style={styles.recorderCopy}>
            <Text style={styles.timerText}>{recordingTime}</Text>
            <Text style={styles.mutedText}>
              {isRecording ? 'Capturing classroom audio' : `${currentClass.name} is selected`}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <PrimaryAction icon={<Send size={18} color="#ffffff" />} label="Process lesson" />
          <SecondaryAction icon={<FileAudio size={18} color={colors.tealDark} />} label="Save audio" />
        </View>

        <Text style={styles.recordingPath} numberOfLines={1}>
          {recordingUri ?? 'A saved recording will appear here after class.'}
        </Text>
      </LinearGradient>

      <View style={styles.card}>
        <View style={styles.panelHeader}>
          <View style={styles.flexText}>
            <Text style={styles.eyebrow}>Class session</Text>
            <Text style={styles.title}>{currentClass.name}</Text>
          </View>
          <BookOpen size={24} color={colors.blue} />
        </View>
        <View style={styles.metricGrid}>
          <Metric label="Subject" value={currentClass.subject} tone="blue" />
          <Metric label="Teacher" value={currentClass.teacherName} tone="teal" />
          <Metric label="Students" value={String(currentClass.studentCount)} tone="gold" />
        </View>
      </View>

      <View style={[styles.twoColumn, styles.twoColumnResponsive]}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Publish checklist</Text>
          {[
            'Create master summary',
            'Generate learning modes',
            'Translate for student settings',
            'Prepare quiz and flashcards',
          ].map((item) => (
            <CheckRow key={item} text={item} />
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Class signals</Text>
            <BarChart3 size={23} color={colors.coral} />
          </View>
          <Progress label="Opened latest lesson" value={currentClass.completionRate} />
          <Progress label="Completed quiz" value={58} />
          <Progress label="Needs review" value={32} inverse />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Students needing attention</Text>
          <Users size={24} color={colors.teal} />
        </View>
        {members
          .filter((member) => member.role === 'student')
          .slice(0, 3)
          .map((member) => (
            <MemberRow key={member.id} name={member.name} meta={member.className} status={member.status} />
          ))}
      </View>
    </View>
  );
}

function AdminView() {
  const pendingMembers = members.filter((member) => member.status !== 'active');

  return (
    <View style={styles.stack}>
      <LinearGradient colors={['#fffdf8', '#dcefe9']} style={styles.heroPanel}>
        <View style={styles.panelHeader}>
          <View style={styles.flexText}>
            <Text style={styles.eyebrow}>School admin</Text>
            <Text style={styles.heroTitle}>{schoolWorkspace.name}</Text>
          </View>
          <View style={styles.roundIconTeal}>
            <ShieldCheck size={24} color="#ffffff" />
          </View>
        </View>
        <Text style={styles.heroBody}>{schoolWorkspace.privacyRule}</Text>
        <View style={styles.metricGrid}>
          <Metric label="Students" value={String(schoolPlan.students)} tone="teal" />
          <Metric label="Classes" value={String(classrooms.length)} tone="blue" />
          <Metric label="Plan" value={`$${schoolPlan.monthlyUsd}/mo`} tone="gold" />
        </View>
      </LinearGradient>

      <View style={styles.card}>
        <View style={styles.panelHeader}>
          <View style={styles.flexText}>
            <Text style={styles.eyebrow}>Account flow</Text>
            <Text style={styles.sectionTitle}>Bring a school online</Text>
          </View>
          <UserPlus size={24} color={colors.teal} />
        </View>
        <View style={styles.flowGrid}>
          <FlowStep index="1" title="Create school" text="Open a private workspace for one school." />
          <FlowStep index="2" title="Form classes" text="Add classes, subjects, teachers, and join codes." />
          <FlowStep index="3" title="Invite people" text="Teachers and students join through approved links or codes." />
          <FlowStep index="4" title="Approve access" text="Students see only the school and classes they belong to." />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Admin actions</Text>
          <ClipboardList size={24} color={colors.blue} />
        </View>
        <View style={styles.actionRow}>
          <PrimaryAction icon={<Plus size={18} color="#ffffff" />} label="Create class" />
          <SecondaryAction icon={<UserPlus size={18} color={colors.tealDark} />} label="Invite student" />
          <SecondaryAction icon={<QrCode size={18} color={colors.tealDark} />} label="Show code" />
          <SecondaryAction icon={<WalletCards size={18} color={colors.tealDark} />} label="Billing" />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Classes</Text>
          <BookOpen size={24} color={colors.teal} />
        </View>
        {classrooms.map((classroom) => (
          <ClassRow key={classroom.id} classroom={classroom} />
        ))}
      </View>

      <View style={[styles.twoColumn, styles.twoColumnResponsive]}>
        <View style={styles.card}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Approval queue</Text>
            <Text style={styles.countBadge}>{pendingMembers.length}</Text>
          </View>
          {pendingMembers.map((member) => (
            <MemberRow key={member.id} name={member.name} meta={member.className} status={member.status} />
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Payment rails</Text>
            <CircleDollarSign size={24} color={colors.teal} />
          </View>
          <View style={styles.chainGrid}>
            {schoolPlan.acceptedChains.map((chain) => (
              <View key={chain} style={styles.chainTile}>
                <Text style={styles.chainName}>{chain.toUpperCase()}</Text>
                <Text style={styles.chainMeta}>school billing</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function CrewsView() {
  return (
    <View style={styles.stack}>
      <LinearGradient colors={['#fff7df', '#ffffff']} style={styles.heroPanel}>
        <View style={styles.panelHeader}>
          <View style={styles.flexText}>
            <Text style={styles.eyebrow}>Lesson crews</Text>
            <Text style={styles.heroTitle}>Study together without mixing school records</Text>
          </View>
          <View style={styles.roundIconCoral}>
            <Users size={24} color="#ffffff" />
          </View>
        </View>
        <Text style={styles.heroBody}>
          Students can form invite-only study groups. Official school lessons remain private unless
          a school allows a shareable study version.
        </Text>
        <View style={styles.actionRow}>
          <PrimaryAction icon={<Plus size={18} color="#ffffff" />} label="Create crew" />
          <SecondaryAction icon={<QrCode size={18} color={colors.tealDark} />} label="Join with code" />
        </View>
      </LinearGradient>

      <View style={styles.crewGrid}>
        {lessonCrews.map((crew) => (
          <View key={crew.id} style={styles.crewCard}>
            <View style={styles.panelHeader}>
              <View style={styles.flexText}>
                <Text style={styles.eyebrow}>{crew.scope === 'school' ? 'School crew' : 'Cross-school crew'}</Text>
                <Text style={styles.sectionTitle}>{crew.name}</Text>
              </View>
              <Users size={24} color={crew.scope === 'school' ? colors.teal : colors.coral} />
            </View>
            <Text style={styles.summaryText}>{crew.activeLesson}</Text>
            <View style={styles.metricGrid}>
              <Metric label="Members" value={String(crew.memberCount)} tone="teal" />
              <Metric label="Shared items" value={String(crew.sharedItems)} tone="gold" />
              <Metric label="Next session" value={crew.nextSession} tone="blue" />
            </View>
            <Text style={styles.mutedText}>Hosted by {crew.ownerName}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Crew safeguards</Text>
          <LockKeyhole size={23} color={colors.teal} />
        </View>
        <Bullet text="A school lesson can stay private while a student shares a separate revision prompt." />
        <Bullet text="Cross-school crews use invite codes and member approvals." />
        <Bullet text="School admins can disable external crew sharing for their workspace." />
      </View>
    </View>
  );
}

function WorkflowPanel() {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Lesson pipeline</Text>
      <View style={styles.timeline}>
        {workflow.map((item, index) => (
          <View key={item} style={styles.timelineItem}>
            <View style={styles.timelineIndex}>
              <Text style={styles.timelineIndexText}>{index + 1}</Text>
            </View>
            <Text style={styles.timelineText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function GeminiPanel() {
  return (
    <View style={styles.card}>
      <View style={styles.panelHeader}>
        <Text style={styles.sectionTitle}>Lesson intelligence</Text>
        <Sparkles size={23} color={colors.gold} />
      </View>
      <CheckRow text="Gemini creates transcripts, summaries, quizzes, and flashcards." />
      <CheckRow text="Student versions follow language, level, audio, and exam settings." />
      <CheckRow text="AI keys stay on the server side of the lesson pipeline." />
    </View>
  );
}

function BoundaryPanel() {
  return (
    <View style={styles.card}>
      <View style={styles.panelHeader}>
        <Text style={styles.sectionTitle}>Privacy wall</Text>
        <LockKeyhole size={23} color={colors.teal} />
      </View>
      <Text style={styles.summaryText}>
        Every class, lesson, member, and payment belongs to a school workspace. Crews are separate
        invite-only spaces.
      </Text>
    </View>
  );
}

type ActionProps = {
  icon: ReactNode;
  label: string;
};

function PrimaryAction({ icon, label }: ActionProps) {
  return (
    <Pressable style={styles.primaryAction}>
      {icon}
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryAction({ icon, label }: ActionProps) {
  return (
    <Pressable style={styles.secondaryAction}>
      {icon}
      <Text style={styles.secondaryActionText}>{label}</Text>
    </Pressable>
  );
}

type MetricProps = {
  label: string;
  value: string;
  tone?: 'teal' | 'gold' | 'blue';
};

function Metric({ label, value, tone = 'teal' }: MetricProps) {
  return (
    <View style={[styles.metric, tone === 'gold' && styles.metricGold, tone === 'blue' && styles.metricBlue]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function Question({ index, text }: { index: number; text: string }) {
  return (
    <View style={styles.questionRow}>
      <Text style={styles.questionIndex}>{index}</Text>
      <Text style={styles.questionText}>{text}</Text>
    </View>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <View style={styles.checkRow}>
      <CheckCircle2 size={18} color={colors.teal} />
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

function Progress({ label, value, inverse }: { label: string; value: number; inverse?: boolean }) {
  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressLabelRow}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{value}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${value}%`, backgroundColor: inverse ? colors.coral : colors.teal },
          ]}
        />
      </View>
    </View>
  );
}

function FlowStep({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <View style={styles.flowStep}>
      <View style={styles.flowIndex}>
        <Text style={styles.flowIndexText}>{index}</Text>
      </View>
      <Text style={styles.flowTitle}>{title}</Text>
      <Text style={styles.flowText}>{text}</Text>
    </View>
  );
}

function ClassRow({ classroom }: { classroom: (typeof classrooms)[number] }) {
  return (
    <View style={styles.classRow}>
      <View style={styles.classIcon}>
        <BookOpen size={18} color={colors.blue} />
      </View>
      <View style={styles.flexText}>
        <Text style={styles.className}>{classroom.name}</Text>
        <Text style={styles.mutedText}>
          {classroom.subject} with {classroom.teacherName}
        </Text>
      </View>
      <View style={styles.classCode}>
        <Text style={styles.classCodeText}>{classroom.inviteCode}</Text>
      </View>
    </View>
  );
}

function MemberRow({
  name,
  meta,
  status,
}: {
  name: string;
  meta: string;
  status: 'active' | 'invited' | 'review';
}) {
  const label = status === 'active' ? 'Active' : status === 'invited' ? 'Invited' : 'Review';

  return (
    <View style={styles.memberRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{name.slice(0, 1)}</Text>
      </View>
      <View style={styles.flexText}>
        <Text style={styles.memberName}>{name}</Text>
        <Text style={styles.mutedText}>{meta}</Text>
      </View>
      <View style={[styles.smallBadge, status === 'review' && styles.smallBadgeWarm]}>
        <Text style={[styles.smallBadgeText, status === 'review' && styles.smallBadgeTextWarm]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.select({ web: 24, default: 54 }),
    paddingBottom: 30,
  },
  shell: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    gap: 18,
  },
  topBar: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBarCompact: {
    flexWrap: 'wrap',
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  brandCopy: {
    flex: 1,
    minWidth: 190,
  },
  brandName: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  brandMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  syncPill: {
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.mint,
  },
  syncText: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
  },
  workspace: {
    gap: 16,
  },
  workspaceWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  navColumn: {
    width: 230,
    gap: 14,
  },
  mainColumn: {
    flex: 1,
    gap: 16,
    minWidth: 0,
  },
  sideColumn: {
    gap: 16,
  },
  tabs: {
    minHeight: 54,
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 18,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabsVertical: {
    minHeight: 0,
    flexDirection: 'column',
  },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 8,
  },
  tabVertical: {
    flex: 0,
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
  },
  tabActive: {
    backgroundColor: colors.tealDark,
  },
  tabText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  identityPanel: {
    borderRadius: 20,
    padding: 16,
    gap: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  identityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
  },
  identityName: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  identityMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  inviteStrip: {
    minHeight: 34,
    marginTop: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#edf6f2',
  },
  inviteText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
  stack: {
    gap: 16,
  },
  heroPanel: {
    borderRadius: 24,
    padding: 20,
    gap: 18,
    borderWidth: 1,
    borderColor: '#e2dccd',
  },
  recordPanel: {
    borderRadius: 24,
    padding: 20,
    gap: 18,
    borderWidth: 1,
    borderColor: '#cfded8',
  },
  card: {
    borderRadius: 20,
    padding: 18,
    gap: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  panelHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: 4,
  },
  heroBody: {
    color: '#3a463f',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 720,
  },
  title: {
    color: colors.ink,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  roundIconGold: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  roundIconTeal: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal,
  },
  roundIconCoral: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coral,
  },
  statusBadge: {
    minHeight: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  statusBadgeLive: {
    backgroundColor: colors.coral,
  },
  statusBadgeText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  statusBadgeTextLive: {
    color: '#ffffff',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    minWidth: 136,
    flex: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#edf6f2',
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  metricGold: {
    backgroundColor: '#fff4d4',
    borderColor: '#f2dda0',
  },
  metricBlue: {
    backgroundColor: '#edf3f8',
    borderColor: '#d7e2ec',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    marginTop: 6,
  },
  modeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeTab: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ee',
  },
  modeTabActive: {
    backgroundColor: colors.tealDark,
  },
  modeTabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  modeTabTextActive: {
    color: '#ffffff',
  },
  lessonFocus: {
    gap: 8,
    paddingVertical: 2,
  },
  summaryText: {
    color: '#33413b',
    fontSize: 15,
    lineHeight: 23,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryAction: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.tealDark,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryAction: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#edf6f2',
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  secondaryActionText: {
    color: colors.tealDark,
    fontSize: 14,
    fontWeight: '900',
  },
  preferenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff4d4',
  },
  chipText: {
    color: '#654b19',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  twoColumn: {
    gap: 16,
  },
  twoColumnResponsive: {
    flexDirection: Platform.select({ web: 'row', default: 'column' }),
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    backgroundColor: colors.teal,
  },
  bulletText: {
    flex: 1,
    color: '#33413b',
    fontSize: 15,
    lineHeight: 22,
  },
  questionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  questionIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    textAlign: 'center',
    lineHeight: 30,
    color: '#ffffff',
    fontWeight: '900',
    backgroundColor: colors.blue,
  },
  questionText: {
    flex: 1,
    color: '#33413b',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  recorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  recordButton: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  recordButtonActive: {
    backgroundColor: colors.coral,
  },
  recorderCopy: {
    flex: 1,
    minWidth: 0,
  },
  timerText: {
    color: colors.ink,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  recordingPath: {
    color: '#6d5a41',
    fontSize: 12,
  },
  checkRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkText: {
    flex: 1,
    color: '#33413b',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  progressBlock: {
    gap: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  progressLabel: {
    color: '#33413b',
    fontSize: 13,
    fontWeight: '800',
  },
  progressValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e4e9e4',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  flowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  flowStep: {
    minWidth: 150,
    flex: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    backgroundColor: '#f5f8f4',
    borderWidth: 1,
    borderColor: colors.line,
  },
  flowIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  flowIndexText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  flowTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  flowText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  classRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  classIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf3f8',
  },
  className: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  classCode: {
    minHeight: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff4d4',
  },
  classCodeText: {
    color: '#654b19',
    fontSize: 12,
    fontWeight: '900',
  },
  memberRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  memberName: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  smallBadge: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
  },
  smallBadgeWarm: {
    backgroundColor: '#fff0cc',
  },
  smallBadgeText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  smallBadgeTextWarm: {
    color: '#76510c',
  },
  countBadge: {
    minWidth: 32,
    minHeight: 32,
    borderRadius: 16,
    textAlign: 'center',
    lineHeight: 32,
    color: '#ffffff',
    fontWeight: '900',
    backgroundColor: colors.coral,
  },
  chainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chainTile: {
    minWidth: 106,
    flex: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#f5f8f4',
    borderWidth: 1,
    borderColor: colors.line,
  },
  chainName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  chainMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 5,
  },
  crewGrid: {
    gap: 16,
    flexDirection: Platform.select({ web: 'row', default: 'column' }),
  },
  crewCard: {
    flex: 1,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  timeline: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timelineIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf3f8',
  },
  timelineIndexText: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: '900',
  },
  timelineText: {
    flex: 1,
    color: '#33413b',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
