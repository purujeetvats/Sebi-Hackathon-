/* ==========================================================================
   NiveshOS — app.js  (Agent A / logic)
   Vanilla browser script (no modules, no framework, runs from file://).
   Owns: localStorage state, panel router, onboarding, all panel renderers,
   inline-SVG charts, suitability engine, simulated order routing, rule-based
   copilot, audit/consent trails. Queries the DOM by the BUILD_SPEC contract
   IDs; every lookup is null-safe so a missing container never crashes.
   Exposes window.NIVESH = { switchPanel, state, fmt }.
   ========================================================================== */
(function () {
  "use strict";

  var D = window.NIVESH_DATA || {};
  var TODAY = "2026-07-06";

  /* -------------------------------------------------------------- helpers */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  var _inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  function fmt(n) { return "₹" + _inr.format(Math.round(n || 0)); }
  function fmtSigned(n) { return (n >= 0 ? "+" : "−") + "₹" + _inr.format(Math.abs(Math.round(n || 0))); }
  function pct(n, d) { d = d == null ? 1 : d; return (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(d) + "%"; }
  function cls_dir(n) { return n > 0 ? "positive" : n < 0 ? "negative" : "neutral"; }
  function dirColor(n) { return n > 0 ? "var(--good)" : n < 0 ? "var(--critical)" : "var(--ink-muted)"; }
  var SERIES = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"];
  function sv(i) { return "var(" + SERIES[i % SERIES.length] + ")"; }

  /* ------------------------------------------------------------- state
     Persistence is namespaced per signed-in user: niveshos.u.<id>.<key>.
     `theme` is global; the active session id lives under niveshos.session.  */
  var SESSION_KEY = "niveshos.session";
  var THEME_KEY = "niveshos.theme";
  var activeUserId = null;
  var state = {
    onboarded: false,
    theme: "dark",
    riskProfile: null,          // 'conservative' | 'balanced' | 'aggressive'
    riskScore: null,
    completedLessons: [],
    purchases: [],              // holding-shaped objects appended by order flow
    consents: [],
    auditTrail: []
  };
  var _rendered = false;

  function uk(k) { return "niveshos.u." + activeUserId + "." + k; }
  function loadTheme() {
    try { var r = localStorage.getItem(THEME_KEY); if (r != null) state.theme = JSON.parse(r); }
    catch (e) { /* ignore */ }
  }
  function hasSavedState() {
    try { return activeUserId && localStorage.getItem(uk("onboarded")) != null; }
    catch (e) { return false; }
  }
  function loadState() {
    if (!activeUserId) return;
    try {
      Object.keys(state).forEach(function (k) {
        if (k === "theme") return;                 // theme is global, not per-user
        var raw = localStorage.getItem(uk(k));
        if (raw != null) state[k] = JSON.parse(raw);
      });
    } catch (e) { /* file:// private mode etc. — fall back to defaults */ }
  }
  function save(k) {
    try {
      if (k === "theme") { localStorage.setItem(THEME_KEY, JSON.stringify(state.theme)); return; }
      if (!activeUserId) return;
      localStorage.setItem(uk(k), JSON.stringify(state[k]));
    } catch (e) { /* ignore persistence failure */ }
  }
  function saveAll() { Object.keys(state).forEach(save); }

  /* ------------------------------------------------------ users / session */
  function userById(id) {
    return (D.users || []).filter(function (u) { return u.id === id; })[0] || null;
  }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  function setSession(id) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(id)); } catch (e) { } }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) { } }

  function setActiveUser(id) {
    activeUserId = id;
    var u = userById(id);
    if (!u) return;
    // point the live data view at this user's portfolio
    D.investor = { name: u.name, pan: u.pan, riskProfile: null };
    D.accounts = u.accounts || [];
    D.holdings = u.holdings || [];
    D.history = u.history || [];
    // reflect identity in the sidebar chip
    var nm = $("investor-name"); if (nm) nm.textContent = u.name;
    var pan = $("investor-pan"); if (pan) pan.textContent = u.pan;
    var av = $("investor-avatar"); if (av) av.textContent = u.avatar || "";
  }

  // First sign-in for a user: seed their state from the persona so their
  // portfolio, risk profile and consent ledger are coherent immediately.
  function seedUserState(u) {
    var s = u.seed || {};
    state.completedLessons = (s.completedLessons || []).slice();
    state.riskProfile = s.riskProfile || null;
    state.riskScore = s.riskScore != null ? s.riskScore : null;
    state.purchases = [];
    state.consents = [];
    state.auditTrail = [];
    if (s.onboarded) {
      state.onboarded = true;
      grantConsents(CONSENT_SCOPES.map(function (c) { return c.id; }));
      audit("onboard", "Signed in — portfolio consolidated across " + (D.accounts || []).length + " linked sources.");
    } else {
      state.onboarded = false;
    }
    saveAll();
  }

  /* ------------------------------------------------------- audit + consent */
  function audit(kind, text) {
    state.auditTrail.push({ ts: nowStamp(), kind: kind, text: text });
    save("auditTrail");
    if (isActive("trust")) renderTrust();
  }
  function nowStamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return TODAY.slice(0, 4) + "-" + TODAY.slice(5) + " " +
      p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  /* ---------------------------------------------------- derived portfolio */
  function baseHoldings() { return (D.holdings || []).slice(); }
  function allHoldings() { return baseHoldings().concat(state.purchases); }
  function hv(h) { return (h.qty || 0) * (h.ltp || 0); }
  function marketHoldings() { return allHoldings().filter(function (h) { return h.assetClass !== "cash"; }); }
  function netWorth() { return allHoldings().reduce(function (s, h) { return s + hv(h); }, 0); }
  function idleCash() { return allHoldings().filter(function (h) { return h.assetClass === "cash"; }).reduce(function (s, h) { return s + hv(h); }, 0); }
  function marketValue() { return marketHoldings().reduce(function (s, h) { return s + hv(h); }, 0); }
  function invested() { return marketHoldings().reduce(function (s, h) { return s + (h.qty || 0) * (h.avgPrice || 0); }, 0); }
  function dayPnL() {
    var r = marketHoldings().reduce(function (s, h) { return s + hv(h) * (h.dayChangePct || 0) / 100; }, 0);
    var base = marketValue() - r;
    return { rupees: r, pct: base ? (r / base) * 100 : 0 };
  }
  function thirtyDay() {
    var hs = D.history || [];
    if (hs.length < 2) return { pct: 0, from: 0, to: netWorth() };
    var a = hs[0].v, b = hs[hs.length - 1].v;
    return { pct: (b - a) / a * 100, from: a, to: b };
  }

  var ASSET_ORDER = [
    { key: "equity", label: "Equity" },
    { key: "mf", label: "Mutual Funds" },
    { key: "reit", label: "REITs" },
    { key: "invit", label: "InvITs" },
    { key: "bond", label: "Bonds" },
    { key: "etf", label: "Gold ETF" },
    { key: "cash", label: "Cash" }
  ];
  function assetAlloc() {
    var total = netWorth();
    return ASSET_ORDER.map(function (a, i) {
      var val = allHoldings().filter(function (h) { return h.assetClass === a.key; })
        .reduce(function (s, h) { return s + hv(h); }, 0);
      return { key: a.key, label: a.label, value: val, pct: total ? val / total * 100 : 0, color: sv(i) };
    }).filter(function (a) { return a.value > 0; });
  }
  function sectorExposure() {
    // over market value (excludes cash) — this is the concentration denominator
    var mv = marketValue(), map = {};
    marketHoldings().forEach(function (h) {
      var s = h.sector || "Other";
      map[s] = (map[s] || 0) + hv(h);
    });
    return Object.keys(map).map(function (s) {
      return { sector: s, value: map[s], pct: mv ? map[s] / mv * 100 : 0 };
    }).sort(function (a, b) { return b.value - a.value; });
  }
  function financialsPct() {
    var s = sectorExposure().filter(function (x) { return x.sector === "Financials"; })[0];
    return s ? s.pct : 0;
  }
  function topIssuer() {
    // largest single issuer (by symbol) as % of market value
    var mv = marketValue(), map = {};
    marketHoldings().forEach(function (h) {
      map[h.symbol] = { name: h.name, v: (map[h.symbol] ? map[h.symbol].v : 0) + hv(h) };
    });
    var best = null;
    Object.keys(map).forEach(function (k) {
      if (!best || map[k].v > best.v) best = { name: map[k].name, v: map[k].v };
    });
    return best ? { name: best.name, pct: mv ? best.v / mv * 100 : 0 } : { name: "—", pct: 0 };
  }
  function mfOverlap() {
    var mfs = allHoldings().filter(function (h) { return h.assetClass === "mf" && h.underlying; });
    if (mfs.length < 2) return null;
    var a = mfs[0], b = mfs[1];
    var setB = {}; b.underlying.forEach(function (u) { setB[u.symbol] = u; });
    var common = a.underlying.filter(function (u) { return setB[u.symbol]; })
      .map(function (u) { return { symbol: u.symbol, name: u.name }; });
    var overlapPct = Math.round(common.length / a.underlying.length * 100);
    return { a: a, b: b, common: common, pct: overlapPct };
  }
  /* ---- portfolio health: 5 weighted factors, 100 points, all computed ---- */
  function scoreBand(x, best, worst, max) {
    if (x <= best) return max;
    if (x >= worst) return 0;
    return Math.round(max * (worst - x) / (worst - best));
  }
  function healthReport() {
    // "Diversified" is fund-level exposure spread across many sectors — not a
    // concentrated bet, so it can't be the top sector for scoring purposes.
    var topSec = sectorExposure().filter(function (s) { return s.sector !== "Diversified"; })[0]
      || { sector: null, pct: 0 };
    var ti = topIssuer();
    var ov = mfOverlap();
    var nw = netWorth(), cashPct = nw ? idleCash() / nw * 100 : 0;
    var classes = assetAlloc().filter(function (a) { return a.key !== "cash" && a.pct >= 5; }).length;
    var factors = [
      { label: "Sector balance", pts: scoreBand(topSec.pct, 25, 45, 25), max: 25, link: "analytics",
        note: topSec.sector ? "Top sector (" + topSec.sector + ") is " + topSec.pct.toFixed(1) + "% — comfort band is ≤25%."
                            : "No concentrated sector bets — exposure is via diversified funds." },
      { label: "Asset-class spread", pts: [0, 4, 10, 18, 25][Math.min(classes, 4)], max: 25, link: "invest",
        note: classes + " asset class" + (classes === 1 ? "" : "es") + " above 5% weight — 4+ earns full marks." },
      { label: "Single-issuer risk", pts: scoreBand(ti.pct, 10, 25, 20), max: 20, link: "analytics",
        note: esc(ti.name) + " alone is " + ti.pct.toFixed(1) + "% of market value." },
      { label: "Fund overlap", pts: ov ? scoreBand(ov.pct, 40, 100, 15) : 15, max: 15, link: "analytics",
        note: ov ? "Your two funds overlap ~" + ov.pct + "% — same bets twice." : "No duplicated look-through funds." },
      { label: "Idle cash", pts: scoreBand(cashPct, 5, 18, 15), max: 15, link: "copilot",
        note: fmt(idleCash()) + " (" + cashPct.toFixed(1) + "%) earning ~0%." }
    ];
    var score = factors.reduce(function (s, f) { return s + f.pts; }, 0);
    var grade = score >= 80 ? { label: "Strong", status: "good" }
      : score >= 60 ? { label: "Fair", status: "warn" }
        : { label: "Needs attention", status: "serious" };
    return { score: score, grade: grade, factors: factors };
  }
  function renderHealth() {
    var host = $("health-card"); if (!host) return;
    var h = healthReport();
    var rows = h.factors.map(function (f) {
      var ratio = f.pts / f.max;
      var col = ratio >= 0.8 ? "var(--good)" : ratio >= 0.5 ? "var(--warn)" : "var(--serious)";
      return '<div class="health-row" data-link="' + f.link + '" role="button" tabindex="0">' +
        '<div class="health-row-head"><span>' + f.label + '</span>' +
        '<b style="color:' + col + ';">' + f.pts + " / " + f.max + "</b></div>" +
        '<div class="health-track"><span style="width:' + (ratio * 100).toFixed(0) + '%;background:' + col + ';"></span></div>' +
        '<div class="health-note">' + f.note + "</div></div>";
    }).join("");
    host.innerHTML = '<div class="health-grid">' +
      '<div class="health-score">' +
        '<div class="health-score-num" style="color:var(--' + (h.grade.status === "good" ? "good" : h.grade.status === "warn" ? "warn" : "serious") + ');">' + h.score + "</div>" +
        '<div class="health-score-den">/ 100</div>' +
        '<div class="badge-' + h.grade.status + '" style="font-size:13px;font-weight:700;">' + h.grade.label + "</div>" +
        '<p class="health-caption">Five live-computed factors. Click one to see where to act.</p>' +
      "</div>" +
      '<div class="health-rows"><h3 style="margin:0 0 10px;">Portfolio health</h3>' + rows + "</div></div>";
    Array.prototype.forEach.call(host.querySelectorAll("[data-link]"), function (n) {
      n.addEventListener("click", function () { switchPanel(n.getAttribute("data-link")); });
    });
  }

  function riskiestHolding() {
    // largest single-day adverse move among market holdings
    var arr = marketHoldings().slice().sort(function (x, y) { return (x.dayChangePct || 0) - (y.dayChangePct || 0); });
    return arr[0];
  }
  function mergedHoldings() {
    // merge same symbol across accounts (dupe-merge). cash excluded from table.
    var groups = {};
    marketHoldings().forEach(function (h) {
      var g = groups[h.symbol];
      if (!g) {
        groups[h.symbol] = {
          symbol: h.symbol, name: h.name, assetClass: h.assetClass, sector: h.sector,
          qty: h.qty, ltp: h.ltp, dayChangePct: h.dayChangePct,
          value: hv(h), accounts: [h.accountId]
        };
      } else {
        g.qty += h.qty; g.value += hv(h);
        if (g.accounts.indexOf(h.accountId) < 0) g.accounts.push(h.accountId);
      }
    });
    return Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return b.value - a.value; });
  }
  function accountName(id) {
    var a = (D.accounts || []).filter(function (x) { return x.id === id; })[0];
    return a ? a.broker : id;
  }

  var TYPE_LABEL = { equity: "Equity", mf: "Mutual Fund", bond: "Bond", reit: "REIT", invit: "InvIT", etf: "ETF", cash: "Cash" };

  /* ============================================================ CHARTS */
  var tooltip = null;
  function getTip() { if (!tooltip) tooltip = $("chart-tooltip"); return tooltip; }
  function showTip(html, e) {
    var t = getTip(); if (!t) return;
    t.hidden = false; t.innerHTML = html;
    t.style.position = "fixed";
    t.style.left = (e.clientX + 14) + "px";
    t.style.top = (e.clientY + 14) + "px";
    t.style.pointerEvents = "none";
    t.style.zIndex = "9999";
  }
  function hideTip() { var t = getTip(); if (t) t.hidden = true; }
  function wireTips(container) {
    if (!container) return;
    var marks = container.querySelectorAll("[data-tip]");
    Array.prototype.forEach.call(marks, function (m) {
      m.style.cursor = "pointer";
      m.addEventListener("mousemove", function (e) { showTip(m.getAttribute("data-tip"), e); });
      m.addEventListener("mouseleave", hideTip);
    });
  }

  // --- donut (asset-class allocation) + legend
  function renderDonut(container) {
    if (!container) return;
    var data = assetAlloc(), total = netWorth();
    var size = 220, cx = size / 2, cy = size / 2, r = 82, sw = 22;
    var C = 2 * Math.PI * r, gap = 2, off = 0;
    var segs = "";
    data.forEach(function (d, i) {
      var len = d.pct / 100 * C;
      var dash = Math.max(len - gap, 0.5);
      segs += '<circle class="anim-donut" data-tip="<b>' + esc(d.label) + '</b><br>' + fmt(d.value) + " &middot; " + d.pct.toFixed(1) +
        '%" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + d.color +
        '" stroke-width="' + sw + '" stroke-dasharray="' + dash.toFixed(2) + " " + (C - dash).toFixed(2) +
        '" stroke-dashoffset="' + (-off).toFixed(2) + '"></circle>';
      off += len;
    });
    var svg = '<svg viewBox="0 0 ' + size + " " + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="Asset allocation">' +
      '<g transform="rotate(-90 ' + cx + " " + cy + ')">' + segs + "</g>" +
      '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" fill="var(--ink-muted)" font-size="11">Net Worth</text>' +
      '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" fill="var(--ink)" font-size="17" font-weight="700">' + fmt(total) + "</text></svg>";
    var legend = '<ul class="chart-legend" style="list-style:none;margin:8px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 16px;">';
    data.forEach(function (d) {
      legend += '<li style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-2);">' +
        '<span style="width:10px;height:10px;border-radius:2px;background:' + d.color + ';display:inline-block;"></span>' +
        esc(d.label) + ' <span style="color:var(--ink-muted);">' + d.pct.toFixed(1) + "%</span></li>";
    });
    legend += "</ul>";
    container.innerHTML = '<div class="donut-wrap" style="display:flex;flex-direction:column;align-items:center;">' + svg + legend + "</div>";
    wireTips(container);
  }

  // --- 30-day line chart with crosshair + tooltip
  function renderLine(container) {
    if (!container) return;
    var hs = D.history || [];
    if (!hs.length) { container.innerHTML = ""; return; }
    var W = 640, H = 220, pL = 8, pR = 8, pT = 14, pB = 22;
    var iw = W - pL - pR, ih = H - pT - pB;
    var vals = hs.map(function (d) { return d.v; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var pad = (max - min) * 0.12 || 1; min -= pad; max += pad;
    function X(i) { return pL + (i / (hs.length - 1)) * iw; }
    function Y(v) { return pT + (1 - (v - min) / (max - min)) * ih; }
    var pts = hs.map(function (d, i) { return X(i) + "," + Y(d.v).toFixed(1); });
    var linePath = "M" + pts.join(" L");
    var areaPath = "M" + X(0) + "," + (pT + ih) + " L" + pts.join(" L") + " L" + X(hs.length - 1) + "," + (pT + ih) + " Z";
    var up = vals[vals.length - 1] >= vals[0];
    var col = up ? "var(--good)" : "var(--critical)";
    var grid = "";
    for (var g = 0; g <= 3; g++) {
      var gy = pT + (g / 3) * ih;
      grid += '<line x1="' + pL + '" y1="' + gy + '" x2="' + (W - pR) + '" y2="' + gy + '" stroke="var(--grid)" stroke-width="1"></line>';
    }
    var svg = '<svg id="line-svg" viewBox="0 0 ' + W + " " + H + '" width="100%" preserveAspectRatio="none" role="img" aria-label="30-day portfolio value">' +
      grid +
      '<path d="' + areaPath + '" fill="' + col + '" opacity="0.08"></path>' +
      '<path class="anim-line" d="' + linePath + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>' +
      '<line id="line-cross" x1="0" y1="' + pT + '" x2="0" y2="' + (pT + ih) + '" stroke="var(--ink-muted)" stroke-width="1" stroke-dasharray="3 3" style="display:none;"></line>' +
      '<circle id="line-dot" r="3.5" fill="' + col + '" style="display:none;"></circle>' +
      '<rect id="line-hit" x="' + pL + '" y="' + pT + '" width="' + iw + '" height="' + ih + '" fill="transparent"></rect></svg>';
    var range = '<div class="chart-note" style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink-muted);margin-top:4px;">' +
      "<span>" + esc(hs[0].t) + "</span><span>30-day &middot; " + pct(thirtyDay().pct) + "</span><span>" + esc(hs[hs.length - 1].t) + "</span></div>";
    container.innerHTML = svg + range;
    // interaction
    var hit = $("line-hit"), cross = $("line-cross"), dot = $("line-dot");
    if (hit) {
      hit.style.cursor = "crosshair";
      hit.addEventListener("mousemove", function (e) {
        var rect = hit.getBoundingClientRect();
        var rel = (e.clientX - rect.left) / rect.width;
        var idx = Math.round(rel * (hs.length - 1));
        idx = Math.max(0, Math.min(hs.length - 1, idx));
        var d = hs[idx], x = X(idx), y = Y(d.v);
        if (cross) { cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.style.display = ""; }
        if (dot) { dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.style.display = ""; }
        showTip("<b>" + esc(d.t) + "</b><br>" + fmt(d.v), e);
      });
      hit.addEventListener("mouseleave", function () {
        if (cross) cross.style.display = "none";
        if (dot) dot.style.display = "none";
        hideTip();
      });
    }
  }

  // --- horizontal sector bars
  function renderSectorBars(container) {
    if (!container) return;
    var data = sectorExposure();
    var max = data.length ? data[0].pct : 100;
    var rowH = 30, barH = 20, W = 560, labelW = 150, trackX = labelW, trackW = W - labelW - 60;
    var svg = '<svg viewBox="0 0 ' + W + " " + (data.length * rowH + 6) + '" width="100%" role="img" aria-label="Sector exposure">';
    data.forEach(function (d, i) {
      var y = i * rowH + 4;
      var w = Math.max(2, d.pct / max * trackW);
      svg += '<text x="0" y="' + (y + barH / 2 + 4) + '" fill="var(--ink-2)" font-size="12">' + esc(d.sector) + "</text>";
      svg += '<rect x="' + trackX + '" y="' + y + '" width="' + trackW + '" height="' + barH + '" rx="4" fill="var(--grid)" opacity="0.5"></rect>';
      svg += '<rect class="anim-bar" data-grow="x" data-tip="<b>' + esc(d.sector) + '</b><br>' + fmt(d.value) + " &middot; " + d.pct.toFixed(1) +
        '%" x="' + trackX + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + barH + '" rx="4" fill="' + sv(i) + '"></rect>';
      svg += '<text x="' + (trackX + w + 6) + '" y="' + (y + barH / 2 + 4) + '" fill="var(--ink)" font-size="12" font-weight="600">' + d.pct.toFixed(1) + "%</text>";
    });
    svg += "</svg>";
    container.innerHTML = svg;
    wireTips(container);
  }

  // --- risk gauge (0-100 semicircle)
  function renderGauge(container, score, label) {
    if (!container) return;
    var W = 240, H = 140, cx = W / 2, cy = 120, r = 92;
    var start = "M" + (cx - r) + "," + cy + " A" + r + "," + r + " 0 0 1 " + (cx + r) + "," + cy;
    var col = score < 34 ? "var(--good)" : score < 67 ? "var(--warn)" : "var(--serious)";
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="Risk score">' +
      '<path d="' + start + '" fill="none" stroke="var(--grid)" stroke-width="16" stroke-linecap="round"></path>' +
      '<path d="' + start + '" fill="none" stroke="' + col + '" stroke-width="16" stroke-linecap="round" pathLength="100" stroke-dasharray="' + score + ' 100"></path>' +
      '<text x="' + cx + '" y="' + (cy - 18) + '" text-anchor="middle" fill="var(--ink)" font-size="30" font-weight="700">' + Math.round(score) + "</text>" +
      '<text x="' + cx + '" y="' + (cy + 2) + '" text-anchor="middle" fill="var(--ink-muted)" font-size="11">/ 100</text></svg>' +
      '<div style="text-align:center;margin-top:2px;font-size:13px;color:var(--ink-2);">Risk appetite: <b style="color:var(--ink);">' + esc(label) + "</b></div>";
    container.innerHTML = svg;
  }

  // --- mix vs suggested stacked bars
  var SUGGESTED = {
    conservative: { Equity: 25, "Mutual Funds": 15, Bonds: 40, "Gold ETF": 10, Cash: 10 },
    balanced: { Equity: 40, "Mutual Funds": 20, Bonds: 25, "Gold ETF": 8, Cash: 7 },
    aggressive: { Equity: 60, "Mutual Funds": 20, Bonds: 12, "Gold ETF": 5, Cash: 3 }
  };
  function renderMixBars(container) {
    if (!container) return;
    var tier = state.riskProfile || "balanced";
    var yours = assetAlloc();
    var sug = SUGGESTED[tier];
    var W = 560, barH = 22;
    function stacked(items, y) {
      var x = 0, out = "";
      items.forEach(function (it) {
        var w = it.pct / 100 * W;
        if (w <= 0) return;
        var seg = Math.max(0, w - 2);
        out += '<rect class="anim-bar" data-grow="x" data-tip="<b>' + esc(it.label) + '</b><br>' + it.pct.toFixed(1) +
          '%" x="' + x.toFixed(1) + '" y="' + y + '" width="' + seg.toFixed(1) + '" height="' + barH + '" rx="3" fill="' + it.color + '"></rect>';
        if (it.pct >= 9) out += '<text x="' + (x + seg / 2).toFixed(1) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="middle" fill="#fff" font-size="10" font-weight="600">' + Math.round(it.pct) + "%</text>";
        x += w;
      });
      return out;
    }
    var yoursItems = yours;
    var sugItems = ASSET_ORDER.map(function (a, i) { return { label: a.label, pct: sug[a.label] || 0, color: sv(i) }; });
    var svg = '<svg viewBox="0 0 ' + W + ' 84" width="100%" role="img" aria-label="Your mix vs suggested">' +
      '<text x="0" y="12" fill="var(--ink-muted)" font-size="11">Your mix</text>' +
      stacked(yoursItems, 16) +
      '<text x="0" y="60" fill="var(--ink-muted)" font-size="11">Suggested (' + esc(tier) + ")</text>" +
      stacked(sugItems, 62) + "</svg>";
    var legend = '<ul class="chart-legend" style="list-style:none;margin:6px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;">';
    ASSET_ORDER.forEach(function (a, i) {
      legend += '<li style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-2);"><span style="width:9px;height:9px;border-radius:2px;background:' + sv(i) + ';display:inline-block;"></span>' + esc(a.label) + "</li>";
    });
    legend += "</ul>";
    container.innerHTML = svg + legend;
    wireTips(container);
  }

  /* ============================================================ PANELS */

  function statTile(label, rawValue, displayText, prefix, deltaText, deltaDir) {
    return '<div class="stat-tile">' +
      '<div class="label">' + esc(label) + "</div>" +
      '<div class="value countup" data-value="' + Math.round(Math.abs(rawValue)) + '" data-prefix="' + prefix + '" data-decimals="0" data-suffix="">' + displayText + "</div>" +
      '<div class="delta ' + deltaDir + '">' + esc(deltaText) + "</div></div>";
  }
  function renderKPIs() {
    var host = $("kpi-row"); if (!host) return;
    var dp = dayPnL(), td = thirtyDay(), unreal = marketValue() - invested();
    host.innerHTML =
      statTile("Net Worth", netWorth(), fmt(netWorth()), "₹", pct(td.pct) + " (30d)", cls_dir(td.pct)) +
      statTile("Day P&L", dp.rupees, fmtSigned(dp.rupees), (dp.rupees < 0 ? "−₹" : "+₹"), pct(dp.pct) + " today", cls_dir(dp.pct)) +
      statTile("Total Invested", invested(), fmt(invested()), "₹", fmtSigned(unreal) + " unrealised", cls_dir(unreal)) +
      statTile("Idle Cash", idleCash(), fmt(idleCash()), "₹", "earning ~0%", "neutral");
  }

  function renderAccountsStrip() {
    var host = $("accounts-strip"); if (!host) return;
    host.innerHTML = (D.accounts || []).map(function (a) {
      var val = marketHoldings().filter(function (h) { return h.accountId === a.id; }).reduce(function (s, h) { return s + hv(h); }, 0);
      val += allHoldings().filter(function (h) { return h.accountId === a.id && h.assetClass === "cash"; }).reduce(function (s, h) { return s + hv(h); }, 0);
      return '<div class="account-card">' +
        '<div class="acct-broker" style="font-weight:600;">' + esc(a.broker) + "</div>" +
        '<div class="acct-meta" style="font-size:11px;color:var(--ink-muted);">' + esc(a.depository) + " &middot; " + esc(a.type) + "</div>" +
        '<div class="acct-value" style="font-weight:700;font-variant-numeric:tabular-nums;margin-top:4px;">' + fmt(val) + "</div>" +
        '<div class="acct-sync" style="font-size:11px;color:var(--good);">● Synced ' + esc(a.lastSync) + "</div></div>";
    }).join("");
  }

  function renderHoldingsTable() {
    var host = $("holdings-table"); if (!host) return;
    var rows = mergedHoldings();
    var body = rows.map(function (r) {
      var acct = r.accounts.length > 1
        ? '<span title="' + esc(r.accounts.map(accountName).join(", ")) + '">' + esc(accountName(r.accounts[0])) + ' <span class="dupe-chip" style="background:var(--surface-2);border:1px solid var(--hairline);border-radius:6px;padding:0 5px;font-size:10px;">+' + (r.accounts.length - 1) + " broker</span></span>"
        : esc(accountName(r.accounts[0]));
      return "<tr>" +
        '<td><b>' + esc(r.symbol) + "</b><div style=\"font-size:11px;color:var(--ink-muted);\">" + esc(r.name) + "</div></td>" +
        "<td>" + esc(TYPE_LABEL[r.assetClass] || r.assetClass) + "</td>" +
        "<td>" + acct + "</td>" +
        '<td style="text-align:right;font-variant-numeric:tabular-nums;">' + _inr.format(r.qty) + "</td>" +
        '<td style="text-align:right;font-variant-numeric:tabular-nums;">' + fmt(r.value) + "</td>" +
        '<td style="text-align:right;color:' + dirColor(r.dayChangePct) + ';">' + pct(r.dayChangePct) + "</td></tr>";
    }).join("");
    host.innerHTML = '<table class="data-table holdings" style="width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;">' +
      '<thead><tr style="text-align:left;color:var(--ink-muted);font-size:11px;">' +
      "<th>Instrument</th><th>Type</th><th>Account</th><th style=\"text-align:right;\">Qty</th><th style=\"text-align:right;\">Value</th><th style=\"text-align:right;\">Day Δ</th></tr></thead>" +
      "<tbody>" + body + "</tbody></table>";
  }

  function alerts() {
    var list = [];
    var fp = financialsPct(), ti = topIssuer(), ov = mfOverlap(), dp = dayPnL();
    if (fp > 30) list.push({ level: "serious", icon: "⚠", title: "Sector concentration", text: "Financials are <b>" + fp.toFixed(1) + "%</b> of your market value — above the 30% comfort band. Top issuer <b>" + esc(ti.name) + "</b> alone is " + ti.pct.toFixed(1) + "%.", link: "analytics" });
    if (ov && ov.pct >= 60) list.push({ level: "warn", icon: "⚙", title: "Fund overlap", text: "<b>" + esc(ov.a.name.split(" —")[0]) + "</b> &amp; <b>" + esc(ov.b.name.split(" —")[0]) + "</b> overlap ~" + ov.pct + "% (" + ov.common.length + " common holdings) — less diversified than it looks.", link: "analytics" });
    var dupes = mergedHoldings().filter(function (r) { return r.accounts.length > 1; });
    if (dupes.length) list.push({ level: "info", icon: "✓", title: "Consolidated view", text: dupes.map(function (d) { return d.symbol; }).join(" &amp; ") + " held across 2 brokers — now merged into one holding.", link: "dashboard" });
    if (idleCash() > 0) list.push({ level: "warn", icon: "○", title: "Idle cash", text: "<b>" + fmt(idleCash()) + "</b> sitting idle at ~0%. " + suitableProducts().length + " suitable options in Discover.", link: "invest" });
    if (dp.rupees < 0) list.push({ level: "info", icon: "↓", title: "Today's move", text: "Portfolio <b>" + pct(dp.pct) + "</b> today, led by " + esc(riskiestHolding().symbol) + " " + pct(riskiestHolding().dayChangePct) + " and bank stocks.", link: "copilot" });
    return list;
  }
  function renderAlerts() {
    var host = $("alerts-feed"); if (!host) return;
    host.innerHTML = alerts().map(function (a) {
      return '<div class="alert alert-' + a.level + '" style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--hairline);cursor:pointer;" data-link="' + a.link + '">' +
        '<span class="alert-icon" aria-hidden="true">' + a.icon + "</span>" +
        '<div><div style="font-weight:600;font-size:13px;">' + esc(a.title) + "</div>" +
        '<div style="font-size:12px;color:var(--ink-2);">' + a.text + "</div></div></div>";
    }).join("");
    Array.prototype.forEach.call(host.querySelectorAll("[data-link]"), function (n) {
      n.addEventListener("click", function () { switchPanel(n.getAttribute("data-link")); });
    });
  }

  function renderDashboard() {
    renderDataSource();
    renderKPIs();
    renderDonut($("alloc-donut"));
    renderLine($("value-line"));
    renderTradingView();
    renderAccountsStrip();
    renderHoldingsTable();
    renderAlerts();
  }

  /* --- live TradingView chart (external, real-time; needs internet) ----- */
  var _tvBuilt = false;
  function renderTradingView() {
    var card = $("tv-chart-card");
    if (!card || _tvBuilt) return;
    // only market-chartable holdings (equity + gold ETF), deduped by symbol
    // BSE feed: TradingView's free widget serves BSE real-time; NSE needs a
    // paid plan and pops "only available on TradingView" instead of a chart.
    var seen = {}, opts = [];
    (D.holdings || []).forEach(function (h) {
      if ((h.assetClass === "equity" || h.assetClass === "etf") && !seen[h.symbol]) {
        seen[h.symbol] = 1;
        opts.push({ sym: "BSE:" + h.symbol, name: h.name });
      }
    });
    if (!opts.length) return;
    var sel = '<select id="tv-symbol" class="tv-select" aria-label="Chart symbol">' +
      opts.map(function (o, i) {
        return '<option value="' + esc(o.sym) + '"' + (i === 0 ? " selected" : "") + '>' +
          esc(o.name) + " · " + esc(o.sym) + "</option>";
      }).join("") + "</select>";
    card.innerHTML =
      '<div class="tv-head"><div>' +
        '<h3 style="margin:0;">Live market chart</h3>' +
        '<p style="margin:2px 0 0;font-size:12px;color:var(--ink-muted);">Real-time &amp; interactive — embedded from TradingView (external, needs internet). Separate from the dated equity snapshot above.</p>' +
      "</div>" + sel + "</div>" +
      '<div id="tv-widget" class="tv-widget"></div>';
    var s = $("tv-symbol");
    if (s) s.addEventListener("change", function () { loadTVWidget(this.value); });
    _tvBuilt = true;
    loadTVWidget(opts[0].sym);
  }
  function loadTVWidget(tvSymbol) {
    var host = $("tv-widget");
    if (!host) return;
    host.innerHTML = "";
    var theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    var wrap = el("div", "tradingview-widget-container");
    wrap.appendChild(el("div", "tradingview-widget-container__widget"));
    // TradingView free-widget terms require the attribution link — keep it.
    var copy = el("div", "tradingview-widget-copyright");
    copy.innerHTML = '<a href="https://www.tradingview.com/symbols/' +
      esc(tvSymbol.replace(":", "-")) + '/" rel="noopener nofollow" target="_blank">' +
      '<span class="blue-text">Track all markets on TradingView</span></a>';
    wrap.appendChild(copy);
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: "D",
      timezone: "Asia/Kolkata",
      theme: theme,
      style: "1",
      locale: "en",
      hide_side_toolbar: true,
      allow_symbol_change: true,
      support_host: "https://www.tradingview.com"
    });
    wrap.appendChild(script);
    host.appendChild(wrap);
  }

  /* --- real-data provenance strip + live NAV refresh ------------------- */
  var _refreshing = false;
  function renderDataSource() {
    var body = document.querySelector("#panel-dashboard .panel-body");
    if (!body) return;
    var ds = D.dataSource;
    var strip = $("data-source-strip");
    if (!strip) {
      strip = el("div", "data-source-strip");
      strip.id = "data-source-strip";
      body.insertBefore(strip, body.firstChild);
    }
    var live = ds && ds.live;
    var asOf = ds && ds.asOf ? ds.asOf : "baked snapshot";
    strip.innerHTML =
      '<span class="ds-dot" style="color:' + (live ? "var(--good)" : "var(--ink-muted)") + ';">●</span> ' +
      '<span class="ds-label">' + (live ? "Real market data" : "Offline snapshot") + '</span>' +
      '<span class="ds-meta">Prices: NSE via Yahoo Finance · NAVs: AMFI (mfapi.in) · as of ' + esc(asOf) + '</span>' +
      '<button id="refresh-navs" class="btn-ghost ds-refresh" type="button" title="Fetch the latest mutual-fund NAVs live from AMFI">↻ Refresh NAVs</button>';
    var btn = $("refresh-navs");
    if (btn) btn.addEventListener("click", refreshLiveNavs);
  }

  function refreshLiveNavs() {
    if (_refreshing) return;
    if (typeof fetch !== "function") { toast("Live refresh needs a modern browser.", "warn"); return; }
    _refreshing = true;
    var btn = $("refresh-navs");
    if (btn) { btn.disabled = true; btn.textContent = "↻ Refreshing…"; }
    // every AMFI-coded instrument we hold or list (funds + index fund)
    var codes = {};
    (D.holdings || []).forEach(function (h) { if (h.schemeCode) codes[h.schemeCode] = 1; });
    (D.products || []).forEach(function (p) { if (p.schemeCode) codes[p.schemeCode] = 1; });
    var list = Object.keys(codes);
    var pending = list.length, updated = 0, latestDate = null;
    if (!pending) { finishRefresh(btn, 0, null); return; }
    list.forEach(function (code) {
      fetch("https://api.mfapi.in/mf/" + code + "/latest")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var d = j && j.data && j.data[0];
          if (d && d.nav != null) {
            var nav = Math.round(parseFloat(d.nav) * 100) / 100;
            (D.holdings || []).forEach(function (h) { if (String(h.schemeCode) === code) h.ltp = nav; });
            (D.products || []).forEach(function (p) { if (String(p.schemeCode) === code) p.price = nav; });
            latestDate = d.date || latestDate;
            updated++;
          }
        })
        .catch(function () { /* offline / blocked — keep snapshot value */ })
        .then(function () { if (--pending === 0) finishRefresh(btn, updated, latestDate); });
    });
  }
  function finishRefresh(btn, updated, date) {
    _refreshing = false;
    if (btn) { btn.disabled = false; btn.textContent = "↻ Refresh NAVs"; }
    if (updated > 0) {
      if (D.dataSource) { D.dataSource.live = true; if (date) D.dataSource.asOf = isoDate(date); }
      audit("data", "Live NAV refresh from AMFI (mfapi.in): " + updated + " scheme(s) updated.");
      renderDashboard();
      if (isActive("analytics")) renderAnalytics();
      if (isActive("invest")) renderInvest();
      if (isActive("discover")) paintDiscover();
      toast("Live NAVs updated from AMFI — " + updated + " scheme(s).", "success");
    } else {
      toast("Could not reach AMFI feed — showing last snapshot.", "warn");
    }
  }
  function isoDate(dmy) {
    // mfapi returns dd-mm-yyyy → yyyy-mm-dd
    var m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dmy || "");
    return m ? m[3] + "-" + m[2] + "-" + m[1] : dmy;
  }

  function renderAnalytics() {
    renderHealth();
    renderSectorBars($("sector-bars"));
    // concentration card
    var cc = $("concentration-card");
    if (cc) {
      var fp = financialsPct(), ti = topIssuer();
      var statusF = fp > 30 ? "serious" : fp > 20 ? "warn" : "good";
      cc.innerHTML = '<h3 style="margin:0 0 8px;">Concentration</h3>' +
        row("Top sector — Financials", fp.toFixed(1) + "%", statusF) +
        row("Top issuer — " + esc(ti.name), ti.pct.toFixed(1) + "%", ti.pct > 15 ? "warn" : "good") +
        '<p style="font-size:12px;color:var(--ink-muted);margin:8px 0 0;">A single-sector weight above 30% or one issuer above 15% raises drawdown risk.</p>';
    }
    // overlap card
    var oc = $("overlap-card");
    if (oc) {
      var ov = mfOverlap();
      if (ov) {
        oc.innerHTML = '<h3 style="margin:0 0 8px;">MF overlap</h3>' +
          '<div style="font-size:13px;">' + esc(ov.a.name.split(" —")[0]) + " &amp; " + esc(ov.b.name.split(" —")[0]) + "</div>" +
          row("Portfolio overlap", ov.pct + "%", ov.pct >= 60 ? "warn" : "good") +
          '<div style="font-size:12px;color:var(--ink-2);margin-top:6px;">Common holdings: ' + ov.common.map(function (c) { return esc(c.name); }).join(", ") + "</div>";
      } else { oc.innerHTML = '<h3 style="margin:0 0 8px;">MF overlap</h3><p style="color:var(--ink-muted);">Fewer than two look-through funds.</p>'; }
    }
    // risk gauge
    var rc = $("risk-score-card");
    if (rc) {
      var sc = state.riskScore != null ? scoreToGauge(state.riskScore) : 50;
      var lbl = state.riskProfile ? cap(state.riskProfile) : "Not profiled";
      rc.innerHTML = '<h3 style="margin:0 0 4px;">Portfolio risk</h3><div id="gauge-inner"></div>';
      renderGauge($("gauge-inner"), sc, lbl);
      if (!state.riskProfile) rc.innerHTML += '<button class="btn-ghost" data-go="profile" style="margin-top:6px;">Take the risk quiz →</button>';
      var b = rc.querySelector("[data-go]"); if (b) b.addEventListener("click", function () { switchPanel("profile"); });
    }
    // asset mix vs suggested
    var am = $("asset-mix-card");
    if (am) { am.innerHTML = '<h3 style="margin:0 0 8px;">Your mix vs suggested</h3><div id="mix-inner"></div>'; renderMixBars($("mix-inner")); }
  }
  function row(label, value, status) {
    return '<div class="stat-row" style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--hairline);">' +
      '<span style="font-size:13px;color:var(--ink-2);">' + label + "</span>" +
      '<b class="badge-' + status + '" style="font-variant-numeric:tabular-nums;">' + value + "</b></div>";
  }
  function scoreToGauge(raw) {
    // riskQuiz raw score range 6..24 → 0..100
    var min = 6, max = 24;
    return Math.round((raw - min) / (max - min) * 100);
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* -------------------------------------------------------------- learn */
  function renderLearnProgress() {
    var host = $("learn-progress"); if (!host) return;
    var lessons = D.lessons || [];
    var done = lessons.filter(function (l) { return state.completedLessons.indexOf(l.id) >= 0; });
    var next = lessons.filter(function (l) { return state.completedLessons.indexOf(l.id) < 0; })[0];
    var unlocked = (D.products || []).filter(function (p) {
      return p.registered && p.requiredLesson && state.completedLessons.indexOf(p.requiredLesson) >= 0;
    }).length;
    var pctDone = lessons.length ? done.length / lessons.length * 100 : 0;
    host.innerHTML =
      '<div class="learn-progress-head"><div><h3 style="margin:0;">Your learning path</h3>' +
      '<p style="margin:2px 0 0;font-size:12.5px;color:var(--ink-muted);">Each completed lesson unlocks its product category in Invest.</p></div>' +
      '<b style="font-variant-numeric:tabular-nums;">' + done.length + " / " + lessons.length + "</b></div>" +
      '<div class="health-track" style="margin:10px 0 8px;"><span style="width:' + pctDone.toFixed(0) + '%;background:var(--accent);"></span></div>' +
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:12.5px;color:var(--ink-2);">' +
      "<span>" + unlocked + " product" + (unlocked === 1 ? "" : "s") + " unlocked so far</span>" +
      (next ? '<a href="#" data-lesson-link="' + next.id + '" style="color:var(--accent);">Next: ' + esc(next.title) + " (" + next.minutes + " min) →</a>"
            : '<span style="color:var(--good);">✓ All lessons complete</span>') + "</div>";
  }
  function renderGlossary() {
    var host = $("glossary-card"); if (!host) return;
    var terms = D.glossary || [];
    if (!terms.length) { host.innerHTML = ""; return; }
    host.innerHTML = '<h3 style="margin:0 0 4px;">Jargon buster</h3>' +
      '<p style="margin:0 0 10px;font-size:12.5px;color:var(--ink-muted);">' + terms.length + ' terms, in plain language. The copilot answers these too — try “what is NAV?”.</p>' +
      '<input id="glossary-search" class="chat-input" type="search" placeholder="Search a term — NAV, NCD, drawdown…" aria-label="Search glossary" style="width:100%;margin-bottom:10px;">' +
      '<div id="glossary-list"></div>';
    var list = $("glossary-list"), input = $("glossary-search");
    function paint(filter) {
      var f = (filter || "").toLowerCase();
      var hits = terms.filter(function (t) {
        return !f || t.term.toLowerCase().indexOf(f) >= 0 || t.def.toLowerCase().indexOf(f) >= 0;
      });
      list.innerHTML = hits.length ? hits.map(function (t) {
        return '<div class="glossary-row"><b>' + esc(t.term) + "</b><p>" + esc(t.def) + "</p></div>";
      }).join("") : '<p style="color:var(--ink-muted);font-size:13px;">No match — ask the copilot instead.</p>';
    }
    paint("");
    if (input) input.addEventListener("input", function () { paint(input.value); });
  }
  function renderLearn() {
    renderLearnProgress();
    renderGlossary();
    var host = $("lesson-grid"); if (!host) return;
    host.innerHTML = (D.lessons || []).map(function (l) {
      var done = state.completedLessons.indexOf(l.id) >= 0;
      return '<button class="lesson-card" data-lesson-id="' + l.id + '" style="text-align:left;cursor:pointer;">' +
        '<div style="font-size:26px;">' + l.emoji + "</div>" +
        '<div style="font-weight:600;margin-top:4px;">' + esc(l.title) + "</div>" +
        '<div style="font-size:11px;color:var(--ink-muted);">' + l.minutes + " min &middot; " + l.quiz.length + " questions</div>" +
        '<div class="lesson-status" style="margin-top:6px;font-size:12px;color:' + (done ? "var(--good)" : "var(--ink-muted)") + ';">' + (done ? "✓ Completed" : "Not started") + "</div></button>";
    }).join("");
    Array.prototype.forEach.call(host.querySelectorAll("[data-lesson-id]"), function (n) {
      n.addEventListener("click", function () { openLesson(n.getAttribute("data-lesson-id")); });
    });
  }

  function openLesson(id) {
    var l = (D.lessons || []).filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    var secHtml = l.sections.map(function (s) {
      return '<div style="margin-bottom:12px;"><h4 style="margin:0 0 4px;">' + esc(s.h) + "</h4><p style=\"margin:0;color:var(--ink-2);font-size:13px;line-height:1.5;\">" + esc(s.p) + "</p></div>";
    }).join("");
    var quizHtml = l.quiz.map(function (q, qi) {
      var opts = q.options.map(function (o, oi) {
        return '<label style="display:block;padding:6px 8px;border:1px solid var(--hairline);border-radius:6px;margin:4px 0;cursor:pointer;font-size:13px;">' +
          '<input type="radio" name="q' + qi + '" value="' + oi + '" style="margin-right:8px;">' + esc(o) + "</label>";
      }).join("");
      return '<div class="quiz-q" data-answer="' + q.answer + '" style="margin-bottom:10px;"><div style="font-weight:600;font-size:13px;margin-bottom:2px;">' + (qi + 1) + ". " + esc(q.q) + "</div>" + opts + "</div>";
    }).join("");
    var body = '<div class="lesson-modal"><div style="font-size:28px;">' + l.emoji + '</div><h2 style="margin:2px 0 10px;">' + esc(l.title) + "</h2>" +
      secHtml +
      '<hr style="border:none;border-top:1px solid var(--hairline);margin:12px 0;">' +
      '<h3 style="margin:0 0 8px;">Quick check (' + l.quiz.length + " questions)</h3>" + quizHtml +
      '<div id="quiz-result" style="font-size:13px;margin:8px 0;"></div>' +
      '<div style="display:flex;gap:8px;margin-top:8px;"><button id="quiz-submit" class="btn-primary">Submit quiz</button><button id="quiz-close" class="btn-ghost">Close</button></div></div>';
    openModal(body);
    var sb = $("quiz-submit"), cb = $("quiz-close");
    if (cb) cb.addEventListener("click", closeModal);
    if (sb) sb.addEventListener("click", function () { gradeLesson(l); });
  }

  function gradeLesson(l) {
    var qs = document.querySelectorAll("#modal-root .quiz-q");
    var correct = 0, answered = 0;
    Array.prototype.forEach.call(qs, function (q) {
      var picked = q.querySelector("input:checked");
      if (picked) { answered++; if (parseInt(picked.value, 10) === parseInt(q.getAttribute("data-answer"), 10)) correct++; }
    });
    var res = $("quiz-result");
    if (answered < l.quiz.length) { if (res) res.innerHTML = '<span style="color:var(--warn);">Please answer all ' + l.quiz.length + " questions.</span>"; return; }
    var passed = correct >= 2;
    if (res) res.innerHTML = passed
      ? '<span style="color:var(--good);">✓ ' + correct + "/" + l.quiz.length + " correct — lesson complete!</span>"
      : '<span style="color:var(--critical);">' + correct + "/" + l.quiz.length + " correct — review and try again (need 2).</span>";
    if (passed && state.completedLessons.indexOf(l.id) < 0) {
      state.completedLessons.push(l.id); save("completedLessons");
      audit("lesson", "Completed lesson “" + l.title + "” (" + correct + "/" + l.quiz.length + ") — unlocked related products.");
      window.dispatchEvent(new CustomEvent("niveshos:lesson-complete", { detail: { lesson: l.id } }));
      toast("Lesson complete: " + l.title + " — products unlocked");
      renderLearn(); if (isActive("invest")) renderInvest();
      var sb = $("quiz-submit"); if (sb) { sb.textContent = "Done"; sb.onclick = closeModal; }
    }
  }

  /* -------------------------------------------------------------- profile */
  var quizPos = 0, quizAnswers = [];
  function renderProfile() {
    var host = $("risk-quiz");
    if (state.riskProfile) {
      // returning user: show completed state + result (with retake button)
      if (host) host.innerHTML = '<div style="font-size:13px;color:var(--ink-2);">✓ You\'ve completed the risk quiz. Your result is on the right — retake anytime.</div>';
      renderRiskResult();
    } else {
      quizPos = 0; quizAnswers = [];
      renderQuizStep();
      var rr = $("risk-result"); if (rr) rr.innerHTML = '<div style="color:var(--ink-muted);font-size:13px;">Answer the questions to see your profile.</div>';
    }
  }
  function renderQuizStep() {
    var host = $("risk-quiz"); if (!host) return;
    var qz = D.riskQuiz || [];
    if (quizPos >= qz.length) { host.innerHTML = '<div style="font-size:13px;color:var(--good);">✓ Quiz complete — see your profile.</div>'; computeRisk(); return; }
    var q = qz[quizPos];
    var progress = Math.round(quizPos / qz.length * 100);
    host.innerHTML = '<div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:' + progress + '%;"></div></div>' +
      '<div style="font-size:12px;color:var(--ink-muted);margin-top:8px;">Question ' + (quizPos + 1) + " of " + qz.length + "</div>" +
      '<h3 style="margin:4px 0 12px;">' + esc(q.q) + "</h3>" +
      q.options.map(function (o) {
        return '<button class="quiz-option" data-w="' + o.w + '">' + esc(o.t) + "</button>";
      }).join("");
    Array.prototype.forEach.call(host.querySelectorAll(".quiz-option"), function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(host.querySelectorAll(".quiz-option"), function (x) { x.classList.remove("selected"); });
        b.classList.add("selected");
        quizAnswers.push(parseInt(b.getAttribute("data-w"), 10));
        setTimeout(function () { quizPos++; renderQuizStep(); }, 140);
      });
    });
  }
  function computeRisk() {
    var raw = quizAnswers.reduce(function (a, b) { return a + b; }, 0);
    var tier = raw <= 10 ? "conservative" : raw <= 17 ? "balanced" : "aggressive";
    state.riskScore = raw; state.riskProfile = tier; save("riskScore"); save("riskProfile");
    if (D.investor) D.investor.riskProfile = tier;
    audit("risk", "Risk profile assessed: " + cap(tier) + " (score " + raw + ").");
    renderRiskResult();
    if (isActive("invest")) renderInvest();
    if (isActive("analytics")) renderAnalytics();
  }
  function renderRiskResult() {
    var rr = $("risk-result"); if (!rr) return;
    var tier = state.riskProfile, raw = state.riskScore;
    var unlocks = { conservative: "T-Bills, SGB, AAA bonds, index funds", balanced: "+ REITs, InvITs, higher-yield bonds", aggressive: "the full multi-asset catalogue" };
    rr.innerHTML = '<div class="risk-result-card"><div style="font-size:12px;color:var(--ink-muted);">Your profile</div>' +
      '<div style="font-size:1.8rem;font-weight:700;">' + cap(tier) + "</div>" +
      '<div style="font-size:13px;color:var(--ink-2);">Score ' + raw + " — unlocks " + unlocks[tier] + ".</div>" +
      '<div id="mix-result" style="margin-top:10px;"></div>' +
      '<button id="retake-quiz" class="btn-ghost" style="margin-top:8px;">Retake quiz</button></div>';
    renderMixBars($("mix-result"));
    var rb = $("retake-quiz"); if (rb) rb.addEventListener("click", function () { quizPos = 0; quizAnswers = []; renderQuizStep(); });
  }

  /* -------------------------------------------------------------- invest */
  var TIER_RANK = { conservative: 1, balanced: 2, aggressive: 3 };
  function suitability(p) {
    if (!p.registered) return { ok: false, gate: "registry", reason: "Not SEBI-registered — blocked for your protection.", link: "trust" };
    if (!state.riskProfile) return { ok: false, gate: "profile", reason: "Complete your risk profile first.", link: "profile" };
    if (TIER_RANK[state.riskProfile] < TIER_RANK[p.minTier]) return { ok: false, gate: "tier", reason: "Needs a " + cap(p.minTier) + " profile (you are " + cap(state.riskProfile) + ").", link: "profile" };
    if (p.requiredLesson && state.completedLessons.indexOf(p.requiredLesson) < 0) {
      var ln = (D.lessons || []).filter(function (x) { return x.id === p.requiredLesson; })[0];
      return { ok: false, gate: "lesson", reason: "Finish the “" + (ln ? ln.title : p.requiredLesson) + "” lesson to unlock.", link: "learn" };
    }
    return { ok: true, gate: null, reason: "Suitable for your profile.", link: null };
  }
  function suitableProducts() {
    return (D.products || []).filter(function (p) { return suitability(p).ok; });
  }

  function gradeBadge(g) {
    return '<span class="risk-grade-badge grade-' + String(g).toLowerCase() + '">' + esc(g) + "</span>";
  }
  function nutriRow(label, valHtml) {
    return '<div class="nutrition-row"><span>' + esc(label) + "</span>" + valHtml + "</div>";
  }
  function nutritionLabel(p) {
    return '<div class="nutrition-label">' +
      nutriRow("Risk grade", gradeBadge(p.riskGrade)) +
      nutriRow("Liquidity", "<b>" + esc(p.liquidity) + "</b>") +
      nutriRow("Complexity", "<b>" + ("●".repeat(p.complexity) + "○".repeat(3 - p.complexity)) + "</b>") +
      nutriRow("Min invest", "<b>" + fmt(p.minInvest) + "</b>") +
      nutriRow("Yield / return", "<b>" + esc(p.yieldOrReturn) + "</b>") +
      nutriRow("Issuer rating", "<b>" + esc(p.issuerRating) + "</b>") + "</div>";
  }
  function renderSuitabilityBanner() {
    var host = $("suitability-banner"); if (!host) return;
    if (state.riskProfile) {
      host.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">' +
        "<span>Profile: <b>" + cap(state.riskProfile) + "</b> — " + suitableProducts().length + " of " + (D.products || []).length + " products suitable.</span>" +
        '<button id="sb-retake" class="btn-ghost">Retake quiz</button></div>';
      var b = $("sb-retake"); if (b) b.addEventListener("click", function () { switchPanel("profile"); });
    } else {
      host.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">' +
        "<span>No risk profile yet — take the 6-question quiz to see what's suitable.</span>" +
        '<button id="sb-take" class="btn-primary">Take risk quiz →</button></div>';
      var t = $("sb-take"); if (t) t.addEventListener("click", function () { switchPanel("profile"); });
    }
  }
  function renderInvest() {
    renderSuitabilityBanner();
    var host = $("product-grid"); if (!host) return;
    host.innerHTML = (D.products || []).map(function (p) {
      var s = suitability(p);
      var chip = '<span class="cat-chip" style="background:var(--surface-2);border:1px solid var(--hairline);border-radius:6px;padding:1px 7px;font-size:11px;">' + esc(p.category) + "</span>";
      var badge = p.registered
        ? '<span class="sebi-badge" style="color:var(--good);font-size:11px;">✓ SEBI-registered</span>'
        : '<span class="blocked-banner" style="color:var(--critical);font-weight:700;font-size:11px;">⛔ BLOCKED — UNREGISTERED</span>';
      var gate = s.ok
        ? '<div class="suit-ok" style="color:var(--good);font-size:12px;margin-top:6px;">✓ ' + esc(s.reason) + "</div>"
        : '<div class="suit-blocked" style="color:var(--serious);font-size:12px;margin-top:6px;">🔒 ' + esc(s.reason) + "</div>";
      return '<div class="product-card" data-product="' + p.id + '" style="cursor:pointer;">' +
        '<div style="display:flex;justify-content:space-between;align-items:start;gap:8px;"><div style="font-weight:600;">' + esc(p.name) + "</div>" + gradeBadge(p.riskGrade) + "</div>" +
        '<div style="margin:4px 0;">' + chip + " " + badge + "</div>" +
        '<div style="font-size:12px;color:var(--ink-2);">' + esc(p.yieldOrReturn) + " &middot; Min " + fmt(p.minInvest) + "</div>" +
        gate + "</div>";
    }).join("");
    Array.prototype.forEach.call(host.querySelectorAll("[data-product]"), function (n) {
      n.addEventListener("click", function () { openProduct(n.getAttribute("data-product")); });
    });
  }

  function openProduct(idOrProduct) {
    // Accepts a catalogue id (Invest panel) OR a ready product-shaped object
    // (Discover synthesises these for stocks/MFs/gold that aren't in the
    // catalogue) so the whole details + suitability + order flow is reused.
    var p = (idOrProduct && typeof idOrProduct === "object")
      ? idOrProduct
      : (D.products || []).filter(function (x) { return x.id === idOrProduct; })[0];
    if (!p) return;
    var s = suitability(p);
    var action;
    if (s.ok) {
      action = '<div style="margin-top:12px;"><label style="font-size:12px;color:var(--ink-muted);">Amount to invest (min ' + fmt(p.minInvest) + ')</label>' +
        '<input id="invest-amt" type="number" min="' + p.minInvest + '" value="' + p.minInvest + '" style="display:block;width:100%;padding:8px;margin:4px 0;border:1px solid var(--hairline);border-radius:6px;background:var(--surface-2);color:var(--ink);">' +
        '<button id="invest-go" class="btn-primary" style="width:100%;">Route order via ' + esc(defaultBroker()) + "</button></div>";
    } else {
      action = '<div class="blocked-box" style="margin-top:12px;border:1px solid var(--hairline);border-radius:8px;padding:10px;">' +
        '<div style="color:var(--serious);font-weight:600;">🔒 ' + esc(s.reason) + "</div>" +
        (s.link ? '<button id="invest-fix" class="btn-primary" style="margin-top:8px;">Go fix this →</button>' : "") + "</div>";
    }
    var body = '<div class="product-modal"><div style="display:flex;justify-content:space-between;align-items:start;gap:8px;">' +
      '<h2 style="margin:0;">' + esc(p.name) + "</h2>" + gradeBadge(p.riskGrade) + "</div>" +
      '<div style="margin:6px 0;color:var(--ink-muted);font-size:12px;">' + esc(p.category) + "</div>" +
      '<p style="font-size:13px;color:var(--ink-2);line-height:1.5;">' + esc(p.blurb) + "</p>" +
      nutritionLabel(p) + action +
      '<div id="order-progress" style="margin-top:12px;"></div>' +
      '<button id="prod-close" class="btn-ghost" style="margin-top:10px;">Close</button></div>';
    openModal(body);
    audit("suitability", "Suitability check on “" + p.name + "” — " + (s.ok ? "PASS" : "BLOCKED (" + s.gate + ")") + ".");
    if (!p.registered) audit("warning", "Unregistered-scheme warning shown for “" + p.name + "”.");
    var cl = $("prod-close"); if (cl) cl.addEventListener("click", closeModal);
    var go = $("invest-go"); if (go) go.addEventListener("click", function () { routeOrder(p); });
    var fx = $("invest-fix"); if (fx) fx.addEventListener("click", function () { closeModal(); switchPanel(s.link); });
  }
  function defaultBroker() {
    var a = (D.accounts || [])[0];
    return a ? a.broker : "your broker";
  }

  function routeOrder(p) {
    var amtEl = $("invest-amt");
    var amt = amtEl ? parseFloat(amtEl.value) : p.minInvest;
    if (!amt || amt < p.minInvest) { toast("Minimum investment is " + fmt(p.minInvest)); return; }
    var prog = $("order-progress"); var go = $("invest-go"); if (go) go.disabled = true;
    var steps = ["Order created", "Sent to " + defaultBroker(), "Confirmed ✓"];
    var i = 0;
    function draw() {
      if (!prog) return;
      prog.innerHTML = steps.map(function (s, si) {
        var stFmt = si < i ? "var(--good)" : si === i ? "var(--accent)" : "var(--ink-muted)";
        var mark = si < i ? "✓" : si === i ? "●" : "○";
        return '<div style="display:flex;gap:8px;padding:3px 0;color:' + stFmt + ';font-size:13px;"><span>' + mark + "</span>" + esc(s) + "</div>";
      }).join("");
    }
    draw();
    var timer = setInterval(function () {
      i++;
      draw();
      if (i >= steps.length) {
        clearInterval(timer);
        commitPurchase(p, amt);
        if (prog) prog.innerHTML += '<div style="color:var(--good);margin-top:6px;font-weight:600;">Added to your portfolio.</div>';
      }
    }, 750);
  }
  function commitPurchase(p, amt) {
    var qty = p.price ? Math.max(1, Math.round(amt / p.price)) : 1;
    var sectorMap = { reit: "Real Estate", invit: "Infrastructure", bond: "Financials", mf: "Diversified", etf: "Commodities" };
    var holding = {
      id: "buy_" + Date.now(), accountId: (D.accounts[0] || {}).id,
      symbol: p.symbol || p.id.replace("p_", "").toUpperCase(), name: p.name,
      assetClass: p.assetClass === "scam" ? "bond" : p.assetClass,
      sector: p.sector || sectorMap[p.assetClass] || "Other",
      qty: qty, avgPrice: p.price || amt, ltp: p.price || amt, dayChangePct: 0
    };
    state.purchases.push(holding); save("purchases");
    audit("order", "Order confirmed: " + fmt(amt) + " in “" + p.name + "” via " + defaultBroker() + " (" + qty + " units).");
    toast("Order confirmed — " + p.name);
    renderDashboard(); renderAnalytics(); renderInvest();
    if (isActive("discover")) paintDiscover();
  }

  /* ============================================================ DISCOVER
     Investment Discovery Marketplace. Reuses the whole product engine:
     catalogue `products` carry a real invest flow already; stocks / non-index
     MFs / gold ETFs are pulled (deduped) from every persona's holdings and
     wrapped as product-shaped objects so openProduct/suitability/routeOrder
     work on them unchanged. Prices/NAVs read live from the same D.products /
     D.holdings the Yahoo + AMFI pipeline populates, so a NAV refresh re-prices
     these cards too. */
  var DISCOVER_CATS = [
    { key: "stocks", label: "Stocks" },
    { key: "mf", label: "Mutual Funds" },
    { key: "reits", label: "REITs" },
    { key: "invits", label: "InvITs" },
    { key: "gold", label: "Gold ETFs" },
    { key: "index", label: "Index Funds" },
    { key: "cbonds", label: "Corporate Bonds" },
    { key: "gsec", label: "Government Securities" }
  ];
  // catalogue product.category → marketplace category key
  var PRODUCT_CAT = {
    "REIT": "reits", "InvIT": "invits", "Corporate Bond": "cbonds",
    "Index Fund": "index", "Sovereign Gold Bond": "gsec", "Treasury Bill": "gsec"
  };
  var RISK_LEVELS = ["Low", "Medium", "High", "Very High"];
  var GRADE_RISK = { A: "Low", B: "Medium", C: "High", D: "High", E: "Very High" };
  var CLASS_RISK = { equity: "High", mf: "Medium", etf: "Medium" };

  // discover UI state (kept across panel switches, reset on reload/logout)
  var discSearch = "", discRisk = "all", discCat = "all";
  var discCompare = {};      // key → instrument, current compare selection
  var _discIndex = {};       // key → instrument, for the current painted grid
  var _discLoaded = false;   // show the loading state only on first entry

  function catLabelOf(key) {
    var c = DISCOVER_CATS.filter(function (x) { return x.key === key; })[0];
    return c ? c.label : key;
  }
  function riskOf(grade, assetClass) {
    if (grade && GRADE_RISK[grade]) return GRADE_RISK[grade];
    return CLASS_RISK[assetClass] || "Medium";
  }
  function holdingCat(h) {
    if (h.assetClass === "equity") return "stocks";
    if (h.assetClass === "etf") return "gold";
    if (h.assetClass === "mf") {
      return (String(h.schemeCode) === "120716" || /index|nifty|sensex/i.test(h.name)) ? "index" : "mf";
    }
    return null; // bonds / reits / invits are already covered by the catalogue
  }
  function holdingDesc(h) {
    if (h.assetClass === "equity") return (h.sector || "Listed") + " sector · exchange-listed equity share.";
    if (h.assetClass === "etf") return "Exchange-traded fund backed by physical gold, held in demat.";
    if (h.assetClass === "mf") return "Diversified " + (h.sector || "equity").toLowerCase() + " mutual fund — priced at daily NAV.";
    return h.name;
  }
  // wrap a holding as a catalogue-shaped product so the invest engine accepts it
  function synthProduct(h, cat) {
    return {
      id: "disc_" + h.symbol, symbol: h.symbol, name: h.name,
      category: catLabelOf(cat), assetClass: h.assetClass, sector: h.sector,
      schemeCode: h.schemeCode || null,
      riskGrade: h.assetClass === "equity" ? "C" : "B",
      liquidity: "High", complexity: 1,
      minInvest: Math.max(100, Math.round(h.ltp || 100)),
      price: h.ltp,
      yieldOrReturn: h.assetClass === "equity" ? "Market-linked returns"
        : h.assetClass === "etf" ? "Tracks the gold price" : "Market-linked (daily NAV)",
      issuerRating: "NA", registered: true, requiredLesson: null, minTier: "conservative",
      blurb: holdingDesc(h)
    };
  }
  function buildDiscoverUniverse() {
    var out = [], seen = {}, prodKeys = {};
    (D.products || []).forEach(function (p) {
      if (p.schemeCode) prodKeys["sc:" + p.schemeCode] = 1;
      if (p.quoteSym) prodKeys["sy:" + p.quoteSym] = 1;
      var cat = PRODUCT_CAT[p.category];
      if (!cat) return; // unregistered scam / anything unmapped stays out of Discover
      var k = "p:" + p.id;
      seen[k] = 1;
      out.push({
        key: k, name: p.name, cat: cat, catLabel: catLabelOf(cat),
        assetClass: p.assetClass, price: p.price, dayChangePct: null,
        risk: riskOf(p.riskGrade), desc: p.blurb, yield: p.yieldOrReturn, product: p
      });
    });
    (D.users || []).forEach(function (u) {
      (u.holdings || []).forEach(function (h) {
        var cat = holdingCat(h);
        if (!cat) return;
        if (prodKeys["sc:" + h.schemeCode] || prodKeys["sy:" + h.symbol]) return; // already catalogued
        var k = "h:" + h.symbol;
        if (seen[k]) return; // dedupe the same instrument across personas
        seen[k] = 1;
        out.push({
          key: k, name: h.name, cat: cat, catLabel: catLabelOf(cat),
          assetClass: h.assetClass, price: h.ltp, dayChangePct: h.dayChangePct,
          risk: riskOf(null, h.assetClass), desc: holdingDesc(h),
          yield: null, product: synthProduct(h, cat)
        });
      });
    });
    return out;
  }

  function matchesDiscover(inst) {
    if (discCat !== "all" && inst.cat !== discCat) return false;
    if (discRisk !== "all" && inst.risk !== discRisk) return false;
    if (discSearch) {
      var q = discSearch.toLowerCase();
      if ((inst.name + " " + inst.catLabel + " " + inst.desc).toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  }

  function renderDiscover() {
    renderDiscoverToolbar();
    renderDiscoverCats();
    renderCompareBar();
    if (!_discLoaded) {
      paintDiscoverLoading();
      _discLoaded = true;
      setTimeout(paintDiscover, 260); // brief, honest loading state on first open
    } else {
      paintDiscover();
    }
  }

  function renderDiscoverToolbar() {
    // Rebuilt only on panel entry (not on each keystroke) so the search field
    // keeps focus while typing — the input handler repaints the grid alone.
    var host = $("discover-toolbar"); if (!host) return;
    host.innerHTML = '<div class="disc-tools">' +
      '<input id="disc-search" class="chat-input disc-search" type="search" ' +
        'placeholder="Search instruments — HDFC, Nifty, gold…" aria-label="Search instruments" value="' + esc(discSearch) + '">' +
      '<label class="disc-risk-filter">Risk ' +
        '<select id="disc-risk" class="tv-select" aria-label="Filter by risk level">' +
          '<option value="all"' + (discRisk === "all" ? " selected" : "") + '>All levels</option>' +
          RISK_LEVELS.map(function (r) {
            return '<option value="' + r + '"' + (discRisk === r ? " selected" : "") + '>' + r + "</option>";
          }).join("") +
        "</select></label></div>";
    var s = $("disc-search");
    if (s) s.addEventListener("input", function () { discSearch = s.value; paintDiscover(); });
    var rf = $("disc-risk");
    if (rf) rf.addEventListener("change", function () { discRisk = rf.value; paintDiscover(); });
  }

  function renderDiscoverCats() {
    var host = $("discover-categories"); if (!host) return;
    var chips = '<button class="chip category disc-cat' + (discCat === "all" ? " active" : "") +
      '" data-cat="all" type="button">All</button>';
    DISCOVER_CATS.forEach(function (c) {
      chips += '<button class="chip category disc-cat' + (discCat === c.key ? " active" : "") +
        '" data-cat="' + c.key + '" type="button">' + esc(c.label) + "</button>";
    });
    host.innerHTML = chips;
    Array.prototype.forEach.call(host.querySelectorAll(".disc-cat"), function (b) {
      b.addEventListener("click", function () {
        discCat = b.getAttribute("data-cat");
        renderDiscoverCats(); paintDiscover();
      });
    });
  }

  function paintDiscoverLoading() {
    var host = $("discover-grid"); if (!host) return;
    var sk = "";
    for (var i = 0; i < 6; i++) {
      sk += '<div class="product-card disc-skel" aria-hidden="true">' +
        '<div class="skel-line w60"></div><div class="skel-line w35"></div>' +
        '<div class="skel-line w90"></div><div class="skel-line w80"></div>' +
        '<div class="skel-actions"><span class="skel-btn"></span><span class="skel-btn"></span></div></div>';
    }
    host.innerHTML = sk;
  }

  function discoverStateHTML(kind) {
    if (kind === "error") {
      return '<div class="disc-state"><div class="disc-state-icon">⚠</div>' +
        "<h3>Couldn't load the marketplace</h3>" +
        "<p>Instrument data is unavailable right now. Please try again.</p>" +
        '<button id="disc-retry" class="btn btn-primary" type="button">Retry</button></div>';
    }
    return '<div class="disc-state"><div class="disc-state-icon">🔍</div>' +
      "<h3>No instruments match</h3>" +
      "<p>Try a different category, risk level or search term.</p>" +
      '<button id="disc-reset" class="btn btn-ghost" type="button">Clear filters</button></div>';
  }

  function paintDiscover() {
    var host = $("discover-grid"); if (!host) return;
    var all;
    try {
      all = buildDiscoverUniverse();
    } catch (e) {
      host.innerHTML = discoverStateHTML("error");
      var rb = $("disc-retry");
      if (rb) rb.addEventListener("click", function () { _discLoaded = false; renderDiscover(); });
      return;
    }
    if (!all || !all.length) {
      host.innerHTML = discoverStateHTML("error");
      var rb2 = $("disc-retry");
      if (rb2) rb2.addEventListener("click", function () { _discLoaded = false; renderDiscover(); });
      return;
    }
    var filtered = all.filter(matchesDiscover);
    if (!filtered.length) {
      host.innerHTML = discoverStateHTML("empty");
      var rs = $("disc-reset");
      if (rs) rs.addEventListener("click", function () {
        discSearch = ""; discRisk = "all"; discCat = "all";
        renderDiscoverToolbar(); renderDiscoverCats(); paintDiscover();
      });
      return;
    }
    _discIndex = {};
    filtered.forEach(function (f) { _discIndex[f.key] = f; });
    host.innerHTML = filtered.map(discoverCard).join("");
    wireDiscoverCards(host);
  }

  function discoverCard(inst) {
    var day = inst.dayChangePct == null
      ? '<span class="disc-day neutral">—</span>'
      : '<span class="disc-day ' + cls_dir(inst.dayChangePct) + '" style="color:' + dirColor(inst.dayChangePct) + ';">' + pct(inst.dayChangePct) + "</span>";
    var priceLbl = inst.assetClass === "mf" ? "NAV" : "Price";
    var riskCls = "risk-" + inst.risk.toLowerCase().replace(/\s+/g, "-");
    var checked = discCompare[inst.key] ? " checked" : "";
    return '<div class="product-card discover-card" data-key="' + esc(inst.key) + '">' +
      '<div class="disc-card-head">' +
        '<div><div class="product-name">' + esc(inst.name) + "</div>" +
        '<div class="disc-type">' + esc(inst.catLabel) + "</div></div>" +
        '<span class="disc-risk ' + riskCls + '">' + esc(inst.risk) + "</span>" +
      "</div>" +
      '<div class="disc-price-row">' +
        '<div><span class="disc-price">' + fmt(inst.price) + '</span> <span class="disc-price-lbl">' + priceLbl + "</span></div>" +
        day +
      "</div>" +
      '<p class="disc-desc">' + esc(inst.desc) + "</p>" +
      '<div class="disc-actions">' +
        '<button class="btn btn-ghost disc-details" type="button">View Details</button>' +
        '<label class="disc-compare-toggle"><input type="checkbox" class="disc-compare-cb"' + checked + '> Compare</label>' +
        '<button class="btn btn-primary disc-invest" type="button">Invest</button>' +
      "</div></div>";
  }

  function wireDiscoverCards(host) {
    Array.prototype.forEach.call(host.querySelectorAll(".discover-card"), function (card) {
      var inst = _discIndex[card.getAttribute("data-key")];
      if (!inst) return;
      var det = card.querySelector(".disc-details");
      var inv = card.querySelector(".disc-invest");
      var cb = card.querySelector(".disc-compare-cb");
      if (det) det.addEventListener("click", function () { openProduct(inst.product); });
      if (inv) inv.addEventListener("click", function () { openProduct(inst.product); });
      if (cb) cb.addEventListener("change", function () {
        if (cb.checked) discCompare[inst.key] = inst; else delete discCompare[inst.key];
        renderCompareBar();
      });
    });
  }

  function renderCompareBar() {
    var bar = $("discover-compare-bar"); if (!bar) return;
    var keys = Object.keys(discCompare);
    if (!keys.length) { bar.hidden = true; bar.innerHTML = ""; return; }
    bar.hidden = false;
    bar.innerHTML = '<span class="cmp-count">' + keys.length + " selected to compare</span>" +
      '<div class="cmp-actions">' +
        '<button id="disc-cmp-clear" class="btn btn-ghost" type="button">Clear</button>' +
        '<button id="disc-cmp-go" class="btn btn-primary" type="button"' + (keys.length < 2 ? " disabled" : "") + ">Compare " + keys.length + "</button>" +
      "</div>";
    var c = $("disc-cmp-clear");
    if (c) c.addEventListener("click", function () { discCompare = {}; renderCompareBar(); paintDiscover(); });
    var g = $("disc-cmp-go");
    if (g) g.addEventListener("click", openCompareModal);
  }

  function openCompareModal() {
    // Re-resolve selections against a fresh universe by key so the table shows
    // current prices/NAVs (a NAV refresh may have repriced since selection),
    // falling back to the stored snapshot if a key is no longer present.
    var fresh = {};
    try { buildDiscoverUniverse().forEach(function (i) { fresh[i.key] = i; }); } catch (e) { /* keep snapshot */ }
    var items = Object.keys(discCompare).map(function (k) { return fresh[k] || discCompare[k]; });
    if (items.length < 2) return;
    var head = "<th>Metric</th>" + items.map(function (i) { return "<th>" + esc(i.name) + "</th>"; }).join("");
    function rowR(label, fn) {
      return "<tr><td><b>" + label + "</b></td>" + items.map(function (i) { return "<td>" + fn(i) + "</td>"; }).join("") + "</tr>";
    }
    var body = '<div class="compare-modal"><h2 style="margin:0 0 10px;">Compare instruments</h2>' +
      '<div class="compare-scroll"><table class="data-table compare-table">' +
      "<thead><tr>" + head + "</tr></thead><tbody>" +
      rowR("Category", function (i) { return esc(i.catLabel); }) +
      rowR("Price / NAV", function (i) { return fmt(i.price); }) +
      rowR("Daily change", function (i) { return i.dayChangePct == null ? "—" : '<span style="color:' + dirColor(i.dayChangePct) + ';">' + pct(i.dayChangePct) + "</span>"; }) +
      rowR("Risk level", function (i) { return esc(i.risk); }) +
      rowR("Yield / return", function (i) { return esc(i.yield || "—"); }) +
      rowR("Description", function (i) { return esc(i.desc); }) +
      "</tbody></table></div>" +
      '<button id="cmp-close" class="btn btn-ghost" style="margin-top:12px;">Close</button></div>';
    openModal(body);
    var cl = $("cmp-close"); if (cl) cl.addEventListener("click", closeModal);
  }

  /* -------------------------------------------------------------- copilot */
  var SUGGEST_CHIPS = [
    "How healthy is my portfolio?",
    "Why is my portfolio down today?",
    "Am I overexposed anywhere?",
    "Explain REITs simply",
    "What should I do with idle cash?",
    "Show my riskiest holding"
  ];
  var ADVICE_NOTE = '<div class="advice-note" style="font-size:11px;color:var(--ink-muted);margin-top:8px;border-top:1px solid var(--hairline);padding-top:6px;">ℹ Informational &amp; educational only, not investment advice (SEBI RIA boundary).</div>';

  function renderCopilot() {
    var chips = $("chat-suggestions");
    if (chips) {
      chips.innerHTML = SUGGEST_CHIPS.map(function (c) {
        return '<button class="chip" type="button">' + esc(c) + "</button>";
      }).join("");
      Array.prototype.forEach.call(chips.querySelectorAll(".chip"), function (b) {
        b.addEventListener("click", function () { sendChat(b.textContent); });
      });
    }
    var form = $("chat-form");
    if (form && !form._wired) {
      form._wired = true;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var inp = $("chat-input");
        if (inp && inp.value.trim()) { sendChat(inp.value.trim()); inp.value = ""; }
      });
    }
    var log = $("chat-log");
    if (log && !log._greeted) {
      log._greeted = true;
      var firstName = ((D.investor && D.investor.name) || "there").split(" ")[0];
      addMsg("assistant", "<b>Namaste, " + esc(firstName) + ".</b> I read your live portfolio. Ask me why you're down today, where you're overexposed, how healthy your portfolio is, or to explain any instrument. Try a chip below." + ADVICE_NOTE);
    }
  }
  function addMsg(who, html) {
    var log = $("chat-log"); if (!log) return null;
    var m = el("div", "chat-bubble " + (who === "user" ? "user" : "assistant"));
    m.innerHTML = html;
    log.appendChild(m); log.scrollTop = log.scrollHeight;
    return m;
  }
  function sendChat(text) {
    addMsg("user", esc(text));
    var typing = addMsg("assistant", '<span class="typing-indicator">thinking…</span>');
    var delay = 600 + Math.random() * 300;
    setTimeout(function () {
      if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
      addMsg("assistant", copilotAnswer(text));
    }, delay);
  }

  function copilotAnswer(text) {
    var q = text.toLowerCase();
    var ans;
    // 9. scam check (before generic)
    if (/quickrich|agro gold|assured|guaranteed|24%/.test(q)) {
      ans = "<b>⛔ Red flag.</b> “QuickRich Agro Gold Scheme” promises <b>24% assured returns</b> and is <b>not found in any SEBI or exchange registry</b>. Guaranteed high returns are a classic fraud marker — NiveshOS blocks it. Verified alternatives are in Discover.";
    } else if (/(why).*(down|drop|fall|red|lower)|down today|drop today/.test(q)) {
      var dp = dayPnL(), rk = riskiestHolding();
      ans = "<b>You're " + pct(dp.pct) + " today (" + fmtSigned(dp.rupees) + ").</b> The two biggest draggers:<ul style=\"margin:6px 0;padding-left:18px;\"><li><b>" + esc(rk.name) + "</b> " + pct(rk.dayChangePct) + "</li><li><b>Financials</b> (HDFC Bank / ICICI Bank) softened ~2%</li></ul>Your gold ETF is up " + pct(0.8) + ", cushioning some of it.";
    } else if (/overexpos|concentrat|too much|overweight|risk.*sector|banks?/.test(q)) {
      var ti = topIssuer();
      ans = "<b>Yes — you're bank-heavy.</b> Financials are <b>" + financialsPct().toFixed(1) + "%</b> of your market value (comfort band is ~30%). Your single largest issuer, <b>" + esc(ti.name) + "</b>, is " + ti.pct.toFixed(1) + "% on its own. Spreading into non-financial or non-equity assets would reduce this.";
    } else if (/overlap|same stocks|two funds|duplicate fund/.test(q)) {
      var ov = mfOverlap();
      ans = ov ? "<b>Your two funds overlap ~" + ov.pct + "%.</b> " + esc(ov.a.name.split(" —")[0]) + " and " + esc(ov.b.name.split(" —")[0]) + " share " + ov.common.length + " of their top 5: <b>" + ov.common.map(function (c) { return esc(c.name); }).join(", ") + "</b>. Holding both gives less diversification than it looks."
        : "I couldn't find two look-through funds to compare.";
    } else if (/idle cash|spare cash|cash lying|do with.*cash|park/.test(q)) {
      var sp = suitableProducts().filter(function (p) { return p.liquidity !== "Low"; }).slice(0, 2);
      var list = sp.length ? sp.map(function (p) { return "<li><b>" + esc(p.name) + "</b> — " + esc(p.yieldOrReturn) + "</li>"; }).join("")
        : "<li>Take the risk quiz to unlock suitable options.</li>";
      ans = "<b>" + fmt(idleCash()) + " is sitting idle</b> at ~0%. Based on your " + (state.riskProfile ? cap(state.riskProfile) + " profile" : "portfolio") + ", suitable low-friction options:<ul style=\"margin:6px 0;padding-left:18px;\">" + list + "</ul>";
    } else if (/riskiest|most risky|biggest risk|volatile|worst holding/.test(q)) {
      var r = riskiestHolding();
      ans = "<b>" + esc(r.name) + "</b> is your sharpest mover today at " + pct(r.dayChangePct) + " (value " + fmt(hv(r)) + "). Single-stock moves like this are why your " + financialsPct().toFixed(0) + "% financials tilt matters — concentrated bets swing hardest.";
    } else if (/what can i buy|what should i buy|suitable|recommend|invest in|buy/.test(q)) {
      var sp2 = suitableProducts().slice(0, 4);
      ans = state.riskProfile
        ? "<b>With your " + cap(state.riskProfile) + " profile</b>, these pass every suitability gate:<ul style=\"margin:6px 0;padding-left:18px;\">" + (sp2.length ? sp2.map(function (p) { return "<li>" + esc(p.name) + " — " + esc(p.yieldOrReturn) + "</li>"; }).join("") : "<li>Complete a required lesson to unlock products.</li>") + "</ul>Open Discover for the full list."
        : "First take the 6-question <b>risk quiz</b> in Profile — suitability gating needs your tier before I can list what you can buy.";
    } else if (/health|healthy|score|check.?up|portfolio grade/.test(q)) {
      var hr = healthReport();
      var weak = hr.factors.slice().sort(function (a, b) { return a.pts / a.max - b.pts / b.max; }).slice(0, 2);
      ans = "<b>Portfolio health: " + hr.score + "/100 — " + hr.grade.label + ".</b> Weakest links:" +
        '<ul style="margin:6px 0;padding-left:18px;">' + weak.map(function (f) {
          return "<li><b>" + f.label + "</b> (" + f.pts + "/" + f.max + ") — " + f.note + "</li>";
        }).join("") + "</ul>The full five-factor breakdown is in <b>Analytics</b>.";
    } else if (/how am i doing|portfolio value|net worth|total value|overall/.test(q)) {
      var td = thirtyDay();
      ans = "<b>Net worth: " + fmt(netWorth()) + ".</b> Over 30 days you're " + pct(td.pct) + " (from " + fmt(td.from) + "). Invested cost is " + fmt(invested()) + ", so you're sitting on " + fmtSigned(marketValue() - invested()) + " unrealised, with " + fmt(idleCash()) + " in cash.";
    } else if (/reit/.test(q)) {
      ans = explainAns("REIT", "A <b>REIT</b> lets you be a tiny landlord: it owns rent-earning offices/malls, trades like a share, and pays out 90%+ of rent as regular distributions.", "reit");
    } else if (/invit/.test(q)) {
      ans = explainAns("InvIT", "An <b>InvIT</b> is the REIT idea for infrastructure — power lines, highways, pipelines. Steady contracted cash flows mean high (9–11%) payouts, but part is return of capital.", "invit");
    } else if (/\bbond\b|corporate bond|debenture|ncd|coupon/.test(q)) {
      ans = explainAns("Corporate bonds", "A <b>bond</b> is a loan to a company: fixed coupon, principal back at maturity. Ratings (AAA safest) grade the risk — a higher coupon means higher risk, not free money.", "bonds");
    } else if (/\bsgb\b|gold bond|sovereign gold/.test(q)) {
      ans = explainAns("Sovereign Gold Bonds", "An <b>SGB</b> is RBI-issued, tracks gold, pays 2.5% interest a year, and is tax-free on maturity — gold exposure without lockers or making charges.", "sgb");
    } else {
      var g = glossaryLookup(q);
      ans = g || "I can help with your <b>live portfolio</b>. Try:<ul style=\"margin:6px 0;padding-left:18px;\"><li>How healthy is my portfolio?</li><li>Why am I down today?</li><li>Am I overexposed anywhere?</li><li>Explain REITs / InvITs / bonds / SGBs</li><li>What is NAV / NCD / drawdown?</li><li>What should I do with idle cash?</li></ul>";
    }
    return ans + ADVICE_NOTE;
  }
  function glossaryLookup(q) {
    var hit = (D.glossary || []).filter(function (t) {
      return q.indexOf(t.term.toLowerCase()) >= 0;
    }).sort(function (a, b) { return b.term.length - a.term.length; })[0];
    if (!hit) return null;
    return "<b>" + esc(hit.term) + "</b> — " + esc(hit.def) +
      '<div style="margin-top:6px;font-size:12px;color:var(--ink-muted);">More terms in the Jargon buster under Learn.</div>';
  }
  function explainAns(name, body, lessonId) {
    var done = state.completedLessons.indexOf(lessonId) >= 0;
    return body + '<div style="margin-top:6px;"><a href="#" data-lesson-link="' + lessonId + '" style="color:var(--accent);">' + (done ? "Revisit" : "Open") + " the " + esc(name) + " lesson →</a></div>";
  }

  /* -------------------------------------------------------------- trust */
  function renderTrust() {
    var cl = $("consent-ledger");
    if (cl) {
      cl.innerHTML = state.consents.length ? state.consents.map(function (c, i) {
        return '<div class="consent-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--hairline);">' +
          '<div><div style="font-weight:600;font-size:13px;">' + esc(c.scope) + "</div>" +
          '<div style="font-size:11px;color:var(--ink-muted);">Granted ' + esc(c.grantedOn) + " &middot; expires " + esc(c.expiry) + "</div></div>" +
          (c.active
            ? '<button class="btn-ghost revoke-btn" data-idx="' + i + '" style="font-size:12px;">Revoke</button>'
            : '<span style="color:var(--ink-muted);font-size:12px;">Revoked</span>') + "</div>";
      }).join("") : '<p style="color:var(--ink-muted);">No consents on record.</p>';
      Array.prototype.forEach.call(cl.querySelectorAll(".revoke-btn"), function (b) {
        b.addEventListener("click", function () {
          var idx = parseInt(b.getAttribute("data-idx"), 10);
          state.consents[idx].active = false; save("consents");
          audit("consent", "Consent revoked: " + state.consents[idx].scope + ".");
          renderTrust();
        });
      });
    }
    var at = $("audit-trail");
    if (at) {
      at.innerHTML = state.auditTrail.length ? state.auditTrail.slice().reverse().map(function (a) {
        return '<div class="audit-item" style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--hairline);font-size:12px;">' +
          '<span style="color:var(--ink-muted);white-space:nowrap;font-variant-numeric:tabular-nums;">' + esc(a.ts) + "</span>" +
          '<span class="audit-kind" style="text-transform:uppercase;font-size:10px;color:var(--accent);white-space:nowrap;">' + esc(a.kind) + "</span>" +
          '<span style="color:var(--ink-2);">' + esc(a.text) + "</span></div>";
      }).join("") : '<p style="color:var(--ink-muted);">Audit trail is empty.</p>';
    }
    var rc = $("registry-card");
    if (rc) {
      var verified = (D.products || []).filter(function (p) { return p.registered; }).length;
      var blocked = (D.products || []).length - verified;
      rc.innerHTML = '<h3 style="margin:0 0 8px;">Registry check</h3>' +
        '<p style="font-size:13px;color:var(--ink-2);">Every product is checked against a mock SEBI / exchange registry before it can be shown as investable.</p>' +
        '<div style="display:flex;gap:16px;margin-top:8px;">' +
        '<div><div style="font-size:1.6rem;font-weight:700;color:var(--good);">' + verified + '</div><div style="font-size:11px;color:var(--ink-muted);">Verified</div></div>' +
        '<div><div style="font-size:1.6rem;font-weight:700;color:var(--critical);">' + blocked + '</div><div style="font-size:11px;color:var(--ink-muted);">Blocked</div></div></div>';
    }
  }

  /* ============================================================ MODAL / TOAST */
  function openModal(html) {
    var root = $("modal-root"); if (!root) return;
    root.hidden = false;
    root.innerHTML = '<div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:5vh 16px;z-index:1000;">' +
      '<div class="modal-card" style="max-width:480px;width:100%;">' + html + "</div></div>";
    var bd = root.querySelector(".modal-backdrop");
    if (bd) bd.addEventListener("click", function (e) { if (e.target === bd) closeModal(); });
  }
  function closeModal() { var root = $("modal-root"); if (root) { root.hidden = true; root.innerHTML = ""; } }

  function toast(msg, type) {
    var root = $("toast-root"); if (!root) return;
    var cls = "toast toast-" + (type || "success");
    var t = el("div", cls, esc(msg));
    root.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3200);
  }

  /* ============================================================ ROUTER */
  var PANELS = ["dashboard", "discover", "analytics", "learn", "profile", "invest", "copilot", "trust"];
  var current = "dashboard";
  function isActive(name) { return current === name; }
  function renderPanel(name) {
    switch (name) {
      case "dashboard": renderDashboard(); break;
      case "discover": renderDiscover(); break;
      case "analytics": renderAnalytics(); break;
      case "learn": renderLearn(); break;
      case "profile": renderProfile(); break;
      case "invest": renderInvest(); break;
      case "copilot": renderCopilot(); break;
      case "trust": renderTrust(); break;
    }
  }
  function switchPanel(name) {
    if (PANELS.indexOf(name) < 0) return;
    current = name;
    PANELS.forEach(function (p) {
      var sec = $("panel-" + p);
      if (sec) sec.classList.toggle("active", p === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".nav-btn"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-panel") === name);
    });
    renderPanel(name);
    window.dispatchEvent(new CustomEvent("panelchange", { detail: { panel: name } }));
  }

  function renderAll() {
    PANELS.forEach(renderPanel);
  }

  /* ============================================================ THEME */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme === "light" ? "light" : "dark");
  }
  function wireChrome() {
    Array.prototype.forEach.call(document.querySelectorAll(".nav-btn"), function (b) {
      b.addEventListener("click", function () { switchPanel(b.getAttribute("data-panel")); });
    });
    var tt = $("theme-toggle");
    if (tt) tt.addEventListener("click", function () {
      state.theme = state.theme === "light" ? "dark" : "light"; save("theme"); applyTheme();
    });
    var lo = $("logout-btn");
    if (lo) lo.addEventListener("click", logout);
    // delegated: "open the X lesson" links inside chat bubbles or modals
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("[data-lesson-link]") : null;
      if (!a) return;
      e.preventDefault();
      closeModal(); switchPanel("learn"); openLesson(a.getAttribute("data-lesson-link"));
    });
  }

  /* ============================================================ ONBOARDING */
  var CONSENT_SCOPES = [
    { id: "nsdl", scope: "NSDL demat holdings", desc: "Read-only equity & bond holdings from your NSDL demat." },
    { id: "cdsl", scope: "CDSL demat holdings", desc: "Read-only holdings from your CDSL demat account." },
    { id: "mf", scope: "MF folios (CAMS / KFintech)", desc: "Mutual-fund folios and NAVs via RTA feeds." },
    { id: "bank", scope: "Bank balance (AA)", desc: "Idle/settlement cash balance via Account Aggregator." }
  ];
  var CONSENT_MAP = [["consent-nsdl", "nsdl"], ["consent-cdsl", "cdsl"], ["consent-mf", "mf"], ["consent-bank", "bank"]];
  // Agent B ships the full static 3-step markup in #onboarding; we only DRIVE it.
  function initOnboarding() {
    var root = $("onboarding");
    if (!root) { finishBoot(); return; }
    root.hidden = false;
    showOnbStep(1);
    bindNext("onboarding-next-1", function () { showOnbStep(2); });
    bindNext("onboarding-back-2", function () { showOnbStep(1); });
    bindNext("grant-consent-btn", function () { grantFromCheckboxes(); showOnbStep(3); runFetch(root); });
    bindNext("onboarding-done", function () { completeOnboarding(root); });
    var skip = $("onboarding-skip");
    if (skip) skip.addEventListener("click", function (e) {
      e.preventDefault();
      if (!state.consents.length) grantConsents(CONSENT_SCOPES.map(function (c) { return c.id; }));
      completeOnboarding(root);
    });
  }
  function showOnbStep(n) {
    Array.prototype.forEach.call(document.querySelectorAll(".onboarding-step"), function (s) {
      s.classList.toggle("active", s.getAttribute("data-step") === String(n));
    });
    Array.prototype.forEach.call(document.querySelectorAll(".onboarding-dot"), function (d) {
      d.classList.toggle("active", d.getAttribute("data-dot") === String(n));
    });
  }
  function grantFromCheckboxes() {
    var ids = [];
    CONSENT_MAP.forEach(function (pair) { var cb = $(pair[0]); if (!cb || cb.checked) ids.push(pair[1]); });
    if (!ids.length) ids = CONSENT_SCOPES.map(function (c) { return c.id; });
    grantConsents(ids);
  }
  function runFetch(root) {
    var rowIds = ["fetch-nsdl", "fetch-cdsl", "fetch-mf", "fetch-bank"];
    var done = $("onboarding-done"); if (done) done.disabled = true;
    var i = 0;
    var timer = setInterval(function () {
      if (i < rowIds.length) {
        var r = $(rowIds[i]);
        if (r) {
          r.classList.remove("loading"); r.classList.add("done");
          var st = r.querySelector(".fetch-status, .status, .fetch-state");
          if (st) st.textContent = "✓ synced";
        }
        i++;
      } else {
        clearInterval(timer);
        if (done) done.disabled = false; else completeOnboarding(root);
      }
    }, 500);
  }
  function bindNext(id, fn) { var b = $(id); if (b) b.addEventListener("click", fn); }
  function grantConsents(ids) {
    state.consents = ids.map(function (id) {
      var c = CONSENT_SCOPES.filter(function (x) { return x.id === id; })[0] || { scope: id };
      return { scope: c.scope, grantedOn: TODAY, expiry: "2027-07-06", active: true };
    });
    save("consents");
    state.consents.forEach(function (c) { audit("consent", "AA consent granted: " + c.scope + " (expires " + c.expiry + ")."); });
  }
  function completeOnboarding(root) {
    if (!state.onboarded) {
      state.onboarded = true; save("onboarded");
      audit("onboard", "Onboarding complete — 4 sources linked, portfolio consolidated.");
      window.dispatchEvent(new CustomEvent("niveshos:onboarded", {}));
    }
    if (root) { root.hidden = true; }
    finishBoot();
  }

  /* ============================================================ BOOT */
  function finishBoot() {
    if (D.investor) D.investor.riskProfile = state.riskProfile;
    renderAll();
    switchPanel("dashboard");
    if (!_rendered) {
      _rendered = true;
      window.dispatchEvent(new CustomEvent("niveshos:rendered", {}));
    }
  }
  /* ============================================================ LOGIN */
  function showLogin() {
    var ov = $("login-overlay");
    if (!ov) return;
    var cards = (D.users || []).map(function (u) {
      return '<button type="button" class="login-user" data-user="' + esc(u.id) + '">' +
        '<span class="login-user-av">' + esc(u.avatar || "") + "</span>" +
        '<span class="login-user-info"><span class="login-user-name">' + esc(u.name) + "</span>" +
        '<span class="login-user-persona">' + esc(u.persona || "") + "</span>" +
        '<span class="login-user-creds">' + esc(u.username) + " · " + esc(u.password) + "</span></span></button>";
    }).join("");
    ov.innerHTML =
      '<div class="login-card" role="dialog" aria-modal="true" aria-labelledby="login-title">' +
        '<div class="login-brand">' +
          '<svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true">' +
            '<path d="M16 10 L7 21 M16 10 L25 21 M7 23 L25 23" stroke="var(--hairline)" stroke-width="1.5" fill="none"/>' +
            '<circle cx="16" cy="7" r="3.2" fill="var(--accent)"/><circle cx="7" cy="23" r="3.2" fill="var(--s2)"/>' +
            '<circle cx="25" cy="23" r="3.2" fill="var(--s5)"/><circle cx="16" cy="16" r="3.6" fill="var(--ink)"/></svg>' +
          '<div><h2 id="login-title" style="margin:0;">Sign in to NiveshOS</h2>' +
          '<p style="margin:2px 0 0;font-size:12px;color:var(--ink-muted);">Local demo login — runs entirely in your browser, no server.</p></div>' +
        "</div>" +
        '<form id="login-form" class="login-form" autocomplete="off">' +
          '<label class="login-field"><span>Username</span><input id="login-username" type="text" autocomplete="username" placeholder="e.g. priya"></label>' +
          '<label class="login-field"><span>Password</span><input id="login-password" type="password" autocomplete="current-password" placeholder="••••••••"></label>' +
          '<p id="login-error" class="login-error" hidden></p>' +
          '<button type="submit" class="btn btn-primary login-submit">Sign in</button>' +
        "</form>" +
        '<div class="login-divider"><span>or pick a demo profile</span></div>' +
        '<div class="login-users">' + cards + "</div>" +
      "</div>";
    ov.hidden = false;

    var form = $("login-form");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      attemptLogin(($("login-username") || {}).value, ($("login-password") || {}).value);
    });
    Array.prototype.forEach.call(ov.querySelectorAll(".login-user"), function (b) {
      b.addEventListener("click", function () {
        var u = userById(b.getAttribute("data-user"));
        if (!u) return;
        var un = $("login-username"), pw = $("login-password");
        if (un) un.value = u.username;
        if (pw) pw.value = u.password;
        attemptLogin(u.username, u.password);
      });
    });
  }
  function attemptLogin(username, password) {
    var u = (D.users || []).filter(function (x) {
      return x.username === String(username || "").trim() && x.password === String(password || "");
    })[0];
    var err = $("login-error");
    if (!u) {
      if (err) { err.textContent = "Incorrect username or password."; err.hidden = false; }
      return;
    }
    setSession(u.id);
    enterApp(u.id, false);
  }
  function hideLogin() { var ov = $("login-overlay"); if (ov) ov.hidden = true; }

  function enterApp(id, forceOnboarded) {
    setActiveUser(id);
    var u = userById(id);
    if (hasSavedState()) loadState();
    else seedUserState(u);
    if (forceOnboarded && !state.onboarded) {
      state.onboarded = true;
      grantConsents(CONSENT_SCOPES.map(function (c) { return c.id; }));
      saveAll();
    }
    hideLogin();
    if (state.onboarded) {
      var ob = $("onboarding"); if (ob) ob.hidden = true;
      finishBoot();
    } else {
      initOnboarding();
    }
    var p = new URLSearchParams(window.location.search).get("panel");
    if (p) switchPanel(p);
  }
  function logout() {
    clearSession();
    window.location.reload();
  }

  function boot() {
    loadTheme();
    applyTheme();
    wireChrome();
    var params = new URLSearchParams(window.location.search);
    var forced = params.get("user");
    if (params.get("demo") === "1") { setSession("priya"); enterApp("priya", true); return; }
    if (forced && userById(forced)) { setSession(forced); enterApp(forced, true); return; }
    var sess = getSession();
    if (sess && userById(sess)) { enterApp(sess, false); return; }
    showLogin();
  }

  // expose for anim.js / debug
  window.NIVESH = { switchPanel: switchPanel, state: state, fmt: fmt };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
