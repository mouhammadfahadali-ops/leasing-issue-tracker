/* ==========================================================================
   sidebar.js — left navigation: Dashboard / Active Issues / Resolved Archive
   Renders into #sidebar.
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.Components = window.App.Components || {};

  const ICONS = {
    dashboard:
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="12" width="8" height="9" rx="2"/><rect x="3" y="14" width="8" height="7" rx="2"/></svg>',
    active:
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    archive:
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg>',
  };

  async function render() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const { view, mall } = window.App.State.getState();
    const [activeIssues, resolvedIssues] = await Promise.all([
      window.App.DAL.getIssues({ mall, excludeResolved: true }),
      window.App.DAL.getIssues({ mall, onlyResolved: true }),
    ]);
    const activeCount = activeIssues.length;
    const resolvedCount = resolvedIssues.length;

    const isSharePoint = window.App.Config && window.App.Config.isSharePoint;

    const footerInner = isSharePoint
      ? '<span class="text-tiny" style="padding: 0 var(--sp-3);">Connected to SharePoint</span>'
      : '<div class="dev-tools-wrap">' +
          '<span class="text-tiny dev-tools-label">⚠ Prototype tool — not a business function</span>' +
          '<button type="button" class="btn btn--ghost btn--sm" id="resetSeedBtn" style="justify-content:flex-start; color: var(--danger);">Reset Demo Data</button>' +
        "</div>" +
        '<span class="text-tiny" style="padding: 0 var(--sp-3);">Local demo · this browser only</span>';

    sidebar.innerHTML =
      '<div class="sidebar__nav">' +
      navItem("dashboard", "Dashboard", ICONS.dashboard, view === "dashboard", null) +
      navItem("active", "Active Issues", ICONS.active, view === "active", activeCount) +
      navItem("archive", "Resolved / Archive", ICONS.archive, view === "archive", resolvedCount) +
      "</div>" +
      '<div class="sidebar__footer">' +
      footerInner +
      "</div>";

    sidebar.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.App.State.setView(btn.getAttribute("data-view"));
      });
    });

    const resetBtn = document.getElementById("resetSeedBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        const confirmed = window.confirm(
          "PROTOTYPE ONLY: this permanently discards every issue and activity entry you've created or changed in this browser, and restores the original sample data. This cannot be undone. Continue?"
        );
        if (!confirmed) return;
        try {
          await window.App.DAL.resetDemoData();
        } catch (e) {
          console.error("Failed to reset demo data:", e);
          window.App.Components.Toast.show("Unable to reset demo data. Please try again.");
          return;
        }
        window.App.Components.Toast.show("Demo data has been reset to the original sample issues.");
        await window.App.render();
      });
    }
  }

  function navItem(view, label, icon, isActive, badge) {
    return (
      '<button type="button" class="nav-item' +
      (isActive ? " is-active" : "") +
      '" data-view="' +
      view +
      '">' +
      '<span class="nav-item__icon">' +
      icon +
      "</span>" +
      '<span class="sidebar__label">' +
      label +
      "</span>" +
      (badge !== null && badge !== undefined
        ? '<span class="nav-item__badge sidebar__label">' + badge + "</span>"
        : "") +
      "</button>"
    );
  }

  window.App.Components.Sidebar = { render };
})();
