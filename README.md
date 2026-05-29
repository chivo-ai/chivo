# Chivo AI

Chivo AI is a school-first learning platform that turns real lessons into transcript, summary, audio study, quizzes, flashcards, progress insight, and study crews.

The expanded vision is a real onchain education ecosystem, but the current build stays focused on getting the core school, lesson, crew, classroom, and admin foundation working first.

## Roadmap Documents

- **Foundation roadmap**: this `README.md` covers the active product foundation and Groups 1-3.
- **2.0 expansion roadmap**: `README-2.0.md` covers Group 4: billing, gated schools/classes, payment rails, public profiles, publishing, verification, donations, and creator rewards.

## Current Product

Chivo AI is built around five product surfaces:

- **Access**: sign in, register, account profile, invite codes, QR scanning, school requests, and route entry.
- **School**: school identity, classes, subjects, members, academic terms, invites, requests, and permissions.
- **Learn**: student class entry, lesson cards, audio, transcript, summaries, quizzes, flashcards, personalization, and progress.
- **Teach**: teacher rooms, live lesson recording, upload, AI processing, review, publishing, class roster, and class insight.
- **Admin**: school command center, people, academic setup, class setup, requests, permissions, and audit visibility. Billing/payment controls belong to the 2.0 ecosystem layer.

Core routes:

- `/home`, `/notifications`, `/account`, `/create`, `/join`, `/request`, `/crews`, `/crews/[username]`
- `/school/my-school`, `/school/my-school/[username]`
- `/school/class`, `/school/class/[username]`
- `/learn`, `/teach`
- `/lessons`, `/lessons/[id]`
- `/admin`, `/admin/profile`, `/admin/academic`, `/admin/classes`, `/admin/subjects`, `/admin/people`, `/admin/invites`, `/admin/requests`, `/admin/billing`

Billing and payment rails belong to the 2.0 ecosystem layer. Foundation admin can keep placeholders or existing records, but real monetization should be designed from the 2.0 roadmap.

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
- admin profile, academic, classes, subjects, people, invites, requests, and school setup screens

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

### Group 3: Crews, Notifications, Classroom Tools, and Experience Layer

Status: started.

Scope:

- lesson crews
- school and cross-school crew rules
- crew resources and messages
- guardian experience
- notifications
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
- crew room tabs for chat, shared AI, notes, voice, live sessions, and members
- crew voice-note storage, Gemini voice transcription, and live study floor state
- classroom study room tabs for chat, shared AI, notes, voice, live sessions, and members
- classroom voice-note storage, Gemini voice transcription, and shared class study packs

Group 3 is done when the product feels connected, memorable, and ready for broader school rollout.

## Expanded Onchain Vision

These are future ecosystem groups. They build on top of the current product after the school, lesson, crew, classroom, and admin foundation is stable.

### Future Group 4: Chivo AI 2.0 Ecosystem

Detailed plan: see `README-2.0.md`.

Scope:

- paid/gated schools and paid/gated classes
- free schools and free classes remain supported
- database-driven access, billing, bans, suspensions, overrides, and verification badges
- company/admin global billing toggle that can make the whole app free temporarily
- company/admin authority to revoke paid access when policy is broken
- embedded email-based web wallet direction for EVM chains and Solana
- real onchain payment verification through EVM smart contracts, Solana programs, and backend event listeners
- school-set pricing for school entry, class access, weekly/monthly/yearly plans, and one-time access
- crypto rails including BNB, Solana, Base, and future EVM chains
- traditional finance rails such as cards, bank transfer, mobile payments, and regional providers
- Chivo platform share on school/class access revenue, starting with a planned `0.5%` fee
- public school profiles and public personal profiles
- follow system for schools and personal profiles
- public studies, lessons, research, articles, and learning posts
- AI summaries, audio playback, language selection, and translation for public content
- approved-by-Chivo feed and open public feed
- AI-assisted company review queue
- personal and school verification
- donations for public content
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
- `supabase/group10-crew-study-upgrade.sql`: crew audio storage, voice notes, and live study resource updates
- `supabase/group11-classroom-study-upgrade.sql`: class chat, resources, audio storage, voice notes, and live class study
- `supabase/group12-ai-chat-memory-upgrade.sql`: AI chat memory, classroom AI thread persistence, and updated timestamps
- `supabase/group13-monetization-controls-upgrade.sql`: 2.0 billing controls, company roles, access policy, overrides, embedded wallets, and onchain payment records

Do not run `supabase/dev-reset.sql` on a database that contains live data.

Contract workspaces:

- `CONTRACTS.md`: contract architecture and app/backend/chain boundaries
- `CONTRACTS-PRODUCTION.md`: production authority, release, refund, verification, and emergency runbook
- `chivo-evm/`: EVM escrow payment router workspace
- `chivo-sol/`: Solana escrow payment program workspace

These workspaces escrow payment and prove payment through onchain events. Supabase remains responsible for current access, bans, overrides, verification badges, and access passes.

Edge Functions:

- `create-school`: creates a school, owner membership, trial subscription, and audit log.
- `accept-invite`: redeems a school/class code after checking company access policy.
- `request-school-access`: sends a request to join a school by school code after checking company access policy.
- `review-join-request`: lets a school owner/admin approve or decline a request.
- `company-control`: manages company billing, roles, restrictions, and overrides with service-role protection.
- `onchain-payout-operator`: releases verified EVM escrow payments after Supabase policy checks.
- `process-lesson`: Gemini lesson processing foundation.
- `personalize-lesson`: creates a student-specific lesson version by language and learning mode.
- `submit-quiz-attempt`: scores student quiz attempts and updates progress signals.
- `process-crew-study-pack`: creates one shared crew AI study pack from crew messages and notes.
- `process-crew-voice-note`: transcribes and summarizes a crew voice note for shared study.
- `process-class-study-pack`: creates one shared class AI study pack from class messages, notes, and voice transcripts.
- `process-class-voice-note`: transcribes and summarizes a class voice note for shared study.

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
PAYOUT_OPERATOR_SECRET=your-operator-trigger-secret
EVM_PAYOUT_OPERATOR_PRIVATE_KEY=your-evm-payout-operator-key
EVM_PAYMENT_ROUTER_ADDRESS=your-evm-router-address
EVM_RPC_URL=your-alchemy-evm-rpc-url
```

Supabase reserves the `SUPABASE_` prefix for platform-provided variables. Edge Functions read `SERVICE_ROLE_KEY` first, with `SUPABASE_SERVICE_ROLE_KEY` kept only as a fallback for local/default environments.

## Run

```bash
npm install
npm run web
```
