# tas3a / تاسعة

Attendance and live records: **Chief** and **Assistant** accounts use Attendance to select a meeting date, mark each scout Present, Late (with minutes), or Absent, and **Save register**. Unmarked scouts are excluded from absence totals. Save failures keep edits; changing dates or navigating away warns about unsaved work. Saved daily registers export as CSV. Administrators without one of those two scout roles cannot use the tracker. Additional meeting dates remain an administrator setting under Administration.

Active-season personal and Patrouille statistics fetch records automatically on opening Home/Stats, returning to the app, reconnecting, or saving attendance. Counts include attendance, absences, attendance rate, late arrivals, total late minutes, completed badges and awarded badges. Registered scouts appear without first publishing a manual snapshot. Points remain manually managed. Archived seasons retain their snapshots. Existing historical self-check-ins are preserved, with leader records taking precedence on the same date. Legacy device data stays exportable but cannot be used to overwrite the official register. Apply `supabase/leadership-attendance.sql` after `season-stats.sql` on a new backend. `node tests/leadership-attendance-db.mjs` verifies role access, atomic writes, date/minute validation, attribution, live stats and privacy in isolated Postgres.

Season stats: signed-in scouts see Patrouille totals and a scores-only podium under **Season stats**. Home rotates every four seconds between the season artwork, the scores-only podium, and the caller’s own season stats, with fade/slide transitions, swipe/keyboard navigation, hover/focus pause, and reduced-motion support. Administrators create/archive seasons, publish attendance/badge history and set active Patrouille scores. Presence and late minutes are recorded by Chiefs/Assistants through the tracker. Initial roster assignments and manual tardiness are preserved on refresh. Individual scout management remains admin-only. Member program reads use a protected projection that exposes aggregate Patrouille totals and only the caller’s personal snapshot; raw program reads and writes require an administrator. Apply `supabase/season-stats.sql` after the existing schema scripts on a new backend. The shared IX drawing loader covers startup, page loads and pending account/data operations.

Verification: 13 unit/data tests, 50 production-build browser flows (one optional live-account lifecycle test skipped), 12 mobile WebKit flows, TypeScript, production build, and isolated Postgres checks for season projections, admin access, private data, and badge/attendance compatibility.

Medallions: members open **Trophy hall** to see only their earned awards in a compact grid. Select a medallion for its citation, season or habit, recipient and award date. Administrators issue awards under **Administration → Award medallions** by choosing a scout and award type, then entering a season/habit and citation. The same scout cannot receive the same type for the same season/habit twice (case-insensitive). Administrators can revoke an award from its details dialog. The `medallion_awards` migration is applied to the connected backend; for a new backend, apply `supabase/medallion-awards.sql` after `requests-and-accounts.sql`. Database permissions enforce personal reads and administrator-only issuance/revocation. Verify with `node tests/medallion-awards-db.mjs` and `tests/browser/medallions.spec.ts`.

English/Arabic scout app built with React, TypeScript, Vite and Supabase. Deploy the frontend on Vercel from your own GitHub repository. No Sites runtime or ChatGPT sign-in is used.

## Run locally

Use Node 24 LTS. Install dependencies with `npm install`, then run `npm run dev`. Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_SUPABASE_URL=https://jqrougqghcecxhhvywyx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The publishable key belongs in browser code. Never put a service-role key, secret key, database password, or account password in a `VITE_` variable, Git, or a CSV file.

## Deploy on Vercel

1. Push the contents of this `scout-hub` directory to GitHub. If you push the parent directory, set Vercel's Root Directory to `scout-hub`.
2. Import the repository in Vercel, select Vite, use `npm run build` and output directory `dist`.
3. Set the two `VITE_` variables above in Vercel for the environments you deploy. Use Node 24.
4. Deploy. Environment variables are compiled into the frontend; redeploy after changing them.

The Supabase backend is already configured on project `jqrougqghcecxhhvywyx`. The `manage-accounts` Edge Function is already deployed. Its service credential is provided by Supabase only inside the function; Vercel does not need it.

## Maintainer login

Sign in with the existing maintainer account and the password you set in Supabase. There is no public account-registration flow. Database signup triggers reject accounts not provisioned by the maintainer backend.

Maintainership and scout roles are separate. `Chief`, `Assistant`, `CP`, `SP`, `TP`, and `Patrouillard` are the exact supported scout roles. None grants app administration. Only rows in `admin_users` grant maintainership, and browser clients cannot write to that table. To authorize another maintainer, use trusted Supabase SQL or the dashboard; do not grant administrator access merely by selecting Chief.

## Accounts without signup emails

In Administration, choose **Create account**. Enter a unique username, display name, scout role, optional Patrouille, and optional initial password. An omitted password is generated. The result displays the credentials once; hand them to the scout securely. Accounts log in with their username and password immediately. No invitation, signup, confirmation, or recovery email is sent.

`accounts` is a regular database table holding names, usernames, and scout roles. Password hashes and sessions are handled by Supabase Auth, not stored in this table. Internal addresses such as `username@scout-hub.invalid` are login identifiers only, not mailboxes. The maintainer account can log in with its actual email.

Scouts can change their password in My Account. A maintainer can reset passwords in Administration. If a generated credential response is lost, use password reset rather than creating the username again. Resetting a password does not guarantee immediate revocation of every previously issued JWT; use Supabase's session controls for a compromised account.

## Import accounts from a CSV table

In Supabase Table Editor, import a CSV into **account_imports**, with these columns:

```csv
username,display_name,scout_role,patrouille_name
scout.example,Example Scout,Patrouillard,
leader.example,Example Leader,CP,Eagles
```

Use lowercase usernames of 3–40 characters: letters, numbers, `.`, `_`, `-`; the first character must be a letter or number. `patrouille_name` is optional; if supplied, it must match an existing Patrouille name (case insensitive). All six scout roles are supported. Blank CSV cells for optional Patrouille should import as SQL NULL. Do not import passwords. Leave generated IDs, timestamps and status columns unmapped.

Then open Administration and click **Process CSV imports**. Each click processes up to 20 pending rows. A database claim prevents concurrent processing of the same row. Credentials are generated during processing and shown once in the admin page. Save them before closing or refreshing the page. Database import alone queues the account; processing is what creates the login.

Rows expose `pending`, `processing`, `complete`, or `failed` status in Supabase. Failed rows include the error. To retry a corrected failed row, inspect `user_id` first. If it is NULL and there is no existing account with that username, fix the data and set its status back to `pending` in Supabase. A row stuck in processing after an interrupted request needs manual inspection: if an Auth user exists, resolve that account before requeueing. Never blindly retry a partially provisioned account.

Importing directly into `accounts` does not create authentication credentials. Use `account_imports` for new logins. Use the administrator dropdown to change existing scout roles; ordinary users can update only their own display name.

## Patrouilles and access

Maintainers can create Patrouilles, choose an emblem and motto, assign an initial leader, add registered accounts, and remove members. Patrouille names are unique ignoring case and surrounding spaces. Each account can belong to one Patrouille. CP is the default roster leader when imported with a Patrouille; roster leadership can also be assigned separately.

Row-level security enforces all access in Postgres. Maintainers can see and manage all records. Scouts can see their own account, their own roster membership, and their assigned Patrouille. They cannot read the full troop roster. Only maintainers read the audit trail or provision accounts. The backend verifies the Supabase access token and checks `admin_users` for every provisioning/reset request.

## Backend source

The foundation migration is in `supabase/migrations`. The subsequent applied changes are recorded in `roles-and-imports.sql`, `permission-hardening.sql`, `feature-storage.sql`, and `requests-and-accounts.sql`, in that order. They are already applied to your project; do not run them again there. For a new project, apply those files in order and deploy `supabase/functions/manage-accounts/index.ts`. The function performs its own `auth.getUser(token)` authentication and maintainer check; JWT gateway verification is disabled so modern publishable-key requests reach that check. Do not remove its authentication or role checks.

To initialize a different project, apply the foundation migration first, create the first user with the Supabase Auth admin interface and Auto Confirm enabled, then insert its actual Auth UUID into `admin_users` using trusted SQL. Only then apply `roles-and-imports.sql` and `permission-hardening.sql`, since the former disables unprovisioned signups. Existing project admin grants are data and intentionally are not embedded into schema migrations.

## Verification and current scope

- `npm test`: Morse conversion, unsupported characters, Patrouille input validation, exact scout roles.
- `npm run build`: TypeScript check and production build.
- `npx playwright install chromium`, then `npx playwright test`: the sign-in gate, blocked signed-out routes, sign-in/out, saved sessions, authenticated feature flows, Morse conversion, mobile Arabic RTL and overflow. On Windows with Edge installed, set `PLAYWRIGHT_EDGE=1` to avoid downloading Chromium.
- `tests/access.sql`: transactional database tests of maintainer writes, scout isolation, blocked role/admin escalation, import restrictions, and anonymous access. Tests roll back all fixture data.

The normal interface tests use signed-out or mocked authenticated sessions; the separate approved live account lifecycle test is documented below. Supabase's security advisor reports leaked-password protection is currently disabled. Enable it in Supabase Auth if your plan supports it. Generated passwords use cryptographic randomness; supplied passwords require at least 12 characters.

The original features are restored: all 78 bilingual badges with minimalist line icons, checklists, notes, filters and scanned pages; Latin and Arabic Morse with audio; sketch maps with 90 symbols, drawing, text, arrows, object editing, undo/redo, saved drafts, voyage steps and PNG export; the Arabic-only handbook; personal and team attendance with CSV export; completed badges and maintainer-managed achievement photo galleries. Maintainers can also edit badge and handbook content, add badges and symbols, and hide or restore badges. See CONTENT-SOURCES.md for provenance.

Implementation references: [Supabase admin account creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [password security](https://supabase.com/docs/guides/auth/password-security), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).


## Saved work

Sign-in is required before opening any app page. Signed-out users see the username/password screen, including when opening a direct page link. A saved session restores the app, and signing out returns to sign-in. Arabic and English are available on the sign-in screen. Signed-in scouts keep separate account data and sync badges, map drafts, attendance and bookmarks to Supabase. Use My account → Export backup / Restore backup to transfer saved work.

Each feature retains a device copy and shows saving, saved or sync-error status. Retry after a failed request or reconnect to sync pending changes. Feature documents use the latest successful save; avoid editing the same feature on two devices simultaneously. Export a backup before clearing browser storage. Loading the application for the first time still requires a connection.

`feature-storage.sql` is already applied to the configured project. RLS restricts personal documents to their owner, and shared program edits to maintainers. Troop achievements are available to signed-in members. Images are resized in the browser before storage; galleries support up to 10 photos.

Verification on 14 November 2026: 6 unit/data tests, 7 browser flows, TypeScript and production build, plus transactional live database checks for document ownership, blocked ownership reassignment, protected program edits, and anonymous access. The maintainer browser flow uses a mocked authenticated session; real account credentials were not used. Database fixtures roll back.

## Account and meeting updates

The `requests-and-accounts.sql` changes (including the attendance history upsert fix) are applied to the configured Supabase project and `manage-accounts` version 2 is deployed. Keep the same order when initializing another project. Its one-time provisioning token is restricted to the server; it permits Auth to insert a provisioned account before attaching app metadata. Public signup remains blocked. Failed account jobs with no retained Auth user can be retried through Create account with the same username.

Administration appears only for maintainers. Account editing changes display name, scout role and Patrouille; usernames remain stable. Deleting a non-administrator account deletes its login, profile, membership and personal saved work. Administrator accounts cannot be deleted through this interface. Creation still asks for a username, never a scout email address, and displays generated credentials once. No confirmation email is needed.

After all requirements are saved, a signed-in scout can request badge presentation from either the badge page or Achievements. Requests appear as meeting events on Home for the requester and for Chief, Assistant and maintainer accounts. Chiefs and Assistants can schedule presentation or mark the badge awarded. Each account can submit one request per badge. Requirements are checked in Postgres against the published catalog/custom badge requirements and saved progress. The badge remains self-tracked until leadership marks it awarded.

Maintainers manage the recent-events banner on Home and additional attendance dates on Attendance. New attendance entries are restricted in the interface and database to Fridays or those additional dates, with no future check-ins. Handbook text, search and editing use Arabic regardless of the app language. Existing Gazelle and Panthère Patrouilles use their matching animal icons, and maintainers can change an existing Patrouille emblem in its roster dialog.

Morse supports audio, full-screen light flashes and the rear camera flashlight where the browser exposes torch support. Flashlight access requires HTTPS (or localhost), camera permission and a supported device. Unsupported cameras show an explicit screen-mode alternative. Stop, Escape, navigation or hiding the page ends light playback and releases the camera. Physical flashlight output still requires verification on a supported phone.

Verification before the sign-in-only update on 14 November 2026: 8 unit/data tests, 18 production-build guest/mocked browser flows, TypeScript, Vite production build, both transactional database suites, and a separate real account lifecycle test against the deployed Supabase backend. The live test created a scout through the actual username-only browser form, logged in all six scout roles, checked authorization and row isolation, completed the Chief/Assistant badge workflow, edited an account, reset its password, deleted it, and verified deletion access restrictions. All 78 badge icons and source images, Arabic layouts, backup restoration, failed-save recovery, event editing/deletion, map editing/export, Morse audio, screen flashing and simulated torch constraints were exercised.

The explicitly approved temporary live administrator, scout accounts, Patrouille, imports, related application audit entries and local credential file were removed after testing. Database checks confirmed zero remaining QA Auth users, accounts, admin grants, imports and Patrouilles. The live test in `tests/browser/live-backend.spec.ts` intentionally skips unless an approved fixture exists in `.build-tools/live-qa-fixture.json`; the normal 21-browser-test suite needs no live credentials. Wrap `tests/new-features.sql` in `begin; ... rollback;`.

Physical camera flashlight output still needs a supported phone; desktop tests verify pulse constraints, unsupported-device handling and camera release. The pre-existing Supabase warning about disabled leaked-password protection remains.

Sign-in-only update verification: TypeScript and production build passed, along with 21 browser flows. Coverage includes all signed-out routes, a non-dismissible sign-in page, invalid credentials, successful username login, preserved destination links, sign-out, saved sessions, Arabic/mobile layout and authenticated feature regressions. The separate live-backend test was updated for the new entry screen; it remains opt-in and was not rerun for this UI-only change.
