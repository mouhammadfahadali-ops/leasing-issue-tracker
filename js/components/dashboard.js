/* ==========================================================================
   dashboard.js — Dashboard screen: KPI cards, waiting breakdown, mall
   comparison, status pipeline, and a recent activity feed.
   Renders into #viewRoot when App.State.view === 'dashboard'.
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.Components = window.App.Components || {};

  const U = () => window.App.Utils;
  const DAL = () => window.App.DAL;

  async function render(container) {
    const mall = window.App.State.getState().mall;
    const [stats, recent] = await Promise.all([
      DAL().getDashboardStats(mall),
      DAL().getRecentActivity(mall, 8),
    ]);

    container.innerHTML =
      '<div class="view-header">' +
        "<div>" +
          '<div class="view-header__title">Dashboard</div>' +
          '<div class="view-header__subtitle">' + (mall === "ALL" ? "All malls combined" : mall) + "</div>" +
        "</div>" +
      "</div>" +

      kpiGrid(stats) +

      '<div class="dashboard-grid">' +
        '<div style="display:flex; flex-direction:column; gap: var(--sp-5);">' +
          pipelinePanel(stats) +
          (mall === "ALL" ? mallBreakdownPanel(stats) : waitingPanel(stats)) +
        "</div>" +
        '<div style="display:flex; flex-direction:column; gap: var(--sp-5);">' +
          (mall === "ALL" ? waitingPanel(stats) : "") +
          recentActivityPanel(recent) +
        "</div>" +
      "</div>";
  }

  function kpiGrid(stats) {
    const aging = DAL().AGING_THRESHOLD_DAYS;
    const critical = DAL().CRITICAL_THRESHOLD_DAYS;
    return (
      '<div class="kpi-grid">' +
      kpiCard("Total Active Issues", stats.totalActive, "Across New / In Progress / Waiting", "") +
      kpiCard("Urgent / High Priority", stats.urgentHighOpen, "Active issues needing attention", stats.urgentHighOpen > 0 ? "danger" : "") +
      kpiCard("Aging (" + aging + "+ days)", stats.agingCount, "Open " + aging + "–" + (critical - 1) + " days", "warn") +
      kpiCard("Critical (" + critical + "+ days)", stats.criticalCount, "Open " + critical + "+ days — needs attention", "danger") +
      kpiCard("Resolved This Month", stats.resolvedThisMonth, "Closed in the current month", "accent") +
      kpiCard("Re-opened Issues", stats.reopenedCount, "Recurring — worth a closer look", "") +
      "</div>"
    );
  }

  function kpiCard(label, value, meta, variant) {
    return (
      '<div class="glass-panel kpi-card' + (variant ? " kpi-card--" + variant : "") + '">' +
      '<div class="kpi-card__label">' + label + "</div>" +
      '<div class="kpi-card__value">' + value + "</div>" +
      '<div class="kpi-card__meta">' + meta + "</div>" +
      "</div>"
    );
  }

  function pipelinePanel(stats) {
    const stages = [
      { key: "New", label: "New" },
      { key: "In Progress", label: "In Progress" },
      { key: "Waiting", label: "Waiting" },
      { key: "Resolved", label: "Resolved" },
    ];
    return (
      '<div class="glass-panel panel">' +
      '<div class="panel__header"><span class="panel__title">Status Pipeline</span></div>' +
      '<div class="pipeline">' +
      stages
        .map(
          (s) =>
            '<div class="pipeline__stage">' +
            '<div class="pipeline__stage-count">' + (stats.byStatus[s.key] || 0) + "</div>" +
            '<div class="pipeline__stage-label">' + s.label + "</div>" +
            "</div>"
        )
        .join("") +
      "</div>" +
      "</div>"
    );
  }

  function waitingPanel(stats) {
    const reasons = [
      { key: "Tenant", color: "var(--status-waiting-fg)" },
      { key: "Finance", color: "var(--status-waiting-fg)" },
      { key: "Management", color: "var(--status-waiting-fg)" },
    ];
    const max = Math.max(1, stats.waitingByReason.Tenant, stats.waitingByReason.Finance, stats.waitingByReason.Management);
    return (
      '<div class="glass-panel panel">' +
      '<div class="panel__header"><span class="panel__title">Waiting Breakdown</span></div>' +
      '<div style="display:flex; flex-direction:column; gap: var(--sp-3);">' +
      reasons
        .map((r) => {
          const val = stats.waitingByReason[r.key] || 0;
          const pct = Math.round((val / max) * 100);
          return (
            '<div>' +
            '<div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:5px;">' +
            '<span style="font-weight:590;">Waiting · ' + r.key + "</span><span class=\"text-muted\">" + val + "</span>" +
            "</div>" +
            '<div class="mini-bar"><div class="mini-bar__seg" style="width:' + pct + "%; background:" + r.color + ';"></div></div>' +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      "</div>"
    );
  }

  function mallBreakdownPanel(stats) {
    const busiest = stats.busiestMall;
    return (
      '<div class="glass-panel panel">' +
      '<div class="panel__header"><span class="panel__title">By Mall</span>' +
      (busiest && busiest.active > 0
        ? '<span class="text-tiny">Busiest: <strong style="color:var(--text-primary);">' + busiest.mall + '</strong> (' + busiest.active + ' active)</span>'
        : "") +
      "</div>" +
      '<div class="mall-breakdown-grid">' +
      stats.mallBreakdown
        .map((m) => {
          const total = Math.max(1, m.total);
          return (
            '<div class="mall-mini-card">' +
            '<div class="mall-mini-card__name">' + m.mall + "</div>" +
            '<div class="mall-mini-card__count">' + m.active + '<span class="text-tiny"> active</span></div>' +
            '<div class="mini-bar">' +
            '<div class="mini-bar__seg" style="width:' + (m.byStatus.New / total) * 100 + "%; background: var(--status-new-fg);\"></div>" +
            '<div class="mini-bar__seg" style="width:' + (m.byStatus["In Progress"] / total) * 100 + "%; background: var(--status-progress-fg);\"></div>" +
            '<div class="mini-bar__seg" style="width:' + (m.byStatus.Waiting / total) * 100 + "%; background: var(--status-waiting-fg);\"></div>" +
            '<div class="mini-bar__seg" style="width:' + (m.byStatus.Resolved / total) * 100 + "%; background: var(--status-resolved-fg);\"></div>" +
            "</div>" +
            '<div class="text-tiny">' + m.total + " total · " + m.byStatus.Resolved + " resolved</div>" +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      "</div>"
    );
  }

  function recentActivityPanel(recent) {
    if (!recent.length) {
      return (
        '<div class="glass-panel panel">' +
        '<div class="panel__header"><span class="panel__title">Recent Activity</span></div>' +
        '<div class="empty-state"><div class="empty-state__title">No activity yet</div></div>' +
        "</div>"
      );
    }
    return (
      '<div class="glass-panel panel">' +
      '<div class="panel__header"><span class="panel__title">Recent Activity</span></div>' +
      '<div class="feed-list">' +
      recent
        .map((entry) => {
          const ref = entry.issueRef;
          const u = U();
          const label = actionLabel(entry);
          return (
            '<div class="feed-item">' +
            '<div class="feed-item__dot"></div>' +
            '<div class="feed-item__body">' +
            "<div>" + u.escapeHtml(entry.actor) + " · " + label +
            (ref ? " on <strong>" + u.escapeHtml(ref.tenant) + "</strong> (" + u.escapeHtml(ref.issueId) + ")" : "") +
            "</div>" +
            '<div class="feed-item__meta">' + u.relativeTime(entry.timestamp) + "</div>" +
            "</div>" +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      "</div>"
    );
  }

  function actionLabel(entry) {
    switch (entry.action) {
      case "created": return "created the issue";
      case "status_changed": return "changed status to " + entry.to;
      case "waiting_reason_changed": return entry.to ? "set waiting reason to " + entry.to : "cleared waiting reason";
      case "priority_changed": return "changed priority to " + entry.to;
      case "assignment_changed": return "reassigned to " + entry.to;
      case "remark_added": return "added a remark";
      case "resolved": return "marked resolved";
      case "reopened": return "re-opened the issue";
      case "issue_edited": return "edited " + entry.field;
      default: return entry.action;
    }
  }

  window.App.Components.Dashboard = { render };
})();
