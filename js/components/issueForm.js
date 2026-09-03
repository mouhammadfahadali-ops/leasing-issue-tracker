/* ==========================================================================
   issueForm.js — the New Issue modal AND the Edit Issue modal (same form,
   two modes). Renders into #modalRoot. All persistence goes through the DAL.
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.Components = window.App.Components || {};

  const U = () => window.App.Utils;
  const DAL = () => window.App.DAL;

  let escHandler = null;

  async function openNew(onDone) {
    const state = window.App.State.getState();
    const currentUser = await DAL().getCurrentUser();
    const defaults = {
      mall: state.mall !== "ALL" ? state.mall : "",
      issue: "", outletNo: "", tenant: "",
      dateRaised: U().todayIsoDate(),
      assignedTo: currentUser,
      status: "New", waitingReason: "",
      priority: "Medium", remarks: "",
    };
    await renderModal({ mode: "create", issue: defaults }, onDone);
  }

  async function openEdit(issueId, onDone) {
    const issue = await DAL().getIssueById(issueId);
    if (!issue) return;
    await renderModal({ mode: "edit", issue }, onDone);
  }

  async function renderModal(ctx, onDone) {
    const u = U();
    const users = await DAL().getUsers();
    const issue = ctx.issue;
    const isEdit = ctx.mode === "edit";
    const isResolved = isEdit && issue.status === "Resolved";
    const root = document.getElementById("modalRoot");

    root.innerHTML =
      '<div class="modal-backdrop" id="issueModalBackdrop">' +
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="issueModalTitle">' +
          '<div class="modal__header">' +
            '<span class="modal__title" id="issueModalTitle">' + (isEdit ? "Edit Issue" : "New Issue") + (isEdit ? " · " + u.escapeHtml(issue.issueId) : "") + "</span>" +
            '<button type="button" class="icon-btn" id="issueModalClose" aria-label="Close">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
            "</button>" +
          "</div>" +
          '<div class="modal__body">' +
            '<div class="form-grid" id="issueFormGrid">' +

              '<div class="form-section-label">Basic Information</div>' +
              '<div class="form-row">' +
                '<div class="form-field">' +
                  '<label class="required">Mall</label>' +
                  '<select class="form-control" id="fMall" ' + (isEdit ? "disabled" : "") + '>' +
                    '<option value="">Select mall…</option>' +
                    u.MALLS.map((m) => '<option value="' + m + '"' + (m === issue.mall ? " selected" : "") + ">" + m + "</option>").join("") +
                  "</select>" +
                  '<div class="form-error" id="errMall"></div>' +
                "</div>" +
                '<div class="form-field">' +
                  '<label class="required">Outlet No.</label>' +
                  '<input class="form-control" id="fOutletNo" value="' + u.escapeHtml(issue.outletNo) + '" placeholder="e.g. S-16" />' +
                  '<div class="form-error" id="errOutletNo"></div>' +
                "</div>" +
              "</div>" +

              '<div class="form-field">' +
                '<label class="required">Tenant</label>' +
                '<input class="form-control" id="fTenant" value="' + u.escapeHtml(issue.tenant) + '" placeholder="e.g. Khaadi" />' +
                '<div class="form-error" id="errTenant"></div>' +
              "</div>" +

              '<div class="form-field">' +
                '<label class="required">Issue</label>' +
                '<textarea class="form-control" id="fIssue" placeholder="Describe the issue…">' + u.escapeHtml(issue.issue) + "</textarea>" +
                '<div class="form-error" id="errIssue"></div>' +
              "</div>" +

              '<div class="form-section-label">Tracking</div>' +
              '<div class="form-row">' +
                '<div class="form-field">' +
                  '<label class="required">Date Raised</label>' +
                  '<input type="date" class="form-control" id="fDateRaised" value="' + issue.dateRaised + '" />' +
                  '<div class="form-error" id="errDateRaised"></div>' +
                "</div>" +
                '<div class="form-field">' +
                  '<label class="required">Assigned To</label>' +
                  '<select class="form-control" id="fAssignedTo">' +
                    users.map((usr) => '<option value="' + usr + '"' + (usr === issue.assignedTo ? " selected" : "") + ">" + usr + "</option>").join("") +
                  "</select>" +
                  '<div class="form-error" id="errAssignedTo"></div>' +
                "</div>" +
              "</div>" +

              '<div class="form-row">' +
                '<div class="form-field">' +
                  '<label class="required">Priority</label>' +
                  '<select class="form-control" id="fPriority">' +
                    u.PRIORITIES.map((p) => '<option value="' + p + '"' + (p === issue.priority ? " selected" : (p === "Medium" && !issue.priority ? " selected" : "")) + ">" + p + "</option>").join("") +
                  "</select>" +
                  '<div class="form-error" id="errPriority"></div>' +
                "</div>" +
                (isResolved
                  ? '<div class="form-field"><label>Status</label><div class="form-hint" style="margin-top:9px;">Managed via <strong>Re-open Issue</strong> — not editable here.</div></div>'
                  : '<div class="form-field">' +
                      '<label class="required">Status</label>' +
                      '<select class="form-control" id="fStatus">' +
                        ["New", "In Progress", "Waiting"].map((s) => '<option value="' + s + '"' + (s === issue.status ? " selected" : "") + ">" + s + "</option>").join("") +
                      "</select>" +
                      '<div class="form-error" id="errStatus"></div>' +
                    "</div>") +
              "</div>" +

              (isResolved
                ? ""
                : '<div id="fWaitingSection">' +
                    '<div class="form-section-label">Waiting</div>' +
                    '<div class="form-field" id="fWaitingReasonWrap"' + (issue.status === "Waiting" ? "" : ' style="display:none"') + '>' +
                      '<label class="required">Waiting Reason</label>' +
                      '<select class="form-control" id="fWaitingReason">' +
                        '<option value="">Select reason…</option>' +
                        u.WAITING_REASONS.map((r) => '<option value="' + r + '"' + (r === issue.waitingReason ? " selected" : "") + ">" + r + "</option>").join("") +
                      "</select>" +
                      '<div class="form-error" id="errWaitingReason"></div>' +
                    "</div>" +
                  "</div>") +

              '<div class="form-section-label">Remarks</div>' +
              '<div class="form-field">' +
                "<label>Initial Remark</label>" +
                '<textarea class="form-control" id="fRemarks" placeholder="Optional note on this issue…">' + u.escapeHtml(issue.remarks || "") + "</textarea>" +
                '<div class="form-hint">The current/latest note. Every change is still recorded permanently in Activity History.</div>' +
              "</div>" +

            "</div>" +
          "</div>" +
          '<div class="modal__footer">' +
            '<button type="button" class="btn btn--secondary" id="issueModalCancel">Cancel</button>' +
            '<button type="button" class="btn btn--primary" id="issueModalSave">' + (isEdit ? "Save Changes" : "Create Issue") + "</button>" +
          "</div>" +
        "</div>" +
      "</div>";

    wireEvents(ctx, onDone);
    const firstField = document.getElementById(isEdit ? "fOutletNo" : "fMall");
    if (firstField && !firstField.disabled) firstField.focus();
  }

  function cleanup() {
    document.getElementById("modalRoot").innerHTML = "";
    if (escHandler) {
      document.removeEventListener("keydown", escHandler);
      escHandler = null;
    }
  }

  function wireEvents(ctx, onDone) {
    const isResolved = ctx.mode === "edit" && ctx.issue.status === "Resolved";

    document.getElementById("issueModalBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "issueModalBackdrop") cleanup();
    });
    document.getElementById("issueModalClose").addEventListener("click", cleanup);
    document.getElementById("issueModalCancel").addEventListener("click", cleanup);

    escHandler = (e) => { if (e.key === "Escape") cleanup(); };
    document.addEventListener("keydown", escHandler);

    const fStatus = document.getElementById("fStatus");
    if (fStatus) {
      fStatus.addEventListener("change", (e) => {
        document.getElementById("fWaitingReasonWrap").style.display = e.target.value === "Waiting" ? "" : "none";
      });
    }

    document.getElementById("issueModalSave").addEventListener("click", async () => {
      await submit(ctx, onDone);
    });
  }

  function clearErrors() {
    document.querySelectorAll("#issueFormGrid .form-error").forEach((n) => (n.textContent = ""));
  }

  function showErrors(errors) {
    Object.keys(errors).forEach((key) => {
      const node = document.getElementById("err" + key.charAt(0).toUpperCase() + key.slice(1));
      if (node) node.textContent = errors[key];
    });
  }

  async function submit(ctx, onDone) {
    clearErrors();
    const isResolved = ctx.mode === "edit" && ctx.issue.status === "Resolved";
    const actor = await DAL().getCurrentUser();
    const saveBtn = document.getElementById("issueModalSave");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

    const data = {
      mall: ctx.mode === "edit" ? ctx.issue.mall : document.getElementById("fMall").value,
      outletNo: document.getElementById("fOutletNo").value,
      tenant: document.getElementById("fTenant").value,
      issue: document.getElementById("fIssue").value,
      dateRaised: document.getElementById("fDateRaised").value,
      assignedTo: document.getElementById("fAssignedTo").value,
      priority: document.getElementById("fPriority").value,
      remarks: document.getElementById("fRemarks").value,
    };

    if (!isResolved) {
      data.status = document.getElementById("fStatus").value;
      data.waitingReason = data.status === "Waiting" ? document.getElementById("fWaitingReason").value : null;
    }

    let result;
    try {
      if (ctx.mode === "create") {
        result = await DAL().createIssue(data, actor);
      } else {
        result = await DAL().updateIssue(ctx.issue.issueId, data, actor);
      }
    } catch (e) {
      console.error("Failed to save issue:", e);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = ctx.mode === "edit" ? "Save Changes" : "Create Issue"; }
      window.App.Components.Toast.show("Unable to save the issue. Please try again.");
      return;
    }

    if (!result.ok) {
      showErrors(result.errors);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = ctx.mode === "edit" ? "Save Changes" : "Create Issue"; }
      return;
    }

    cleanup();
    window.App.Components.Toast.show(
      ctx.mode === "create" ? "Issue " + result.issue.issueId + " created." : "Issue " + ctx.issue.issueId + " updated."
    );
    await window.App.render();
    if (onDone) onDone(result.issue);
  }

  window.App.Components.IssueForm = { openNew, openEdit };
})();
