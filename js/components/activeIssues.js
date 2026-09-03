/* ==========================================================================
   activeIssues.js — Active Issues screen: toolbar (search + filters) + table.
   Renders into #viewRoot when App.State.view === 'active'.
   Local filter state lives in this module so typing in Search only
   re-renders the results area, not the whole screen.
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.Components = window.App.Components || {};

  const U = () => window.App.Utils;
  const DAL = () => window.App.DAL;

  // Lightweight scalability safeguard (not full pagination) — see the same
  // constant and rationale in resolvedArchive.js.
  const MAX_RENDERED_ROWS = 150;

  let filters = { status: "", waitingReason: "", priority: "", assignedTo: "", searchText: "" };

  function hasActiveFilters() {
    return !!(filters.status || filters.waitingReason || filters.priority || filters.assignedTo || filters.searchText);
  }

  async function render(container) {
    const mall = window.App.State.getState().mall;
    const users = await DAL().getUsers();

    container.innerHTML =
      '<div class="view-header">' +
        "<div>" +
          '<div class="view-header__title">Active Issues</div>' +
          '<div class="view-header__subtitle">' + (mall === "ALL" ? "All malls" : mall) + " · New → In Progress → Waiting → Resolved" + "</div>" +
        "</div>" +
        '<button type="button" class="btn btn--primary" id="activeNewIssueBtn">+ New Issue</button>' +
      "</div>" +

      '<div class="glass-panel panel">' +
        '<div class="toolbar">' +
          '<div class="search-field">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.6-3.6"/></svg>' +
            '<input type="text" id="activeSearchInput" placeholder="Search issue, tenant, outlet…" value="' + U().escapeHtml(filters.searchText) + '" aria-label="Search active issues" />' +
          "</div>" +
          '<div class="filter-chip-row">' +
            select("activeFilterStatus", "Status", U().STATUSES.filter((s) => s !== "Resolved"), filters.status) +
            select("activeFilterWaitingReason", "Waiting Reason", U().WAITING_REASONS, filters.waitingReason) +
            select("activeFilterPriority", "Priority", U().PRIORITIES, filters.priority) +
            select("activeFilterAssignedTo", "Assigned To", users, filters.assignedTo) +
            '<button type="button" class="filter-clear" id="activeClearFilters">Clear</button>' +
          "</div>" +
        "</div>" +
        '<div id="activeResultsArea" class="mt-3" aria-live="polite"></div>' +
      "</div>";

    document.getElementById("activeNewIssueBtn").addEventListener("click", () => {
      window.App.Components.IssueForm.openNew();
    });

    document.getElementById("activeSearchInput").addEventListener(
      "input",
      U().debounce((e) => {
        filters.searchText = e.target.value;
        renderResults();
      }, 220)
    );

    ["Status", "WaitingReason", "Priority", "AssignedTo"].forEach((key) => {
      document.getElementById("activeFilter" + key).addEventListener("change", (e) => {
        filters[key.charAt(0).toLowerCase() + key.slice(1)] = e.target.value;
        renderResults();
      });
    });

    document.getElementById("activeClearFilters").addEventListener("click", () => {
      filters = { status: "", waitingReason: "", priority: "", assignedTo: "", searchText: "" };
      render(container);
    });

    await renderResults();
  }

  function select(id, label, options, current) {
    return (
      '<select class="filter-select" id="' + id + '" aria-label="Filter by ' + label + '">' +
      '<option value="">' + label + "</option>" +
      options.map((o) => '<option value="' + o + '"' + (o === current ? " selected" : "") + ">" + o + "</option>").join("") +
      "</select>"
    );
  }

  async function renderResults() {
    const mall = window.App.State.getState().mall;
    const area = document.getElementById("activeResultsArea");
    if (!area) return;

    area.setAttribute("aria-busy", "true");

    const query = Object.assign({ mall, excludeResolved: true }, filters);
    const issues = await DAL().getIssues(query);

    // Guard against a stale response landing after the user has navigated away
    if (!document.getElementById("activeResultsArea")) return;

    if (!issues.length) {
      area.innerHTML = hasActiveFilters()
        ? '<div class="empty-state">' +
          '<div class="empty-state__title">No issues found matching your filters</div>' +
          '<div class="empty-state__sub">Try clearing filters, or search a different tenant, outlet, or issue.</div>' +
          "</div>"
        : '<div class="empty-state">' +
          '<div class="empty-state__title">No active issues' + (mall === "ALL" ? "" : " for " + mall) + "</div>" +
          '<div class="empty-state__sub">Everything here is resolved, or nothing has been logged yet. Use "+ New Issue" to add one.</div>' +
          "</div>";
      area.removeAttribute("aria-busy");
      return;
    }

    const capped = issues.length > MAX_RENDERED_ROWS;
    const shown = capped ? issues.slice(0, MAX_RENDERED_ROWS) : issues;

    area.innerHTML =
      (capped
        ? '<div class="text-tiny" style="margin-bottom:8px;">Showing the ' + MAX_RENDERED_ROWS + ' most recently updated of ' + issues.length + ' matches — narrow with search or filters to see the rest.</div>'
        : "") +
      '<div class="table-wrap"><table class="data-table">' +
      "<thead><tr>" +
      "<th>Mall</th><th>Issue ID</th><th>Issue</th><th>Outlet</th><th>Tenant</th><th>Assigned To</th><th>Priority</th><th>Status</th><th>Date</th><th>Days Open</th>" +
      "</tr></thead><tbody>" +
      shown.map(rowHtml).join("") +
      "</tbody></table></div>";
    area.removeAttribute("aria-busy");

    area.querySelectorAll("tr[data-issue-id]").forEach((row) => {
      row.addEventListener("click", () => {
        window.App.Components.IssueDetail.open(row.getAttribute("data-issue-id"));
      });
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.App.Components.IssueDetail.open(row.getAttribute("data-issue-id"));
        }
      });
      row.setAttribute("tabindex", "0");
    });
  }

  function rowHtml(issue) {
    const u = U();
    const agingClass =
      issue.daysOpen >= DAL().CRITICAL_THRESHOLD_DAYS ? "days-open--critical" :
      issue.daysOpen >= DAL().AGING_THRESHOLD_DAYS ? "days-open--aging" : "";
    return (
      '<tr data-issue-id="' + issue.issueId + '">' +
      '<td class="cell-mall">' + u.escapeHtml(issue.mall) + "</td>" +
      '<td class="cell-secondary">' + u.escapeHtml(issue.issueId) + "</td>" +
      '<td class="wrap cell-primary">' + u.escapeHtml(truncate(issue.issue, 70)) + "</td>" +
      '<td>' + u.escapeHtml(issue.outletNo) + "</td>" +
      '<td class="cell-primary">' + u.escapeHtml(issue.tenant) +
        (issue.isReopened ? ' <span class="reopened-tag">Re-opened</span>' : "") + "</td>" +
      '<td>' + u.escapeHtml(issue.assignedTo) + "</td>" +
      '<td><span class="pill ' + u.priorityToClass(issue.priority) + '">' + issue.priority + "</span></td>" +
      '<td><span class="pill ' + u.statusToClass(issue.status) + '">' + u.escapeHtml(u.statusLabel(issue)) + "</span></td>" +
      '<td class="cell-secondary">' + u.formatDate(issue.dateRaised) + "</td>" +
      '<td class="days-open ' + agingClass + '">' + issue.daysOpen + "</td>" +
      "</tr>"
    );
  }

  function truncate(str, n) {
    if (!str) return "";
    return str.length > n ? str.slice(0, n - 1) + "…" : str;
  }

  window.App.Components.ActiveIssues = { render };
})();
