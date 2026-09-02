/* ==========================================================================
   sharePointAdapter.js — Phase 2: real Issues list operations.
   Talks to the SharePoint REST API using a Bearer token from AuthService
   (Entra/MSAL). Per Microsoft's own docs, X-RequestDigest is NOT required
   when requests are authorized via OAuth Bearer token (it's only required
   for cookie-authenticated requests) — so this adapter is simpler than the
   cookie+digest pattern originally sketched for the (abandoned) SharePoint-
   hosted approach.

   Field mapping (SharePoint internal name -> app field):
     Title -> issueId          Mall -> mall                IssueDescription -> issue
     OutletNo -> outletNo      Tenant -> tenant             DateRaised -> dateRaised
     AssignedTo -> assignedTo  Status -> status             WaitingReason -> waitingReason
     Priority -> priority      Remarks -> remarks           IsReopened -> isReopened
     ResolvedAt -> resolvedAt  ResolvedBy -> resolvedBy     CreatedByUser -> createdBy
     CreatedAtCustom -> createdAt                           UpdatedAt -> updatedAt

   Exposed on window.App.SPStorage
   ========================================================================== */

(function () {
  window.App = window.App || {};

  const SITE_URL = "https://dolmengroupcom.sharepoint.com/sites/DolmenLeasing";
  const ISSUES_LIST = "Issues";

  const Auth = () => window.App.AuthService;

  let cachedEntityType = null;

  // ---------------------------------------------------------------------
  // Low-level request helper
  // ---------------------------------------------------------------------
  async function spRequest(path, options) {
    options = options || {};
    const token = await Auth().getAccessToken();
    const url = SITE_URL + "/_api/" + path.replace(/^\/+/, "");

    const headers = Object.assign(
      {
        Authorization: "Bearer " + token,
        Accept: "application/json;odata=verbose",
      },
      options.headers || {}
    );

    const method = (options.method || "GET").toUpperCase();
    if (options.body) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json;odata=verbose";
    }
    if (method === "PATCH" || method === "MERGE") {
      headers["X-HTTP-Method"] = "MERGE";
      headers["IF-MATCH"] = options.etag || "*";
    }
    if (method === "DELETE") {
      headers["X-HTTP-Method"] = "DELETE";
      headers["IF-MATCH"] = options.etag || "*";
    }

    const fetchMethod = method === "GET" ? "GET" : "POST";

    const res = await fetch(url, {
      method: fetchMethod,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const err = new Error("SharePoint request failed (HTTP " + res.status + ")");
      err.status = res.status;
      try {
        err.body = await res.json();
      } catch (e) { /* not JSON — ignore */ }
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // The exact "entity type" string SharePoint requires in the __metadata
  // block of write payloads (e.g. "SP.Data.IssuesListItem") — fetched once
  // and cached rather than guessed, since it doesn't always match the list
  // name exactly (e.g. spaces/pluralization quirks).
  async function getEntityType() {
    if (cachedEntityType) return cachedEntityType;
    const data = await spRequest(
      "web/lists/getbytitle('" + ISSUES_LIST + "')?$select=ListItemEntityTypeFullName"
    );
    cachedEntityType = data.d.ListItemEntityTypeFullName;
    return cachedEntityType;
  }

  // ---------------------------------------------------------------------
  // Field mapping
  // ---------------------------------------------------------------------
  function mapSpItemToIssue(item) {
    return {
      issueId: item.Title,
      mall: item.Mall,
      issue: item.IssueDescription,
      outletNo: item.OutletNo,
      tenant: item.Tenant,
      dateRaised: item.DateRaised ? item.DateRaised.slice(0, 10) : null,
      assignedTo: item.AssignedTo,
      status: item.Status,
      waitingReason: item.WaitingReason || null,
      priority: item.Priority,
      remarks: item.Remarks || "",
      isReopened: !!item.IsReopened,
      resolvedAt: item.ResolvedAt || null,
      resolvedBy: item.ResolvedBy || null,
      createdBy: item.CreatedByUser,
      createdAt: item.CreatedAtCustom,
      updatedAt: item.UpdatedAt,
      _spId: item.Id,
      _etag: item.__metadata ? item.__metadata.etag : null,
    };
  }

  // Maps our app's change-object keys to SharePoint internal field names.
  // Only include keys that are actually present in `changes`.
  const FIELD_MAP = {
    mall: "Mall",
    issue: "IssueDescription",
    outletNo: "OutletNo",
    tenant: "Tenant",
    dateRaised: "DateRaised",
    assignedTo: "AssignedTo",
    status: "Status",
    waitingReason: "WaitingReason",
    priority: "Priority",
    remarks: "Remarks",
    isReopened: "IsReopened",
    resolvedAt: "ResolvedAt",
    resolvedBy: "ResolvedBy",
    updatedAt: "UpdatedAt",
  };

  function mapChangesToSpPayload(changes) {
    const payload = {};
    Object.keys(changes).forEach((key) => {
      const spField = FIELD_MAP[key];
      if (!spField) return; // unmapped/read-only field (e.g. issueId/createdBy/createdAt) — silently skip
      payload[spField] = changes[key];
    });
    return payload;
  }

  // ---------------------------------------------------------------------
  // Public operations
  // ---------------------------------------------------------------------

  async function getIssues() {
    const data = await spRequest(
      "web/lists/getbytitle('" + ISSUES_LIST + "')/items?$top=5000"
    );
    return data.d.results.map(mapSpItemToIssue);
  }

  async function getIssueById(issueId) {
    const safeId = issueId.replace(/'/g, "''");
    const data = await spRequest(
      "web/lists/getbytitle('" + ISSUES_LIST + "')/items?$filter=Title eq '" + safeId + "'"
    );
    if (!data.d.results.length) return null;
    return mapSpItemToIssue(data.d.results[0]);
  }

  // Generic partial update. Fetches the item's internal SharePoint Id +
  // ETag first (needed for the PATCH URL and optimistic-concurrency
  // header), then applies the change via MERGE.
  async function updateIssue(issueId, changes) {
    const current = await getIssueById(issueId);
    if (!current) {
      return { ok: false, errors: { general: "Issue not found." } };
    }

    const entityType = await getEntityType();
    const payload = Object.assign(
      { __metadata: { type: entityType } },
      mapChangesToSpPayload(changes)
    );

    try {
      await spRequest(
        "web/lists/getbytitle('" + ISSUES_LIST + "')/items(" + current._spId + ")",
        { method: "MERGE", body: payload, etag: current._etag }
      );
    } catch (e) {
      if (e.status === 412) {
        return { ok: false, errors: { general: "This issue was updated by someone else. Please refresh and try again." } };
      }
      throw e;
    }

    const updated = await getIssueById(issueId);
    return { ok: true, issue: updated };
  }

  async function resolveIssue(issueId, actor, resolutionNote) {
    const now = new Date().toISOString();
    const changes = {
      status: "Resolved",
      waitingReason: null,
      resolvedAt: now,
      resolvedBy: actor,
      updatedAt: now,
    };
    if (resolutionNote) changes.remarks = resolutionNote;
    return updateIssue(issueId, changes);
  }

  // Re-opening deliberately leaves resolvedAt/resolvedBy untouched on the
  // record (matches the local prototype's behaviour) — the original
  // resolution stays visible until the issue is resolved again.
  async function reopenIssue(issueId) {
    const now = new Date().toISOString();
    return updateIssue(issueId, {
      status: "In Progress",
      isReopened: true,
      updatedAt: now,
    });
  }

  window.App.SPStorage = {
    getIssues,
    getIssueById,
    updateIssue,
    resolveIssue,
    reopenIssue,
  };
})();
