# Chivo AI 2.0 Roadmap

This document captures the second product layer for Chivo AI. It should sit beside the main `README.md`, not replace it.

The main `README.md` remains the foundation roadmap for the student, teacher, school, class, lesson, crew, billing, and admin product. This 2.0 roadmap describes the future ecosystem that can be built on top once the foundation is stable.

## Roadmap Split

### Foundation Roadmap: `README.md`

Status: active product build.

Focus:

- student-first and teacher-first school app
- school creation and access
- class setup and class membership
- lesson recording, AI processing, study materials, quiz, cards, audio, and progress
- classroom tools for chat, notes, voice, live sessions, people, and shared AI
- crews, notifications, admin setup, school billing, and payment tracking
- mobile/web UI polish and reliability

This foundation should not be broken or delayed by the 2.0 roadmap.

### Expansion Roadmap: `README-2.0.md`

Status: future group planning.

Focus:

- paid/gated schools and classes
- school-controlled pricing and payment rails
- public profiles and public publishing
- Chivo-approved content review
- creator donations, verification, and monthly rewards

This work begins after the foundation app is working smoothly for schools, teachers, and students.

## Group 4: Monetized Schools, Public Profiles, Publishing, Verification, and Rewards

Group 4 is a future expansion group. It must be designed as an added layer on top of the existing school/class foundation, not as a replacement for the current private classroom flow.

### 4.1 Paid and Free Access Models

Schools should be able to decide whether access is free or paid.

Supported models:

- free school with free classes
- free school with paid/gated classes
- paid/gated school with free classes
- paid/gated school with paid/gated classes
- one-time school entry fee
- weekly, monthly, or yearly school access fee
- one-time class entry fee
- weekly, monthly, or yearly class/subject access fee

Expected behavior:

- If a school is free and public, a student can join automatically.
- If a school is gated, the student pays first, then joins automatically.
- If a class is free, eligible school members can enter normally.
- If a class is gated, the student pays first, then gets access.
- A paid school can still contain free classes.
- A free school can still contain paid classes.

Admin customization points:

- school creation can include free or paid access settings
- class creation can include free or paid access settings
- school admins can change access mode later
- school admins choose prices, billing periods, and payment rails

### 4.2 School Revenue and Platform Fee

Schools should be able to earn from students who join paid schools or paid classes.

Revenue model:

- school sets its own access prices
- student pays the school access/class access fee
- Chivo takes a platform fee from school/class access revenue
- initial target platform fee: `0.5%`
- school subscription fees remain separate from school/student access revenue

Important distinction:

- School subscription: what the school pays Chivo to create/use the school platform.
- School access revenue: what students pay the school to enter a school, class, subject, or learning program.
- Platform fee: Chivo's percentage from school access revenue.

### 4.3 Payment Rails

The system should support both crypto and traditional finance rails.

Crypto rails:

- BNB
- Solana
- Base
- future EVM chains
- future multi-chain support

Traditional rails:

- card payments
- bank transfer
- mobile money where available
- region-specific providers in the future

Payment rail preference:

- school creators choose which rails they accept
- admins can configure payment options per school or class
- students can choose from the enabled payment methods

### 4.4 Public School Profiles

Schools should be able to make their profile public.

Public school profile behavior:

- public slug page for the school
- visible to the global public
- public school description, logo, banner, subjects, public content, and verification status
- visitors can follow the school
- visitors can request to join
- visitors can pay to join if the school is gated
- visitors can join automatically if the school is public and free

Private classroom lessons stay separate from public school publishing.

### 4.5 Public Personal Profiles

Personal accounts should be able to have public profile pages.

Public personal profile behavior:

- public slug page for a person
- profile bio, public learning work, publications, and verification status
- follow system for people and schools
- public profile can publish studies, research, lessons, articles, and learning notes
- profile can receive donations on public content

This should not expose private classroom activity unless the user intentionally publishes something.

### 4.6 Public Publishing System

The platform should support public educational publishing outside private classrooms.

Publishable content types:

- studies
- lessons
- research
- articles
- public learning notes
- school publications

Each public post should support:

- public slug URL
- AI summary
- audio playback
- language selection
- translation/personalized reading support
- author profile
- school profile when posted by a school
- donation button
- public visibility state
- review/approval state

Public publishing must remain separate from class lesson publishing. A classroom lesson is for enrolled members; a public article is for global discovery.

### 4.7 Approved and Open Public Feeds

There should be two public content sections.

Approved feed:

- reviewed by Chivo
- AI-assisted safety and quality review
- company-side final approval
- meant for higher trust public discovery

Open public feed:

- public content that is not Chivo-approved
- visible with lower trust status
- may still be moderated for abuse and safety

Approval flow:

- person or school submits a post for review
- AI reviews for subject quality, safety, misleading claims, and policy issues
- company reviewers receive the post in a review queue
- approved posts move into the Chivo-approved public feed
- rejected posts remain unpublished or return to draft with feedback

### 4.8 Verification

Profiles and schools should be able to become verified.

Personal verification:

- identity verification
- verification fee
- monthly or yearly verification plan
- pricing controlled by Chivo company admins
- verified badge on public profile and public posts

School verification:

- legal/official school identity review
- proof of ownership or admin authority
- school registration or equivalent document where applicable
- official email/domain or other proof where available
- verification fee or plan controlled by Chivo company admins
- verified badge on public school profile and public posts

School verification needs more product and compliance design before implementation.

### 4.9 Donations and Creator Rewards

Public content should allow direct support for creators.

Donation behavior:

- each public article, research post, study, or lesson can include a donate button
- donations go to the creator or school that published the content
- Chivo may optionally take a platform fee from donations in the future
- payment rails can include crypto and traditional finance

Monthly reward system:

- Chivo uses AI-assisted review to identify strong public educational posts each month
- company reviewers make final reward decisions
- selected creators/schools receive monthly rewards
- reward criteria should include usefulness, accuracy, originality, learning quality, and safety

## Required New Product Surfaces

Group 4 will likely need these new surfaces.

School/admin surfaces:

- school access pricing settings
- class access pricing settings
- payment rail settings
- revenue dashboard
- payout settings
- gated access management

Student surfaces:

- pay-to-join school flow
- pay-to-access class flow
- active subscriptions/access passes
- payment history

Public surfaces:

- public school profile
- public personal profile
- public publishing editor
- public article/lesson reader
- approved content feed
- open public feed
- follow/follower pages

Company/admin surfaces:

- platform fee settings
- verification pricing
- verification review queue
- public post review queue
- AI moderation/review dashboard
- monthly reward dashboard
- creator/school payout dashboard

## Backend Concepts To Add Later

Likely future tables or modules:

- school access products
- class access products
- access passes
- school/class subscriptions
- payment providers
- payment wallets
- platform fee ledger
- school revenue ledger
- creator donation ledger
- public profiles
- profile follows
- public publications
- publication reviews
- AI review jobs
- verification requests
- verification plans
- creator rewards

Likely future Edge Functions:

- create access checkout
- confirm access payment
- grant paid school access
- grant paid class access
- create donation checkout
- submit publication review
- process publication AI review
- approve publication
- request verification
- review verification
- calculate monthly creator rewards

## Implementation Guardrails

Do not let Group 4 break the foundation.

Rules:

- private school/class learning remains the core product
- public publishing is separate from classroom lessons
- gated access wraps the existing join/access flow instead of replacing it
- free schools and free classes must remain supported
- teachers and students should still be able to use the app without public publishing
- crypto rails should be modular, not hardcoded into every payment flow
- traditional finance should be a first-class option
- company review tools are separate from school admin tools
- verification is optional, not required for normal learning

## Build Order

Recommended order after the foundation is stable:

1. Add access product model for free/paid schools and classes.
2. Add school/class pricing settings in admin.
3. Add payment checkout and access-pass granting.
4. Add school revenue and Chivo platform-fee ledger.
5. Add public profile primitives for people and schools.
6. Add public publishing editor and public reader.
7. Add follow system and public discovery feeds.
8. Add AI review queue and approved/open feed split.
9. Add verification requests and verification plans.
10. Add donations and monthly creator rewards.

## Current Decision

Group 4 is documented, but not the active implementation focus yet.

Current priority remains:

- make the existing product work reliably for schools
- finish student and teacher classroom flows
- finish class tools, crews, lessons, notifications, billing, and admin polish
- test the foundation end to end before adding public marketplace complexity
