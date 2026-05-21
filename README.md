# Chivo AI

Chivo AI is a school-first learning platform. The current build is focused on the first production slice: real accounts and real school access.

## Current Slice

The app now starts with:

1. Supabase-backed sign in.
2. Supabase-backed account creation.
3. Automatic profile creation from Auth metadata.
4. Signed-in school access screen.
5. School workspace creation through a Supabase Edge Function.
6. School or class invite acceptance through a Supabase Edge Function.
7. School memberships loaded from the database.

No learner, teacher, admin, or crew dashboard is shown before a real user session exists.

## Backend Pieces

Database migration:

- `profiles`
- `schools`
- `school_memberships`
- academic years and terms
- subjects and classes
- school invites and join requests
- lessons, recordings, transcripts, Gemini jobs, outputs, personalizations
- quizzes, attempts, flashcards, progress, weak areas
- guardian links
- Lesson Crews, invites, memberships, resources, messages
- subscriptions, payment transactions, notifications, audit logs

Edge Functions:

- `create-school`: creates a school, owner membership, trial subscription, and audit log.
- `accept-invite`: redeems a school/class code and creates school/class membership.
- `process-lesson`: existing Gemini lesson processing function.

## Environment

Copy `.env.example` to `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Server-side secrets belong in Supabase Edge Function secrets:

```bash
GEMINI_API_KEY=your-gemini-api-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Run

```bash
npm install
npm run web
```

## Next Production Slice

After auth and school access are verified against a live Supabase project, the next slice should be school admin setup:

- create academic year and term
- create subjects
- create classes
- generate class invite codes
- approve join requests

That should come before rebuilding learner and teacher dashboards.
