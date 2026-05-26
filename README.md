# Chivo AI

Chivo AI is a school-first learning platform that turns real lessons into transcript, summary, audio study, quizzes, flashcards, progress insight, and study crews.

The expanded vision is a real onchain education ecosystem, but the current build stays focused on getting the core school, lesson, crew, and billing product working first.

## Current Product

Chivo AI is built around five product surfaces:

- **Access**: sign in, register, account profile, invite codes, QR scanning, school requests, and route entry.
- **School**: school identity, classes, subjects, members, academic terms, invites, requests, and permissions.
- **Learn**: student class entry, lesson cards, audio, transcript, summaries, quizzes, flashcards, personalization, and progress.
- **Teach**: teacher rooms, live lesson recording, upload, AI processing, review, publishing, class roster, and class insight.
- **Admin**: school command center, people, academic setup, class setup, billing, payments, requests, and audit visibility.

Core routes:

- `/home`, `/notifications`, `/account`, `/create`, `/join`, `/request`, `/crews`, `/crews/[username]`
- `/school/my-school`, `/school/my-school/[username]`
- `/school/class`, `/school/class/[username]`
- `/learn`, `/teach`
- `/lessons`, `/lessons/[id]`
- `/admin`, `/admin/profile`, `/admin/academic`, `/admin/classes`, `/admin/subjects`, `/admin/people`, `/admin/invites`, `/admin/requests`, `/admin/billing`

Billing belongs to the school admin surface. Future Chivo company controls are a separate platform surface, not the school admin surface.

## Current Work Groups

### Group 1: Account, School, and Admin Setup

Status: ready for admin-flow testing.

Scope:

- account creation and sign in
- school creation, joining, requests, and invite codes
- school profile, logo, banner, sticker identity, and username routes
- academic year, term, subject, class, and class-subject setup
- member management, class access assignment, and request approval
- responsive navigation with mobile bottom nav and desktop hover sidebar
- admin profile, academic, classes, subjects, people, invites, requests, and billing screens

### Group 2: Lessons, Gemini AI, and Student Learning

Status: ready for end-to-end product testing.

Scope:

- teacher lesson recording/upload
- Gemini transcription, summary, quiz, and flashcard generation
- teacher review, show-more AI output, publish flow, and student-view preview
- student lesson library and `/lessons/[id]` lesson room
- Listen, Transcript, Quiz, and Cards tabs
- preferred-language lesson personalization and translated audio playback
- language picker instead of manual language typing
- quiz attempts, progress tracking, weak areas, and teacher class insight

Group 2 is ready to close when one teacher and one student can complete the full lesson loop on mobile and web.

### Group 3: Crews, Billing, Payments, and Experience Layer

Status: started.

Scope:

- lesson crews
- school and cross-school crew rules
- crew resources and messages
- guardian experience
- notifications
- billing controls, subscriptions, invoices, plan limits, and crypto payment tracking
- audit visibility
- final mobile and web polish

Completed in this group so far:

- quick class creation from inside a school workspace
- real `/crews` hub instead of placeholder screen
- real `/crews/[username]` crew room route
- crew cards route by username slug
- crew creation and joining moved into focused modals
- crew creation tied to an active school membership
- crew invite-code joining
- crew message thread
- crew shared study notes
- shared crew AI study pack with summary, quiz, flashcards, and group tasks
- notification center with unread badge and crew AI alerts
- Supabase RPC foundation for safe crew creation and joining

Group 3 is done when the product feels connected, memorable, and ready for broader school rollout.

## Expanded Onchain Vision

These are future ecosystem groups. They stay out of the current product build until the school, lesson, crew, and billing flows are stable.

### Future Group 4: Paid Schools, Paid Classes, and Payment Rails

- free and paid schools
- free and paid classes inside schools
- school entry fees and automatic join after payment
- weekly, monthly, yearly, and one-time class access
- school revenue from student payments
- Chivo platform share on school/class access payments
- crypto rails including BNB, Solana, Base, and future EVM chains
- traditional rails such as cards, bank transfer, and mobile payments

### Future Group 5: Public Profiles, Publishing, and Discovery

- public and private school profiles
- public personal profiles
- follow system for profiles and schools
- studies, lessons, research, educational articles, and public slugs
- public article audio playback, summaries, translation, and language selection
- classroom lessons kept separate from public publishing

### Future Group 6: Company Review, Verification, and Rewards

- approved-by-Chivo feed and open public feed
- AI moderation and company review queue
- profile verification and school verification
- verification fees and subscription plans
- donations for public articles and research
- monthly AI-assisted creator rewards

### Future Expansion

- advanced AI tutors
- offline learning
- onchain certificates or achievements
- scholarships and research funding pools
- education marketplace
- advanced analytics for schools and creators

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

Use upgrade files for existing databases:

- `supabase/group1-upgrade.sql`: Group 1 media/profile upgrade
- `supabase/group2-upgrade.sql`: first Group 2 lesson workflow
- `supabase/group3-audio-upgrade.sql`: native/mobile lesson audio
- `supabase/group4-progress-upgrade.sql`: quiz progress and teacher attempt insight
- `supabase/group5-class-flow-upgrade.sql`: learner class requests and teacher roster management
- `supabase/group6-usernames-upgrade.sql`: username-based school and class routes
- `supabase/group7-platform-controls-upgrade.sql`: future company-side platform controls
- `supabase/group8-crews-upgrade.sql`: quick class creation, crew slugs, real crew creation, and invite-code joining
- `supabase/group9-activity-upgrade.sql`: notification payloads for activity badges and deep links

Do not run `supabase/dev-reset.sql` on a database that contains live data.

Edge Functions:

- `create-school`: creates a school, owner membership, trial subscription, and audit log.
- `accept-invite`: redeems a school/class code and creates school/class membership.
- `request-school-access`: sends a request to join a school by school code.
- `review-join-request`: lets a school owner/admin approve or decline a request.
- `process-lesson`: Gemini lesson processing foundation.
- `personalize-lesson`: creates a student-specific lesson version by language and learning mode.
- `submit-quiz-attempt`: scores student quiz attempts and updates progress signals.
- `process-crew-study-pack`: creates one shared crew AI study pack from crew messages and notes.

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

Supabase reserves the `SUPABASE_` prefix for platform-provided variables. Edge Functions read `SERVICE_ROLE_KEY` first, with `SUPABASE_SERVICE_ROLE_KEY` kept only as a fallback for local/default environments.

## Run

```bash
npm install
npm run web
```
