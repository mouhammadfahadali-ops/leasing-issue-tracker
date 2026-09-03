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

  // Cache of list title -> ListItemEntityTypeFullName (e.g. "SP.Data.IssuesListItem").
  const entityTypeCache = {};

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

    let res;
    try {
      res = await fetch(url, {
        method: fetchMethod,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (e) {
      // Network-level failure (offline, DNS, CORS, blocked) — fetch rejects
      // before there's any response.
      const err = new Error("Couldn't reach SharePoint. Check your connection and try again.");
      err.status = 0;
      err.cause = e;
      throw err;
    }

    if (!res.ok) {
      let spMessage = "";
      let body = null;
      try {
        body = await res.json();
        spMessage =
          (body && body.error && body.error.message && body.error.message.value) ||
          (body && body["odata.error"] && body["odata.error"].message && body["odata.error"].message.value) ||
          "";
      } catch (e) { /* not JSON */ }

      const err = new Error(friendlyHttp(res.status, spMessage));
      err.status = res.status;
      err.spMessage = spMessage;
      err.body = body;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // Turn an HTTP status (+ SharePoint's own message when present) into
  // something a leasing user can act on.
  function friendlyHttp(status, spMessage) {
    switch (status) {
      case 400:
        return spMessage
          ? "SharePoint rejected the data: " + spMessage
          : "SharePoint rejected the request. A field value may not match its column (e.g. a name that isn't one of the allowed choices).";
      case 401:
        return "Your session has expired. Please sign in again.";
      case 403:
        return "You don't have permission to do this in the SharePoint site. Ask the site owner to grant you Edit access.";
      case 404:
        return "That item no longer exists in SharePoint — it may have been deleted. Refresh and try again.";
      case 412:
        return "This item was changed by someone else. Refresh to get the latest version, then re-apply your change.";
      case 429:
      case 503:
        return "SharePoint is busy right now. Wait a few seconds and try again.";
      default:
        if (status >= 500) return "SharePoint had a server error (HTTP " + status + "). Try again shortly.";
        return spMessage || "SharePoint request failed (HTTP " + status + ").";
    }
  }

  // The exact "entity type" string SharePoint requires in the __metadata
  // block of write payloads (e.g. "SP.Data.IssuesListItem") — fetched once
  // per list and cached rather than guessed, since it doesn't always match
  // the list name exactly (e.g. spaces/pluralization quirks).
  async function getEntityType(listName) {
    listName = listName || ISSUES_LIST;
    if (entityTypeCache[listName]) return entityTypeCache[listName];
    const data = await spRequest(
      "web/lists/getbytitle('" + listName + "')?$select=ListItemEntityTypeFullName"
    );
    entityTypeCache[listName] = data.d.ListItemEntityTypeFullName;
    return entityTypeCache[listName];
  }

  // ---------------------------------------------------------------------
  // Field mapping
  // ---------------------------------------------------------------------

  // AssignedTo is a *multi-choice* column in SharePoint. On read it comes
  // back as { results: [...] }; on write it must be sent as
  // { __metadata: { type: "Collection(Edm.String)" }, results: [...] }.
  // The app model treats assignee as a single person, so we read the first
  // value and write a one-element collection.
  function readMultiChoice(v) {
    if (v && Array.isArray(v.results)) return v.results[0] || null;
    if (Array.isArray(v)) return v[0] || null;
    return v || null;
  }
  function writeMultiChoice(v) {
    const arr = v === null || v === undefined || v === "" ? [] : [String(v)];
    return { __metadata: { type: "Collection(Edm.String)" }, results: arr };
  }

  function mapSpItemToIssue(item) {
    return {
      issueId: item.Title,
      mall: item.Mall,
      issue: item.IssueDescription,
      outletNo: item.OutletNo,
      tenant: item.Tenant,
      dateRaised: item.DateRaised ? item.DateRaised.slice(0, 10) : null,
      assignedTo: readMultiChoice(item.AssignedTo),
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
      payload[spField] = key === "assignedTo" ? writeMultiChoice(changes[key]) : changes[key];
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

  // Create a brand-new issue. The Issue ID (Title) is reserved from the
  // Counters list via CounterService so two simultaneous creates can never
  // land on the same number. Returns { ok, issue } or { ok:false, errors }.
  async function createIssue(data) {
    data = data || {};

    const errors = {};
    if (!data.mall) errors.mall = "Mall is required.";
    if (!data.issue || !String(data.issue).trim()) errors.issue = "Issue description is required.";
    if (!data.tenant || !String(data.tenant).trim()) errors.tenant = "Tenant is required.";
    if (Object.keys(errors).length) return { ok: false, errors };

    if (!window.App.CounterService) {
      return { ok: false, errors: { general: "counterService.js is not loaded." } };
    }

    let issueId;
    try {
      issueId = await window.App.CounterService.getNextIssueId(data.mall);
    } catch (e) {
      return { ok: false, errors: { general: e.message } };
    }

    const now = new Date().toISOString();
    const entityType = await getEntityType(ISSUES_LIST);

    const payload = {
      __metadata: { type: entityType },
      Title: issueId,
      Mall: data.mall,
      IssueDescription: data.issue,
      OutletNo: data.outletNo || null,
      Tenant: data.tenant,
      DateRaised: data.dateRaised || now,
      AssignedTo: writeMultiChoice(data.assignedTo),
      Status: data.status || "New",
      WaitingReason: data.waitingReason || null,
      Priority: data.priority || "Medium",
      Remarks: data.remarks || "",
      IsReopened: false,
      CreatedByUser: data.createdBy || null,
      CreatedAtCustom: now,
      UpdatedAt: now,
    };

    try {
      await spRequest("web/lists/getbytitle('" + ISSUES_LIST + "')/items", {
        method: "POST",
        body: payload,
      });
    } catch (e) {
      return {
        ok: false,
        errors: { general: "Issue ID " + issueId + " was reserved but the issue could not be saved: " + e.message },
        reservedId: issueId,
      };
    }

    const created = await getIssueById(issueId);
    return { ok: true, issue: created };
  }

  // One-time migration helper: insert an issue with its ORIGINAL id and
  // timestamps preserved exactly (no Counter reservation, no "now" stamps).
  // `issue` is a full app-model object as produced by MockData.generate().
  // Idempotent: if an issue with this Title already exists it is skipped.
  async function importIssue(issue) {
    if (!issue || !issue.issueId) {
      return { ok: false, errors: { general: "importIssue needs a full issue object with an issueId." } };
    }
    const existing = await getIssueById(issue.issueId);
    if (existing) return { ok: true, skipped: true, issue: existing };

    const entityType = await getEntityType(ISSUES_LIST);
    const payload = {
      __metadata: { type: entityType },
      Title: issue.issueId,
      Mall: issue.mall,
      IssueDescription: issue.issue,
      OutletNo: issue.outletNo || null,
      Tenant: issue.tenant,
      DateRaised: issue.dateRaised || null,
      AssignedTo: writeMultiChoice(issue.assignedTo),
      Status: issue.status || "New",
      WaitingReason: issue.waitingReason || null,
      Priority: issue.priority || "Medium",
      Remarks: issue.remarks || "",
      IsReopened: !!issue.isReopened,
      ResolvedAt: issue.resolvedAt || null,
      ResolvedBy: issue.resolvedBy || null,
      CreatedByUser: issue.createdBy || null,
      CreatedAtCustom: issue.createdAt || null,
      UpdatedAt: issue.updatedAt || issue.createdAt || null,
    };

    try {
      await spRequest("web/lists/getbytitle('" + ISSUES_LIST + "')/items", { method: "POST", body: payload });
    } catch (e) {
      return { ok: false, errors: { general: "Could not import " + issue.issueId + ": " + e.message } };
    }
    const created = await getIssueById(issue.issueId);
    return { ok: true, skipped: false, issue: created };
  }

  window.App.SPStorage = {
    getIssues,
    getIssueById,
    createIssue,
    importIssue,
    updateIssue,
    resolveIssue,
    reopenIssue,
  };

  // Low-level helper reused by counterService.js (and any future adapter
  // module) so REST plumbing lives in exactly one place.
  window.App.SP = {
    request: spRequest,
    getEntityType,
    SITE_URL,
  };
})();
