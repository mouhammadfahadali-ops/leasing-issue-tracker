# Leasing Matters

Internal web app for Dolmen's Leasing & Contracts team to track leasing issues across all
four malls (DMC, DMTR, DMH, DML). Plain HTML/CSS/JS — no framework, no build step.

**Architecture:** UI → DAL (`window.App.DAL`, all async) → storage. Two interchangeable
back ends selected by `js/config.js`:

| Mode | `?storage=` | Back end |
|---|---|---|
| `sharepoint` (default) | `?storage=sharepoint` | Microsoft sign-in (MSAL) + the SharePoint lists on `sites/DolmenLeasing` |
| `local` | `?storage=local` | browser localStorage + 19 seeded demo issues (offline demo, no login) |

Every UI component is identical in both modes — only the DAL + storage scripts differ.

Live: <https://mouhammadfahadali-ops.github.io/leasing-issue-tracker/>

## Theming

Light + dark, driven entirely by CSS variables in `css/variables.css`:
`:root` = light, `:root[data-theme="dark"]` = dark, and OS-dark applies when the
user hasn't chosen. The header toggle (`js/components/themeToggle.js`) sets
`<html data-theme>` and remembers the choice in `localStorage`; a tiny inline
script in `index.html <head>` applies it before first paint (no flash). No
component hard-codes a colour — restyle the whole app from `variables.css` alone.

## Files

```
index.html                       The app. Loads the SharePoint or local stack per js/config.js
phase1-test.html                 Phase 1 test — Entra sign-in + one authenticated SharePoint call
phase2-test.html                 Phase 2 test — Issues list read / edit / resolve / re-open
phase3-test.html                 Phase 3 test — Counters + collision-proof Issue ID generation + create
schema-check.html                Signed-in dump of every column (internal name + type) in all 3 lists
migrate.html                     Phase 7 — one-time load of the 19 seed issues + history + counters

js/config.js                     STORAGE_MODE switch + shared constants
js/utils.js  js/dal/validation.js  js/state/appState.js   Shared, mode-independent
js/components/*.js                The UI (unchanged from the V1 prototype bar 2 mode-aware tweaks)
css/*.css                        The V1 Apple/iOS glass design system (untouched)

  — SharePoint stack —
js/auth/authService.js           MSAL.js wrapper — sign-in, logout, silent token acquisition
js/auth/authGate.js              Full-screen glass sign-in panel; gates the app until signed in
js/storage/sharePointAdapter.js  Issues-list REST calls, field mapping, ETag concurrency, createIssue
js/storage/counterService.js     Counters-list Issue ID reservation (retry-on-412 safe increment)
js/storage/activityLogAdapter.js ActivityLog list — append-only audit trail
js/dal/issuesApiSharePoint.js    The DAL, SharePoint edition (in-memory mirror + write-through)

  — local demo stack —
js/storage/mockData.js  js/storage/localStorageAdapter.js  js/dal/idGenerator.js
js/dal/issuesApiLocal.js         The DAL, localStorage edition (the original V1 issuesApi.js)
```

`sharePointAdapter.js` exposes a low-level `window.App.SP` helper
(`request`, `getEntityType`, `SITE_URL`) that `counterService.js` and
`activityLogAdapter.js` build on, so the REST plumbing lives in one place.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Entra/MSAL authentication | ✅ done & live-tested |
| 2 | Issues adapter — read / edit / resolve / re-open | ✅ done & live-tested |
| 3 | Counters — collision-proof Issue ID generation + `createIssue` | ✅ built — awaiting live test |
| — | **V1 glassmorphism UI wired to SharePoint** (real DAL, auth gate, real user) | ✅ built — awaiting live test |
| 4 | ActivityLog audit trail | ✅ built into the SharePoint DAL — awaiting live test + column-map confirmation |
| 5 | Dashboard KPIs + Recent Activity from real data | ✅ runs on real data via the SharePoint DAL — awaiting live test |
| 6 | Export to CSV (opens in Excel) | ✅ built — "Export CSV" on Active Issues + Resolved/Archive, respects current filters |
| 7 | One-time migration of the 19 demo issues | ✅ built — `migrate.html` (idempotent, dry-run preflight, typed confirm); awaiting live run |
| 8 | Final polish — friendly errors, edge cases, full test pass | error handling done; full test pass needs the live run |
| — | Light + dark premium glass theme upgrade | ✅ built — token system + header toggle (localStorage, no-FOUC); full per-screen visual sweep still worth doing live |

The official Dolmen logo goes in `assets/` (see `assets/README.md`). Until it's
added the header shows an "LM" placeholder and the browser console logs a
harmless 404 for the missing image.

## How Issue IDs work (Phase 3)

Format: `DMC-2026-0001` — `<mallCode>-<year>-<4-digit running sequence>`, counted
per mall per year.

The sequence lives in the SharePoint **Counters** list (one row per Mall+Year,
column `LastSequence`). Reserving the next ID is a read-add-write, which would race
if two people create an issue at the same moment. `counterService.js` makes it safe
with SharePoint's own optimistic concurrency — no server-side code:

1. `GET` the counter row (returns an ETag).
2. `MERGE` `LastSequence + 1` with `IF-MATCH: <that ETag>`.
3. If someone wrote first, SharePoint returns **HTTP 412**; wait a random 40–160 ms
   and retry from step 1 with the fresh value (up to 12 attempts).

`phase3-test.html` section B fires 5 `getNextIssueId()` calls at once and asserts the
results are 5 distinct, gap-free sequence numbers.

## Testing

Sign-in only works from the deployed GitHub Pages origin (the Entra redirect URI is
registered for that exact URL), so SharePoint testing is: push to `main` → wait for
Pages to publish → open the site and sign in.

Locally you can still run the full app in demo mode with no login:
`index.html?storage=local`. Serving from `localhost` in `sharepoint` mode only gets
you as far as the sign-in screen.

### First live SharePoint run — order of checks

1. Open `schema-check.html`, sign in. Confirm the **ActivityLog** and **Counters**
   internal column names match the maps in `js/storage/activityLogAdapter.js`
   (`FIELD_MAP`) and `js/storage/counterService.js`. Adjust if they differ.
2. Fix the choice columns below.
3. Open `index.html`, sign in, exercise Dashboard / Active / Archive / New Issue /
   Issue Detail / re-open. Watch the browser console.

## Known data fix-ups still needed in SharePoint

- `CreatedByUser` choice column has wrong values (`Fahad, Faisal, Kamal, Leasing`) —
  should be `Fahad, Ali, Ahmed, Sara` (same fix already applied to `AssignedTo`).
- `ResolvedBy` choice column — not yet verified, likely the same problem.

## Key IDs

| | |
|---|---|
| SharePoint site | `https://dolmengroupcom.sharepoint.com/sites/DolmenLeasing` |
| Entra Client ID | `e2d59c4f-5981-4cf5-a2e9-f72e1898a86d` |
| Entra Tenant ID | `2e13ddab-e83e-4fa8-91cf-4a601cdaa57d` |
