/* ==========================================================================
   localStorageAdapter.js — the ONLY module that touches window.localStorage.
   This is the swappable "Prototype Storage" layer described in the
   architecture. A future SharePoint adapter implements this exact same
   function surface and nothing above it needs to change.

   Resilience notes (added in the V1 QA pass):
   - All reads/writes are wrapped in try/catch. If real localStorage is
     unavailable or throws (private-browsing lockdown, disabled storage,
     sandboxed iframe, quota errors, etc.), the adapter transparently falls
     back to an in-memory cache for the rest of the session, so the app
     keeps working instead of breaking. Data just won't survive a refresh
     in that situation — isAvailable() lets the UI warn about that once.
   - init() actively validates the stored JSON rather than just checking
     key existence, so a corrupted value (malformed JSON, or valid JSON of
     the wrong shape) is detected and the app recovers by reseeding, rather
     than silently running on empty/broken data.

   Exposed on window.App.Storage
   ========================================================================== */

(function () {
  window.App = window.App || {};

  const KEYS = {
    issues: "leasingTracker_issues_v1",
    activityLog: "leasingTracker_activityLog_v1",
    counters: "leasingTracker_counters_v1",
    currentUser: "leasingTracker_currentUser_v1",
  };

  // In-memory fallback so the app still functions if real localStorage
  // throws on every call (e.g. storage disabled by browser policy).
  const memoryCache = {};
  let storageAvailable = true;

  function probeStorage() {
    try {
      const testKey = "__leasingTracker_probe__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }
  storageAvailable = probeStorage();

  function readJson(key, fallback) {
    if (storageAvailable) {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw === null || raw === undefined) {
          return Object.prototype.hasOwnProperty.call(memoryCache, key) ? memoryCache[key] : fallback;
        }
        return JSON.parse(raw);
      } catch (e) {
        console.error("Storage read failed for", key, e);
        return Object.prototype.hasOwnProperty.call(memoryCache, key) ? memoryCache[key] : fallback;
      }
    }
    return Object.prototype.hasOwnProperty.call(memoryCache, key) ? memoryCache[key] : fallback;
  }

  function writeJson(key, value) {
    memoryCache[key] = value; // always keep the in-session copy current
    if (!storageAvailable) return false;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("Storage write failed for", key, e);
      storageAvailable = false; // stop retrying real storage this session
      return false;
    }
  }

  // Returns true only if a key holds syntactically valid JSON of the
  // expected shape. Used by init() to tell "missing" apart from "corrupt".
  function isValid(key, validator) {
    let raw;
    try {
      raw = window.localStorage.getItem(key);
    } catch (e) {
      return false;
    }
    if (raw === null || raw === undefined) return false;
    try {
      const parsed = JSON.parse(raw);
      return validator ? validator(parsed) : true;
    } catch (e) {
      return false;
    }
  }

  function seedFresh() {
    const seed = window.App.MockData.generate();
    writeJson(KEYS.issues, seed.issues);
    writeJson(KEYS.activityLog, seed.activityLog);
    writeJson(KEYS.counters, seed.counters);
    writeJson(KEYS.currentUser, window.App.MockData.CURRENT_USERS[0]);
  }

  // Returns { seeded, wasCorrupted, storageAvailable } so the caller (DAL)
  // can decide whether to surface a one-time warning to the user.
  function init() {
    if (!storageAvailable) {
      seedFresh();
      return { seeded: true, wasCorrupted: false, storageAvailable: false };
    }

    const issuesOk = isValid(KEYS.issues, Array.isArray);
    const logOk = isValid(KEYS.activityLog, Array.isArray);
    const countersOk = isValid(KEYS.counters, (v) => v && typeof v === "object" && !Array.isArray(v));

    const hadAnyData =
      window.localStorage.getItem(KEYS.issues) !== null ||
      window.localStorage.getItem(KEYS.activityLog) !== null ||
      window.localStorage.getItem(KEYS.counters) !== null;

    const allValid = issuesOk && logOk && countersOk;

    if (allValid) {
      return { seeded: false, wasCorrupted: false, storageAvailable: true };
    }

    // Missing entirely (first run) vs. present-but-broken (corruption) —
    // both are recovered the same way, but we report which one happened.
    seedFresh();
    return { seeded: true, wasCorrupted: hadAnyData, storageAvailable: true };
  }

  function resetToSeed() {
    seedFresh();
  }

  function isStorageAvailable() {
    return storageAvailable;
  }

  // ---- Issues ----
  function getIssues() {
    const val = readJson(KEYS.issues, []);
    return Array.isArray(val) ? val : [];
  }
  function setIssues(issues) {
    return writeJson(KEYS.issues, issues);
  }

  // ---- Activity log ----
  function getActivityLog() {
    const val = readJson(KEYS.activityLog, []);
    return Array.isArray(val) ? val : [];
  }
  function setActivityLog(log) {
    return writeJson(KEYS.activityLog, log);
  }

  // ---- Per-mall/year ID counters ----
  function getCounters() {
    const val = readJson(KEYS.counters, {});
    return val && typeof val === "object" && !Array.isArray(val) ? val : {};
  }
  function setCounters(counters) {
    return writeJson(KEYS.counters, counters);
  }

  // ---- Prototype current user (NOT authentication) ----
  function getCurrentUser() {
    return readJson(KEYS.currentUser, window.App.MockData.CURRENT_USERS[0]);
  }
  function setCurrentUser(name) {
    return writeJson(KEYS.currentUser, name);
  }

  window.App.Storage = {
    init,
    resetToSeed,
    isStorageAvailable,
    getIssues,
    setIssues,
    getActivityLog,
    setActivityLog,
    getCounters,
    setCounters,
    getCurrentUser,
    setCurrentUser,
  };
})();
