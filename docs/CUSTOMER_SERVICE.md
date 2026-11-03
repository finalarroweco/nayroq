# Customer service review build

Routes:
- `/service`: company-scoped conversation counts, last 100 conversations, search, open/team filters, links into inbox.
- `/service/tickets`: persistent tickets, status, priority, customer details, internal notes and assignee labels. Last 200 tickets. Editing checks `updated_at` to detect concurrent edits.
- `/service/configuration`: persistent assistant settings and authenticated text sandbox using saved settings and the latest 20 knowledge entries (bounded context).
- Existing `/inbox`, `/knowledge`, `/employees`, `/integrations`, `/analytics`, `/billing` remain available.

The assignee field is a tracking label. Staff accounts and role-based membership are not implemented by this release. Current access uses company ownership.

## Database

Migration `supabase/migrations/20261103114117_customer_service_workspace.sql` is additive and has been applied to NAYROQ. It adds service tickets, settings, test request accounting and an invoker RPC for reserving test quota. The existing tables and policies are preserved. Anonymous access is revoked. Every service row is scoped to the authenticated company owner. Reservations allow 10 tests/minute and 100/day per user; unsuccessful provider attempts count toward the limit. Database clients cannot supply request timestamps or reset their ledger.

The existing deployment AI key was enabled for preview use without reading its value. Tests use `OPENAI_SERVICE_MODEL`, defaulting to `gpt-4.1-mini`, independently of the legacy chat model. No new key was created.

## Validation

- TypeScript passed.
- Next.js production build passed before the final quota guard; final build is run again before publication.
- Live transaction tests passed: owner read/update, settings save, cross-company read/write denial, quota reservation and enforcement. Fixtures were rolled back.
- Existing database advisors report unrelated password protection and billing function search_path warnings; no service table warning was found.

## Remaining work before commercial release

- Telephony provider, number/SIP routing, inbound call handling, signature verification, audio session integration, live human transfer, call logging and recordings.
- Staff invitations/login and membership-based access throughout the inbox and message delivery APIs.
- Per-company channel credentials, production Meta approvals and end-to-end delivery tests.
- Consumption-based commercial packages, metered voice billing and enforcement.
- Voice runtime must consume and enforce the saved settings; saving settings does not activate phone features.
- Authenticated browser and real AI response checks still require a signed-in review session.

This is a review build, not a completed commercial call center.
