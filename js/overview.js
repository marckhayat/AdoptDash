// =============================================================================
// overview.js — Overview tab renderer
// =============================================================================

function renderOverview(data) {
  var el = document.getElementById("tab-overview");
  if (!el) return;

  // ── Helpers
  function norm(x) {
    if (x === null || x === undefined) return "";
    return String(x).replace(/\u00A0/g, " ").trim().toUpperCase();
  }
  function fmtCurrency(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return "$" + Math.round(v).toLocaleString();
  }
  function fmtCount(v) { return v || "-"; }
  function escHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function toDate(x) {
    if (!x) return null;
    if (x instanceof Date) return isNaN(x.getTime()) ? null : x;
    if (typeof x === "number" && x > 1000) {
      var d = new Date(Math.round((x - 25569) * 86400 * 1000));
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof x === "string" && x.trim()) {
      var d2 = new Date(x);
      return isNaN(d2.getTime()) ? null : d2;
    }
    return null;
  }
  function fmtDateInput(d) {
    if (!d) return "";
    var dd = toDate(d);
    if (!dd) return "";
    return dd.toISOString().slice(0, 10);
  }

  // ── Unique values helpers
  function uniqueVals(field) {
    var s = new Set();
    data.forEach(function (r) { if (r[field]) s.add(String(r[field])); });
    return Array.from(s).sort();
  }
  function uniqueValsWhere(field, filterField, filterVal) {
    var s = new Set();
    data.forEach(function (r) {
      if (filterVal && String(r[filterField] || "") !== filterVal) return;
      if (r[field]) s.add(String(r[field]));
    });
    return Array.from(s).sort();
  }
  function dateRangeFor(field) {
    var min = null, max = null;
    data.forEach(function (r) {
      var d = toDate(r[field]);
      if (!d) return;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    });
    return { min: min, max: max };
  }

  var portfolios = uniqueVals("Deal CPI Portfolio");

  var partnerNames = uniqueVals("Partner Name");
  var beGeoIds     = uniqueVals("BE GEO ID");
  var isDisti      = !!window.APP_IS_DISTI;
  var distiNames   = isDisti ? uniqueVals("Disti name") : [];

  var partnerLabel = partnerNames.length === 1 ? partnerNames[0]
                   : partnerNames.length  >  1 ? partnerNames.slice(0, 3).join(", ") + (partnerNames.length > 3 ? " +" + (partnerNames.length - 3) + " more" : "")
                   : "—";
  var distiLabel   = distiNames.length === 1 ? distiNames[0]
                   : distiNames.length  >  1 ? distiNames.slice(0, 3).join(", ") + (distiNames.length > 3 ? " +" + (distiNames.length - 3) + " more" : "")
                   : "—";
  var beGeoLabel   = beGeoIds.length === 1 ? beGeoIds[0]
                   : beGeoIds.length  >  1 ? beGeoIds.slice(0, 4).join(", ") + (beGeoIds.length > 4 ? " +" + (beGeoIds.length - 4) + " more" : "")
                   : "—";

  // ── Build HTML ─────────────────────────────────────────────────────────────
  var html = "";

  // File metadata
  var fileDateLabel = "";
  var fileDateCaption = "File Date";
  if (window.APP_FILE_META && window.APP_FILE_META.lastModified) {
    fileDateLabel = window.APP_FILE_META.lastModified.toLocaleDateString(window.APP_LOCALE, { year: "numeric", month: "short", day: "numeric" });
  } else if (window.APP_FILE_META && window.APP_FILE_META.cachedAt) {
    fileDateLabel = window.APP_FILE_META.cachedAt.toLocaleDateString(window.APP_LOCALE, { year: "numeric", month: "short", day: "numeric" });
  }
  var fileName  = (window.APP_FILE_META && window.APP_FILE_META.name)  ? window.APP_FILE_META.name  : "";
  var rowsLabel = (window.APP_DATA) ? window.APP_DATA.length.toLocaleString() + " rows" : "";

  // Partner / BE GEO / file date — shown in the tab bar next to Insights
  var tabBarMeta = document.getElementById("tab-bar-meta");
  if (tabBarMeta) {
    var metaHtml = "";
    var metaStyle = 'style="line-height:1.2"';
    var labelStyle = 'style="font-size:0.65rem;color:#6c757d;display:block;text-transform:uppercase;letter-spacing:0.04em"';
    var valueStyle = 'style="font-size:0.75rem;font-weight:600;color:#1B2A3B"';
    if (isDisti) {
      metaHtml += '<div ' + metaStyle + '><span ' + labelStyle + '>Distributor</span><span ' + valueStyle + '>' + escHtml(distiLabel) + '</span></div>';
    } else {
      metaHtml += '<div ' + metaStyle + '><span ' + labelStyle + '>Partner</span><span ' + valueStyle + '>' + escHtml(partnerLabel) + '</span></div>';
    }
    metaHtml += '<div class="border-start ps-3" ' + metaStyle + '><span ' + labelStyle + '>BE GEO ID</span><span ' + valueStyle + '>' + escHtml(beGeoLabel) + '</span></div>';
    if (fileDateLabel) {
      metaHtml += '<div class="border-start ps-3" ' + metaStyle + '><span ' + labelStyle + '>' + escHtml(fileDateCaption) + '</span><span ' + valueStyle + '>' + escHtml(fileDateLabel) + '</span></div>';
    }
    tabBarMeta.innerHTML = metaHtml;
  }

  // Action buttons bar (export, notifications, etc. are appended via DOM)
  html += '<div class="d-flex flex-wrap gap-4 align-items-center mb-3 px-1 py-2 border-bottom"></div>';

  html += '<div id="ovw-table-area"></div>';
  html += '<p class="text-muted small fst-italic mt-2" style="font-size:0.78rem">' +
    '<i class="bi bi-info-circle me-1"></i>' +
    'Values in columns Total UC Eligible through Missed Incentives (progressed) cannot be summed because earning is available to one use case per offer per customer. ' +
    'Review <a href="https://www.cisco.com/site/us/en/partners/cisco-partner-program/benefits/incentives/lifecycle/resources.html" target="_blank" rel="noopener">CPI resources</a>.' +
    '</p>';

  el.innerHTML = html;

  // Add export button to the header bar
  var headerBar = el.querySelector(".border-bottom");
  if (headerBar) {
    // Exclude-toggle button — count from full APP_DATA so button persists when filter is active
    var _allWsIds = new Set((window.APP_DATA || data).map(function(r) { return String(r["Deal WS-ID"] || ""); }));
    var exclCount = ANNOTATIONS.getExcludedWsIds().filter(function(id) { return _allWsIds.has(id); }).length;

    if (exclCount > 0) {
      var exclToggleBtn = document.createElement("button");
      exclToggleBtn.id = "ovw-excl-toggle-btn";
      exclToggleBtn.style.cssText = "font-size:0.82rem";
      function _updateExclBtn() {
        var active = !!window.APP_EXCL_ACTIVE;
        if (active) {
          exclToggleBtn.className = "btn btn-sm ms-auto btn-danger";
          exclToggleBtn.innerHTML = '<i class="bi bi-slash-circle-fill me-1"></i>' + exclCount + ' UCs excluded — removed from calcs';
          exclToggleBtn.title = "Excluded UCs are NOT counted. Click to include them.";
        } else {
          exclToggleBtn.className = "btn btn-sm ms-auto btn-outline-secondary";
          exclToggleBtn.innerHTML = '<i class="bi bi-slash-circle me-1"></i>' + exclCount + ' UCs excluded — counted in calcs';
          exclToggleBtn.title = "Excluded UCs are still counted. Click to remove them.";
        }
      }
      _updateExclBtn();
      exclToggleBtn.addEventListener("click", function () {
        window.APP_EXCL_ACTIVE = !window.APP_EXCL_ACTIVE;
        // Re-render overview with fresh data without destroying/rebuilding the whole tab
        if (window.APP_DATA && window.renderOverview) {
          window.renderOverview(window.getActiveData ? window.getActiveData() : window.APP_DATA);
        }
      });
      headerBar.appendChild(exclToggleBtn);
    }

    var exportBtn = document.createElement("button");
    exportBtn.id = "ovw-export-btn";
    exportBtn.className = "btn btn-sm btn-outline-success" + (exclCount > 0 ? "" : " ms-auto");
    exportBtn.innerHTML = '<i class="bi bi-file-earmark-excel me-1"></i>Export to Excel';
    exportBtn.style.cssText = "font-size:0.82rem";
    exportBtn.addEventListener("click", exportOverviewToXlsx);
    headerBar.appendChild(exportBtn);

    var notifBtn = document.createElement("button");
    notifBtn.id = "ovw-show-notif-btn";
    notifBtn.className = "btn btn-sm btn-outline-secondary";
    notifBtn.innerHTML = '<i class="bi bi-bell me-1"></i>Show Notifications';
    notifBtn.style.cssText = "font-size:0.82rem";
    notifBtn.addEventListener("click", function() {
      window._dismissedNotifs = {};
      try { localStorage.removeItem(window._notifStorageKey && window._notifStorageKey(window._currentSessionKey)); } catch(e) {}
      if (window.showDataNotifications) window.showDataNotifications(data);
    });
    headerBar.appendChild(notifBtn);
  }

  renderTable();

  function getFiltered() { return data; }

  function renderTable() {
    var fd = getFiltered();

    // ── Build grouped structure: Portfolio → Offer → UC → Type
    var groups = {};
    fd.forEach(function (r) {
      var portfolio = r["Deal CPI Portfolio"] || "(No Portfolio)";
      var offer  = r["Track"]              || "(No Offer)";
      var uc     = r["Sub-Track"]          || "(No UC)";
      var type   = r["Incentive Level"]    || "";
      if (!groups[portfolio]) groups[portfolio] = {};
      if (!groups[portfolio][offer]) groups[portfolio][offer] = {};
      if (!groups[portfolio][offer][uc]) groups[portfolio][offer][uc] = {};
      if (!groups[portfolio][offer][uc][type]) groups[portfolio][offer][uc][type] = [];
      groups[portfolio][offer][uc][type].push(r);
    });

    // ── Column calculators
    function calcRow(rows) {
      function forUC(ucRows) {
        var colE_ids = new Set();
        ucRows.forEach(function (r) {
          if (!r["Offer opted-in?"] && norm(r["Stage"]) === "ELIGIBLE") colE_ids.add(r["CR Party ID"]);
        });
        var colE = colE_ids.size;

        var colF = dedupeSum(ucRows.filter(function (r) { return !r["Offer opted-in?"] && norm(r["Stage"]) === "ELIGIBLE"; }), "Potential Incentives");

        var colG_ids = new Set();
        ucRows.forEach(function (r) { if (r["UC 25-50% eligible w/o opt-in"]) colG_ids.add(r["CR Party ID"]); });
        var colG = colG_ids.size;

        var colH = dedupeSum(ucRows.filter(function (r) { return r["UC 25-50% eligible w/o opt-in"]; }), "Potential Incentives");

        var colI_ids = new Set();
        ucRows.forEach(function (r) { if (r["UC 75% eligible w/o opt-in"]) colI_ids.add(r["CR Party ID"]); });
        var colI = colI_ids.size;

        var colJ = dedupeSum(ucRows.filter(function (r) { return r["UC 75% eligible w/o opt-in"]; }), "Missed Incentives");
        var colK = dedupeSum(ucRows.filter(function (r) { return r["UC 75% eligible w/o opt-in"]; }), "Potential Incentives");

        var colL_ids = new Set();
        ucRows.forEach(function (r) { if (r["UC progressed and missed w/o opt-in"]) colL_ids.add(r["CR Party ID"]); });
        var colL = colL_ids.size;

        var colM = dedupeSum(ucRows.filter(function (r) { return r["UC progressed and missed w/o opt-in"]; }), "Missed Incentives");

        var colN = ucRows.filter(function (r) { return norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN" && norm(r["Stage"]) === "ELIGIBLE"; }).length;

        var colO = 0;
        ucRows.forEach(function (r) {
          if (norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN" && norm(r["Stage"]) === "ELIGIBLE") colO += (r["Potential Incentives"] || 0);
        });

        var colP = ucRows.filter(function (r) { return r["Earned?"] === true; }).length;

        var colQ = 0;
        ucRows.forEach(function (r) { colQ += (r["Estimated Earned Incentives"] || 0); });

        return { E: colE, F: colF, G: colG, H: colH, I: colI, J: colJ, K: colK, L: colL, M: colM, N: colN, O: colO, P: colP, Q: colQ };
      }
      return forUC(rows);
    }

    function dedupeSum(rows, field) {
      var map = {};
      rows.forEach(function (r) {
        var key = r["CRPartyID-Offer"] || "";
        var v   = r[field] || 0;
        if (map[key] === undefined || v > map[key]) map[key] = v;
      });
      var total = 0;
      Object.keys(map).forEach(function (k) { total += map[k]; });
      return total;
    }

    // ── Build table HTML
    // Column groups: E-F | G-H | I-J-K | L-M | N-O-Q
    var cols       = ["E","F","G","H","I","J","K","L","M","N","O","Q"];
    var isCurrency = { F:1, H:1, J:1, K:1, M:1, O:1, Q:1 };

    // Group membership → CSS class for shading
    var colGroup = {
      E:"cg1", F:"cg1",
      G:"cg2", H:"cg2",
      I:"cg3", J:"cg3", K:"cg3",
      L:"cg4", M:"cg4",
      N:"cg5", O:"cg5", Q:"cg5"
    };

    var colTooltips = {
      E: "Number of customers with use-cases eligible for opting-in. Excludes use-cases that are fully completed or expired, or with a use-case already opted-in within that offer.",
      F: "The amount of potential incentives associated with these use-cases. Highest incentive per use-case per customer is used in the calculations.",
      G: "Number of customers who have use-cases with Onboard or Onboard/Use stage completed (1 or 2 out of 4 earning stages), and not opted-in. These are easier targets because their deployments have already started.",
      H: "The amount of remaining incentives associated with these use-cases. No incentives paid for previously completed stages. Highest incentive per use-case per customer is used in the calculations.",
      I: "Number of customers who have use-cases with Onboard/Use/Engage completed (3 out of 4 earning stages), and not opted-in. Incentives for the last stage (Adopt) can still be pursued.",
      J: "The amount of missed incentives for these use-cases. Includes incentives for Onboard/Use/Engage when completed after booking date. Highest incentive per use-case per customer is used.",
      K: "The amount of remaining incentives for these use-cases, related to the Adopt stage only. Highest incentive per use-case per customer is used.",
      L: "Number of customers where use-cases progressed (completed or partially/expired) with no opt-in made for that offer. Only counts customers with non-zero missed incentives. No available incentives to pursue.",
      M: "The amount of missed incentives for these use-cases. Includes incentives for all stages completed after booking date. Highest incentive per use-case per customer is used.",
      N: "Number of active use-cases where the partner has opted-in. Excludes expired and not-eligible use-cases.",
      O: "Amount of remaining incentives for opted-in use-cases, i.e. for all earning stages not yet completed.",
      Q: "The amount of incentives earned through opted-in use-cases. Only stages where completion date is after opt-in date are counted. Note: payment goes through further checks by the CPI team."
    };

    function infoIcon(c) {
      var tip = colTooltips[c];
      if (!tip) return "";
      return ' <i class="bi bi-info-circle text-muted" style="font-size:0.75rem;cursor:default" data-bs-toggle="tooltip" data-bs-placement="top" title="' + tip.replace(/"/g, "&quot;") + '"></i>';
    }

    var colHeaders = [
      "Total UC<br><small class='fw-normal'>(customer count)</small>","Total Potential<br>Incentives",
      "UC<br><small class='fw-normal'>(customer count)</small>",
      "Potential Incentives",
      "UC<br><small class='fw-normal'>(customer count)</small>",
      "Missed Incentives",
      "Potential Incentives",
      "UC<br><small class='fw-normal'>(customer count)</small>","Missed Incentives",
      "Active UC","Potential Incentives",
      "Est. Earned<br>Incentives"
    ];

    // Group header row
    var groupDefs = [
      { label: "<a href='#' class='ovw-drilldown-link' onclick='event.preventDefault();window.navigateToDetails({stage:[\"Eligible\"],offerOptedInN:true,optIn:[\"PENDING\"]})' title='Open Details tab filtered to this group'>Not opted-in · Eligible</a>",                                                                                                                                                                  span: 2, cls: "cg1" },
      { label: "<a href='#' class='ovw-drilldown-link' onclick='event.preventDefault();window.navigateToDetails({stage:[\"Eligible\"],offerOptedInN:true,csFrom:2,csTo:4})' title='Open Details tab filtered to this group'>Not opted-in · Eligible · <i class='bi bi-check-circle-fill'></i> Onboard &nbsp;<i class='bi bi-check-circle-fill'></i> Use</a>", span: 2, cls: "cg2" },
      { label: "<a href='#' class='ovw-drilldown-link' onclick='event.preventDefault();window.navigateToDetails({stage:[\"Eligible\"],offerOptedInN:true,csFrom:5,csTo:5})' title='Open Details tab filtered to this group'>Not opted-in · Eligible · <i class='bi bi-check-circle-fill'></i> Engage</a>", span: 3, cls: "cg3" },
      { label: "<a href='#' class='ovw-drilldown-link' onclick='event.preventDefault();window.navigateToDetails({ucMissed:true,offerOptedInN:true,optIn:[\"PENDING\"]})' title='Open Details tab filtered to this group'>Not opted-in · <i class='bi bi-check-circle-fill'></i> Adopt &nbsp;<span class='fw-normal opacity-75'>or</span>&nbsp; <i class='bi bi-clock'></i> Expired</a>",          span: 2, cls: "cg4" },
      { label: "<a href='#' class='ovw-drilldown-link' onclick='event.preventDefault();window.navigateToDetails({stage:[\"Eligible\"],optIn:[\"OPTED IN\"]})' title='Open Details tab filtered to this group'><i class='bi bi-hand-thumbs-up-fill'></i> Opted-in</a>",                                                              span: 3, cls: "cg5" }
    ];
    var groupRow = '<tr><th class="border-end" style="min-width:240px"></th>';
    groupDefs.forEach(function (g) {
      groupRow += '<th colspan="' + g.span + '" class="text-center small fw-semibold ' + g.cls + '-hdr">' + g.label + '</th>';
    });
    groupRow += '</tr>';

    var colHeaderRow = '<tr><th style="min-width:240px">Portfolio / Offer / Use Case</th>';
    cols.forEach(function (c, i) {
      colHeaderRow += '<th class="text-end ' + colGroup[c] + '-hdr" style="min-width:90px">' + colHeaders[i] + infoIcon(c) + '</th>';
    });
    colHeaderRow += '</tr>';

    // thead is built later, after totals row is computed

    // Helper: render a data cell with group shading
    function td(c, v) {
      return '<td class="text-end ' + colGroup[c] + '-cell">' + (isCurrency[c] ? fmtCurrency(v) : fmtCount(v)) + '</td>';
    }

    // Build type badge HTML from the type keys present for a UC
    function typeTags(typeKeys) {
      return typeKeys.filter(function (tp) { return !!tp && tp.trim().toUpperCase() !== "NONE"; }).map(function (tp) {
        var n = tp.trim().toUpperCase();
        var cls = n === "ADVANCED" ? "badge-type-advanced" : "badge-type-standard";
        return '<span class="badge-type ' + cls + '">' + escHtml(tp) + '</span>';
      }).join(" ");
    }

    var SUNSET_UCS = {
      "CAMPUS NETWORK VISIBILITY": true,
      "DNS SECURITY": true,
      "PUBLIC CLOUD SECURITY POLICY AND ACCESS": true
    };

    var tbody = "<tbody>";
    var portfolioOrder = ["Networking", "Security", "Cloud", "Cloud + AI Infrastructure", "Collaboration"];
    var domainKeys = Object.keys(groups).sort(function (a, b) {
      var ai = portfolioOrder.indexOf(a), bi = portfolioOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    var pIdx = 0;
    domainKeys.forEach(function (portfolio) {
      var pKey = "p" + pIdx;
      tbody += '<tr class="ovw-portfolio-row" data-portfolio="' + pKey + '">' +
        '<td colspan="13"><span class="ovw-chevron">&#9660;</span>' + escHtml(portfolio) + '</td></tr>';

      var offerKeys = Object.keys(groups[portfolio]).sort();
      var oIdx = 0;
      offerKeys.forEach(function (offer) {
        var oKey = pKey + "o" + oIdx;
        tbody += '<tr class="ovw-offer-row" data-portfolio="' + pKey + '" data-offer="' + oKey + '">' +
          '<td colspan="' + (cols.length + 1) + '" style="padding-left:1.2rem"><span class="ovw-chevron">&#9660;</span>' + escHtml(offer) + '</td></tr>';

        var ucKeys = Object.keys(groups[portfolio][offer]).sort();
        ucKeys.forEach(function (uc) {
          var ucAllRows = [];
          var typeKeys  = Object.keys(groups[portfolio][offer][uc]).sort();
          typeKeys.forEach(function (tp) {
            groups[portfolio][offer][uc][tp].forEach(function (r) { ucAllRows.push(r); });
          });
          var ucCalc = calcRow(ucAllRows);
          var sunsetMark = SUNSET_UCS[uc.toUpperCase()] ? '<span title="Sunset 26 July 2026"> *</span>' : '';
          tbody += '<tr class="ovw-uc-row" data-portfolio="' + pKey + '" data-offer="' + oKey + '"><td style="padding-left:2rem">' +
            escHtml(uc) + sunsetMark + '&nbsp;' + typeTags([UC_TYPE_MAP[uc.toUpperCase()] || ""]) + '</td>';
          cols.forEach(function (c) { tbody += td(c, ucCalc[c]); });
          tbody += "</tr>";
        });
        oIdx++;
      });
      pIdx++;
    });
    tbody += "</tbody>";

    // Totals row aligned with columns — shown in tfoot
    var totalN = 0, totalO = 0, totalQ = 0;
    fd.forEach(function (r) {
      if (norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN" && norm(r["Stage"]) === "ELIGIBLE") {
        totalN++;
        totalO += (r["Potential Incentives"] || 0);
      }
      totalQ += (r["Estimated Earned Incentives"] || 0);
    });
    var totalsRow = '<tr class="table-active fw-semibold"><td>Totals</td>';
    cols.forEach(function (c) {
      if (c === "N") totalsRow += '<td class="text-end ' + colGroup[c] + '-cell">' + fmtCount(totalN) + '</td>';
      else if (c === "O") totalsRow += '<td class="text-end ' + colGroup[c] + '-cell">' + fmtCurrency(totalO) + '</td>';
      else if (c === "Q") totalsRow += '<td class="text-end ' + colGroup[c] + '-cell">' + fmtCurrency(totalQ) + '</td>';
      else totalsRow += '<td></td>';
    });
    totalsRow += '</tr>';

    var thead = '<thead>' + groupRow + colHeaderRow + totalsRow + '</thead>';

    var tableHtml = '<div class="table-wrapper"><table class="table table-bordered table-hover mb-0">' + thead + tbody + "</table></div>" +
      '<p class="text-muted mt-2 mb-0" style="font-size:0.78rem">* This use case has been sunset on 26 July 2026.</p>';
    document.getElementById("ovw-table-area").innerHTML = tableHtml;

    // Initialise Bootstrap tooltips on info icons
    document.querySelectorAll("#ovw-table-area [data-bs-toggle='tooltip']").forEach(function (el) {
      new bootstrap.Tooltip(el, { html: false });
    });

    // ── Collapse / expand on portfolio and offer row clicks
    var collapseState = {};
    var tableEl = document.querySelector("#ovw-table-area table");
    if (tableEl) {
      tableEl.addEventListener("click", function (e) {
        var tr = e.target.closest("tr");
        if (!tr) return;

        if (tr.classList.contains("ovw-portfolio-row")) {
          var pKey = tr.dataset.portfolio;
          var nowCollapsed = !collapseState["p:" + pKey];
          collapseState["p:" + pKey] = nowCollapsed;

          tableEl.querySelectorAll('.ovw-offer-row[data-portfolio="' + pKey + '"], .ovw-uc-row[data-portfolio="' + pKey + '"]').forEach(function (row) {
            if (nowCollapsed) {
              row.style.display = "none";
            } else {
              // When expanding portfolio, keep UC rows hidden if their offer is still collapsed
              if (row.classList.contains("ovw-uc-row") && collapseState["o:" + row.dataset.offer]) {
                row.style.display = "none";
              } else {
                row.style.display = "";
              }
            }
          });

          var chevron = tr.querySelector(".ovw-chevron");
          if (chevron) chevron.style.transform = nowCollapsed ? "rotate(-90deg)" : "";

        } else if (tr.classList.contains("ovw-offer-row")) {
          var oKey = tr.dataset.offer;
          var nowCollapsed = !collapseState["o:" + oKey];
          collapseState["o:" + oKey] = nowCollapsed;

          tableEl.querySelectorAll('.ovw-uc-row[data-offer="' + oKey + '"]').forEach(function (row) {
            row.style.display = nowCollapsed ? "none" : "";
          });

          var chevron = tr.querySelector(".ovw-chevron");
          if (chevron) chevron.style.transform = nowCollapsed ? "rotate(-90deg)" : "";
        }
      });
    }
  }

  // ── Export overview table to XLSX ─────────────────────────────────────────
  function exportOverviewToXlsx() {
    var btn = document.getElementById("ovw-export-btn");
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Exporting…'; }

    setTimeout(function () {
      try {
        var fd = data;

        // Column group colors (matching cg1–cg5 CSS shading)
        var cgFill = {
          cg1: "FFF3E0",  // orange tint
          cg2: "E8F5E9",  // green tint
          cg3: "FFF9C4",  // yellow tint
          cg4: "FCE4EC",  // pink tint
          cg5: "E3F2FD"   // blue tint
        };
        var colGroup = { E:"cg1",F:"cg1", G:"cg2",H:"cg2", I:"cg3",J:"cg3",K:"cg3", L:"cg4",M:"cg4", N:"cg5",O:"cg5",Q:"cg5" };
        var cols = ["E","F","G","H","I","J","K","L","M","N","O","Q"];
        var isCurrency = { F:1,H:1,J:1,K:1,M:1,O:1,Q:1 };

        // Group header labels (plain text)
        var groupLabels = [
          "Not opted-in · Eligible","Not opted-in · Eligible","Not opted-in · Eligible · Onboard+Use","Not opted-in · Eligible · Onboard+Use",
          "Not opted-in · Eligible · Engage","Not opted-in · Eligible · Engage","Not opted-in · Eligible · Engage",
          "Not opted-in · Adopt/Expired","Not opted-in · Adopt/Expired",
          "Opted-in","Opted-in","Opted-in"
        ];
        var colHeaders = [
          "Total UC (customer count)","Total Potential Incentives",
          "UC (customer count)","Potential Incentives",
          "UC (customer count)","Missed Incentives","Potential Incentives",
          "UC (customer count)","Missed Incentives",
          "Active UC","Potential Incentives","Est. Earned Incentives"
        ];

        // Build grouped data
        var groups = {};
        var portfolioOrder = ["Networking","Security","Cloud","Cloud + AI Infrastructure","Collaboration"];
        fd.forEach(function (r) {
          var portfolio = r["Deal CPI Portfolio"] || "(No Portfolio)";
          var offer  = r["Track"]              || "(No Offer)";
          var uc     = r["Sub-Track"]          || "(No UC)";
          var type   = r["Incentive Level"]    || "";
          if (!groups[portfolio]) groups[portfolio] = {};
          if (!groups[portfolio][offer]) groups[portfolio][offer] = {};
          if (!groups[portfolio][offer][uc]) groups[portfolio][offer][uc] = {};
          if (!groups[portfolio][offer][uc][type]) groups[portfolio][offer][uc][type] = [];
          groups[portfolio][offer][uc][type].push(r);
        });

        var domainKeys = Object.keys(groups).sort(function (a, b) {
          var ai = portfolioOrder.indexOf(a), bi = portfolioOrder.indexOf(b);
          if (ai === -1 && bi === -1) return a.localeCompare(b);
          if (ai === -1) return 1; if (bi === -1) return -1;
          return ai - bi;
        });

        function calcRow(rows) {
          var colE_ids = new Set();
          rows.forEach(function(r){ if (!r["Offer opted-in?"] && (r["Stage"]||"").toUpperCase()==="ELIGIBLE") colE_ids.add(r["CR Party ID"]); });
          var colE = colE_ids.size;
          var colF = dedupeSum(rows.filter(function(r){ return !r["Offer opted-in?"] && (r["Stage"]||"").toUpperCase()==="ELIGIBLE"; }), "Potential Incentives");
          var colG_ids = new Set(); rows.forEach(function(r){ if(r["UC 25-50% eligible w/o opt-in"]) colG_ids.add(r["CR Party ID"]); });
          var colG = colG_ids.size;
          var colH = dedupeSum(rows.filter(function(r){ return r["UC 25-50% eligible w/o opt-in"]; }), "Potential Incentives");
          var colI_ids = new Set(); rows.forEach(function(r){ if(r["UC 75% eligible w/o opt-in"]) colI_ids.add(r["CR Party ID"]); });
          var colI = colI_ids.size;
          var colJ = dedupeSum(rows.filter(function(r){ return r["UC 75% eligible w/o opt-in"]; }), "Missed Incentives");
          var colK = dedupeSum(rows.filter(function(r){ return r["UC 75% eligible w/o opt-in"]; }), "Potential Incentives");
          var colL_ids = new Set(); rows.forEach(function(r){ if(r["UC progressed and missed w/o opt-in"]) colL_ids.add(r["CR Party ID"]); });
          var colL = colL_ids.size;
          var colM = dedupeSum(rows.filter(function(r){ return r["UC progressed and missed w/o opt-in"]; }), "Missed Incentives");
          var colN = rows.filter(function(r){ return (r["Adopt Rebate Opt-In Status"]||"").toUpperCase()==="OPTED IN" && (r["Stage"]||"").toUpperCase()==="ELIGIBLE"; }).length;
          var colO = 0; rows.forEach(function(r){ if((r["Adopt Rebate Opt-In Status"]||"").toUpperCase()==="OPTED IN" && (r["Stage"]||"").toUpperCase()==="ELIGIBLE") colO+=(r["Potential Incentives"]||0); });
          var colP = rows.filter(function(r){ return r["Earned?"]===true; }).length;
          var colQ = 0; rows.forEach(function(r){ colQ+=(r["Estimated Earned Incentives"]||0); });
          return [colE,colF,colG,colH,colI,colJ,colK,colL,colM,colN,colO,colQ];
        }
        function dedupeSum(rows, field) {
          var map = {};
          rows.forEach(function(r){ var k=r["CRPartyID-Offer"]||"", v=r[field]||0; if(map[k]===undefined||v>map[k]) map[k]=v; });
          var t=0; Object.keys(map).forEach(function(k){ t+=map[k]; }); return t;
        }

        // Build sheet data array
        var sheetData = [];

        // Row 1: group headers
        var grpRow = ["Portfolio / Offer / Use Case"].concat(groupLabels);
        sheetData.push(grpRow);
        // Row 2: column headers
        sheetData.push([""].concat(colHeaders));

        var rowMeta = [null, null]; // track row type for styling

        domainKeys.forEach(function(portfolio) {
          sheetData.push([portfolio].concat(new Array(cols.length).fill("")));
          rowMeta.push("portfolio");
          Object.keys(groups[portfolio]).sort().forEach(function(offer) {
            sheetData.push(["  " + offer].concat(new Array(cols.length).fill("")));
            rowMeta.push("offer");
            Object.keys(groups[portfolio][offer]).sort().forEach(function(uc) {
              var ucAllRows = [];
              Object.keys(groups[portfolio][offer][uc]).forEach(function(tp){ groups[portfolio][offer][uc][tp].forEach(function(r){ ucAllRows.push(r); }); });
              var vals = calcRow(ucAllRows);
              sheetData.push(["    " + uc].concat(vals));
              rowMeta.push("uc");
            });
          });
        });

        // Totals row
        var totalN=0, totalO=0, totalQ=0;
        fd.forEach(function(r){
          if((r["Adopt Rebate Opt-In Status"]||"").toUpperCase()==="OPTED IN" && (r["Stage"]||"").toUpperCase()==="ELIGIBLE"){ totalN++; totalO+=(r["Potential Incentives"]||0); }
          totalQ+=(r["Estimated Earned Incentives"]||0);
        });
        var totalsVals = cols.map(function(c){ if(c==="N") return totalN; if(c==="O") return totalO; if(c==="Q") return totalQ; return ""; });
        sheetData.push(["Totals"].concat(totalsVals));
        rowMeta.push("totals");

        // Create workbook
        var XLS = (typeof XLSXStyle !== "undefined") ? XLSXStyle : XLSX;
        var wb = XLS.utils.book_new();
        var ws = XLS.utils.aoa_to_sheet(sheetData);

        // Column widths
        ws["!cols"] = [{ wch: 50 }].concat(cols.map(function(){ return { wch: 22 }; }));

        // Merge group header cells
        ws["!merges"] = [
          { s:{r:0,c:1}, e:{r:0,c:2} },   // cg1
          { s:{r:0,c:3}, e:{r:0,c:4} },   // cg2
          { s:{r:0,c:5}, e:{r:0,c:7} },   // cg3
          { s:{r:0,c:8}, e:{r:0,c:9} },   // cg4
          { s:{r:0,c:10}, e:{r:0,c:12} }  // cg5
        ];

        // Apply styles using cell-by-cell approach
        var numFmt = '"$"#,##0';
        sheetData.forEach(function(row, ri) {
          row.forEach(function(val, ci) {
            var addr = XLS.utils.encode_cell({r:ri, c:ci});
            if (!ws[addr]) ws[addr] = { v: val, t: typeof val === "number" ? "n" : "s" };

            var style = { alignment: { vertical: "center" } };

            if (ri === 0) {
              // Group header row
              style.font = { bold: true, sz: 10 };
              style.alignment = { horizontal: "center", vertical: "center", wrapText: true };
              if (ci >= 1) {
                var cKey = cols[ci-1];
                var cg = colGroup[cKey];
                style.fill = { fgColor: { rgb: cgFill[cg] }, patternType: "solid" };
              } else {
                style.fill = { fgColor: { rgb: "F5F5F5" }, patternType: "solid" };
              }
              style.border = { bottom: { style: "thin", color: { rgb: "CCCCCC" } } };
            } else if (ri === 1) {
              // Column header row
              style.font = { bold: true, sz: 9 };
              style.alignment = { horizontal: "right", vertical: "center", wrapText: true };
              if (ci >= 1) {
                var cKey2 = cols[ci-1];
                var cg2 = colGroup[cKey2];
                style.fill = { fgColor: { rgb: cgFill[cg2] }, patternType: "solid" };
              }
              style.border = { bottom: { style: "medium", color: { rgb: "999999" } } };
            } else {
              var rType = rowMeta[ri];
              if (rType === "portfolio") {
                style.font = { bold: true, sz: 10 };
                style.fill = { fgColor: { rgb: "E8E8E8" }, patternType: "solid" };
              } else if (rType === "offer") {
                style.font = { bold: true, sz: 9 };
                style.fill = { fgColor: { rgb: "F5F5F5" }, patternType: "solid" };
              } else if (rType === "totals") {
                style.font = { bold: true, sz: 10 };
                style.fill = { fgColor: { rgb: "EEEEEE" }, patternType: "solid" };
                style.border = { top: { style: "medium", color: { rgb: "999999" } } };
              }
              // Color data cells by column group
              if (ci >= 1 && (rType === "uc" || rType === "totals")) {
                var cKey3 = cols[ci-1];
                var cg3 = colGroup[cKey3];
                style.fill = { fgColor: { rgb: cgFill[cg3] }, patternType: "solid" };
              }
              // Right-align numeric data cells
              if (ci >= 1 && typeof val === "number") {
                style.alignment = { horizontal: "right", vertical: "center" };
                if (isCurrency[cols[ci-1]]) {
                  ws[addr].z = numFmt;
                }
              }
            }
            ws[addr].s = style;
          });
        });

        // Add row height hints
        ws["!rows"] = sheetData.map(function(_, ri) {
          if (ri === 0) return { hpt: 40 };
          if (ri === 1) return { hpt: 36 };
          return { hpt: 20 };
        });

        var beGeoStr = beGeoIds.length > 0 ? beGeoIds.join("-") : "unknown";
        var today = new Date();
        var dateStr = today.toLocaleDateString(window.APP_LOCALE, { year:"numeric", month:"2-digit", day:"2-digit" })
                           .replace(/\//g,"-").replace(/\./g,"-");
        XLS.utils.book_append_sheet(wb, ws, "Overview");
        XLS.writeFile(wb, "AdoptDash_Overview_" + beGeoStr + "_" + dateStr + ".xlsx");
      } catch(err) {
        alert("Export failed: " + err.message);
        console.error(err);
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-file-earmark-excel me-1"></i>Export to Excel'; }
      }
    }, 50);
  }

  function makeSelect(id, label, options) {
    var h = '<div class="d-flex flex-column"><label for="' + id + '" class="small">' + label + '</label>';
    h += '<select id="' + id + '" class="form-select form-select-sm"><option value="">All</option>';
    options.forEach(function (o) { h += '<option value="' + escHtml(o) + '">' + escHtml(o) + '</option>'; });
    h += "</select></div>";
    return h;
  }

  function makeDateRange(prefix, label, minVal, maxVal) {
    return '<div class="d-flex flex-column">' +
      '<label class="small text-center mb-1">' + label + '</label>' +
      '<div class="d-flex align-items-center gap-1">' +
      '<input type="date" id="' + prefix + '-from" class="form-control form-control-sm" value="' + minVal + '" style="width:135px"/>' +
      '<span class="text-muted small">–</span>' +
      '<input type="date" id="' + prefix + '-to"   class="form-control form-control-sm" value="' + maxVal + '" style="width:135px"/>' +
      '</div>' +
      '</div>';
  }
}

window.renderOverview = renderOverview;
