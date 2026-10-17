// HAI progress page: builds the timeline, the scroll-linked scoreboard, and the result charts
// from /projects/hai/data/timeline.json and /projects/hai/data/runs.json.
(function () {
  "use strict";

  var DATA = "/projects/hai/data/";
  var SVGNS = "http://www.w3.org/2000/svg";
  var KIND_LABEL = {
    milestone: "Milestone",
    decision: "Decision",
    learning: "Learning",
    direction: "Change of direction",
    result: "Result"
  };

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function fmtDate(iso) {
    var d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  function fmt(v, kind) {
    if (v == null || isNaN(v)) return "–";
    if (kind === "pct") return Math.round(v * 1000) / 10 + "%";
    if (kind === "int") return Math.round(v).toLocaleString("en-GB");
    return (Math.round(v * 10) / 10).toLocaleString("en-GB");
  }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function seriesColor(i) { return "var(--series-" + ((i % 4) + 1) + ")"; }

  Promise.all([
    fetch(DATA + "timeline.json").then(function (r) { return r.json(); }),
    fetch(DATA + "runs.json").then(function (r) { return r.json(); })
  ]).then(function (res) {
    var timeline = res[0], runs = res[1];
    var checkpoints = (runs.checkpoints || []).slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.tasks_seen || 0) - (b.tasks_seen || 0);
    });
    buildTimeline(timeline, runs, checkpoints);
    buildCharts(runs, checkpoints);
    document.addEventListener("themechange", function () { buildCharts(runs, checkpoints); });
  }).catch(function () {
    var t = document.getElementById("timeline");
    t.innerHTML = "";
    t.appendChild(el("li", null, "The timeline data didn't load. Refresh the page to try again."));
  });

  // ---------- timeline ----------
  function buildTimeline(timeline, runs, checkpoints) {
    var list = document.getElementById("timeline");
    var stageLabel = {};
    (timeline.stages || []).forEach(function (s) { stageLabel[s.id] = s.label; });

    var entries = (timeline.entries || []).map(function (e, i) { e._i = i; return e; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a._i - b._i; });

    var lastStage = null;
    var items = [];
    entries.forEach(function (e, idx) {
      if (e.stage !== lastStage) {
        var s = el("li", { "class": "tl-stage" });
        s.appendChild(el("h2", null, stageLabel[e.stage] || e.stage));
        list.appendChild(s);
        lastStage = e.stage;
      }
      var li = el("li", { "data-kind": e.kind || "decision" });
      if (idx === entries.length - 1) li.id = "latest";

      var node = el("span", { "class": "tl-node", "aria-hidden": "true" });
      if (e.kind === "result" && e.metrics && e.metrics.heldout_pass_rate != null) {
        node.textContent = Math.round(e.metrics.heldout_pass_rate * 100) + "%";
      }
      li.appendChild(node);

      var b = el("article", { "class": "tl-bubble" });
      var meta = el("div", { "class": "tl-meta" });
      meta.appendChild(el("span", { "class": "tl-kind" }, KIND_LABEL[e.kind] || e.kind));
      meta.appendChild(el("time", { datetime: e.date }, fmtDate(e.date)));
      b.appendChild(meta);
      b.appendChild(el("h3", { "class": "tl-title" }, e.title));
      if (e.note) b.appendChild(el("p", { "class": "tl-note" }, e.note));

      if (e.kind === "result" && e.metrics) {
        var m = el("div", { "class": "tl-metrics" });
        var cfg = configLabel(runs, e.metrics.config);
        if (cfg) m.appendChild(metricSpan("Config", cfg));
        if (e.metrics.heldout_pass_rate != null) m.appendChild(metricSpan("Held-out", fmt(e.metrics.heldout_pass_rate, "pct")));
        if (e.metrics.delta_pts != null) {
          var d = el("span", { "class": e.metrics.delta_pts > 0 ? "tl-up" : "" });
          d.textContent = (e.metrics.delta_pts > 0 ? "+" : "") + e.metrics.delta_pts + " pts vs previous";
          m.appendChild(d);
        }
        if (e.metrics.tasks_seen != null) m.appendChild(metricSpan("Tasks", fmt(e.metrics.tasks_seen, "int")));
        b.appendChild(m);
      }

      if (e.details && e.details.length) {
        var det = el("details", { "class": "tl-more" });
        det.appendChild(el("summary", null, "More"));
        e.details.forEach(function (p) { det.appendChild(el("p", null, p)); });
        b.appendChild(det);
      }
      li.appendChild(b);
      li._entry = e;
      list.appendChild(li);
      items.push(li);
    });

    if (timeline.next) {
      var nx = el("li", { "class": "tl-next", "data-kind": "next" });
      nx.appendChild(el("span", { "class": "tl-node", "aria-hidden": "true" }));
      var nb = el("article", { "class": "tl-bubble" });
      var nm = el("div", { "class": "tl-meta" });
      nm.appendChild(el("span", { "class": "tl-kind" }, "Up next"));
      nb.appendChild(nm);
      nb.appendChild(el("h3", { "class": "tl-title" }, timeline.next.title));
      if (timeline.next.note) nb.appendChild(el("p", { "class": "tl-note" }, timeline.next.note));
      nx.appendChild(nb);
      list.appendChild(nx);
    }

    setupScoreboard(items, stageLabel, runs, checkpoints);
  }

  function metricSpan(k, v) {
    var s = el("span");
    s.appendChild(document.createTextNode(k + " "));
    s.appendChild(el("b", null, v));
    return s;
  }
  function configLabel(runs, id) {
    var c = (runs.configs || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.label : id;
  }

  // ---------- scoreboard ----------
  function setupScoreboard(items, stageLabel, runs, checkpoints) {
    var sb = document.getElementById("scoreboard");
    function q(k) { return sb.querySelector('[data-k="' + k + '"]'); }
    q("model").textContent = runs.model || "–";
    var scored = checkpoints.filter(function (c) { return c.heldout_pass_rate != null; });
    var active = null;

    function stateAt(li) {
      var e = li._entry;
      var upto = scored.filter(function (c) { return c.date <= e.date; });
      return { entry: e, upto: upto, current: upto[upto.length - 1] || null };
    }

    function render(li) {
      if (li === active) return;
      if (active) active.classList.remove("is-active");
      active = li;
      li.classList.add("is-active");
      var s = stateAt(li);
      q("when").textContent = fmtDate(s.entry.date);
      q("stage").textContent = stageLabel[s.entry.stage] || s.entry.stage;
      var num = q("score");
      if (s.current) {
        num.classList.remove("is-empty");
        num.textContent = fmt(s.current.heldout_pass_rate, "pct");
        var first = s.upto[0];
        var diff = Math.round((s.current.heldout_pass_rate - first.heldout_pass_rate) * 1000) / 10;
        q("delta").textContent = s.upto.length > 1
          ? (diff > 0 ? "+" : "") + diff + " pts since the first run"
          : "First scored run";
        q("tasks").textContent = fmt(s.current.tasks_seen, "int");
      } else {
        num.classList.add("is-empty");
        num.textContent = "No score yet";
        q("delta").textContent = "The baseline run sets the first score.";
        q("tasks").textContent = "0";
      }
      drawMini(q("chart"), scored, s.upto.length);
    }

    function onScroll() {
      var line = window.innerHeight * 0.45;
      var pick = items[0];
      for (var i = 0; i < items.length; i++) {
        if (items[i].getBoundingClientRect().top < line) pick = items[i]; else break;
      }
      if (pick) render(pick);
    }
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onScroll(); }); }
    }, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
  }

  function drawMini(host, scored, nDone) {
    host.innerHTML = "";
    if (!scored.length) return;
    var W = 240, H = 90, P = 6;
    var vals = scored.map(function (c) { return c.heldout_pass_rate; });
    var lo = Math.max(0, Math.min.apply(null, vals) - 0.05);
    var hi = Math.min(1, Math.max.apply(null, vals) + 0.05);
    if (hi - lo < 0.1) { hi = Math.min(1, lo + 0.1); }
    function x(i) { return scored.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (scored.length - 1); }
    function y(v) { return H - P - ((v - lo) / (hi - lo)) * (H - 2 * P); }
    var s = svg("svg", { viewBox: "0 0 " + W + " " + (H + 14), role: "img",
      "aria-label": "Held-out pass rate across " + scored.length + " scored runs" });
    s.appendChild(svg("line", { "class": "sb-base", x1: 0, x2: W, y1: H, y2: H }));
    var done = scored.slice(0, nDone), rest = scored.slice(Math.max(0, nDone - 1));
    function path(arr, offset) {
      return arr.map(function (c, i) { return (i ? "L" : "M") + x(i + offset).toFixed(1) + " " + y(c.heldout_pass_rate).toFixed(1); }).join(" ");
    }
    if (rest.length > 1) s.appendChild(svg("path", { "class": "sb-future", d: path(rest, Math.max(0, nDone - 1)) }));
    if (done.length > 1) s.appendChild(svg("path", { "class": "sb-line", d: path(done, 0) }));
    scored.forEach(function (c, i) {
      var isNow = i === nDone - 1;
      s.appendChild(svg("circle", {
        "class": isNow ? "sb-now" : (i < nDone ? "sb-dot" : "sb-dot-future"),
        cx: x(i), cy: y(c.heldout_pass_rate), r: isNow ? 5 : 3
      }));
    });
    var t1 = svg("text", { x: 0, y: H + 12 }); t1.textContent = fmtDate(scored[0].date);
    var t2 = svg("text", { x: W, y: H + 12, "text-anchor": "end" }); t2.textContent = fmtDate(scored[scored.length - 1].date);
    s.appendChild(t1); if (scored.length > 1) s.appendChild(t2);
    host.appendChild(s);
  }

  // ---------- full charts ----------
  function buildCharts(runs, checkpoints) {
    var configs = runs.configs || [];
    var sections = document.querySelectorAll(".chart[data-metric]");
    if (!checkpoints.length) {
      // Nothing to plot yet: one clear note instead of four empty frames.
      sections.forEach(function (sec) { sec.hidden = true; });
      var anchor = document.getElementById("charts");
      if (!document.getElementById("charts-empty")) {
        var note = el("div", { "class": "chart-empty", id: "charts-empty" },
          "No runs recorded yet. Charts for pass rate, regressions, efficiency and memory size appear here after the baseline run.");
        anchor.nextElementSibling.after(note);
      }
      return;
    }
    sections.forEach(function (sec) {
      sec.querySelectorAll(".chart-body").forEach(function (n) { n.remove(); });
      var body = el("div", { "class": "chart-body" });
      sec.appendChild(body);
      lineChart(body, configs, checkpoints, sec.getAttribute("data-metric"), sec.getAttribute("data-format"));
    });
  }

  function lineChart(host, configs, checkpoints, metric, format) {
    var series = configs.map(function (c, i) {
      return {
        id: c.id, label: c.label, color: seriesColor(i),
        pts: checkpoints.filter(function (p) { return p.config === c.id && p[metric] != null; })
          .map(function (p) { return { x: p.tasks_seen, y: p[metric], date: p.date }; })
          .sort(function (a, b) { return a.x - b.x; })
      };
    }).filter(function (s) { return s.pts.length; });

    if (!series.length) {
      host.appendChild(el("div", { "class": "chart-empty" }, "No runs recorded yet. The first line appears after the baseline run."));
      return;
    }

    var W = 760, H = 280, M = { t: 12, r: 150, b: 34, l: 48 };
    var iw = W - M.l - M.r, ih = H - M.t - M.b;
    var xs = [], ys = [];
    series.forEach(function (s) { s.pts.forEach(function (p) { xs.push(p.x); ys.push(p.y); }); });
    var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
    if (xMax === xMin) { xMax = xMin + 25; }
    var sc = niceScale(Math.max.apply(null, ys)); var yMax = sc.max;
    function X(v) { return M.l + ((v - xMin) / (xMax - xMin)) * iw; }
    function Y(v) { return M.t + ih - (v / yMax) * ih; }

    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": host.parentNode.querySelector(".chart-title").textContent + " by tasks run" });

    for (var i = 0; i <= sc.n; i++) {
      var v = sc.step * i, yy = Y(v);
      if (i > 0) s.appendChild(svg("line", { "class": "gridline", x1: M.l, x2: M.l + iw, y1: yy, y2: yy }));
      var tl = svg("text", { x: M.l - 8, y: yy + 4, "text-anchor": "end" });
      tl.textContent = fmt(v, format === "pct" ? "pct" : (format === "int" ? "int" : "num"));
      s.appendChild(tl);
    }
    s.appendChild(svg("line", { "class": "baseline", x1: M.l, x2: M.l + iw, y1: Y(0), y2: Y(0) }));
    var xticks = ticks(xMin, xMax, 5);
    xticks.forEach(function (t) {
      var lab = svg("text", { x: X(t), y: H - 12, "text-anchor": "middle" });
      lab.textContent = fmt(t, "int");
      s.appendChild(lab);
    });
    var xl = svg("text", { x: M.l + iw, y: H, "text-anchor": "end" });
    xl.textContent = "tasks run";
    s.appendChild(xl);

    // lines, then dots, then end labels (nudged apart so they don't collide)
    series.forEach(function (se) {
      if (se.pts.length > 1) {
        s.appendChild(svg("path", { "class": "series-line", stroke: se.color,
          d: se.pts.map(function (p, j) { return (j ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1); }).join(" ") }));
      }
    });
    series.forEach(function (se) {
      se.pts.forEach(function (p) {
        s.appendChild(svg("circle", { "class": "series-dot", cx: X(p.x), cy: Y(p.y), r: 4, fill: se.color }));
      });
    });
    var ends = series.map(function (se) { var p = se.pts[se.pts.length - 1]; return { se: se, x: X(p.x), y: Y(p.y) }; })
      .sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 15) ends[k].y = ends[k - 1].y + 15;
    ends.forEach(function (e) {
      var t = svg("text", { "class": "label", x: e.x + 10, y: e.y + 4 });
      t.textContent = e.se.label;
      s.appendChild(t);
    });

    // hover layer: crosshair snaps to the nearest x that has data
    var allX = Array.from(new Set(xs)).sort(function (a, b) { return a - b; });
    var cross = svg("line", { "class": "crosshair", y1: M.t, y2: M.t + ih, x1: -10, x2: -10, opacity: 0 });
    s.appendChild(cross);
    var hit = svg("rect", { x: M.l, y: M.t, width: iw, height: ih, fill: "transparent" });
    s.appendChild(hit);
    host.appendChild(s);

    var tip = el("div", { "class": "tooltip", role: "status" });
    host.style.position = "relative";
    host.appendChild(tip);

    function show(evt) {
      var r = s.getBoundingClientRect();
      var px = ((evt.clientX - r.left) / r.width) * W;
      var nearest = allX.reduce(function (a, b) { return Math.abs(X(b) - px) < Math.abs(X(a) - px) ? b : a; });
      cross.setAttribute("x1", X(nearest)); cross.setAttribute("x2", X(nearest)); cross.setAttribute("opacity", 1);
      tip.innerHTML = "";
      tip.appendChild(el("div", { "class": "tt-head" }, fmt(nearest, "int") + " tasks run"));
      series.forEach(function (se) {
        var p = se.pts.filter(function (q) { return q.x === nearest; })[0];
        if (!p) return;
        var row = el("div", { "class": "tt-row" });
        var name = el("span"); var dot = el("i"); dot.style.background = se.color;
        name.appendChild(dot); name.appendChild(document.createTextNode(se.label));
        row.appendChild(name); row.appendChild(el("span", null, fmt(p.y, format)));
        tip.appendChild(row);
      });
      var left = (X(nearest) / W) * r.width + 12;
      if (left + 180 > r.width) left = (X(nearest) / W) * r.width - 190;
      tip.style.left = left + "px";
      tip.style.top = ((M.t / H) * r.height + 8) + "px";
      tip.style.opacity = 1;
    }
    function hide() { cross.setAttribute("opacity", 0); tip.style.opacity = 0; }
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerleave", hide);

    // legend (always, for 2+ series) and a table view
    if (series.length > 1) {
      var lg = el("div", { "class": "legend" });
      series.forEach(function (se) {
        var it = el("span"); var sw = el("i"); sw.style.background = se.color;
        it.appendChild(sw); it.appendChild(document.createTextNode(se.label)); lg.appendChild(it);
      });
      host.appendChild(lg);
    }
    var det = el("details", { "class": "data-table" });
    det.appendChild(el("summary", null, "Show as table"));
    var tb = el("table");
    var hr = el("tr");
    ["Configuration", "Tasks run", "Date", "Value"].forEach(function (h) { hr.appendChild(el("th", { scope: "col" }, h)); });
    tb.appendChild(hr);
    series.forEach(function (se) {
      se.pts.forEach(function (p) {
        var tr = el("tr");
        [se.label, fmt(p.x, "int"), fmtDate(p.date), fmt(p.y, format)].forEach(function (c) { tr.appendChild(el("td", null, c)); });
        tb.appendChild(tr);
      });
    });
    det.appendChild(tb);
    host.appendChild(det);
  }

  // Round axis maximum with 2–6 even steps (1, 2, 2.5, 5 × 10^k).
  function niceScale(v) {
    if (!(v > 0)) return { max: 1, step: 0.25, n: 4 };
    var target = v * 1.08;
    var mag = Math.pow(10, Math.floor(Math.log10(target)) - 1);
    var mults = [1, 2, 2.5, 5, 10, 20, 25, 50, 100];
    for (var i = 0; i < mults.length; i++) {
      var step = mults[i] * mag, n = Math.ceil(target / step);
      if (n <= 6 && n >= 2) return { max: n * step, step: step, n: n };
      if (n < 2) return { max: 2 * step, step: step, n: 2 };
    }
    return { max: target, step: target / 4, n: 4 };
  }
  function ticks(a, b, n) {
    var span = b - a, raw = span / n;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = [1, 2, 5, 10].map(function (m) { return m * mag; }).filter(function (s) { return s >= raw; })[0] || mag * 10;
    var out = [];
    for (var t = Math.ceil(a / step) * step; t <= b + 1e-9; t += step) out.push(t);
    return out;
  }
})();
