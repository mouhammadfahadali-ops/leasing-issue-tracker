/* ==========================================================================
   authGate.js — stands in front of the app in SharePoint mode.

   ensureSignedIn():
     - initialises MSAL and checks for an existing / just-redirected account
     - if signed in  → resolves true, app boots normally
     - if not        → paints a full-screen glass sign-in panel and resolves
                       false. Clicking "Sign in with Microsoft" starts the
                       redirect flow; the page comes back here signed in.

   Only loaded when Config.STORAGE_MODE === "sharepoint".
   Exposed on window.App.AuthGate
   ========================================================================== */

(function () {
  window.App = window.App || {};

  const STYLE = `
    #authRoot{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;
      justify-content:center;padding:var(--sp-6);
      background:var(--bg-gradient, linear-gradient(160deg,#eef1f6,#e6eaf2));}
    #authRoot .auth-card{width:100%;max-width:400px;padding:var(--sp-8) var(--sp-7);
      border-radius:var(--radius-xl,26px);text-align:center;
      background:var(--glass-fill-strong, rgba(255,255,255,.82));
      border:1px solid var(--glass-border, rgba(255,255,255,.55));
      box-shadow:var(--shadow-lg, 0 20px 60px rgba(15,23,42,.14));
      -webkit-backdrop-filter:var(--glass-blur, blur(22px) saturate(180%));
      backdrop-filter:var(--glass-blur, blur(22px) saturate(180%));}
    #authRoot h1{font-size:20px;margin:0 0 var(--sp-2);color:var(--text-primary,#1d1d1f);
      font-weight:600;letter-spacing:-.01em;}
    #authRoot p{font-size:13px;line-height:1.5;color:var(--text-secondary,#6e6e73);
      margin:0 0 var(--sp-6);}
    #authRoot button{width:100%;padding:12px 18px;border:none;cursor:pointer;
      border-radius:var(--radius-md,14px);font-size:14px;font-weight:600;
      font-family:inherit;color:#fff;background:var(--accent,#0a84ff);
      transition:background var(--duration-fast,150ms) var(--ease-out,ease);}
    #authRoot button:hover{background:var(--accent-strong,#0066cc);}
    #authRoot button:disabled{opacity:.6;cursor:progress;}
    #authRoot .auth-status{margin-top:var(--sp-4);font-size:12px;
      color:var(--text-secondary,#6e6e73);min-height:1em;}
    #authRoot .auth-status.is-error{color:var(--danger,#ff3b30);}
  `;

  function injectStyle() {
    if (document.getElementById("authGateStyle")) return;
    const s = document.createElement("style");
    s.id = "authGateStyle";
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function renderPanel(onSignIn, initialError) {
    injectStyle();
    let root = document.getElementById("authRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "authRoot";
      document.body.appendChild(root);
    }
    root.innerHTML =
      '<div class="auth-card" role="dialog" aria-label="Sign in to Leasing Matters">' +
        "<h1>Leasing Matters</h1>" +
        "<p>Sign in with your Dolmen Microsoft 365 account to continue.</p>" +
        '<button type="button" id="authGateSignInBtn">Sign in with Microsoft</button>' +
        '<div class="auth-status' + (initialError ? " is-error" : "") + '" id="authGateStatus">' +
          (initialError || "") +
        "</div>" +
      "</div>";

    const btn = document.getElementById("authGateSignInBtn");
    const status = document.getElementById("authGateStatus");
    btn.addEventListener("click", () => {
      btn.disabled = true;
      status.classList.remove("is-error");
      status.textContent = "Redirecting to Microsoft…";
      try {
        onSignIn();
      } catch (e) {
        btn.disabled = false;
        status.classList.add("is-error");
        status.textContent = e.message || "Could not start sign-in.";
      }
    });
  }

  function removePanel() {
    const root = document.getElementById("authRoot");
    if (root) root.remove();
  }

  async function ensureSignedIn() {
    const Auth = window.App.AuthService;
    if (!Auth) {
      renderPanel(() => {}, "Sign-in module failed to load. Check your connection and refresh.");
      return false;
    }

    try {
      await Auth.init();
    } catch (e) {
      renderPanel(() => Auth.login(), e.message || "Sign-in could not be initialised.");
      return false;
    }

    if (Auth.getAccount()) {
      removePanel();
      return true;
    }

    renderPanel(() => Auth.login());
    return false;
  }

  window.App.AuthGate = { ensureSignedIn, removePanel };
})();
