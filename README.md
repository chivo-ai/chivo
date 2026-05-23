# Chivo AI

Chivo AI is a school-first learning platform for turning real lessons into summaries, quizzes, flashcards, audio study, progress insight, and study crews while keeping each school workspace private.

## Work Groups

We are building the product in three full groups. Each group includes UI, Supabase logic, Edge Functions where needed, and light checks before moving on.

### Group 1: Account, School, and Admin Setup

Status: ready for admin-flow testing.

Scope:

- account creation and sign in
- personal account home after login
- school creation
- school logo, banner, and sticker identity
- school joining by invite code
- school access requests
- school profile editing
- school workspace entry
- school overview
- academic year, term, subject, class, and class-subject setup
- invite codes
- member management
- class access assignment
- join request approval
- role-aware school views
- learner class requests from inside an active school
- teacher class roster management for assigned classes

Completed in this group so far:

- signed-in home hub for schools, pending access, crews, and account entry
- standalone personal account screen
- separate Home, Account, Create, Join, Request, and Crews access screens
- QR code scanner support for school and class invite codes
- personal profile editing with direct image upload and sticker identity
- responsive app navigation with a hover sidebar on web and floating bottom navigation on mobile
- school cards and workspace headers showing logo/banner/sticker identity
- Supabase Storage bucket for school, class, crew, and profile media
- grouped school workspace with Overview, Setup, People, Invites, and Requests
- guided onboarding checklist for school admins
- real school creation, invite redemption, access requests, and request review
- academic setup, class setup, subject assignment, member assignment, and invite code creation
- clearer join/request errors when a user enters an invite code in the school-code flow
- Expo Router entry with `(auth)` and `(tabs)` route groups
- real access routes for `/home`, `/account`, `/create`, `/join`, `/request`, and `/crews`
- real workspace routes for `/learn`, `/teach`, and `/admin` on mobile and web
- real school routes for `/school/my-school`, `/school/my-school/[username]`, `/school/class`, and `/school/class/[username]`
- school and class username editing for clean public routes
- learner class request cards after entering a school
- teacher roster panel for class members and class access

Group 1 can now be tested as a real school admin flow. Further polish can happen after testing reveals what feels slow or unclear.

### Group 2: Lessons, Gemini AI, and Student Learning

Status: in progress.

Scope:

- teacher lesson recording/upload
- lesson storage
- Gemini transcription and generation
- teacher review and publish flow
- student lesson view
- summaries, quizzes, flashcards, and audio study
- personalization by language and learning mode
- progress and weak-area tracking

Completed in this group so far:

- Lessons section inside each school workspace
- teacher/admin lesson creation from transcript text
- class and subject selection for lessons
- Gemini study-pack processing through `process-lesson`
- generated master summary stored in `lesson_outputs`
- generated quiz stored in `quizzes` and `quiz_questions`
- generated flashcards stored in `flashcards`
- teacher publish action
- students only see published lessons in the app
- function-level staff permission check before Gemini processing
- class-first lesson room with separate Live, Review, Published, Quiz, and Cards areas
- lesson library screen before opening an individual lesson
- real lesson routes for `/lessons` and `/lessons/[id]`
- lesson filters for date window, year, time of day, and sort order
- browser live transcript capture where supported
- native lesson audio recording path through `expo-audio`
- lesson audio storage bucket and Gemini audio processing path
- interactive quiz attempts saved to `quiz_attempts`
- focused flashcard session view
- clearer admin console split into profile, academic, classes, subjects, people, invites, and requests
- student lesson personalization by language and learning mode through `personalize-lesson`
- server-scored quiz attempts through `submit-quiz-attempt`
- quiz results update student progress and weak areas
- teacher quiz insight card with attempts, average score, and students who need help
- teacher Class Insight section across published lessons

Current focus:

- testing class requests, roster management, lesson recording, AI processing, publishing, quiz attempts, and student viewing against Supabase

Group 2 is done when a teacher can publish a lesson and a student can learn from it end to end.

### Group 3: Crews, Payments, and Experience Layer

Status: not started.

Scope:

- lesson crews
- school and cross-school crew rules
- crew resources and messages
- guardian experience
- notifications
- subscriptions and crypto payment tracking
- audit visibility
- final mobile and web polish

Group 3 is done when the product feels connected, memorable, and ready for broader school rollout.

## Backend Pieces

Database migration includes:

- profiles
- schools
- school memberships
- academic years and terms
- subjects and classes
- school invites and join requests
- lessons, recordings, transcripts, Gemini jobs, outputs, personalizations
- quizzes, attempts, flashcards, progress, weak areas
- guardian links
- Lesson Crews, invites, memberships, resources, messages
- subscriptions, payment transactions, notifications, audit logs
- `chivo-media` storage bucket for public logo, banner, class, crew, and profile images

If you already ran part of the migration manually and see an error like `type "school_role" already exists`, run `supabase/dev-reset.sql` only on an early development database, then run the migration again. Do not run the reset script on a database that contains data you need to keep.

If your existing early database already has the older Group 1 schema, run `supabase/group1-upgrade.sql`.

For a database that already has Chivo tables or enum types, use `supabase/group1-upgrade.sql` for this media/profile upgrade instead of running the full initial migration again.

For the first Group 2 lesson workflow on an existing early database, run `supabase/group2-upgrade.sql`.

For native/mobile lesson audio on an existing early database, run `supabase/group3-audio-upgrade.sql`.

For quiz progress and teacher attempt insight on an existing early database, run `supabase/group4-progress-upgrade.sql`.

For learner class requests and teacher class roster management on an existing early database, run `supabase/group5-class-flow-upgrade.sql`.

For username-based school and class routes on an existing early database, run `supabase/group6-usernames-upgrade.sql`.

Edge Functions:

- `create-school`: creates a school, owner membership, trial subscription, and audit log.
- `accept-invite`: redeems a school/class code and creates school/class membership.
- `request-school-access`: sends a request to join a school by school code.
- `review-join-request`: lets a school owner/admin approve or decline a request.
- `process-lesson`: Gemini lesson processing foundation.
- `personalize-lesson`: creates a student-specific lesson version by language and learning mode.
- `submit-quiz-attempt`: scores student quiz attempts and updates progress signals.

## Environment

Copy `.env.example` to `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Only `EXPO_PUBLIC_` values should be in the Expo app `.env`. Server-side secrets belong in Supabase Edge Function secrets:

```bash
GEMINI_API_KEY=your-gemini-api-key
SERVICE_ROLE_KEY=your-service-role-key
```

Supabase reserves the `SUPABASE_` prefix for platform-provided variables. The Edge Functions read `SERVICE_ROLE_KEY` first, with `SUPABASE_SERVICE_ROLE_KEY` kept only as a fallback for local/default environments.

## Run

```bash
npm install
npm run web
```
