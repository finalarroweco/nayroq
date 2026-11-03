# Customer service review build

Routes:
- `/service`: company-scoped conversation counts, last 100 conversations, search, open/team filters, links into inbox.
- `/service/tickets`: persistent tickets, status, priority, customer details, internal notes and assignee labels. Last 200 tickets. Editing checks `updated_at` to detect concurrent edits.
- `/service/team`: one-use invitations, agent/manager access, suspension and restoration.
- `/service/reports`: exact UTC calendar-month conversation/ticket counts and current active member count.
- `/service/configuration`: persistent assistant settings (owner/manager) and owner-only authenticated text sandbox using saved settings and the latest 20 knowledge entries (bounded context).
- Existing `/inbox`, `/knowledge`, `/employees`, `/integrations`, `/analytics`, `/billing` remain available.

The assignee field is a tracking label. `/service/team` supports existing signed-in users joining through a private, one-use 24-hour code. Owners issue invitations and suspend/restore members; agents access conversations/tickets and managers additionally access service settings. All permission checks use database membership, so suspension takes effect without waiting for JWT expiry. Invitations are hashed at rest in the private schema and redemption locks/consumes the invitation atomically.

## Database

Migration `supabase/migrations/20261103114117_customer_service_workspace.sql` is additive and has been applied to NAYROQ. It adds service tickets, settings, test request accounting and an invoker RPC for reserving test quota. The existing tables and policies are preserved. Anonymous access is revoked. Every service row is scoped to the authenticated company owner. Reservations allow 10 tests/minute and 100/day per user; unsuccessful provider attempts count toward the limit. Database clients cannot supply request timestamps or reset their ledger.

The existing deployment AI key was enabled for preview use without reading its value. Tests use `OPENAI_SERVICE_MODEL`, defaulting to `gpt-4.1-mini`, independently of the legacy chat model. No new key was created.

## Validation

- TypeScript passed.
- TypeScript and Next.js production builds passed, including team access, close/reopen and reports.
- Live transaction tests passed: owner read/update, settings save, cross-company read/write denial, quota reservation and enforcement. Fixtures were rolled back.
- Live team tests passed for invitation redemption/replay rejection, agent access, manager-setting denial, suspension, handoff/reply/close, spoof prevention and record identity protection.
- Existing database advisors report unrelated password protection and billing function search_path warnings. Private invitation storage intentionally denies all direct client access.

## Remaining work before commercial release

- Telephony provider, number/SIP routing, inbound call handling, signature verification, audio session integration, live human transfer, call logging and recordings.
- Per-company channel credentials, production Meta approvals and end-to-end delivery tests.
- Consumption-based commercial packages, metered voice billing and enforcement.
- Private invite storage intentionally has RLS with no direct client policies. Private security-definer functions check auth and company ownership, fix search_path, and revoke public/anon execution.
- Voice runtime must consume and enforce the saved settings; saving settings does not activate phone features.
- Authenticated browser and real AI response checks still require a signed-in review session.

This is a review build, not a completed commercial call center.
