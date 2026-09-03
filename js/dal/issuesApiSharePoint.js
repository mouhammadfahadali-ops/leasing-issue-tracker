/* ==========================================================================
   issuesApiSharePoint.js — the Data Access Layer, SharePoint edition.

   Presents the EXACT same window.App.DAL surface as js/dal/issuesApiLocal.js,
   so every UI component works unchanged. The difference is underneath:

     - init() hydrates an in-memory copy of the Issues + ActivityLog lists
       from SharePoint (one bulk read each).
     - Reads (getIssues / getDashboardStats / activity feeds) are served from
       that in-memory copy, using the SAME filtering / aging / stats logic
       ported verbatim from the local DAL — so behaviour is identical.
     - Writes (createIssue / updateIssue / resolveIssue / reopenIssue) go
       straight to SharePoint via window.App.SPStorage (+ CounterService for
       IDs, + window.App.ActivityLog for the audit trail), then patch the
       in-memory copy so the UI reflects the change immediately.

   Loaded INSTEAD of issuesApiLocal.js when Config.STORAGE_MODE === "sharepoint".
   Exposed on window.App.DAL (merged with IdGenerator / Validation).
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.DAL = window.App.DAL || {};

  const U = () => window.App.Utils;
  const Validation = () => window.App.DAL.Validation;
  const SPStorage = () => window.App.SPStorage;
  const ActivityLog = () => window.App.ActivityLog;
  const Auth = () => window.App.AuthService;

  // Same business thresholds as the local DAL.
  const AGING_THRESHOLD_DAYS = 7;
  const CRITICAL_THRESHOLD_DAYS = 14;

  // In-memory mirror of the two lists (hydrated by init()).
  let issuesCache = [];
  let activityCache = [];
  let hydrated = false;

  // ---------------------------------------------------------------------
  // Pure helpers — ported verbatim from issuesApiLocal.js
  // ---------------------------------------------------------------------
  function withComputed(issue) {
    const endPoint = issue.status === "Resolved" ? issue.resolvedAt : null;
    const daysOpen = U().daysBetween(issue.dateRaised, endPoint);
    return Object.assign({}, issue, { daysOpen });
  }

  const FIELD_LABELS = {
    issue: "Issue description",
    outletNo: "Outlet No.",
    tenant: "Tenant",
    dateRaised: "Date raised",
    assignedTo: "Assigned To",
  };

  // ---------------------------------------------------------------------
  // Audit-trail writing
  // ---------------------------------------------------------------------

  // Append one activity entry to SharePoint and to the in-memory mirror.
  // If the ActivityLog write fails, we keep a local-only copy so the UI
  // still shows the history for this session, and warn in the console
  // rather than failing the whole user action.
  async function safeLog(entry) {
    // Attach the issue's mall so the ActivityLog "Mall" column is populated
    // (enables native SharePoint filtering / reporting by mall).
    let mall = entry.mall;
    if (!mall && entry.issueId) {
      const iss = issuesCache.find((i) => i.issueId === entry.issueId);
      if (iss) mall = iss.mall;
    }
    const enriched = Object.assign(
      { entryId: "act-" + U().generateId(), timestamp: U().nowIso(), mall: mall || null },
      entry,
      mall ? { mall } : {}
    );
    try {
      const stored = await ActivityLog().append(enriched);
      activityCache.push(stored || enriched);
    } catch (e) {
      console.warn("ActivityLog write failed — kept locally for this session:", e, enriched);
      activityCache.push(Object.assign({ _localOnly: true }, enriched));
    }
  }

  // Diff old vs new issue and write one activity entry per meaningful change.
  // Mirrors issuesApiLocal.js diffAndLog(), but each write is awaited.
  async function diffAndLog(issueId, before, after, actor) {
    const statusChanged = before.status !== after.status;
    const waitingReasonChanged = before.waitingReason !== after.waitingReason;

    if (statusChanged) {
      await safeLog({
        issueId, actor, action: "status_changed", field: "status",
        from: before.status, to: after.status, comment: null,
        waitingReason: after.status === "Waiting" ? after.waitingReason : null,
      });
    } else if (waitingReasonChanged) {
      await safeLog({
        issueId, actor, action: "waiting_reason_changed", field: "waitingReason",
        from: before.waitingReason, to: after.waitingReason, comment: null,
      });
    }
    if (before.priority !== after.priority) {
      await safeLog({
        issueId, actor, action: "priority_changed", field: "priority",
        from: before.priority, to: after.priority, comment: null,
      });
    }
    if (before.assignedTo !== after.assignedTo) {
      await safeLog({
        issueId, actor, action: "assignment_changed", field: "assignedTo",
        from: before.assignedTo, to: after.assignedTo, comment: null,
      });
    }
    if ((before.remarks || "") !== (after.remarks || "")) {
      await safeLog({
        issueId, actor, action: "remark_added", field: "remarks",
        from: null, to: null, comment: after.remarks || "(cleared)",
      });
    }
    for (const field of Object.keys(FIELD_LABELS)) {
      if (before[field] !== after[field]) {
        await safeLog({
          issueId, actor, action: "issue_edited", field,
          from: before[field], to: after[field], comment: null,
        });
      }
    }
  }

  function replaceInCache(issue) {
    const idx = issuesCache.findIndex((i) => i.issueId === issue.issueId);
    if (idx === -1) issuesCache.push(issue);
    else issuesCache[idx] = issue;
  }

  // Run an adapter write and normalise the outcome to the DAL's contract:
  // always resolve to { ok, ... } — never throw — so the New Issue / Issue
  // Detail forms can show a real reason inline instead of a generic toast.
  async function guard(fn) {
    try {
      const res = await fn();
      if (res && typeof res.ok === "boolean") return res;
      return { ok: true, result: res };
    } catch (e) {
      console.error("SharePoint write failed:", e);
      return { ok: false, errors: { general: e.message || "The change could not be saved to SharePoint." } };
    }
  }

  // ---------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------

  async function init() {
    // authGate.js guarantees we are signed in before this runs.
    issuesCache = await SPStorage().getIssues();
    try {
      activityCache = await ActivityLog().getAll();
    } catch (e) {
      console.warn("ActivityLog list could not be read at startup:", e);
      activityCache = [];
    }
    hydrated = true;
    return { seeded: false, wasCorrupted: false, storageAvailable: true };
  }

  function isStorageAvailable() {
    return hydrated;
  }

  // Re-pull everything from SharePoint (used after an error, or a manual refresh).
  async function refresh() {
    issuesCache = await SPStorage().getIssues();
    try {
      activityCache = await ActivityLog().getAll();
    } catch (e) {
      console.warn("ActivityLog refresh failed:", e);
    }
    return { ok: true };
  }

  // "Reset Demo Data" is a prototype-only tool; it does nothing against
  // real SharePoint data. The sidebar hides the button in SharePoint mode,
  // but guard here too.
  async function resetDemoData() {
    return {
      ok: false,
      errors: { general: "Reset Demo Data is disabled when the app is connected to SharePoint." },
    };
  }

  // ---------------------------------------------------------------------
  // Reads — identical logic to issuesApiLocal.js, over issuesCache
  // ---------------------------------------------------------------------

  async function getIssues(filters) {
    filters = filters || {};
    let issues = issuesCache.slice();

    if (filters.mall && filters.mall !== "ALL") issues = issues.filter((i) => i.mall === filters.mall);
    if (filters.status) issues = issues.filter((i) => i.status === filters.status);
    if (filters.waitingReason) issues = issues.filter((i) => i.waitingReason === filters.waitingReason);
    if (filters.priority) issues = issues.filter((i) => i.priority === filters.priority);
    if (filters.assignedTo) issues = issues.filter((i) => i.assignedTo === filters.assignedTo);
    if (filters.excludeResolved) issues = issues.filter((i) => i.status !== "Resolved");
    if (filters.onlyResolved) issues = issues.filter((i) => i.status === "Resolved");
    if (filters.searchText) {
      const q = filters.searchText.trim().toLowerCase();
      if (q) {
        issues = issues.filter((i) =>
          [i.issueId, i.issue, i.outletNo, i.tenant, i.assignedTo, i.remarks]
            .join(" ").toLowerCase().includes(q)
        );
      }
    }
    if (filters.dateFrom) issues = issues.filter((i) => i.dateRaised >= filters.dateFrom);
    if (filters.dateTo) issues = issues.filter((i) => i.dateRaised <= filters.dateTo);
    if (filters.resolvedFrom) issues = issues.filter((i) => i.resolvedAt && i.resolvedAt.slice(0, 10) >= filters.resolvedFrom);
    if (filters.resolvedTo) issues = issues.filter((i) => i.resolvedAt && i.resolvedAt.slice(0, 10) <= filters.resolvedTo);

    issues = issues.map(withComputed);
    issues.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (filters.sortBy === "daysOpen") {
      issues.sort((a, b) => b.daysOpen - a.daysOpen);
    } else if (filters.sortBy === "dateRaised") {
      issues.sort((a, b) => new Date(b.dateRaised) - new Date(a.dateRaised));
    } else if (filters.sortBy === "priority") {
      const order = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
      issues.sort((a, b) => order[a.priority] - order[b.priority]);
    }
    return issues;
  }

  async function getIssueById(issueId) {
    const issue = issuesCache.find((i) => i.issueId === issueId);
    return issue ? withComputed(issue) : null;
  }

  async function getActivityHistory(issueId) {
    return activityCache
      .filter((a) => a.issueId === issueId)
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async function getRecentActivity(mall, limit) {
    let log = activityCache.slice();
    if (mall && mall !== "ALL") {
      const issueIds = new Set(issuesCache.filter((i) => i.mall === mall).map((i) => i.issueId));
      log = log.filter((a) => issueIds.has(a.issueId));
    }
    log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (limit) log = log.slice(0, limit);

    const issuesById = {};
    issuesCache.forEach((i) => { issuesById[i.issueId] = i; });
    return log.map((entry) => Object.assign({}, entry, { issueRef: issuesById[entry.issueId] || null }));
  }

  async function getDashboardStats(mall) {
    const all = await getIssues({ mall: mall || "ALL" });
    const active = all.filter((i) => i.status !== "Resolved");
    const resolved = all.filter((i) => i.status === "Resolved");

    const byStatus = { New: 0, "In Progress": 0, Waiting: 0, Resolved: 0 };
    all.forEach((i) => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });

    const waitingByReason = { Tenant: 0, Finance: 0, Management: 0 };
    all.filter((i) => i.status === "Waiting").forEach((i) => {
      if (i.waitingReason) waitingByReason[i.waitingReason] = (waitingByReason[i.waitingReason] || 0) + 1;
    });

    const aging = active.filter((i) => i.daysOpen >= AGING_THRESHOLD_DAYS && i.daysOpen < CRITICAL_THRESHOLD_DAYS).length;
    const critical = active.filter((i) => i.daysOpen >= CRITICAL_THRESHOLD_DAYS).length;

    const now = new Date();
    const resolvedThisMonth = resolved.filter((i) => {
      if (!i.resolvedAt) return false;
      const d = new Date(i.resolvedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const reopenedCount = all.filter((i) => i.isReopened).length;
    const urgentHighOpen = active.filter((i) => i.priority === "Urgent" || i.priority === "High").length;

    const mallBreakdown = [];
    for (const m of U().MALLS) {
      const mIssues = await getIssues({ mall: m });
      const mActive = mIssues.filter((i) => i.status !== "Resolved");
      mallBreakdown.push({
        mall: m,
        total: mIssues.length,
        active: mActive.length,
        byStatus: {
          New: mIssues.filter((i) => i.status === "New").length,
          "In Progress": mIssues.filter((i) => i.status === "In Progress").length,
          Waiting: mIssues.filter((i) => i.status === "Waiting").length,
          Resolved: mIssues.filter((i) => i.status === "Resolved").length,
        },
      });
    }
    const busiestMall = mallBreakdown.reduce(
      (top, m) => (m.active > (top ? top.active : -1) ? m : top), null
    );

    return {
      totalActive: active.length,
      totalResolved: resolved.length,
      byStatus,
      waitingByReason,
      agingCount: aging,
      criticalCount: critical,
      resolvedThisMonth,
      reopenedCount,
      urgentHighOpen,
      mallBreakdown,
      busiestMall,
    };
  }

  // ---------------------------------------------------------------------
  // Users / identity  (real sign-in — no prototype "acting as")
  // ---------------------------------------------------------------------

  async function getUsers() {
    return (window.App.Config.TEAM_MEMBERS || ["Fahad", "Ali", "Ahmed", "Sara"]).slice();
  }

  async function getCurrentUser() {
    const u = await Auth().getCurrentUser();
    return u ? u.displayName : null;
  }

  // Identity is fixed by the Microsoft sign-in; there is nothing to set.
  // Kept so any caller of the old prototype API doesn't blow up.
  async function setCurrentUser() {
    return { ok: true };
  }

  // ---------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------

  async function createIssue(data, actor) {
    const errors = Validation().validateNewIssue(data);
    if (Validation().hasErrors(errors)) return { ok: false, errors };

    const res = await guard(() => SPStorage().createIssue({
      mall: data.mall,
      issue: data.issue.trim(),
      outletNo: data.outletNo.trim(),
      tenant: data.tenant.trim(),
      dateRaised: data.dateRaised,
      assignedTo: data.assignedTo,
      status: data.status || "New",
      waitingReason: data.status === "Waiting" ? data.waitingReason : null,
      priority: data.priority || "Medium",
      remarks: (data.remarks || "").trim(),
      createdBy: actor,
    }));
    if (!res.ok) return res;

    const issue = res.issue;
    replaceInCache(issue);

    await safeLog({
      issueId: issue.issueId, actor, action: "created", field: null, from: null, to: null,
      comment: "Issue logged for " + issue.tenant + " (" + issue.outletNo + ").",
    });
    if (issue.remarks) {
      await safeLog({
        issueId: issue.issueId, actor, action: "remark_added", field: "remarks",
        from: null, to: null, comment: issue.remarks,
      });
    }
    return { ok: true, issue: withComputed(issue) };
  }

  async function updateIssue(issueId, changes, actor) {
    const before = issuesCache.find((i) => i.issueId === issueId);
    if (!before) return { ok: false, errors: { general: "Issue not found." } };

    changes = Object.assign({}, changes);
    if (changes.status !== undefined) {
      const wr = changes.waitingReason !== undefined ? changes.waitingReason : before.waitingReason;
      const errors = Validation().validateStatusChange(changes.status, changes.status === "Waiting" ? wr : null);
      if (Validation().hasErrors(errors)) return { ok: false, errors };
      if (changes.status !== "Waiting") changes.waitingReason = null;
    }
    changes.updatedAt = U().nowIso();

    const res = await guard(() => SPStorage().updateIssue(issueId, changes));
    if (!res.ok) return res;

    const after = res.issue;
    replaceInCache(after);
    await diffAndLog(issueId, before, after, actor);
    return { ok: true, issue: withComputed(after) };
  }

  async function resolveIssue(issueId, actor, resolutionNote) {
    const before = issuesCache.find((i) => i.issueId === issueId);
    if (!before) return { ok: false, errors: { general: "Issue not found." } };

    const note = resolutionNote && resolutionNote.trim() ? resolutionNote.trim() : null;
    const res = await guard(() => SPStorage().resolveIssue(issueId, actor, note || undefined));
    if (!res.ok) return res;

    const after = res.issue;
    replaceInCache(after);

    if (note && note !== (before.remarks || "")) {
      await safeLog({ issueId, actor, action: "remark_added", field: "remarks", from: null, to: null, comment: note });
    }
    await safeLog({
      issueId, actor, action: "resolved", field: "status",
      from: before.status, to: "Resolved", comment: note,
    });
    return { ok: true, issue: withComputed(after) };
  }

  async function reopenIssue(issueId, actor, reason) {
    const before = issuesCache.find((i) => i.issueId === issueId);
    if (!before) return { ok: false, errors: { general: "Issue not found." } };
    if (before.status !== "Resolved") {
      return { ok: false, errors: { general: "Only resolved issues can be re-opened." } };
    }

    const res = await guard(() => SPStorage().reopenIssue(issueId));
    if (!res.ok) return res;

    const after = res.issue;
    replaceInCache(after);
    await safeLog({
      issueId, actor, action: "reopened", field: "status",
      from: "Resolved", to: "In Progress",
      comment: reason && reason.trim() ? reason.trim() : "Issue re-opened for further action.",
    });
    return { ok: true, issue: withComputed(after) };
  }

  window.App.DAL = Object.assign(window.App.DAL, {
    AGING_THRESHOLD_DAYS,
    CRITICAL_THRESHOLD_DAYS,
    init,
    isStorageAvailable,
    refresh,
    resetDemoData,
    getIssues,
    getIssueById,
    createIssue,
    updateIssue,
    resolveIssue,
    reopenIssue,
    getActivityHistory,
    getRecentActivity,
    getDashboardStats,
    getUsers,
    getCurrentUser,
    setCurrentUser,
  });
})();
