/* ==========================================================================
   counterService.js — Phase 3: collision-proof Issue ID generation.

   Issue IDs look like  DMC-2026-0001 :
      <mallCode> - <year> - <4-digit running sequence, per mall, per year>

   The running sequence lives in the SharePoint "Counters" list, one row
   per (Mall, Year), column LastSequence. Handing out the next ID means
   "read LastSequence, add 1, write it back" — which is a race if two
   people create an issue in the same second. We make it safe WITHOUT any
   server-side code by using SharePoint's own optimistic-concurrency:

     1. GET the counter row (comes with an ETag).
     2. PATCH LastSequence = LastSequence + 1, sending IF-MATCH: <that ETag>.
     3. If someone else wrote first, SharePoint rejects our PATCH with
        HTTP 412 (Precondition Failed). We wait a random moment and retry
        from step 1 with the fresh value.

   With a 4-person team the loop practically never runs twice, but it is
   correct even under heavy contention.

   Depends on: window.App.SP  (low-level helper exposed by sharePointAdapter.js)
   Exposed on: window.App.CounterService
   ========================================================================== */

(function () {
  window.App = window.App || {};

  const COUNTERS_LIST = "Counters";
  const MAX_ATTEMPTS = 12;
  const SEQ_PAD = 4;

  // Accept either a bare code (DMC / DMTR / DMH / DML) or a full mall name,
  // and normalise to the code used in the Issue ID.
  const MALL_CODES = ["DMC", "DMTR", "DMH", "DML"];
  const NAME_TO_CODE = {
    "dolmen mall clifton": "DMC",
    "dolmen mall tariq road": "DMTR",
    "dolmen mall hyderi": "DMH",
    "dolmen mall lal kothi": "DML",
    "dolmen mall lalukhet": "DML",
  };

  function mallCode(mall) {
    if (!mall) throw new Error("A mall is required to generate an Issue ID.");
    const raw = String(mall).trim();
    const upper = raw.toUpperCase();
    if (MALL_CODES.indexOf(upper) !== -1) return upper;
    const byName = NAME_TO_CODE[raw.toLowerCase()];
    if (byName) return byName;
    throw new Error('Unrecognised mall "' + mall + '". Expected one of: ' + MALL_CODES.join(", ") + ".");
  }

  function formatIssueId(code, year, seq) {
    return code + "-" + year + "-" + String(seq).padStart(SEQ_PAD, "0");
  }

  const SP = () => {
    if (!window.App.SP) {
      throw new Error("sharePointAdapter.js must load before counterService.js.");
    }
    return window.App.SP;
  };

  function itemsPath() {
    return "web/lists/getbytitle('" + COUNTERS_LIST + "')/items";
  }

  // Random 40–160ms per attempt so concurrent callers don't march in
  // lock-step and keep colliding (thundering-herd avoidance).
  function backoff(attempt) {
    const ms = 40 * attempt + Math.floor(Math.random() * 120);
    return new Promise((r) => setTimeout(r, ms));
  }

  // Find the counter row for this mall+year. Year is matched client-side so
  // it works whether the Year column is a Number or a Text column.
  async function findCounterRow(code, year) {
    const safeCode = code.replace(/'/g, "''");
    const data = await SP().request(
      itemsPath() + "?$filter=Mall eq '" + safeCode + "'&$top=200"
    );
    const rows = data.d.results || [];
    return rows.find((r) => String(r.Year) === String(year)) || null;
  }

  async function createCounterRow(code, year) {
    const entityType = await SP().getEntityType(COUNTERS_LIST);
    const data = await SP().request(itemsPath(), {
      method: "POST",
      body: {
        __metadata: { type: entityType },
        Title: code + "-" + year,
        Mall: code,
        Year: Number(year),
        LastSequence: 0,
      },
    });
    return data.d;
  }

  async function bumpCounterRow(row, nextValue) {
    const entityType = await SP().getEntityType(COUNTERS_LIST);
    await SP().request(itemsPath() + "(" + row.Id + ")", {
      method: "MERGE",
      etag: row.__metadata && row.__metadata.etag,
      body: {
        __metadata: { type: entityType },
        LastSequence: nextValue,
      },
    });
  }

  /**
   * Reserve and return the next Issue ID for a mall, e.g. "DMC-2026-0001".
   * Safe to call from multiple tabs/people at the same instant.
   *
   * @param {string} mall            mall code or full name
   * @param {object} [opts]
   * @param {number} [opts.year]     override the year (defaults to now)
   * @returns {Promise<string>}      the reserved Issue ID
   */
  async function getNextIssueId(mall, opts) {
    const code = mallCode(mall);
    const year = (opts && opts.year) || new Date().getFullYear();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let row = await findCounterRow(code, year);

      if (!row) {
        try {
          row = await createCounterRow(code, year);
        } catch (e) {
          // Most likely another caller created the row a moment ago — retry
          // the whole loop so we pick up their row instead of duplicating it.
          if (attempt < MAX_ATTEMPTS) {
            await backoff(attempt);
            continue;
          }
          throw e;
        }
      }

      const current = Number(row.LastSequence) || 0;
      const next = current + 1;

      try {
        await bumpCounterRow(row, next);
        return formatIssueId(code, year, next);
      } catch (e) {
        if (e.status === 412 && attempt < MAX_ATTEMPTS) {
          // Someone incremented first. Re-read and try again.
          await backoff(attempt);
          continue;
        }
        throw e;
      }
    }

    throw new Error(
      "Could not reserve an Issue ID after " + MAX_ATTEMPTS + " attempts — the Counters list is under unusually heavy contention. Please try again."
    );
  }

  /**
   * Read the current sequence for a mall+year WITHOUT reserving anything.
   * Useful for dashboards / "next id will be…" hints. Returns 0 if no row yet.
   */
  async function peekLastSequence(mall, opts) {
    const code = mallCode(mall);
    const year = (opts && opts.year) || new Date().getFullYear();
    const row = await findCounterRow(code, year);
    return row ? Number(row.LastSequence) || 0 : 0;
  }

  window.App.CounterService = {
    getNextIssueId,
    peekLastSequence,
    mallCode,
    formatIssueId,
    MALL_CODES,
  };
})();
