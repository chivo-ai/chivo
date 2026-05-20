# Chivo AI

Chivo AI is a school-first learning platform. A teacher records one classroom lesson, then students receive personal study versions with summaries, translations, quizzes, flashcards, audio support, and revision modes shaped around their needs.

The product is built around a simple rule:

`school_id` is the privacy wall.

Students, teachers, classes, lessons, payments, and school analytics belong to one school workspace. Students from different schools cannot discover each other through the school experience. Lesson Crews are separate invite-only study spaces for friends and classmates.

## Product Flow

1. A school creates a private workspace.
2. The school admin creates classes, assigns teachers, and generates invite links or class codes.
3. Teachers join by invite and record lessons for assigned classes.
4. Students create accounts and join the correct school or class with an approved invite, class code, QR code, or admin approval.
5. Audio uploads to Supabase Storage.
6. A Supabase Edge Function sends lesson content to Gemini.
7. Chivo AI saves the transcript, master lesson, personalized student versions, quizzes, flashcards, and audio-ready outputs.
8. Students study alone or inside Lesson Crews.

## Lesson Crews

Lesson Crews are part of the core experience.

- School crews let classmates revise together inside one school.
- Cross-school crews let friends study together through invite-only spaces.
- Official school lessons stay private by default.
- Shared crew material should be a separate study version unless the school allows lesson sharing.
- Crew membership uses invite codes and approval states.

## Web And Mobile

The same product works on web and mobile, but the surfaces are tuned differently.

Mobile focuses on fast classroom and study moments:

- record a lesson
- listen to recaps
- ask questions from a lesson
- take quick quizzes
- review flashcards
- join or run Lesson Crews
- approve essential school activity as an admin

Web supports the full workspace:

- school setup
- class management
- teacher and student invites
- approval queues
- lesson library
- analytics
- billing
- everything students and teachers can do on mobile

## Stack

- Expo and React Native for Android, iOS, and web
- Supabase Postgres, Auth, Storage, RLS, and Edge Functions
- Gemini API for transcription, summarization, translation, quiz generation, and personalization
- Solana, Base, and BNB Chain planned for school subscription payments

## Start

```bash
npm install
npm run web
```

Copy `.env.example` to `.env` and add your Supabase public keys when the project is created.

Server-side keys such as `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` belong in Supabase Edge Function secrets, not inside the Expo app.
