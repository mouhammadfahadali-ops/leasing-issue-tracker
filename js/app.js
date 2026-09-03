/* ==========================================================================
   app.js — application entry point. Wires the shell (top bar, sidebar) and
   routes between the three main screens. window.App.render() is the single
   place that refreshes anything DAL-derived (badge counts, KPIs, lists)
   after a mutation — every component calls it once it has finished its own
   local update.

   All rendering here is async because every component fetches its data
   through the (async) DAL before drawing anything.
   ========================================================================== */

(function () {
  window.App = window.App || {};

  // Last-resort safety net: surface an otherwise-silent failure as a toast
  // instead of leaving the user staring at a half-rendered screen.
  window.addEventListener("unhandledrejection", (ev) => {
    console.error("Unhandled promise rejection:", ev.reason);
    if (window.App.Components && window.App.Components.Toast) {
      const r = ev.reason;
      const msg = r && r.message && r.status !== undefined
        ? r.message
        : "Something went wrong. Please try again.";
      window.App.Components.Toast.show(msg);
    }
  });

  async function renderShell() {
    window.App.Components.MallSelector.render(); // sync — reads only local UI state
    await window.App.Components.UserSelector.render();
    await window.App.Components.Sidebar.render();
  }

  async function renderView() {
    const viewRoot = document.getElementById("viewRoot");
    const { view } = window.App.State.getState();
    if (view === "dashboard") {
      await window.App.Components.Dashboard.render(viewRoot);
    } else if (view === "active") {
      await window.App.Components.ActiveIssues.render(viewRoot);
    } else if (view === "archive") {
      await window.App.Components.ResolvedArchive.render(viewRoot);
    }
  }

  async function render() {
    try {
      await renderShell();
      await renderView();
    } catch (e) {
      console.error("Render failed:", e);
      window.App.Components.Toast.show("Something went wrong showing this screen. Please try again.");
    }
  }
  window.App.render = render;

  async function init() {
    // SharePoint mode: make sure there's a signed-in Microsoft account before
    // we touch any data. If not, AuthGate paints the sign-in screen and we
    // stop here — the page re-enters init() after the sign-in redirect.
    if (window.App.Config && window.App.Config.isSharePoint && window.App.AuthGate) {
      let signedIn = false;
      try {
        signedIn = await window.App.AuthGate.ensureSignedIn();
      } catch (e) {
        console.error("Sign-in check failed:", e);
        return;
      }
      if (!signedIn) return;
    }

    let initResult;
    try {
      initResult = await window.App.DAL.init();
    } catch (e) {
      console.error("Failed to initialize the app:", e);
      const msg = e && e.message && e.status !== undefined
        ? e.message
        : "Unable to load your data. Please refresh the page.";
      window.App.Components.Toast.show(msg);
      return;
    }

    window.App.State.subscribe(() => {
      render();
    });

    document.getElementById("newIssueBtn").addEventListener("click", () => {
      window.App.Components.IssueForm.openNew();
    });

    await render();

    if (initResult && initResult.wasCorrupted) {
      window.App.Components.Toast.show("Stored data looked invalid, so sample data was restored.");
    } else if (initResult && !initResult.storageAvailable) {
      window.App.Components.Toast.show("Local storage is unavailable in this browser — changes won't be saved after you close this tab.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => { init(); });
})();
