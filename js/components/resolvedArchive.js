/* ==========================================================================
   resolvedArchive.js — Resolved / Archive screen.
   Same table/toolbar pattern as Active Issues, but scoped to resolved
   issues only, with Resolved Date + Resolution Duration columns, and a
   Re-open action reachable via the Issue Detail slide-over.
   This is a historical record, not a "deleted items" bin — resolved
   issues are filtered out of Active Issues by status alone; nothing is
   ever removed from storage.
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.Components = window.App.Components || {};

  const U = () => window.App.Utils;
  const DAL = () => window.App.DAL;

  // Row cap for a single unpaged table — a lightweight scalability
  // safeguard, not full pagination. At hundreds of resolved issues a
  // single flat table becomes hard to scan anyway; narrowing with search
  // or a date range is the intended way to get past this, per the brief's
  // instruction not to build complex pagination prematurely.
  const MAX_RENDERED_ROWS = 150;

  let filters = { priority: "", assignedTo: "", searchText: "", reopenedOnly: false, resolvedFrom: "", resolvedTo: "" };

  function hasActiveFilters() {
    return !!(filters.priority || filters.assignedTo || filters.searchText || filters.reopenedOnly || filters.resolvedFrom || filters.resolvedTo);
  }

  async function render(container) {
    const mall = window.App.State.getState().mall;
    const users = await DAL().getUsers();

    container.innerHTML =
      '<div class="view-header">' +
        "<div>" +
          '<div class="view-header__title">Resolved / Archive</div>' +
          '<div class="view-header__subtitle">' + (mall === "ALL" ? "All malls" : mall) + " · Full searchable history — nothing is ever deleted" + "</div>" +
        "</div>" +
      "</div>" +

      '<div class="glass-panel panel">' +
        '<div class="toolbar">' +
          '<div class="search-field">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.6-3.6"/></svg>' +
            '<input type="text" id="archiveSearchInput" placeholder="Search resolved issues…" value="' + U().escapeHtml(filters.searchText) + '" aria-label="Search resolved issues" />' +
          "</div>" +
          '<div class="filter-chip-row">' +
            select("archiveFilterPriority", "Priority", U().PRIORITIES, filters.priority) +
            select("archiveFilterAssignedTo", "Assigned To", users, filters.assignedTo) +
            '<label class="filter-select" style="display:inline-flex; align-items:center; gap:6px; cursor:pointer;">' +
              '<input type="checkbox" id="archiveReopenedOnly" ' + (filters.reopenedOnly ? "checked" : "") + ' style="margin:0;" /> Previously re-opened' +
            "</label>" +
            '<button type="button" class="filter-clear" id="archiveClearFilters">Clear</button>' +
            '<span id="archiveExportSlot" style="margin-left:auto;"></span>' +
          "</div>" +
        "</div>" +
        '<div class="toolbar mt-2">' +
          '<label class="text-tiny" for="archiveResolvedFrom">Resolved between</label>' +
          '<input type="date" class="form-control" id="archiveResolvedFrom" value="' + filters.resolvedFrom + '" style="width:auto; height:32px;" aria-label="Resolved from date" />' +
          '<span class="text-tiny">and</span>' +
          '<input type="date" class="form-control" id="archiveResolvedTo" value="' + filters.resolvedTo + '" style="width:auto; height:32px;" aria-label="Resolved to date" />' +
        "</div>" +
        '<div id="archiveResultsArea" class="mt-3" aria-live="polite"></div>' +
      "</div>";

    document.getElementById("archiveSearchInput").addEventListener(
      "input",
      U().debounce((e) => {
        filters.searchText = e.target.value;
        renderResults();
      }, 220)
    );
    ["Priority", "AssignedTo"].forEach((key) => {
      document.getElementById("archiveFilter" + key).addEventListener("change", (e) => {
        filters[key.charAt(0).toLowerCase() + key.slice(1)] = e.target.value;
        renderResults();
      });
    });
    document.getElementById("archiveReopenedOnly").addEventListener("change", (e) => {
      filters.reopenedOnly = e.target.checked;
      renderResults();
    });
    document.getElementById("archiveResolvedFrom").addEventListener("change", (e) => {
      filters.resolvedFrom = e.target.value;
      renderResults();
    });
    document.getElementById("archiveResolvedTo").addEventListener("change", (e) => {
      filters.resolvedTo = e.target.value;
      renderResults();
    });
    document.getElementById("archiveClearFilters").addEventListener("click", () => {
      filters = { priority: "", assignedTo: "", searchText: "", reopenedOnly: false, resolvedFrom: "", resolvedTo: "" };
      render(container);
    });

    const exportSlot = document.getElementById("archiveExportSlot");
    if (exportSlot && window.App.Components.Export) {
      exportSlot.appendChild(
        window.App.Components.Export.button(async () => {
          const mall = window.App.State.getState().mall;
          let issues = await DAL().getIssues(Object.assign({ mall, onlyResolved: true }, {
            priority: filters.priority, assignedTo: filters.assignedTo, searchText: filters.searchText,
            resolvedFrom: filters.resolvedFrom, resolvedTo: filters.resolvedTo,
          }));
          if (filters.reopenedOnly) issues = issues.filter((i) => i.isReopened);
          return issues;
        }, "resolved-issues")
      );
    }

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
    const area = document.getElementById("archiveResultsArea");
    if (!area) return;

    area.setAttribute("aria-busy", "true");

    const query = Object.assign({ mall, onlyResolved: true }, {
      priority: filters.priority, assignedTo: filters.assignedTo, searchText: filters.searchText,
      resolvedFrom: filters.resolvedFrom, resolvedTo: filters.resolvedTo,
    });
    let issues = await DAL().getIssues(query);
    if (filters.reopenedOnly) issues = issues.filter((i) => i.isReopened);

    if (!document.getElementById("archiveResultsArea")) return;

    if (!issues.length) {
      // Distinguish "nothing resolved yet at all" from "filters matched nothing" —
      // a busy team clearing filters is a different action from one that's just
      // starting out, and the message should say which situation they're in.
      area.innerHTML = hasActiveFilters()
        ? '<div class="empty-state">' +
          '<div class="empty-state__title">No issues found matching your filters</div>' +
          '<div class="empty-state__sub">Try clearing filters or widening the resolved-date range.</div>' +
          "</div>"
        : '<div class="empty-state">' +
          '<div class="empty-state__title">No resolved issues' + (mall === "ALL" ? "" : " for " + mall) + " yet</div>" +
          '<div class="empty-state__sub">Resolved issues will appear here automatically once marked resolved — nothing is ever deleted.</div>' +
          "</div>";
      area.removeAttribute("aria-busy");
      return;
    }

    const capped = issues.length > MAX_RENDERED_ROWS;
    const shown = capped ? issues.slice(0, MAX_RENDERED_ROWS) : issues;

    area.innerHTML =
      (capped
        ? '<div class="text-tiny mb-2" style="margin-bottom:8px;">Showing the ' + MAX_RENDERED_ROWS + ' most recently resolved of ' + issues.length + ' matches — narrow with search or the resolved-date range to see the rest.</div>'
        : "") +
      '<div class="table-wrap"><table class="data-table">' +
      "<thead><tr>" +
      "<th>Mall</th><th>Issue ID</th><th>Issue</th><th>Outlet</th><th>Tenant</th><th>Assigned To</th><th>Priority</th><th>Resolved</th><th>Duration</th>" +
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
    return (
      '<tr data-issue-id="' + issue.issueId + '">' +
      '<td class="cell-mall">' + u.escapeHtml(issue.mall) + "</td>" +
      '<td class="cell-secondary">' + u.escapeHtml(issue.issueId) + "</td>" +
      '<td class="wrap cell-primary">' + u.escapeHtml(truncate(issue.issue, 70)) + "</td>" +
      '<td>' + u.escapeHtml(issue.outletNo) + "</td>" +
      '<td class="cell-primary">' + u.escapeHtml(issue.tenant) +
        (issue.isReopened ? ' <span class="reopened-tag">Re-opened before</span>' : "") + "</td>" +
      '<td>' + u.escapeHtml(issue.assignedTo) + "</td>" +
      '<td><span class="pill ' + u.priorityToClass(issue.priority) + '">' + issue.priority + "</span></td>" +
      '<td class="cell-secondary">' + u.formatDate((issue.resolvedAt || "").slice(0, 10)) + "</td>" +
      '<td class="days-open">' + issue.daysOpen + " day" + (issue.daysOpen === 1 ? "" : "s") + "</td>" +
      "</tr>"
    );
  }

  function truncate(str, n) {
    if (!str) return "";
    return str.length > n ? str.slice(0, n - 1) + "…" : str;
  }

  window.App.Components.ResolvedArchive = { render };
})();
