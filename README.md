# Leasing Issue Tracker

Internal web app for Dolmen's Leasing & Contracts team to track leasing issues across all
four malls (DMC, DMTR, DMH, DML). Plain HTML/CSS/JS — no framework, no build step.

**Architecture:** UI → DAL → Storage Adapter. Production storage is SharePoint
(`sites/DolmenLeasing`), reached over the REST API with an Entra/MSAL Bearer token.

Live: <https://mouhammadfahadali-ops.github.io/leasing-issue-tracker/>

## Files

```
index.html                     Phase 1 test — Entra sign-in + one authenticated SharePoint call
phase2-test.html               Phase 2 test — Issues list read / edit / resolve / re-open
phase3-test.html               Phase 3 test — Counters + collision-proof Issue ID generation + create
js/auth/authService.js         MSAL.js wrapper — sign-in, silent token acquisition
js/storage/sharePointAdapter.js  Issues-list REST calls, field mapping, ETag concurrency, createIssue
js/storage/counterService.js   Counters-list Issue ID reservation (retry-on-412 safe increment)
```

`sharePointAdapter.js` also exposes a low-level `window.App.SP` helper
(`request`, `getEntityType`, `SITE_URL`) that `counterService.js` builds on, so the
REST plumbing lives in one place.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Entra/MSAL authentication | ✅ done & live-tested |
| 2 | Issues adapter — read / edit / resolve / re-open | ✅ done & live-tested |
| 3 | Counters — collision-proof Issue ID generation + `createIssue` | ✅ built — awaiting live test |
| 4 | ActivityLog — write the audit trail on every change | not started |
| 5 | Dashboard KPIs + Recent Activity from real data | not started |
| 6 | Export to Excel/CSV | not started |
| 7 | One-time migration of the 19 demo issues | not started |
| 8 | Final polish — friendly errors, edge cases, full test pass | not started |

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
registered for that exact URL), so testing is: push to `main` → wait for Pages to
publish → open the relevant `*-test.html` on the live site and sign in.

Serving the files from `localhost` is only useful for checking that the scripts parse
and load — the sign-in step will not complete.

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
