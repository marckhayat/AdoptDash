// insights.js — Insights tab: CPI Adopt, Customer Analysis, UC Health, Lifecycle
var _paretoChart = null;

function renderTesting(data) {
  var el = document.getElementById("tab-testing");
  if (!el) return;

  var isDisti = !!window.APP_IS_DISTI;
  var dimField = isDisti ? "2T Partner Name" : "CX Customer BU ID";
  var nameField = isDisti ? "2T Partner Name" : "CR Party Name";
  var dimLabel = isDisti ? "2T Partner" : "Customer";

  function norm(x) {
    if (x === null || x === undefined) return "";
    return String(x).replace(/\u00A0/g, " ").trim().toUpperCase();
  }
  function fmtCurrency(v) {
    if (!v || isNaN(v)) return "$0";
    return "$" + Math.round(v).toLocaleString();
  }
  function escHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ── Unique portfolios & offers for slicers ─────────────────────────────────
  var portfolioSet = new Set();
  var offersByPortfolio = {};
  data.forEach(function (r) {
    var p = r["Deal CPI Portfolio"];
    if (p) {
      portfolioSet.add(p);
      if (!offersByPortfolio[p]) offersByPortfolio[p] = new Set();
      if (r["Track"]) offersByPortfolio[p].add(r["Track"]);
    }
  });
  var PORTFOLIO_ORDER = ["Networking", "Security", "Cloud + AI Infrastructure", "Collaboration"];
  var portfolios = Array.from(portfolioSet).sort(function(a, b) {
    var ai = PORTFOLIO_ORDER.indexOf(a), bi = PORTFOLIO_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  var allOffers  = Array.from(new Set(data.map(function(r){ return r["Track"]; }).filter(Boolean))).sort();
  var allUCs     = Array.from(new Set(data.map(function(r){ return r["Sub-Track"]; }).filter(Boolean))).sort();
  var ucsByOffer = {};
  data.forEach(function(r) {
    var o = r["Track"], uc = r["Sub-Track"];
    if (o && uc) {
      if (!ucsByOffer[o]) ucsByOffer[o] = new Set();
      ucsByOffer[o].add(uc);
    }
  });

  // ── UCH: opted-in eligible only lookup structures ───────────────────────────
  var uchPortfolioSet     = new Set();
  var uchOffersByPortfolio = {};
  var uchUCsByOffer        = {};
  data.forEach(function(r) {
    if (norm(r["Stage"]) !== "ELIGIBLE") return;
    if (norm(r["Adopt Rebate Opt-In Status"]) !== "OPTED IN") return;
    var p  = r["Deal CPI Portfolio"];
    var o  = r["Track"];
    var uc = r["Sub-Track"];
    if (p) {
      uchPortfolioSet.add(p);
      if (!uchOffersByPortfolio[p]) uchOffersByPortfolio[p] = new Set();
      if (o) uchOffersByPortfolio[p].add(o);
    }
    if (o && uc) {
      if (!uchUCsByOffer[o]) uchUCsByOffer[o] = new Set();
      uchUCsByOffer[o].add(uc);
    }
  });
  var uchPortfolios = Array.from(uchPortfolioSet).sort(function(a,b) {
    var ai = PORTFOLIO_ORDER.indexOf(a), bi = PORTFOLIO_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });
  var uchAllOffers = Array.from(new Set(data.filter(function(r){
    return norm(r["Stage"]) === "ELIGIBLE" && norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN";
  }).map(function(r){ return r["Track"]; }).filter(Boolean))).sort();
  var uchAllUCs = Array.from(new Set(data.filter(function(r){
    return norm(r["Stage"]) === "ELIGIBLE" && norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN";
  }).map(function(r){ return r["Sub-Track"]; }).filter(Boolean))).sort();

  function uchUCsForPortfolio(portfolio) {
    var s = new Set();
    Array.from(uchOffersByPortfolio[portfolio] || []).forEach(function(o) {
      Array.from(uchUCsByOffer[o] || []).forEach(function(u) { s.add(u); });
    });
    return s;
  }

  // UCs for a given portfolio (union across all offers in that portfolio) — used by Pareto
  function ucsForPortfolio(portfolio) {
    var s = new Set();
    Array.from(offersByPortfolio[portfolio] || []).forEach(function(o) {
      Array.from(ucsByOffer[o] || []).forEach(function(u) { s.add(u); });
    });
    return s;
  }

  // ── Build HTML ─────────────────────────────────────────────────────────────
  var html = '<div class="p-3">';

  // View switcher
  html += '<ul class="nav nav-pills mb-4" id="testing-view-tabs">';
  var _newTagCpi = new Date() < new Date('2026-09-28') ? '<span class="position-absolute text-danger fw-bold" style="top:1px;right:2px;font-size:0.5rem;line-height:1">NEW</span>' : '';
  var _newTagUch = new Date() < new Date('2026-09-28') ? '<span class="position-absolute text-danger fw-bold" style="top:1px;right:2px;font-size:0.5rem;line-height:1">NEW</span>' : '';
  html += '<li class="nav-item position-relative"><button class="nav-link active" id="tab-btn-cpi"><i class="bi bi-graph-up-arrow me-1"></i>CPI Adopt</button>' + _newTagCpi + '</li>';
  html += '<li class="nav-item"><button class="nav-link" id="tab-btn-pareto"><i class="bi bi-bar-chart-steps me-1"></i>Customer Analysis</button></li>';
  html += '<li class="nav-item position-relative"><button class="nav-link" id="tab-btn-uch"><i class="bi bi-heart-pulse me-1"></i>UC Health</button>' + _newTagUch + '</li>';
  html += '<li class="nav-item"><button class="nav-link" id="tab-btn-lifecycle"><i class="bi bi-bar-chart me-1"></i>Lifecycle</button></li>';
  html += '</ul>';

  // ── CPI Adopt sub-view ────────────────────────────────────────────────────
  html += '<div id="testing-view-cpi">';
  html += '<div id="tab-cpi-adopt"></div>';
  html += '</div>';

  html += '<div id="testing-view-pareto" style="display:none">';
  html += '<h5 class="mb-3"><i class="bi bi-bar-chart-steps me-2"></i>Customer Analysis – Potential Incentives by ' + dimLabel + '</h5>';
  html += '<p class="text-muted small mb-3">Ranks ' + dimLabel.toLowerCase() + 's by potential incentives. The line shows the cumulative share — the 80% threshold is highlighted.</p>';

  // Slicers
  html += '<div class="d-flex flex-wrap gap-3 mb-4 align-items-end">';

  html += '<div class="d-flex flex-column"><label class="small text-muted mb-1" for="pareto-mode">View</label>';
  html += '<select id="pareto-mode" class="form-select form-select-sm" style="min-width:220px">';
  html += '<option value="eligible">Eligible (1 per offer per CR)</option>';
  html += '<option value="optedin" selected>Opted-in</option>';
  html += '</select></div>';
  html += '<div class="d-flex flex-column"><label class="small text-muted mb-1" for="pareto-portfolio">Portfolio</label>';
  html += '<select id="pareto-portfolio" class="form-select form-select-sm" style="min-width:180px"><option value="">All Portfolios</option>';
  portfolios.forEach(function(p){ html += '<option value="' + escHtml(p) + '">' + escHtml(p) + '</option>'; });
  html += '</select></div>';

  html += '<div class="d-flex flex-column"><label class="small text-muted mb-1" for="pareto-offer">Offer</label>';
  html += '<select id="pareto-offer" class="form-select form-select-sm" style="min-width:180px"><option value="">All Offers</option>';
  allOffers.forEach(function(o){ html += '<option value="' + escHtml(o) + '">' + escHtml(o) + '</option>'; });
  html += '</select></div>';

  html += '<div class="d-flex flex-column"><label class="small text-muted mb-1" for="pareto-topn">Show top</label>';
  html += '<select id="pareto-topn" class="form-select form-select-sm" style="min-width:100px">';
  [10, 20, 30, 50].forEach(function(n){ html += '<option value="' + n + '"' + (n===20?' selected':'') + '>' + n + '</option>'; });
  html += '</select></div>';
  html += '</div>';

  var STAGE_ORDER = ["Purchase", "Onboard", "Implement", "Use", "Engage", "Adopt", "Completed"];
  var stageMaxIdx = STAGE_ORDER.length - 1;

  function stageBadgeHtml(name) {
    return '<span class="stage-badge stage-' + escHtml(name) + '">' + escHtml(name) + '</span>';
  }
  function makeStageSliderHtml(prefix) {
    return '<div class="date-slider-group">' +
      '<div class="slider-val-display">' +
      '<span id="' + prefix + '-from-lbl">' + stageBadgeHtml(STAGE_ORDER[0]) + '</span>' +
      '<span id="' + prefix + '-to-lbl">'   + stageBadgeHtml(STAGE_ORDER[stageMaxIdx]) + '</span>' +
      '</div>' +
      '<div class="dual-range-wrap">' +
      '<div class="dual-range-track"></div>' +
      '<div class="dual-range-fill" id="' + prefix + '-fill"></div>' +
      '<input type="range" class="range-from" id="' + prefix + '-from" min="0" max="' + stageMaxIdx + '" value="0" step="1">' +
      '<input type="range" class="range-to"   id="' + prefix + '-to"   min="0" max="' + stageMaxIdx + '" value="' + stageMaxIdx + '" step="1">' +
      '</div></div>';
  }

  // Chart + KPI strip
  html += '<div class="row g-3 mb-3">';
  html += '<div class="col-12 col-md-4 col-lg-3">';
  html += '<div class="card shadow-sm h-100"><div class="card-body d-flex flex-column gap-3">';
  html += '<div><div class="small text-muted mb-1">Current Stage</div>' + makeStageSliderHtml("pareto-cs") + '</div>';
  html += '<div id="pareto-kpis"></div>';
  html += '</div></div>';
  html += '</div>';
  html += '<div class="col-12 col-md-8 col-lg-9">';
  html += '<div class="card shadow-sm"><div class="card-body" style="position:relative;height:380px"><canvas id="pareto-chart"></canvas></div></div>';
  html += '</div>';
  html += '</div>';
  html += '</div>'; // close testing-view-pareto

  // ── UC Health view ─────────────────────────────────────────────────────────
  html += '<div id="testing-view-uch" style="display:none">';
  html += '<h5 class="mb-3"><i class="bi bi-heart-pulse me-2"></i>UC Health</h5>';
  html += '<p class="text-muted small mb-3">Drill down to a Use Case to see stage distribution, average days in stage, and most common pending tasks for opted-in eligible deals.</p>';

  // Cascade selector shell — panels built dynamically by JS
  html += '<div class="uch-selector">';
  html += '<div class="uch-breadcrumb" id="uch-breadcrumb"></div>';
  html += '<div style="overflow:hidden"><div class="uch-slide-track" id="uch-slide-track">';
  html += '<div class="uch-slide-panel" id="uch-panel-portfolio"></div>';
  html += '<div class="uch-slide-panel" id="uch-panel-offer" style="visibility:hidden"></div>';
  html += '<div class="uch-slide-panel" id="uch-panel-uc" style="visibility:hidden"></div>';
  html += '</div></div>';
  html += '</div>';

  // Stage slider lives here (always rendered, always accessible)
  html += '<div id="uch-cs-wrap" class="mb-4">';
  html += '<div class="d-flex flex-wrap gap-4 align-items-start">';
  html += '<div style="min-width:220px;max-width:300px"><div class="small text-muted mb-1">Current Stage</div>' + makeStageSliderHtml("uch-cs") + '</div>';
  html += '<div id="uch-kpi-area" class="d-flex flex-wrap gap-3 align-items-center"></div>';
  html += '</div>';
  html += '</div>';

  html += '<div class="row g-3 mt-1" id="uch-main-row">';
  html += '<div class="col-12 col-lg-3"><div class="card shadow-sm h-100"><div class="card-body">';
  var _newTagStageChart = new Date() < new Date('2026-09-28') ? '<span class="text-danger fw-bold ms-1" style="font-size:0.5rem;line-height:1;vertical-align:super">NEW</span>' : '';
  html += '<div class="d-flex align-items-center justify-content:between mb-3">';
  html += '<h6 class="card-title mb-0" id="uch-donut-title">Stage Distribution</h6>';
  html += _newTagStageChart;
  html += '<div class="btn-group btn-group-sm ms-auto" role="group" aria-label="Chart type">';
  html += '<button id="uch-chart-donut-btn" class="btn btn-outline-secondary active" title="Donut view"><i class="bi bi-pie-chart-fill"></i></button>';
  html += '<button id="uch-chart-funnel-btn" class="btn btn-outline-secondary" title="Funnel view"><i class="bi bi-filter"></i></button>';
  html += '</div></div>';
  html += '<div id="uch-canvas-wrap"><canvas id="uch-donut-canvas"></canvas></div>';
  html += '<div id="uch-funnel-container" style="display:none"></div>';
  html += '</div></div></div>';
  html += '<div class="col-12 col-lg-9"><div id="uch-stats"></div></div>';
  html += '</div>';

  html += '</div>'; // close testing-view-uch

  // ── Lifecycle sub-view ────────────────────────────────────────────────────
  html += '<div id="testing-view-lifecycle" style="display:none">';
  html += '<div id="tab-lifecycle"></div>';
  html += '</div>';

  html += '</div>'; // close outer div.p-3
  el.innerHTML = html;

  // Always returns data respecting current APP_EXCL_ACTIVE state
  function getEffectiveData() {
    var base = (window.APP_DATA && window.APP_DATA.length) ? window.APP_DATA : data;
    return (window.APP_EXCL_ACTIVE && window.getActiveData) ? window.getActiveData() : base;
  }

  // ── Exclude toggle button (shared across all subtabs) ─────────────────────
  var insightNavTabs = document.getElementById("testing-view-tabs");
  if (insightNavTabs) {
    var _insightAllWsIds = new Set((window.APP_DATA || data).map(function(r) { return String(r["Deal WS-ID"] || ""); }));
    var _insightExclCount = ANNOTATIONS.getExcludedWsIds().filter(function(id) { return _insightAllWsIds.has(id); }).length;
    if (_insightExclCount > 0) {
      var insightExclBtn = document.createElement("button");
      insightExclBtn.id = "insight-excl-toggle-btn";
      insightExclBtn.className = "btn btn-sm ms-auto";
      insightExclBtn.style.cssText = "font-size:0.82rem;align-self:center";
      function _updateInsightExclBtn() {
        var active = !!window.APP_EXCL_ACTIVE;
        if (active) {
          insightExclBtn.className = "btn btn-sm ms-auto btn-danger";
          insightExclBtn.innerHTML = '<i class="bi bi-slash-circle-fill me-1"></i>' + _insightExclCount + ' UCs excluded — removed from calcs';
          insightExclBtn.title = "Excluded UCs are NOT counted. Click to include them.";
        } else {
          insightExclBtn.className = "btn btn-sm ms-auto btn-outline-secondary";
          insightExclBtn.innerHTML = '<i class="bi bi-slash-circle me-1"></i>' + _insightExclCount + ' UCs excluded — counted in calcs';
          insightExclBtn.title = "Excluded UCs are still counted. Click to remove them.";
        }
      }
      _updateInsightExclBtn();
      insightExclBtn.addEventListener("click", function () {
        window.APP_EXCL_ACTIVE = !window.APP_EXCL_ACTIVE;
        _updateInsightExclBtn();
        if (_activeSubView === "pareto")         renderPareto();
        else if (_activeSubView === "uch")       renderUCHealth();
        else if (_activeSubView === "lifecycle") renderLifecycle(getEffectiveData());
        else if (_activeSubView === "cpi")       renderCPIAdopt(getEffectiveData());
      });
      // Wrap nav in a flex row so button aligns right
      insightNavTabs.style.cssText = "display:flex;flex-wrap:wrap;align-items:center";
      insightNavTabs.appendChild(insightExclBtn);
    }
  }

  // ── Render function ────────────────────────────────────────────────────────
  function renderPareto() {
    var portfolioFilter = document.getElementById("pareto-portfolio").value;
    var offerFilter     = document.getElementById("pareto-offer").value;
    var topN            = parseInt(document.getElementById("pareto-topn").value, 10) || 20;
    var mode            = document.getElementById("pareto-mode").value;
    var csFromEl        = document.getElementById("pareto-cs-from");
    var csToEl          = document.getElementById("pareto-cs-to");
    var csFromIdx       = csFromEl ? parseInt(csFromEl.value) : 0;
    var csToIdx         = csToEl   ? parseInt(csToEl.value)   : stageMaxIdx;
    var csActive        = !(csFromIdx === 0 && csToIdx === stageMaxIdx);

    // Filter based on selected mode
    var filtered = getEffectiveData().filter(function(r) {
      if (norm(r["Stage"]) !== "ELIGIBLE") return false;
      if (mode === "eligible") {
        if (norm(r["Maximum Incentive Deal Flag"]) !== "YES") return false;
      } else {
        if (norm(r["Adopt Rebate Opt-In Status"]) !== "OPTED IN") return false;
      }
      if (portfolioFilter && r["Deal CPI Portfolio"] !== portfolioFilter) return false;
      if (offerFilter && r["Track"] !== offerFilter) return false;
      if (csActive) {
        var si = STAGE_ORDER.indexOf(String(r["Current stage"] || ""));
        if (si === -1 || si < csFromIdx || si > csToIdx) return false;
      }
      return true;
    });

    // Aggregate Potential Incentives by dimension, de-duped at CRPartyID-Offer level
    var seenKeys    = {};
    var totals      = {};
    var dealCounts  = {};
    var dimNames    = {};
    var dealValueMap = {}; // dim → { key: {value, optedIn} }
    filtered.forEach(function(r) {
      var dim  = String(r[dimField] || "(Unknown)").trim();
      var name = String(r[nameField] || dim).trim();
      if (!dim) return;
      var key = String(r["CRPartyID-Offer"] || r["Deal WS-ID"] || "");
      var dedupeKey = dim + "||" + key;
      if (key && seenKeys[dedupeKey]) return;
      if (key) seenKeys[dedupeKey] = true;
      var val = parseFloat(r["Potential Incentives"]) || 0;
      var optedIn = norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN";
      totals[dim]     = (totals[dim]     || 0) + val;
      dealCounts[dim] = (dealCounts[dim] || 0) + 1;
      if (!dimNames[dim])    dimNames[dim]    = {};
      if (!dealValueMap[dim]) dealValueMap[dim] = {};
      if (!dimNames[dim][name]) dimNames[dim][name] = { count: 0, value: 0 };
      dimNames[dim][name].count += 1;
      dimNames[dim][name].value += val;
      dealValueMap[dim][key] = { value: (dealValueMap[dim][key] ? dealValueMap[dim][key].value : 0) + val, optedIn: optedIn };
    });

    // Build primary label and full name list per dim.
    // Priority: 1) highest total potential incentives, 2) highest deal count, 3) alphabetical.
    function primaryLabel(dim) {
      if (isDisti) return dim;
      var names = dimNames[dim] || {};
      return Object.keys(names).sort(function(a, b) {
        var na = names[a], nb = names[b];
        if (nb.value !== na.value) return nb.value - na.value;
        if (nb.count !== na.count) return nb.count - na.count;
        return a.localeCompare(b);
      })[0] || dim;
    }
    function allNames(dim) {
      if (isDisti) return [dim];
      return Object.keys(dimNames[dim] || {}).sort();
    }

    // Sort descending
    var entries = Object.keys(totals).map(function(k){
      var dvals = Object.values(dealValueMap[k] || {}).sort(function(a,b){ return b.value - a.value; });
      return { id: k, label: primaryLabel(k), names: allNames(k), value: totals[k], deals: dealCounts[k] || 0, dealValues: dvals,
               hasOptedIn: dvals.some(function(d){ return d.optedIn; }) };
    });
    entries.sort(function(a,b){
      if (b.value !== a.value) return b.value - a.value;
      if (mode === "eligible" && a.hasOptedIn !== b.hasOptedIn) return a.hasOptedIn ? -1 : 1;
      return a.label.localeCompare(b.label);
    });

    var uniqueCustomers = new Set(filtered.map(function(r){ return r["CR Party ID"]; })).size;

    var grandTotal  = entries.reduce(function(s,e){ return s + e.value; }, 0);
    var grandDeals  = entries.reduce(function(s,e){ return s + e.deals; }, 0);
    var top         = entries.slice(0, topN);
    var topDeals    = top.reduce(function(s,e){ return s + e.deals; }, 0);

    // Cumulative % and cumulative amounts
    var cumSum = 0;
    var cumAmounts = [];
    var cumPcts = top.map(function(e){
      cumSum += e.value;
      cumAmounts.push(cumSum);
      return grandTotal > 0 ? (cumSum / grandTotal) * 100 : 0;
    });

    // 80% cutoff index
    var cutoff80   = cumPcts.findIndex(function(v){ return v >= 80; });
    var pct80Count = cutoff80 >= 0 ? cutoff80 + 1 : top.length;
    var deals80    = top.slice(0, pct80Count).reduce(function(s,e){ return s + e.deals; }, 0);

    // Save filter state
    if (window.APP_FILTER_STATE) {
      var _cur = window.APP_FILTER_STATE.testing || {};
      window.APP_FILTER_STATE.testing = { view: _cur.view || "pareto", portfolio: portfolioFilter, offer: offerFilter, topN: String(topN), mode: mode, csFrom: csFromIdx, csTo: csToIdx,
        optedInHidden: !!_cur.optedInHidden,
        notOptedInHidden: !!_cur.notOptedInHidden };
    }

    // KPIs
    var kpiEl = document.getElementById("pareto-kpis");

    function buildPreset(optedInHidden, notOptedInHidden) {
      var p = { stage: ["Eligible"], sortField: "Potential Incentives", sortDir: "desc" };
      if (mode === "eligible") {
        p.maxIncentive = true;
        if (notOptedInHidden && !optedInHidden)  p.optIn = ["OPTED IN"];
        if (optedInHidden    && !notOptedInHidden) p.optIn = ["PENDING"];
      } else {
        p.optIn = ["OPTED IN"];
      }
      if (portfolioFilter) p.portfolio = portfolioFilter;
      if (offerFilter)     p.offer     = offerFilter;
      if (csActive) { p.csFrom = csFromIdx; p.csTo = csToIdx; }
      return p;
    }

    function updateDeepLink(optedInHidden, notOptedInHidden) {
      _deepLinkPreset = buildPreset(optedInHidden, notOptedInHidden);
    }

    var _deepLinkPreset = buildPreset(false, false);

    kpiEl.innerHTML =
      '<div class="d-flex justify-content-between align-items-baseline"><span class="text-muted small">Total Potential</span><span class="fw-bold">' + fmtCurrency(grandTotal) + '</span></div>' +
      '<div class="d-flex justify-content-between align-items-baseline"><span class="text-muted small">' + dimLabel + 's in top ' + topN + '</span><span class="fw-bold">' + top.length + ' <span class="text-muted fw-normal" style="font-size:0.75rem">(' + topDeals + ' WS deals)</span></span></div>' +
      '<div class="d-flex justify-content-between align-items-baseline"><span class="text-muted small">' + dimLabel + 's driving 80%</span><span class="fw-bold text-warning">' + pct80Count + ' <span class="text-muted fw-normal" style="font-size:0.75rem">(' + deals80 + ' WS deals)</span></span></div>' +
      '<div class="d-flex justify-content-between align-items-baseline"><span class="text-muted small">Their share</span><span class="fw-bold text-danger">' + (grandTotal > 0 ? ((top.slice(0,pct80Count).reduce(function(s,e){return s+e.value;},0)/grandTotal*100).toFixed(1)) : "0.0") + '%</span></div>' +
      '<div class="d-flex justify-content-between align-items-baseline"><span class="text-muted small">Total Customers</span><span class="fw-bold">' + uniqueCustomers + '</span></div>' +
      '<div class="mt-auto pt-2 border-top"><a href="#" id="pareto-deeplink" class="small"><i class="bi bi-box-arrow-up-right me-1"></i>Open in Details tab</a></div>';

    document.getElementById("pareto-deeplink").addEventListener("click", function(e) {
      e.preventDefault();
      window.navigateToDetails(_deepLinkPreset);
    });

    // Chart — stacked bars (one dataset per deal rank)
    if (_paretoChart) { _paretoChart.destroy(); _paretoChart = null; }
    var ctx = document.getElementById("pareto-chart").getContext("2d");

    var hasOptedIn = mode === "eligible" && top.some(function(e){ return e.dealValues.some(function(d){ return d.optedIn; }); });

    var barDatasets = [];

    if (mode === "eligible") {
      // Split into two separate stacks: opted-in and not-opted-in
      var maxOptedIn    = top.reduce(function(m,e){ return Math.max(m, e.dealValues.filter(function(d){ return  d.optedIn; }).length); }, 0);
      var maxNotOptedIn = top.reduce(function(m,e){ return Math.max(m, e.dealValues.filter(function(d){ return !d.optedIn; }).length); }, 0);

      // Not opted-in layers (yellow)
      for (var di = 0; di < maxNotOptedIn; di++) {
        (function(idx) {
          barDatasets.push({
            type: "bar", order: 2, stack: "deals",
            label: idx === 0 ? "Not opted-in" : "_no" + idx,
            _group: "notopted",
            data: top.map(function(e){
              var dv = e.dealValues.filter(function(d){ return !d.optedIn; });
              return dv[idx] ? dv[idx].value : 0;
            }),
            backgroundColor: top.map(function(e, i){
              var dv = e.dealValues.filter(function(d){ return !d.optedIn; });
              if (!dv[idx]) return "rgba(0,0,0,0)";
              return (cutoff80 === -1 || i <= cutoff80) ? "rgba(255,193,7,0.75)" : "rgba(108,117,125,0.45)";
            }),
            borderColor: "rgba(255,255,255,1)",
            borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
            yAxisID: "y"
          });
        })(di);
      }
      // Opted-in layers (green)
      for (var di2 = 0; di2 < maxOptedIn; di2++) {
        (function(idx) {
          barDatasets.push({
            type: "bar", order: 2, stack: "deals",
            label: idx === 0 ? "Opted-in" : "_oi" + idx,
            _group: "optedin",
            data: top.map(function(e){
              var dv = e.dealValues.filter(function(d){ return d.optedIn; });
              return dv[idx] ? dv[idx].value : 0;
            }),
            backgroundColor: top.map(function(e, i){
              var dv = e.dealValues.filter(function(d){ return d.optedIn; });
              if (!dv[idx]) return "rgba(0,0,0,0)";
              return (cutoff80 === -1 || i <= cutoff80) ? "rgba(25,135,84,0.80)" : "rgba(25,135,84,0.40)";
            }),
            borderColor: "rgba(255,255,255,1)",
            borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
            yAxisID: "y"
          });
        })(di2);
      }
    } else {
      // Opted-in mode: all deals green
      var maxDeals = top.reduce(function(m,e){ return Math.max(m, e.dealValues.length); }, 0);
      for (var di3 = 0; di3 < maxDeals; di3++) {
        (function(idx) {
          barDatasets.push({
            type: "bar", order: 2, stack: "deals",
            label: idx === 0 ? "Opted-in" : "_d" + idx,
            _group: "optedin",
            data: top.map(function(e){ return e.dealValues[idx] ? e.dealValues[idx].value : 0; }),
            backgroundColor: top.map(function(e, i){
              if (!e.dealValues[idx]) return "rgba(0,0,0,0)";
              return (cutoff80 === -1 || i <= cutoff80) ? "rgba(25,135,84,0.80)" : "rgba(25,135,84,0.40)";
            }),
            borderColor: "rgba(255,255,255,1)",
            borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
            yAxisID: "y"
          });
        })(di3);
      }
    }

    _paretoChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: top.map(function(e){ return e.label; }),
        datasets: barDatasets.concat([{
          type: "line",
          label: "Cumulative %",
          order: 1,
          data: cumPcts,
          borderColor: "rgba(220,53,69,0.85)",
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.2,
          yAxisID: "y2",
          fill: false
        }])
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          title: {
            display: true,
            text: "Potential Incentives",
            align: "start",
            font: { size: 12, weight: "600" },
            padding: { bottom: 6 }
          },
          legend: {
            position: "top",
            align: "center",
            labels: {
              font: { size: 11 },
              generateLabels: function(chart) {
                var labels = [];
                function groupHidden(group) {
                  return chart.data.datasets.every(function(ds, i){
                    return ds._group !== group || chart.getDatasetMeta(i).hidden;
                  });
                }
                if (mode === "eligible") {
                  labels.push({ text: "Opted-in",     fillStyle: "rgba(25,135,84,0.80)", strokeStyle: "rgba(255,255,255,1)", lineWidth: 1, hidden: groupHidden("optedin") });
                  labels.push({ text: "Not opted-in", fillStyle: "rgba(255,193,7,0.75)", strokeStyle: "rgba(255,255,255,1)", lineWidth: 1, hidden: groupHidden("notopted") });
                } else {
                  labels.push({ text: "Opted-in",     fillStyle: "rgba(25,135,84,0.80)", strokeStyle: "rgba(255,255,255,1)", lineWidth: 1, hidden: groupHidden("optedin") });
                }
                // Line entry
                chart.data.datasets.forEach(function(ds, i) {
                  if (ds.yAxisID === "y2") {
                    var meta = chart.getDatasetMeta(i);
                    labels.push({ text: ds.label, fillStyle: ds.borderColor, strokeStyle: ds.borderColor, lineWidth: 2, hidden: meta.hidden, lineDash: [], datasetIndex: i, pointStyle: "line" });
                  }
                });
                return labels;
              }
            },
            onClick: function(e, legendItem, legend) {
              var chart = legend.chart;
              if (legendItem.text === "Cumulative %") {
                Chart.defaults.plugins.legend.onClick.call(this, e, legendItem, legend);
                return;
              }
              var group = legendItem.text === "Opted-in" ? "optedin" : "notopted";
              var anyVisible = chart.data.datasets.some(function(ds, i){
                return ds._group === group && !chart.getDatasetMeta(i).hidden;
              });
              chart.data.datasets.forEach(function(ds, i){
                if (ds._group === group) chart.getDatasetMeta(i).hidden = anyVisible;
              });
              chart.update();
              // Update deep link and persist legend state
              var optedInHidden    = chart.data.datasets.every(function(ds,i){ return ds._group !== "optedin"  || chart.getDatasetMeta(i).hidden; });
              var notOptedInHidden = chart.data.datasets.every(function(ds,i){ return ds._group !== "notopted" || chart.getDatasetMeta(i).hidden; });
              updateDeepLink(optedInHidden, notOptedInHidden);
              if (window.APP_FILTER_STATE && window.APP_FILTER_STATE.testing) {
                window.APP_FILTER_STATE.testing.optedInHidden    = optedInHidden;
                window.APP_FILTER_STATE.testing.notOptedInHidden = notOptedInHidden;
              }
            }
          },
          tooltip: {
            filter: function(item) {
              return item.dataset.yAxisID === "y2" || item.dataset.label === "Opted-in" || item.dataset.label === "Not opted-in";
            },
            callbacks: {
              label: function(ctx) {
                if (ctx.dataset.yAxisID === "y2") {
                  var amt = cumAmounts[ctx.dataIndex];
                  return " Cumulative: " + ctx.parsed.y.toFixed(1) + "% (" + fmtCurrency(amt) + ")";
                }
                var entry = top[ctx.dataIndex];
                var deals = entry ? entry.deals : 0;
                var names = entry ? entry.names : [];
                var lines = [" Total: " + fmtCurrency(entry ? entry.value : 0), " WS deals: " + deals + (entry ? " (CX BU " + entry.id + ")" : "")];
                if (names.length > 1) {
                  lines.push(" ─ Names:");
                  names.forEach(function(n){ lines.push("   · " + n); });
                }
                return lines;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              maxRotation: 45,
              font: { size: 10 },
              callback: function(val, i) {
                var lbl = top[i] ? top[i].label : "";
                return lbl.length > 20 ? lbl.slice(0, 18) + "…" : lbl;
              }
            }
          },
          y: {
            stacked: true,
            position: "left",
            ticks: {
              font: { size: 10 },
              callback: function(v) { return "$" + (v >= 1e6 ? (v/1e6).toFixed(1)+"M" : v >= 1e3 ? (v/1e3).toFixed(0)+"K" : v); }
            }
          },
          y2: {
            position: "right",
            min: 0,
            max: 100,
            title: { display: true, text: "Cumulative %", font: { size: 11 } },
            ticks: { font: { size: 10 }, callback: function(v){ return v + "%"; } },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });

    // Restore legend hidden state
    var _fs = window.APP_FILTER_STATE && window.APP_FILTER_STATE.testing;
    if (_fs && mode === "eligible") {
      if (_fs.optedInHidden || _fs.notOptedInHidden) {
        _paretoChart.data.datasets.forEach(function(ds, i) {
          if (_fs.optedInHidden    && ds._group === "optedin")  _paretoChart.getDatasetMeta(i).hidden = true;
          if (_fs.notOptedInHidden && ds._group === "notopted") _paretoChart.getDatasetMeta(i).hidden = true;
        });
        _paretoChart.update();
        updateDeepLink(_fs.optedInHidden, _fs.notOptedInHidden);
      }
    }
  }

  // ── Stage slider ───────────────────────────────────────────────────────────
  var _csLastMoved = {};

  function updateStageSliderDisplay() {
    var fromEl  = document.getElementById("pareto-cs-from");
    var toEl    = document.getElementById("pareto-cs-to");
    var fillEl  = document.getElementById("pareto-cs-fill");
    var fromLbl = document.getElementById("pareto-cs-from-lbl");
    var toLbl   = document.getElementById("pareto-cs-to-lbl");
    if (!fromEl || !toEl) return;
    var fromVal = parseInt(fromEl.value), toVal = parseInt(toEl.value);
    var min = parseInt(fromEl.min), max = parseInt(fromEl.max);
    if (fillEl && max > min) {
      fillEl.style.left  = ((fromVal - min) / (max - min) * 100) + "%";
      fillEl.style.right = ((max - toVal)   / (max - min) * 100) + "%";
    }
    if (fromVal === toVal) {
      var last = _csLastMoved["pareto-cs"] || "from";
      fromEl.style.zIndex = (last === "from") ? "5" : "";
      toEl.style.zIndex   = (last === "to")   ? "5" : "";
    } else {
      fromEl.style.zIndex = "";
      toEl.style.zIndex   = "";
    }
    if (fromLbl) fromLbl.innerHTML = stageBadgeHtml(STAGE_ORDER[fromVal] || "");
    if (toLbl)   toLbl.innerHTML   = stageBadgeHtml(STAGE_ORDER[toVal]   || "");
  }

  ["pareto-cs-from", "pareto-cs-to"].forEach(function(csId) {
    var csEl = document.getElementById(csId);
    if (!csEl) return;
    csEl.addEventListener("input", function() {
      var side = csId === "pareto-cs-from" ? "from" : "to";
      _csLastMoved["pareto-cs"] = side;
      var fromEl = document.getElementById("pareto-cs-from");
      var toEl   = document.getElementById("pareto-cs-to");
      if (fromEl && toEl && parseInt(fromEl.value) > parseInt(toEl.value)) {
        if (csId === "pareto-cs-from") fromEl.value = toEl.value;
        else toEl.value = fromEl.value;
      }
      updateStageSliderDisplay();
      renderPareto();
    });
  });
  updateStageSliderDisplay();

  // ── UCH stage slider ────────────────────────────────────────────────────────
  function updateUCHStageSliderDisplay() {
    var fromEl  = document.getElementById("uch-cs-from");
    var toEl    = document.getElementById("uch-cs-to");
    var fillEl  = document.getElementById("uch-cs-fill");
    var fromLbl = document.getElementById("uch-cs-from-lbl");
    var toLbl   = document.getElementById("uch-cs-to-lbl");
    if (!fromEl || !toEl) return;
    var fromVal = parseInt(fromEl.value), toVal = parseInt(toEl.value);
    var min = parseInt(fromEl.min), max = parseInt(fromEl.max);
    if (fillEl && max > min) {
      fillEl.style.left  = ((fromVal - min) / (max - min) * 100) + "%";
      fillEl.style.right = ((max - toVal)   / (max - min) * 100) + "%";
    }
    if (fromVal === toVal) {
      var last = _csLastMoved["uch-cs"] || "from";
      fromEl.style.zIndex = (last === "from") ? "5" : "";
      toEl.style.zIndex   = (last === "to")   ? "5" : "";
    } else {
      fromEl.style.zIndex = "";
      toEl.style.zIndex   = "";
    }
    if (fromLbl) fromLbl.innerHTML = stageBadgeHtml(STAGE_ORDER[fromVal] || "");
    if (toLbl)   toLbl.innerHTML   = stageBadgeHtml(STAGE_ORDER[toVal]   || "");
  }

  ["uch-cs-from", "uch-cs-to"].forEach(function(csId) {
    var csEl = document.getElementById(csId);
    if (!csEl) return;
    csEl.addEventListener("input", function() {
      var side = csId === "uch-cs-from" ? "from" : "to";
      _csLastMoved["uch-cs"] = side;
      var fromEl = document.getElementById("uch-cs-from");
      var toEl   = document.getElementById("uch-cs-to");
      if (fromEl && toEl && parseInt(fromEl.value) > parseInt(toEl.value)) {
        if (csId === "uch-cs-from") fromEl.value = toEl.value;
        else toEl.value = fromEl.value;
      }
      updateUCHStageSliderDisplay();
      renderUCHealth();
    });
  });
  updateUCHStageSliderDisplay();

  // ── Restore saved filter state ─────────────────────────────────────────────
  var _saved = window.APP_FILTER_STATE && window.APP_FILTER_STATE.testing;
  // Ensure testing state object exists so view persists across renderPareto calls
  if (window.APP_FILTER_STATE && !window.APP_FILTER_STATE.testing) {
    window.APP_FILTER_STATE.testing = {};
  }

  // ── UC Health: state + cascade selector ───────────────────────────────────
  var _uchState = { portfolio: "", offer: "", uc: "" };

  function uchSaveState() {
    if (window.APP_FILTER_STATE) {
      var cur = window.APP_FILTER_STATE.testing || {};
      var uchCsFrom = document.getElementById("uch-cs-from");
      var uchCsTo   = document.getElementById("uch-cs-to");
      window.APP_FILTER_STATE.testing = Object.assign({}, cur, {
        view: "uch", uchPortfolio: _uchState.portfolio, uchOffer: _uchState.offer, uchUC: _uchState.uc,
        uchCsFrom: uchCsFrom ? parseInt(uchCsFrom.value) : 0,
        uchCsTo:   uchCsTo   ? parseInt(uchCsTo.value)   : stageMaxIdx
      });
    }
  }

  function uchSlideToStep(step) {
    var track = document.getElementById("uch-slide-track");
    if (!track) return;
    track.style.transform = "translateX(-" + (step * 100) + "%)";
    ["uch-panel-offer", "uch-panel-uc"].forEach(function(id) {
      var p = document.getElementById(id); if (p) p.style.visibility = "";
    });
  }

  function uchBuildPills(panelId, items, selectedValue, onClick) {
    var panel = document.getElementById(panelId);
    if (!panel) return;
    panel.innerHTML = "";
    items.forEach(function(item) {
      var btn = document.createElement("button");
      btn.className = "uch-pill" + (item === selectedValue ? " selected" : "");
      btn.textContent = item;
      btn.addEventListener("click", function() { onClick(item); });
      panel.appendChild(btn);
    });
  }

  function uchUpdateBreadcrumb() {
    var bc = document.getElementById("uch-breadcrumb");
    if (!bc) return;
    var parts = [];

    // Always show a "Portfolios" root link so user can go back to step 0
    if (_uchState.portfolio) {
      parts.push('<span class="uch-bc-step" data-step="back">\u2190 Portfolios</span>');
      parts.push('<span class="uch-bc-sep">›</span>');
      if (_uchState.offer) {
        parts.push('<span class="uch-bc-step" data-step="0">' + escHtml(_uchState.portfolio) + '</span>');
        parts.push('<span class="uch-bc-sep">›</span>');
        if (_uchState.uc) {
          parts.push('<span class="uch-bc-step" data-step="1">' + escHtml(_uchState.offer) + '</span>');
          parts.push('<span class="uch-bc-sep">›</span>');
          parts.push('<span class="uch-bc-current">' + escHtml(_uchState.uc) + '</span>');
        } else {
          parts.push('<span class="uch-bc-current">' + escHtml(_uchState.offer) + '</span>');
        }
      } else {
        parts.push('<span class="uch-bc-current">' + escHtml(_uchState.portfolio) + '</span>');
      }
    } else {
      parts.push('<span class="text-muted">Select a Portfolio</span>');
    }

    bc.innerHTML = parts.join('');
    bc.querySelectorAll(".uch-bc-step").forEach(function(el) {
      el.addEventListener("click", function() {
        var step = this.dataset.step;
        if (step === "back") {
          // Go back to portfolio panel
          _uchState.portfolio = ""; _uchState.offer = ""; _uchState.uc = "";
          uchBuildPills("uch-panel-portfolio", uchPortfolios, "", function(p) {
            _uchState.portfolio = p; _uchState.offer = ""; _uchState.uc = "";
            uchRenderStep(1);
          });
          uchUpdateBreadcrumb();
          uchSlideToStep(0);
          renderUCHealth();
        } else if (step === "0") {
          // Back to offer panel for this portfolio
          _uchState.offer = ""; _uchState.uc = "";
          uchRenderStep(1);
        } else if (step === "1") {
          // Back to UC panel for this offer
          _uchState.uc = "";
          uchRenderStep(2);
        }
      });
    });
  }

  function uchRenderStep(arrivedAtStep) {
    if (arrivedAtStep >= 1) {
      var offers = _uchState.portfolio ? Array.from(uchOffersByPortfolio[_uchState.portfolio] || []).sort() : uchAllOffers;
      uchBuildPills("uch-panel-offer", offers, _uchState.offer, function(o) {
        _uchState.offer = o; _uchState.uc = "";
        uchRenderStep(2);
      });
    }
    if (arrivedAtStep >= 2) {
      (function buildUCPills() {
        var _ucs = _uchState.offer
          ? Array.from(uchUCsByOffer[_uchState.offer] || []).sort()
          : (_uchState.portfolio ? Array.from(uchUCsForPortfolio(_uchState.portfolio)).sort() : uchAllUCs);
        uchBuildPills("uch-panel-uc", _ucs, _uchState.uc, function(u) {
          _uchState.uc = u;
          buildUCPills();
          uchUpdateBreadcrumb();
          uchSaveState();
          renderUCHealth();
        });
      })();
    }
    uchUpdateBreadcrumb();
    uchSlideToStep(arrivedAtStep);
    uchSaveState();
    // Show main row as soon as any selection is made
    var mr = document.getElementById("uch-main-row");
    if (mr) mr.style.display = "";
    renderUCHealth();
  }

  // ── UC Health: donut chart ───────────────────────────────────────────────
  var _uchDonutChart = null;
  var _uchChartView  = "donut";   // "donut" | "funnel"
  var UCH_STAGE_COLORS = {
    "Purchase":  "#e74c3c",
    "Onboard":   "#e07070",
    "Implement": "#e67e22",
    "Use":       "#f0b429",
    "Engage":    "#27ae60",
    "Adopt":     "#2ecc71",
    "Completed": "#1abc9c"
  };

  // Colors for funnel "X completed" bars — reflects progress achieved
  var UCH_FUNNEL_COLORS = {
    "Purchase":  "#e74c3c",  // red  — only Purchase done
    "Onboard":   "#f0b429",  // yellow — mid progress
    "Implement": "#f0b429",  // yellow
    "Use":       "#27ae60",  // green — good progress
    "Engage":    "#27ae60",  // green
    "Adopt":     "#27ae60"   // green
  };

  function renderUCHDonut() {
    var canvas     = document.getElementById("uch-donut-canvas");
    var canvasWrap = document.getElementById("uch-canvas-wrap");
    var funnelDiv  = document.getElementById("uch-funnel-container");
    if (!canvas) return;
    if (canvasWrap) canvasWrap.style.display = "";
    if (funnelDiv)  funnelDiv.style.display  = "none";

    var uchCsFromEl = document.getElementById("uch-cs-from");
    var uchCsToEl   = document.getElementById("uch-cs-to");
    var csFromIdx   = uchCsFromEl ? parseInt(uchCsFromEl.value) : 0;
    var csToIdx     = uchCsToEl   ? parseInt(uchCsToEl.value)   : stageMaxIdx;
    var csActive    = !(csFromIdx === 0 && csToIdx === stageMaxIdx);

    var seenKeys = {};
    var filtered = getEffectiveData().filter(function(r) {
      if (norm(r["Stage"]) !== "ELIGIBLE") return false;
      if (norm(r["Adopt Rebate Opt-In Status"]) !== "OPTED IN") return false;
      if (_uchState.portfolio && r["Deal CPI Portfolio"] !== _uchState.portfolio) return false;
      if (_uchState.offer     && r["Track"]              !== _uchState.offer)     return false;
      if (_uchState.uc        && r["Sub-Track"]          !== _uchState.uc)        return false;
      if (csActive) {
        var si = STAGE_ORDER.indexOf(String(r["Current stage"] || ""));
        if (si === -1 || si < csFromIdx || si > csToIdx) return false;
      }
      var key = String(r["CRPartyID-Offer"] || r["Deal WS-ID"] || "");
      if (key) { if (seenKeys[key]) return false; seenKeys[key] = true; }
      return true;
    });

    var stageCounts = {};
    STAGE_ORDER.forEach(function(s) { stageCounts[s] = 0; });
    filtered.forEach(function(r) {
      var cs = r["Current stage"] || "Unknown";
      if (stageCounts[cs] !== undefined) stageCounts[cs]++;
      else stageCounts[cs] = (stageCounts[cs] || 0) + 1;
    });

    var labels = STAGE_ORDER.filter(function(s) { return stageCounts[s] > 0; });
    var values = labels.map(function(s) { return stageCounts[s]; });
    var colors = labels.map(function(s) { return UCH_STAGE_COLORS[s] || "#adb5bd"; });
    var total  = filtered.length;

    var titleEl = document.getElementById("uch-donut-title");
    if (titleEl) titleEl.textContent = "Stage Distribution (" + total + " deal" + (total !== 1 ? "s" : "") + ")";

    // ── KPI strip ────────────────────────────────────────────────────────────
    var kpiArea = document.getElementById("uch-kpi-area");
    if (kpiArea) {
      if (total === 0) {
        kpiArea.innerHTML = '<span class="text-muted small">No opted-in eligible deals in this selection.</span>';
      } else {
        var daysVals   = filtered.map(function(r){ return r["Days in stage"]; }).filter(function(v){ return v !== null && v !== undefined && !isNaN(v); });
        var avgDaysAll = daysVals.length ? Math.round(daysVals.reduce(function(s,v){return s+v;},0) / daysVals.length) : null;
        var kh = '';
        kh += '<div class="card shadow-sm"><div class="card-body p-3">';
        kh += '<div class="text-muted small mb-1">Opted-in Deals</div><div class="fs-4 fw-bold text-success">' + total + '</div>';
        kh += '</div></div>';
        if (avgDaysAll !== null) {
          kh += '<div class="card shadow-sm"><div class="card-body p-3">';
          kh += '<div class="text-muted small mb-1">Avg Days in Stage</div><div class="fs-4 fw-bold">' + avgDaysAll + '</div>';
          kh += '</div></div>';
        }
        var uchPreset = { stage: ["Eligible"], optIn: ["OPTED IN"], sortField: "Potential Incentives", sortDir: "desc" };
        if (_uchState.portfolio) uchPreset.portfolio = _uchState.portfolio;
        if (_uchState.offer)     uchPreset.offer     = _uchState.offer;
        if (_uchState.uc)        uchPreset.uc        = _uchState.uc;
        if (csActive)            { uchPreset.csFrom  = csFromIdx; uchPreset.csTo = csToIdx; }
        kh += '<a href="#" id="uch-deeplink" class="small"><i class="bi bi-box-arrow-up-right me-1"></i>Open in Details tab</a>';
        kpiArea.innerHTML = kh;
        var dlLink = document.getElementById("uch-deeplink");
        if (dlLink) dlLink.addEventListener("click", function(e) { e.preventDefault(); window.navigateToDetails(uchPreset); });
      }
    }

    if (_uchDonutChart) { _uchDonutChart.destroy(); _uchDonutChart = null; }
    if (total === 0) return;

    _uchDonutChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: "#fff", hoverOffset: 6 }]
      },
      options: {
        cutout: "62%",
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                var pct = total > 0 ? Math.round(ctx.parsed / total * 100) : 0;
                return ctx.label + ": " + ctx.parsed + " (" + pct + "%)";
              }
            }
          }
        }
      }
    });
  }

  function renderUCHFunnel() {
    var canvasWrap = document.getElementById("uch-canvas-wrap");
    var container  = document.getElementById("uch-funnel-container");
    if (!container) return;
    if (canvasWrap) canvasWrap.style.display = "none";
    container.style.display = "";
    if (_uchDonutChart) { _uchDonutChart.destroy(); _uchDonutChart = null; }

    var uchCsFromEl = document.getElementById("uch-cs-from");
    var uchCsToEl   = document.getElementById("uch-cs-to");
    var csFromIdx   = uchCsFromEl ? parseInt(uchCsFromEl.value) : 0;
    var csToIdx     = uchCsToEl   ? parseInt(uchCsToEl.value)   : stageMaxIdx;
    var csActive    = !(csFromIdx === 0 && csToIdx === stageMaxIdx);

    var seenKeys = {};
    var filtered = getEffectiveData().filter(function(r) {
      if (norm(r["Stage"]) !== "ELIGIBLE") return false;
      if (norm(r["Adopt Rebate Opt-In Status"]) !== "OPTED IN") return false;
      if (_uchState.portfolio && r["Deal CPI Portfolio"] !== _uchState.portfolio) return false;
      if (_uchState.offer     && r["Track"]              !== _uchState.offer)     return false;
      if (_uchState.uc        && r["Sub-Track"]          !== _uchState.uc)        return false;
      if (csActive) {
        var si = STAGE_ORDER.indexOf(String(r["Current stage"] || ""));
        if (si === -1 || si < csFromIdx || si > csToIdx) return false;
      }
      var key = String(r["CRPartyID-Offer"] || r["Deal WS-ID"] || "");
      if (key) { if (seenKeys[key]) return false; seenKeys[key] = true; }
      return true;
    });

    var stageCounts = {};
    STAGE_ORDER.forEach(function(s) { stageCounts[s] = 0; });
    filtered.forEach(function(r) {
      var cs = r["Current stage"] || "Unknown";
      if (stageCounts[cs] !== undefined) stageCounts[cs]++;
      else stageCounts[cs] = (stageCounts[cs] || 0) + 1;
    });

    // Build cumulative funnel rows:
    // Row 0 = all total; rows 1..N = "X completed" (current stage index > i)
    // Exclude "Completed" from labels since it is already the terminal state
    var total    = filtered.length;
    var funnelRows = [];
    funnelRows.push({ label: "All Eligible Opted-in", count: total, color: "#0d6efd" });
    for (var fi = 0; fi < STAGE_ORDER.length - 1; fi++) {
      var completedStage = STAGE_ORDER[fi];
      var cumCount = 0;
      for (var fj = fi + 1; fj < STAGE_ORDER.length; fj++) {
        cumCount += (stageCounts[STAGE_ORDER[fj]] || 0);
      }
      if (cumCount > 0) {
        funnelRows.push({
          label: completedStage + " \u2713",
          count: cumCount,
          color: UCH_FUNNEL_COLORS[completedStage] || "#adb5bd"
        });
      }
    }

    var titleEl = document.getElementById("uch-donut-title");
    if (titleEl) titleEl.textContent = "Stage Distribution (" + total + " deal" + (total !== 1 ? "s" : "") + ")";

    // ── KPI strip (same as donut) ─────────────────────────────────────────────
    var kpiArea = document.getElementById("uch-kpi-area");
    if (kpiArea) {
      if (total === 0) {
        kpiArea.innerHTML = '<span class="text-muted small">No opted-in eligible deals in this selection.</span>';
      } else {
        var daysVals   = filtered.map(function(r){ return r["Days in stage"]; }).filter(function(v){ return v !== null && v !== undefined && !isNaN(v); });
        var avgDaysAll = daysVals.length ? Math.round(daysVals.reduce(function(s,v){return s+v;},0) / daysVals.length) : null;
        var kh = '';
        kh += '<div class="card shadow-sm"><div class="card-body p-3">';
        kh += '<div class="text-muted small mb-1">Opted-in Deals</div><div class="fs-4 fw-bold text-success">' + total + '</div>';
        kh += '</div></div>';
        if (avgDaysAll !== null) {
          kh += '<div class="card shadow-sm"><div class="card-body p-3">';
          kh += '<div class="text-muted small mb-1">Avg Days in Stage</div><div class="fs-4 fw-bold">' + avgDaysAll + '</div>';
          kh += '</div></div>';
        }
        var uchPreset = { stage: ["Eligible"], optIn: ["OPTED IN"], sortField: "Potential Incentives", sortDir: "desc" };
        if (_uchState.portfolio) uchPreset.portfolio = _uchState.portfolio;
        if (_uchState.offer)     uchPreset.offer     = _uchState.offer;
        if (_uchState.uc)        uchPreset.uc        = _uchState.uc;
        if (csActive)            { uchPreset.csFrom  = csFromIdx; uchPreset.csTo = csToIdx; }
        kh += '<a href="#" id="uch-deeplink" class="small"><i class="bi bi-box-arrow-up-right me-1"></i>Open in Details tab</a>';
        kpiArea.innerHTML = kh;
        var dlLink = document.getElementById("uch-deeplink");
        if (dlLink) dlLink.addEventListener("click", function(e) { e.preventDefault(); window.navigateToDetails(uchPreset); });
      }
    }

    if (total === 0) {
      container.innerHTML = '<p class="text-muted small text-center mt-3">No opted-in eligible deals.</p>';
      return;
    }

    var funnelWidthPx = Math.max(240, container.clientWidth || 260);
    var measureCanvas = document.createElement("canvas");
    var measureCtx = measureCanvas.getContext("2d");
    var canMeasureText = !!measureCtx;
    if (measureCtx) {
      measureCtx.font = "600 10px sans-serif";
    }
    var fh = '<div style="padding:8px 0;width:100%;">';
    funnelRows.forEach(function(row) {
      var pct    = total > 0 ? Math.round(row.count / total * 100) : 0;
      var widPct = total > 0 ? Math.max(2, Math.round(row.count / total * 100)) : 100;
      var tooltip = row.label === "All Eligible Opted-in" ? row.label : row.label.replace(" \u2713", " completed");
      var countText = row.count + " (" + pct + "%)";
      var barInnerWidth = (funnelWidthPx * widPct / 100) - 16;
      var narrow;
      if (canMeasureText) {
        var labelWidth = measureCtx.measureText(row.label).width;
        measureCtx.font = "10px sans-serif";
        var countWidth = measureCtx.measureText(countText).width;
        measureCtx.font = "600 10px sans-serif";
        narrow = (labelWidth + countWidth + 14) > barInnerWidth;
      } else {
        narrow = (widPct / 100 * funnelWidthPx) < (row.label.length * 6.5 + 55);
      }
      // Row wrapper — bar is absolutely centered, label pinned to its right edge
      fh += '<div style="position:relative;width:100%;height:26px;margin-bottom:3px;" title="' + escHtml(tooltip) + ': ' + row.count + ' deals (' + pct + '%)">';
      // Centered colored bar
      fh += '<div style="position:absolute;left:50%;transform:translateX(-50%);width:' + widPct + '%;height:100%;';
      fh += 'background:' + row.color + ';border-radius:3px;box-sizing:border-box;overflow:hidden;';
      if (!narrow) {
        fh += 'display:flex;align-items:center;justify-content:space-between;padding:4px 8px;';
      }
      fh += '">';
      if (!narrow) {
        fh += '<span style="color:#fff;font-size:10px;font-weight:600;white-space:nowrap;flex-shrink:1;min-width:0;">' + escHtml(row.label) + '</span>';
        fh += '<span style="color:rgba(255,255,255,0.9);font-size:10px;white-space:nowrap;flex-shrink:0;margin-left:4px;">' + row.count + '<span style="opacity:0.75"> (' + pct + '%)</span></span>';
      }
      fh += '</div>';
      // Outside label anchored to the right edge of the bar
      if (narrow) {
        fh += '<span style="position:absolute;left:calc(50% + ' + (widPct / 2) + '% + 6px);top:50%;transform:translateY(-50%);';
        fh += 'font-size:10px;white-space:nowrap;color:#495057;">';
        fh += escHtml(row.label) + ' <strong>' + row.count + '</strong><span style="color:#6c757d"> (' + pct + '%)</span>';
        fh += '</span>';
      }
      fh += '</div>';
    });
    fh += '</div>';
    container.innerHTML = fh;
  }

  function renderUCHChart() {
    if (_uchChartView === "funnel") renderUCHFunnel();
    else                            renderUCHDonut();
  }

  function renderUCHealth() {
    var portfolio  = _uchState.portfolio;
    var offer      = _uchState.offer;
    var uc         = _uchState.uc;
    var statsEl    = document.getElementById("uch-stats");
    if (!statsEl) return;

    var uchCsFromEl = document.getElementById("uch-cs-from");
    var uchCsToEl   = document.getElementById("uch-cs-to");
    var csFromIdx   = uchCsFromEl ? parseInt(uchCsFromEl.value) : 0;
    var csToIdx     = uchCsToEl   ? parseInt(uchCsToEl.value)   : stageMaxIdx;
    var csActive    = !(csFromIdx === 0 && csToIdx === stageMaxIdx);

    uchSaveState();
    var uchCsWrap = document.getElementById("uch-cs-wrap");
    if (uchCsWrap) uchCsWrap.style.display = "";

    if (!uc) {
      // No UC selected — show aggregated stage breakdown for the current portfolio/offer selection
      var seenKeys = {};
      var aggDeals = getEffectiveData().filter(function(r) {
        if (norm(r["Stage"]) !== "ELIGIBLE") return false;
        if (norm(r["Adopt Rebate Opt-In Status"]) !== "OPTED IN") return false;
        if (portfolio && r["Deal CPI Portfolio"] !== portfolio) return false;
        if (offer && r["Track"] !== offer) return false;
        if (csActive) {
          var si = STAGE_ORDER.indexOf(String(r["Current stage"] || ""));
          if (si === -1 || si < csFromIdx || si > csToIdx) return false;
        }
        var key = String(r["CRPartyID-Offer"] || r["Deal WS-ID"] || "");
        if (key) { if (seenKeys[key]) return false; seenKeys[key] = true; }
        return true;
      });
      var aggStageGroups = {};
      aggDeals.forEach(function(r) {
        var cs = r["Current stage"] || "Unknown";
        if (!aggStageGroups[cs]) aggStageGroups[cs] = [];
        aggStageGroups[cs].push(r);
      });
      var aggStages = STAGE_ORDER.filter(function(s) { return aggStageGroups[s] && aggStageGroups[s].length > 0; });
      var ah = '<div class="row g-3">';
      ah += '<div class="col-12 col-lg-4"><div class="card shadow-sm h-100"><div class="card-body">';
      ah += '<h6 class="card-title mb-3">Stage Breakdown</h6>';
      if (aggStages.length > 0) {
        ah += '<table class="table table-sm table-hover mb-0" style="table-layout:fixed"><colgroup><col style="width:50%"><col style="width:20%"><col style="width:30%"></colgroup>';
        ah += '<thead><tr><th>Stage</th><th class="text-end">Deals</th><th class="text-end">Avg Days</th></tr></thead><tbody>';
        aggStages.forEach(function(stage) {
          var rows = aggStageGroups[stage];
          var sd = rows.map(function(r) { return r["Days in stage"]; }).filter(function(v) { return v !== null && v !== undefined && !isNaN(v); });
          var sa = sd.length ? Math.round(sd.reduce(function(s, v) { return s + v; }, 0) / sd.length) : null;
          ah += '<tr><td>' + stageBadgeHtml(stage) + '</td><td class="text-end">' + rows.length + '</td>';
          ah += '<td class="text-end">' + (sa !== null ? sa + 'd' : '—') + '</td></tr>';
        });
        ah += '</tbody></table>';
      } else {
        ah += '<p class="text-muted small">No opted-in eligible deals in this selection.</p>';
      }
      ah += '</div></div></div>';
      ah += '<div class="col-12 col-lg-8"><div class="card shadow-sm h-100"><div class="card-body">';
      ah += '<h6 class="card-title mb-3">Top Pending Tasks</h6>';
      ah += '<p class="text-muted small">Select a Use Case to see pending task details.</p>';
      ah += '</div></div></div>';
      ah += '</div>';
      statsEl.innerHTML = ah;
      renderUCHChart();
      return;
    }

    var seenKeys = {};
    var deals = getEffectiveData().filter(function(r) {
      if (norm(r["Stage"]) !== "ELIGIBLE") return false;
      if (norm(r["Adopt Rebate Opt-In Status"]) !== "OPTED IN") return false;
      if (portfolio && r["Deal CPI Portfolio"] !== portfolio) return false;
      if (offer && r["Track"] !== offer) return false;
      if (r["Sub-Track"] !== uc) return false;
      if (csActive) {
        var si = STAGE_ORDER.indexOf(String(r["Current stage"] || ""));
        if (si === -1 || si < csFromIdx || si > csToIdx) return false;
      }
      var key = String(r["CRPartyID-Offer"] || r["Deal WS-ID"] || "");
      if (key) { if (seenKeys[key]) return false; seenKeys[key] = true; }
      return true;
    });

    if (deals.length === 0) {
      statsEl.innerHTML = '';
      return;
    }

    var totalDeals = deals.length;

    var stageGroups = {};
    deals.forEach(function(r) {
      var cs = r["Current stage"] || "Unknown";
      if (!stageGroups[cs]) stageGroups[cs] = [];
      stageGroups[cs].push(r);
    });

    var taskData = {};
    deals.forEach(function(r) {
      var cs    = r["Current stage"] || "Unknown";
      var tasks = r["Current stage pending tasks"];
      if (!tasks) return;
      tasks.split(";").forEach(function(t) {
        var tn = t.trim().replace(/ - \d+$/, "").trim();
        if (!tn) return;
        if (!taskData[tn]) taskData[tn] = { count: 0, stages: {} };
        taskData[tn].count++;
        taskData[tn].stages[cs] = true;
      });
    });
    var topTasks = Object.keys(taskData).map(function(t){ return { name: t, count: taskData[t].count, stages: Object.keys(taskData[t].stages) }; });
    topTasks.sort(function(a,b){ return b.count - a.count; });

    var stagesPresent = STAGE_ORDER.filter(function(s){ return stageGroups[s] && stageGroups[s].length > 0; });
    var h = '';
    h += '<div class="row g-3">';

    h += '<div class="col-12 col-lg-4"><div class="card shadow-sm h-100"><div class="card-body">';
    h += '<h6 class="card-title mb-3">Stage Breakdown</h6>';
    if (stagesPresent.length > 0) {
      h += '<table class="table table-sm table-hover mb-0" style="table-layout:fixed"><colgroup><col style="width:50%"><col style="width:20%"><col style="width:30%"></colgroup><thead><tr><th>Stage</th><th class="text-end">Deals</th><th class="text-end">Avg Days</th></tr></thead><tbody>';
      stagesPresent.forEach(function(stage) {
        var rows = stageGroups[stage];
        var sd = rows.map(function(r){ return r["Days in stage"]; }).filter(function(v){ return v !== null && v !== undefined && !isNaN(v); });
        var sa = sd.length ? Math.round(sd.reduce(function(s,v){return s+v;},0)/sd.length) : null;
        h += '<tr><td>' + stageBadgeHtml(stage) + '</td><td class="text-end">' + rows.length + '</td>';
        h += '<td class="text-end">' + (sa !== null ? sa + 'd' : '—') + '</td></tr>';
      });
      h += '</tbody></table>';
    } else { h += '<p class="text-muted small">No stage data available.</p>'; }
    h += '</div></div></div>';

    h += '<div class="col-12 col-lg-8"><div class="card shadow-sm h-100"><div class="card-body">';
    h += '<h6 class="card-title mb-3">Top Pending Tasks</h6>';
    if (topTasks.length > 0) {
      h += '<div class="d-flex flex-column gap-2">';
      topTasks.slice(0, 10).forEach(function(task) {
        var pct = Math.round(task.count / totalDeals * 100);
        var stageSorted = task.stages.slice().sort(function(a, b) {
          return STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b);
        });
        var stageTags = stageSorted.map(function(s) { return stageBadgeHtml(s); }).join(" ");
        h += '<div>';
        h += '<div class="d-flex align-items-center small mb-1" style="min-width:0">';
        h += '<span class="text-truncate me-1" style="min-width:0;flex-shrink:1" title="' + escHtml(task.name) + '">' + escHtml(task.name) + '</span>';
        h += '<span class="d-flex align-items-center gap-1 flex-shrink-0 me-2">' + stageTags + '</span>';
        h += '<span class="text-muted flex-shrink-0 ms-auto">' + task.count + ' deal' + (task.count !== 1 ? 's' : '') + ' (' + pct + '%)</span>';
        h += '</div>';
        h += '<div class="progress" style="height:5px"><div class="progress-bar bg-warning" role="progressbar" style="width:' + pct + '%"></div></div>';
        h += '</div>';
      });
      h += '</div>';
    } else { h += '<p class="text-muted small">No pending tasks found.</p>'; }
    h += '</div></div></div>';
    h += '</div>';

    statsEl.innerHTML = h;
    renderUCHChart();
  }

  // View switcher — tracks which subtab is currently active
  var _activeSubView = "cpi";
  function showSubView(view) {
    _activeSubView = view;
    document.getElementById("testing-view-cpi").style.display        = view === "cpi"       ? "" : "none";
    document.getElementById("testing-view-pareto").style.display     = view === "pareto"    ? "" : "none";
    document.getElementById("testing-view-uch").style.display        = view === "uch"       ? "" : "none";
    document.getElementById("testing-view-lifecycle").style.display  = view === "lifecycle" ? "" : "none";
    ["tab-btn-cpi","tab-btn-pareto","tab-btn-uch","tab-btn-lifecycle"].forEach(function(id) {
      var btn = document.getElementById(id);
      if (btn) btn.classList.toggle("active", id === "tab-btn-" + view);
    });
    if (window.APP_FILTER_STATE && window.APP_FILTER_STATE.testing) window.APP_FILTER_STATE.testing.view = view;
  }

  // Initial render (deferred — Pareto view is hidden by default, render on tab click)
  // renderPareto() called lazily when Pareto sub-tab is activated

  // Restore slicer values after initial render (DOM now exists)
  if (_saved) {
    var pfSel = document.getElementById("pareto-portfolio");
    if (_saved.portfolio && pfSel) {
      pfSel.value = _saved.portfolio;
      var offerSel2 = document.getElementById("pareto-offer");
      offerSel2.innerHTML = '<option value="">All Offers</option>';
      var savedOffers = _saved.portfolio ? Array.from(offersByPortfolio[_saved.portfolio] || []).sort() : allOffers;
      savedOffers.forEach(function(o){ offerSel2.innerHTML += '<option value="' + escHtml(o) + '">' + escHtml(o) + '</option>'; });
    }
    if (_saved.offer)  document.getElementById("pareto-offer").value  = _saved.offer;
    if (_saved.topN)   document.getElementById("pareto-topn").value   = _saved.topN;
    if (_saved.mode)   document.getElementById("pareto-mode").value   = _saved.mode;
    if (_saved.csFrom !== undefined) { var _csf = document.getElementById("pareto-cs-from"); if (_csf) _csf.value = _saved.csFrom; }
    if (_saved.csTo   !== undefined) { var _cst = document.getElementById("pareto-cs-to");   if (_cst) _cst.value = _saved.csTo;   }

    // Restore UCH state
    if (_saved.uchPortfolio || _saved.uchOffer || _saved.uchUC) {
      _uchState.portfolio = _saved.uchPortfolio || "";
      _uchState.offer     = _saved.uchOffer     || "";
      _uchState.uc        = _saved.uchUC        || "";
    }
    // Restore UCH stage slider
    if (_saved.uchCsFrom !== undefined) { var _ucf = document.getElementById("uch-cs-from"); if (_ucf) _ucf.value = _saved.uchCsFrom; }
    if (_saved.uchCsTo   !== undefined) { var _uct = document.getElementById("uch-cs-to");   if (_uct) _uct.value = _saved.uchCsTo;   }
    updateUCHStageSliderDisplay();
  }

  // Bootstrap portfolio pills (always) — then restore slide position if needed
  uchBuildPills("uch-panel-portfolio", uchPortfolios, _uchState.portfolio, function(p) {
    _uchState.portfolio = p; _uchState.offer = ""; _uchState.uc = "";
    uchRenderStep(1);
  });
  uchUpdateBreadcrumb();
  renderUCHealth();
  if (_uchState.portfolio) {
    var _restoreStep = _uchState.uc ? 2 : (_uchState.offer ? 2 : 1);
    uchRenderStep(_restoreStep);
  }

  // ── Chart-type toggle buttons ─────────────────────────────────────────────
  var _donutBtn  = document.getElementById("uch-chart-donut-btn");
  var _funnelBtn = document.getElementById("uch-chart-funnel-btn");
  if (_donutBtn && _funnelBtn) {
    _donutBtn.addEventListener("click", function() {
      _uchChartView = "donut";
      _donutBtn.classList.add("active");
      _funnelBtn.classList.remove("active");
      renderUCHChart();
    });
    _funnelBtn.addEventListener("click", function() {
      _uchChartView = "funnel";
      _funnelBtn.classList.add("active");
      _donutBtn.classList.remove("active");
      renderUCHChart();
    });
  }

  // Pareto slicer events
  document.getElementById("pareto-mode").addEventListener("change", renderPareto);
  document.getElementById("pareto-portfolio").addEventListener("change", function() {
    var pf = this.value;
    var offerSel = document.getElementById("pareto-offer");
    offerSel.innerHTML = '<option value="">All Offers</option>';
    var offers = pf ? Array.from(offersByPortfolio[pf] || []).sort() : allOffers;
    offers.forEach(function(o){ offerSel.innerHTML += '<option value="' + escHtml(o) + '">' + escHtml(o) + '</option>'; });
    renderPareto();
  });
  document.getElementById("pareto-offer").addEventListener("change", renderPareto);
  document.getElementById("pareto-topn").addEventListener("change", renderPareto);

  document.getElementById("tab-btn-cpi").addEventListener("click", function() {
    showSubView("cpi");
    renderCPIAdopt(getEffectiveData());
  });
  document.getElementById("tab-btn-pareto").addEventListener("click", function() {
    var nav = document.getElementById("cpi-scroll-nav"); if (nav) nav.remove();
    showSubView("pareto");
    renderPareto();
  });
  document.getElementById("tab-btn-uch").addEventListener("click", function() {
    var nav = document.getElementById("cpi-scroll-nav"); if (nav) nav.remove();
    showSubView("uch");
  });
  document.getElementById("tab-btn-lifecycle").addEventListener("click", function() {
    var nav = document.getElementById("cpi-scroll-nav"); if (nav) nav.remove();
    showSubView("lifecycle");
    renderLifecycle(getEffectiveData());
  });

  // Restore active sub-view (or default to CPI Adopt)
  var savedView = _saved && _saved.view;
  if (savedView === "pareto") {
    showSubView("pareto");
    if (_saved.portfolio || _saved.offer || _saved.topN || _saved.mode || _saved.csFrom !== undefined) {
      updateStageSliderDisplay();
    }
    renderPareto();
  } else if (savedView === "uch") {
    showSubView("uch");
  } else if (savedView === "lifecycle") {
    showSubView("lifecycle");
    renderLifecycle(getEffectiveData());
  } else {
    showSubView("cpi");
    renderCPIAdopt(getEffectiveData());
  }
}

window.renderInsights = renderTesting;
