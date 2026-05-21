export type UserRole = 'student' | 'teacher' | 'school_admin' | 'owner' | 'guardian';

export type SchoolMembershipRole = 'owner' | 'admin' | 'teacher' | 'student' | 'guardian';

export type MembershipStatus = 'active' | 'invited' | 'review' | 'suspended';

export type LearningMode = 'simple' | 'balanced' | 'exam' | 'story' | 'catch_up';

export type LessonStatus = 'draft' | 'recording' | 'uploaded' | 'transcribing' | 'review' | 'published' | 'failed';

export type ProcessingStatus = 'queued' | 'running' | 'completed' | 'failed';

export type ChainName = 'solana' | 'base' | 'bnb';

export type CrewScope = 'school' | 'cross_school';

export type CrewRole = 'owner' | 'moderator' | 'member';

export type Surface = 'learning' | 'school_console';

export type LearningTab = 'learn' | 'teach' | 'crews';

export type ConsoleSection = 'overview' | 'setup' | 'people' | 'academics' | 'billing' | 'controls';

export type StudentPreference = {
  language: string;
  level: string;
  mode: LearningMode;
  audioEnabled: boolean;
};

export type SchoolWorkspace = {
  id: string;
  name: string;
  city: string;
  country: string;
  adminName: string;
  subscriptionStatus: string;
  inviteCode: string;
  privacyRule: string;
  activeTerm: string;
  externalCrewsAllowed: boolean;
};

export type AcademicTerm = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'planned' | 'active' | 'closed';
};

export type Subject = {
  id: string;
  name: string;
  department: string;
};

export type Classroom = {
  id: string;
  name: string;
  subject: string;
  gradeLevel: string;
  teacherName: string;
  studentCount: number;
  completionRate: number;
  inviteCode: string;
  currentLessonId: string;
};

export type SchoolMember = {
  id: string;
  name: string;
  role: SchoolMembershipRole;
  className: string;
  language: string;
  status: MembershipStatus;
};

export type SchoolInvite = {
  id: string;
  code: string;
  role: SchoolMembershipRole;
  className?: string;
  expiresAt: string;
  uses: number;
};

export type JoinRequest = {
  id: string;
  name: string;
  requestedRole: SchoolMembershipRole;
  className: string;
  requestedAt: string;
};

export type Lesson = {
  id: string;
  title: string;
  subject: string;
  teacherName: string;
  className: string;
  duration: string;
  status: LessonStatus;
  summary: string;
  keyPoints: string[];
  quiz: string[];
};

export type LessonMode = {
  id: LearningMode;
  label: string;
  title: string;
  body: string;
};

export type PersonalizedLesson = {
  lessonId: string;
  studentName: string;
  streakDays: number;
  confidence: number;
  weakSpot: string;
  dailyChallenge: string;
  modes: LessonMode[];
};

export type ProcessingJob = {
  id: string;
  lessonTitle: string;
  status: ProcessingStatus;
  step: string;
  provider: 'gemini';
};

export type LessonCrew = {
  id: string;
  name: string;
  ownerName: string;
  scope: CrewScope;
  memberCount: number;
  activeLesson: string;
  sharedItems: number;
  nextSession: string;
  role: CrewRole;
};

export type SchoolPlan = {
  plan: string;
  students: number;
  monthlyUsd: number;
  acceptedChains: ChainName[];
};

export type SchoolAnalytics = {
  activeStudents: number;
  weeklyLessons: number;
  pendingApprovals: number;
  averageCompletion: number;
  atRiskStudents: number;
};

export type ActiveSchoolMembership = {
  id: string;
  schoolId: string;
  role: SchoolMembershipRole;
  status: MembershipStatus;
  school: {
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    subscriptionStatus: string | null;
    externalCrewsAllowed: boolean | null;
  };
};
