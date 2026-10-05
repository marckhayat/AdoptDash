// =============================================================================
// customer.js — Customer tab renderer
// =============================================================================

function renderCustomer(data) {
  var el = document.getElementById("tab-customer");
  if (!el) return;

  function norm(x) {
    if (x === null || x === undefined) return "";
    return String(x).replace(/\u00A0/g, " ").trim().toUpperCase();
  }

  function escHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function fmtCurrency(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return "$" + Math.round(v).toLocaleString();
  }

  function fmtDate(v) {
    if (!v) return "";
    var d = (v instanceof Date) ? v : (typeof v === "number" ? new Date(Math.round((v-25569)*86400*1000)) : new Date(v));
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString(window.APP_LOCALE);
  }

  function toDate(x) {
    if (!x) return null;
    if (x instanceof Date) return isNaN(x.getTime()) ? null : x;
    if (typeof x === "number" && x > 1000) { var d=new Date(Math.round((x-25569)*86400*1000)); return isNaN(d.getTime())?null:d; }
    if (typeof x === "string") { var d2=new Date(x); return isNaN(d2.getTime())?null:d2; }
    return null;
  }

  var today = new Date();

  // Default rows: opted-in AND (stage=ELIGIBLE or expired)
  var defaultRows = data.filter(function (r) {
    if (norm(r["Adopt Rebate Opt-In Status"]) !== "OPTED IN") return false;
    var stage = norm(r["Stage"]);
    if (stage === "ELIGIBLE") return true;
    var expiry = toDate(r["Deal Incentive Expiry Date"]);
    return expiry && expiry < today;
  });

  var html = '<div class="d-flex align-items-end gap-4 mb-3">';
  html += '<div>';
  html += '<label for="cust-name-filter" class="form-label small fw-semibold mb-1">Customers with opt-ins</label>';
  html += '<div class="position-relative" style="min-width:320px">';
  html += '<i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-2 text-muted" style="font-size:0.85rem;pointer-events:none"></i>';
  html += '<input type="text" id="cust-name-filter" class="form-control form-control-sm ps-4 pe-4" placeholder="Customer or WS-Deal ID…"/>';
  html += '<button id="cust-name-clear" type="button" class="btn btn-link p-0 position-absolute top-50 end-0 translate-middle-y me-2 d-none" style="font-size:0.8rem;color:#999;line-height:1" tabindex="-1"><i class="bi bi-x-lg"></i></button>';
  html += '</div>';
  html += '</div>';
  html += '<div class="text-muted small mb-1" id="cust-count-label"></div>';
  html += '<div class="ms-auto mb-1"><button id="cust-export-btn" class="btn btn-sm btn-outline-success" style="font-size:0.82rem;white-space:nowrap"><i class="bi bi-file-earmark-excel me-1"></i>Export to Excel</button></div>';
  html += '</div>';
  html += '<div id="cust-table-area"></div>';
  html += '<div id="cust-pagination" class="mt-2"></div>';

  el.innerHTML = html;

  // Consume deep-link set by navigateToCustomer (synchronous — no timing race)
  var deepLink = window._custDeepLink || "";
  window._custDeepLink = null;
  if (deepLink) {
    var filterInp = document.getElementById("cust-name-filter");
    if (filterInp) filterInp.value = deepLink;
  }

  document.getElementById("cust-export-btn").addEventListener("click", function () {
    exportCustomerToXlsx(document.getElementById("cust-name-filter").value.trim());
  });

  document.getElementById("cust-name-filter").addEventListener("input", function () {
    document.getElementById("cust-name-clear").classList.toggle("d-none", this.value === "");
    custPage = 1;
    renderCustomerTable(this.value.trim());
  });
  document.getElementById("cust-name-clear").addEventListener("click", function () {
    var inp = document.getElementById("cust-name-filter");
    inp.value = "";
    this.classList.add("d-none");
    inp.focus();
    custPage = 1;
    renderCustomerTable("");
  });

  var custSort = { field: null, dir: 1 };
  var custPage = 1;
  var CUST_PAGE_SIZE = 50;

  // Restore persisted filter state (deep-link takes precedence)
  var _custSaved = window.APP_FILTER_STATE && window.APP_FILTER_STATE.customer;
  if (_custSaved && !deepLink) {
    if (_custSaved.nameFilter) {
      var _cfInp = document.getElementById("cust-name-filter");
      if (_cfInp) {
        _cfInp.value = _custSaved.nameFilter;
        document.getElementById("cust-name-clear").classList.remove("d-none");
      }
    }
    if (_custSaved.sortField) { custSort.field = _custSaved.sortField; custSort.dir = _custSaved.sortDir; }
  }

  renderCustomerTable(document.getElementById("cust-name-filter").value.trim());

  function renderCustomerTable(nameFilter) {
    if (window.APP_FILTER_STATE) {
      window.APP_FILTER_STATE.customer = { nameFilter: nameFilter, sortField: custSort.field, sortDir: custSort.dir };
    }
    var area = document.getElementById("cust-table-area");

    var rows = defaultRows.filter(function (r) {
      if (!nameFilter) return true;
      var q = nameFilter.toLowerCase();
      var name = String(r["CR Party Name"] || "").toLowerCase();
      var wsid = String(r["Deal WS-ID"] || "").toLowerCase();
      return name.indexOf(q) !== -1 || wsid.indexOf(q) !== -1;
    });

    // Apply sort
    if (custSort.field) {
      var sf = custSort.field;
      var isDateField = ["Booking Date","Adopt Rebate Start Date","Deal Incentive Expiry Date"].indexOf(sf) !== -1;
      var isNumField  = ["Potential Incentives","Estimated Earned Incentives"].indexOf(sf) !== -1;
      rows = rows.slice().sort(function (a, b) {
        var av = a[sf], bv = b[sf];
        if (isDateField) { av = toDate(av) || new Date(0); bv = toDate(bv) || new Date(0); }
        else if (isNumField) { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
        else { av = String(av || "").toLowerCase(); bv = String(bv || "").toLowerCase(); }
        return av < bv ? -custSort.dir : av > bv ? custSort.dir : 0;
      });
    }

    var countLabel = document.getElementById("cust-count-label");
    if (countLabel) {
      countLabel.textContent = rows.length.toLocaleString() + " record" + (rows.length !== 1 ? "s" : "");
    }

    if (rows.length === 0) {
      area.innerHTML = '<p class="text-muted mt-2">' +
        (nameFilter ? 'No records match "' + escHtml(nameFilter) + '".' : 'No opted-in eligible or expired records found.') +
        '</p>';
      document.getElementById("cust-pagination").innerHTML = "";
      return;
    }

    var totalPages = Math.ceil(rows.length / CUST_PAGE_SIZE);
    if (custPage > totalPages) custPage = totalPages;
    var start = (custPage - 1) * CUST_PAGE_SIZE;
    var pageRows = rows.slice(start, start + CUST_PAGE_SIZE);

    var has2TPartner = data.some(function (r) { return r["2T Partner Name"] && String(r["2T Partner Name"]).trim() !== ""; });

    var cols = [
      ...(has2TPartner ? [{ label: "2T Partner Name", field: "2T Partner Name" }] : []),
      { label: "CR Party Name",                     field: "CR Party Name",                    sortable: true },
      { label: "CR Party ID",                       field: "CR Party ID" },
      { label: "CX Customer BU ID",                 field: "CX Customer BU ID" },
      { label: "Portfolio",                            field: "Deal CPI Portfolio" },
      { label: "Offer",                             field: "Track" },
      { label: "Use Case",                          field: "Sub-Track",                        isUC: true },
      { label: "Current Stage",                     field: "Current stage",                    isStage: true },
      { label: "Stage Progress",                    field: "Current Stage Progress" },
      { label: "Pending Tasks",                     field: "Current stage pending tasks" },
      { label: "Days in Stage",                     field: "Days in stage",                    isDays: true },
      { label: "Potential<br>Incentives",           field: "Potential Incentives",             isCurrency: true, sortable: true },
      { label: "Estimated<br>Earned Incentives",    field: "Estimated Earned Incentives",      isCurrency: true, sortable: true },
      { label: "Booking Date",                      field: "Booking Date",                     isDate: true, sortable: true },
      { label: "Opt-in Date",                       field: "Adopt Rebate Start Date",          isDate: true, sortable: true },
      { label: "Expiry Date",                       field: "Deal Incentive Expiry Date",       isDate: true, isExpiry: true, sortable: true },
      { label: "Stages Completed<br>Before Opt-in", field: "Missed Incentives",               isMissedFlag: true },
      { label: "Deal WS-ID",                        field: "Deal WS-ID",                       isWsId: true }
    ];

    var thead = "<thead><tr>" + cols.map(function (c) {
      if (!c.sortable) return "<th>" + c.label + "</th>";
      var isActive = custSort.field === c.field;
      var icon = isActive ? (custSort.dir === 1 ? " &#9650;" : " &#9660;") : ' <span style="opacity:0.3">&#8597;</span>';
      return '<th style="cursor:pointer;white-space:nowrap" data-sortfield="' + c.field + '">' + c.label + icon + '</th>';
    }).join("") + "</tr></thead>";

    var tbody = "<tbody>";
    pageRows.forEach(function (r) {
      var expiryObj = toDate(r["Deal Incentive Expiry Date"]);
      var isExpired = expiryObj && expiryObj < today;
      tbody += '<tr>';
      cols.forEach(function (c) {
        var val = r[c.field];
        if (c.isMissedFlag) {
          var optInDate = toDate(r["Adopt Rebate Start Date"]);
          var stagesToCheck = [
            { name: "Engage",  dateField: "Stage Completion Date(Engage)" },
            { name: "Use",     dateField: "Stage Completion Date(Use)" },
            { name: "Onboard", dateField: "Stage Completion Date(onboard)" }
          ];
          var missedParts = [];
          stagesToCheck.forEach(function(s) {
            var completionDate = toDate(r[s.dateField]);
            if (completionDate && optInDate && completionDate < optInDate) {
              missedParts.push(s.name + " - " + fmtDate(completionDate));
            }
          });
          if (missedParts.length === 0) {
            tbody += '<td class="text-muted">N/A</td>';
          } else {
            tbody += '<td><span class="text-danger fw-semibold">' + missedParts.join("<br>") + '</span></td>';
          }
        } else if (c.isWsId) {
          var wsid = escHtml(val);
          tbody += '<td>' + (val ? '<a href="https://app.workspan.com/wsid/' + wsid + '" target="_blank" rel="noopener">' + wsid + '</a>' : '') + '</td>';
        } else if (c.isExpiry) {
          var dObj = toDate(val);
          var cellStyle = "";
          if (isExpired) {
            cellStyle = ' style="background:#f0f0f0;color:#999"';
          } else if (dObj) {
            var daysUntil = Math.round((dObj - today) / 86400000);
            if (daysUntil > 180)     cellStyle = ' style="background:#dff6dd"';
            else if (daysUntil > 90) cellStyle = ' style="background:#fff4ce"';
            else if (daysUntil >= 0) cellStyle = ' style="background:#ffe6e6"';
          }
          tbody += '<td class="expiry-date-cell"' + cellStyle + '>' + fmtDate(val) + '</td>';
        } else if (c.isDate) {
          tbody += '<td>' + fmtDate(val) + '</td>';
        } else if (c.isCurrency) {
          tbody += '<td>' + fmtCurrency(val) + '</td>';
        } else if (c.isUC) {
          var ucName = escHtml(val);
          var ucUrl = val ? UC_GUIDE_MAP[String(val).trim()] : null;
          tbody += '<td>' + (ucUrl ? '<a href="' + ucUrl + '" target="_blank" rel="noopener">' + ucName + '</a>' : ucName) + '</td>';
        } else if (c.isStage) {
          tbody += '<td><span class="stage-badge stage-' + escHtml(val) + '">' + escHtml(val) + '</span></td>';
        } else if (c.isDays) {
          var days = val !== null && val !== undefined ? parseInt(val) : null;
          var dayColor = days === null ? "" : days > 180 ? "color:#D13438" : days > 90 ? "color:#FF8C00" : "color:#107C10";
          tbody += '<td style="font-weight:600;' + dayColor + '">' + (days !== null ? days : "-") + '</td>';
        } else {
          tbody += '<td>' + escHtml(val) + '</td>';
        }
      });
      tbody += "</tr>";
    });
    tbody += "</tbody>";

    area.innerHTML = '<div class="table-wrapper"><table class="table table-sm table-bordered mb-0">' + thead + tbody + '</table></div>';

    area.querySelectorAll("th[data-sortfield]").forEach(function (th) {
      th.addEventListener("click", function () {
        var f = this.getAttribute("data-sortfield");
        if (custSort.field === f) { custSort.dir *= -1; }
        else { custSort.field = f; custSort.dir = 1; }
        custPage = 1;
        renderCustomerTable(document.getElementById("cust-name-filter").value.trim());
      });
    });

    // Pagination controls
    var pgEl = document.getElementById("cust-pagination");
    if (totalPages <= 1) { pgEl.innerHTML = ""; return; }
    var pgHtml = '<nav><ul class="pagination pagination-sm mb-0">';
    pgHtml += '<li class="page-item' + (custPage === 1 ? ' disabled' : '') + '"><a class="page-link" data-page="' + (custPage - 1) + '">&laquo;</a></li>';
    var lo = Math.max(1, custPage - 2), hi = Math.min(totalPages, custPage + 2);
    if (lo > 1)          pgHtml += '<li class="page-item"><a class="page-link" data-page="1">1</a></li>' + (lo > 2 ? '<li class="page-item disabled"><span class="page-link">…</span></li>' : '');
    for (var p = lo; p <= hi; p++) pgHtml += '<li class="page-item' + (p === custPage ? ' active' : '') + '"><a class="page-link" data-page="' + p + '">' + p + '</a></li>';
    if (hi < totalPages) pgHtml += (hi < totalPages - 1 ? '<li class="page-item disabled"><span class="page-link">…</span></li>' : '') + '<li class="page-item"><a class="page-link" data-page="' + totalPages + '">' + totalPages + '</a></li>';
    pgHtml += '<li class="page-item' + (custPage === totalPages ? ' disabled' : '') + '"><a class="page-link" data-page="' + (custPage + 1) + '">&raquo;</a></li>';
    pgHtml += '</ul></nav>';
    pgEl.innerHTML = pgHtml;
    pgEl.querySelectorAll("a.page-link").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var pg = parseInt(this.getAttribute("data-page"));
        if (pg >= 1 && pg <= totalPages && pg !== custPage) {
          custPage = pg;
          renderCustomerTable(document.getElementById("cust-name-filter").value.trim());
        }
      });
    });
  }
  function exportCustomerToXlsx(nameFilter) {
    var btn = document.getElementById("cust-export-btn");
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Exporting…'; }

    setTimeout(function () {
      try {
        var XLS = (typeof XLSXStyle !== "undefined") ? XLSXStyle : XLSX;

        // Build the filtered + sorted rows (same logic as renderCustomerTable)
        var rows = defaultRows.filter(function (r) {
          if (!nameFilter) return true;
          var q = nameFilter.toLowerCase();
          return String(r["CR Party Name"] || "").toLowerCase().indexOf(q) !== -1 ||
                 String(r["Deal WS-ID"]    || "").toLowerCase().indexOf(q) !== -1;
        });
        if (custSort.field) {
          var sf = custSort.field;
          var isDateField = ["Booking Date","Adopt Rebate Start Date","Deal Incentive Expiry Date"].indexOf(sf) !== -1;
          var isNumField  = ["Potential Incentives","Estimated Earned Incentives"].indexOf(sf) !== -1;
          rows = rows.slice().sort(function (a, b) {
            var av = a[sf], bv = b[sf];
            if (isDateField) { av = toDate(av) || new Date(0); bv = toDate(bv) || new Date(0); }
            else if (isNumField) { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
            else { av = String(av || "").toLowerCase(); bv = String(bv || "").toLowerCase(); }
            return av < bv ? -custSort.dir : av > bv ? custSort.dir : 0;
          });
        }

        var has2T = data.some(function (r) { return r["2T Partner Name"] && String(r["2T Partner Name"]).trim() !== ""; });
        var colDefs = [
          ...(has2T ? [{ label:"2T Partner Name", field:"2T Partner Name" }] : []),
          { label:"CR Party Name",                   field:"CR Party Name" },
          { label:"CR Party ID",                     field:"CR Party ID" },
          { label:"CX Customer BU ID",               field:"CX Customer BU ID" },
          { label:"Portfolio",                          field:"Deal CPI Portfolio" },
          { label:"Offer",                           field:"Track" },
          { label:"Use Case",                        field:"Sub-Track" },
          { label:"Current Stage",                   field:"Current stage" },
          { label:"Stage Progress",                  field:"Current Stage Progress" },
          { label:"Pending Tasks",                   field:"Current stage pending tasks" },
          { label:"Days in Stage",                   field:"Days in stage" },
          { label:"Potential Incentives",            field:"Potential Incentives",        isCurrency:true },
          { label:"Est. Earned Incentives",          field:"Estimated Earned Incentives", isCurrency:true },
          { label:"Booking Date",                    field:"Booking Date",                isDate:true },
          { label:"Opt-in Date",                     field:"Adopt Rebate Start Date",     isDate:true },
          { label:"Expiry Date",                     field:"Deal Incentive Expiry Date",  isDate:true },
          { label:"Stages Completed Before Opt-in",  field:"_missedStages" },
          { label:"Deal WS-ID",                      field:"Deal WS-ID" }
        ];

        var headerRow = colDefs.map(function (c) { return c.label; });
        var sheetData = [headerRow];

        rows.forEach(function (r) {
          var row = colDefs.map(function (c) {
            if (c.field === "_missedStages") {
              var optInDate = toDate(r["Adopt Rebate Start Date"]);
              var parts = [];
              [{ name:"Engage", f:"Stage Completion Date(Engage)" },
               { name:"Use",    f:"Stage Completion Date(Use)" },
               { name:"Onboard",f:"Stage Completion Date(onboard)" }].forEach(function (s) {
                var cd = toDate(r[s.f]);
                if (cd && optInDate && cd < optInDate) parts.push(s.name + " - " + fmtDate(cd));
              });
              return parts.length ? parts.join(", ") : "N/A";
            }
            var v = r[c.field];
            if (c.isCurrency) return (v === null || v === undefined || isNaN(v)) ? 0 : Math.round(v);
            if (c.isDate) return fmtDate(v);
            return (v === null || v === undefined) ? "" : String(v);
          });
          sheetData.push(row);
        });

        var wb = XLS.utils.book_new();
        var ws = XLS.utils.aoa_to_sheet(sheetData);

        // Column widths
        ws["!cols"] = colDefs.map(function (c) {
          if (c.isCurrency) return { wch: 22 };
          if (c.field === "CR Party Name" || c.field === "2T Partner Name") return { wch: 35 };
          if (c.field === "_missedStages") return { wch: 30 };
          return { wch: 18 };
        });

        // Header row style
        var hdrFont = { bold: true, color: { rgb: "FFFFFF" }, sz: 10 };
        var hdrFill = { fgColor: { rgb: "1B5FAD" }, patternType: "solid" };
        headerRow.forEach(function (lbl, ci) {
          var addr = XLS.utils.encode_cell({ r: 0, c: ci });
          if (!ws[addr]) ws[addr] = { v: lbl, t: "s" };
          ws[addr].s = { font: hdrFont, fill: hdrFill, alignment: { horizontal: "center", wrapText: true } };
        });

        // Data rows — alternating shading + currency format
        rows.forEach(function (_, ri) {
          var wsRow = ri + 1;
          var fillColor = ri % 2 === 0 ? "FFFFFF" : "F5F8FF";
          colDefs.forEach(function (c, ci) {
            var addr = XLS.utils.encode_cell({ r: wsRow, c: ci });
            if (!ws[addr]) ws[addr] = { v: "", t: "s" };
            ws[addr].s = { fill: { fgColor: { rgb: fillColor }, patternType: "solid" }, font: { sz: 9 } };
            if (c.isCurrency && ws[addr].t === "n") {
              ws[addr].z = '"$"#,##0';
              ws[addr].s.alignment = { horizontal: "right" };
            }
          });
        });

        ws["!rows"] = sheetData.map(function (_, ri) { return ri === 0 ? { hpt: 30 } : { hpt: 18 }; });

        var beGeoStr = Array.from(new Set(data.map(function (r) { return String(r["BE GEO ID"] || ""); }).filter(Boolean))).join("-") || "export";
        var dateStr = new Date().toLocaleDateString(window.APP_LOCALE, { year:"numeric", month:"2-digit", day:"2-digit" }).replace(/\//g,"-").replace(/\./g,"-");
        XLS.utils.book_append_sheet(wb, ws, "Customers");
        XLS.writeFile(wb, "AdoptDash_Customers_" + beGeoStr + "_" + dateStr + ".xlsx");
      } catch (err) {
        alert("Export failed: " + err.message);
        console.error(err);
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-file-earmark-excel me-1"></i>Export to Excel'; }
      }
    }, 50);
  }
}

window.renderCustomer = renderCustomer;
