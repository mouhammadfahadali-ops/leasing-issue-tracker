/* ==========================================================================
   toast.js — small transient confirmation messages
   Renders into #toastRoot.
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.Components = window.App.Components || {};

  let hideTimer = null;

  function show(message) {
    const root = document.getElementById("toastRoot");
    if (!root) return;
    root.innerHTML = '<div class="toast">' + window.App.Utils.escapeHtml(message) + "</div>";
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      root.innerHTML = "";
    }, 2600);
  }

  window.App.Components.Toast = { show };
})();
