# Chivo AI 2.0 Roadmap

This document captures the second product layer for Chivo AI. It should sit beside the main `README.md`, not replace it.

The main `README.md` remains the foundation roadmap for the student, teacher, school, class, lesson, crew, classroom, and admin product. Billing and monetization belong to this 2.0 roadmap because they affect school access, class access, revenue, verification, donations, and public publishing.

## Roadmap Split

### Foundation Roadmap: `README.md`

Status: active product build.

Focus:

- student-first and teacher-first school app
- school creation and access
- class setup and class membership
- lesson recording, AI processing, study materials, quiz, cards, audio, and progress
- classroom tools for chat, notes, voice, live sessions, people, and shared AI
- crews, notifications, admin setup, classroom tools, and foundation reliability
- mobile/web UI polish and reliability

This foundation should not be broken or delayed by the 2.0 roadmap.

### Expansion Roadmap: `README-2.0.md`

Status: future group planning.

Focus:

- paid/gated schools and classes
- school billing and subscription design
- school-controlled pricing and payment rails
- public profiles and public publishing
- Chivo-approved content review
- creator donations, verification, and monthly rewards

This work can begin after the UI foundation because it is the next product layer. It must still protect the 1.0 learning foundation: students and teachers should continue to use free/private school and class flows without being forced into monetization.

## Group 4: Monetized Schools, Public Profiles, Publishing, Verification, and Rewards

Group 4 is a future expansion group. It must be designed as an added layer on top of the existing school/class foundation, not as a replacement for the current private classroom flow.

Billing is part of Group 4. The 1.0 foundation may contain admin placeholders or early payment records, but real billing, subscriptions, payment rails, access passes, revenue sharing, payouts, and platform fees should be designed here.

Group 4 must be database-driven for access control, but crypto payments must still happen for real onchain. Onchain contracts/programs and verified chain events prove that payment happened. Chivo database records then decide whether that verified payment grants, keeps, pauses, revokes, or overrides access.

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
- Paid access can still be revoked if a user, profile, school, class, crew, or publication breaks policy.
- A paid user can still be banned, suspended, or removed by school admins or Chivo company admins.
- Database access state always wins over historical payment state after payment has been verified.

Admin customization points:

- school creation can include free or paid access settings
- class creation can include free or paid access settings
- school admins can change access mode later
- school admins choose prices, billing periods, and payment rails

### 4.2 Company Control Plane

Chivo company/admin control is required for centralization, compliance, safety, and emergency operations.

Company-level controls:

- globally disable billing for the whole app
- globally enable billing again
- make the whole platform temporarily free
- pause all payment checkout flows
- pause all paid access enforcement while keeping records intact
- disable a payment rail by provider, chain, region, or risk status
- set the Chivo platform fee
- override school/class/crew pricing rules
- grant free access to a school, class, crew, or subject
- revoke access even after payment
- ban or suspend a person/profile
- ban or suspend a school
- ban or suspend a class
- ban or suspend a crew
- ban or hide public content
- freeze school revenue or creator donation payouts during review
- mark a school/profile as verified without charging a verification fee
- remove a verification badge after policy review
- waive verification fees for selected people or schools

Global billing toggle:

- `billing_enabled = false` means the whole app ignores billing requirements and allows eligible users to use free access flows.
- `billing_enabled = true` means school/class/crew/public-content access rules are enforced normally.
- The toggle must be database-backed so web and native apps behave the same way.
- The toggle should be checked by server-side access functions, not only by UI code.

Policy enforcement:

- payment does not guarantee permanent access
- payment does not protect a user from removal
- Chivo company admins can override school decisions when platform safety or policy requires it
- school admins can manage their own members/classes, but company admins remain the highest authority
- all override actions should create audit logs

This is intentionally centralized. Chivo controls the platform layer, while schools control their local learning environment inside the rules Chivo allows.

### 4.3 School Revenue and Platform Fee

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

### 4.4 School Billing and Payment Rails

Billing models:

- school subscription to use Chivo as a platform
- school entry fees paid by students
- class/subject access fees paid by students
- weekly, monthly, yearly, and one-time access passes
- verification fees for public/verified profiles
- donation payments for public content
- creator reward payouts

These billing models can affect 1.0 access flows, so they must wrap the existing school/class membership logic carefully instead of replacing it.

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

Onchain payment verification:

- crypto payments must be real onchain transactions
- EVM chains should use audited smart contracts for payment, fees, events, refunds where needed, and anti-fraud controls
- Solana should use audited programs for payment, fees, events, refunds where needed, and anti-fraud controls
- Edge Functions or backend workers should listen to verified onchain events
- the system should record transaction hash/signature, chain, payer, receiver, amount, token, block/slot, status, and confirmations/finality
- access passes should only be created after payment is confirmed by the chain listener or a trusted verification service
- failed, spoofed, replayed, underpaid, wrong-chain, wrong-recipient, expired, or suspicious payments should not grant access
- payment contracts/programs should include anti-fraud and anti-abuse design before production use
- contracts/programs should be reviewed and tested before real funds are accepted

Company override rule:

- onchain payment proves that payment happened
- database policy decides whether access is currently allowed
- company/admin override can revoke, pause, refund-review, ban, suspend, or waive access even if the payment was valid
- override actions do not erase payment history; they change current platform access state

### 4.5 Embedded Web Wallet

Crypto access should not require every user to understand external wallet connection.

Preferred wallet model:

- embedded web-wallet experience
- users can register with email
- users can pay/use crypto rails from inside Chivo
- wallet UX should feel like Coinbase-style web wallet onboarding
- support EVM chains that Chivo integrates
- support Solana
- avoid forcing traditional `connect wallet` as the only entry path

Wallet requirements:

- works on web
- works inside native app flows
- email-based onboarding
- supports custodial or semi-custodial/embedded wallet models, depending on provider choice
- supports EVM addresses and Solana addresses
- can be extended to external wallet connect later
- server-side payment confirmation still updates Chivo database access records
- embedded wallet payments still go through the same onchain contracts/programs and event verification

Important rule:

- wallet/payment provider state does not replace Chivo database access state
- Chivo database records decide whether a person can enter a school, class, crew, publication, or paid feature
- onchain event verification proves payment, while Chivo access policy grants or denies current access

### 4.6 Public School Profiles

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

### 4.7 Public Personal Profiles

Personal accounts should be able to have public profile pages.

Public personal profile behavior:

- public slug page for a person
- profile bio, public learning work, publications, and verification status
- follow system for people and schools
- public profile can publish studies, research, lessons, articles, and learning notes
- profile can receive donations on public content

This should not expose private classroom activity unless the user intentionally publishes something.

### 4.8 Public Publishing System

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

### 4.9 Approved and Open Public Feeds

There should be two public content sections.

Approved feed:

- reviewed by Chivo
- AI-assisted safety and quality review
- company-side final approval
- meant for higher trust public discovery

Open public feed:

- public content that is not Chivo-approved
- visible with lower trust status
- will still be moderated for abuse and safety

Approval flow:

- person or school submits a post for review
- AI reviews for subject quality, safety, misleading claims, and policy issues
- company reviewers receive the post in a review queue
- approved posts move into the Chivo-approved public feed
- rejected posts remain unpublished or return to draft with feedback

### 4.10 Verification

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

Company verification overrides:

- Chivo can grant a verified badge manually.
- Chivo can waive verification payment for selected schools or profiles.
- Chivo can remove verification even if the user/school previously paid.
- Chivo can pause verification payments globally.
- Verification state must be database-backed and audit-logged.

### 4.11 Donations and Creator Rewards

Public content should allow direct support for creators.

Donation behavior:

- each public article, research post, study, or lesson can include a donate button
- donations go to the creator or school that published the content
- Chivo  take a 0.5% platform fee from donations
- payment rails can include crypto and traditional finance (later)

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

- global billing toggle
- payment rail kill switches
- platform fee settings
- school/class/crew access override panel
- user/profile/school/class/crew ban and suspension controls
- manual free-access grants
- verification fee waiver controls
- manual verification badge controls
- policy/audit log dashboard
- verification pricing
- verification review queue
- public post review queue
- AI moderation/review dashboard
- monthly reward dashboard
- creator/school payout dashboard

## Backend Concepts To Add Later

Likely future tables or modules:

- platform settings
- company admin roles
- policy audit logs
- school access products
- class access products
- crew access products
- access passes
- access overrides
- bans and suspensions
- school/class subscriptions
- payment providers
- payment rail settings
- payment wallets
- embedded wallet identities
- onchain payment intents
- onchain payment events
- contract/program registry
- contract/program audit status
- suspicious payment reviews
- platform fee ledger
- school revenue ledger
- school subscription ledger
- creator donation ledger
- public profiles
- profile follows
- public publications
- publication reviews
- AI review jobs
- verification requests
- verification plans
- verification overrides
- creator rewards

Likely future Edge Functions:

- get platform billing/access settings
- create access checkout
- confirm access payment
- listen to EVM payment events
- listen to Solana payment events
- verify transaction finality
- reject suspicious payment event
- grant paid school access
- grant paid class access
- grant paid crew access
- evaluate access policy
- revoke access by policy
- create access override
- ban or suspend entity
- waive verification fee
- grant verification badge
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
- global company billing toggle must override local billing rules
- server-side access checks must read database settings before granting paid/free access
- crypto payment success must be verified from real onchain events before access can be created
- payment success creates access only if policy allows it
- company/admin bans and suspensions override paid access
- all company overrides must be audit logged
- embedded wallet state must never be the only access source of truth
- contracts/programs must be audited or reviewed before production funds are accepted
- teachers and students should still be able to use the app without public publishing
- crypto rails should be modular, not hardcoded into every payment flow
- traditional finance should be a first-class option
- company review tools are separate from school admin tools
- verification is optional, not required for normal learning

## Build Order

Recommended order now that the UI foundation is in place:

1. Add platform settings for global billing toggle, platform fee, payment rails, and policy controls.
2. Add company/admin control tables for bans, suspensions, overrides, audit logs, and verification waivers.
3. Add access product model for free/paid schools, classes, subjects, and crews.
4. Add server-side access policy evaluation.
5. Add school/class/crew pricing settings in admin.
6. Add embedded wallet identity model for email-based crypto use.
7. Design EVM smart contracts and Solana programs for payments, fees, events, and anti-fraud.
8. Add onchain event listeners and transaction verification.
9. Add payment checkout and access-pass granting.
10. Add school revenue and Chivo platform-fee ledger.
11. Add public profile primitives for people and schools.
12. Add public publishing editor and public reader.
13. Add follow system and public discovery feeds.
14. Add AI review queue and approved/open feed split.
15. Add verification requests, verification plans, and manual badge controls.
16. Add donations and monthly creator rewards.

## Current Decision

Group 4 is the next product direction.

Current priority remains:

- keep the existing student/teacher/school foundation working
- begin database-driven company control and billing/payment design as the first 2.0 bridge into gated schools/classes
- add free/paid access models without breaking free school/class flows
- support embedded email-based wallet onboarding for EVM chains and Solana
- verify crypto payments through real onchain contract/program events
- make company/admin policy controls stronger than payment history
- test native and web behavior as each 2.0 layer touches access, joining, admin, or public profiles
- postpone the public marketplace and rewards layer until paid access is stable
