// Light/dark toggle. Remembers the choice per browser; falls back to the OS setting.
(function () {
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem("thalai-theme");
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  } catch (e) {}

  function current() {
    var t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    function label() { btn.textContent = current() === "dark" ? "Light mode" : "Dark mode"; }
    label();
    btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("thalai-theme", next); } catch (e) {}
      label();
      document.dispatchEvent(new CustomEvent("themechange"));
    });
  });
})();
