export type UserRole = 'student' | 'teacher' | 'school';

export type LearningMode = 'simple' | 'balanced' | 'exam';

export type LessonStatus = 'draft' | 'recording' | 'processing' | 'ready';

export type ChainName = 'solana' | 'base' | 'bnb';

export type MemberStatus = 'active' | 'invited' | 'review';

export type CrewScope = 'school' | 'cross_school';

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
  role: UserRole;
  className: string;
  language: string;
  status: MemberStatus;
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
  id: LearningMode | 'story' | 'catch_up';
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

export type LessonCrew = {
  id: string;
  name: string;
  ownerName: string;
  scope: CrewScope;
  memberCount: number;
  activeLesson: string;
  sharedItems: number;
  nextSession: string;
};

export type SchoolPlan = {
  plan: string;
  students: number;
  monthlyUsd: number;
  acceptedChains: ChainName[];
};
