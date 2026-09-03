/* ==========================================================================
   activityLogAdapter.js — the permanent audit trail, on the SharePoint
   "ActivityLog" list. Append-only: every meaningful change writes one row
   and nothing is ever edited or deleted.

   Builds on window.App.SP (low-level REST helper from sharePointAdapter.js).
   Exposed on window.App.ActivityLog

   ┌──────────────────────────────────────────────────────────────────────┐
   │  COLUMN MAP — verify these SharePoint *internal* names once against   │
   │  the real list (open schema-check.html while signed in). Adjust the   │
   │  right-hand side here if the list uses different internal names.      │
   └──────────────────────────────────────────────────────────────────────┘
   ========================================================================== */

(function () {
  window.App = window.App || {};

  const LIST = (window.App.Config && window.App.Config.LISTS.activityLog) || "ActivityLog";

  // app field  ->  SharePoint internal column name
  const FIELD_MAP = {
    entryId: "Title",
    timestamp: "EntryTimestamp",
    issueId: "IssueId",
    actor: "Actor",
    action: "ActionType",
    field: "FieldName",
    from: "FromValue",
    to: "ToValue",
    comment: "Comment",
    waitingReason: "WaitingReason",
  };

  const SP = () => {
    if (!window.App.SP) throw new Error("sharePointAdapter.js must load before activityLogAdapter.js.");
    return window.App.SP;
  };
  const U = () => window.App.Utils;

  function itemsPath() {
    return "web/lists/getbytitle('" + LIST + "')/items";
  }

  function mapRowToEntry(row) {
    return {
      entryId: row[FIELD_MAP.entryId],
      timestamp: row[FIELD_MAP.timestamp] || row.Created,
      issueId: row[FIELD_MAP.issueId],
      actor: row[FIELD_MAP.actor],
      action: row[FIELD_MAP.action],
      field: row[FIELD_MAP.field] || null,
      from: row[FIELD_MAP.from] || null,
      to: row[FIELD_MAP.to] || null,
      comment: row[FIELD_MAP.comment] || null,
      waitingReason: row[FIELD_MAP.waitingReason] || null,
      _spId: row.Id,
    };
  }

  function mapEntryToRow(entry) {
    const row = {};
    row[FIELD_MAP.entryId] = entry.entryId;
    row[FIELD_MAP.timestamp] = entry.timestamp;
    row[FIELD_MAP.issueId] = entry.issueId;
    row[FIELD_MAP.actor] = entry.actor || null;
    row[FIELD_MAP.action] = entry.action || null;
    row[FIELD_MAP.field] = entry.field || null;
    row[FIELD_MAP.from] = entry.from === undefined ? null : entry.from;
    row[FIELD_MAP.to] = entry.to === undefined ? null : entry.to;
    row[FIELD_MAP.comment] = entry.comment || null;
    row[FIELD_MAP.waitingReason] = entry.waitingReason || null;
    return row;
  }

  // Pull the whole log (paged). The app keeps it in memory and filters
  // client-side, same as the localStorage version did.
  async function getAll() {
    const out = [];
    let path = itemsPath() + "?$top=5000&$orderby=Id asc";
    while (path) {
      const data = await SP().request(path);
      (data.d.results || []).forEach((r) => out.push(mapRowToEntry(r)));
      const nextUrl = data.d.__next || null;
      path = nextUrl ? nextUrl.replace(/^.*\/_api\//, "") : null;
    }
    return out;
  }

  async function getForIssue(issueId) {
    const safe = String(issueId).replace(/'/g, "''");
    const data = await SP().request(
      itemsPath() + "?$top=5000&$filter=" + FIELD_MAP.issueId + " eq '" + safe + "'"
    );
    return (data.d.results || []).map(mapRowToEntry);
  }

  // Append one entry. entryId/timestamp are filled in if the caller didn't.
  async function append(entry) {
    const complete = Object.assign(
      {
        entryId: "act-" + (U() ? U().generateId() : Date.now().toString(36)),
        timestamp: new Date().toISOString(),
      },
      entry
    );

    const entityType = await SP().getEntityType(LIST);
    const body = Object.assign({ __metadata: { type: entityType } }, mapEntryToRow(complete));

    const data = await SP().request(itemsPath(), { method: "POST", body: body });
    return data && data.d ? mapRowToEntry(data.d) : complete;
  }

  window.App.ActivityLog = {
    FIELD_MAP,
    getAll,
    getForIssue,
    append,
  };
})();
