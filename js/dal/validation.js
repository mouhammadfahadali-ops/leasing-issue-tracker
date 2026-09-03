/* ==========================================================================
   validation.js — field requirements & workflow rules
   Exposed on window.App.DAL.Validation
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.DAL = window.App.DAL || {};

  const U = () => window.App.Utils;

  // Suggested forward flow, shown as hints in the UI. Re-opening is the only
  // sanctioned "backward" move and is handled as its own explicit action
  // rather than a status dropdown option.
  const WORKFLOW_ORDER = ["New", "In Progress", "Waiting", "Resolved"];

  function validateNewIssue(data) {
    const errors = {};
    if (!data.mall || U().MALLS.indexOf(data.mall) === -1) errors.mall = "Select a mall.";
    if (!data.issue || !data.issue.trim()) errors.issue = "Describe the issue.";
    if (!data.outletNo || !data.outletNo.trim()) errors.outletNo = "Outlet number is required.";
    if (!data.tenant || !data.tenant.trim()) errors.tenant = "Tenant name is required.";
    if (!data.dateRaised) errors.dateRaised = "Date is required.";
    if (!data.assignedTo) errors.assignedTo = "Assign the issue to someone.";
    if (!data.status || U().STATUSES.indexOf(data.status) === -1) errors.status = "Select a status.";
    if (data.status === "Waiting" && !data.waitingReason) {
      errors.waitingReason = "Select a waiting reason.";
    }
    if (!data.priority || U().PRIORITIES.indexOf(data.priority) === -1) errors.priority = "Select a priority.";
    return errors;
  }

  function validateStatusChange(status, waitingReason) {
    const errors = {};
    if (status === "Waiting" && !waitingReason) {
      errors.waitingReason = "A waiting reason is required.";
    }
    return errors;
  }

  function hasErrors(errorsObj) {
    return Object.keys(errorsObj).length > 0;
  }

  window.App.DAL.Validation = {
    WORKFLOW_ORDER,
    validateNewIssue,
    validateStatusChange,
    hasErrors,
  };
})();
