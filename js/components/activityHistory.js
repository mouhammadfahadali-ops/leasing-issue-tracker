/* ==========================================================================
   activityHistory.js — renders the append-only audit trail as a timeline.
   Used inside the Issue Detail slide-over. Pure render function — no
   storage access here, entries are passed in already fetched via the DAL.
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.Components = window.App.Components || {};

  const FIELD_LABELS = {
    issue: "Issue description",
    outletNo: "Outlet No.",
    tenant: "Tenant",
    dateRaised: "Date raised",
    assignedTo: "Assigned To",
    status: "Status",
    priority: "Priority",
    waitingReason: "Waiting reason",
    remarks: "Remarks",
  };

  function describe(entry) {
    const U = window.App.Utils;
    switch (entry.action) {
      case "created":
        return { title: "Issue created", detail: entry.comment };
      case "status_changed":
        if (entry.to === "Waiting" && entry.waitingReason) {
          return { title: "Status changed", detail: (entry.from || "—") + " → Waiting · " + entry.waitingReason };
        }
        return { title: "Status changed", detail: (entry.from || "—") + " → " + entry.to };
      case "waiting_reason_changed":
        if (!entry.to) return { title: "Waiting reason cleared", detail: "Was: " + (entry.from || "—") };
        if (!entry.from) return { title: "Waiting reason set", detail: entry.to };
        return { title: "Waiting reason changed", detail: entry.from + " → " + entry.to };
      case "priority_changed":
        return { title: "Priority changed", detail: entry.from + " → " + entry.to };
      case "assignment_changed":
        return { title: "Reassigned", detail: entry.from + " → " + entry.to };
      case "remark_added":
        return { title: "Remark added", detail: entry.comment };
      case "resolved":
        return { title: "Issue resolved", detail: entry.comment || "Marked resolved." };
      case "reopened":
        return { title: "Issue re-opened", detail: entry.comment || "Moved back to Active Issues." };
      case "issue_edited":
        return {
          title: (FIELD_LABELS[entry.field] || entry.field) + " updated",
          detail: U.escapeHtml(entry.from || "—") + " → " + U.escapeHtml(entry.to || "—"),
        };
      default:
        return { title: entry.action, detail: entry.comment || "" };
    }
  }

  function renderTimeline(entries) {
    const U = window.App.Utils;
    if (!entries.length) {
      return '<div class="empty-state"><div class="empty-state__title">No activity yet</div></div>';
    }
    return (
      '<div class="timeline">' +
      entries
        .map((entry) => {
          const d = describe(entry);
          return (
            '<div class="timeline-item">' +
            '<div class="timeline-item__top">' +
            '<span class="timeline-item__action">' + U.escapeHtml(d.title) + "</span>" +
            '<span class="timeline-item__time">' + U.escapeHtml(U.formatDateTime(entry.timestamp)) + "</span>" +
            "</div>" +
            (d.detail ? '<div class="timeline-item__detail">' + U.escapeHtml(d.detail) + "</div>" : "") +
            '<div class="timeline-item__actor">' + U.escapeHtml(entry.actor || "Unknown") + "</div>" +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  window.App.Components.ActivityHistory = { renderTimeline };
})();
