/* ==========================================================================
   issueDetail.js — Issue Detail slide-over panel.
   Shows full issue details, quick inline actions (status / priority /
   assignment), the Remarks note, Activity History, and the Edit / Resolve /
   Re-open actions. Everything here goes through window.App.DAL — never
   touches storage directly.
   Renders into #slideoverRoot.
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.Components = window.App.Components || {};

  const U = () => window.App.Utils;
  const DAL = () => window.App.DAL;

  let currentIssueId = null;

  function close() {
    currentIssueId = null;
    document.getElementById("slideoverRoot").innerHTML = "";
    document.removeEventListener("keydown", onEscape);
  }

  function onEscape(e) {
    if (e.key === "Escape") close();
  }

  async function open(issueId) {
    currentIssueId = issueId;
    document.addEventListener("keydown", onEscape);
    await renderPanel();
  }

  async function renderPanel() {
    const root = document.getElementById("slideoverRoot");
    const issue = await DAL().getIssueById(currentIssueId);
    if (!issue) { root.innerHTML = ""; return; }
    const [history, users] = await Promise.all([
      DAL().getActivityHistory(issue.issueId),
      DAL().getUsers(),
    ]);
    const u = U();

    const agingClass =
      issue.status !== "Resolved" && issue.daysOpen >= DAL().CRITICAL_THRESHOLD_DAYS
        ? "days-open--critical"
        : issue.status !== "Resolved" && issue.daysOpen >= DAL().AGING_THRESHOLD_DAYS
        ? "days-open--aging"
        : "";

    // A previously-resolved-then-reopened issue keeps its original
    // resolution info on the record (see issuesApi.reopenIssue) — surface
    // it here even though the issue is active again, so nothing is hidden.
    const showPriorResolution = issue.status !== "Resolved" && issue.isReopened && issue.resolvedAt;

    root.innerHTML =
      '<div class="slideover-backdrop" id="slideoverBackdrop"></div>' +
      '<aside class="slideover" role="dialog" aria-modal="true" aria-label="Issue detail — ' + u.escapeHtml(issue.issueId) + '">' +
        '<div class="slideover__header">' +
          '<div class="slideover__top-row">' +
            "<div>" +
              '<div class="slideover__id">' + u.escapeHtml(issue.issueId) + " · " + u.escapeHtml(issue.mall) + "</div>" +
              '<div class="slideover__tenant">' + u.escapeHtml(issue.tenant) + "</div>" +
              '<div class="slideover__outlet">Outlet ' + u.escapeHtml(issue.outletNo) + "</div>" +
            "</div>" +
            '<button type="button" class="icon-btn" id="slideoverClose" aria-label="Close issue detail">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
            "</button>" +
          "</div>" +
          '<div class="slideover__pill-row">' +
            '<span class="pill ' + u.statusToClass(issue.status) + '">' + u.escapeHtml(u.statusLabel(issue)) + "</span>" +
            '<span class="pill ' + u.priorityToClass(issue.priority) + '">' + u.escapeHtml(issue.priority) + "</span>" +
            (issue.isReopened ? '<span class="reopened-tag">Re-opened</span>' : "") +
            '<span class="text-tiny">·&nbsp;<span class="days-open ' + agingClass + '">' + issue.daysOpen + " day" + (issue.daysOpen === 1 ? "" : "s") + " open</span></span>" +
          "</div>" +
        "</div>" +

        '<div class="slideover__body">' +

          '<div>' +
            '<div class="detail-section-title mt-1">Issue</div>' +
            '<div class="remarks-box mt-2">' + u.escapeHtml(issue.issue) + "</div>" +
          "</div>" +

          '<div>' +
            '<div class="detail-section-title">Details</div>' +
            '<div class="detail-grid mt-2">' +
              detailField("Mall", issue.mall) +
              detailField("Outlet No.", issue.outletNo) +
              detailField("Assigned To", issue.assignedTo) +
              detailField("Date Raised", u.formatDate(issue.dateRaised)) +
              detailField("Created By", issue.createdBy) +
              (issue.status === "Resolved"
                ? detailField("Resolved", u.formatDateTime(issue.resolvedAt) + " · " + issue.resolvedBy)
                : "") +
            "</div>" +
          "</div>" +

          (showPriorResolution
            ? '<div class="prior-resolution-box">' +
                '<div class="prior-resolution-box__title">↺ Previous Resolution</div>' +
                '<div class="prior-resolution-box__body">' +
                  'This issue was resolved on ' + u.escapeHtml(u.formatDateTime(issue.resolvedAt)) + ' by ' + u.escapeHtml(issue.resolvedBy) +
                  ', then re-opened. It is <strong>currently active</strong> (see status above) — this note is historical only.' +
                "</div>" +
              "</div>"
            : "") +

          '<div>' +
            '<div class="detail-section-title">Quick actions</div>' +
            '<div class="form-grid mt-2">' +
              '<div class="form-row">' +
                '<div class="form-field">' +
                  "<label>Assigned To</label>" +
                  '<select class="form-control" id="qaAssignedTo">' +
                    users.map((usr) => '<option value="' + usr + '"' + (usr === issue.assignedTo ? " selected" : "") + ">" + usr + "</option>").join("") +
                  "</select>" +
                "</div>" +
                '<div class="form-field">' +
                  "<label>Priority</label>" +
                  '<select class="form-control" id="qaPriority">' +
                    u.PRIORITIES.map((p) => '<option value="' + p + '"' + (p === issue.priority ? " selected" : "") + ">" + p + "</option>").join("") +
                  "</select>" +
                "</div>" +
              "</div>" +
              (issue.status !== "Resolved"
                ? '<div class="form-row">' +
                    '<div class="form-field">' +
                      "<label>Status</label>" +
                      '<select class="form-control" id="qaStatus">' +
                        ["New", "In Progress", "Waiting"].map((s) => '<option value="' + s + '"' + (s === issue.status ? " selected" : "") + ">" + s + "</option>").join("") +
                      "</select>" +
                    "</div>" +
                    '<div class="form-field" id="qaWaitingReasonWrap"' + (issue.status === "Waiting" ? "" : ' style="display:none"') + '>' +
                      "<label>Waiting Reason</label>" +
                      '<select class="form-control" id="qaWaitingReason">' +
                        '<option value="">Select reason…</option>' +
                        u.WAITING_REASONS.map((r) => '<option value="' + r + '"' + (r === issue.waitingReason ? " selected" : "") + ">" + r + "</option>").join("") +
                      "</select>" +
                    "</div>" +
                  "</div>"
                : "") +
              '<div class="form-error" id="qaError" aria-live="polite"></div>' +
            "</div>" +
          "</div>" +

          '<div>' +
            '<div class="detail-section-title">Remarks</div>' +
            '<div class="remarks-box mt-2">' + (issue.remarks ? u.escapeHtml(issue.remarks) : '<span class="text-muted">No remarks yet.</span>') + "</div>" +
          "</div>" +

          '<div>' +
            '<div class="detail-section-title">Activity History</div>' +
            '<div class="mt-2">' + window.App.Components.ActivityHistory.renderTimeline(history) + "</div>" +
          "</div>" +

        "</div>" +

        '<div class="slideover__footer">' +
          '<button type="button" class="btn btn--secondary" id="editIssueBtn">Edit Issue</button>' +
          (issue.status === "Resolved"
            ? '<button type="button" class="btn btn--primary" id="reopenIssueBtn">Re-open Issue</button>'
            : '<button type="button" class="btn btn--primary" id="resolveIssueBtn">Mark Resolved</button>') +
        "</div>" +
      "</aside>";

    wireEvents(issue);
  }

  function detailField(label, value) {
    return (
      '<div class="detail-field">' +
      '<div class="detail-field__label">' + window.App.Utils.escapeHtml(label) + "</div>" +
      '<div class="detail-field__value">' + window.App.Utils.escapeHtml(value || "—") + "</div>" +
      "</div>"
    );
  }

  function wireEvents(issue) {
    document.getElementById("slideoverBackdrop").addEventListener("click", close);
    document.getElementById("slideoverClose").addEventListener("click", close);

    document.getElementById("qaAssignedTo").addEventListener("change", async (e) => {
      await applyUpdate({ assignedTo: e.target.value }, "Assigned To updated.");
    });
    document.getElementById("qaPriority").addEventListener("change", async (e) => {
      await applyUpdate({ priority: e.target.value }, "Priority updated.");
    });

    const qaStatus = document.getElementById("qaStatus");
    if (qaStatus) {
      qaStatus.addEventListener("change", async (e) => {
        const wrap = document.getElementById("qaWaitingReasonWrap");
        if (e.target.value === "Waiting") {
          wrap.style.display = "";
          document.getElementById("qaError").textContent = "Select a waiting reason to apply.";
        } else {
          wrap.style.display = "none";
          await applyUpdate({ status: e.target.value, waitingReason: null }, "Status updated.");
        }
      });
    }
    const qaWaitingReason = document.getElementById("qaWaitingReason");
    if (qaWaitingReason) {
      qaWaitingReason.addEventListener("change", async (e) => {
        if (!e.target.value) return;
        await applyUpdate({ status: "Waiting", waitingReason: e.target.value }, "Status updated.");
      });
    }

    document.getElementById("editIssueBtn").addEventListener("click", () => {
      window.App.Components.IssueForm.openEdit(issue.issueId, async () => {
        await renderPanel();
        await window.App.render();
      });
    });

    const resolveBtn = document.getElementById("resolveIssueBtn");
    if (resolveBtn) {
      resolveBtn.addEventListener("click", () => openResolveModal(issue));
    }
    const reopenBtn = document.getElementById("reopenIssueBtn");
    if (reopenBtn) {
      reopenBtn.addEventListener("click", () => openReopenModal(issue));
    }
  }

  async function applyUpdate(changes, successMessage) {
    const actor = await DAL().getCurrentUser();
    let result;
    try {
      result = await DAL().updateIssue(currentIssueId, changes, actor);
    } catch (e) {
      console.error("Failed to update issue:", e);
      window.App.Components.Toast.show("Unable to save that change. Please try again.");
      return;
    }
    if (!result.ok) {
      const err = document.getElementById("qaError");
      if (err) err.textContent = Object.values(result.errors).join(" ");
      return;
    }
    window.App.Components.Toast.show(successMessage);
    await renderPanel();
    await window.App.render();
  }

  // ---- Shared mini-modal chrome for Resolve / Re-open ----
  let miniEscHandler = null;

  function miniCleanup() {
    document.getElementById("modalRoot").innerHTML = "";
    if (miniEscHandler) {
      document.removeEventListener("keydown", miniEscHandler);
      miniEscHandler = null;
    }
  }

  function wireMiniModal(onConfirm) {
    document.getElementById("miniModalBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "miniModalBackdrop") miniCleanup();
    });
    document.getElementById("miniModalClose").addEventListener("click", miniCleanup);
    document.getElementById("miniModalCancel").addEventListener("click", miniCleanup);
    miniEscHandler = (e) => { if (e.key === "Escape") miniCleanup(); };
    document.addEventListener("keydown", miniEscHandler);
    document.getElementById("miniModalConfirm").addEventListener("click", onConfirm);
  }

  // ---- Resolve modal ----
  function openResolveModal(issue) {
    const root = document.getElementById("modalRoot");
    const u = U();
    root.innerHTML =
      '<div class="modal-backdrop" id="miniModalBackdrop">' +
        '<div class="modal" style="max-width:460px;" role="dialog" aria-modal="true" aria-labelledby="miniModalTitle">' +
          '<div class="modal__header"><span class="modal__title" id="miniModalTitle">Mark as Resolved</span>' +
            '<button type="button" class="icon-btn" id="miniModalClose" aria-label="Close">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
            "</button>" +
          "</div>" +
          '<div class="modal__body">' +
            '<p class="text-muted" style="margin-bottom:12px;">' + u.escapeHtml(issue.issueId) + " — " + u.escapeHtml(issue.tenant) + "</p>" +
            '<div class="form-field">' +
              "<label>Resolution note (updates Remarks)</label>" +
              '<textarea class="form-control" id="resolutionNote" placeholder="e.g. Repair completed and verified on site.">' + u.escapeHtml(issue.remarks || "") + "</textarea>" +
            "</div>" +
          "</div>" +
          '<div class="modal__footer">' +
            '<button type="button" class="btn btn--secondary" id="miniModalCancel">Cancel</button>' +
            '<button type="button" class="btn btn--primary" id="miniModalConfirm">Mark Resolved</button>' +
          "</div>" +
        "</div>" +
      "</div>";

    wireMiniModal(async () => {
      const note = document.getElementById("resolutionNote").value;
      const confirmBtn = document.getElementById("miniModalConfirm");
      confirmBtn.disabled = true; confirmBtn.textContent = "Saving…";
      const actor = await DAL().getCurrentUser();
      let result;
      try {
        result = await DAL().resolveIssue(issue.issueId, actor, note);
      } catch (e) {
        console.error("Failed to resolve issue:", e);
        miniCleanup();
        window.App.Components.Toast.show("Unable to mark this issue resolved. Please try again.");
        return;
      }
      miniCleanup();
      if (result.ok) {
        window.App.Components.Toast.show("Issue marked as resolved and moved to Archive.");
        await renderPanel();
        await window.App.render();
      } else {
        window.App.Components.Toast.show("Unable to mark this issue resolved. Please try again.");
      }
    });
    document.getElementById("resolutionNote").focus();
  }

  // ---- Re-open modal ----
  function openReopenModal(issue) {
    const root = document.getElementById("modalRoot");
    const u = U();
    root.innerHTML =
      '<div class="modal-backdrop" id="miniModalBackdrop">' +
        '<div class="modal" style="max-width:460px;" role="dialog" aria-modal="true" aria-labelledby="miniModalTitle">' +
          '<div class="modal__header"><span class="modal__title" id="miniModalTitle">Re-open Issue</span>' +
            '<button type="button" class="icon-btn" id="miniModalClose" aria-label="Close">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
            "</button>" +
          "</div>" +
          '<div class="modal__body">' +
            '<p class="text-muted" style="margin-bottom:12px;">' + u.escapeHtml(issue.issueId) + " — " + u.escapeHtml(issue.tenant) +
              '. This will move the issue back into Active Issues with status <strong>In Progress</strong>. The original resolution date and resolver stay on record and remain visible in Activity History.</p>' +
            '<div class="form-field">' +
              "<label>Reason for re-opening</label>" +
              '<textarea class="form-control" id="reopenReason" placeholder="e.g. Tenant reported the same issue recurring."></textarea>' +
            "</div>" +
          "</div>" +
          '<div class="modal__footer">' +
            '<button type="button" class="btn btn--secondary" id="miniModalCancel">Cancel</button>' +
            '<button type="button" class="btn btn--primary" id="miniModalConfirm">Re-open Issue</button>' +
          "</div>" +
        "</div>" +
      "</div>";

    wireMiniModal(async () => {
      const reason = document.getElementById("reopenReason").value;
      const confirmBtn = document.getElementById("miniModalConfirm");
      confirmBtn.disabled = true; confirmBtn.textContent = "Saving…";
      const actor = await DAL().getCurrentUser();
      let result;
      try {
        result = await DAL().reopenIssue(issue.issueId, actor, reason);
      } catch (e) {
        console.error("Failed to reopen issue:", e);
        miniCleanup();
        window.App.Components.Toast.show("Unable to re-open this issue. Please try again.");
        return;
      }
      miniCleanup();
      if (result.ok) {
        window.App.Components.Toast.show("Issue re-opened and returned to Active Issues.");
        await renderPanel();
        await window.App.render();
      } else {
        window.App.Components.Toast.show("Unable to re-open this issue. Please try again.");
      }
    });
    document.getElementById("reopenReason").focus();
  }

  window.App.Components.IssueDetail = { open, close };
})();
