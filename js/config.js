/* ==========================================================================
   config.js — one place to choose where the app's data lives.

   STORAGE_MODE:
     "sharepoint"  → real Microsoft sign-in + the SharePoint lists (production)
     "local"       → browser localStorage + seeded demo data (offline demo)

   Override at runtime with a query string, e.g.
     index.html?storage=local     — force the offline demo
     index.html?storage=sharepoint

   The chosen mode decides which Data Access Layer + storage scripts
   index.html loads (see the loader block at the bottom of index.html).
   Everything above the DAL (all UI components) is identical either way.
   ========================================================================== */

(function () {
  window.App = window.App || {};

  const DEFAULT_MODE = "sharepoint";

  function resolveMode() {
    try {
      const q = new URLSearchParams(window.location.search).get("storage");
      if (q === "local" || q === "sharepoint") return q;
    } catch (e) { /* ignore */ }
    return DEFAULT_MODE;
  }

  const mode = resolveMode();

  window.App.Config = {
    STORAGE_MODE: mode,
    isSharePoint: mode === "sharepoint",
    isLocal: mode === "local",

    // SharePoint / Entra — mirrors js/auth/authService.js. Kept here too so
    // non-auth modules (schema tools, adapters) have one source of truth.
    SHAREPOINT_SITE: "https://dolmengroupcom.sharepoint.com/sites/DolmenLeasing",
    LISTS: {
      issues: "Issues",
      activityLog: "ActivityLog",
      counters: "Counters",
    },

    // Options shown in every "Assigned To" control (New Issue form, Issue
    // Detail quick-actions, and the list filters). Must match the choices on
    // the SharePoint Issues > AssignedTo column.
    TEAM_MEMBERS: ["Leasing", "CEO", "Finance", "FitOut"],
  };
})();
