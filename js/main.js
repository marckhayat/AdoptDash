// =============================================================================
// main.js — Application entry point
// =============================================================================

// Global error handler — logs full stack to console for debugging
window.addEventListener("error", function (e) {
  console.error("[AdoptDash error]", e.message, "\nat", e.filename, "line", e.lineno, "\n", e.error && e.error.stack ? e.error.stack : "(no stack)");
});
window.addEventListener("unhandledrejection", function (e) {
  console.error("[AdoptDash unhandled promise rejection]", e.reason && e.reason.stack ? e.reason.stack : e.reason);
});

// Store file metadata globally so tabs can access it
var APP_DATA = null;
var APP_FILE_META = null;
var APP_FILTER_STATE = { details: null, lifecycle: null, cpiAdopt: null, customer: null, testing: null };
var APP_IS_DISTI = false;
var APP_MULTI_SESSIONS = null; // { sessions: [...], fileMeta: {...} }
var APP_EXCL_ACTIVE = false;   // when true, excluded deals are removed from overview/pvi/insights calculations
var APP_VERSION = "v6.8.8 Feedback";
// Use the browser's preferred language for date formatting (respects user's browser locale setting)
var APP_LOCALE = navigator.language || undefined;
// Holds a FileSystemFileHandle from showOpenFilePicker() to be persisted after load
var PENDING_FILE_HANDLE = null;
document.addEventListener("DOMContentLoaded", function () {
  var el = document.getElementById("app-version-label");
  if (el) el.textContent = APP_VERSION;
});

function openFeedbackForm() {
  // If no data is loaded, the tab bar is hidden — call it "Data load"
  var tabBarHidden = document.getElementById("main-tab-bar") && document.getElementById("main-tab-bar").classList.contains("d-none");
  var activeLink = document.querySelector('#mainTabs .nav-link.active');
  var tabName = "—";
  if (tabBarHidden || !APP_DATA) {
    tabName = "Data load";
  } else if (activeLink) {
    var tabMap = { "#tab-overview": "Overview", "#tab-details": "Details", "#tab-pvi": "PVI", "#tab-testing": "Insights" };
    tabName = tabMap[activeLink.getAttribute("data-bs-target")] || "—";
    // If on Insights, also capture the active sub-tab
    if (tabName === "Insights") {
      var subTabMap = { "tab-btn-cpi": "CPI Adopt", "tab-btn-pareto": "Customer Analysis", "tab-btn-uch": "UC Health", "tab-btn-lifecycle": "Lifecycle" };
      for (var subId in subTabMap) {
        var subBtn = document.getElementById(subId);
        if (subBtn && subBtn.classList.contains("active")) {
          tabName = "Insights | " + subTabMap[subId];
          break;
        }
      }
    }
  }

  var ua = navigator.userAgent;
  var browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Unknown";

  var ts = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  var details = "(describe your feedback or request here)\n\n--------------------\n"
    + "Version: " + APP_VERSION + "\n"
    + "Tab: " + tabName + "\n"
    + "Date: " + ts + "\n"
    + "Browser: " + browser;

  var url = "https://forms.office.com/Pages/ResponsePage.aspx"
    + "?id=Yq_hWgWVl0CmmsFVPveEDjo43yp-YwhGjcweGiYB-IhUNDkyOTVENzgyR1pDME1DU0xUTVBVVktVOS4u"
    + "&rb0f013af90ae4b69a920b8de6e132288=" + encodeURIComponent("Adoption Dashboard")
    + "&r1869926e82d94a499a18bcb522d0e2f1=" + encodeURIComponent("N/A")
    + "&r64cac3db902a46b997e9023d7d6db140=" + encodeURIComponent(details);

  // Reset modal to loading state
  var loader  = document.getElementById("feedback-iframe-loader");
  var blocked = document.getElementById("feedback-iframe-blocked");
  var iframe  = document.getElementById("feedback-iframe");
  var fallback = document.getElementById("feedback-fallback-link");

  if (loader)   { loader.style.display = "flex"; }
  if (blocked)  { blocked.classList.add("d-none"); }
  if (fallback) { fallback.href = url; }

  // Detect iframe block: if the iframe fails to load (X-Frame-Options / CSP),
  // the onload still fires but the content is empty — we use a timeout fallback.
  if (iframe) {
    iframe.src = "";
    setTimeout(function () { iframe.src = url; }, 50);

    // If still showing loader after 12 s, assume it was blocked and show fallback
    setTimeout(function () {
      var l = document.getElementById("feedback-iframe-loader");
      if (l && l.style.display !== "none") {
        l.style.display = "none";
        var b = document.getElementById("feedback-iframe-blocked");
        if (b) b.classList.remove("d-none");
      }
    }, 12000);
  }

  var modal = new bootstrap.Modal(document.getElementById("feedbackModal"));
  modal.show();
}

// Workspan column names used to auto-detect the header row
var KNOWN_COLUMNS = [
  "Deal WS-ID", "Partner Name", "CR Party Name", "Track", "Sub-Track",
  "Stage", "CR Party ID", "BE GEO ID", "Program Type", "Booking Date",
  "Incentive Level", "Adopt Rebate Opt-In Status", "Deal Incentive Expiry Date"
];

document.addEventListener("DOMContentLoaded", init);

function init() {
  // Check IndexedDB for cached datasets and render resume cards if found
  IDB.loadAllMeta().then(function (entries) {
    restoreUploadSection(entries);
  }).catch(function () {
    restoreUploadSection([]);
  });

  document.querySelectorAll('[data-bs-toggle="tab"]').forEach(function (tab) {
    tab.addEventListener("shown.bs.tab", function (e) {
      if (!APP_DATA) return;
      if (e.target.dataset.bsTarget !== "#tab-testing") {
        var nav = document.getElementById("cpi-scroll-nav");
        if (nav) nav.remove();
      }
      renderActiveTab(e.target.dataset.bsTarget);
    });
  });
}

function showLoader(message) {
  var sec = document.getElementById("upload-section");
  sec.classList.remove("d-none");
  sec.innerHTML =
    '<div class="upload-card mx-auto my-5">' +
    '  <div class="card shadow-sm">' +
    '    <div class="card-body p-5 text-center">' +
    '      <div class="spinner-border text-primary mb-3" style="width:3rem;height:3rem;" role="status"></div>' +
    '      <p class="text-muted mb-0" id="loader-msg">' + (message || "Loading…") + '</p>' +
    '    </div>' +
    '  </div>' +
    '</div>';
}

function updateLoaderMsg(msg) {
  var el = document.getElementById("loader-msg");
  if (el) el.textContent = msg;
}

function showRefreshToast(msg) {
  var existing = document.getElementById("refresh-toast");
  if (existing) existing.remove();
  var toast = document.createElement("div");
  toast.id = "refresh-toast";
  toast.style.cssText = "position:fixed;bottom:1.25rem;right:1.25rem;z-index:9999;background:#fff;border:1px solid #dee2e6;border-radius:.5rem;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:.6rem 1rem;display:flex;align-items:center;gap:.6rem;font-size:.875rem;color:#333;min-width:200px;";
  toast.innerHTML = '<div class="spinner-border spinner-border-sm text-primary flex-shrink-0" role="status"></div><span id="refresh-toast-msg">' + (msg || "Refreshing\u2026") + '</span>';
  document.body.appendChild(toast);
}

function hideRefreshToast() {
  var t = document.getElementById("refresh-toast");
  if (t) t.remove();
}


// Find which row in the 2-D array contains the Workspan column headers.
// Returns the row index, or -1 if nothing plausible is found.
function findHeaderRowIndex(rows2d) {
  var bestIdx = -1;
  var bestScore = 0;
  for (var i = 0; i < Math.min(rows2d.length, 50); i++) {
    var row = rows2d[i];
    if (!row) continue;
    var matchCount = 0;
    for (var j = 0; j < row.length; j++) {
      var cell = row[j];
      if (cell && KNOWN_COLUMNS.indexOf(String(cell).trim()) !== -1) matchCount++;
    }
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestIdx = i;
    }
    if (matchCount >= 3) break;  // good enough, stop early
  }
  // Accept if we found at least 1 known column, otherwise fall back to row 0
  return bestScore >= 1 ? bestIdx : 0;
}

// Convert a 2-D array (header row + data rows) to array-of-objects
function rows2dToObjects(rows2d, headerIdx) {
  var headers = rows2d[headerIdx].map(function (h) { return h === null || h === undefined ? "" : String(h).trim(); });
  var result = [];
  for (var i = headerIdx + 1; i < rows2d.length; i++) {
    var row = rows2d[i];
    if (!row) continue;
    // Skip entirely blank rows
    var hasData = false;
    for (var j = 0; j < row.length; j++) { if (row[j] !== null && row[j] !== undefined && row[j] !== "") { hasData = true; break; } }
    if (!hasData) continue;
    var obj = {};
    for (var k = 0; k < headers.length; k++) {
      if (headers[k]) obj[headers[k]] = row[k] !== undefined ? row[k] : null;
    }
    result.push(obj);
  }
  return result;
}

function handleFileUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  PENDING_FILE_HANDLE = null; // fallback path — no persistent handle
  processPartnerFile(file);
}

function processPartnerFile(file) {
  var ext = file.name.split(".").pop().toLowerCase();
  var sizeMB = file.size / (1024 * 1024);

  // Warn early for large XLSX — don't even attempt, it will crash the browser tab
  if (ext !== "csv" && sizeMB > 20) {
    var msg =
      "This Excel file is " + sizeMB.toFixed(0) + " MB, which is too large to load in the browser.\n\n" +
      "Please export your Workspan report as CSV instead:\n" +
      "  1. In Workspan, run report 19849 (Partners) or 21766 (Distributors)\n" +
      "  2. Click Export → CSV\n" +
      "  3. Upload the .csv file here\n\n" +
      "CSV files of any size work perfectly — there is no size limit.";
    alert(msg);
    PENDING_FILE_HANDLE = null;
    return;
  }

  showLoader("Reading file — this may take a moment for large files…");

  // Store file metadata for display in tabs
  APP_FILE_META = {
    name: file.name,
    lastModified: file.lastModified ? new Date(file.lastModified) : null
  };

  if (ext === "csv") {
    handleCSV(file);
  } else {
    handleXLSX(file);
  }
}


// ── CSV path: PapaParse streams the file — handles millions of rows ──────────

// Workspan CSV exports quote every field but does NOT escape inner double-quotes
// as "" (RFC 4180). The only real field-closing quote is one immediately followed
// by , \r \n or end-of-string. Every other " inside a field is a literal character
// and gets escaped as "" so PapaParse can handle it correctly.
function fixUnescapedCsvQuotes(text) {
  var out = [];
  var i = 0;
  var len = text.length;
  while (i < len) {
    var ch = text[i];
    if (ch === '"') {
      out.push('"');
      i++;
      // Scan inside a quoted field
      while (i < len) {
        var c = text[i];
        if (c === '"') {
          var next = i + 1 < len ? text[i + 1] : null;
          if (next === null || next === ',' || next === '\r' || next === '\n') {
            // Only a real field-closing quote if followed by delimiter/newline/end
            out.push('"');
            i++;
            break;
          } else {
            // Literal " inside the field — escape it
            out.push('""');
            i++;
          }
        } else {
          out.push(c);
          i++;
        }
      }
    } else {
      out.push(ch);
      i++;
    }
  }
  return out.join('');
}

function readFileAsText(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload  = function (e) { resolve(e.target.result); };
    reader.onerror = function ()  { reject(new Error('Failed to read file as text')); };
    reader.readAsText(file);
  });
}

function handleCSV(file) {
  readFileAsText(file).then(function (rawText) {
    var text = fixUnescapedCsvQuotes(rawText);
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,  // keep raw strings; transform.js handles types
      complete: function(results) {
        if (!results.data || results.data.length === 0) {
          restoreUploadSection();
          alert("The CSV file appears to be empty or has no data rows.");
          return;
        }
        updateLoaderMsg("Processing " + results.data.length.toLocaleString() + " rows…");
        setTimeout(function() {
          try {
            APP_DATA = transformData(results.data);
            var _wsGeoIds = [];
            APP_DATA.forEach(function(r) { var v = String(r["BE GEO ID"] || "").trim(); if (v && _wsGeoIds.indexOf(v) === -1) _wsGeoIds.push(v); });
            _wsGeoIds.sort();
            var _wsIdbKey = _wsGeoIds.length > 0 ? "ws-geo-" + _wsGeoIds.join("_") : "ws-" + file.name;
            finishLoad(file.name, APP_DATA.length, false, _wsIdbKey);
          } catch(err) {
            restoreUploadSection([]);
            console.error(err);
            alert("Error processing data: " + err.message);
          }
        }, 50);
      },
      error: function(err) {
        restoreUploadSection();
        alert("Error reading CSV: " + err.message);
      }
    });
  }).catch(function (err) {
    restoreUploadSection();
    alert("Error reading CSV file: " + err.message);
  });
}

// ── XLSX path: runs in a Web Worker to avoid main-thread memory limits ───────
function fallbackXLSXMainThreadFromFile(file, reason) {
  if (reason) console.warn('Falling back to main-thread XLSX parse:', reason);
  updateLoaderMsg('Retrying parse on main thread…');

  var retryReader = new FileReader();
  retryReader.onload = function (evt) {
    try {
      handleXLSXMainThread(evt.target.result, file.name);
    } catch (fallbackErr) {
      restoreUploadSection();
      console.error(fallbackErr);
      alert('Error reading Excel file: ' + fallbackErr.message);
    }
  };
  retryReader.onerror = function (evtErr) {
    restoreUploadSection();
    alert('Error reading Excel file: ' + (evtErr && evtErr.message ? evtErr.message : 'Failed to read file'));
  };
  retryReader.readAsArrayBuffer(file);
}

function handleXLSX(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var buffer = e.target.result;
    var isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent || '');

    // Try Worker first (better memory headroom, non-blocking)
    var workerSupported = (typeof Worker !== 'undefined');

    if (workerSupported) {
      try {
        // Use a blob worker so it works from file:// protocol
        var workerSrc = 'js/xlsx-worker.js';
        var worker = new Worker(workerSrc);

        worker.onmessage = function (ev) {
          var msg = ev.data;
          if (msg.type === 'progress') {
            updateLoaderMsg(msg.msg);
          } else if (msg.type === 'done') {
            worker.terminate();
            parseCSVAndFinish(msg.csv, file.name, msg.headerIdx > 0);
          } else if (msg.type === 'error') {
            worker.terminate();
            restoreUploadSection();
            alert('Error reading Excel file:\n' + msg.msg);
          }
        };

        worker.onerror = function (err) {
          worker.terminate();
          // Worker failed (e.g. file:// blocked importScripts) — re-read safely for fallback
          fallbackXLSXMainThreadFromFile(file, err && err.message ? err.message : 'Worker runtime error');
        };

        // Firefox can report detached ArrayBuffer issues with transferable upload buffers.
        // Avoid transfer-list semantics there and let structured clone copy the data.
        if (isFirefox) {
          worker.postMessage(buffer);
        } else {
          worker.postMessage(buffer, [buffer]);
        }
        return;
      } catch (workerErr) {
        fallbackXLSXMainThreadFromFile(file, workerErr && workerErr.message ? workerErr.message : 'Worker start failure');
        return;
      }
    }

    // Fallback: run on main thread
    handleXLSXMainThread(buffer, file.name);
  };
  reader.readAsArrayBuffer(file);
}

// Main-thread XLSX fallback (same logic as worker but synchronous)
function handleXLSXMainThread(buffer, filename) {
  setTimeout(function () {
    try {
      updateLoaderMsg('Parsing Excel file…');
      var wb = XLSX.read(buffer, {
        type: 'array',
        cellDates: false,
        cellHTML: false,
        cellStyles: false,
        cellFormula: false,
        dense: true
      });

      updateLoaderMsg('Detecting data layout…');
      var sheetName = null, headerIdx = 0;

      for (var si = 0; si < wb.SheetNames.length; si++) {
        var candidateSheet = wb.Sheets[wb.SheetNames[si]];
        if (!candidateSheet || !candidateSheet['!ref']) continue;
        var preview = XLSX.utils.sheet_to_json(candidateSheet, { header: 1, defval: null, raw: true, sheetRows: 15 });
        if (!preview || preview.length === 0) continue;
        var hi = findHeaderRowIndex(preview);
        var hrow = preview[hi] || [];
        var score = 0;
        for (var ci = 0; ci < hrow.length; ci++) {
          if (hrow[ci] && KNOWN_COLUMNS.indexOf(String(hrow[ci]).trim()) !== -1) score++;
        }
        if (score > 0) { sheetName = wb.SheetNames[si]; headerIdx = hi; break; }
      }
      if (!sheetName) {
        for (var si2 = 0; si2 < wb.SheetNames.length; si2++) {
          var fs = wb.Sheets[wb.SheetNames[si2]];
          if (fs && fs['!ref']) { sheetName = wb.SheetNames[si2]; break; }
        }
      }
      if (!sheetName) {
        restoreUploadSection();
        alert('No readable sheets found. Sheets: ' + wb.SheetNames.join(', '));
        return;
      }

      updateLoaderMsg('Converting to CSV…');
      var csvString = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { defval: '' });
      if (headerIdx > 0) {
        var lines = csvString.split('\n');
        csvString = lines.slice(headerIdx).join('\n');
      }

      parseCSVAndFinish(csvString, filename, headerIdx > 0);
    } catch (err) {
      restoreUploadSection();
      console.error(err);
      alert('Error reading Excel file: ' + err.message);
    }
  }, 50);
}

// Shared final step: PapaParse the CSV string → transform → display
function parseCSVAndFinish(csvString, filename, headerAutoDetected) {
  if (!csvString || csvString.trim() === '') {
    restoreUploadSection();
    alert('The sheet appears to be empty after reading.');
    return;
  }
  updateLoaderMsg('Parsing rows…');
  Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    complete: function (results) {
      if (!results.data || results.data.length === 0) {
        restoreUploadSection();
        alert('No data rows found.');
        return;
      }
      updateLoaderMsg('Processing ' + results.data.length.toLocaleString() + ' rows…');
      setTimeout(function () {
        try {
          APP_DATA = transformData(results.data);
          var _wsGeoIds2 = [];
          APP_DATA.forEach(function(r) { var v = String(r["BE GEO ID"] || "").trim(); if (v && _wsGeoIds2.indexOf(v) === -1) _wsGeoIds2.push(v); });
          _wsGeoIds2.sort();
          var _wsIdbKey2 = _wsGeoIds2.length > 0 ? "ws-geo-" + _wsGeoIds2.join("_") : "ws-" + filename;
          finishLoad(filename, APP_DATA.length, headerAutoDetected, _wsIdbKey2);
        } catch (err) {
          restoreUploadSection();
          console.error(err);
          alert('Error processing data: ' + err.message);
        }
      }, 50);
    },
    error: function (err) {
      restoreUploadSection();
      alert('Error parsing sheet: ' + err.message);
    }
  });
}

function finishLoad(filename, rowCount, headerAutoDetected, idbType, loadedAt, fromCache) {
  // Sync disti flag — detect from data if transformData didn't run (cache load)
  APP_IS_DISTI = !!window.APP_IS_DISTI ||
    !!(APP_DATA && APP_DATA.length > 0 && APP_DATA.some(function(r) {
      return r["Disti name"] && String(r["Disti name"]).trim() !== "";
    }));
  window.APP_IS_DISTI = APP_IS_DISTI;

  // Extract display name from data
  var displayName = "";
  if (APP_DATA && APP_DATA.length > 0) {
    if (APP_IS_DISTI) {
      var distiNames = [];
      APP_DATA.forEach(function(r) { if (r["Disti name"]) distiNames.push(String(r["Disti name"]).trim()); });
      var uniqueDisti = Array.from(new Set(distiNames)).filter(Boolean);
      displayName = uniqueDisti.slice(0, 2).join(", ") + (uniqueDisti.length > 2 ? " +" + (uniqueDisti.length - 2) + " more" : "");
    } else {
      var partnerNames = [];
      APP_DATA.forEach(function(r) { if (r["Partner Name"]) partnerNames.push(String(r["Partner Name"]).trim()); });
      var uniquePartners = Array.from(new Set(partnerNames)).filter(Boolean);
      displayName = uniquePartners.slice(0, 2).join(", ") + (uniquePartners.length > 2 ? " +" + (uniquePartners.length - 2) + " more" : "");
    }
  }

  // Save to IndexedDB (fire-and-forget)
  if (idbType && APP_DATA) {
    var beGeoIds = [];
    APP_DATA.forEach(function(r) { var v = String(r["BE GEO ID"] || "").trim(); if (v && beGeoIds.indexOf(v) === -1) beGeoIds.push(v); });
    var _pendingHandle = PENDING_FILE_HANDLE;
    PENDING_FILE_HANDLE = null;
    IDB.save(idbType, APP_DATA, {
      filename:         filename,
      rowCount:         rowCount,
      loadedAt:         fromCache ? loadedAt : new Date().toISOString(),
      fileLastModified: APP_FILE_META && APP_FILE_META.lastModified ? APP_FILE_META.lastModified.toISOString() : null,
      displayName:      displayName,
      beGeoIds:         beGeoIds,
      isDisti:          APP_IS_DISTI,
      hasFileHandle:    !!_pendingHandle
    }).catch(function (e) { console.warn("IDB save failed:", e); });
    if (_pendingHandle) {
      IDB.saveHandle(idbType, _pendingHandle).catch(function(e) { console.warn("Handle save failed:", e); });
    }
  }

  restoreUploadSection([]);  // clear upload section
  document.getElementById("upload-section").classList.add("d-none");
  document.getElementById("mainTabContent").classList.remove("d-none");
  document.getElementById("main-tab-bar").classList.remove("d-none");
  renderMultiPicker(); // re-render persistent session bar (highlights active, keeps others)

  var pviTab = document.getElementById("tab-pvi-btn");
  if (pviTab) pviTab.closest("li").classList.toggle("d-none", APP_IS_DISTI);
  var sb = document.getElementById("status-bar");
  sb.classList.remove("d-none");
  sb.classList.add("d-flex");
  document.getElementById("status-filename").textContent = filename;
  document.getElementById("status-rows").textContent =
    rowCount.toLocaleString() + " rows" +
    (headerAutoDetected ? " · header auto-detected" : "");
  var dateEl = document.getElementById("status-date");
  dateEl.textContent = "";

  var activeTab = document.querySelector(".nav-link.active[data-bs-target]");
  var _activeTarget = activeTab ? activeTab.dataset.bsTarget : "#tab-overview";
  ANNOTATIONS.load().then(function () {
    renderActiveTab(_activeTarget);
  }).catch(function (err) {
    console.warn("[AdoptDash] ANNOTATIONS.load() failed, rendering anyway:", err);
    renderActiveTab(_activeTarget);
  });
  // Always reset first so no dismissed state bleeds from a previous session
  window._dismissedNotifs = {};
  window._currentSessionKey = idbType || null;
  if (fromCache) {
    // Restore dismissed state only when resuming from cache
    try {
      var stored = localStorage.getItem(_notifStorageKey(window._currentSessionKey));
      if (stored) window._dismissedNotifs = JSON.parse(stored);
    } catch(e) {}
  } else {
    // Fresh load or refresh — clear any stale dismissed state for this session
    try { localStorage.removeItem(_notifStorageKey(window._currentSessionKey)); } catch(e) {}
  }
  showDataNotifications(APP_DATA);
}

function restoreUploadSection(cachedEntries) {
  cachedEntries = cachedEntries || [];
  var sec = document.getElementById("upload-section");
  sec.classList.remove("d-none");
  var isChrome = typeof navigator !== 'undefined' && /chrome/i.test(navigator.userAgent || '') && !/edg/i.test(navigator.userAgent || '');

  function fmtDate(iso) {
    if (!iso) return "";
    var d = (iso instanceof Date) ? iso : new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(APP_LOCALE) + " " + d.toLocaleTimeString(APP_LOCALE, { hour: "2-digit", minute: "2-digit" });
  }

  function resumeCard(entry) {
    var isCpi = entry.type.indexOf("cpi-") === 0;
    var beGeoId = isCpi ? entry.type.replace("cpi-", "") : "";
    var displayName = entry.meta.displayName || "";
    var cardColor  = isCpi ? "warning" : "success";
    var btnColor   = isCpi ? "warning" : "success";
    var html = '<div class="col-6"><div class="card border-' + cardColor + ' mb-2 p-2">';
    html += '<div class="d-flex justify-content-between align-items-start gap-2">';
    html += '<div style="min-width:0">';
    if (isCpi) {
      if (displayName) html += '<div class="fw-semibold small">' + displayName + '</div>';
    } else {
      html += '<div class="fw-semibold small">' + (displayName || entry.meta.filename) + '</div>';
    }
    if (isCpi) {
      html += '<div class="text-muted" style="font-size:0.72rem">BE GEO ID ' + beGeoId + ' &middot; ' + (entry.meta.rowCount||0).toLocaleString() + ' rows</div>';
    } else {
      var geoStr = (entry.meta.beGeoIds && entry.meta.beGeoIds.length > 0) ? entry.meta.beGeoIds.slice(0,3).join(", ") + (entry.meta.beGeoIds.length > 3 ? " +" + (entry.meta.beGeoIds.length - 3) + " more" : "") : "";
      html += '<div class="text-muted" style="font-size:0.72rem">' + (geoStr ? 'BE GEO ID ' + geoStr + ' &middot; ' : '') + (entry.meta.rowCount||0).toLocaleString() + ' rows</div>';
    }
    var basename = (entry.meta.filename || '').split(/[\\/]/).pop().replace(/\s*·\s*BE GEO ID.*$/, '');
    var dateStr = fmtDate(entry.meta.loadedAt);
    html += '<div class="text-muted text-truncate" style="font-size:0.72rem" title="' + entry.meta.filename + '">' + basename + '</div>';
    if (dateStr) html += '<div class="text-muted" style="font-size:0.72rem">' + dateStr + '</div>';
    html += '</div>';
    html += '<div class="d-flex gap-1 flex-shrink-0">';
    html += '<button class="btn btn-sm btn-' + btnColor + ' idb-resume-btn py-0" data-idbtype="' + entry.type + '" title="Resume"><i class="bi bi-play-fill"></i></button>';
    if (entry.meta.hasFileHandle || isChrome) {
      html += '<button class="btn btn-sm btn-outline-primary idb-refresh-btn py-0" data-idbtype="' + entry.type + '" title="Refresh from file"><i class="bi bi-arrow-clockwise"></i></button>';
    }
    html += '<button class="btn btn-sm btn-outline-danger idb-clear-btn py-0" data-idbtype="' + entry.type + '" title="Delete"><i class="bi bi-trash"></i></button>';
    html += '</div></div></div></div>';
    return html;
  }

  // Split cached entries — exclude any IDs already covered by APP_MULTI_SESSIONS
  var multiGeoIds = APP_MULTI_SESSIONS ? APP_MULTI_SESSIONS.sessions.map(function(s) { return "cpi-" + s.id; }) : [];
  var wsEntries = [];
  var cpiEntries = [];
  cachedEntries.forEach(function (e) {
    if (e.type.indexOf("ws-") === 0) wsEntries.push(e);
    else if (e.type.indexOf("cpi-") === 0 && multiGeoIds.indexOf(e.type) === -1) cpiEntries.push(e);
  });

  // ── Compute week options: Latest, then previous weeks down to 2026W23 ─────
  var savedRegion = localStorage.getItem("lci-region") || "EMEA";
  function getISOWeek(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return { year: d.getUTCFullYear(), week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7) };
  }
  var now = getISOWeek(new Date());
  var weekOptions = '<option value="">Latest</option>';
  for (var w = now.week - 1; w >= 23; w--) {
    var wLabel = now.year + "W" + (w < 10 ? "0" + w : w);
    weekOptions += '<option value="' + wLabel + '">' + wLabel + '</option>';
  }

  // ── Build two-column layout ────────────────────────────────────────────────
  sec.innerHTML =
    '<div class="container-fluid py-4" style="max-width:1400px">' +
    '<div class="row g-4">' +

    // ── LEFT: Partner column ──────────────────────────────────────────────────
    '<div class="col-12 col-lg-6">' +

    // Partner upload card
    '<div class="card shadow-sm border-primary mb-3">' +
    '<div class="card-header bg-primary bg-opacity-10 fw-semibold" style="font-size:0.9rem"><i class="bi bi-people-fill me-2 text-primary"></i>Partners</div>' +
    '<div class="card-body p-4 text-center">' +
    // Toggle tabs
    '<ul class="nav nav-pills mb-3 justify-content-center" id="ws-load-tabs">' +
    '<li class="nav-item"><button class="nav-link active py-1 px-3" id="ws-tab-file" style="font-size:0.85rem"><i class="bi bi-file-earmark-spreadsheet me-1"></i>Upload File</button></li>' +
    '<li class="nav-item ms-1"><button class="nav-link py-1 px-3" id="ws-tab-api" style="font-size:0.85rem"><i class="bi bi-cloud-download me-1"></i>Load via API</button></li>' +
    '</ul>' +
    // File upload panel
    '<div id="ws-panel-file" class="text-center">' +
    '<i class="bi bi-cloud-upload cisco-icon-lg mb-3"></i>' +
    '<p class="text-muted mb-3">Upload your Workspan report export<br/>' +
    '<small><a href="https://app.workspan.com/reports/view/19849" target="_blank" rel="noopener"><strong>Report 19849</strong></a> for Partners &nbsp;|&nbsp; <a href="https://app.workspan.com/reports/view/21766" target="_blank" rel="noopener"><strong>Report 21766</strong></a> for Distributors</small>' +
    '</p>' +
    '<div class="alert alert-warning py-2 px-3 text-start small mb-4">' +
    '<i class="bi bi-exclamation-triangle me-1"></i><strong>For large exports (&gt;20 MB), use CSV.</strong><br/>' +
    'In Workspan: <em>Export → CSV</em>. CSV handles any number of rows.' +
    '</div>' +
    '<button id="ws-choose-btn" class="btn btn-cisco btn-lg mb-3 px-5"><i class="bi bi-file-earmark-spreadsheet me-2"></i>Choose File (.xlsx or .csv)</button>' +
    '<input type="file" id="file-input" accept=".xlsx,.xls,.csv" class="d-none" />' +
    '</div>' +
    // API panel
    '<div id="ws-panel-api" class="d-none text-start">' +
    '<div class="alert alert-info py-2 px-3 small mb-3"><i class="bi bi-info-circle me-1"></i>' +
    '<strong>Requires the local proxy to be running.</strong> Start it first using ' +
    '<code>Start Proxy (Windows).bat</code> or <code>Start Proxy (Mac).sh</code> from the app folder.</div>' +
    '<p class="text-muted small mb-3">Enter your WorkSpan API credentials to download the report directly. Credentials are used only in your browser and never stored.</p>' +
    '<p class="text-muted small mb-3"><i class="bi bi-hourglass-split me-1"></i><strong>Note:</strong> Depending on report size, this may take a few minutes.</p>' +
    '<div class="mb-2">' +
    '<label class="form-label small fw-semibold mb-1">Report ID</label>' +
    '<input type="number" id="ws-report-id" class="form-control form-control-sm" placeholder="e.g. 19849" />' +
    '</div>' +
    '<div class="mb-2">' +
    '<label class="form-label small fw-semibold mb-1">Client ID</label>' +
    '<input type="text" id="ws-client-id" class="form-control form-control-sm" placeholder="WS-ApplicationUser_…" style="font-family:monospace;font-size:0.8rem" />' +
    '</div>' +
    '<div class="mb-3">' +
    '<label class="form-label small fw-semibold mb-1">Client Secret</label>' +
    '<input type="password" id="ws-client-secret" class="form-control form-control-sm" placeholder="••••••••••••" style="font-family:monospace" />' +
    '</div>' +
    '<div id="ws-api-error" class="alert alert-danger py-2 px-3 small mb-2 d-none"></div>' +
    '<div id="ws-api-status" class="text-muted small mb-2 d-none"><i class="bi bi-arrow-repeat me-1"></i><span id="ws-api-status-text"></span></div>' +
    '<button id="ws-api-load-btn" class="btn btn-primary px-4"><i class="bi bi-cloud-download me-2"></i>Load Report</button>' +
    '<p class="text-muted small mt-3 mb-0"><i class="bi bi-shield-lock me-1"></i>API calls are routed through the local proxy on your machine. No data leaves your computer.</p>' +
    '</div>' +
    '</div></div>' +

    // Previous partner sessions
    (wsEntries.length > 0 ?
      '<div class="card shadow-sm border-success">' +
      '<div class="card-header bg-success bg-opacity-10 fw-semibold" style="font-size:0.85rem"><i class="bi bi-lightning-charge-fill me-2 text-success"></i>Previous sessions</div>' +
      '<div class="card-body p-2"><div class="row g-2">' + wsEntries.map(resumeCard).join("") + '</div></div>' +
      '</div>'
    : '') +

    '</div>' + // /left col

    // ── RIGHT: Cisco-internal column ──────────────────────────────────────────
    '<div class="col-12 col-lg-6">' +

    // Cisco CPI card
    '<div class="card shadow-sm border-warning mb-3">' +
    '<div class="card-header bg-warning bg-opacity-10 fw-semibold" style="font-size:0.9rem"><i class="bi bi-lock-fill me-2 text-warning"></i>Cisco-internal</div>' +
    '<div class="card-body p-4 text-center">' +
    '<p class="small mb-3"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="16" height="16" style="vertical-align:-2px;margin-right:4px"><path d="M50,0 A50,50 0 0,1 93.3,75 L50,50Z" fill="#EA4335"/><path d="M93.3,75 A50,50 0 0,1 6.7,75 L50,50Z" fill="#FBBC05"/><path d="M6.7,75 A50,50 0 0,1 50,0 L50,50Z" fill="#34A853"/><circle cx="50" cy="50" r="33" fill="white"/><circle cx="50" cy="50" r="20" fill="#4285F4"/></svg><strong>Chrome recommended for the best experience.</strong></p>' +
    '<div class="row g-2 mb-3 align-items-end">' +
    '<div class="col-auto"><label class="form-label small fw-semibold mb-1">Region</label>' +
    '<select id="lci-region" class="form-select form-select-sm">' +
    ['EMEA','AMER','APJC','DISTI'].map(function(r){ return '<option value="'+r+'"'+(r===savedRegion?' selected':'')+'>'+r+'</option>'; }).join('') +
    '</select></div>'+
    '<div class="col-auto"><label class="form-label small fw-semibold mb-1">Week</label>' +
    '<select id="lci-week" class="form-select form-select-sm">' + weekOptions + '</select></div>' +
    '<div class="col"><label class="form-label small fw-semibold mb-1">BE GEO ID(s) <span class="fw-normal text-muted" style="font-size:0.75rem">— Separate multiple IDs with comma or space.</span></label>' +
    '<div id="lci-begeoid-wrap" class="form-control form-control-sm d-flex flex-wrap gap-1 align-items-center" style="height:auto;min-height:31px;cursor:text;padding:3px 8px">' +
    '<input type="text" id="lci-begeoid" class="border-0 p-0 bg-transparent" style="outline:none;width:90px;min-width:60px;font-size:0.875rem" placeholder="e.g. 12345" />' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div id="lci-error" class="alert alert-danger py-2 px-3 small mb-3 d-none"></div>' +
    '<div id="lci-session-picker" class="d-none"></div>' +
    '<div id="lci-last-file-hint" class="d-none mb-2 text-start small">' +
    '<i class="bi bi-file-earmark-check me-1 text-success"></i>' +
    '<span id="lci-last-file-name" class="fw-semibold"></span>' +
    ' &nbsp;<a href="#" id="lci-pick-different" class="text-muted">Use different file</a>' +
    '</div>' +
    '<div class="d-flex align-items-center gap-3 flex-wrap">' +
    '<p class="text-muted small mb-0">Locate the <span id="lci-file-hint-text" class="fw-semibold fst-italic"></span> file in your OneDrive.</p>' +
    '<button id="lci-load-btn" class="btn btn-warning px-4"><i class="bi bi-folder2-open me-2"></i>Load CPI File…</button>' +
    '<input type="file" id="lci-file-input" accept=".csv" class="d-none" />' +
    '</div>'+
    '</div></div>' +

    // Previous CPI sessions (cached + any pending multi-session results)
    (function() {
      var multiCards = "";
      if (APP_MULTI_SESSIONS && APP_MULTI_SESSIONS.sessions.length > 0) {
        multiCards = APP_MULTI_SESSIONS.sessions.map(function(sess, i) {
          var name = sess.partnerName ? '<div class="fw-semibold small">' + sess.partnerName + '</div>' : '';
          // Use per-session IDB loadedAt if available, fall back to shared loadedAt
          var idbEntry = cachedEntries.find(function(e) { return e.type === "cpi-" + sess.id; });
          var loadedAt = (idbEntry && idbEntry.meta && idbEntry.meta.loadedAt) ? idbEntry.meta.loadedAt : (APP_MULTI_SESSIONS.loadedAt || null);
          var dateStr = loadedAt ? (function(iso){ var d=new Date(iso); return isNaN(d)?'':(d.toLocaleDateString(APP_LOCALE)+' '+d.toLocaleTimeString(APP_LOCALE,{hour:'2-digit',minute:'2-digit'})); })(loadedAt) : '';
          var hasHandle = !!(APP_MULTI_SESSIONS && APP_MULTI_SESSIONS.hasHandle);
          return '<div class="col-6"><div class="card border-warning mb-0 p-2">' +
            '<div class="d-flex justify-content-between align-items-start gap-2">' +
            '<div style="min-width:0">' +
            name +
            '<div class="text-muted" style="font-size:0.72rem">BE GEO ID ' + sess.id + ' &middot; ' + sess.rows.length.toLocaleString() + ' rows</div>' +
            '<div class="text-muted text-truncate" style="font-size:0.72rem">' + APP_MULTI_SESSIONS.fileMeta.name + (dateStr ? ' &middot; ' + dateStr : '') + '</div>' +
            '</div>' +
            '<div class="d-flex gap-1 flex-shrink-0">' +
            '<button class="btn btn-sm btn-warning py-0 multi-pick-btn flex-shrink-0" data-geo-idx="' + i + '" title="Load"><i class="bi bi-play-fill"></i></button>' +
            (hasHandle ? '<button class="btn btn-sm btn-outline-primary py-0 idb-refresh-btn flex-shrink-0" data-idbtype="cpi-' + sess.id + '" title="Refresh from file"><i class="bi bi-arrow-clockwise"></i></button>' : '') +
            '<button class="btn btn-sm btn-outline-danger py-0 multi-del-btn flex-shrink-0" data-geo-idx="' + i + '" title="Delete"><i class="bi bi-trash"></i></button>' +
            '</div>' +
            '</div></div></div>';
        }).join("");
      }
      var hasAny = cpiEntries.length > 0 || multiCards;
      if (!hasAny) return '';
      return '<div class="card shadow-sm border-warning">' +
        '<div class="card-header bg-warning bg-opacity-10 fw-semibold d-flex justify-content-between align-items-center gap-2" style="font-size:0.85rem"><span><i class="bi bi-lightning-charge-fill me-2 text-warning"></i>Previous sessions</span>' +
        (isChrome ? '<button id="cpi-refresh-all-btn" class="btn btn-sm btn-outline-primary py-0 flex-shrink-0" title="Refresh all previous sessions"><i class="bi bi-arrow-clockwise me-1"></i>Refresh all</button>' : '') +
        '</div>' +
        '<div class="card-body p-2" id="cpi-prev-sessions-body"><div class="row g-2">' +
        multiCards +
        cpiEntries.map(resumeCard).join("") +
        '</div></div></div>';
    })()+

    '</div>' + // /right col
    '</div>' +
    // ── Clear all data button ─────────────────────────────────────────────
    '<div class="text-center mt-2 mb-1">' +
    '<p class="text-muted small mb-2"><i class="bi bi-shield-lock me-1"></i>All data is processed entirely in your browser — nothing is sent to any server.</p>' +
    '<button id="clear-all-btn" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash me-1"></i>Clear all browser data</button>' +
    '</div>'+
    '</div>'; // /container

  // ── Wire up file inputs ───────────────────────────────────────────────────
  document.getElementById("ws-choose-btn").addEventListener("click", function () {
    if (typeof window.showOpenFilePicker === "function") {
      window.showOpenFilePicker({
        types: [{ description: "Workspan Report", accept: { "application/octet-stream": [".xlsx", ".xls", ".csv"], "text/csv": [".csv"] } }],
        multiple: false
      }).then(function (handles) {
        var handle = handles[0];
        PENDING_FILE_HANDLE = handle;
        return handle.getFile();
      }).then(function (file) {
        processPartnerFile(file);
      }).catch(function (err) {
        PENDING_FILE_HANDLE = null;
        if (err.name !== "AbortError") {
          console.warn("showOpenFilePicker failed, falling back:", err);
          document.getElementById("file-input").click();
        }
      });
    } else {
      document.getElementById("file-input").click();
    }
  });

  document.getElementById("file-input").addEventListener("change", handleFileUpload);

  // ── API tab toggle ────────────────────────────────────────────────────────
  // Hide the API tab when running from GitHub Pages (proxy not available)
  if (window.location.hostname === "marckhayat.github.io") {
    document.getElementById("ws-tab-api").style.display = "none";
    document.getElementById("ws-tab-file").style.cursor = "default";
    document.getElementById("ws-tab-file").style.pointerEvents = "none";
  }

  document.getElementById("ws-tab-file").addEventListener("click", function() {
    this.classList.add("active");
    document.getElementById("ws-tab-api").classList.remove("active");
    document.getElementById("ws-panel-file").classList.remove("d-none");
    document.getElementById("ws-panel-api").classList.add("d-none");
  });
  document.getElementById("ws-tab-api").addEventListener("click", function() {
    this.classList.add("active");
    document.getElementById("ws-tab-file").classList.remove("active");
    document.getElementById("ws-panel-api").classList.remove("d-none");
    document.getElementById("ws-panel-file").classList.add("d-none");
  });

  // ── API load button ───────────────────────────────────────────────────────
  // Restore saved API credentials
  var savedReportId = localStorage.getItem("ws-report-id") || "";
  var savedClientId = localStorage.getItem("ws-client-id") || "";
  var savedSecret   = localStorage.getItem("ws-client-secret") || "";
  if (savedReportId) document.getElementById("ws-report-id").value = savedReportId;
  if (savedClientId) document.getElementById("ws-client-id").value = savedClientId;
  if (savedSecret)   document.getElementById("ws-client-secret").value = savedSecret;

  document.getElementById("ws-report-id").addEventListener("input", function() {
    localStorage.setItem("ws-report-id", this.value.trim());
  });
  document.getElementById("ws-client-id").addEventListener("input", function() {
    localStorage.setItem("ws-client-id", this.value.trim());
  });
  document.getElementById("ws-client-secret").addEventListener("input", function() {
    localStorage.setItem("ws-client-secret", this.value.trim());
  });

  document.getElementById("ws-api-load-btn").addEventListener("click", function() {
    var reportId = document.getElementById("ws-report-id").value.trim();
    var clientId = document.getElementById("ws-client-id").value.trim();
    var secret   = document.getElementById("ws-client-secret").value.trim();
    var errEl    = document.getElementById("ws-api-error");
    var statusEl = document.getElementById("ws-api-status");
    var statusTxt= document.getElementById("ws-api-status-text");
    errEl.classList.add("d-none");
    if (!reportId || !clientId || !secret) {
      errEl.textContent = "Please fill in all three fields.";
      errEl.classList.remove("d-none");
      return;
    }
    document.getElementById("ws-api-load-btn").disabled = true;
    statusEl.classList.remove("d-none");
    statusTxt.textContent = "Connecting…";

    wsLoadReport({
      reportId: reportId,
      clientId: clientId,
      clientSecret: secret,
      onStatus: function(msg) { statusTxt.textContent = msg; updateLoaderMsg && updateLoaderMsg(msg); }
    }).then(function(rows) {
      if (!rows || rows.length === 0) throw new Error("No data returned from API.");
      showLoader("Processing " + rows.length.toLocaleString() + " rows…");
      setTimeout(function() {
        APP_DATA = transformData(rows);
        APP_FILE_META = { name: "WorkSpan Report " + reportId, lastModified: new Date() };
        finishLoad("WorkSpan Report " + reportId, APP_DATA.length, false, "ws-api-" + reportId);
      }, 0);
    }).catch(function(err) {
      document.getElementById("ws-api-load-btn").disabled = false;
      statusEl.classList.add("d-none");
      var isProxyDown = err.message.indexOf("Failed to fetch") !== -1 || err.message.indexOf("ERR_CONNECTION_REFUSED") !== -1;
      errEl.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>' + err.message +
        (isProxyDown ? '<br/><span class="text-muted">The local proxy is not running. ' +
          'Please start it first using <strong>Start Proxy (Windows).bat</strong> or <strong>Start Proxy (Mac).sh</strong> ' +
          'from the app folder.</span>' : '');
      errEl.classList.remove("d-none");
    });
  });

  // ── Multi-session pick buttons (pending GEO sessions not yet cached) ──────
  sec.querySelectorAll(".multi-pick-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var idx = parseInt(this.dataset.geoIdx, 10);
      var sess = APP_MULTI_SESSIONS.sessions[idx];
      // Use pre-transformed data if available (saved on import), otherwise transform now
      if (sess._transformed) {
        APP_DATA = sess._transformed;
        APP_FILE_META = APP_MULTI_SESSIONS.fileMeta;
        finishLoad(APP_MULTI_SESSIONS.fileMeta.name + " · BE GEO ID " + sess.id, APP_DATA.length, false, "cpi-" + sess.id, APP_MULTI_SESSIONS.loadedAt, false);
      } else {
        showLoader("Processing " + sess.rows.length + " rows for " + sess.id + "…");
        setTimeout(function() {
          APP_DATA = transformData(sess.rows);
          APP_FILE_META = APP_MULTI_SESSIONS.fileMeta;
          finishLoad(APP_MULTI_SESSIONS.fileMeta.name + " · BE GEO ID " + sess.id, APP_DATA.length, false, "cpi-" + sess.id, APP_MULTI_SESSIONS.loadedAt, false);
        }, 0);
      }
    });
  });

  sec.querySelectorAll(".multi-del-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var idx = parseInt(this.dataset.geoIdx, 10);
      var sess = APP_MULTI_SESSIONS.sessions[idx];
      var idbKey = "cpi-" + sess.id;
      APP_MULTI_SESSIONS.sessions.splice(idx, 1);
      if (APP_MULTI_SESSIONS.sessions.length === 0) APP_MULTI_SESSIONS = null;
      IDB.remove(idbKey).catch(function() {});
      IDB.removeHandle(idbKey).catch(function() {});
      IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
    });
  });

  // ── Resume / Clear cache buttons ─────────────────────────────────────────
  sec.querySelectorAll(".idb-resume-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var type = this.dataset.idbtype;
      showLoader("Loading from cache…");
      IDB.load(type).then(function (entry) {
        if (!entry || !entry.data) { IDB.loadAllMeta().then(function(e){restoreUploadSection(e);}); alert("Cache not found."); return; }
        APP_DATA = entry.data;
        APP_FILE_META = { name: entry.meta.filename, lastModified: entry.meta.fileLastModified ? new Date(entry.meta.fileLastModified) : null, cachedAt: entry.meta.loadedAt ? new Date(entry.meta.loadedAt) : null };
        window.APP_IS_DISTI = !!entry.meta.isDisti;
        finishLoad(entry.meta.filename, entry.meta.rowCount, false, type, entry.meta.loadedAt, true);
      }).catch(function (e) { IDB.loadAllMeta().then(function(en){restoreUploadSection(en);}); alert("Error loading cache: " + e); });
    });
  });

  sec.querySelectorAll(".idb-clear-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var type = this.dataset.idbtype;
      // Load session data first to collect WS-IDs, then delete annotations for them
      IDB.load(type).then(function (entry) {
        var wsIds = [];
        if (entry && entry.data) {
          entry.data.forEach(function (r) {
            var id = String(r["Deal WS-ID"] || "");
            if (id) wsIds.push(id);
          });
        }
        return IDB.remove(type).then(function () {
          IDB.removeHandle(type).catch(function() {});
          if (wsIds.length) ANNOTATIONS.clearForWsIds(wsIds);
          IDB.loadAllMeta().then(function (entries) { restoreUploadSection(entries); });
        });
      }).catch(function () {
        // Fallback: delete session even if load failed
        IDB.remove(type).then(function () {
          IDB.removeHandle(type).catch(function() {});
          IDB.loadAllMeta().then(function (entries) { restoreUploadSection(entries); });
        });
      });
    });
  });

  sec.querySelectorAll(".idb-refresh-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var type = this.dataset.idbtype;
      showRefreshToast("Refreshing\u2026");
      // Always use cacheOnly=true so the UI stays on the upload screen
      // and all session cards remain visible after refresh
      refreshFromHandle(type, true).then(function () {
        hideRefreshToast();
        // Clear dismissed notifications so fresh data shows all notifications
        try { localStorage.removeItem(_notifStorageKey(type)); } catch(e) {}
        // If this refreshed session is currently active and the dashboard is showing, reload data and refresh notifications
        if (window._currentSessionKey === type && document.getElementById("upload-section").classList.contains("d-none")) {
          IDB.load(type).then(function(entry) {
            if (entry && entry.data) {
              APP_DATA = entry.data;
              window._dismissedNotifs = {};
              showDataNotifications(APP_DATA);
            }
          });
        }
        if (APP_MULTI_SESSIONS && type.indexOf("cpi-") === 0) APP_MULTI_SESSIONS.loadedAt = new Date().toISOString();
        IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
      }).catch(function () {
        hideRefreshToast();
      });
    });
  });

  var cpiRefreshAllBtn = document.getElementById("cpi-refresh-all-btn");
  if (cpiRefreshAllBtn) {
    cpiRefreshAllBtn.addEventListener("click", function () {
      refreshAllPreviousSessions();
    });
  }

  document.getElementById("clear-all-btn").addEventListener("click", function () {
    if (!confirm("This will delete all cached sessions and your saved username. Continue?")) return;
    IDB.clearAll().then(function () {
      IDB.clearAllHandles().catch(function() {});
      ANNOTATIONS.clearAll();
      localStorage.removeItem("ws-report-id");
      localStorage.removeItem("ws-client-id");
      localStorage.removeItem("ws-client-secret");
      APP_MULTI_SESSIONS = null;
      location.reload();
    });
  });

  function updateLciHint() {
    var region = document.getElementById("lci-region").value;
    var week   = document.getElementById("lci-week").value;
    var regionFile = region === "DISTI" ? "DISTI" : region;
    var filename = week ? "CPI_data_" + regionFile + "_" + week + ".csv" : "CPI_data_" + regionFile + ".csv";
    document.getElementById("lci-file-hint-text").textContent = filename;
  }

  ["lci-region","lci-week"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function () {
      if (id === "lci-region") localStorage.setItem("lci-region", this.value);
      updateLciHint();
    });
  });
  updateLciHint();

  // ── Chip / tag input for BE GEO IDs ──────────────────────────────────────
  var lciGeoIds = [];
  var beGeoInput = document.getElementById("lci-begeoid");
  var beGeoWrap  = document.getElementById("lci-begeoid-wrap");

  function renderChips() {
    // Remove all existing chips (keep the input itself)
    Array.from(beGeoWrap.querySelectorAll(".geo-chip")).forEach(function(c) { c.remove(); });
    lciGeoIds.forEach(function(id) {
      var chip = document.createElement("span");
      chip.className = "geo-chip badge d-inline-flex align-items-center gap-1 me-1";
      chip.style.cssText = "background:#ffc107;color:#212529;font-size:0.8rem;padding:3px 7px;border-radius:12px;font-weight:500";
      chip.textContent = id;
      var x = document.createElement("button");
      x.type = "button";
      x.style.cssText = "background:none;border:none;padding:0 0 0 3px;cursor:pointer;font-size:0.75rem;line-height:1;color:#555;";
      x.innerHTML = "&#x2715;";
      x.setAttribute("aria-label", "Remove " + id);
      x.addEventListener("click", function(e) {
        e.stopPropagation();
        lciGeoIds = lciGeoIds.filter(function(v) { return v !== id; });
        renderChips();
        if (lciGeoIds.length === 0) beGeoInput.placeholder = "e.g. 12345";
      });
      chip.appendChild(x);
      beGeoWrap.insertBefore(chip, beGeoInput);
    });
    beGeoInput.placeholder = lciGeoIds.length === 0 ? "e.g. 12345" : "";
  }

  function commitGeoInput() {
    var raw = beGeoInput.value;
    var parts = raw.split(/[\s,]+/).map(function(s) { return s.trim(); }).filter(Boolean);
    var added = false;
    parts.forEach(function(id) {
      if (id && lciGeoIds.indexOf(id) === -1) { lciGeoIds.push(id); added = true; }
    });
    beGeoInput.value = "";
    if (added) renderChips();
  }

  beGeoInput.addEventListener("keydown", function(e) {
    if (e.key === "," || e.key === " " || e.key === "Enter") {
      e.preventDefault();
      commitGeoInput();
    } else if (e.key === "Backspace" && this.value === "" && lciGeoIds.length > 0) {
      lciGeoIds.pop();
      renderChips();
    }
  });
  beGeoInput.addEventListener("input", function() {
    var v = this.value;
    if (v.indexOf(",") !== -1 || (v.length > 1 && v.indexOf(" ") !== -1)) {
      commitGeoInput();
    }
  });
  beGeoWrap.addEventListener("click", function() { beGeoInput.focus(); });

  // ── Show last-used CPI file hint if a handle is stored ───────────────────
  IDB.loadHandle("lci-last-file").then(function (handle) {
    if (!handle) return;
    var hintEl = document.getElementById("lci-last-file-hint");
    var nameEl = document.getElementById("lci-last-file-name");
    if (hintEl && nameEl) {
      nameEl.textContent = handle.name;
      hintEl.classList.remove("d-none");
    }
  }).catch(function() {});

  // ── Load button: try last-used handle first, then fall back to file picker ──
  document.getElementById("lci-load-btn").addEventListener("click", function () {
    commitGeoInput();
    var errEl = document.getElementById("lci-error");
    errEl.classList.add("d-none");
    if (lciGeoIds.length === 0) {
      errEl.textContent = "Please enter at least one BE GEO ID before loading.";
      errEl.classList.remove("d-none");
      return;
    }
    APP_MULTI_SESSIONS = null;
    renderMultiPicker();
    openCpiFile(false);
  });

  // ── "Use different file" link ─────────────────────────────────────────────
  document.getElementById("lci-pick-different").addEventListener("click", function (e) {
    e.preventDefault();
    commitGeoInput();
    var errEl = document.getElementById("lci-error");
    errEl.classList.add("d-none");
    if (lciGeoIds.length === 0) {
      errEl.textContent = "Please enter at least one BE GEO ID before loading.";
      errEl.classList.remove("d-none");
      return;
    }
    APP_MULTI_SESSIONS = null;
    renderMultiPicker();
    openCpiFile(true);
  });

  function openCpiFile(forcePicker) {
    var region    = document.getElementById("lci-region").value;
    var week      = document.getElementById("lci-week").value;
    var idsToLoad = lciGeoIds.slice();

    function openPicker() {
      if (typeof window.showOpenFilePicker === "function") {
        window.showOpenFilePicker({
          types: [{ description: "CPI CSV", accept: { "text/csv": [".csv"], "application/octet-stream": [".csv"] } }],
          multiple: false
        }).then(function (handles) {
          var handle = handles[0];
          PENDING_FILE_HANDLE = handle;
          IDB.saveHandle("lci-last-file", handle).then(function () {
            var nameEl = document.getElementById("lci-last-file-name");
            var hintEl = document.getElementById("lci-last-file-hint");
            if (nameEl) nameEl.textContent = handle.name;
            if (hintEl) hintEl.classList.remove("d-none");
          }).catch(function() {});
          return handle.getFile();
        }).then(function (file) {
          processCpiFile(file, region, week, idsToLoad);
        }).catch(function (err) {
          PENDING_FILE_HANDLE = null;
          if (err.name !== "AbortError") {
            console.warn("showOpenFilePicker failed, falling back:", err);
            document.getElementById("lci-file-input").value = "";
            document.getElementById("lci-file-input").click();
          }
        });
      } else {
        document.getElementById("lci-file-input").value = "";
        document.getElementById("lci-file-input").click();
      }
    }

    if (forcePicker) { openPicker(); return; }

    // Try the last-used handle first
    IDB.loadHandle("lci-last-file").then(function (handle) {
      if (!handle) { openPicker(); return; }
      handle.queryPermission({ mode: "read" }).then(function (perm) {
        if (perm === "granted") return perm;
        return handle.requestPermission({ mode: "read" });
      }).then(function (perm) {
        if (perm !== "granted") { openPicker(); return; }
        PENDING_FILE_HANDLE = handle;
        return handle.getFile().then(function (file) {
          processCpiFile(file, region, week, idsToLoad);
        });
      }).catch(function () { openPicker(); });
    }).catch(function () { openPicker(); });
  }

  // ── File selected (fallback input[type=file] path) ────────────────────────
  document.getElementById("lci-file-input").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    PENDING_FILE_HANDLE = null;
    processCpiFile(file, document.getElementById("lci-region").value, document.getElementById("lci-week").value, lciGeoIds.slice());
  });

  renderMultiPicker(); // show persistent session bar if APP_MULTI_SESSIONS is set

  // ── Update check (runs once per page load) ────────────────────────────────
  fetch("https://api.github.com/repos/marckhayat/AdoptDash/releases/latest")
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(release) {
      if (!release || !release.tag_name) return;
      var latest = release.tag_name;
      if (latest && latest !== APP_VERSION) {
        var container = document.getElementById("notif-toast-container");
        if (container && !document.getElementById("notif-update")) {
          var html =
            '<div id="notif-update" class="toast show mb-2" style="border-left:4px solid #e65c00;background:#fff3e0" role="alert" data-bs-autohide="false">' +
              '<div class="toast-header" style="background:#e65c00;color:#fff">' +
                '<i class="bi bi-arrow-up-circle-fill me-2"></i>' +
                '<strong class="me-auto">Update Available</strong>' +
                '<button type="button" class="btn-close btn-close-white ms-2" onclick="this.closest(\'.toast\').remove()" aria-label="Close"></button>' +
              '</div>' +
              '<div class="toast-body small">' +
                'Version <strong>' + latest + '</strong> is available. ' +
                '<a href="https://github.com/marckhayat/AdoptDash/releases/latest" target="_blank" rel="noopener">View release notes</a>' +
              '</div>' +
            '</div>';
          container.insertAdjacentHTML("afterbegin", html);
        }
      }
    })
    .catch(function() { /* network unavailable — silently ignore */ });
}

function renderMultiPicker() {
  var barEl = document.getElementById("multi-session-bar");
  if (barEl) { barEl.classList.add("d-none"); barEl.innerHTML = ""; }
}

// ── CPI file processing (shared between file-input fallback and showOpenFilePicker path) ──
function processCpiFile(file, region, week, idsToLoad) {
  var regionFile = region === "DISTI" ? "DISTI" : region;
  var expected = week
    ? "CPI_data_" + regionFile + "_" + week + ".csv"
    : "CPI_data_" + regionFile + ".csv";
  var errEl = document.getElementById("lci-error");
  if (errEl) errEl.classList.add("d-none");

  if (file.name !== expected) {
    if (errEl) {
      errEl.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Expected <strong>' + expected + '</strong> but got <strong>' + file.name + '</strong>. Please check your selections.';
      errEl.classList.remove("d-none");
    }
    PENDING_FILE_HANDLE = null;
    return;
  }

  showLoader("Reading CPI file…");
  readFileAsText(file).then(function (rawText) {
    // CPI files are Cisco-internal and properly formatted — skip the Workspan quote fix
    Papa.parse(rawText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: function (results) {
      try {
        if (!results.data || results.data.length === 0) throw new Error("No data found in CSV.");

        var rawKeys = Object.keys(results.data[0] || {});
        var rawDistiKey = rawKeys.find(function(k) { return k.trim().toLowerCase() === "disti name"; });
        var rawIsDisti = rawDistiKey && results.data.some(function(r) {
          return r[rawDistiKey] && String(r[rawDistiKey]).trim() !== "";
        });

        updateLoaderMsg("Filtering " + idsToLoad.length + " BE GEO ID(s)…");
        var sessions = idsToLoad.map(function(id) {
          var rows = results.data.filter(function(r) {
            return String(r["BE GEO ID"] || "").trim() === id;
          });
          var partnerName = "";
          if (rows.length > 0) {
            var nameKey = rawIsDisti ? rawDistiKey : "Partner Name";
            var nameFreq = {};
            rows.forEach(function(r) { var n = String(r[nameKey] || "").trim(); if (n) nameFreq[n] = (nameFreq[n] || 0) + 1; });
            var names = Object.keys(nameFreq);
            partnerName = names.length > 0 ? names.reduce(function(a, b) { return nameFreq[a] >= nameFreq[b] ? a : b; }) : "";
          }
          return { id: id, rows: rows, partnerName: partnerName };
        });

        var found = sessions.filter(function(s) { return s.rows.length > 0; });
        var notFound = sessions.filter(function(s) { return s.rows.length === 0; });

        if (found.length === 0) {
          PENDING_FILE_HANDLE = null;
          IDB.loadAllMeta().then(function(en) {
            restoreUploadSection(en);
            var errEl2 = document.getElementById("lci-error");
            if (errEl2) {
              errEl2.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>No data found for ' +
                (idsToLoad.length === 1 ? 'BE GEO ID <strong>' + idsToLoad[0] + '</strong>' : 'any of the entered IDs') +
                ' in <strong>' + file.name + '</strong>. Please check the IDs and try again.';
              errEl2.classList.remove("d-none");
            }
          });
          return;
        }

        // Single ID → load directly (finishLoad handles handle saving via PENDING_FILE_HANDLE)
        if (idsToLoad.length === 1) {
          updateLoaderMsg("Processing " + found[0].rows.length + " rows for " + found[0].id + "…");
          APP_DATA = transformData(found[0].rows);
          APP_FILE_META = { name: file.name, lastModified: file.lastModified ? new Date(file.lastModified) : null };
          finishLoad(file.name + " · BE GEO ID " + found[0].id, APP_DATA.length, false, "cpi-" + found[0].id);
          return;
        }

        // Multiple IDs → transform each on its own tick then save all to IDB
        if (notFound.length > 0) console.warn("No data for: " + notFound.map(function(s){return s.id;}).join(", "));
        var _multiHandle = PENDING_FILE_HANDLE;
        PENDING_FILE_HANDLE = null;

        // Process sessions sequentially with setTimeout to keep the UI responsive
        function processNext(idx, done) {
          if (idx >= found.length) { done(); return; }
          var sess = found[idx];
          updateLoaderMsg("Processing BE GEO ID " + sess.id + " (" + (idx + 1) + " of " + found.length + ")\u2026");
          setTimeout(function() {
            try {
              var transformed = transformData(sess.rows);
              var idbKey = "cpi-" + sess.id;
              sess._transformed = transformed;
              IDB.save(idbKey, transformed, {
                filename:         file.name + " \u00b7 BE GEO ID " + sess.id,
                rowCount:         transformed.length,
                loadedAt:         new Date().toISOString(),
                fileLastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
                displayName:      sess.partnerName || sess.id,
                beGeoIds:         [sess.id],
                isDisti:          rawIsDisti,
                hasFileHandle:    !!_multiHandle
              }).then(function() {
                if (_multiHandle) {
                  IDB.saveHandle(idbKey, _multiHandle).catch(function(e) { console.warn("Handle save failed for " + sess.id + ":", e); });
                }
              }).catch(function(e) { console.warn("IDB save failed for " + sess.id + ":", e); });
              processNext(idx + 1, done);
            } catch(err) {
              console.error("Transform failed for " + sess.id + ":", err);
              processNext(idx + 1, done);
            }
          }, 0);
        }

        APP_MULTI_SESSIONS = { sessions: found, fileMeta: { name: file.name, lastModified: file.lastModified ? new Date(file.lastModified) : null }, loadedAt: new Date().toISOString(), notFoundNote: notFound.length > 0 ? notFound.map(function(s){return s.id;}).join(", ") : "", hasHandle: !!_multiHandle };
        processNext(0, function() {
          IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
        });

      } catch (err) {
        PENDING_FILE_HANDLE = null;
        IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
        console.error(err);
        alert("Error processing CPI file: " + err.message);
      }
    },
    error: function (err) {
      PENDING_FILE_HANDLE = null;
      IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
      alert("Error reading CSV: " + err.message);
    }
  });
  }).catch(function (err) {
    PENDING_FILE_HANDLE = null;
    IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
    alert("Error reading CPI file: " + err.message);
  });
}

// ── Refresh a session from its stored FileSystemFileHandle ───────────────────
function refreshFromHandle(type, cacheOnly) {
  if (typeof window.showOpenFilePicker === "undefined" && typeof FileSystemFileHandle === "undefined") {
    alert("Your browser does not support the File System Access API. Please use Chrome or Edge to use this feature.");
    return Promise.reject(new Error("File System Access API not supported."));
  }
  return IDB.loadHandle(type).then(function (handle) {
    if (!handle) {
      // For partner sessions with no saved handle, use showOpenFilePicker to let the user re-select
      if (type.indexOf("ws-") === 0 && typeof window.showOpenFilePicker === "function") {
        return window.showOpenFilePicker({
          types: [{ description: "Workspan Report", accept: { "application/octet-stream": [".xlsx", ".xls", ".csv"], "text/csv": [".csv"] } }],
          multiple: false
        }).then(function (handles) {
          var newHandle = handles[0];
          PENDING_FILE_HANDLE = newHandle;
          return newHandle.getFile();
        }).then(function (file) {
          if (cacheOnly) {
            return refreshWsCacheOnly(file, type, PENDING_FILE_HANDLE);
          }
          processPartnerFile(file);
        }).catch(function (err) {
          PENDING_FILE_HANDLE = null;
          if (err.name !== "AbortError") throw err;
        });
      }
      alert("No file handle saved for this session. Re-upload the file to enable one-click refresh.");
      throw new Error("No file handle saved for this session.");
    }
    return handle.queryPermission({ mode: "read" }).then(function (perm) {
      if (perm === "granted") return perm;
      return handle.requestPermission({ mode: "read" });
    }).then(function (perm) {
      if (perm !== "granted") throw new Error("Permission to read the file was denied.");
      return handle.getFile();
    }).then(function (file) {
      if (type.indexOf("ws-") === 0) {
        PENDING_FILE_HANDLE = handle;
        if (cacheOnly) {
          return refreshWsCacheOnly(file, type, handle);
        }
        processPartnerFile(file);
      } else if (type.indexOf("cpi-") === 0) {
        var geoId = type.replace("cpi-", "");
        // Update in-memory fileMeta with the refreshed file's lastModified date
        if (APP_MULTI_SESSIONS && file.lastModified) {
          APP_MULTI_SESSIONS.fileMeta.lastModified = new Date(file.lastModified);
        }
        PENDING_FILE_HANDLE = handle;
        return refreshCpiFromHandle(file, geoId, cacheOnly);
      }
    });
  }).catch(function (err) {
    if (err && err.name === "AbortError") return;
    alert("Could not refresh from file: " + err.message);
    throw err;
  });
}

function refreshAllPreviousSessions() {
  var body = document.getElementById("cpi-prev-sessions-body");
  if (!body) return;
  var types = Array.prototype.map.call(body.querySelectorAll(".idb-refresh-btn[data-idbtype]"), function (btn) {
    return btn.dataset.idbtype;
  }).filter(Boolean);
  if (types.length === 0) {
    alert("No previous sessions with saved file handles were found.");
    return;
  }
  var total = types.length;
  var completed = 0;
  showLoader("Refreshing sessions\u2026 (0\u00a0/\u00a0" + total + ")");
  types.reduce(function (chain, type) {
    return chain.then(function () {
      return refreshFromHandle(type, true).catch(function (err) {
        console.warn("Refresh failed for " + type + ":", err);
      }).then(function () {
        // Clear dismissed notifications so fresh data shows all notifications
        try { localStorage.removeItem(_notifStorageKey(type)); } catch(e) {}
        completed++;
        updateLoaderMsg("Refreshing sessions\u2026 (" + completed + "\u00a0/\u00a0" + total + ")");
      });
    });
  }, Promise.resolve()).then(function () {
    if (APP_MULTI_SESSIONS) APP_MULTI_SESSIONS.loadedAt = new Date().toISOString();
    IDB.loadAllMeta().then(function (en) { restoreUploadSection(en); });
  });
}

// ── Cache-only refresh for ws- sessions (no navigation) ──────────────────────
function refreshWsCacheOnly(file, idbType, handle) {
  var ext = file.name.split(".").pop().toLowerCase();
  if (ext !== "csv") {
    // XLSX: fall back to normal load (will navigate to dashboard)
    PENDING_FILE_HANDLE = handle;
    processPartnerFile(file);
    return Promise.resolve();
  }
  return readFileAsText(file).then(function (rawText) {
    var text = fixUnescapedCsvQuotes(rawText);
    return new Promise(function (resolve, reject) {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: function (results) {
          try {
            var transformed = transformData(results.data);
            var isDisti = transformed.some(function (r) {
              return r["Disti name"] && String(r["Disti name"]).trim() !== "";
            });
            var partnerNames = [];
            transformed.forEach(function (r) { if (r["Partner Name"]) partnerNames.push(String(r["Partner Name"]).trim()); });
            var uniquePartners = Array.from(new Set(partnerNames)).filter(Boolean);
            var displayName = uniquePartners.slice(0, 2).join(", ") + (uniquePartners.length > 2 ? " +" + (uniquePartners.length - 2) + " more" : "");
            var beGeoIds = [];
            transformed.forEach(function (r) { var v = String(r["BE GEO ID"] || "").trim(); if (v && beGeoIds.indexOf(v) === -1) beGeoIds.push(v); });
            IDB.save(idbType, transformed, {
              filename: file.name,
              rowCount: transformed.length,
              loadedAt: new Date().toISOString(),
              displayName: displayName,
              beGeoIds: beGeoIds,
              isDisti: isDisti,
              hasFileHandle: true
            }).catch(function (e) { console.warn("IDB save failed:", e); });
            IDB.saveHandle(idbType, handle).catch(function (e) { console.warn("Handle save failed:", e); });
            PENDING_FILE_HANDLE = null;
            resolve();
          } catch (err) {
            PENDING_FILE_HANDLE = null;
            reject(err);
          }
        },
        error: function (err) { PENDING_FILE_HANDLE = null; reject(err); }
      });
    });
  });
}


function refreshCpiFromHandle(file, geoId, cacheOnly) {
  if (!cacheOnly) showLoader("Re-reading CPI file…");
  return readFileAsText(file).then(function (rawText) {
    return new Promise(function (resolve, reject) {
      Papa.parse(rawText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: function (results) {
          try {
            if (!results.data || results.data.length === 0) throw new Error("No data found in CSV.");
            var rows = results.data.filter(function(r) {
              return String(r["BE GEO ID"] || "").trim() === geoId;
            });
            if (rows.length === 0) throw new Error("No data found for BE GEO ID " + geoId + " in this file.");
            var rawKeys = Object.keys(results.data[0] || {});
            var rawDistiKey = rawKeys.find(function(k) { return k.trim().toLowerCase() === "disti name"; });
            var rawIsDisti = rawDistiKey && results.data.some(function(r) {
              return r[rawDistiKey] && String(r[rawDistiKey]).trim() !== "";
            });
            if (cacheOnly) {
              var transformed = transformData(rows);
              var _handle = PENDING_FILE_HANDLE;
              // Compute displayName so the card title survives a cache-only refresh
              var displayName = "";
              if (rawIsDisti) {
                var distiNames = [];
                transformed.forEach(function(r) { if (r["Disti name"]) distiNames.push(String(r["Disti name"]).trim()); });
                var uniqueDisti = Array.from(new Set(distiNames)).filter(Boolean);
                displayName = uniqueDisti.slice(0, 2).join(", ") + (uniqueDisti.length > 2 ? " +" + (uniqueDisti.length - 2) + " more" : "");
              } else {
                var partnerNames = [];
                transformed.forEach(function(r) { if (r["Partner Name"]) partnerNames.push(String(r["Partner Name"]).trim()); });
                var uniquePartners = Array.from(new Set(partnerNames)).filter(Boolean);
                displayName = uniquePartners.slice(0, 2).join(", ") + (uniquePartners.length > 2 ? " +" + (uniquePartners.length - 2) + " more" : "");
              }
              var beGeoIds = [];
              transformed.forEach(function(r) { var v = String(r["BE GEO ID"] || "").trim(); if (v && beGeoIds.indexOf(v) === -1) beGeoIds.push(v); });
              IDB.save("cpi-" + geoId, transformed, {
                filename: file.name + " · BE GEO ID " + geoId,
                rowCount: transformed.length,
                loadedAt: new Date().toISOString(),
                fileLastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
                isDisti: !!rawIsDisti,
                displayName: displayName,
                beGeoIds: beGeoIds,
                hasFileHandle: !!_handle
              }).then(function() {
                if (_handle) {
                  IDB.saveHandle("cpi-" + geoId, _handle).catch(function(e) { console.warn("Handle save failed:", e); });
                }
                PENDING_FILE_HANDLE = null;
                resolve();
              }).catch(function(e) {
                console.warn("IDB save failed:", e);
                PENDING_FILE_HANDLE = null;
                resolve();
              });
            } else {
              window.APP_IS_DISTI = !!rawIsDisti;
              APP_DATA = transformData(rows);
              APP_FILE_META = { name: file.name, lastModified: file.lastModified ? new Date(file.lastModified) : null };
              finishLoad(file.name + " · BE GEO ID " + geoId, APP_DATA.length, false, "cpi-" + geoId);
              resolve();
            }
          } catch (err) {
            PENDING_FILE_HANDLE = null;
            IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
            alert("Error refreshing CPI data: " + err.message);
            reject(err);
          }
        },
        error: function (err) {
          PENDING_FILE_HANDLE = null;
          IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
          alert("Error reading file: " + err.message);
          reject(err);
        }
      });
    });
  }).catch(function (err) {
    PENDING_FILE_HANDLE = null;
    IDB.loadAllMeta().then(function(en) { restoreUploadSection(en); });
    alert("Error reading file: " + err.message);
    throw err;
  });
}

// Returns APP_DATA filtered to exclude records flagged as excluded by the user
function getActiveData() {
  if (!APP_DATA) return APP_DATA;
  if (!window.APP_EXCL_ACTIVE) return APP_DATA;
  var excludedIds = ANNOTATIONS.getExcludedWsIds();
  if (excludedIds.length === 0) return APP_DATA;
  var idSet = {};
  excludedIds.forEach(function (id) { idSet[id] = true; });
  return APP_DATA.filter(function (r) { return !idSet[String(r["Deal WS-ID"] || "")]; });
}

function renderActiveTab(target) {
  switch (target) {
    case "#tab-overview":  renderOverview(getActiveData());  break;
    case "#tab-details":   renderDetails(APP_DATA);          break;  // details always shows all rows (dimmed)
    case "#tab-pvi":       renderPVI(getActiveData());       break;
    case "#tab-testing":   renderInsights(getActiveData());  break;
  }
}

// ── Data load notifications ──────────────────────────────────────────────────
function showDataNotifications(data) {
  var container = document.getElementById("notif-toast-container");
  if (!container || !data) return;
  // Preserve the update-available toast (inserted by the version check) when refreshing data notifications
  var updateToast = document.getElementById("notif-update");
  container.innerHTML = "";
  if (updateToast) container.appendChild(updateToast);
  var dismissed = window._dismissedNotifs || {};

  var now    = new Date();
  var today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var past14 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
  var next14 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14, 23, 59, 59, 999);

  // Local-midnight epoch days (matches how date strings like "6/15/2025" are parsed by new Date())
  var _localTodayEpochDay = Math.floor(today0.getTime() / 86400000);
  var _localFrom14        = Math.floor(past14.getTime() / 86400000);
  var _localTo14          = Math.floor(next14.getTime() / 86400000);

  function pd(x) {
    if (!x) return null;
    if (x instanceof Date) return isNaN(x.getTime()) ? null : x;
    if (typeof x === "number" && x > 1000) {
      var d = new Date(Math.round((x - 25569) * 86400000));
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof x === "string" && x.trim()) {
      var d2 = new Date(x);
      return isNaN(d2.getTime()) ? null : d2;
    }
    return null;
  }

  // 1. New eligible deals booked in past 14 days with Maximum Incentive Deal Flag = Yes
  var newEligible = 0;
  var newEligibleKeys = new Set();
  data.forEach(function(r) {
    var bd = pd(r["Booking Date"]);
    if (bd && bd >= past14 && bd <= now &&
        String(r["Stage"] || "").toUpperCase() === "ELIGIBLE" &&
        String(r["Adopt Rebate Opt-In Status"] || "").toUpperCase() === "PENDING") {
      newEligible++;
      if (r["CRPartyID-Offer"]) newEligibleKeys.add(r["CRPartyID-Offer"]);
    }
  });

  // 1b. Opt-ins in past 14 days (stage must be Eligible)
  var newOptIns = 0;
  var newOptInPotential = 0;
  data.forEach(function(r) {
    var od = pd(r["Adopt Rebate Start Date"]);
    if (od && od >= past14 && od <= now &&
        String(r["Adopt Rebate Opt-In Status"] || "").toUpperCase() === "OPTED IN" &&
        String(r["Stage"] || "").toUpperCase() === "ELIGIBLE") {
      newOptIns++;
      newOptInPotential += parseFloat(r["Potential Incentives"]) || 0;
    }
  });

  // 2. Incentives earned in past 14 days: sum stage amounts where that stage was completed in window
  var STAGE_MAP = [
    { dateCol: "Stage Completion Date(onboard)", amtCol: "Estimated Incentive Amount(Onboard)" },
    { dateCol: "Stage Completion Date(Use)",     amtCol: "Estimated Incentive Amount(Use)"     },
    { dateCol: "Stage Completion Date(Engage)",  amtCol: "Estimated Incentive Amount(Engage)"  },
    { dateCol: "Stage Completion Date(Adopt)",   amtCol: "Estimated Incentive Amount(Adopt)"   }
  ];
  var earnedLast14 = 0;
  data.forEach(function(r) {
    if (String(r["Adopt Rebate Opt-In Status"] || "").toUpperCase() !== "OPTED IN") return;
    var stg = String(r["Stage"] || "").toUpperCase();
    if (stg !== "ELIGIBLE") return;
    STAGE_MAP.forEach(function(s) {
      var d = pd(r[s.dateCol]);
      if (d && d >= past14 && d <= now) {
        earnedLast14 += parseFloat(r[s.amtCol]) || 0;
      }
    });
  });

  // 3. Opted-in eligible deals expiring in the next 14 days
  var expiringSoon = 0;
  data.forEach(function(r) {
    var ed = pd(r["Deal Incentive Expiry Date"]);
    if (ed && ed >= today0 && ed <= next14 &&
        String(r["Stage"] || "").toUpperCase() === "ELIGIBLE" &&
        String(r["Adopt Rebate Opt-In Status"] || "").toUpperCase() === "OPTED IN") expiringSoon++;
  });

  function fmtMoney(v) {
    if (v >= 1000000) return "$" + (v / 1000000).toFixed(1) + "M";
    if (v >= 1000)    return "$" + (v / 1000).toFixed(1) + "K";
    return "$" + Math.round(v).toLocaleString();
  }

  var notifs = [
    {
      id: "notif-new",
      cls: "notif-new",
      icon: "bi-star-fill text-primary",
      title: "New Eligible Opportunities",
      preset: (function() {
        return { stage: ["ELIGIBLE"], optIn: ["PENDING"], bkFrom: _localFrom14, bkTo: _localTodayEpochDay };
      })(),
      body: newEligible > 0
        ? "<strong>" + newEligible.toLocaleString() + "</strong> new eligible opportunit" + (newEligible !== 1 ? "ies" : "y") + " booked in the past 14 days (" + newEligibleKeys.size.toLocaleString() + " unique)"
        : null
    },
    {
      id: "notif-optins",
      cls: "notif-new",
      icon: "bi-hand-thumbs-up-fill text-primary",
      title: "New Opt-ins",
      preset: (function() {
        return { stage: ["ELIGIBLE"], optIn: ["OPTED IN"], rsFrom: _localFrom14, rsTo: _localTodayEpochDay };
      })(),
      body: newOptIns > 0
        ? "<strong>" + newOptIns.toLocaleString() + "</strong> new opt-in" + (newOptIns !== 1 ? "s" : "") + " in the past 14 days"
        : null
    },
    {
      id: "notif-potential",
      cls: "notif-earned",
      icon: "bi-piggy-bank-fill text-success",
      title: "New Potential",
      preset: (function() {
        return { stage: ["ELIGIBLE"], optIn: ["OPTED IN"], rsFrom: _localFrom14, rsTo: _localTodayEpochDay };
      })(),
      body: newOptInPotential > 0
        ? "<strong>" + fmtMoney(newOptInPotential) + "</strong> in potential incentives from new opt-ins"
        : null
    },
    {
      id: "notif-earned",
      cls: "notif-earned",
      icon: "bi-cash-coin text-success",
      title: "Incentives Earned",
      alwaysLink: true,
      preset: (function() {
        return { checkboxIds: ["filter-earned"], eaFrom: _localFrom14, eaTo: _localTodayEpochDay };
      })(),
      body: earnedLast14 > 0
        ? "<strong>" + fmtMoney(earnedLast14) + "</strong> in incentives earned over the past 14 days"
        : null
    },
    {
      id: "notif-expiry",
      cls: "notif-expiry",
      icon: "bi-clock-history text-warning",
      title: "Expiring Soon",
      emptyMsg: "Nothing expiring in the coming 14 days.",
      preset: (function() {
        return { optIn: ["OPTED IN"], stage: ["Eligible"], expFrom: _localTodayEpochDay, expTo: _localTo14 };
      })(),
      body: expiringSoon > 0
        ? "<strong>" + expiringSoon.toLocaleString() + "</strong> opted-in deal" + (expiringSoon !== 1 ? "s" : "") + " expir" + (expiringSoon !== 1 ? "e" : "es") + " within 14 days"
        : null
    }
  ];

  notifs.forEach(function(n) {
    if (dismissed[n.id]) return; // user already closed this one
    var hasData = !!n.body;
    var isClickable = hasData || !!n.alwaysLink;
    var extraCls = hasData ? n.cls : "notif-zero";
    var bodyContent = hasData ? n.body : '<span class="text-muted">' + (n.emptyMsg || "Nothing to report in the past 14 days.") + '</span>';
    var bodyHtml = isClickable
      ? '<a href="javascript:void(0)" class="notif-link d-block text-reset text-decoration-none" data-notif-id="' + n.id + '">' + bodyContent + ' <i class="bi bi-arrow-right-circle ms-1" style="font-size:0.8rem;opacity:0.6"></i></a>'
      : bodyContent;
    var html =
      '<div id="' + n.id + '" class="toast show mb-2 ' + extraCls + '" role="alert" data-bs-autohide="false">' +
        '<div class="toast-header">' +
          '<i class="bi ' + n.icon + ' me-2"></i>' +
          '<strong class="me-auto">' + n.title + '</strong>' +
          '<button type="button" class="btn-close ms-2" onclick="window._dismissNotif(\'' + n.id + '\');this.closest(\'.toast\').remove()" aria-label="Close"></button>' +
        '</div>' +
        '<div class="toast-body small">' + bodyHtml + '</div>' +
      '</div>';
    container.insertAdjacentHTML("beforeend", html);
    if (isClickable) {
      var el = container.querySelector('#' + n.id + ' .notif-link');
      if (el) {
        (function(preset) {
          el.addEventListener("click", function() { window.navigateToDetails(preset); });
        })(n.preset);
      }
    }
  });
}

function resetApp() {
  APP_FILE_META = null;
  // Do NOT clear APP_MULTI_SESSIONS here — user may be switching between sessions
  var sb = document.getElementById("status-bar");
  sb.classList.remove("d-flex");
  sb.classList.add("d-none");
  document.getElementById("main-tab-bar").classList.add("d-none");
  var cpiNav = document.getElementById("cpi-scroll-nav");
  if (cpiNav) cpiNav.remove();

  // Clear notifications
  var notifC = document.getElementById("notif-toast-container");
  if (notifC) notifC.innerHTML = "";

  // Reset disti mode — restore PVI tab
  APP_IS_DISTI = false;
  window.APP_IS_DISTI = false;
  var pviTab = document.getElementById("tab-pvi-btn");
  if (pviTab) pviTab.closest("li").classList.remove("d-none");

  // Clear all tab panes and hide tab content until data is loaded
  APP_DATA = null;
  window.APP_DATA = null;
  APP_FILTER_STATE = { details: null, lifecycle: null, cpiAdopt: null, testing: null };
  document.getElementById("mainTabContent").classList.add("d-none");
  ["tab-overview","tab-details","tab-pvi","tab-testing"].forEach(function (id) {
    var pane = document.getElementById(id);
    if (pane) pane.innerHTML = "";
  });

  // Reload cache entries so resume cards show after reset
  IDB.loadAllMeta().then(function (entries) {
    restoreUploadSection(entries);
  }).catch(function () {
    restoreUploadSection([]);
  });

  // Activate overview tab
  var overviewBtn = document.getElementById("tab-overview-btn");
  if (overviewBtn) {
    var bsTab = new bootstrap.Tab(overviewBtn);
    bsTab.show();
  }
}

window.APP_DATA        = APP_DATA;
window.APP_FILTER_STATE = APP_FILTER_STATE;
window.APP_EXCL_ACTIVE  = APP_EXCL_ACTIVE;
window.resetApp        = resetApp;
window.renderActiveTab = renderActiveTab;
window.renderOverview  = renderOverview;
window.getActiveData   = getActiveData;

window._dismissedNotifs = {};
window._currentSessionKey = null;
window._notifStorageKey = _notifStorageKey;
window.showDataNotifications = showDataNotifications;

function _notifStorageKey(sessionKey) {
  return "dismissed-notifs-" + (sessionKey || "default");
}
window._dismissNotif = function(id) {
  window._dismissedNotifs[id] = true;
  try {
    localStorage.setItem(_notifStorageKey(window._currentSessionKey), JSON.stringify(window._dismissedNotifs));
  } catch(e) {}
};

// Navigate to Details tab with a preset filter
window.navigateToDetails = function (preset) {
  window.APP_FILTER_STATE = window.APP_FILTER_STATE || {};
  window.APP_FILTER_STATE.details = null; // clear saved state so preset takes over
  if (window.APP_EXCL_ACTIVE) preset = Object.assign({}, preset, { hideExcluded: true });
  window._detDeepLink = preset;
  var btn = document.querySelector('[data-bs-target="#tab-details"]');
  if (!btn) return;
  var detPane = document.getElementById("tab-details");
  if (detPane && detPane.classList.contains("active")) {
    renderDetails(APP_DATA);
  } else {
    new bootstrap.Tab(btn).show();
  }
};
