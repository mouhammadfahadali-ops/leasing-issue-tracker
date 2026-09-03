/* ==========================================================================
   issuesApi.js — THE Data Access Layer.
   Every UI component talks to the app exclusively through this module.
   Today it sits on top of window.App.Storage (localStorage). When SharePoint
   is introduced, only Storage's internals change to real network calls —
   this file's function surface (and therefore every UI component) stays
   the same.

   All public functions here are `async` and return Promises, even though
   the current localStorage-backed Storage layer completes synchronously.
   This is intentional: it's the seam that lets a future SharePoint
   adapter (genuinely asynchronous, over the network) drop in without any
   UI component needing to change how it calls the DAL. UI components
   already `await` every DAL call.

   Exposed on window.App.DAL  (merged with IdGenerator / Validation)
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.DAL = window.App.DAL || {};

  const U = () => window.App.Utils;
  const Storage = () => window.App.Storage;
  const Validation = () => window.App.DAL.Validation;
  const IdGen = () => window.App.DAL.IdGenerator;

  // ---------------------------------------------------------------------
  // "Aging" business rule — defined ONCE here, consumed by the Dashboard,
  // Active Issues, and Issue Detail (all read DAL.AGING_THRESHOLD_DAYS /
  // DAL.CRITICAL_THRESHOLD_DAYS rather than hard-coding a number). An
  // active (unresolved) issue is:
  //   - "Aging"    once it has been open >= AGING_THRESHOLD_DAYS days
  //   - "Critical" once it has been open >= CRITICAL_THRESHOLD_DAYS days
  // Resolved issues are never considered aging/critical. To change the
  // policy, edit these two numbers — nothing else needs to change.
  // ---------------------------------------------------------------------
  const AGING_THRESHOLD_DAYS = 7;
  const CRITICAL_THRESHOLD_DAYS = 14;

  // ---------------------------------------------------------------------
  // Internal helpers (synchronous — operate on data already fetched)
  // ---------------------------------------------------------------------

  function withComputed(issue) {
    const endPoint = issue.status === "Resolved" ? issue.resolvedAt : null;
    const daysOpen = U().daysBetween(issue.dateRaised, endPoint);
    return Object.assign({}, issue, { daysOpen });
  }

  function findIssueIndex(issues, issueId) {
    return issues.findIndex((i) => i.issueId === issueId);
  }

  // Append-only: every call adds one new entry and never edits or removes
  // an existing one. This is the sole write path into the activity log.
  function logActivity(entry) {
    const log = Storage().getActivityLog();
    log.push(
      Object.assign(
        {
          entryId: "act-" + U().generateId(),
          timestamp: U().nowIso(),
        },
        entry
      )
    );
    Storage().setActivityLog(log);
  }

  const FIELD_LABELS = {
    issue: "Issue description",
    outletNo: "Outlet No.",
    tenant: "Tenant",
    dateRaised: "Date raised",
    assignedTo: "Assigned To",
  };

  // Diff old vs new issue and write one activity entry per meaningful change.
  // This is the single place responsible for keeping the audit trail
  // consistent, regardless of which screen triggered the update.
  //
  // Status + Waiting Reason are deliberately logged as ONE combined entry
  // when they change together (moving TO Waiting always sets a reason in
  // the same update) — e.g. "Status changed: In Progress → Waiting ·
  // Tenant" — rather than two separate lines a reader has to mentally
  // merge. A reason change on its own (staying in Waiting, just switching
  // who it's waiting on) still gets its own entry.
  function diffAndLog(issueId, before, after, actor) {
    const statusChanged = before.status !== after.status;
    const waitingReasonChanged = before.waitingReason !== after.waitingReason;

    if (statusChanged) {
      logActivity({
        issueId, actor, action: "status_changed", field: "status",
        from: before.status, to: after.status, comment: null,
        waitingReason: after.status === "Waiting" ? after.waitingReason : null,
      });
    } else if (waitingReasonChanged) {
      logActivity({
        issueId, actor, action: "waiting_reason_changed", field: "waitingReason",
        from: before.waitingReason, to: after.waitingReason, comment: null,
      });
    }
    if (before.priority !== after.priority) {
      logActivity({
        issueId, actor, action: "priority_changed", field: "priority",
        from: before.priority, to: after.priority, comment: null,
      });
    }
    if (before.assignedTo !== after.assignedTo) {
      logActivity({
        issueId, actor, action: "assignment_changed", field: "assignedTo",
        from: before.assignedTo, to: after.assignedTo, comment: null,
      });
    }
    if ((before.remarks || "") !== (after.remarks || "")) {
      logActivity({
        issueId, actor, action: "remark_added", field: "remarks",
        from: null, to: null, comment: after.remarks || "(cleared)",
      });
    }
    Object.keys(FIELD_LABELS).forEach((field) => {
      if (before[field] !== after[field]) {
        logActivity({
          issueId, actor, action: "issue_edited", field,
          from: before[field], to: after[field], comment: null,
        });
      }
    });
  }

  // ---------------------------------------------------------------------
  // Bootstrap / prototype-only maintenance
  // ---------------------------------------------------------------------

  // Initializes storage (seeding sample data on first run, or recovering
  // automatically if what's stored is missing/corrupted). Returns status
  // info so the UI can show a one-time notice if recovery happened.
  async function init() {
    return Storage().init();
  }

  function isStorageAvailable() {
    return Storage().isStorageAvailable();
  }

  // Prototype/developer-only: wipes local data and restores the original
  // sample issues, activity log, and per-mall ID counters. Deliberately
  // routed through the DAL (not called directly against Storage) so it
  // stays subject to the same architectural boundary as everything else.
  async function resetDemoData() {
    Storage().resetToSeed();
    return { ok: true };
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  async function getIssues(filters) {
    filters = filters || {};
    let issues = Storage().getIssues();

    if (filters.mall && filters.mall !== "ALL") {
      issues = issues.filter((i) => i.mall === filters.mall);
    }
    if (filters.status) {
      issues = issues.filter((i) => i.status === filters.status);
    }
    if (filters.waitingReason) {
      issues = issues.filter((i) => i.waitingReason === filters.waitingReason);
    }
    if (filters.priority) {
      issues = issues.filter((i) => i.priority === filters.priority);
    }
    if (filters.assignedTo) {
      issues = issues.filter((i) => i.assignedTo === filters.assignedTo);
    }
    if (filters.excludeResolved) {
      issues = issues.filter((i) => i.status !== "Resolved");
    }
    if (filters.onlyResolved) {
      issues = issues.filter((i) => i.status === "Resolved");
    }
    if (filters.searchText) {
      const q = filters.searchText.trim().toLowerCase();
      if (q) {
        issues = issues.filter((i) =>
          [i.issueId, i.issue, i.outletNo, i.tenant, i.assignedTo, i.remarks]
            .join(" ")
            .toLowerCase()
            .includes(q)
        );
      }
    }
    if (filters.dateFrom) {
      issues = issues.filter((i) => i.dateRaised >= filters.dateFrom);
    }
    if (filters.dateTo) {
      issues = issues.filter((i) => i.dateRaised <= filters.dateTo);
    }
    if (filters.resolvedFrom) {
      issues = issues.filter((i) => i.resolvedAt && i.resolvedAt.slice(0, 10) >= filters.resolvedFrom);
    }
    if (filters.resolvedTo) {
      issues = issues.filter((i) => i.resolvedAt && i.resolvedAt.slice(0, 10) <= filters.resolvedTo);
    }

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
    const issue = Storage().getIssues().find((i) => i.issueId === issueId);
    return issue ? withComputed(issue) : null;
  }

  async function createIssue(data, actor) {
    const errors = Validation().validateNewIssue(data);
    if (Validation().hasErrors(errors)) {
      return { ok: false, errors };
    }

    const issueId = await IdGen().nextIssueId(data.mall);
    const now = U().nowIso();
    const issue = {
      issueId,
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
      isReopened: false,
      resolvedAt: null,
      resolvedBy: null,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };

    const issues = Storage().getIssues();
    issues.push(issue);
    Storage().setIssues(issues);

    logActivity({
      issueId, actor, action: "created", field: null, from: null, to: null,
      comment: "Issue logged for " + issue.tenant + " (" + issue.outletNo + ").",
    });
    if (issue.remarks) {
      logActivity({
        issueId, actor, action: "remark_added", field: "remarks",
        from: null, to: null, comment: issue.remarks,
      });
    }

    return { ok: true, issue: withComputed(issue) };
  }

  // Generic partial update — used by the Edit form and by inline status/
  // priority/assignment changes from the Issue Detail panel. This is the
  // single place status-transition and Waiting-reason rules are enforced,
  // so no UI component needs to duplicate that logic.
  async function updateIssue(issueId, changes, actor) {
    const issues = Storage().getIssues();
    const idx = findIssueIndex(issues, issueId);
    if (idx === -1) return { ok: false, errors: { general: "Issue not found." } };

    const before = Object.assign({}, issues[idx]);

    if (changes.status !== undefined) {
      const wr = changes.waitingReason !== undefined ? changes.waitingReason : before.waitingReason;
      const errors = Validation().validateStatusChange(changes.status, changes.status === "Waiting" ? wr : null);
      if (Validation().hasErrors(errors)) return { ok: false, errors };
      if (changes.status !== "Waiting") {
        changes.waitingReason = null;
      }
    }

    const after = Object.assign({}, before, changes, { updatedAt: U().nowIso() });
    issues[idx] = after;
    Storage().setIssues(issues);

    diffAndLog(issueId, before, after, actor);

    return { ok: true, issue: withComputed(after) };
  }

  async function resolveIssue(issueId, actor, resolutionNote) {
    const issues = Storage().getIssues();
    const idx = findIssueIndex(issues, issueId);
    if (idx === -1) return { ok: false, errors: { general: "Issue not found." } };

    const before = Object.assign({}, issues[idx]);
    const now = U().nowIso();
    const after = Object.assign({}, before, {
      status: "Resolved",
      waitingReason: null,
      resolvedAt: now,
      resolvedBy: actor,
      updatedAt: now,
      remarks: resolutionNote ? resolutionNote.trim() : before.remarks,
    });
    issues[idx] = after;
    Storage().setIssues(issues);

    // A separate "waiting reason cleared" entry would be redundant here —
    // the "resolved" entry below already fully explains the state change,
    // including the fact that it's no longer waiting on anyone.
    if (resolutionNote && resolutionNote.trim() !== (before.remarks || "")) {
      logActivity({ issueId, actor, action: "remark_added", field: "remarks", from: null, to: null, comment: resolutionNote.trim() });
    }
    logActivity({
      issueId, actor, action: "resolved", field: "status",
      from: before.status, to: "Resolved",
      comment: resolutionNote ? resolutionNote.trim() : null,
    });

    return { ok: true, issue: withComputed(after) };
  }

  // Re-opening deliberately does NOT touch resolvedAt / resolvedBy — the
  // original resolution timestamp and actor stay on the record exactly as
  // they were (in addition to living permanently in Activity History), so
  // "when and by whom was this last resolved" is never lost. If the issue
  // is resolved again later, resolveIssue() naturally overwrites them with
  // the new resolution — the old ones remain visible in Activity History.
  async function reopenIssue(issueId, actor, reason) {
    const issues = Storage().getIssues();
    const idx = findIssueIndex(issues, issueId);
    if (idx === -1) return { ok: false, errors: { general: "Issue not found." } };

    const before = Object.assign({}, issues[idx]);
    if (before.status !== "Resolved") {
      return { ok: false, errors: { general: "Only resolved issues can be re-opened." } };
    }

    const now = U().nowIso();
    const after = Object.assign({}, before, {
      status: "In Progress",
      isReopened: true,
      updatedAt: now,
      // resolvedAt / resolvedBy intentionally left untouched — see comment above.
    });
    issues[idx] = after;
    Storage().setIssues(issues);

    logActivity({
      issueId, actor, action: "reopened", field: "status",
      from: "Resolved", to: "In Progress",
      comment: reason && reason.trim() ? reason.trim() : "Issue re-opened for further action.",
    });

    return { ok: true, issue: withComputed(after) };
  }

  async function getActivityHistory(issueId) {
    return Storage()
      .getActivityLog()
      .filter((a) => a.issueId === issueId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async function getRecentActivity(mall, limit) {
    let log = Storage().getActivityLog();
    if (mall && mall !== "ALL") {
      const issueIds = new Set(
        Storage().getIssues().filter((i) => i.mall === mall).map((i) => i.issueId)
      );
      log = log.filter((a) => issueIds.has(a.issueId));
    }
    log = log.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (limit) log = log.slice(0, limit);

    const issuesById = {};
    Storage().getIssues().forEach((i) => { issuesById[i.issueId] = i; });

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
      (top, m) => (m.active > (top ? top.active : -1) ? m : top),
      null
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
      busiestMall, // { mall, total, active, byStatus } of the mall with the most active issues, or null if there are none
    };
  }

  async function getUsers() {
    return window.App.MockData.CURRENT_USERS.slice();
  }

  async function getCurrentUser() {
    return Storage().getCurrentUser();
  }

  async function setCurrentUser(name) {
    return Storage().setCurrentUser(name);
  }

  window.App.DAL = Object.assign(window.App.DAL, {
    AGING_THRESHOLD_DAYS,
    CRITICAL_THRESHOLD_DAYS,
    init,
    isStorageAvailable,
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
