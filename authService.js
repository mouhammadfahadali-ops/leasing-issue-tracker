/* ==========================================================================
   authService.js — thin wrapper around MSAL.js (Microsoft Entra sign-in).
   This is the ONLY file responsible for authentication. It exposes:
     - init()            call once on page load
     - login()           starts interactive sign-in (redirect flow)
     - getAccount()       returns the signed-in account, or null
     - getAccessToken()   returns a valid Bearer token for SharePoint calls
                          (silent refresh first, interactive fallback)
     - getCurrentUser()   returns { displayName, username } for DAL.getCurrentUser()

   Exposed on window.App.AuthService
   ========================================================================== */

(function () {
  window.App = window.App || {};

  // ---- Configuration — from the Entra "Leasing Matters" App Registration ----
  const CLIENT_ID = "e2d59c4f-5981-4cf5-a2e9-f72e1898a86d";
  const TENANT_ID = "2e13ddab-e83e-4fa8-91cf-4a601cdaa57d";
  const REDIRECT_URI = "https://mouhammadfahadali-ops.github.io/leasing-issue-tracker/";
  const SHAREPOINT_SCOPE = "https://dolmengroupcom.sharepoint.com/AllSites.Write";

  const msalConfig = {
    auth: {
      clientId: CLIENT_ID,
      authority: "https://login.microsoftonline.com/" + TENANT_ID,
      redirectUri: REDIRECT_URI,
    },
    cache: {
      cacheLocation: "sessionStorage",
    },
  };

  let msalInstance = null;
  let currentAccount = null;

  async function init() {
    if (typeof msal === "undefined") {
      throw new Error("The Microsoft sign-in library (MSAL) failed to load. Check your internet connection.");
    }
    msalInstance = new msal.PublicClientApplication(msalConfig);

    const response = await msalInstance.handleRedirectPromise();
    if (response && response.account) {
      currentAccount = response.account;
    } else {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) currentAccount = accounts[0];
    }
    return currentAccount;
  }

  function login() {
    msalInstance.loginRedirect({ scopes: [SHAREPOINT_SCOPE] });
  }

  function getAccount() {
    return currentAccount;
  }

  async function getAccessToken() {
    if (!currentAccount) {
      throw new Error("Not signed in.");
    }
    try {
      const result = await msalInstance.acquireTokenSilent({
        scopes: [SHAREPOINT_SCOPE],
        account: currentAccount,
      });
      return result.accessToken;
    } catch (e) {
      // Silent refresh failed (e.g. token truly expired/revoked) — fall back
      // to an interactive re-prompt rather than surfacing a raw 401 later.
      msalInstance.acquireTokenRedirect({ scopes: [SHAREPOINT_SCOPE] });
      throw new Error("Your session needs to be refreshed. Redirecting to sign in again…");
    }
  }

  async function getCurrentUser() {
    if (!currentAccount) return null;
    return {
      displayName: currentAccount.name,
      username: currentAccount.username,
    };
  }

  window.App.AuthService = {
    init,
    login,
    getAccount,
    getAccessToken,
    getCurrentUser,
  };
})();
