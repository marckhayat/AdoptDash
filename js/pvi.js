// =============================================================================
// pvi.js — PVI (Partner Value Index) tab renderer
// =============================================================================

function renderPVI(data) {
  var el = document.getElementById("tab-pvi");
  if (!el) return;

  // Require a single BE GEO ID to be selected when multiple IDs are present
  var allGeoIds = [];
  if (window.APP_DATA) window.APP_DATA.forEach(function(r) { var v = String(r["BE GEO ID"] || "").trim(); if (v && allGeoIds.indexOf(v) === -1) allGeoIds.push(v); });
  if (!window.APP_GEO_FILTER && allGeoIds.length > 1) {
    el.innerHTML = '<div class="text-danger p-3 text-start blink">Select a BE GEO ID from the top bar to view PVI data <i class="bi bi-arrow-up ms-1"></i></div>';
    return;
  }

  var PORTFOLIOS = ["Networking", "Security", "Cloud + AI Infrastructure"];

  function norm(x) {
    if (x === null || x === undefined) return "";
    return String(x).replace(/\u00A0/g, " ").trim().toUpperCase();
  }

  function fmtCurrency(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return "$" + Math.round(v).toLocaleString();
  }

  function fmtPct(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return (v * 100).toFixed(2) + "%";
  }

  function scoreClass(s) {
    if (s === null || s === undefined) return "";
    if (s >= 7.5) return "score-green";
    if (s >= 5.0) return "score-orange";
    return "score-red";
  }

  // Helper: sum booking amount deduplicated by Deal WS-ID
  function sumBooking(rows) {
    var seen = new Set();
    var total = 0;
    rows.forEach(function (r) {
      var dealId = r["Deal WS-ID"];
      if (dealId && seen.has(dealId)) return;
      if (dealId) seen.add(dealId);
      var amt = parseFloat(r["Booking Amount - Net to Cisco"]);
      total += (isNaN(amt) ? 0 : amt);
    });
    return total;
  }

  // ── Compute PVI metrics per portfolio
  function computeDomain(portfolio) {
    var eligRows    = data.filter(function (r) { return r["PVI Eligible"] === true && norm(r["Deal CPI Portfolio"]) === norm(portfolio); });
    var onbRows     = data.filter(function (r) { return r["PVI Onboard"]  === true && norm(r["Deal CPI Portfolio"]) === norm(portfolio); });
    var adpRows     = data.filter(function (r) { return r["PVI Adopt"]    === true && norm(r["Deal CPI Portfolio"]) === norm(portfolio); });

    var eligUC      = new Set(eligRows.map(function (r) { return r["CRPartyID-Offer"]; })).size;
    var eligBook    = sumBooking(eligRows);
    var onbUC       = onbRows.length;
    var onbBook     = sumBooking(onbRows);
    var adpUC       = adpRows.length;
    var adpBook     = sumBooking(adpRows);

    var onbRatio    = eligBook > 0 ? onbBook / eligBook : null;
    var adpRatio    = eligBook > 0 ? adpBook / eligBook : null;

    var onbScore    = eligBook > 0 ? lookupPVIScore(portfolio, "Onboard", onbRatio) : null;
    var adpScore    = eligBook > 0 ? lookupPVIScore(portfolio, "Adopt",   adpRatio) : null;
    var totalScore  = (onbScore !== null && adpScore !== null) ? (onbScore + adpScore) / 2 : null;

    return { portfolio, eligUC, eligBook, onbUC, onbBook, adpUC, adpBook, onbRatio, adpRatio, onbScore, adpScore, totalScore };
  }

  // ── Build HTML
  var html = '<div class="disclaimer-card mb-3">';
  html += '<i class="bi bi-info-circle me-1"></i>Partners should rely on <strong><a href="https://cisco-pxp.my.site.com/pxp/s/" target="_blank" rel="noopener">PXP (Partner Experience Platform)</a></strong> for official PVI scores. ';
  html += 'The below is an indication of the Engagement score based on current CPI performance. Score may differ slightly from PXP due to the timing of data capture.';
  html += '</div>';

  html += '<div class="row g-3" id="pvi-portfolios">';
  PORTFOLIOS.forEach(function (portfolio, i) {
    var slug = portfolio.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    html += '<div class="col-12 col-lg-4">';
    html += '<div class="card h-100 shadow-sm">';
    html += '<div class="card-header fw-bold" style="background:var(--cisco-dark);color:#fff">' + portfolio + '</div>';
    html += '<div class="card-body p-3">';
    html += '<div id="pvi-metrics-' + slug + '"></div>';
    html += '<hr/>';
    html += '<div class="mb-2"><strong class="small text-uppercase" style="letter-spacing:.04em">Simulation</strong></div>';
    html += '<div class="mb-3 small">';
    html += '<label class="d-flex justify-content-between"><span>Target Onboard Booking</span><strong id="sim-onb-lbl-' + slug + '">$0</strong></label>';
    html += '<input type="range" id="sim-onb-' + slug + '" class="form-range" min="0" max="100" step="1" value="0"/>';
    html += '</div>';
    html += '<div class="mb-2 small">';
    html += '<label class="d-flex justify-content-between"><span>Target Adopt Booking</span><strong id="sim-adp-lbl-' + slug + '">$0</strong></label>';
    html += '<input type="range" id="sim-adp-' + slug + '" class="form-range" min="0" max="100" step="1" value="0"/>';
    html += '</div>';
    html += '<div id="sim-result-' + slug + '" class="mt-2"></div>';
    html += '</div></div></div>';
  });
  html += '</div>';

  html += '<div class="mt-3 p-3 rounded" style="background:#f8f9fa;border:1px solid #dee2e6;font-size:0.82rem">';
  html += '<div class="fw-semibold mb-2">PVI Engagement calculation:</div>';
  html += '<ul class="mb-2 ps-3">';
  html += '<li>Only considers eligible UCs that have a booking date within the past 18 fiscal months.</li>';
  html += '<li>1 UC per offer is selected. Priority is given to the opted-in UC. If no UC is opted-in, the UC with the highest incentive amount is selected.</li>';
  html += '<li>A UC that completes the Adopt phase will become Not Eligible if it is not opted-in, and will not be included in PVI calculations.</li>';
  html += '</ul>';
  html += '<a href="https://ebooks.cisco.com/story/360-partner-program-partner-value-index-cisco-partner-incentive-metrics-guide/page/1" target="_blank" rel="noopener" class="small"><i class="bi bi-box-arrow-up-right me-1"></i>PVI Metrics Guide</a>';
  html += '</div>';

  el.innerHTML = html;

  // ── Render each portfolio
  PORTFOLIOS.forEach(function (portfolio) {
    var slug = portfolio.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    var m = computeDomain(portfolio);

    var noData = m.eligUC === 0;
    var naStr  = '<span class="text-muted">N/A</span>';

    // Build deep-link onclick strings for each PVI metric row
    var pfQ = portfolio.replace(/'/g, "\\'");
    function pviLink(checkboxId, label) {
      return '<a href="#" class="ovw-drilldown-link" ' +
        'onclick="event.preventDefault();window.navigateToDetails({portfolio:\'' + pfQ + '\',checkboxIds:[\'' + checkboxId + '\']})" ' +
        'title="Open Details tab filtered to ' + portfolio + ' · ' + label + '">' + label + '</a>';
    }

    var metricsHtml = '<table class="table table-sm mb-0" style="font-size:0.82rem">';
    metricsHtml += '<tbody>';
    metricsHtml += '<tr><td>' + pviLink('filter-pvi-Eligible', 'Eligible UCs') + '</td><td class="text-end fw-semibold">' + m.eligUC + '</td><td class="text-end">' + fmtCurrency(m.eligBook) + '</td></tr>';
    metricsHtml += '<tr><td>' + pviLink('filter-pvi-Onboard', 'Eligible UCs Onboarded') + '</td><td class="text-end">' + m.onbUC + '</td><td class="text-end">' + fmtCurrency(m.onbBook) + '</td></tr>';
    metricsHtml += '<tr><td>Ratio Onboarded</td><td colspan="2" class="text-end">' + (noData ? naStr : fmtPct(m.onbRatio)) + '</td></tr>';
    metricsHtml += '<tr><td>PVI Engagement - Onboard (/10)</td><td colspan="2" class="text-end"><span style="font-size:1.4rem">' + (m.onbScore !== null ? m.onbScore : "N/A") + '</span></td></tr>';
    metricsHtml += '<tr><td>' + pviLink('filter-pvi-Adopt', 'Eligible UCs Adopted') + '</td><td class="text-end">' + m.adpUC + '</td><td class="text-end">' + fmtCurrency(m.adpBook) + '</td></tr>';
    metricsHtml += '<tr><td>Ratio Adopted</td><td colspan="2" class="text-end">' + (noData ? naStr : fmtPct(m.adpRatio)) + '</td></tr>';
    metricsHtml += '<tr><td>PVI Engagement - Adopt (/10)</td><td colspan="2" class="text-end"><span style="font-size:1.4rem">' + (m.adpScore !== null ? m.adpScore : "N/A") + '</span></td></tr>';
    metricsHtml += '<tr class="table-active"><td class="fw-bold">PVI Engagement Total (/10)</td><td colspan="2" class="text-end"><span class="pvi-score-total fw-bold ' + scoreClass(m.totalScore) + '">' + (m.totalScore !== null ? m.totalScore.toFixed(1) : "N/A") + '</span></td></tr>';
    metricsHtml += '</tbody></table>';
    document.getElementById("pvi-metrics-" + slug).innerHTML = metricsHtml;

    // Wire up simulation sliders (0–100% of eligible booking)
    function updateSim() {
      var eligBook = m.eligBook;
      var onbPct = parseFloat(document.getElementById("sim-onb-" + slug).value) / 100;
      var adpPct = parseFloat(document.getElementById("sim-adp-" + slug).value) / 100;
      var simOnb = eligBook * onbPct;
      var simAdp = eligBook * adpPct;
      document.getElementById("sim-onb-lbl-" + slug).textContent = "$" + Math.round(simOnb).toLocaleString();
      document.getElementById("sim-adp-lbl-" + slug).textContent = "$" + Math.round(simAdp).toLocaleString();
      if (eligBook <= 0) {
        document.getElementById("sim-result-" + slug).innerHTML = '<p class="text-muted small">No eligible booking to simulate against.</p>';
        return;
      }
      var simOnbScore = lookupPVIScore(portfolio, "Onboard", onbPct);
      var simAdpScore = lookupPVIScore(portfolio, "Adopt",   adpPct);
      var simTotal    = (simOnbScore + simAdpScore) / 2;
      var html = '<div class="d-flex gap-3 flex-wrap">';
      html += '<div class="text-center"><div class="small text-muted">Sim Onboard</div><div style="font-size:1.4rem">' + simOnbScore + '</div></div>';
      html += '<div class="text-center"><div class="small text-muted">Sim Adopt</div><div style="font-size:1.4rem">' + simAdpScore + '</div></div>';
      html += '<div class="text-center"><div class="small text-muted fw-bold">Sim Total</div><div class="fw-bold ' + scoreClass(simTotal) + '" style="font-size:1.4rem">' + simTotal.toFixed(1) + '</div></div>';
      html += '</div>';
      document.getElementById("sim-result-" + slug).innerHTML = html;
    }

    document.getElementById("sim-onb-" + slug).addEventListener("input", updateSim);
    document.getElementById("sim-adp-" + slug).addEventListener("input", updateSim);

    // Set sliders to current actual values, then show initial simulation
    if (m.eligBook > 0) {
      document.getElementById("sim-onb-" + slug).value = Math.round((m.onbBook / m.eligBook) * 100);
      document.getElementById("sim-adp-" + slug).value = Math.round((m.adpBook / m.eligBook) * 100);
    }
    updateSim();
  });
}

window.renderPVI = renderPVI;
