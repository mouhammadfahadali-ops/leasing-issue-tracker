/* ==========================================================================
   themeToggle.js — one-click Light / Dark switch in the header.

   - First visit (no stored choice): the app follows the OS setting.
   - Clicking the toggle sets an explicit theme and remembers it in
     localStorage, so a refresh keeps it.
   - The <html data-theme="…"> attribute is what css/variables.css keys off.
     A tiny inline script in index.html <head> applies the stored value
     before first paint so there's no flash.

   Renders into #themeToggleSlot.
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.Components = window.App.Components || {};

  const KEY = "leasingMatters_theme";

  function stored() {
    try {
      const v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : null;
    } catch (e) {
      return null;
    }
  }

  function systemDark() {
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function effective() {
    return stored() || (systemDark() ? "dark" : "light");
  }

  let switchTimer = null;

  function apply(theme) {
    const root = document.documentElement;
    // Enable transitions only for the moment of the switch (see base.css).
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      root.classList.add("theme-switching");
      clearTimeout(switchTimer);
      switchTimer = setTimeout(() => root.classList.remove("theme-switching"), 320);
    }
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode — session only */ }
  }

  const SUN =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>';
  const MOON =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function render() {
    const slot = document.getElementById("themeToggleSlot");
    if (!slot) return;
    const cur = effective();
    const next = cur === "dark" ? "light" : "dark";
    slot.innerHTML =
      '<button type="button" class="icon-btn theme-toggle" ' +
      'aria-label="Switch to ' + next + ' theme" title="Switch to ' + next + ' theme">' +
      (cur === "dark" ? SUN : MOON) +
      "</button>";
    slot.firstChild.addEventListener("click", () => {
      apply(effective() === "dark" ? "light" : "dark");
      render();
    });
  }

  // If the user hasn't chosen explicitly, follow live OS theme changes.
  if (window.matchMedia) {
    try {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (!stored()) render();
      });
    } catch (e) { /* Safari <14 */ }
  }

  window.App.Components.ThemeToggle = { render, apply, effective };
})();
