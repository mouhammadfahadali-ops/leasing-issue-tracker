/* ==========================================================================
   mockData.js — realistic seed data for the prototype
   Exposed on window.App.MockData
   ========================================================================== */

(function () {
  window.App = window.App || {};

  function iso(dateStr, time) {
    return dateStr + "T" + (time || "09:00:00") + "Z";
  }

  function buildIssues() {
    return [
      {
        issueId: "DMC-2026-0001", mall: "DMC",
        issue: "Civil and structural works started inside unit F-52 & 53 mid fit-out, ahead of design approval sign-off.",
        outletNo: "F-52 & 53", tenant: "Yousaf Textiles (VANYA)",
        dateRaised: "2026-08-05", assignedTo: "Fahad",
        status: "Waiting", waitingReason: "Management", priority: "Urgent",
        remarks: "Escalated to EVP for handover-condition ruling; tenant contractor paused pending decision.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Fahad", createdAt: iso("2026-08-05"), updatedAt: iso("2026-08-28", "11:20:00"),
      },
      {
        issueId: "DMC-2026-0002", mall: "DMC",
        issue: "Rent Schedule area mismatch for outlet G-10 — carpet area on lease differs from BOQ measurement.",
        outletNo: "G-10", tenant: "Khaadi",
        dateRaised: "2026-08-12", assignedTo: "Ali",
        status: "In Progress", waitingReason: null, priority: "Medium",
        remarks: "Re-measurement scheduled with site team; awaiting updated BOQ from projects.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Ali", createdAt: iso("2026-08-12"), updatedAt: iso("2026-08-25", "15:10:00"),
      },
      {
        issueId: "DMC-2026-0003", mall: "DMC",
        issue: "Security deposit refund pending finance clearance following outlet closure and handover of F-22.",
        outletNo: "F-22", tenant: "Cheezious",
        dateRaised: "2026-07-20", assignedTo: "Sara",
        status: "Waiting", waitingReason: "Finance", priority: "Medium",
        remarks: "Finance to confirm no outstanding dues before refund is processed.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Sara", createdAt: iso("2026-07-20"), updatedAt: iso("2026-08-20", "10:00:00"),
      },
      {
        issueId: "DMC-2026-0004", mall: "DMC",
        issue: "Signage approval requested for new storefront branding ahead of rebrand launch.",
        outletNo: "B-05", tenant: "Chase Value",
        dateRaised: "2026-08-27", assignedTo: "Ahmed",
        status: "New", waitingReason: null, priority: "Low",
        remarks: "Design file received, pending review against mall signage guidelines.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Ahmed", createdAt: iso("2026-08-27"), updatedAt: iso("2026-08-27"),
      },
      {
        issueId: "DMC-2026-0005", mall: "DMC",
        issue: "Lease renewal negotiation — tenant requesting a rate freeze citing footfall decline.",
        outletNo: "S-02", tenant: "Sapphire",
        dateRaised: "2026-08-18", assignedTo: "Fahad",
        status: "In Progress", waitingReason: null, priority: "Urgent",
        remarks: "Counter-proposal with stepped escalation shared; response expected this week.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Fahad", createdAt: iso("2026-08-18"), updatedAt: iso("2026-08-29", "12:00:00"),
      },
      {
        issueId: "DMC-2026-0006", mall: "DMC",
        issue: "AC unit leaking into corridor outside shop, causing slip hazard for customers.",
        outletNo: "G-14", tenant: "Al-Fatah",
        dateRaised: "2026-08-01", assignedTo: "Ali",
        status: "Resolved", waitingReason: null, priority: "High",
        remarks: "Tenant's contractor repaired the drain line; facilities confirmed no further leakage.",
        isReopened: false, resolvedAt: iso("2026-08-09", "16:30:00"), resolvedBy: "Ali",
        createdBy: "Ali", createdAt: iso("2026-08-01"), updatedAt: iso("2026-08-09", "16:30:00"),
      },
      {
        issueId: "DMC-2026-0007", mall: "DMC",
        issue: "Tenant documentation incomplete — trade license on file has expired, renewal not yet submitted.",
        outletNo: "F-08", tenant: "Nishat Linen",
        dateRaised: "2026-08-22", assignedTo: "Sara",
        status: "Waiting", waitingReason: "Tenant", priority: "Medium",
        remarks: "Reminder sent to tenant's admin office; renewal copy requested within 7 days.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Sara", createdAt: iso("2026-08-22"), updatedAt: iso("2026-08-26", "09:40:00"),
      },
      {
        issueId: "DMTR-2026-0001", mall: "DMTR",
        issue: "Lease expiry notice served — tenant invoking 60-day exit clause, discussing possible retention terms.",
        outletNo: "T-12", tenant: "Bata",
        dateRaised: "2026-08-10", assignedTo: "Ahmed",
        status: "In Progress", waitingReason: null, priority: "High",
        remarks: "Retention offer with revised category placement being drafted for management review.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Ahmed", createdAt: iso("2026-08-10"), updatedAt: iso("2026-08-27", "14:15:00"),
      },
      {
        issueId: "DMTR-2026-0002", mall: "DMTR",
        issue: "Possession handover delayed — base-building civil works not completed by landlord as per schedule.",
        outletNo: "T-05", tenant: "Servis",
        dateRaised: "2026-07-28", assignedTo: "Fahad",
        status: "Waiting", waitingReason: "Management", priority: "Urgent",
        remarks: "Revised handover date pending confirmation from projects team; tenant fit-out timeline at risk.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Fahad", createdAt: iso("2026-07-28"), updatedAt: iso("2026-08-24", "11:00:00"),
      },
      {
        issueId: "DMTR-2026-0003", mall: "DMTR",
        issue: "Rent payment overdue for two consecutive months — follow-up required with finance and tenant.",
        outletNo: "T-18", tenant: "Breakout",
        dateRaised: "2026-08-14", assignedTo: "Sara",
        status: "Waiting", waitingReason: "Finance", priority: "High",
        remarks: "Finance reconciling part-payment received against outstanding ledger.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Sara", createdAt: iso("2026-08-14"), updatedAt: iso("2026-08-25", "13:30:00"),
      },
      {
        issueId: "DMTR-2026-0004", mall: "DMTR",
        issue: "New outlet fit-out approval requested — drawings submitted for review.",
        outletNo: "T-22", tenant: "Subway",
        dateRaised: "2026-08-29", assignedTo: "Ali",
        status: "New", waitingReason: null, priority: "Low",
        remarks: "Awaiting initial screening against mall design guidelines.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Ali", createdAt: iso("2026-08-29"), updatedAt: iso("2026-08-29"),
      },
      {
        issueId: "DMTR-2026-0005", mall: "DMTR",
        issue: "Boundary dispute between two adjoining units following shop merger during renovation.",
        outletNo: "T-09 & T-10", tenant: "Chen One",
        dateRaised: "2026-07-15", assignedTo: "Fahad",
        status: "Resolved", waitingReason: null, priority: "Medium",
        remarks: "Revised layout and demising wall position signed off by both tenant and projects.",
        isReopened: false, resolvedAt: iso("2026-07-30", "17:00:00"), resolvedBy: "Fahad",
        createdBy: "Fahad", createdAt: iso("2026-07-15"), updatedAt: iso("2026-07-30", "17:00:00"),
      },
      {
        issueId: "DMH-2026-0001", mall: "DMH",
        issue: "Landlord approval pending for kitchen exhaust modification required by tenant's franchise standard.",
        outletNo: "H-04", tenant: "KFC",
        dateRaised: "2026-08-16", assignedTo: "Ahmed",
        status: "Waiting", waitingReason: "Management", priority: "Medium",
        remarks: "Structural clearance requested from consultant before approval is issued.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Ahmed", createdAt: iso("2026-08-16"), updatedAt: iso("2026-08-26", "10:20:00"),
      },
      {
        issueId: "DMH-2026-0002", mall: "DMH",
        issue: "Tenant requesting rent abatement citing sustained low footfall on upper floor.",
        outletNo: "H-11", tenant: "Gul Ahmed",
        dateRaised: "2026-08-09", assignedTo: "Sara",
        status: "In Progress", waitingReason: null, priority: "High",
        remarks: "Footfall and sales data being compiled to evaluate the request before management review.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Sara", createdAt: iso("2026-08-09"), updatedAt: iso("2026-08-28", "09:00:00"),
      },
      {
        issueId: "DMH-2026-0003", mall: "DMH",
        issue: "Signage approval for new illuminated storefront sign.",
        outletNo: "H-02", tenant: "Dawaai Pharmacy",
        dateRaised: "2026-08-03", assignedTo: "Ali",
        status: "Resolved", waitingReason: null, priority: "Low",
        remarks: "Sign approved as submitted; installation completed and verified on site.",
        isReopened: false, resolvedAt: iso("2026-08-11", "15:45:00"), resolvedBy: "Ali",
        createdBy: "Ali", createdAt: iso("2026-08-03"), updatedAt: iso("2026-08-11", "15:45:00"),
      },
      {
        issueId: "DMH-2026-0004", mall: "DMH",
        issue: "New lease documentation collection pending — CNIC copies and company registration outstanding.",
        outletNo: "H-19", tenant: "Mr. Books",
        dateRaised: "2026-08-24", assignedTo: "Fahad",
        status: "Waiting", waitingReason: "Tenant", priority: "Medium",
        remarks: "Tenant informed documents are required before lease execution can proceed.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Fahad", createdAt: iso("2026-08-24"), updatedAt: iso("2026-08-27", "12:10:00"),
      },
      {
        issueId: "DML-2026-0001", mall: "DML",
        issue: "Fit-out handover condition dispute — flooring found damaged prior to tenant possession.",
        outletNo: "L-03", tenant: "Outfitters",
        dateRaised: "2026-08-06", assignedTo: "Ahmed",
        status: "In Progress", waitingReason: null, priority: "Urgent",
        remarks: "Joint site inspection conducted; repair scope being finalised with facilities before re-handover.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Ahmed", createdAt: iso("2026-08-06"), updatedAt: iso("2026-08-28", "16:00:00"),
      },
      {
        issueId: "DML-2026-0002", mall: "DML",
        issue: "Lease renewal — tenant contesting proposed annual rate escalation clause.",
        outletNo: "L-21", tenant: "Denim by Bonanza",
        dateRaised: "2026-08-30", assignedTo: "Sara",
        status: "New", waitingReason: null, priority: "Medium",
        remarks: "Initial renewal terms shared; tenant response awaited.",
        isReopened: false, resolvedAt: null, resolvedBy: null,
        createdBy: "Sara", createdAt: iso("2026-08-30"), updatedAt: iso("2026-08-30"),
      },
      {
        issueId: "DML-2026-0003", mall: "DML",
        issue: "Security deposit dispute reopened after a new damage claim was raised on the unit post-handover.",
        outletNo: "L-07", tenant: "Xpression",
        dateRaised: "2026-07-10", assignedTo: "Fahad",
        status: "In Progress", waitingReason: null, priority: "High",
        remarks: "Second inspection scheduled to verify the newly reported damage before deposit is settled.",
        isReopened: true, resolvedAt: iso("2026-07-25", "14:00:00"), resolvedBy: "Fahad",
        createdBy: "Fahad", createdAt: iso("2026-07-10"), updatedAt: iso("2026-08-27", "10:30:00"),
      },
    ];
  }

  function buildActivityLog(issues) {
    const log = [];
    let seq = 0;
    function push(issueId, timestamp, actor, action, field, from, to, comment) {
      seq += 1;
      log.push({
        entryId: "act-" + seq,
        issueId,
        timestamp,
        actor,
        action,
        field: field || null,
        from: from || null,
        to: to || null,
        comment: comment || null,
      });
    }

    // Generic creation entry for every issue
    issues.forEach((iss) => {
      push(iss.issueId, iss.createdAt, iss.createdBy, "created", null, null, null,
        "Issue logged for " + iss.tenant + " (" + iss.outletNo + ").");
    });

    // Hand-authored richer histories for a few representative issues
    push("DMC-2026-0001", iso("2026-08-06"), "Fahad", "status_changed", "status", "New", "In Progress", null);
    push("DMC-2026-0001", iso("2026-08-14"), "Fahad", "priority_changed", "priority", "High", "Urgent", "Escalated after contractor found working without sign-off.");
    push("DMC-2026-0001", iso("2026-08-20"), "Fahad", "status_changed", "status", "In Progress", "Waiting", null);
    push("DMC-2026-0001", iso("2026-08-20"), "Fahad", "waiting_reason_changed", "waitingReason", null, "Management", null);
    push("DMC-2026-0001", iso("2026-08-28", "11:20:00"), "Fahad", "remark_added", "remarks", null, null, "Escalated to EVP for handover-condition ruling; tenant contractor paused pending decision.");

    push("DMC-2026-0006", iso("2026-08-02"), "Ali", "status_changed", "status", "New", "In Progress", null);
    push("DMC-2026-0006", iso("2026-08-09", "16:30:00"), "Ali", "resolved", "status", "In Progress", "Resolved", "Drain line repaired and verified by facilities.");

    push("DMTR-2026-0005", iso("2026-07-18"), "Fahad", "status_changed", "status", "New", "In Progress", null);
    push("DMTR-2026-0005", iso("2026-07-30", "17:00:00"), "Fahad", "resolved", "status", "In Progress", "Resolved", "Demising wall position agreed and signed off.");

    push("DMH-2026-0003", iso("2026-08-05"), "Ali", "status_changed", "status", "New", "In Progress", null);
    push("DMH-2026-0003", iso("2026-08-11", "15:45:00"), "Ali", "resolved", "status", "In Progress", "Resolved", "Sign installation verified on site.");

    // Reopened example — full lifecycle
    push("DML-2026-0003", iso("2026-07-12"), "Fahad", "status_changed", "status", "New", "In Progress", null);
    push("DML-2026-0003", iso("2026-07-25", "14:00:00"), "Fahad", "resolved", "status", "In Progress", "Resolved", "Original damage assessed as normal wear; deposit released.");
    push("DML-2026-0003", iso("2026-08-20", "09:15:00"), "Fahad", "reopened", "status", "Resolved", "In Progress", "New damage claim submitted by facilities after re-inspection; reopening for review.");
    push("DML-2026-0003", iso("2026-08-27", "10:30:00"), "Fahad", "remark_added", "remarks", null, null, "Second inspection scheduled to verify the newly reported damage before deposit is settled.");

    // Sort chronologically
    log.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return log;
  }

  function buildCounters(issues) {
    const counters = {};
    issues.forEach((iss) => {
      const parts = iss.issueId.split("-"); // MALL-YEAR-SEQ
      const key = parts[0] + "_" + parts[1];
      const seq = parseInt(parts[2], 10);
      if (!counters[key] || seq > counters[key]) counters[key] = seq;
    });
    return counters;
  }

  function generate() {
    const issues = buildIssues();
    const activityLog = buildActivityLog(issues);
    const counters = buildCounters(issues);
    return { issues, activityLog, counters };
  }

  window.App.MockData = {
    CURRENT_USERS: ["Leasing", "CEO", "Finance", "FitOut"],
    generate,
  };
})();
