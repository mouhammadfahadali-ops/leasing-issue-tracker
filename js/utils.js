/* ==========================================================================
   utils.js — shared helper functions (no dependencies)
   Exposed on window.App.Utils
   ========================================================================== */

(function () {
  window.App = window.App || {};

  const MALLS = ["DMC", "DMTR", "DMH", "DML"];

  const STATUSES = ["New", "In Progress", "Waiting", "Resolved"];

  const WAITING_REASONS = ["Tenant", "Finance", "Management"];

  const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

  function generateId() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  // Days between a raised date (YYYY-MM-DD) and an end point (ISO datetime or null = today)
  function daysBetween(dateRaised, endIso) {
    if (!dateRaised) return 0;
    const start = new Date(dateRaised + "T00:00:00");
    const end = endIso ? new Date(endIso) : new Date();
    const diffMs = end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr.length <= 10 ? dateStr + "T00:00:00" : dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function relativeTime(iso) {
    if (!iso) return "—";
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + "d ago";
    return formatDate(iso.slice(0, 10));
  }

  function statusToClass(status) {
    switch (status) {
      case "New": return "pill--status-new";
      case "In Progress": return "pill--status-progress";
      case "Waiting": return "pill--status-waiting";
      case "Resolved": return "pill--status-resolved";
      default: return "pill--muted";
    }
  }

  function priorityToClass(priority) {
    switch (priority) {
      case "Low": return "pill--priority-low";
      case "Medium": return "pill--priority-medium";
      case "High": return "pill--priority-high";
      case "Urgent": return "pill--priority-urgent";
      default: return "pill--muted";
    }
  }

  function statusLabel(issue) {
    if (issue.status === "Waiting" && issue.waitingReason) {
      return "Waiting · " + issue.waitingReason;
    }
    return issue.status;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function el(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html.trim();
    return tmp.firstElementChild;
  }

  window.App.Utils = {
    MALLS,
    STATUSES,
    WAITING_REASONS,
    PRIORITIES,
    generateId,
    nowIso,
    todayIsoDate,
    daysBetween,
    formatDate,
    formatDateTime,
    relativeTime,
    statusToClass,
    priorityToClass,
    statusLabel,
    escapeHtml,
    debounce,
    el,
  };
})();
