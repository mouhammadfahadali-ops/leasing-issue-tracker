/* ==========================================================================
   mallSelector.js — global mall selector segmented control
   Renders into #mallSelectorSlot. Filters every screen via App.State.
   ========================================================================== */

(function () {
  window.App = window.App || {};
  window.App.Components = window.App.Components || {};

  function render() {
    const slot = document.getElementById("mallSelectorSlot");
    if (!slot) return;
    const current = window.App.State.getState().mall;
    const options = [{ value: "ALL", label: "ALL MALLS" }].concat(
      window.App.Utils.MALLS.map((m) => ({ value: m, label: m }))
    );

    slot.innerHTML =
      '<div class="segmented" role="tablist" aria-label="Mall selector">' +
      options
        .map(
          (o) =>
            '<button type="button" class="segmented__option" role="tab" aria-pressed="' +
            (o.value === current ? "true" : "false") +
            '" data-mall="' +
            o.value +
            '">' +
            o.label +
            "</button>"
        )
        .join("") +
      "</div>";

    slot.querySelectorAll(".segmented__option").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.App.State.setMall(btn.getAttribute("data-mall"));
      });
    });
  }

  window.App.Components.MallSelector = { render };
})();
