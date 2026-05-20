import {
  Classroom,
  Lesson,
  LessonCrew,
  PersonalizedLesson,
  SchoolMember,
  SchoolPlan,
  SchoolWorkspace,
  StudentPreference,
} from '../types';

export const schoolWorkspace: SchoolWorkspace = {
  id: 'school-bestcity-academy',
  name: 'BestCity Academy',
  city: 'Lagos',
  country: 'Nigeria',
  adminName: 'Amina Bello',
  subscriptionStatus: 'Pilot',
  inviteCode: 'BCA-8421',
  privacyRule: 'School spaces stay private unless a learner joins a crew by invite.',
};

export const studentPreference: StudentPreference = {
  language: 'English',
  level: 'Junior secondary',
  mode: 'balanced',
  audioEnabled: true,
};

export const featuredLesson: Lesson = {
  id: 'lesson-demo-001',
  title: 'The Water Cycle and Everyday Weather',
  subject: 'Basic Science',
  teacherName: 'Mrs. Adewale',
  className: 'JSS 2 Blue',
  duration: '46 min',
  status: 'ready',
  summary:
    'Water moves between rivers, oceans, clouds, and rain through evaporation, condensation, and precipitation. The lesson connects these stages to daily weather changes and farming.',
  keyPoints: [
    'Evaporation turns surface water into vapor when heat is added.',
    'Condensation forms clouds when vapor cools high in the sky.',
    'Precipitation returns water as rain, snow, or hail.',
    'Runoff and collection move water back into rivers, lakes, and oceans.',
  ],
  quiz: [
    'What happens during evaporation?',
    'Why do clouds form before rain?',
    'Name two ways the water cycle affects farming.',
  ],
};

export const personalizedLesson: PersonalizedLesson = {
  lessonId: featuredLesson.id,
  studentName: 'Tomi Adeyemi',
  streakDays: 6,
  confidence: 78,
  weakSpot: 'Condensation before rainfall',
  dailyChallenge: 'Teach condensation back in two sentences.',
  modes: [
    {
      id: 'simple',
      label: 'Simple',
      title: 'Water moves in a loop',
      body:
        'The sun warms water, water rises as vapor, clouds form when vapor cools, and rain brings the water back down.',
    },
    {
      id: 'balanced',
      label: 'Balanced',
      title: 'Evaporation, condensation, precipitation',
      body:
        'Heat changes liquid water into vapor. Cooler air changes vapor into cloud droplets. When droplets become heavy, precipitation falls.',
    },
    {
      id: 'exam',
      label: 'Exam',
      title: 'Likely test answer',
      body:
        'The water cycle is the continuous movement of water through evaporation, condensation, precipitation, runoff, and collection.',
    },
    {
      id: 'catch_up',
      label: 'Catch-up',
      title: 'Missed class recap',
      body:
        'Focus first on the three words Mrs. Adewale repeated: evaporation, condensation, and precipitation.',
    },
  ],
};

export const classrooms: Classroom[] = [
  {
    id: 'class-jss2-blue',
    name: 'JSS 2 Blue',
    subject: 'Basic Science',
    gradeLevel: 'Junior secondary',
    teacherName: 'Mrs. Adewale',
    studentCount: 42,
    completionRate: 74,
    inviteCode: 'J2B-318',
    currentLessonId: featuredLesson.id,
  },
  {
    id: 'class-jss1-gold',
    name: 'JSS 1 Gold',
    subject: 'Mathematics',
    gradeLevel: 'Junior secondary',
    teacherName: 'Mr. Okafor',
    studentCount: 38,
    completionRate: 61,
    inviteCode: 'J1G-904',
    currentLessonId: 'lesson-demo-002',
  },
  {
    id: 'class-ss2-arts',
    name: 'SS 2 Arts',
    subject: 'Government',
    gradeLevel: 'Senior secondary',
    teacherName: 'Ms. Hassan',
    studentCount: 35,
    completionRate: 83,
    inviteCode: 'S2A-776',
    currentLessonId: 'lesson-demo-003',
  },
];

export const members: SchoolMember[] = [
  {
    id: 'member-tomi',
    name: 'Tomi Adeyemi',
    role: 'student',
    className: 'JSS 2 Blue',
    language: 'English',
    status: 'active',
  },
  {
    id: 'member-zainab',
    name: 'Zainab Musa',
    role: 'student',
    className: 'JSS 2 Blue',
    language: 'Hausa',
    status: 'active',
  },
  {
    id: 'member-adewale',
    name: 'Mrs. Adewale',
    role: 'teacher',
    className: 'JSS 2 Blue',
    language: 'English',
    status: 'active',
  },
  {
    id: 'member-nora',
    name: 'Nora James',
    role: 'student',
    className: 'JSS 1 Gold',
    language: 'English',
    status: 'review',
  },
];

export const lessonCrews: LessonCrew[] = [
  {
    id: 'crew-rainmakers',
    name: 'Rainmakers Revision',
    ownerName: 'Tomi Adeyemi',
    scope: 'school',
    memberCount: 8,
    activeLesson: 'The Water Cycle and Everyday Weather',
    sharedItems: 14,
    nextSession: 'Today, 18:30',
  },
  {
    id: 'crew-exam-sprint',
    name: 'Junior Science Sprint',
    ownerName: 'Zainab Musa',
    scope: 'cross_school',
    memberCount: 12,
    activeLesson: 'Forces and Motion',
    sharedItems: 21,
    nextSession: 'Fri, 17:00',
  },
];

export const schoolPlan: SchoolPlan = {
  plan: 'Pilot School',
  students: 420,
  monthlyUsd: 49,
  acceptedChains: ['solana', 'base', 'bnb'],
};

export const workflow = [
  'Record classroom teaching',
  'Transcribe with Gemini',
  'Create the class master lesson',
  'Personalize by learner settings',
  'Publish to lessons and crews',
];
