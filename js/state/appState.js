/* ==========================================================================
   appState.js — small global UI state store.
   Holds only what genuinely needs to be shared across screens: which view is
   showing and which mall is selected (the global Mall Selector). Per-list
   filters are kept local to each list component so typing in Search doesn't
   force a full-app re-render on every keystroke.
   Exposed on window.App.State
   ========================================================================== */

(function () {
  window.App = window.App || {};

  const state = {
    view: "dashboard", // 'dashboard' | 'active' | 'archive'
    mall: "ALL",
  };

  const listeners = [];

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    };
  }

  function notify() {
    listeners.forEach((fn) => fn(state));
  }

  function setView(view) {
    state.view = view;
    notify();
  }

  function setMall(mall) {
    state.mall = mall;
    notify();
  }

  function getState() {
    return state;
  }

  window.App.State = {
    subscribe,
    setView,
    setMall,
    getState,
  };
})();
