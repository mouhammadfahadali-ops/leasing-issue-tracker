/* ==========================================================================
   userSelector.js — the top-bar identity control.

   SharePoint mode : shows the real signed-in Microsoft user (read-only) with
                     a Sign out action. Not switchable — identity comes from
                     the Microsoft sign-in.
   Local demo mode : the original prototype "Acting as" picker, so testers can
                     attribute their actions while there's no real login.

   Renders into #userSelectorSlot. Keeps the same wrapper classes so the
   existing glass styling in components.css applies in both modes.
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.Components = window.App.Components || {};

  const USER_ICON =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="user-select-wrap__icon"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>';

  async function renderSharePoint(slot) {
    const account = window.App.AuthService.getAccount();
    const name = account ? account.name : "Signed in";
    const email = account ? account.username : "";

    slot.innerHTML =
      '<div class="user-select-wrap" title="' + window.App.Utils.escapeHtml(email) + '">' +
      USER_ICON +
      '<div class="user-select-wrap__text">' +
        '<span class="user-select-wrap__label">Signed in</span>' +
        '<span class="user-select" style="display:flex;align-items:center;gap:8px;">' +
          '<strong style="font-weight:600;">' + window.App.Utils.escapeHtml(name) + "</strong>" +
          '<button type="button" id="signOutBtn" class="btn btn--ghost btn--sm" style="padding:2px 8px;">Sign out</button>' +
        "</span>" +
      "</div>" +
      "</div>";

    const btn = document.getElementById("signOutBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        try {
          window.App.AuthService.logout();
        } catch (e) {
          // Fallback if logout() isn't available for some reason.
          window.location.reload();
        }
      });
    }
  }

  async function renderLocal(slot) {
    const [users, current] = await Promise.all([
      window.App.DAL.getUsers(),
      window.App.DAL.getCurrentUser(),
    ]);

    slot.innerHTML =
      '<div class="user-select-wrap" title="Prototype only — not a login. Anyone can switch this to attribute their own actions.">' +
      USER_ICON +
      '<div class="user-select-wrap__text">' +
        '<span class="user-select-wrap__label">Acting as <em>(prototype — not a login)</em></span>' +
        '<select class="user-select" id="userSelectInput">' +
        users
          .map((u) => '<option value="' + u + '"' + (u === current ? " selected" : "") + ">" + u + "</option>")
          .join("") +
        "</select>" +
      "</div>" +
      "</div>";

    document.getElementById("userSelectInput").addEventListener("change", async (e) => {
      await window.App.DAL.setCurrentUser(e.target.value);
    });
  }

  async function render() {
    const slot = document.getElementById("userSelectorSlot");
    if (!slot) return;
    if (window.App.Config && window.App.Config.isSharePoint) {
      await renderSharePoint(slot);
    } else {
      await renderLocal(slot);
    }
  }

  window.App.Components.UserSelector = { render };
})();
