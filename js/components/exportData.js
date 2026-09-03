/* ==========================================================================
   exportData.js — Phase 6: export the current issue list to CSV.

   CSV (not .xlsx) on purpose: it opens straight in Excel, needs no library
   or CDN, and works identically in SharePoint mode and local-demo mode
   because it just consumes whatever the DAL returns.

   window.App.Components.Export.issuesToCsv(issues, filenameBase)
   window.App.Components.Export.button(getIssuesFn, filenameBase)  -> <button> el
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.Components = window.App.Components || {};

  const U = () => window.App.Utils;

  // Column order + how to pull each value from an issue object.
  const COLUMNS = [
    ["Issue ID", (i) => i.issueId],
    ["Mall", (i) => i.mall],
    ["Status", (i) => i.status],
    ["Waiting Reason", (i) => i.waitingReason || ""],
    ["Priority", (i) => i.priority],
    ["Tenant", (i) => i.tenant],
    ["Outlet No", (i) => i.outletNo],
    ["Issue", (i) => i.issue],
    ["Assigned To", (i) => i.assignedTo],
    ["Date Raised", (i) => i.dateRaised || ""],
    ["Days Open", (i) => (i.daysOpen === undefined || i.daysOpen === null ? "" : i.daysOpen)],
    ["Re-opened", (i) => (i.isReopened ? "Yes" : "No")],
    ["Remarks", (i) => i.remarks || ""],
    ["Created By", (i) => i.createdBy || ""],
    ["Created At", (i) => fmt(i.createdAt)],
    ["Resolved At", (i) => fmt(i.resolvedAt)],
    ["Resolved By", (i) => i.resolvedBy || ""],
    ["Last Updated", (i) => fmt(i.updatedAt)],
  ];

  function fmt(iso) {
    if (!iso) return "";
    try { return U().formatDateTime(iso); } catch (e) { return String(iso); }
  }

  // RFC-4180 field quoting.
  function csvCell(value) {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCsvString(issues) {
    const rows = [COLUMNS.map((c) => csvCell(c[0])).join(",")];
    (issues || []).forEach((issue) => {
      rows.push(COLUMNS.map((c) => csvCell(c[1](issue))).join(","));
    });
    return rows.join("\r\n");
  }

  function triggerDownload(text, filename) {
    // Prepend a UTF-8 BOM so Excel reads accented / non-Latin text correctly.
    const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      "_" + p(d.getHours()) + p(d.getMinutes());
  }

  function issuesToCsv(issues, filenameBase) {
    const name = (filenameBase || "leasing-issues") + "_" + stamp() + ".csv";
    triggerDownload(toCsvString(issues), name);
    return { ok: true, count: (issues || []).length, filename: name };
  }

  // Returns a ready-wired <button>. getIssuesFn returns (a promise of) the
  // array to export — usually the same filtered query the table is showing.
  function button(getIssuesFn, filenameBase) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--ghost btn--sm";
    btn.textContent = "Export CSV";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "Preparing…";
      try {
        const issues = await getIssuesFn();
        if (!issues || !issues.length) {
          window.App.Components.Toast.show("Nothing to export — the current view has no issues.");
          return;
        }
        const res = issuesToCsv(issues, filenameBase);
        window.App.Components.Toast.show("Exported " + res.count + " issue(s) to " + res.filename + ".");
      } catch (e) {
        console.error("Export failed:", e);
        window.App.Components.Toast.show("Export failed. Please try again.");
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
    return btn;
  }

  window.App.Components.Export = { issuesToCsv, toCsvString, button };
})();
