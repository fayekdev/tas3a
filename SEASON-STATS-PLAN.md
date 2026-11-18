# Season stats implementation and review

1. Remove the personal Attendance page's My team editor. Retain existing team data in backups and CSV exports.
2. Constrain native date controls and their WebKit value box; keep touch fields at 16px and test narrow English/Arabic layouts.
3. Publish administrator-managed season snapshots through the protected program document. A security-invoker view calls a guarded private projection: admins receive complete snapshots; scouts receive Patrouille aggregates and their own records only. Raw program reads and writes require an administrator.
4. Refresh seasonal attendance and badge totals through an admin-only database projection. Return no badge notes, account emails, usernames, map drafts or handbook data. Keep manual tardiness and historical Patrouille membership when refreshing.
5. Provide season creation, renaming, archiving/reopening, Home selection, scout/patrouille filters, and individual history across seasons. Lock dates once scout records are published so historical totals retain their meaning. Leave missing data explicitly unset.
6. Show all active Patrouilles in the Home slideshow and Stats scoreboard. Points are explicitly entered by administrators; tied scores share a rank. Apply Panthère purple/black, Gazelle yellow/blue, Lion red/yellow, Renard red/black, Loup black/red.
7. Preserve concurrent approved edits: automatic three-slide slideshow without visible controls (4-second interval, animated transitions, swipe/keyboard navigation), page-name-only header, no saved-status message on Home, and the separate Trophy hall implementation.

## Data semantics

- Attendance totals include only recorded self check-ins within the season, through today in Cairo. A missing check-in is not silently counted as absence.
- Completed badges are self-reported and counted by their saved completion date. Awarded badges use the recorded presentation date; awards without a date are excluded from automatic season assignment. Admins can correct totals explicitly.
- Tardiness starts unset and is entered by admins. The `extra` metric map provides storage for later statistics without changing historical records.
- The first refresh uses the current roster. Subsequent refreshes preserve each scout's initial season Patrouille assignment. Archived seasons cannot be refreshed or edited until reopened.
- Refresh replaces attendance/badge totals; it keeps manual tardiness, extra metrics and scoreboard points. Missing source documents produce missing totals. A failed refresh preserves the previous snapshot.
- Shared program documents retain their existing latest-save concurrency semantics. Avoid simultaneous program editing on different devices.

## Local review

Run `node .build-tools/stats-review.mjs` from the repository, then open `http://127.0.0.1:5174/`. This ignored review harness injects sample data, supports admin/scout switching, stores edits only in that browser, and intercepts Supabase requests. It does not alter production records. The regular app remains available through the ordinary Vite development command.

## Verification

- `node --experimental-strip-types --test tests/*.test.ts`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/vite/bin/vite.js build`
- `PLAYWRIGHT_EDGE=1 node node_modules/@playwright/test/cli.js test`
- `PLAYWRIGHT_WEBKIT=1 PLAYWRIGHT_BROWSERS_PATH=.build-tools/browsers node node_modules/@playwright/test/cli.js test tests/browser/season-stats.spec.ts`
- Install `@electric-sql/pglite@0.3.14` under `.build-tools/stats-db`, then run `node tests/season-stats-db.mjs`. This applies the complete application schema to an isolated Postgres runtime and checks aggregation, dates, missing data, RPC access, private document isolation, and snapshot permissions.

Verification completed locally: 13 unit/data tests, 50 production-build browser flows, 12 mobile WebKit flows, TypeScript and the production build, plus the isolated Postgres suite. The production-build regression suite covers the combined current workspace, including the concurrent Trophy hall edits. Live account provisioning remains opt-in and is not run for this local review.

## Release

The user approved pushing after the follow-up changes. Apply `supabase/season-stats.sql`, verify deployed function/view permissions and unchanged attendance/badge workflows, then commit/push the source. Member reads now use `member_program_content`; this database update must precede the frontend release. Existing program and personal data are preserved. No QA accounts or production sample records are created.

## Leadership attendance follow-up

- Attendance is a shared, daily register restricted to Chief and Assistant scout roles, with no administrator override. Scouts see Stats instead in navigation.
- `attendance_records` stores presence, late minutes, date, recorder and update time. Guarded RPCs fetch the roster and save edited rows atomically. RLS blocks self-check-ins and exposes raw attendance rows only to the owner and leadership.
- `season_stats_records` fetches current seasonal totals automatically. Members receive only their own record plus Patrouille aggregates; admins receive individual summaries. New live records override stale published counts, including after an official mark is cleared. Legacy check-ins remain read-only and are not double-counted.
- Add `supabase/leadership-attendance.sql` after the existing seasonal schema. The migration retains stored documents and does not fabricate or backfill attendance.
- Local checks: 17 unit/data tests, isolated database tests, the 61-flow regression run, plus focused retry/backups/register tests. Edge mobile English/Arabic layouts pass. WebKit exits before page creation on this machine, so the follow-up Safari check could not run.
