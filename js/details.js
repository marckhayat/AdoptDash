// =============================================================================
// details.js — Details tab renderer
// =============================================================================

function renderDetails(data) {
  var el = document.getElementById("tab-details");
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
    if (v === null || v === undefined || isNaN(v) || v === 0) return "-";
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

  function epochDay(d) { return Math.floor(d.getTime() / 86400000); }

  // ── Active filters state
  var filters = {
    stage: [],
    optIn: [],
    portfolio: "",
    offer: "",
    country: [],
    expires: [],
    ea: [],
    risk: [],
    newEligible: false,
    expiresSoon: false,
    bkFrom: "", bkTo: "",
    rsFrom: "", rsTo: "",
    expFrom: "", expTo: ""
  };

  var PAGE_SIZE = 50;
  var currentPage = 1;
  var filteredData = [];
  var sortField = "CR Party Name";
  var sortDir   = "asc";
  var currentStageOrder = ["Purchase","Onboard","Implement","Use","Engage","Adopt","Completed"];
  var showCompletionDates = false;
  var showDealDetails = false;
  var showStageIncentives = false;
  var showDaysSinceOptIn = false;
  var showOverallProgress = false;
  var ucMissedPreset = false;

  // ── Annotations (tags + comments + exclusions) keyed by Deal WS-ID ──────
  var annotationsCache = ANNOTATIONS.getAll();
  var activeTagFilters = [];  // tags used to filter rows
  var tagFilterMode    = "ALL"; // "ALL" = AND, "ANY" = OR

  // Returns only tag names that appear on WS-IDs present in the current data
  function currentTagNames() {
    var wsIds = new Set(data.map(function(r) { return String(r["Deal WS-ID"] || ""); }).filter(Boolean));
    var tags  = new Set();
    Object.keys(annotationsCache).forEach(function(id) {
      if (wsIds.has(id)) {
        (annotationsCache[id].tags || []).forEach(function(t) { tags.add(t); });
      }
    });
    return Array.from(tags).sort();
  }

  // ── Annotation modal ──────────────────────────────────────────────────────
  function openAnnotationModal(wsId, crPartyName, crPartyId) {
    var existing        = annotationsCache[wsId] || { tags: [], comment: "", excluded: false };
    var currentExcluded = ANNOTATIONS.isExcluded(wsId);
    var allTags         = currentTagNames();

    // Find all WS-IDs for this customer
    var customerWsIds = crPartyId
      ? data.filter(function(r){ return String(r["CR Party ID"] || "") === crPartyId; })
            .map(function(r){ return String(r["Deal WS-ID"] || ""); })
            .filter(Boolean)
      : [];

    // Are ALL UCs for this customer currently excluded?
    var allCustomerExcluded = customerWsIds.length > 1 && customerWsIds.every(function(id) {
      return ANNOTATIONS.isExcluded(id);
    });

    var tagChecks = allTags.map(function (t) {
      var chk = (existing.tags || []).indexOf(t) !== -1 ? " checked" : "";
      var tc  = ANNOTATIONS.tagColor(t);
      var bs  = tc ? ' style="background:' + tc.bg + ';color:' + tc.color + ';border:1px solid ' + tc.border + '"' : '';
      return '<div class="form-check form-check-inline">' +
        '<input class="form-check-input annot-tag-check" type="checkbox" id="atag-' + escHtml(t) + '" value="' + escHtml(t) + '"' + chk + '>' +
        '<label class="form-check-label annot-tag"' + bs + ' for="atag-' + escHtml(t) + '">' + escHtml(t) + '</label></div>';
    }).join("");

    // Exclude section (always shown)
    var excludeSection =
      '<div class="border rounded p-2 mb-3" style="background:#fafafa">' +
      '<div class="form-check mb-0">' +
      '<input class="form-check-input" type="checkbox" id="annot-excl-this"' + (currentExcluded ? " checked" : "") + '>' +
      '<label class="form-check-label fw-semibold" for="annot-excl-this" style="font-size:0.85rem">' +
      '<i class="bi bi-slash-circle me-1 text-danger"></i>Exclude this deal</label>' +
      '</div>' +
      (customerWsIds.length > 1
        ? '<div class="form-check mt-1 mb-0">' +
          '<input class="form-check-input" type="checkbox" id="annot-excl-all"' + (allCustomerExcluded ? " checked" : "") + '>' +
          '<label class="form-check-label text-muted" for="annot-excl-all" style="font-size:0.8rem">' +
          '<i class="bi bi-slash-circle me-1"></i>Exclude all ' + customerWsIds.length + ' UCs for ' + escHtml(crPartyName || "") + '</label>' +
          '</div>'
        : '') +
      '<p class="text-muted mb-0 mt-2" style="font-size:0.75rem"><i class="bi bi-info-circle me-1"></i>This only affects the view within this dashboard. It does not update Workspan and has no impact on the CPI program whatsoever.</p>' +
      '</div>';

    var modalHtml =
      '<div class="modal fade" id="annotModal" tabindex="-1">' +
      '<div class="modal-dialog modal-dialog-centered">' +
      '<div class="modal-content">' +
      '<div class="modal-header py-2">' +
      '<h6 class="modal-title"><i class="bi bi-chat-left-text me-2"></i>Notes &amp; Tags — ' + escHtml(wsId) + '</h6>' +
      '<button type="button" class="btn-close btn-sm" data-bs-dismiss="modal"></button>' +
      '</div>' +
      '<div class="modal-body">' +
      excludeSection +
      '<div style="font-size:0.8rem;color:#888;margin-bottom:6px">' + escHtml(crPartyName || "") + '</div>' +
      '<label class="form-label fw-semibold" style="font-size:0.82rem">Tags</label>' +
      '<div id="annot-tag-list" class="mb-2">' + tagChecks + '</div>' +
      '<div class="d-flex gap-2 mb-2">' +
      '<input type="text" id="annot-new-tag" class="form-control form-control-sm" placeholder="+ new tag" style="max-width:160px">' +
      '<button class="btn btn-sm btn-outline-secondary" id="annot-add-tag-btn">Add</button>' +
      '</div>' +
      (customerWsIds.length > 1
        ? '<div class="form-check mb-3" style="font-size:0.8rem">' +
          '<input class="form-check-input" type="checkbox" id="annot-tags-all-ucs">' +
          '<label class="form-check-label text-muted" for="annot-tags-all-ucs">' +
          '<i class="bi bi-tags me-1"></i>Apply these tags to all ' + customerWsIds.length + ' UCs for ' + escHtml(crPartyName || "") +
          '</label></div>'
        : '') +
      '<label class="form-label fw-semibold" style="font-size:0.82rem">Comment</label>' +
      '<textarea id="annot-comment" class="form-control form-control-sm" rows="4" style="resize:vertical">' + escHtml(existing.comment || "") + '</textarea>' +
      '</div>' +
      '<div class="modal-footer py-2">' +
      '<button class="btn btn-sm btn-danger me-auto" id="annot-clear-btn">Clear all</button>' +
      '<button class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Cancel</button>' +
      '<button class="btn btn-sm btn-primary" id="annot-save-btn">Save</button>' +
      '</div>' +
      '</div></div></div>';

    var existing_modal = document.getElementById("annotModal");
    if (existing_modal) existing_modal.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    var modalEl    = document.getElementById("annotModal");
    var bsModal    = new bootstrap.Modal(modalEl);
    var exclAllEl  = document.getElementById("annot-excl-all");
    var exclThisEl = document.getElementById("annot-excl-this");

    // "Exclude all" syncs "Exclude this" checkbox
    if (exclAllEl && exclThisEl) {
      exclAllEl.addEventListener("change", function () {
        exclThisEl.checked = exclAllEl.checked;
      });
    }

    // Add new tag dynamically
    document.getElementById("annot-add-tag-btn").addEventListener("click", function () {
      var val = document.getElementById("annot-new-tag").value.trim().toLowerCase().replace(/\s+/g, "-");
      if (!val) return;
      var tagList = document.getElementById("annot-tag-list");
      if (tagList.querySelector('input[value="' + val + '"]')) return;
      var tc2 = ANNOTATIONS.tagColor(val);
      var bs2 = tc2 ? ' style="background:' + tc2.bg + ';color:' + tc2.color + ';border:1px solid ' + tc2.border + '"' : '';
      var newCheck = document.createElement("div");
      newCheck.className = "form-check form-check-inline";
      newCheck.innerHTML = '<input class="form-check-input annot-tag-check" type="checkbox" id="atag-' + escHtml(val) + '" value="' + escHtml(val) + '" checked>' +
        '<label class="form-check-label annot-tag"' + bs2 + ' for="atag-' + escHtml(val) + '">' + escHtml(val) + '</label>';
      tagList.appendChild(newCheck);
      document.getElementById("annot-new-tag").value = "";
    });

    // Clear all (tags, comment AND exclusion for this WS-ID)
    document.getElementById("annot-clear-btn").addEventListener("click", function () {
      ANNOTATIONS.remove(wsId).then(function () {
        bsModal.hide();
        applyFiltersAndRender();
        rebuildTagFilterUI();
      });
    });

    // Save
    document.getElementById("annot-save-btn").addEventListener("click", function () {
      var tags    = [];
      modalEl.querySelectorAll(".annot-tag-check:checked").forEach(function (cb) { tags.push(cb.value); });
      var comment        = document.getElementById("annot-comment").value.trim();
      var exclThis       = exclThisEl.checked;
      var exclAll        = exclAllEl ? exclAllEl.checked : false;
      var tagsAllUcsEl   = document.getElementById("annot-tags-all-ucs");
      var applyTagsToAll = tagsAllUcsEl ? tagsAllUcsEl.checked : false;

      var saves = [ANNOTATIONS.saveFull(wsId, tags, comment, exclThis)];

      if (customerWsIds.length > 1) {
        var siblingIds = customerWsIds.filter(function(id) { return id !== wsId; });

        if (applyTagsToAll) {
          // Apply tags (and optionally exclusion) to all siblings, preserving each sibling's comment
          siblingIds.forEach(function(id) {
            var sib     = annotationsCache[id] || { tags: [], comment: "", excluded: false };
            var sibExcl = (exclAll || allCustomerExcluded) ? exclAll : sib.excluded;
            saves.push(ANNOTATIONS.saveFull(id, tags, sib.comment || "", sibExcl));
          });
        } else if (exclAll || allCustomerExcluded) {
          // Only update exclusion for siblings, leave their tags untouched
          saves.push(ANNOTATIONS.setExcludedForCustomer(siblingIds, exclAll));
        }
      }

      Promise.all(saves).then(function () {
        if (document.activeElement) document.activeElement.blur();
        bsModal.hide();
        applyFiltersAndRender();
        rebuildTagFilterUI();
      }).catch(function (err) {
        console.error("[AdoptDash] Annotation save failed:", err);
        alert("Could not save annotation. Please refresh the page and try again.\n\n" + (err && err.message ? err.message : err));
      });
    });

    modalEl.addEventListener("hidden.bs.modal", function () { modalEl.remove(); });
    bsModal.show();
  }

  function rebuildTagFilterUI() {
    var container = document.getElementById("annot-tag-filter-list");
    if (!container) return;
    var allTags = currentTagNames();
    container.innerHTML = allTags.map(function (t) {
      var safeid = "filter-annottag-" + t.replace(/[^a-z0-9]/gi, "-");
      var chk = activeTagFilters.indexOf(t) !== -1 ? " checked" : "";
      var tc = ANNOTATIONS.tagColor(t);
      var badgeStyle = tc ? ' style="background:' + tc.bg + ';color:' + tc.color + ';border:1px solid ' + tc.border + '"' : '';
      return '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="' + safeid + '" value="' + escHtml(t) + '"' + chk + '>' +
        '<label class="form-check-label annot-tag annot-tag-' + escHtml(t.replace(/[^a-z0-9]/gi, "-")) + '"' + badgeStyle + ' for="' + safeid + '">' + escHtml(t) + '</label></div>';
    }).join("");
    container.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        activeTagFilters = [];
        container.querySelectorAll("input:checked").forEach(function (c) { activeTagFilters.push(c.value); });
        applyFiltersAndRender();
      });
    });

    // Wire the ALL / ANY toggle
    var toggle = document.getElementById("tag-mode-toggle");
    if (toggle) {
      toggle.querySelectorAll(".tag-mode-btn").forEach(function (btn) {
        if (btn.dataset.mode === tagFilterMode) btn.classList.add("active");
        else btn.classList.remove("active");
        btn.addEventListener("click", function () {
          tagFilterMode = btn.dataset.mode;
          toggle.querySelectorAll(".tag-mode-btn").forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
          applyFiltersAndRender();
        });
      });
    }
  }

  // Restore sort state from saved session (filter DOM restored later, after DOM is built)
  var _detSaved = window.APP_FILTER_STATE && window.APP_FILTER_STATE.details;
  var _hadDeepLink = !!window._detDeepLink;
  if (_detSaved) {
    if (_detSaved.sortField) sortField = _detSaved.sortField;
    if (_detSaved.sortDir)   sortDir   = _detSaved.sortDir;
    if (_detSaved.showCompletionDates) showCompletionDates = true;
    if (_detSaved.showDealDetails)     showDealDetails     = true;
    if (_detSaved.showStageIncentives) showStageIncentives = true;
    if (_detSaved.showDaysSinceOptIn)  showDaysSinceOptIn  = true;
    if (_detSaved.showOverallProgress) showOverallProgress = true;
  }

  // ── Summary dedup measures
  function calcSummary(rows) {
    var customers = new Set();
    var offersMap = new Set();
    var ucMap     = new Set();
    var partners  = new Set();
    rows.forEach(function (r) {
      customers.add(r["CR Party ID"]);
      offersMap.add(r["CRPartyID-Offer"]);
      ucMap.add(String(r["CR Party ID"] || "") + "|" + String(r["Track"] || "") + "|" + String(r["Sub-Track"] || ""));
      if (r["2T Partner Name"] && String(r["2T Partner Name"]).trim() !== "") partners.add(String(r["2T Partner Name"]).trim());
    });

    function dedupeMax(field) {
      var map = {};
      rows.forEach(function (r) {
        var k = r["CRPartyID-Offer"] || "";
        var v = r[field] || 0;
        if (map[k] === undefined || v > map[k]) map[k] = v;
      });
      var total = 0;
      Object.keys(map).forEach(function (k) { total += map[k]; });
      return total;
    }

    return {
      partners:  partners.size,
      customers: customers.size,
      useCases:  ucMap.size,
      missed:    dedupeMax("Missed Incentives"),
      potential: dedupeMax("Potential Incentives"),
      earned:    dedupeMax("Estimated Earned Incentives")
    };
  }

  // ── Unique filter values
  function uniqueVals(field) {
    var s = new Set();
    data.forEach(function (r) { if (r[field] !== null && r[field] !== undefined && r[field] !== "") s.add(String(r[field])); });
    return Array.from(s).sort();
  }

  var portfolioOrder = ["Networking", "Security", "Cloud", "Cloud + AI Infrastructure", "Collaboration"];
  var stages     = uniqueVals("Stage");
  var optIns     = uniqueVals("Adopt Rebate Opt-In Status");
  var portfolios = uniqueVals("Deal CPI Portfolio").sort(function (a, b) {
    var ai = portfolioOrder.indexOf(a), bi = portfolioOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  var offerList   = uniqueVals("Track");
  var ucList      = uniqueVals("Sub-Track");
  var countryList = uniqueVals("End Customer Country");
  var eaOpts      = uniqueVals("EA Flag");

  // Precompute date bounds for sliders
  function getDateBounds(field) {
    var mn = null, mx = null;
    data.forEach(function(r) { var d = toDate(r[field]); if (d) { if (!mn||d<mn) mn=d; if (!mx||d>mx) mx=d; } });
    return { min: mn, max: mx };
  }
  var dateBounds = {
    bk:  getDateBounds("Booking Date"),
    rs:  getDateBounds("Adopt Rebate Start Date"),
    exp: getDateBounds("Deal Incentive Expiry Date"),
    ea:  (function() {
      var EARN_COLS = ["Stage Completion Date(onboard)", "Stage Completion Date(Use)", "Stage Completion Date(Engage)", "Stage Completion Date(Adopt)"];
      var mn = null, mx = null;
      data.forEach(function(r) {
        var optInDate = toDate(r["Adopt Rebate Start Date"]);
        EARN_COLS.forEach(function(c) {
          var d = toDate(r[c]);
          if (d && (!optInDate || d >= optInDate)) {
            if (!mn || d < mn) mn = d;
            if (!mx || d > mx) mx = d;
          }
        });
      });
      return { min: mn, max: mx };
    })()
  };

  // ── Build initial HTML
  var html = '<div class="d-flex gap-3" id="det-layout">';

  function tip(text) {
    return ' <i class="bi bi-info-circle text-muted" style="font-size:0.72rem;cursor:default" data-bs-toggle="tooltip" data-bs-placement="right" title="' + text.replace(/"/g, "&quot;") + '"></i>';
  }

  // Sidebar filters
  html += '<div class="filter-sidebar flex-shrink-0" id="det-filter-sidebar">';
  html += '<div class="d-flex align-items-center justify-content-between mb-2">';
  html += '<div class="fw-bold" style="font-size:0.8rem;color:var(--cisco-dark)"><i class="bi bi-funnel me-1"></i><span id="det-filter-label">Filters</span></div>';
  html += '<button class="btn btn-sm btn-outline-secondary py-0 px-2 ms-auto" id="det-clear-btn" style="font-size:0.75rem"><i class="bi bi-x-circle me-1"></i>Clear</button>';
  html += '<span id="det-filter-toggle" class="text-muted ms-2" title="Collapse filters"><i class="bi bi-chevron-left"></i></span>';
  html += '</div>';
  html += '<div id="det-filter-body">';
  var has2TPartner = data.some(function (r) { return r["2T Partner Name"] && String(r["2T Partner Name"]).trim() !== ""; });
  if (has2TPartner) {
    html += '<div class="filter-group"><div class="position-relative"><input type="text" id="filter-2tpartner" class="form-control form-control-sm pe-4" placeholder="&#128269; 2T Partner..." /><button id="det-2tpartner-clear" type="button" class="btn btn-link p-0 position-absolute top-50 end-0 translate-middle-y me-2 d-none" style="font-size:0.8rem;color:#999;line-height:1" tabindex="-1"><i class="bi bi-x-lg"></i></button></div></div>';
  }
  html += '<div class="filter-group"><div class="position-relative"><input type="text" id="filter-crparty" class="form-control form-control-sm pe-4" placeholder="&#128269; Customer or WS-Deal ID..." /><button id="det-crparty-clear" type="button" class="btn btn-link p-0 position-absolute top-50 end-0 translate-middle-y me-2 d-none" style="font-size:0.8rem;color:#999;line-height:1" tabindex="-1"><i class="bi bi-x-lg"></i></button></div></div>';

  // Quick-toggle filters
  html += '<div class="filter-group">';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-hide-excluded"><label class="form-check-label" for="filter-hide-excluded"><i class="bi bi-slash-circle me-1 text-danger" style="font-size:0.75rem"></i>Hide excluded</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-new-eligible"><label class="form-check-label" for="filter-new-eligible">New Eligible' + tip("UCs eligible for opt-in, booked within the past 30 days.") + '</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-expires-soon"><label class="form-check-label" for="filter-expires-soon">Expires Soon (&lt;1M)' + tip("Deals where the incentive expires in less than 1 month.") + '</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-earned"><label class="form-check-label" for="filter-earned">Earned' + tip("Deals where incentives have been earned.") + '</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-ea"><label class="form-check-label" for="filter-ea">EA' + tip("EA deals.") + '</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-aap"><label class="form-check-label" for="filter-aap">AAP' + tip("Completed the Adoption Accountability Plan.") + '</label></div>';
  html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" id="filter-max-incentive"><label class="form-check-label" for="filter-max-incentive">Max Incentive' + tip("One UC per offer per customer: the opted-in UC if available, otherwise the highest remaining potential incentive.") + '</label></div>';
  html += '<div class="d-flex gap-2 align-items-center mt-1 mb-0" style="font-size:0.78rem"><span class="text-muted">Offer opted-in:' + tip("Any UC opted-in within this offer.") + '</span>';
  html += '<div class="form-check form-check-sm mb-0"><input class="form-check-input" type="checkbox" id="filter-offer-optedin-y" value="Y"><label class="form-check-label" for="filter-offer-optedin-y">Y</label></div>';
  html += '<div class="form-check form-check-sm mb-0"><input class="form-check-input" type="checkbox" id="filter-offer-optedin-n" value="N"><label class="form-check-label" for="filter-offer-optedin-n">N</label></div>';
  html += '</div>';
  html += '</div>';
  if (!has2TPartner) {
    html += makeCheckboxGroup("PVI" + tip("UCs included in the PVI Engagement score calculations."), "filter-pvi", ["Eligible", "Onboard", "Adopt"]);
  }

  html += makeCheckboxGroup("Stage", "filter-stage", stages, {
    "Eligible":     "Can earn incentives on this deal.",
    "Expired":      "The incentive has reached the expiry date.",
    "Not Eligible": "Not eligible for incentives (e.g. all stages completed, another UC opted-in in same offer)."
  }, function(o) { return '<span class="stage-badge stage-' + escHtml(o) + '">' + escHtml(o) + '</span>'; });
  html += '<div class="filter-group"><label class="group-label">Current Stage</label>' + makeStageRangeSlider("det-cs", currentStageOrder) + '</div>';
  html += makeCheckboxGroup("Opt-In Status", "filter-optin", optIns, {
    "OPTED IN":  "Deal has been selected for CPI.",
    "OPTED OUT": "Deal has been de-selected.",
    "PENDING":   "Opt-in is possible."
  });
  html += '<div class="filter-group"><label class="group-label">Portfolio' + tip("The technology portfolio that encompasses offers and UCs.") + '</label>' + makeDropdown("filter-portfolio", portfolios) + '</div>';
  html += '<div class="filter-group"><label class="group-label">Offer' + tip("The main solution that was sold to the customer.") + '</label>' + makeDropdown("filter-offer", offerList) + '</div>';
  html += '<div class="filter-group"><label class="group-label">Use Case</label>' + makeDropdown("filter-uc", ucList) + '</div>';

  // Date filters
  html += '<div class="filter-group"><label class="group-label">Booking Date</label>'          + makeDateSlider("det-bk",  dateBounds.bk)  + '</div>';
  html += '<div class="filter-group"><label class="group-label">Opt-in Date</label>'            + makeDateSlider("det-rs",  dateBounds.rs)  + '</div>';
  html += '<div class="filter-group"><label class="group-label">Incentive Expiry Date</label>'  + makeDateSlider("det-exp", dateBounds.exp) + '</div>';
  html += '<div class="filter-group"><label class="group-label">Earn Date' + tip("Moving this slider will automatically check the Earned filter.") + '</label>'              + makeDateSlider("det-ea",  dateBounds.ea)  + '</div>';

  if (countryList.length > 0) {
    html += '<div class="filter-group"><label class="group-label">Country' + tip("Hold Ctrl/Cmd to select multiple countries.") + '</label>' +
      '<select id="filter-country" class="form-select form-select-sm" multiple style="height:110px">' +
      countryList.map(function(o){ return '<option value="' + escHtml(o) + '">' + escHtml(o) + '</option>'; }).join('') +
      '</select></div>';
  }

  html += '<div class="filter-group"><label class="group-label"><i class="bi bi-tags me-1"></i>Tags' +
    '<span class="tag-mode-toggle ms-2" id="tag-mode-toggle" title="Switch between matching ALL or ANY selected tags">' +
      '<button type="button" class="btn btn-xs tag-mode-btn active" data-mode="ALL">ALL</button>' +
      '<button type="button" class="btn btn-xs tag-mode-btn" data-mode="ANY">ANY</button>' +
    '</span>' +
  '</label><div id="annot-tag-filter-list"></div></div>';
  html += '</div>'; // /det-filter-body
  html += '</div>'; // /sidebar

  // Main content
  html += '<div class="flex-grow-1 min-width-0">';
  html += '<div class="d-flex gap-2 flex-wrap mb-3" id="det-summary"></div>';
  html += '<div id="det-table-area"></div>';
  html += '<div id="det-pagination" class="mt-2"></div>';
  html += '</div>';
  html += '</div>'; // /d-flex

  el.innerHTML = html;

  // ── Collapsible filter sidebar
  var filterToggle = document.getElementById("det-filter-toggle");
  var filterBody   = document.getElementById("det-filter-body");
  var filterSidebar = document.getElementById("det-filter-sidebar");
  filterToggle.addEventListener("click", function () {
    var isCollapsed = filterBody.classList.toggle("d-none");
    filterToggle.classList.toggle("collapsed", isCollapsed);
    filterSidebar.style.minWidth = isCollapsed ? "0" : "";
    document.getElementById("det-filter-label").classList.toggle("d-none", isCollapsed);
    document.getElementById("det-clear-btn").classList.toggle("d-none", isCollapsed);
    if (window.APP_FILTER_STATE && window.APP_FILTER_STATE.details) {
      window.APP_FILTER_STATE.details.filterCollapsed = isCollapsed;
    }
  });

  // Initialise Bootstrap tooltips on info icons
  el.querySelectorAll("[data-bs-toggle='tooltip']").forEach(function (el2) {
    new bootstrap.Tooltip(el2, { html: false });
  });

  // ── Slider display updater(defined here so it's available to all wiring below)
  var _sliderLastMoved = {}; // tracks "from" or "to" per prefix
  if (!window._sliderUserSet) window._sliderUserSet = {};

  function updateSliderDisplay(prefix) {
    var fromEl  = document.getElementById(prefix + "-from");
    var toEl    = document.getElementById(prefix + "-to");
    var fillEl  = document.getElementById(prefix + "-fill");
    var fromLbl = document.getElementById(prefix + "-from-lbl");
    var toLbl   = document.getElementById(prefix + "-to-lbl");
    if (!fromEl || !toEl) return;
    var fromVal = parseInt(fromEl.value), toVal = parseInt(toEl.value);
    var min = parseInt(fromEl.min),       max  = parseInt(fromEl.max);
    if (fillEl && max > min) {
      fillEl.style.left  = ((fromVal - min) / (max - min) * 100) + "%";
      fillEl.style.right = ((max - toVal)   / (max - min) * 100) + "%";
    }
    // When thumbs overlap, raise the last-moved thumb so it stays grabbable
    if (fromVal === toVal) {
      var last = _sliderLastMoved[prefix] || "from";
      fromEl.style.zIndex = (last === "from") ? "5" : "";
      toEl.style.zIndex   = (last === "to")   ? "5" : "";
    } else {
      fromEl.style.zIndex = "";
      toEl.style.zIndex   = "";
    }
    if (fromLbl) fromLbl.textContent = new Date(fromVal * 86400000).toLocaleDateString(window.APP_LOCALE);
    if (toLbl)   toLbl.textContent   = new Date(toVal   * 86400000).toLocaleDateString(window.APP_LOCALE);
  }

  // Wire up filters
  el.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
    cb.addEventListener("change", function () { currentPage = 1; applyFiltersAndRender(); });
  });
  if (document.getElementById("filter-2tpartner")) {
    document.getElementById("filter-2tpartner").addEventListener("input", function () {
      document.getElementById("det-2tpartner-clear").classList.toggle("d-none", this.value === "");
      currentPage = 1; applyFiltersAndRender();
    });
    document.getElementById("det-2tpartner-clear").addEventListener("click", function () {
      var inp = document.getElementById("filter-2tpartner");
      inp.value = "";
      this.classList.add("d-none");
      inp.focus();
      currentPage = 1; applyFiltersAndRender();
    });
  }
  document.getElementById("filter-crparty").addEventListener("input", function () {
    document.getElementById("det-crparty-clear").classList.toggle("d-none", this.value === "");
    currentPage = 1; applyFiltersAndRender();
  });
  document.getElementById("det-crparty-clear").addEventListener("click", function () {
    var inp = document.getElementById("filter-crparty");
    inp.value = "";
    this.classList.add("d-none");
    inp.focus();
    currentPage = 1; applyFiltersAndRender();
  });
  function refreshUcDropdown() {
    var pf = document.getElementById("filter-portfolio").value;
    var of = document.getElementById("filter-offer").value;
    var ucSel = document.getElementById("filter-uc");
    var prevUc = ucSel.value;
    var filteredUcs = ucList.filter(function (u) {
      return data.some(function (r) {
        if (pf && String(r["Deal CPI Portfolio"] || "") !== pf) return false;
        if (of && String(r["Track"] || "") !== of) return false;
        return String(r["Sub-Track"] || "") === u;
      });
    });
    ucSel.innerHTML = '<option value="">All</option>';
    filteredUcs.forEach(function (u) {
      ucSel.innerHTML += '<option value="' + u.replace(/"/g, "&quot;") + '"' + (u === prevUc ? ' selected' : '') + '>' + u + '</option>';
    });
    if (prevUc && filteredUcs.indexOf(prevUc) === -1) ucSel.value = "";
  }

  document.getElementById("filter-portfolio").addEventListener("change", function () {
    var pf = this.value;
    var offerSel = document.getElementById("filter-offer");
    var prevOffer = offerSel.value;
    var filteredOffers = pf
      ? Array.from(new Set(data.filter(function(r){ return String(r["Deal CPI Portfolio"]||"") === pf; }).map(function(r){ return String(r["Track"]||""); }).filter(Boolean))).sort()
      : offerList;
    offerSel.innerHTML = '<option value="">All</option>';
    filteredOffers.forEach(function (o) {
      offerSel.innerHTML += '<option value="' + o.replace(/"/g, "&quot;") + '"' + (o === prevOffer ? ' selected' : '') + '>' + o + '</option>';
    });
    if (pf && prevOffer && filteredOffers.indexOf(prevOffer) === -1) offerSel.value = "";
    refreshUcDropdown();
    currentPage = 1; applyFiltersAndRender();
  });
  document.getElementById("filter-offer").addEventListener("change", function () { refreshUcDropdown(); currentPage = 1; applyFiltersAndRender(); });
  document.getElementById("filter-uc").addEventListener("change", function () { currentPage = 1; applyFiltersAndRender(); });
  if (document.getElementById("filter-country")) {
    document.getElementById("filter-country").addEventListener("change", function () { currentPage = 1; applyFiltersAndRender(); });
  }
  ["det-bk","det-rs","det-ea","det-exp"].forEach(function (prefix) {
    ["from","to"].forEach(function (side) {
      var el2 = document.getElementById(prefix + "-" + side);
      if (!el2) return;
      el2.addEventListener("input", function () {
        delete this.dataset.intendedValue;
        _sliderLastMoved[prefix] = side;
        window._sliderUserSet[prefix] = true;
        var fromEl = document.getElementById(prefix + "-from");
        var toEl   = document.getElementById(prefix + "-to");
        if (fromEl && toEl && parseInt(fromEl.value) > parseInt(toEl.value)) {
          if (side === "from") fromEl.value = toEl.value;
          else toEl.value = fromEl.value;
        }
        // Auto-check Earned when Earn Date slider is moved
        if (prefix === "det-ea") {
          var earnedCb = document.getElementById("filter-earned");
          if (earnedCb) earnedCb.checked = true;
        }
        updateSliderDisplay(prefix);
        currentPage = 1;
        applyFiltersAndRender();
      });
    });
    updateSliderDisplay(prefix);
  });

  function updateStageSliderDisplay() {
    var fromEl  = document.getElementById("det-cs-from");
    var toEl    = document.getElementById("det-cs-to");
    var fillEl  = document.getElementById("det-cs-fill");
    var fromLbl = document.getElementById("det-cs-from-lbl");
    var toLbl   = document.getElementById("det-cs-to-lbl");
    if (!fromEl || !toEl) return;
    var fromVal = parseInt(fromEl.value), toVal = parseInt(toEl.value);
    var min = parseInt(fromEl.min),       max  = parseInt(fromEl.max);
    if (fillEl && max > min) {
      fillEl.style.left  = ((fromVal - min) / (max - min) * 100) + "%";
      fillEl.style.right = ((max - toVal)   / (max - min) * 100) + "%";
    }
    if (fromVal === toVal) {
      var last = _sliderLastMoved["det-cs"] || "from";
      fromEl.style.zIndex = (last === "from") ? "5" : "";
      toEl.style.zIndex   = (last === "to")   ? "5" : "";
    } else {
      fromEl.style.zIndex = "";
      toEl.style.zIndex   = "";
    }
    if (fromLbl) fromLbl.innerHTML = stageBadgeHtml(currentStageOrder[fromVal] || "");
    if (toLbl)   toLbl.innerHTML   = stageBadgeHtml(currentStageOrder[toVal]   || "");
  }

  ["det-cs-from", "det-cs-to"].forEach(function (csId) {
    var csEl = document.getElementById(csId);
    if (!csEl) return;
    csEl.addEventListener("input", function () {
      var side   = csId === "det-cs-from" ? "from" : "to";
      _sliderLastMoved["det-cs"] = side;
      var fromEl = document.getElementById("det-cs-from");
      var toEl   = document.getElementById("det-cs-to");
      if (fromEl && toEl && parseInt(fromEl.value) > parseInt(toEl.value)) {
        if (csId === "det-cs-from") fromEl.value = toEl.value;
        else toEl.value = fromEl.value;
      }
      updateStageSliderDisplay();
      currentPage = 1;
      applyFiltersAndRender();
    });
  });
  updateStageSliderDisplay();

  document.getElementById("det-clear-btn").addEventListener("click", function () {
    window._sliderUserSet = {};
    _sliderLastMoved = {};
    ucMissedPreset = false;
    if (document.getElementById("filter-2tpartner")) document.getElementById("filter-2tpartner").value = "";
    document.getElementById("filter-crparty").value = "";
    var _clrBtns = ["det-2tpartner-clear","det-crparty-clear"];
    _clrBtns.forEach(function(id) { var b = document.getElementById(id); if (b) b.classList.add("d-none"); });
    el.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.checked = false; });
    activeTagFilters = [];
    document.getElementById("filter-portfolio").value = "";
    document.getElementById("filter-offer").value = "";
    document.getElementById("filter-uc").value = "";
    if (document.getElementById("filter-country")) {
      Array.from(document.getElementById("filter-country").options).forEach(function(o){ o.selected = false; });
    }
    refreshUcDropdown();
    ["det-bk","det-rs","det-ea","det-exp"].forEach(function (prefix) {
      var fromEl = document.getElementById(prefix + "-from");
      var toEl   = document.getElementById(prefix + "-to");
      if (fromEl) fromEl.value = fromEl.min;
      if (toEl)   toEl.value   = toEl.max;
      updateSliderDisplay(prefix);
    });
    var csFrom = document.getElementById("det-cs-from");
    var csTo   = document.getElementById("det-cs-to");
    if (csFrom) csFrom.value = csFrom.min;
    if (csTo)   csTo.value   = csTo.max;
    updateStageSliderDisplay();
    currentPage = 1;
    applyFiltersAndRender();
  });

  // Apply deep-link preset if navigated from another tab
  if (window._detDeepLink) {
    var dl = window._detDeepLink;
    if (dl.hideExcluded) { var _cbHideExcl = document.getElementById("filter-hide-excluded"); if (_cbHideExcl) _cbHideExcl.checked = true; }
    if (dl.checkboxIds) { dl.checkboxIds.forEach(function(id) { var cb = document.getElementById(id); if (cb) cb.checked = true; }); }
    if (dl.stage)         { dl.stage.forEach(function(s) { document.querySelectorAll('#filter-stage input[type=checkbox]').forEach(function(cb) { if (cb.value.toUpperCase() === s.toUpperCase()) cb.checked = true; }); }); }
    if (dl.ucMissed)      { ucMissedPreset = true; }
    if (dl.optIn)         { dl.optIn.forEach(function(s) { document.querySelectorAll('#filter-optin input[type=checkbox]').forEach(function(cb) { if (cb.value.toUpperCase() === s.toUpperCase()) cb.checked = true; }); }); }
    if (dl.sortField) { sortField = dl.sortField; }
    if (dl.sortDir)   { sortDir   = dl.sortDir;   }
    if (dl.maxIncentive) { var _cbMax = document.getElementById("filter-max-incentive"); if (_cbMax) _cbMax.checked = true; }
    if (dl.offerOptedInN) { var _cbn = document.getElementById("filter-offer-optedin-n"); if (_cbn) _cbn.checked = true; }
    if (dl.offerOptedInY) { var _cby = document.getElementById("filter-offer-optedin-y"); if (_cby) _cby.checked = true; }
    if (dl.portfolio) {
      var _pfEl = document.getElementById("filter-portfolio");
      if (_pfEl) {
        _pfEl.value = dl.portfolio;
        var _ofSel = document.getElementById("filter-offer");
        if (_ofSel) {
          var _dlOffers = Array.from(new Set(data.filter(function(r){ return String(r["Deal CPI Portfolio"]||"") === dl.portfolio; }).map(function(r){ return String(r["Track"]||""); }).filter(Boolean))).sort();
          _ofSel.innerHTML = '<option value="">All</option>';
          _dlOffers.forEach(function(o){ _ofSel.innerHTML += '<option value="'+o.replace(/"/g,'&quot;')+'">'+o+'</option>'; });
        }
      }
    }
    if (dl.offer) { var _ofEl = document.getElementById("filter-offer"); if (_ofEl) _ofEl.value = dl.offer; refreshUcDropdown(); }
    if (dl.uc)    { var _ucEl = document.getElementById("filter-uc");    if (_ucEl) _ucEl.value = dl.uc; }
    if (dl.csFrom !== undefined || dl.csTo !== undefined) {
      var _csFrom = document.getElementById("det-cs-from");
      var _csTo   = document.getElementById("det-cs-to");
      if (_csFrom && dl.csFrom !== undefined) _csFrom.value = dl.csFrom;
      if (_csTo   && dl.csTo   !== undefined) _csTo.value   = dl.csTo;
      updateStageSliderDisplay();
    }
    if (dl.bkFrom !== undefined || dl.bkTo !== undefined) {
      var _bkFrom = document.getElementById("det-bk-from");
      var _bkTo   = document.getElementById("det-bk-to");
      if (_bkFrom && dl.bkFrom !== undefined) _bkFrom.value = dl.bkFrom;
      if (_bkTo   && dl.bkTo   !== undefined) _bkTo.value   = dl.bkTo;
      window._sliderUserSet["det-bk"] = true;
      updateSliderDisplay("det-bk");
    }
    if (dl.rsFrom !== undefined || dl.rsTo !== undefined) {
      var _rsFrom = document.getElementById("det-rs-from");
      var _rsTo   = document.getElementById("det-rs-to");
      if (_rsFrom && dl.rsFrom !== undefined) _rsFrom.value = dl.rsFrom;
      if (_rsTo   && dl.rsTo   !== undefined) _rsTo.value   = dl.rsTo;
      window._sliderUserSet["det-rs"] = true;
      updateSliderDisplay("det-rs");
    }
    if (dl.eaFrom !== undefined || dl.eaTo !== undefined) {
      var _eaFrom = document.getElementById("det-ea-from");
      var _eaTo   = document.getElementById("det-ea-to");
      if (_eaFrom && dl.eaFrom !== undefined) { _eaFrom.value = dl.eaFrom; _eaFrom.dataset.intendedValue = dl.eaFrom; }
      if (_eaTo   && dl.eaTo   !== undefined) { _eaTo.value   = dl.eaTo;   _eaTo.dataset.intendedValue   = dl.eaTo; }
      window._sliderUserSet["det-ea"] = true;
      updateSliderDisplay("det-ea");
    }
    if (dl.expFrom !== undefined || dl.expTo !== undefined) {
      var _expFrom = document.getElementById("det-exp-from");
      var _expTo   = document.getElementById("det-exp-to");
      if (_expFrom && dl.expFrom !== undefined) _expFrom.value = dl.expFrom;
      if (_expTo   && dl.expTo   !== undefined) _expTo.value   = dl.expTo;
      window._sliderUserSet["det-exp"] = true;
      updateSliderDisplay("det-exp");
    }
    window._detDeepLink = null;
  }

  // Restore persisted filter state if no deep-link was applied
  if (_detSaved && !_hadDeepLink) {
    _restoreDetailsState(_detSaved);
    ["det-bk","det-rs","det-ea","det-exp"].forEach(updateSliderDisplay);
    updateStageSliderDisplay();
  }

  // Load annotations from IDB, populate tag filter UI, then render
  ANNOTATIONS.load().then(function (cache) {
    annotationsCache = cache;
    rebuildTagFilterUI();
    applyFiltersAndRender();
  }).catch(function (err) {
    console.warn("[AdoptDash] ANNOTATIONS.load() failed in Details, rendering anyway:", err);
    applyFiltersAndRender();
  });

  function _restoreDetailsState(st) {
    // Text inputs
    var crEl = document.getElementById("filter-crparty");
    if (crEl && st.crParty) {
      crEl.value = st.crParty;
      var crClr = document.getElementById("det-crparty-clear");
      if (crClr) crClr.classList.remove("d-none");
    }
    var ttEl = document.getElementById("filter-2tpartner");
    if (ttEl && st.twoTPartner) {
      ttEl.value = st.twoTPartner;
      var ttClr = document.getElementById("det-2tpartner-clear");
      if (ttClr) ttClr.classList.remove("d-none");
    }
    // Portfolio → repopulate offer list → set offer → set UC → refreshUcDropdown
    var pfEl = document.getElementById("filter-portfolio");
    if (pfEl && st.portfolio) {
      pfEl.value = st.portfolio;
      var offerSel2 = document.getElementById("filter-offer");
      if (offerSel2) {
        var filteredOffers2 = Array.from(new Set(data.filter(function(r){ return String(r["Deal CPI Portfolio"]||"") === st.portfolio; }).map(function(r){ return String(r["Track"]||""); }).filter(Boolean))).sort();
        offerSel2.innerHTML = '<option value="">All</option>';
        filteredOffers2.forEach(function(o){ offerSel2.innerHTML += '<option value="'+o.replace(/"/g,'&quot;')+'">'+o+'</option>'; });
      }
    }
    var ofEl = document.getElementById("filter-offer");
    var ucEl2 = document.getElementById("filter-uc");
    if (ofEl  && st.offer) ofEl.value  = st.offer;
    if (ucEl2 && st.uc)    ucEl2.value = st.uc;
    var ctEl = document.getElementById("filter-country");
    if (ctEl && st.country && st.country.length > 0) {
      Array.from(ctEl.options).forEach(function(o){ o.selected = st.country.indexOf(o.value) !== -1; });
    }
    refreshUcDropdown();
    // Stage checkboxes
    if (st.stageChecked && st.stageChecked.length) {
      document.querySelectorAll('#filter-stage input[type=checkbox]').forEach(function(cb){ cb.checked = st.stageChecked.indexOf(cb.value) !== -1; });
    }
    // Opt-In checkboxes
    if (st.optInChecked && st.optInChecked.length) {
      document.querySelectorAll('#filter-optin input[type=checkbox]').forEach(function(cb){ cb.checked = st.optInChecked.indexOf(cb.value) !== -1; });
    }
    // Boolean checkboxes
    var _boolMap = { offerOptedInY:"filter-offer-optedin-y", offerOptedInN:"filter-offer-optedin-n",
      pviEligible:"filter-pvi-Eligible", pviOnboard:"filter-pvi-Onboard", pviAdopt:"filter-pvi-Adopt",
      newEligible:"filter-new-eligible", expiresSoon:"filter-expires-soon",
      earned:"filter-earned", ea:"filter-ea", aap:"filter-aap", maxIncentive:"filter-max-incentive" };
    Object.keys(_boolMap).forEach(function(key) {
      var cbEl = document.getElementById(_boolMap[key]);
      if (cbEl && st[key]) cbEl.checked = true;
    });
    // Sliders
    [["det-bk-from","bkFrom"],["det-bk-to","bkTo"],["det-rs-from","rsFrom"],["det-rs-to","rsTo"],
     ["det-ea-from","eaFrom"],["det-ea-to","eaTo"],
     ["det-exp-from","expFrom"],["det-exp-to","expTo"],["det-cs-from","csFrom"],["det-cs-to","csTo"]
    ].forEach(function(p) {
      var slEl = document.getElementById(p[0]);
      if (slEl && st[p[1]] !== null && st[p[1]] !== undefined && st[p[1]] !== "") slEl.value = st[p[1]];
    });
    if (st.ucMissedPreset) ucMissedPreset = true;
    if (st.sliderUserSet) window._sliderUserSet = JSON.parse(JSON.stringify(st.sliderUserSet));
    // Restore filter pane collapsed state
    if (st.filterCollapsed) {
      filterBody.classList.add("d-none");
      filterToggle.classList.add("collapsed");
      filterSidebar.style.minWidth = "0";
      document.getElementById("det-filter-label").classList.add("d-none");
      document.getElementById("det-clear-btn").classList.add("d-none");
    }
  }

  function applyFiltersAndRender() {
    // Persist current filter state so it survives tab switching
    if (window.APP_FILTER_STATE) {
      window.APP_FILTER_STATE.details = {
        sortField:     sortField,
        sortDir:       sortDir,
        showCompletionDates: showCompletionDates,
        showDealDetails:     showDealDetails,
        showStageIncentives: showStageIncentives,
        showDaysSinceOptIn:  showDaysSinceOptIn,
        showOverallProgress: showOverallProgress,
        ucMissedPreset: ucMissedPreset,
        crParty:       (document.getElementById("filter-crparty")    || {value:""}).value,
        twoTPartner:   (document.getElementById("filter-2tpartner")  || {value:""}).value,
        portfolio:     (document.getElementById("filter-portfolio")  || {value:""}).value,
        offer:         (document.getElementById("filter-offer")      || {value:""}).value,
        uc:            (document.getElementById("filter-uc")         || {value:""}).value,
        country:       (function(){ var el = document.getElementById("filter-country"); return el ? Array.from(el.selectedOptions).map(function(o){ return o.value; }) : []; })(),
        stageChecked:  getChecked("filter-stage"),
        optInChecked:  getChecked("filter-optin"),
        offerOptedInY: !!(document.getElementById("filter-offer-optedin-y") || {}).checked,
        offerOptedInN: !!(document.getElementById("filter-offer-optedin-n") || {}).checked,
        pviEligible:   !!(document.getElementById("filter-pvi-Eligible")    || {}).checked,
        pviOnboard:    !!(document.getElementById("filter-pvi-Onboard")     || {}).checked,
        pviAdopt:      !!(document.getElementById("filter-pvi-Adopt")       || {}).checked,
        newEligible:   !!(document.getElementById("filter-new-eligible")    || {}).checked,
        expiresSoon:   !!(document.getElementById("filter-expires-soon")    || {}).checked,
        earned:        !!(document.getElementById("filter-earned")          || {}).checked,
        ea:            !!(document.getElementById("filter-ea")              || {}).checked,
        aap:           !!(document.getElementById("filter-aap")             || {}).checked,
        maxIncentive:  !!(document.getElementById("filter-max-incentive")  || {}).checked,
        bkFrom:        window._sliderUserSet["det-bk"]  ? (document.getElementById("det-bk-from")  || {value:null}).value : null,
        bkTo:          window._sliderUserSet["det-bk"]  ? (document.getElementById("det-bk-to")    || {value:null}).value : null,
        rsFrom:        window._sliderUserSet["det-rs"]  ? (document.getElementById("det-rs-from")  || {value:null}).value : null,
        rsTo:          window._sliderUserSet["det-rs"]  ? (document.getElementById("det-rs-to")    || {value:null}).value : null,
        eaFrom:        window._sliderUserSet["det-ea"]  ? (document.getElementById("det-ea-from")  || {value:null}).value : null,
        eaTo:          window._sliderUserSet["det-ea"]  ? (document.getElementById("det-ea-to")    || {value:null}).value : null,
        expFrom:       window._sliderUserSet["det-exp"] ? (document.getElementById("det-exp-from") || {value:null}).value : null,
        expTo:         window._sliderUserSet["det-exp"] ? (document.getElementById("det-exp-to")   || {value:null}).value : null,
        csFrom:        (document.getElementById("det-cs-from")  || {value:null}).value,
        csTo:          (document.getElementById("det-cs-to")    || {value:null}).value,
        sliderUserSet: window._sliderUserSet ? JSON.parse(JSON.stringify(window._sliderUserSet)) : {},
        filterCollapsed: filterBody ? filterBody.classList.contains("d-none") : false
      };
    }
    var twoTVal          = document.getElementById("filter-2tpartner") ? document.getElementById("filter-2tpartner").value.trim().toLowerCase() : "";
    var crPartyVal       = document.getElementById("filter-crparty").value.trim().toLowerCase();
    var stageChecked     = getChecked("filter-stage");
    var optInChecked     = getChecked("filter-optin");
    var portfolioVal     = document.getElementById("filter-portfolio").value;
    var offerVal         = document.getElementById("filter-offer").value;
    var ucVal            = document.getElementById("filter-uc").value;
    var offerOptedIn     = document.getElementById("filter-offer-optedin-y") ? document.getElementById("filter-offer-optedin-y").checked : false;
    var offerNotOptedIn  = document.getElementById("filter-offer-optedin-n") ? document.getElementById("filter-offer-optedin-n").checked : false;
    var pviEligible      = document.getElementById("filter-pvi-Eligible") && document.getElementById("filter-pvi-Eligible").checked;
    var pviOnboard       = document.getElementById("filter-pvi-Onboard")  && document.getElementById("filter-pvi-Onboard").checked;
    var pviAdopt         = document.getElementById("filter-pvi-Adopt")    && document.getElementById("filter-pvi-Adopt").checked;
    var ucMissed         = ucMissedPreset;
    var newEligible      = document.getElementById("filter-new-eligible").checked;
    var expiresSoon      = document.getElementById("filter-expires-soon").checked;
    var earnedChecked    = document.getElementById("filter-earned").checked;
    var eaChecked        = document.getElementById("filter-ea").checked;
    var aapChecked        = document.getElementById("filter-aap").checked;
    var maxIncentiveChecked = !!(document.getElementById("filter-max-incentive") || {}).checked;
    var bkFrom  = document.getElementById("det-bk-from");
    var bkTo    = document.getElementById("det-bk-to");
    var rsFrom  = document.getElementById("det-rs-from");
    var rsTo    = document.getElementById("det-rs-to");
    var eaFrom  = document.getElementById("det-ea-from");
    var eaTo    = document.getElementById("det-ea-to");
    var expFrom = document.getElementById("det-exp-from");
    var expTo   = document.getElementById("det-exp-to");
    function sliderVal(el) { return el ? new Date(parseInt(el.value) * 86400000) : null; }
    function atMin(el)     { return !el || parseInt(el.value) === parseInt(el.min); }
    function atMax(el)     { return !el || parseInt(el.value) === parseInt(el.max); }
    var bkFromDate  = atMin(bkFrom)  ? null : sliderVal(bkFrom);
    var bkToDate    = atMax(bkTo)    ? null : sliderVal(bkTo);
    var rsFromDate  = atMin(rsFrom)  ? null : sliderVal(rsFrom);
    var rsToDate    = atMax(rsTo)    ? null : sliderVal(rsTo);
    var eaFromDate  = atMin(eaFrom)  ? null : sliderVal(eaFrom);
    var eaToDate    = atMax(eaTo)    ? null : sliderVal(eaTo);
    var eaActive    = eaFrom && eaTo && !(parseInt(eaFrom.value) === parseInt(eaFrom.min) && parseInt(eaTo.value) === parseInt(eaTo.max));
    if (eaActive) {
      eaFromDate = (eaFrom && eaFrom.dataset.intendedValue !== undefined) ? new Date(parseInt(eaFrom.dataset.intendedValue) * 86400000) : sliderVal(eaFrom);
      eaToDate   = (eaTo   && eaTo.dataset.intendedValue   !== undefined) ? new Date(parseInt(eaTo.dataset.intendedValue)   * 86400000) : sliderVal(eaTo);
    }
    var expFromDate = atMin(expFrom) ? null : sliderVal(expFrom);
    var expToDate   = atMax(expTo)   ? null : sliderVal(expTo);
    var csFromEl  = document.getElementById("det-cs-from");
    var csToEl    = document.getElementById("det-cs-to");
    var csFromIdx = csFromEl ? parseInt(csFromEl.value) : 0;
    var csToIdx   = csToEl   ? parseInt(csToEl.value)   : currentStageOrder.length - 1;
    var csActive  = csFromEl && csToEl && !(parseInt(csFromEl.value) === parseInt(csFromEl.min) && parseInt(csToEl.value) === parseInt(csToEl.max));

    filteredData = data.filter(function (r) {
      if (twoTVal    && String(r["2T Partner Name"] || "").toLowerCase().indexOf(twoTVal) === -1
                     && String(r["2T Partner BE GEO ID - (Disti Only)"] || "").toLowerCase().indexOf(twoTVal) === -1) return false;
      if (crPartyVal && String(r["CR Party Name"] || "").toLowerCase().indexOf(crPartyVal) === -1
                     && String(r["Deal WS-ID"] || "").toLowerCase().indexOf(crPartyVal) === -1
                     && String(r["CR Party ID"] || "").toLowerCase().indexOf(crPartyVal) === -1
                     && String(r["CX Customer BU ID"] || "").toLowerCase().indexOf(crPartyVal) === -1) return false;
      if (stageChecked.length  && stageChecked.indexOf(String(r["Stage"] || "")) === -1)                      return false;
      if (csActive) { var _si = currentStageOrder.indexOf(String(r["Current stage"] || "")); if (_si === -1 || _si < csFromIdx || _si > csToIdx) return false; }
      if (optInChecked.length  && optInChecked.indexOf(String(r["Adopt Rebate Opt-In Status"] || "")) === -1) return false;
      if (portfolioVal         && String(r["Deal CPI Portfolio"] || "") !== portfolioVal)                     return false;
      if (offerVal             && String(r["Track"] || "") !== offerVal)                                      return false;
      if (ucVal                && String(r["Sub-Track"] || "") !== ucVal)                                     return false;
      var _ctryEl = document.getElementById("filter-country");
      var _ctrySelected = _ctryEl ? Array.from(_ctryEl.selectedOptions).map(function(o){ return o.value; }) : [];
      if (_ctrySelected.length > 0 && _ctrySelected.indexOf(String(r["End Customer Country"] || "")) === -1) return false;
      if (offerOptedIn && !offerNotOptedIn && r["Offer opted-in?"] !== true)  return false;
      if (offerNotOptedIn && !offerOptedIn && r["Offer opted-in?"] === true)   return false;
      if (pviEligible      && !r["PVI Eligible"])    return false;
      if (pviOnboard       && !r["PVI Onboard"])    return false;
      if (pviAdopt         && !r["PVI Adopt"])      return false;
      if (ucMissed         && !r["UC progressed and missed w/o opt-in"]) return false;
      if (newEligible      && !r["New eligible"])                                                         return false;
      if (expiresSoon) {
        var _expD = toDate(r["Deal Incentive Expiry Date"]);
        var _expMidnight = _expD ? new Date(_expD.getFullYear(), _expD.getMonth(), _expD.getDate()) : null;
        var _today = new Date(); _today.setHours(0,0,0,0);
        var _in30 = new Date(_today.getTime() + 30 * 86400000);
        if (!_expMidnight || _expMidnight < _today || _expMidnight >= _in30) return false;
        if ((r["Stage"] || "").toUpperCase() !== "ELIGIBLE") return false;
      }
      if (earnedChecked    && r["Earned?"] !== true)                                                        return false;
      if (eaChecked        && String(r["EA Flag"] || "") !== "Yes")                                         return false;
      if (aapChecked          && String(r["AAP Flag"] || "") !== "Yes")                      return false;
      if (maxIncentiveChecked && norm(r["Maximum Incentive Deal Flag"]) !== "YES")          return false;

      // Tag filter: AND = row must have ALL selected tags; ANY = row needs at least one
      if (activeTagFilters.length > 0) {
        var wsIdRow  = String(r["Deal WS-ID"] || "");
        var rowAnnot = annotationsCache[wsIdRow];
        var rowTags  = rowAnnot ? (rowAnnot.tags || []) : [];
        if (tagFilterMode === "ANY") {
          var hasAny = false;
          for (var _ti = 0; _ti < activeTagFilters.length; _ti++) {
            if (rowTags.indexOf(activeTagFilters[_ti]) !== -1) { hasAny = true; break; }
          }
          if (!hasAny) return false;
        } else {
          for (var _ti = 0; _ti < activeTagFilters.length; _ti++) {
            if (rowTags.indexOf(activeTagFilters[_ti]) === -1) return false;
          }
        }
      }

      if (bkFromDate || bkToDate) {
        var d = toDate(r["Booking Date"]);
        if (d) {
          if (bkFromDate && d < bkFromDate) return false;
          if (bkToDate   && d > bkToDate)   return false;
        }
      }
      if (rsFromDate || rsToDate) {
        var d2 = toDate(r["Adopt Rebate Start Date"]);
        if (!d2) return false;
        if (rsFromDate && d2 < rsFromDate) return false;
        if (rsToDate   && d2 > rsToDate)   return false;
      }
      if (eaActive) {
        var EARN_COLS2 = ["Stage Completion Date(onboard)", "Stage Completion Date(Use)", "Stage Completion Date(Engage)", "Stage Completion Date(Adopt)"];
        var _optInDate = toDate(r["Adopt Rebate Start Date"]);
        var hasEarnDate = EARN_COLS2.some(function(c) {
          var d4 = toDate(r[c]);
          if (!d4) return false;
          if (_optInDate && d4 < _optInDate) return false;
          if (eaFromDate && d4 < eaFromDate) return false;
          if (eaToDate   && d4 > eaToDate)   return false;
          return true;
        });
        if (!hasEarnDate) return false;
      }
      if (expFromDate || expToDate) {
        var d3 = toDate(r["Deal Incentive Expiry Date"]);
        if (d3) {
          if (expFromDate && d3 < expFromDate) return false;
          if (expToDate   && d3 > expToDate)   return false;
        }
      }

      // Exclude filter: hide excluded rows when checkbox is checked
      var _hideExcl = !!(document.getElementById("filter-hide-excluded") && document.getElementById("filter-hide-excluded").checked);
      if (_hideExcl && ANNOTATIONS.isExcluded(String(r["Deal WS-ID"] || ""))) return false;

      return true;
    });

    updateDateSliderBounds();
    applySort();

    renderSummary(filteredData);
    renderTable();
  }

  function updateDateSliderBounds() {
    var EARN_COLS3 = ["Stage Completion Date(onboard)", "Stage Completion Date(Use)", "Stage Completion Date(Engage)", "Stage Completion Date(Adopt)"];
    var sliderDefs = [
      { prefix: "det-bk",  get: function(r) { return [toDate(r["Booking Date"])]; } },
      { prefix: "det-rs",  get: function(r) { return [toDate(r["Adopt Rebate Start Date"])]; } },
      { prefix: "det-ea",  get: function(r) {
        var optIn = toDate(r["Adopt Rebate Start Date"]);
        return EARN_COLS3.map(function(c) { var d = toDate(r[c]); return (d && (!optIn || d >= optIn)) ? d : null; });
      }},
      { prefix: "det-exp", get: function(r) { return [toDate(r["Deal Incentive Expiry Date"])]; } }
    ];
    sliderDefs.forEach(function(def) {
      var fromEl = document.getElementById(def.prefix + "-from");
      var toEl   = document.getElementById(def.prefix + "-to");
      if (!fromEl || !toEl) return;
      // Skip if user has manually set this slider
      if (window._sliderUserSet[def.prefix]) return;
      var mn = null, mx = null;
      filteredData.forEach(function(r) {
        def.get(r).forEach(function(d) {
          if (d) { if (!mn || d < mn) mn = d; if (!mx || d > mx) mx = d; }
        });
      });
      if (!mn || !mx) return;
      var newMin = epochDay(mn), newMax = epochDay(mx);
      fromEl.min = newMin; fromEl.max = newMax;
      toEl.min   = newMin; toEl.max   = newMax;
      fromEl.value = newMin;
      toEl.value   = newMax;
      updateSliderDisplay(def.prefix);
    });
  }

  function applySort() {
    var numericFields = { "Potential Incentives": true, "Missed Incentives": true, "Estimated Earned Incentives": true, "Days in stage": true, "Booking Amount - Net to Cisco": true };
    var dateFields    = { "Deal Incentive Expiry Date": true, "Booking Date": true, "Adopt Rebate Start Date": true };
    var sortToday     = new Date();
    filteredData.sort(function (a, b) {
      var av = a[sortField], bv = b[sortField];
      var primary;
      if (sortField === "_annot") {
        var _aAnnot = annotationsCache[String(a["Deal WS-ID"] || "")] || { tags: [], comment: "" };
        var _bAnnot = annotationsCache[String(b["Deal WS-ID"] || "")] || { tags: [], comment: "" };
        var _aStr = (_aAnnot.tags || []).join(",") + (_aAnnot.comment || "");
        var _bStr = (_bAnnot.tags || []).join(",") + (_bAnnot.comment || "");
        // Rows with annotations sort first (asc), empty last
        if (!_aStr && !_bStr) primary = 0;
        else if (!_aStr) primary = sortDir === "asc" ? 1 : -1;
        else if (!_bStr) primary = sortDir === "asc" ? -1 : 1;
        else primary = sortDir === "asc" ? _aStr.localeCompare(_bStr) : _bStr.localeCompare(_aStr);
      } else if (sortField === "_daysSinceOptIn") {
        var _norm4 = function(x) { return x === null || x === undefined ? "" : String(x).replace(/\u00A0/g," ").trim().toUpperCase(); };
        var _dso = function(r) {
          if ((_norm4(r["Stage"]) !== "ELIGIBLE" && _norm4(r["Stage"]) !== "EXPIRED") || !toDate(r["Adopt Rebate Start Date"])) return -1;
          var _dis2 = parseInt(r["Days in stage"]) || 0;
          var _dsoDays = Math.floor((sortToday - toDate(r["Adopt Rebate Start Date"])) / 86400000);
          return _dis2 <= _dsoDays ? _dis2 : _dsoDays;
        };
        av = _dso(a); bv = _dso(b);
        primary = sortDir === "asc" ? av - bv : bv - av;
      } else if (sortField === "Current stage") {
        var ai = currentStageOrder.indexOf(av || ""), bi = currentStageOrder.indexOf(bv || "");
        if (ai === -1) ai = currentStageOrder.length;
        if (bi === -1) bi = currentStageOrder.length;
        primary = sortDir === "asc" ? ai - bi : bi - ai;
      } else if (numericFields[sortField]) {
        av = av || 0; bv = bv || 0;
        primary = sortDir === "asc" ? av - bv : bv - av;
      } else if (dateFields[sortField]) {
        var ad = toDate(av), bd = toDate(bv);
        if (!ad && !bd) primary = 0;
        else if (!ad) primary = sortDir === "asc" ? 1 : -1;
        else if (!bd) primary = sortDir === "asc" ? -1 : 1;
        else primary = sortDir === "asc" ? ad - bd : bd - ad;
      } else {
        av = String(av || "").toLowerCase(); bv = String(bv || "").toLowerCase();
        primary = sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (primary !== 0) return primary;
      // Alphabetical tiebreaker (only when primary sort is not already by name)
      if (sortField !== "CR Party Name") {
        var an = String(a["CR Party Name"] || "").toLowerCase();
        var bn = String(b["CR Party Name"] || "").toLowerCase();
        return an.localeCompare(bn);
      }
      return 0;
    });
  }

  function renderSummary(rows) {
    var s = calcSummary(rows);
    var html = "";
    if (has2TPartner) html += metricCard(s.partners, "2T Partners");
    html += metricCard(s.customers,          "Customers",             "A customer refers to a unique CR Party ID.");
    html += metricCard(s.useCases,           "Use Cases",             "Count of unique use cases per offer per CR Party ID.");
    html += metricCard("$" + Math.round(s.missed).toLocaleString(),    "Total Missed",           "Total amount of missed incentives. The highest incentive per unique UC per offer per CR Party ID is counted.");
    html += metricCard("$" + Math.round(s.potential).toLocaleString(), "Total Potential",        "Total amount of remaining incentives. The highest incentive per unique UC per offer per CR Party ID is counted.");
    html += metricCard("$" + Math.round(s.earned).toLocaleString(),    "Total Estimated Earned", "Estimated amount of earned incentives according to program rules. Payment process goes through further steps validated by the CPI team.");
    html += '<div class="d-flex flex-column align-items-end ms-auto gap-1">' +
      '<button id="det-export-btn" class="btn btn-sm btn-outline-success" style="font-size:0.82rem;white-space:nowrap">' +
      '<i class="bi bi-file-earmark-excel me-1"></i>Export to Excel</button>' +
      '<button id="det-annot-export-btn" class="btn btn-sm btn-outline-secondary" style="font-size:0.75rem;white-space:nowrap" title="Export annotations &amp; tags to CSV">' +
      '<i class="bi bi-download me-1"></i>Export Notes</button>' +
      '<label class="btn btn-sm btn-outline-secondary mb-0" style="font-size:0.75rem;white-space:nowrap;cursor:pointer" title="Import annotations &amp; tags from CSV">' +
      '<i class="bi bi-upload me-1"></i>Import Notes<input type="file" id="det-annot-import-input" accept=".csv" style="display:none"></label>' +
      '</div>';
    document.getElementById("det-summary").innerHTML = html;
    document.getElementById("det-export-btn").addEventListener("click", function () {
      exportDetailsToXlsx(rows);
    });
    document.getElementById("det-annot-export-btn").addEventListener("click", function () {
      ANNOTATIONS.exportJSON();
    });
    document.getElementById("det-annot-import-input").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      ANNOTATIONS.importJSON(file).then(function (count) {
        annotationsCache = ANNOTATIONS.getAll();
        applyFiltersAndRender();
        rebuildTagFilterUI();
        alert("Imported " + count + " annotation(s).");
      }).catch(function (err) {
        alert("Import failed: " + err.message);
      });
      e.target.value = "";
    });
  }

  function metricCard(value, label, tooltip) {
    var infoIcon = tooltip ? tip(tooltip) : '';
    return '<div class="metric-card flex-fill"><div class="metric-value">' + value + '</div><div class="metric-label">' + label + infoIcon + '</div></div>';
  }

  function renderTable() {
    var today = new Date();
    var in90  = new Date(today.getTime() + 90 * 86400000);

    var start = (currentPage - 1) * PAGE_SIZE;
    var pageRows = filteredData.slice(start, start + PAGE_SIZE);
    var totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

    var has2TPartner = data.some(function (r) { return r["2T Partner Name"] && String(r["2T Partner Name"]).trim() !== ""; });

    var cols = [
      ...(has2TPartner ? [{ label: "2T Partner Name", field: "2T Partner Name" }] : []),
      { label: "CR Party Name",              field: "CR Party Name",                style: "min-width:180px" },
      { label: "Use Case",                   field: "Sub-Track",                    style: "min-width:160px" },
      { label: "Current Stage",              field: "Current stage",                isCurrentStage: true },
      ...(showCompletionDates ? [
        { label: "Onboard<br>Completion",    field: "Stage Completion Date(onboard)", isDate: true, isEarnDate: true },
        { label: "Use<br>Completion",        field: "Stage Completion Date(Use)",     isDate: true, isEarnDate: true },
        { label: "Engage<br>Completion",     field: "Stage Completion Date(Engage)",  isDate: true, isEarnDate: true },
        { label: "Adopt<br>Completion",      field: "Stage Completion Date(Adopt)",   isDate: true, isEarnDate: true },
        { label: "Stages Completed<br>Before Opt-in", field: "_missedStages", isEarnDate: true },
      ] : []),
      { label: "Days in<br>Stage",              field: "Days in stage",                isDaysInStage: true },
      ...(showDaysSinceOptIn ? [
        { label: "Days Since<br>Opt-in",     field: "_daysSinceOptIn",              isDaysSinceOptInCol: true },
      ] : []),
      { label: "Stage Progress",             field: "Current Stage Progress",       isStageProgress: true },
      ...(showOverallProgress ? [
        { label: "Overall<br>Progress",      field: "Overall Progress",             isOverallProgress: true },
      ] : []),
      { label: "Pending Tasks",              field: "Current stage pending tasks",  style: "max-width:80px" },
      { label: "Booking Date",               field: "Booking Date",                 isDate: true, isBookingDate: true },
      ...(showDealDetails ? [
        { label: "Deal ID",                  field: "Deal ID",                                       isDealDetailCol: true },
        { label: "Booking PO Number",        field: "Booking PO Number",                             isDealDetailCol: true },
        { label: "Net Booking",              field: "Booking Amount - Net to Cisco", isCurrency: true, isDealDetailCol: true },
        { label: "Subscription ID",          field: "Subscription ID",                               isDealDetailCol: true },
      ] : []),
      { label: "Opt-in Date",                field: "Adopt Rebate Start Date",      isDate: true },
      { label: "Expiry Date",                field: "Deal Incentive Expiry Date",   isDate: true, isExpiry: true },
      { label: "Missed Incentives",          field: "Missed Incentives",            isCurrency: true },
      { label: "Potential<br>Incentives",       field: "Potential Incentives",         isCurrency: true, isPotentialIncentives: true },
      ...(showStageIncentives ? [
        { label: "Remaining<br>Onboard",  isRemainingIncentive: true, stageFlag: "Stage Completion Flag(onboard)", stageAmt: "Estimated Incentive Amount(Onboard)" },
        { label: "Remaining<br>Use",      isRemainingIncentive: true, stageFlag: "Stage Completion Flag(Use)",     stageAmt: "Estimated Incentive Amount(Use)"     },
        { label: "Remaining<br>Engage",   isRemainingIncentive: true, stageFlag: "Stage Completion Flag(Engage)",  stageAmt: "Estimated Incentive Amount(Engage)"  },
        { label: "Remaining<br>Adopt",    isRemainingIncentive: true, stageFlag: "Stage Completion Flag(Adopt)",   stageAmt: "Estimated Incentive Amount(Adopt)"   },
      ] : []),
      { label: "Estimated<br>Earned Incentives", field: "Estimated Earned Incentives", isCurrency: true, style: "min-width:90px;max-width:110px" },
      { label: "Deal WS-ID",                 field: "Deal WS-ID",                   style: "min-width:140px", isWsId: true },
      { label: "Status",                     field: "_status",                      isStatus: true },
      { label: "Notes <span class='badge bg-warning text-dark' style='font-size:0.6rem;vertical-align:middle'>Beta</span>", field: "_annot", isAnnot: true, style: "min-width:90px" }
    ];

    var sortableCols = {
      "2T Partner Name": true,
      "CR Party Name": true,
      "Potential Incentives": true,
      "Missed Incentives": true,
      "Estimated Earned Incentives": true,
      "Booking Amount - Net to Cisco": true,
      "_daysSinceOptIn": true,
      "Days in stage": true,
      "Current stage": true,
      "Booking Date": true,
      "Adopt Rebate Start Date": true,
      "Deal Incentive Expiry Date": true,
      "_annot": true
    };
    var thead = "<thead><tr>" + cols.map(function (c) {
      var styleAttr = c.style ? 'style="' + c.style + (sortableCols[c.field] ? ";cursor:pointer;user-select:none" : "") + '"' : '';
      if (c.isRemainingIncentive) {
        return '<th class="text-end" style="white-space:nowrap;font-size:0.8rem;border-bottom:4px solid #7ec8e3">' + c.label + '</th>';
      }
      if (c.isDaysSinceOptInCol) {
        var dsoIcon = sortField === "_daysSinceOptIn" ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅";
        return '<th style="cursor:pointer;user-select:none;border-bottom:4px solid #7ec8e3" data-sortfield="_daysSinceOptIn">' + c.label + '<span style="font-size:0.7rem;opacity:0.7">' + dsoIcon + '</span></th>';
      }
      if (c.isOverallProgress) {
        return '<th style="white-space:nowrap;font-size:0.8rem;border-bottom:4px solid #7ec8e3">' + c.label + '</th>';
      }
      if (c.isStageProgress) {
        var spToggleIcon  = showOverallProgress ? "bi-dash-circle" : "bi-plus-circle";
        var spToggleTitle = showOverallProgress ? "Hide overall progress" : "Show overall progress";
        return '<th style="cursor:pointer;user-select:none' + (showOverallProgress ? ';border-bottom:4px solid #7ec8e3' : '') + '">' +
          c.label +
          ' <i class="bi ' + spToggleIcon + '" id="det-overallprogress-toggle" title="' + spToggleTitle + '" style="font-size:0.8rem;opacity:0.7;cursor:pointer;vertical-align:middle" onclick="event.stopPropagation()"></i></th>';
      }
      if (c.isDaysInStage) {
        var disSortIcon = sortField === c.field ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅";
        var disToggleIcon  = showDaysSinceOptIn ? "bi-dash-circle" : "bi-plus-circle";
        var disToggleTitle = showDaysSinceOptIn ? "Hide days since opt-in" : "Show days since opt-in";
        return '<th style="cursor:pointer;user-select:none' + (showDaysSinceOptIn ? ';border-bottom:4px solid #7ec8e3' : '') + '" data-sortfield="' + c.field + '">' +
          c.label + '<span style="font-size:0.7rem;opacity:0.7">' + disSortIcon + '</span>' +
          ' <i class="bi ' + disToggleIcon + '" id="det-daysoptIn-toggle" title="' + disToggleTitle + '" style="font-size:0.8rem;opacity:0.7;cursor:pointer;vertical-align:middle" onclick="event.stopPropagation()"></i></th>';
      }
      if (c.isEarnDate) {
        return '<th style="white-space:nowrap;font-size:0.8rem;border-bottom:4px solid #7ec8e3">' + c.label + '</th>';
      }
      if (c.isDealDetailCol) {
        var ddStyleAttr = c.style ? 'style="' + c.style + ';border-bottom:4px solid #7ec8e3"' : 'style="border-bottom:4px solid #7ec8e3"';
        if (sortableCols[c.field]) {
          var ddIcon = sortField === c.field ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅";
          return '<th style="cursor:pointer;user-select:none;border-bottom:4px solid #7ec8e3" data-sortfield="' + c.field + '">' + c.label + '<span style="font-size:0.7rem;opacity:0.7">' + ddIcon + '</span></th>';
        }
        return '<th ' + ddStyleAttr + '>' + c.label + '</th>';
      }
      if (c.isCurrentStage) {
        var sortIcon = sortField === c.field ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅";
        var toggleIcon = showCompletionDates ? "bi-dash-circle" : "bi-plus-circle";
        var toggleTitle = showCompletionDates ? "Hide completion dates" : "Show completion dates";
        return '<th style="cursor:pointer;user-select:none;white-space:nowrap' + (showCompletionDates ? ';border-bottom:4px solid #7ec8e3' : '') + '" data-sortfield="' + c.field + '">' +
          c.label + '<span style="font-size:0.7rem;opacity:0.7">' + sortIcon + '</span>' +
          ' <i class="bi ' + toggleIcon + '" id="det-completion-toggle" title="' + toggleTitle + '" style="font-size:0.8rem;opacity:0.7;cursor:pointer;vertical-align:middle" onclick="event.stopPropagation()"></i></th>';
      }
      if (c.isBookingDate) {
        var bdSortIcon    = sortField === c.field ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅";
        var bdToggleIcon  = showDealDetails ? "bi-dash-circle" : "bi-plus-circle";
        var bdToggleTitle = showDealDetails ? "Hide Deal ID, Booking PO Number, Net Booking & Subscription ID" : "Show Deal ID, Booking PO Number, Net Booking & Subscription ID";
        return '<th style="white-space:nowrap;cursor:pointer;user-select:none' + (showDealDetails ? ';border-bottom:4px solid #7ec8e3' : '') + '" data-sortfield="' + c.field + '">' +
          c.label + '<span style="font-size:0.7rem;opacity:0.7">' + bdSortIcon + '</span>' +
          ' <i class="bi ' + bdToggleIcon + '" id="det-dealdetails-toggle" title="' + bdToggleTitle + '" style="font-size:0.8rem;opacity:0.7;cursor:pointer;vertical-align:middle" onclick="event.stopPropagation()"></i></th>';
      }
      if (c.isPotentialIncentives) {
        var piSortIcon    = sortField === c.field ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅";
        var piToggleIcon  = showStageIncentives ? "bi-dash-circle" : "bi-plus-circle";
        var piToggleTitle = showStageIncentives ? "Hide stage incentive breakdown" : "Show stage incentive breakdown";
        return '<th style="cursor:pointer;user-select:none' + (showStageIncentives ? ';border-bottom:4px solid #7ec8e3' : '') + '" data-sortfield="' + c.field + '">' +
          c.label + '<span style="font-size:0.7rem;opacity:0.7">' + piSortIcon + '</span>' +
          ' <i class="bi ' + piToggleIcon + '" id="det-stageincentives-toggle" title="' + piToggleTitle + '" style="font-size:0.8rem;opacity:0.7;cursor:pointer;vertical-align:middle" onclick="event.stopPropagation()"></i></th>';
      }
      if (sortableCols[c.field]) {
        var icon = sortField === c.field ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅";
        if (!styleAttr) styleAttr = 'style="cursor:pointer;user-select:none"';
        return '<th ' + styleAttr + ' data-sortfield="' + c.field + '">' + c.label + '<span style="font-size:0.7rem;opacity:0.7">' + icon + '</span></th>';
      }
      return '<th' + (styleAttr ? ' ' + styleAttr : '') + '>' + c.label + '</th>';
    }).join("") + "</tr></thead>";

    var stageRisk= { Purchase:"risk-high", Onboard:"risk-high", Implement:"risk-medium", Use:"risk-medium", Engage:"risk-low", Adopt:"risk-low", Completed:"risk-low" };

    var tbody = "<tbody>";
    if (pageRows.length === 0) {
      tbody += '<tr><td colspan="' + cols.length + '" class="text-center text-muted py-4">No data matching current filters.</td></tr>';
    } else {
      pageRows.forEach(function (r) {
        var expiryObj = toDate(r["Deal Incentive Expiry Date"]);
        var isExpiredRow = expiryObj && expiryObj < today;
        var riskClass    = stageRisk[r["Current stage"]] || "";
        var _wsIdRow     = String(r["Deal WS-ID"] || "");
        var _exclRow     = ANNOTATIONS.isExcluded(_wsIdRow);
        tbody += '<tr class="' + riskClass + (_exclRow ? " row-excluded" : "") + '">';
        cols.forEach(function (c) {
          var val = r[c.field];
          var cell = "";
          if (c.isCurrency) {
            cell = fmtCurrency(val);
          } else if (c.isRemainingIncentive) {
            var _norm = function(x) { return x === null || x === undefined ? "" : String(x).replace(/\u00A0/g," ").trim().toUpperCase(); };
            var isEligible = _norm(r["Stage"]) === "ELIGIBLE";
            var isCompleted = _norm(r[c.stageFlag]) === "YES";
            cell = (isEligible && !isCompleted) ? fmtCurrency(parseFloat(r[c.stageAmt]) || 0) : "-";
            tbody += '<td>' + cell + '</td>';
            return;
          } else if (c.isExpiry) {
            var dObj = toDate(val);
            var cellStyle = "";
            if (isExpiredRow) {
              cellStyle = ' style="background:#f0f0f0;color:#999"';
            } else if (dObj) {
              var daysUntil = Math.round((dObj - today) / 86400000);
              if (daysUntil > 180)     cellStyle = ' style="background:#dff6dd"';
              else if (daysUntil > 90) cellStyle = ' style="background:#fff4ce"';
              else if (daysUntil >= 0) cellStyle = ' style="background:#ffe6e6"';
            }
            tbody += '<td' + cellStyle + '>' + fmtDate(val) + '</td>';
            return;
          } else if (c.isDate) {
            cell = '<td>' + fmtDate(val) + '</td>';
            tbody += cell;
            return;
          } else if (c.field === "CR Party Name") {
            var crNameEsc = escHtml(String(r["CR Party Name"] || ""));
            var crId  = escHtml(String(r["CR Party ID"] || ""));
            var buId  = escHtml(String(r["CX Customer BU ID"] || ""));
            var subIds = [crId ? "CR: " + crId : "", buId ? "BU: " + buId : ""].filter(Boolean).join(" &middot; ");
            cell = crNameEsc + (subIds ? '<div style="font-size:0.72rem;color:#888;margin-top:1px">' + subIds + '</div>' : '');
          } else if (c.field === "2T Partner Name") {
            var ttNameEsc = escHtml(String(r["2T Partner Name"] || ""));
            var ttGeoId   = escHtml(String(r["2T Partner BE GEO ID - (Disti Only)"] || ""));
            cell = ttNameEsc + (ttGeoId ? '<div style="font-size:0.72rem;color:#888;margin-top:1px">ID: ' + ttGeoId + '</div>' : '');
          } else if (c.isWsId) {
            var wsid = val ? String(val) : "";
            cell = wsid ? '<a href="https://app.workspan.com/wsid/' + escHtml(wsid) + '" target="_blank" rel="noopener">' + escHtml(wsid) + '</a>' : '';
          } else if (c.isStatus) {
            var icons = [];
            if (norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN")
              icons.push('<i class="bi bi-hand-thumbs-up-fill" style="color:#0070d2" title="Opted In"></i>');
            var stg2 = norm(r["Stage"]);
            if (r["Earned?"] === true)
              icons.push('<i class="bi bi-currency-dollar fw-bold" style="color:#000" title="Earned"></i>');
            if      (stg2 === "ELIGIBLE") icons.push('<i class="bi bi-check-circle-fill" style="color:#107C10" title="Eligible"></i>');
            else if (stg2 === "EXPIRED")  icons.push('<i class="bi bi-clock" style="color:#888" title="Expired"></i>');
            else if (r["Earned?"] !== true) icons.push('<i class="bi bi-x-circle-fill" style="color:#D13438" title="Not Eligible"></i>');
            cell = '<span style="white-space:nowrap">' + icons.join(" ") + '</span>';
          } else if (c.isAnnot) {
            var _wsId2    = String(r["Deal WS-ID"] || "");
            var _annot    = annotationsCache[_wsId2] || { tags: [], comment: "" };
            var _tagHtml  = (_annot.tags || []).map(function (t) {
              var _tc = ANNOTATIONS.tagColor(t);
              var _bs = _tc ? ' style="background:' + _tc.bg + ';color:' + _tc.color + ';border-color:' + _tc.border + '"' : '';
              return '<span class="annot-tag"' + _bs + '>' + escHtml(t) + '</span>';
            }).join(" ");
            var _commentIcon = _annot.comment
              ? ' <i class="bi bi-chat-left-text-fill annot-has-comment" title="' + escHtml(_annot.comment) + '"></i>'
              : '';
            var _crName    = String(r["CR Party Name"] || "");
            var _crPartyId = String(r["CR Party ID"] || "");
            var _excl2     = ANNOTATIONS.isExcluded(_wsId2);
            var _exclIcon  = _excl2 ? "bi-slash-circle-fill text-danger" : "bi-slash-circle text-muted";
            var _exclTitle = _excl2 ? "Re-include deal" : "Exclude deal";
            cell = '<div class="annot-cell">' + _tagHtml + _commentIcon +
              '<button class="btn btn-link btn-sm p-0 ms-1 annot-excl-btn" style="font-size:0.8rem;vertical-align:middle" ' +
              'data-wsid="' + escHtml(_wsId2) + '" title="' + _exclTitle + '">' +
              '<i class="bi ' + _exclIcon + '"></i></button>' +
              '<button class="btn btn-link btn-sm p-0 ms-1 annot-edit-btn" style="font-size:0.75rem;vertical-align:middle" ' +
              'data-wsid="' + escHtml(_wsId2) + '" data-crname="' + escHtml(_crName) + '" data-crpartyid="' + escHtml(_crPartyId) + '" title="Edit notes &amp; tags">' +
              '<i class="bi bi-pencil-square"></i></button></div>';
          } else if (c.field === "Current stage") {
            cell = '<span class="stage-badge stage-' + escHtml(val) + '">' + escHtml(val) + '</span>';
          } else if (c.field === "Days in stage") {
            var days = val !== null && val !== undefined ? parseInt(val) : null;
            var dayColor = days === null ? "" : days > 180 ? "color:#D13438" : days > 90 ? "color:#FF8C00" : "color:#107C10";
            tbody += '<td style="font-weight:600;' + dayColor + '">' + (days !== null ? days : "-") + '</td>';
            return;
          } else if (c.field === "_daysSinceOptIn") {
            var _norm3 = function(x) { return x === null || x === undefined ? "" : String(x).replace(/\u00A0/g," ").trim().toUpperCase(); };
            var isOptInEligible = (_norm3(r["Stage"]) === "ELIGIBLE" || _norm3(r["Stage"]) === "EXPIRED") && toDate(r["Adopt Rebate Start Date"]);
            if (isOptInEligible) {
              var daysInStage = parseInt(r["Days in stage"]) || 0;
              var daysSinceOptIn = Math.floor((today - toDate(r["Adopt Rebate Start Date"])) / 86400000);
              var optDays = daysInStage <= daysSinceOptIn ? daysInStage : daysSinceOptIn;
              var optColor = optDays > 180 ? "color:#D13438" : optDays > 90 ? "color:#FF8C00" : "color:#107C10";
              tbody += '<td style="font-weight:600;' + optColor + '">' + optDays + '</td>';
            } else {
              tbody += '<td style="color:#aaa">-</td>';
            }
            return;
          } else if (c.field === "Current Stage Progress") {
            var parts = val ? String(val).split("/") : [];
            var x = parseInt(parts[0]), y = parseInt(parts[1]);
            if (!isNaN(x) && !isNaN(y) && y > 0) {
              var pct = Math.round((x / y) * 100);
              cell = '<div style="min-width:80px">' +
                '<div class="progress" style="height:8px;margin-bottom:2px">' +
                '<div class="progress-bar" style="width:' + pct + '%;background:var(--cisco-blue)"></div>' +
                '</div>' +
                '<span style="font-size:0.75rem">' + x + '/' + y + '</span>' +
                '</div>';
            } else {
              cell = "";
            }
          } else if (c.field === "Overall Progress") {
            var opParts = val ? String(val).split("/") : [];
            var opX = parseInt(opParts[0]), opY = parseInt(opParts[1]);
            if (!isNaN(opX) && !isNaN(opY) && opY > 0) {
              var opPct = Math.round((opX / opY) * 100);
              cell = '<div style="min-width:80px">' +
                '<div class="progress" style="height:8px;margin-bottom:2px">' +
                '<div class="progress-bar" style="width:' + opPct + '%;background:var(--cisco-blue)"></div>' +
                '</div>' +
                '<span style="font-size:0.75rem">' + opX + '/' + opY + '</span>' +
                '</div>';
            } else {
              cell = "";
            }
          } else if (c.field === "Sub-Track") {
            var PORTFOLIO_ABBR = { "NETWORKING": "NET", "SECURITY": "SEC", "CLOUD + AI INFRASTRUCTURE": "CAI", "COLLABORATION": "COL" };
            var pf2 = String(r["Deal CPI Portfolio"] || "").trim();
            var pfAbbr = PORTFOLIO_ABBR[pf2.toUpperCase()] || pf2;
            var offer2 = String(r["Track"] || "").trim();
            var subLine = [pfAbbr, offer2].filter(Boolean).join(" - ");
            var ucName2 = escHtml(val);
            var ucUrl2 = val ? UC_GUIDE_MAP[String(val).trim()] : null;
            var ucCritImg = val ? UC_CRITERIA_MAP[String(val).trim()] : null;
            var ucLink = ucUrl2 ? '<a href="' + ucUrl2 + '" target="_blank" rel="noopener">' + ucName2 + '</a>' : ucName2;
            if (ucCritImg) {
              ucLink = '<span class="uc-criteria-trigger" data-criteria="' + escHtml(ucCritImg) + '" title="Hover to see exit criteria">' + ucLink + '</span>';
            }
            cell = ucLink + (subLine ? '<div style="font-size:0.72rem;color:#888;margin-top:1px">' + escHtml(subLine) + '</div>' : '');
          } else if (c.field === "_missedStages") {
            var optInDate = toDate(r["Adopt Rebate Start Date"]);
            var msParts = [];
            [{ name: "Onboard", f: "Stage Completion Date(onboard)" },
             { name: "Use",     f: "Stage Completion Date(Use)" },
             { name: "Engage",  f: "Stage Completion Date(Engage)" },
             { name: "Adopt",   f: "Stage Completion Date(Adopt)" }].forEach(function (s) {
              var cd = toDate(r[s.f]);
              if (cd && optInDate && cd < optInDate) msParts.push(s.name);
            });
            if (msParts.length === 0) {
              tbody += '<td class="text-muted">N/A</td>';
            } else {
              tbody += '<td><span class="text-danger fw-semibold">' + msParts.join(", ") + '</span></td>';
            }
            return;
          } else {
            cell = escHtml(val);
          }
          tbody += '<td>' + cell + '</td>';
        });
        tbody += "</tr>";
      });
    }
    tbody += "</tbody>";

    var tableHtml = '<div class="table-wrapper"><table class="table table-sm table-bordered mb-0">' + thead + tbody + '</table></div>';
    document.getElementById("det-table-area").innerHTML = tableHtml;

    // Deal details toggle
    var dealToggleEl = document.getElementById("det-dealdetails-toggle");
    if (dealToggleEl) {
      dealToggleEl.addEventListener("click", function () {
        showDealDetails = !showDealDetails;
        applyFiltersAndRender();
      });
    }

    // Stage incentives toggle
    var stageIncentivesToggleEl = document.getElementById("det-stageincentives-toggle");
    if (stageIncentivesToggleEl) {
      stageIncentivesToggleEl.addEventListener("click", function () {
        showStageIncentives = !showStageIncentives;
        applyFiltersAndRender();
      });
    }

    // Overall progress toggle
    var overallProgressToggleEl = document.getElementById("det-overallprogress-toggle");
    if (overallProgressToggleEl) {
      overallProgressToggleEl.addEventListener("click", function () {
        showOverallProgress = !showOverallProgress;
        applyFiltersAndRender();
      });
    }

    // Days since opt-in toggle
    var daysOptInToggleEl = document.getElementById("det-daysoptIn-toggle");
    if (daysOptInToggleEl) {
      daysOptInToggleEl.addEventListener("click", function () {
        showDaysSinceOptIn = !showDaysSinceOptIn;
        applyFiltersAndRender();
      });
    }

    // Completion dates toggle
    var toggleEl = document.getElementById("det-completion-toggle");
    if (toggleEl) {
      toggleEl.addEventListener("click", function () {
        showCompletionDates = !showCompletionDates;
        applyFiltersAndRender();
      });
    }

    // Sort on header click
    document.getElementById("det-table-area").querySelectorAll("th[data-sortfield]").forEach(function (th) {
      th.addEventListener("click", function () {
        var field = th.dataset.sortfield;
        if (sortField === field) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortField = field;
          var descByDefault = { "Potential Incentives": true, "Missed Incentives": true, "Estimated Earned Incentives": true };
          sortDir = descByDefault[field] ? "desc" : "asc";
        }
        currentPage = 1;
        applySort();
        renderTable();
        // Persist sort so it survives tab switching
        if (window.APP_FILTER_STATE && window.APP_FILTER_STATE.details) {
          window.APP_FILTER_STATE.details.sortField = sortField;
          window.APP_FILTER_STATE.details.sortDir   = sortDir;
        }
      });
    });

    // Wire annotation edit buttons
    document.getElementById("det-table-area").querySelectorAll(".annot-edit-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        openAnnotationModal(btn.dataset.wsid, btn.dataset.crname, btn.dataset.crpartyid);
      });
    });

    // Wire annotation exclude-toggle buttons
    document.getElementById("det-table-area").querySelectorAll(".annot-excl-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var wsid = btn.dataset.wsid;
        ANNOTATIONS.setExcluded(wsid, !ANNOTATIONS.isExcluded(wsid)).then(function () {
          applyFiltersAndRender();
        });
      });
    });

    // Pagination
    var pgHtml = '<nav><ul class="pagination pagination-sm mb-0">';
    pgHtml += '<li class="page-item' + (currentPage===1?" disabled":"") + '"><a class="page-link" href="#" data-page="' + (currentPage-1) + '">&laquo;</a></li>';
    var startP = Math.max(1, currentPage - 2);
    var endP   = Math.min(totalPages, currentPage + 2);
    if (startP > 1)          pgHtml += '<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>' + (startP > 2 ? '<li class="page-item disabled"><span class="page-link">…</span></li>' : '');
    for (var p = startP; p <= endP; p++) {
      pgHtml += '<li class="page-item' + (p===currentPage?" active":"") + '"><a class="page-link" href="#" data-page="' + p + '">' + p + '</a></li>';
    }
    if (endP < totalPages)   pgHtml += (endP < totalPages - 1 ? '<li class="page-item disabled"><span class="page-link">…</span></li>' : '') + '<li class="page-item"><a class="page-link" href="#" data-page="' + totalPages + '">' + totalPages + '</a></li>';
    pgHtml += '<li class="page-item' + (currentPage===totalPages||totalPages===0?" disabled":"") + '"><a class="page-link" href="#" data-page="' + (currentPage+1) + '">&raquo;</a></li>';
    pgHtml += '</ul></nav>';
    pgHtml += '<small class="text-muted ms-2">' + filteredData.length + ' rows</small>';
    document.getElementById("det-pagination").innerHTML = pgHtml;

    document.getElementById("det-pagination").querySelectorAll("a.page-link").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var p = parseInt(a.dataset.page);
        if (p >= 1 && p <= totalPages) { currentPage = p; renderTable(); }
      });
    });
  }

  function getChecked(groupId) {
    var result = [];
    var container = document.getElementById(groupId);
    if (!container) return result;
    container.querySelectorAll('input[type=checkbox]:checked').forEach(function (cb) { result.push(cb.value); });
    return result;
  }

  function makeCheckboxGroup(label, id, options, optionTips, labelHtmlFn) {
    var html = '<div class="filter-group"><label class="group-label">' + label + '</label><div id="' + id + '">';
    options.forEach(function (o) {
      var safeid = id + '-' + escHtml(o).replace(/\s+/g,"-");
      var tipText = optionTips && (optionTips[o] || optionTips[o.toUpperCase()] || optionTips[o.toLowerCase()]);
      var tipHtml = tipText
        ? ' <i class="bi bi-info-circle text-muted" style="font-size:0.72rem;cursor:default" data-bs-toggle="tooltip" data-bs-placement="right" title="' + tipText.replace(/"/g,"&quot;") + '"></i>'
        : '';
      var labelContent = labelHtmlFn ? labelHtmlFn(o) : escHtml(o);
      html += '<div class="form-check form-check-sm"><input class="form-check-input" type="checkbox" value="' + escHtml(o) + '" id="' + safeid + '">' +
              '<label class="form-check-label" for="' + safeid + '">' + labelContent + tipHtml + '</label></div>';
    });
    html += "</div></div>";
    return html;
  }

  function makeDropdown(id, options) {
    var html = '<select id="' + id + '" class="form-select form-select-sm"><option value="">All</option>';
    options.forEach(function (o) { html += '<option value="' + escHtml(o) + '">' + escHtml(o) + '</option>'; });
    return html + "</select>";
  }

  function makeDateSlider(prefix, bounds) {
    if (!bounds || !bounds.min || !bounds.max) {
      return '<div class="text-muted small fst-italic">No date data</div>';
    }
    var minDay = epochDay(bounds.min), maxDay = epochDay(bounds.max);
    return '<div class="date-slider-group">' +
      '<div class="slider-val-display">' +
      '<span id="' + prefix + '-from-lbl">' + bounds.min.toLocaleDateString(window.APP_LOCALE) + '</span>' +
      '<span id="' + prefix + '-to-lbl">'   + bounds.max.toLocaleDateString(window.APP_LOCALE) + '</span>' +
      '</div>' +
      '<div class="dual-range-wrap">' +
      '<div class="dual-range-track"></div>' +
      '<div class="dual-range-fill" id="' + prefix + '-fill"></div>' +
      '<input type="range" class="range-from" id="' + prefix + '-from" min="' + minDay + '" max="' + maxDay + '" value="' + minDay + '" step="1">' +
      '<input type="range" class="range-to"   id="' + prefix + '-to"   min="' + minDay + '" max="' + maxDay + '" value="' + maxDay + '" step="1">' +
      '</div></div>';
  }

  function stageBadgeHtml(name) {
    return '<span class="stage-badge stage-' + escHtml(name) + '">' + escHtml(name) + '</span>';
  }

  function makeStageRangeSlider(prefix, options) {
    var maxIdx = Math.max(0, options.length - 1);
    return '<div class="date-slider-group">' +
      '<div class="slider-val-display">' +
      '<span id="' + prefix + '-from-lbl">' + stageBadgeHtml(options[0] || "") + '</span>' +
      '<span id="' + prefix + '-to-lbl">'   + stageBadgeHtml(options[maxIdx] || "") + '</span>' +
      '</div>' +
      '<div class="dual-range-wrap">' +
      '<div class="dual-range-track"></div>' +
      '<div class="dual-range-fill" id="' + prefix + '-fill"></div>' +
      '<input type="range" class="range-from" id="' + prefix + '-from" min="0" max="' + maxIdx + '" value="0"       step="1">' +
      '<input type="range" class="range-to"   id="' + prefix + '-to"   min="0" max="' + maxIdx + '" value="' + maxIdx + '" step="1">' +
      '</div></div>';
  }

  // ── Export Details to XLSX ──────────────────────────────────────────────────
  function exportDetailsToXlsx(rows) {
    var btn = document.getElementById("det-export-btn");
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Exporting…'; }

    setTimeout(function () {
      try {
        var today = new Date();
        var XLS = (typeof XLSXStyle !== "undefined") ? XLSXStyle : XLSX;
        var s = calcSummary(rows);

        // Collect active filter labels
        var activeFilters = [];
        var crVal = document.getElementById("filter-crparty") ? document.getElementById("filter-crparty").value.trim() : "";
        if (crVal) activeFilters.push("Customer/Deal: " + crVal);
        var ttVal = document.getElementById("filter-2tpartner") ? document.getElementById("filter-2tpartner").value.trim() : "";
        if (ttVal) activeFilters.push("2T Partner: " + ttVal);
        var pfVal = document.getElementById("filter-portfolio") ? document.getElementById("filter-portfolio").value : "";
        if (pfVal) activeFilters.push("Portfolio: " + pfVal);
        var ofVal = document.getElementById("filter-offer") ? document.getElementById("filter-offer").value : "";
        if (ofVal) activeFilters.push("Offer: " + ofVal);
        var ucVal2 = document.getElementById("filter-uc") ? document.getElementById("filter-uc").value : "";
        if (ucVal2) activeFilters.push("Use Case: " + ucVal2);
        var _ctryExEl = document.getElementById("filter-country");
        if (_ctryExEl) { Array.from(_ctryExEl.selectedOptions).forEach(function(o){ activeFilters.push("Country: " + o.value); }); }
        getChecked("filter-stage").forEach(function(v) { activeFilters.push("Stage: " + v); });
        getChecked("filter-optin").forEach(function(v) { activeFilters.push("Opt-In: " + v); });
        if (document.getElementById("filter-new-eligible") && document.getElementById("filter-new-eligible").checked) activeFilters.push("New Eligible");
        if (document.getElementById("filter-expires-soon") && document.getElementById("filter-expires-soon").checked) activeFilters.push("Expires Soon (<1M)");
        if (document.getElementById("filter-earned")       && document.getElementById("filter-earned").checked)       activeFilters.push("Earned");
        if (document.getElementById("filter-ea")           && document.getElementById("filter-ea").checked)           activeFilters.push("EA");
        if (document.getElementById("filter-aap")           && document.getElementById("filter-aap").checked)           activeFilters.push("AAP");
        if (document.getElementById("filter-max-incentive") && document.getElementById("filter-max-incentive").checked) activeFilters.push("Max Incentive");

        // Build sheet rows array
        var sheetData = [];

        // Summary block (rows 0-2)
        sheetData.push(["Customers", s.customers,   "", "Total Missed",           "$" + Math.round(s.missed).toLocaleString()]);
        sheetData.push(["Use Cases", s.useCases,     "", "Total Potential",        "$" + Math.round(s.potential).toLocaleString()]);
        sheetData.push(["",          "",              "", "Total Estimated Earned", "$" + Math.round(s.earned).toLocaleString()]);

        // Active filters — label in row 3, values in row 4, blank in row 5
        sheetData.push(["Active Filters"]);
        sheetData.push([activeFilters.length > 0 ? activeFilters.join("  |  ") : "None"]);
        sheetData.push([]);

        // Column definitions
        var has2T = data.some(function(r){ return r["2T Partner Name"] && String(r["2T Partner Name"]).trim() !== ""; });
        var colDefs = [
          ...(has2T ? [{ label:"2T Partner Name", field:"2T Partner Name" }] : []),
          { label:"CR Party Name",           field:"CR Party Name" },
          { label:"CR Party ID",             field:"CR Party ID" },
          { label:"CX Customer BU ID",       field:"CX Customer BU ID" },
          { label:"End Customer Country",    field:"End Customer Country" },
          { label:"Portfolio",               field:"Deal CPI Portfolio" },
          { label:"Offer",                   field:"Track" },
          { label:"Use Case",                field:"Sub-Track" },
          { label:"Current Stage",           field:"Current stage" },
          { label:"Onboard Completion",      field:"Stage Completion Date(onboard)", isDate:true },
          { label:"Use Completion",          field:"Stage Completion Date(Use)",     isDate:true },
          { label:"Engage Completion",       field:"Stage Completion Date(Engage)",  isDate:true },
          { label:"Adopt Completion",        field:"Stage Completion Date(Adopt)",   isDate:true },
          { label:"Stages Completed Before Opt-in", field:"_missedStages" },
          { label:"Days in Stage",           field:"Days in stage" },
          { label:"Days Since Opt-in",       field:"_daysSinceOptIn", isDaysSinceOptInExport: true },
          { label:"Stage Progress",          field:"Current Stage Progress" },
          { label:"Overall Progress",        field:"Overall Progress" },
          { label:"Pending Tasks",           field:"Current stage pending tasks" },
          { label:"Booking Date",            field:"Booking Date",                isDate:true },
          { label:"Deal ID",                 field:"Deal ID" },
          { label:"Booking PO Number",       field:"Booking PO Number" },
          { label:"Net Booking",             field:"Booking Amount - Net to Cisco", isCurrency:true },
          { label:"Subscription ID",         field:"Subscription ID" },
          { label:"Opt-in Date",             field:"Adopt Rebate Start Date",     isDate:true },
          { label:"Expiry Date",             field:"Deal Incentive Expiry Date",  isDate:true },
          { label:"Missed Incentives",       field:"Missed Incentives",           isCurrency:true },
          { label:"Potential Incentives",    field:"Potential Incentives",        isCurrency:true },
          { label:"Remaining Onboard Incentive",  isRemainingIncentive:true, stageFlag:"Stage Completion Flag(onboard)", stageAmt:"Estimated Incentive Amount(Onboard)" },
          { label:"Remaining Use Incentive",      isRemainingIncentive:true, stageFlag:"Stage Completion Flag(Use)",     stageAmt:"Estimated Incentive Amount(Use)"     },
          { label:"Remaining Engage Incentive",   isRemainingIncentive:true, stageFlag:"Stage Completion Flag(Engage)",  stageAmt:"Estimated Incentive Amount(Engage)"  },
          { label:"Remaining Adopt Incentive",    isRemainingIncentive:true, stageFlag:"Stage Completion Flag(Adopt)",   stageAmt:"Estimated Incentive Amount(Adopt)"   },
          { label:"Est. Earned Incentives",  field:"Estimated Earned Incentives", isCurrency:true },
          { label:"Deal WS-ID",              field:"Deal WS-ID" },
          { label:"Opt-In Status",           field:"Adopt Rebate Opt-In Status" },
          { label:"Stage",                   field:"Stage" },
          { label:"Earned?",                 field:"Earned?" },
          { label:"Tags",                    field:"_annotTags",    isAnnotTags: true },
          { label:"Comment",                 field:"_annotComment", isAnnotComment: true },
          { label:"Excluded",                field:"_annotExcl",    isAnnotExcl: true }
        ];

        var headerRow = colDefs.map(function(c){ return c.label; });
        sheetData.push(headerRow);
        var headerRowIdx = sheetData.length - 1;

        rows.forEach(function(r) {
          var row = colDefs.map(function(c) {
            var v = r[c.field];
            if (c.isCurrency) return (v === null || v === undefined || isNaN(v)) ? 0 : Math.round(v);
            if (c.isRemainingIncentive) {
              var _norm2 = function(x) { return x === null || x === undefined ? "" : String(x).replace(/\u00A0/g," ").trim().toUpperCase(); };
              var _eligible = _norm2(r["Stage"]) === "ELIGIBLE";
              var _completed = _norm2(r[c.stageFlag]) === "YES";
              return (_eligible && !_completed) ? (Math.round(parseFloat(r[c.stageAmt]) || 0)) : 0;
            }
            if (c.isDaysSinceOptInExport) {
              var _norm5 = function(x) { return x === null || x === undefined ? "" : String(x).replace(/\u00A0/g," ").trim().toUpperCase(); };
              var _optDate = toDate(r["Adopt Rebate Start Date"]);
              if ((_norm5(r["Stage"]) === "ELIGIBLE" || _norm5(r["Stage"]) === "EXPIRED") && _optDate) {
                var _dis = parseInt(r["Days in stage"]) || 0;
                var _dso = Math.floor((today - _optDate) / 86400000);
                return _dis <= _dso ? _dis : _dso;
              }
              return "";
            }
            if (c.field === "Earned?") return v === true ? "Yes" : "No";
            if (c.isAnnotTags) {
              var _wsIdEx = String(r["Deal WS-ID"] || "");
              var _annotEx = annotationsCache[_wsIdEx];
              return _annotEx && _annotEx.tags && _annotEx.tags.length ? _annotEx.tags.join(", ") : "";
            }
            if (c.isAnnotComment) {
              var _wsIdCm = String(r["Deal WS-ID"] || "");
              var _annotCm = annotationsCache[_wsIdCm];
              return _annotCm && _annotCm.comment ? _annotCm.comment : "";
            }
            if (c.isAnnotExcl) {
              return ANNOTATIONS.isExcluded(String(r["Deal WS-ID"] || "")) ? "Yes" : "";
            }
            if (c.field === "_missedStages") {
              var optInDate = toDate(r["Adopt Rebate Start Date"]);
              var msParts = [];
              [{ name: "Onboard", f: "Stage Completion Date(onboard)" },
               { name: "Use",     f: "Stage Completion Date(Use)" },
               { name: "Engage",  f: "Stage Completion Date(Engage)" },
               { name: "Adopt",   f: "Stage Completion Date(Adopt)" }].forEach(function (s) {
                var cd = toDate(r[s.f]);
                if (cd && optInDate && cd < optInDate) msParts.push(s.name);
              });
              return msParts.length ? msParts.join(", ") : "N/A";
            }
            return (v === null || v === undefined) ? "" : String(v);
          });
          sheetData.push(row);
        });

        var wb = XLS.utils.book_new();
        var ws = XLS.utils.aoa_to_sheet(sheetData);

        // Column widths
        ws["!cols"] = colDefs.map(function(c) {
          if (c.isCurrency || c.isRemainingIncentive) return { wch: 22 };
          if (c.field === "CR Party Name" || c.field === "2T Partner Name") return { wch: 35 };
          if (c.field === "Deal WS-ID" || c.field === "Track") return { wch: 22 };
          if (c.field === "_missedStages") return { wch: 30 };
          if (c.isAnnotTags)    return { wch: 30 };
          if (c.isAnnotComment) return { wch: 50 };
          if (c.isAnnotExcl)    return { wch: 10 };
          return { wch: 16 };
        });

        // Summary label/value styles
        var summaryLabelStyle = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: "E8F0FD" }, patternType: "solid" } };
        var summaryValStyle   = { font: { sz: 10 }, alignment: { horizontal: "right" } };
        [[0,0],[0,3],[1,0],[1,3],[2,3]].forEach(function(rc) {
          var addr = XLS.utils.encode_cell({ r: rc[0], c: rc[1] });
          if (ws[addr]) ws[addr].s = summaryLabelStyle;
        });
        [[0,1],[0,4],[1,1],[1,4],[2,4]].forEach(function(rc) {
          var addr = XLS.utils.encode_cell({ r: rc[0], c: rc[1] });
          if (ws[addr]) ws[addr].s = summaryValStyle;
        });
        var filterLabelAddr = XLS.utils.encode_cell({ r: 3, c: 0 });
        if (ws[filterLabelAddr]) ws[filterLabelAddr].s = summaryLabelStyle;
        var filterAddr = XLS.utils.encode_cell({ r: 4, c: 0 });
        if (ws[filterAddr]) ws[filterAddr].s = { font: { italic: true, sz: 9, color: { rgb: "666666" } } };

        // Header row style
        var hdrFont = { bold: true, color: { rgb: "FFFFFF" }, sz: 10 };
        var hdrFill = { fgColor: { rgb: "1B5FAD" }, patternType: "solid" };
        headerRow.forEach(function(lbl, ci) {
          var addr = XLS.utils.encode_cell({ r: headerRowIdx, c: ci });
          if (!ws[addr]) ws[addr] = { v: lbl, t: "s" };
          ws[addr].s = { font: hdrFont, fill: hdrFill, alignment: { horizontal: "center", wrapText: true } };
        });

        // Data rows — alternate shading + currency number format
        rows.forEach(function(_, ri) {
          var wsRow = headerRowIdx + 1 + ri;
          var fillColor = ri % 2 === 0 ? "FFFFFF" : "F5F8FF";
          colDefs.forEach(function(c, ci) {
            var addr = XLS.utils.encode_cell({ r: wsRow, c: ci });
            if (!ws[addr]) ws[addr] = { v: "", t: "s" };
            ws[addr].s = { fill: { fgColor: { rgb: fillColor }, patternType: "solid" }, font: { sz: 9 } };
            if (c.isCurrency && ws[addr].t === "n") {
              ws[addr].z = '"$"#,##0';
              ws[addr].s.alignment = { horizontal: "right" };
            }
          });
        });

        // Row heights
        ws["!rows"] = sheetData.map(function(_, ri) {
          return ri === headerRowIdx ? { hpt: 30 } : { hpt: 18 };
        });

        // Filename
        var beGeoStr = Array.from(new Set(data.map(function(r){ return String(r["BE GEO ID"]||""); }).filter(Boolean))).join("-") || "export";
        var dateStr = new Date().toLocaleDateString(window.APP_LOCALE, { year:"numeric", month:"2-digit", day:"2-digit" })
          .replace(/\//g,"-").replace(/\./g,"-");
        XLS.utils.book_append_sheet(wb, ws, "Details");
        XLS.writeFile(wb, "AdoptDash_Details_" + beGeoStr + "_" + dateStr + ".xlsx");
      } catch(err) {
        alert("Export failed: " + err.message);
        console.error(err);
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-file-earmark-excel me-1"></i>Export to Excel'; }
      }
    }, 50);
  }
}

window.renderDetails = renderDetails;

// ── Criteria image popup (event delegation, set up once) ──────────────────
(function () {
  var popup = document.createElement("div");
  popup.id = "uc-criteria-popup";
  popup.innerHTML = '<img id="uc-criteria-img" src="" alt="Exit Criteria" />' +
    '<div id="uc-criteria-label"></div>';
  document.body.appendChild(popup);

  var hideTimer;
  var dragging = false, dragOffX = 0, dragOffY = 0;
  var zoomLevel = 2.7;   // default zoom when hovering
  var isHovered = false;

  function applyZoom() {
    popup.style.transform = isHovered ? "scale(" + zoomLevel + ")" : "scale(1)";
  }

  function showPopup(trigger) {
    clearTimeout(hideTimer);
    var imgSrc = trigger.getAttribute("data-criteria");
    if (!imgSrc) return;

    var img = document.getElementById("uc-criteria-img");
    img.src = imgSrc;

    popup.style.display = "block";

    var rect = trigger.getBoundingClientRect();
    var popupW = 420;
    var gap = 8;
    var left = rect.right + gap;
    if (left + popupW > window.innerWidth - 8) left = rect.left - popupW - gap;
    if (left < 8) left = 8;
    var top = Math.max(8, Math.min(rect.top, window.innerHeight - 50));

    popup.style.left = left + "px";
    popup.style.top  = top + "px";
  }

  function hidePopup() {
    hideTimer = setTimeout(function () {
      popup.style.display = "none";
      isHovered = false;
      popup.style.transform = "scale(1)";
    }, 80);
  }

  // Show/hide via trigger
  document.addEventListener("mouseover", function (e) {
    var trigger = e.target.closest(".uc-criteria-trigger");
    if (trigger) { showPopup(trigger); return; }
    if (e.target.closest("#uc-criteria-popup")) clearTimeout(hideTimer);
  });

  document.addEventListener("mouseout", function (e) {
    var trigger = e.target.closest(".uc-criteria-trigger");
    if (trigger) { hidePopup(); return; }
    if (e.target.closest("#uc-criteria-popup")) hidePopup();
  });

  // Zoom in/out on mouse enter/leave the popup
  popup.addEventListener("mouseenter", function () {
    clearTimeout(hideTimer);
    isHovered = true;
    applyZoom();
    popup.style.boxShadow = "0 12px 40px rgba(0,0,0,.32)";
  });

  popup.addEventListener("mouseleave", function () {
    if (dragging) return;
    isHovered = false;
    applyZoom();
    popup.style.boxShadow = "";
    hidePopup();
  });

  // Scroll wheel to adjust zoom level while hovering
  popup.addEventListener("wheel", function (e) {
    e.preventDefault();
    var delta = e.deltaY < 0 ? 0.1 : -0.1;
    zoomLevel = Math.min(5, Math.max(0.5, zoomLevel + delta));
    applyZoom();
  }, { passive: false });

  // ── Drag to move ──
  popup.addEventListener("mousedown", function (e) {
    dragging = true;
    clearTimeout(hideTimer);
    dragOffX = e.clientX - parseFloat(popup.style.left);
    dragOffY = e.clientY - parseFloat(popup.style.top);
    popup.classList.add("dragging");
    e.preventDefault();
  });

  document.addEventListener("mousemove", function (e) {
    if (!dragging) return;
    popup.style.left = (e.clientX - dragOffX) + "px";
    popup.style.top  = (e.clientY - dragOffY) + "px";
  });

  document.addEventListener("mouseup", function () {
    if (dragging) {
      dragging = false;
      popup.classList.remove("dragging");
    }
  });
}());
