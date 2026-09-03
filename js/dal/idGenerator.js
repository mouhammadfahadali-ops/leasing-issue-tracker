/* ==========================================================================
   idGenerator.js — per-mall, per-year sequential Issue ID generation
   e.g. DMC-2026-0001, DMTR-2026-0001 ...
   Exposed on window.App.DAL.IdGenerator

   Async by signature (returns a Promise) even though today's localStorage
   implementation completes synchronously under the hood. This is
   deliberate: a future SharePoint-backed sequence (e.g. reading/writing a
   counter list over the network) is inherently asynchronous, and keeping
   this async now means nothing above the DAL has to change later.
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.DAL = window.App.DAL || {};

  function pad(num, size) {
    let s = String(num);
    while (s.length < size) s = "0" + s;
    return s;
  }

  // Reads + atomically increments the counter for mall+year via the Storage adapter.
  async function nextIssueId(mall) {
    const year = new Date().getFullYear();
    const key = mall + "_" + year;
    const counters = window.App.Storage.getCounters();
    const next = (counters[key] || 0) + 1;
    counters[key] = next;
    window.App.Storage.setCounters(counters);
    return mall + "-" + year + "-" + pad(next, 4);
  }

  window.App.DAL.IdGenerator = { nextIssueId };
})();
