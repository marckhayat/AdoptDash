// =============================================================================
// transform.js — Core data transformation (ports PQ files 01 + 02)
// =============================================================================
// Input:  rawRows  — array of plain objects from SheetJS sheet_to_json
// Output: array of enriched row objects with all computed columns
// =============================================================================

// ── Shared string sanitizer (applied to every string value before processing) ─
function sanitizeValue(v) {
  if (typeof v !== "string") return v;
  // BOM and zero-width characters
  v = v.replace(/^\uFEFF/, "");
  v = v.replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF]/g, "");
  // Smart quotes → straight quotes
  v = v.replace(/[\u2018\u2019]/g, "'");
  v = v.replace(/[\u201C\u201D]/g, '"');
  // Non-breaking and special spaces → regular space
  v = v.replace(/[\u00A0\u2002\u2003\u2009\u202F]/g, " ");
  // Control characters (tabs, carriage returns, null bytes, etc.) → space
  v = v.replace(/[\r\t\u0000-\u001F\u007F]/g, " ");
  // Collapse multiple spaces
  v = v.replace(/ {2,}/g, " ");
  return v.trim();
}

function sanitizeRow(row) {
  var out = {};
  Object.keys(row).forEach(function(k) {
    out[k] = sanitizeValue(row[k]);
  });
  return out;
}

function transformData(rawRows) {

  // ── Helpers ──────────────────────────────────────────────────────────────

  // Normalize text: trim, remove non-breaking spaces, uppercase
  function norm(x) {
    if (x === null || x === undefined) return "";
    return String(x).replace(/\u00A0/g, " ").trim().toUpperCase();
  }

  // Safe bool: handles "TRUE"/"YES"/"1"/true
  function safeBool(x) {
    if (x === null || x === undefined) return false;
    if (typeof x === "boolean") return x;
    var s = norm(x);
    return s === "TRUE" || s === "YES" || s === "1";
  }

  // Safe number: parse float, default 0
  function safeNum(x) {
    if (x === null || x === undefined) return 0;
    var n = parseFloat(x);
    return isNaN(n) ? 0 : n;
  }

  // Convert to JS Date from Excel serial, string, or Date
  function toDate(x) {
    if (x === null || x === undefined) return null;
    if (x instanceof Date) return isNaN(x.getTime()) ? null : x;
    if (typeof x === "number" && x > 1000) {
      // Excel serial number
      var d = new Date(Math.round((x - 25569) * 86400 * 1000));
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof x === "string" && x.trim() !== "") {
      var d2 = new Date(x);
      return isNaN(d2.getTime()) ? null : d2;
    }
    return null;
  }

  // Date comparisons (both args must be non-null)
  function dateGTE(a, b) {
    var da = toDate(a), db = toDate(b);
    return da !== null && db !== null && da.getTime() >= db.getTime();
  }
  function dateLT(a, b) {
    var da = toDate(a), db = toDate(b);
    return da !== null && db !== null && da.getTime() < db.getTime();
  }

  function dateLTE(a, b) {
    var da = toDate(a), db = toDate(b);
    return da !== null && db !== null && da.getTime() <= db.getTime();
  }

  // Parse Task Details text → pending tasks string or null
  function getPendingTasks(text) {
    if (!text || typeof text !== "string" || text.trim() === "") return null;
    var temp = text.replace(/ - Y/g, " - Y|~|").replace(/ - N/g, " - N|~|");
    var tasks = temp.split("|~|");
    var pending = tasks.filter(function (t) {
      return t.trim().endsWith(" - N");
    });
    var result = pending.map(function (t) { return t.trim(); }).join("; ");
    return result === "" ? null : result;
  }

  // Count occurrences of a substring in a string
  function countOccurrences(str, sub) {
    if (!str || !sub) return 0;
    return str.split(sub).length - 1;
  }

  // Stage progress: "completedCount/totalCount"
  function calcProgress(text) {
    if (!text || typeof text !== "string") return "0/0";
    var y = countOccurrences(text, " - Y");
    var n = countOccurrences(text, " - N");
    var total = y + n;
    return total === 0 ? "0/0" : y + "/" + total;
  }

  // ── Pre-pass: build Set of opted-in CRPartyID-Offer keys (Step 10) ──────
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var optedInKeys = new Set();
  rawRows.forEach(function (r) {
    var key = String(r["CR Party ID"] || "") + String(r["Track"] || "");
    if (norm(r["Adopt Rebate Opt-In Status"]) === "OPTED IN") {
      optedInKeys.add(key);
    }
  });

  // ── Get 18-FM-ago start (for Steps 19–24) ────────────────────────────────
  var month18AgoStart = get18MonthAgoStart(); // from fiscal.js

  // ── One-time: detect AAP column name ─────────────────────────────────────
  var aapColumnKey = null;
  if (rawRows.length > 0) {
    var aapMatches = Object.keys(rawRows[0]).filter(function(k) {
      return k.replace(/\s+/g, " ").trim().toLowerCase().indexOf("adoption accountability planning") !== -1;
    });
    if (aapMatches.length) aapColumnKey = aapMatches[0];
  }

  // ── One-time: detect Disti mode and map column keys ─────────────────────
  var distiColKey = null;
  var twoTColKey  = null;
  if (rawRows.length > 0) {
    var keys = Object.keys(rawRows[0]);
    distiColKey = keys.find(function(k) { return k.trim().toLowerCase() === "disti name"; }) || null;
    twoTColKey  = keys.find(function(k) { return k.trim().toLowerCase().indexOf("2t partner name") !== -1; }) || null;
  }
  window.APP_IS_DISTI = distiColKey !== null &&
    rawRows.some(function(r) { return r[distiColKey] && String(r[distiColKey]).trim() !== ""; });

  // ── Main transformation ───────────────────────────────────────────────────
  return rawRows.map(function (raw) {
    var r = sanitizeRow(Object.assign({}, raw)); // sanitize all string values first

    // Map disti columns to standard names
    if (window.APP_IS_DISTI) {
      if (distiColKey) r["Disti name"] = r[distiColKey];           // ensure consistent key for overview
      if (twoTColKey)  r["2T Partner Name"] = r[twoTColKey] || ""; // for Details/Customer columns
    }

    // Step 2: Fix offer name (Integrated Secure Operations → Cisco Secure Network Analytics)
    if (norm(r["Track"]) === "INTEGRATED SECURE OPERATIONS") {
      r["Track"] = "Cisco Secure Network Analytics";
    }
    // Fix sub-track name (Cisco Secure Network Analytics → Network Security Analytics)
    if (norm(r["Sub-Track"]) === "CISCO SECURE NETWORK ANALYTICS") {
      r["Sub-Track"] = "Network Security Analytics";
    }

    // Step 2b: Fix portfolio when set to "No Offer" — look up by offer, then by use case
    if (norm(r["Deal CPI Portfolio"]) === "NO OFFER" || norm(r["Deal CPI Portfolio"]) === "") {
      var offerKey   = norm(r["Track"]);
      var ucKey      = norm(r["Sub-Track"] || r["Use Case"] || r["Use case"] || "");
      var fixedPortfolio = OFFER_TO_PORTFOLIO[offerKey] || USE_CASE_TO_PORTFOLIO[ucKey] || r["Deal CPI Portfolio"];
      r["Deal CPI Portfolio"] = fixedPortfolio;
    }

    // Step 3: CRPartyID-Offer composite key
    r["CRPartyID-Offer"] = String(r["CR Party ID"] || "") + String(r["Track"] || "");

    // Strip trailing .0 from CX Customer BU ID (CSV numeric artifact)
    if (r["CX Customer BU ID"] !== undefined && r["CX Customer BU ID"] !== null) {
      r["CX Customer BU ID"] = String(r["CX Customer BU ID"]).replace(/\.0+$/, "").trim();
    }

    // Step 4: Current stage
    var flag = function (col) { return norm(r[col]) === "YES"; };
    if      (flag("Stage Completion Flag(Adopt)"))      r["Current stage"] = "Completed";
    else if (flag("Stage Completion Flag(Engage)"))     r["Current stage"] = "Adopt";
    else if (flag("Stage Completion Flag(Use)"))        r["Current stage"] = "Engage";
    else if (flag("Stage Completion Flag (Implement)")) r["Current stage"] = "Use";
    else if (flag("Stage Completion Flag(onboard)"))    r["Current stage"] = "Implement";
    else if (flag("Stage Completion Flag (Purchase)"))  r["Current stage"] = "Onboard";
    else                                                 r["Current stage"] = "Purchase";

    // Step 5: Stage progress for each stage
    var purchaseProgress  = calcProgress(r["Task Details (Purchase)"]);
    var onboardProgress   = calcProgress(r["Task Details (Onboard)"]);
    var implementProgress = calcProgress(r["Task Details (Implement)"]);
    var useProgress       = calcProgress(r["Task Details (Use)"]);
    var engageProgress    = calcProgress(r["Task Details (Engage)"]);
    var adoptProgress     = calcProgress(r["Task Details (Adopt)"]);

    // Overall Progress: sum Y and total across all stages
    var _overallY = 0, _overallTotal = 0;
    [purchaseProgress, onboardProgress, implementProgress, useProgress, engageProgress, adoptProgress].forEach(function(p) {
      if (p && p !== "0/0") {
        var parts = p.split("/");
        _overallY     += parseInt(parts[0]) || 0;
        _overallTotal += parseInt(parts[1]) || 0;
      }
    });
    r["Overall Progress"] = _overallTotal > 0 ? _overallY + "/" + _overallTotal : null;

    var cs = r["Current stage"];
    if      (cs === "Purchase")  r["Current Stage Progress"] = purchaseProgress;
    else if (cs === "Onboard")   r["Current Stage Progress"] = onboardProgress;
    else if (cs === "Implement") r["Current Stage Progress"] = implementProgress;
    else if (cs === "Use")       r["Current Stage Progress"] = useProgress;
    else if (cs === "Engage")    r["Current Stage Progress"] = engageProgress;
    else if (cs === "Adopt")     r["Current Stage Progress"] = adoptProgress;
    else if (cs === "Completed") r["Current Stage Progress"] = "N/A";
    else                         r["Current Stage Progress"] = null;

    // Step 6: Pending tasks
    if      (cs === "Purchase")  r["Current stage pending tasks"] = getPendingTasks(r["Task Details (Purchase)"]);
    else if (cs === "Onboard")   r["Current stage pending tasks"] = getPendingTasks(r["Task Details (Onboard)"]);
    else if (cs === "Implement") r["Current stage pending tasks"] = getPendingTasks(r["Task Details (Implement)"]);
    else if (cs === "Use")       r["Current stage pending tasks"] = getPendingTasks(r["Task Details (Use)"]);
    else if (cs === "Engage")    r["Current stage pending tasks"] = getPendingTasks(r["Task Details (Engage)"]);
    else if (cs === "Adopt")     r["Current stage pending tasks"] = getPendingTasks(r["Task Details (Adopt)"]);
    else                         r["Current stage pending tasks"] = null;

    // Step 7: Days in stage
    var startDate = null;
    if      (cs === "Purchase")  startDate = toDate(r["Booking Date"]);
    else if (cs === "Onboard")   startDate = toDate(r["Stage Completion Date (Purchase)"]);
    else if (cs === "Implement") startDate = toDate(r["Stage Completion Date(onboard)"]);
    else if (cs === "Use")       startDate = toDate(r["Stage Completion Date (Implement)"]);
    else if (cs === "Engage")    startDate = toDate(r["Stage Completion Date(Use)"]);
    else if (cs === "Adopt")     startDate = toDate(r["Stage Completion Date(Engage)"]);
    else if (cs === "Completed") startDate = toDate(r["Stage Completion Date(Adopt)"]);

    if (startDate !== null) {
      r["Days in stage"] = Math.floor((today.getTime() - startDate.getTime()) / 86400000);
    } else {
      r["Days in stage"] = null;
    }

    // Step 8: 1st stage?
    var trackNorm = norm(r["Track"]);
    if (trackNorm === "WEBEX SUITE" || trackNorm === "CISCO CONTACT CENTER") {
      r["1st stage?"] = norm(r["Stage Completion Flag(Use)"]) === "YES";
    } else {
      r["1st stage?"] = norm(r["Stage Completion Flag(onboard)"]) === "YES";
    }

    // Step 9: Expires <1M?
    var in1Month = new Date(today.getTime());
    in1Month.setMonth(in1Month.getMonth() + 1);
    var expiryDate = toDate(r["Deal Incentive Expiry Date"]);
    var expiryMidnight = expiryDate ? new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate()) : null;
    r["Expires <3M?"] = (expiryMidnight !== null && expiryMidnight >= today && expiryMidnight < in1Month) ? "Yes" : "No";

    // Step 10: Offer opted-in?
    r["Offer opted-in?"] = optedInKeys.has(r["CRPartyID-Offer"]);

    // Step 11: Missed Incentives
    var bookDate  = r["Booking Date"];
    var lciStart  = r["Adopt Rebate Start Date"];
    var optStatus = norm(r["Adopt Rebate Opt-In Status"]);

    var onbAmt    = safeNum(r["Estimated Incentive Amount(Onboard)"]);
    var useAmt    = safeNum(r["Estimated Incentive Amount(Use)"]);
    var engAmt    = safeNum(r["Estimated Incentive Amount(Engage)"]);
    var adpAmt    = safeNum(r["Estimated Incentive Amount(Adopt)"]);

    var partA = 0;
    if (flag("Stage Completion Flag(onboard)")    && dateGTE(r["Stage Completion Date(onboard)"],    bookDate)) partA += onbAmt;
    if (flag("Stage Completion Flag(Use)")        && dateGTE(r["Stage Completion Date(Use)"],        bookDate)) partA += useAmt;
    if (flag("Stage Completion Flag(Engage)")     && dateGTE(r["Stage Completion Date(Engage)"],     bookDate)) partA += engAmt;
    if (flag("Stage Completion Flag(Adopt)")      && dateGTE(r["Stage Completion Date(Adopt)"],      bookDate)) partA += adpAmt;
    var missedA = optStatus !== "OPTED IN" ? partA : 0;

    var partB = 0;
    if (flag("Stage Completion Flag(onboard)")    && dateLT(r["Stage Completion Date(onboard)"],    lciStart) && dateGTE(r["Stage Completion Date(onboard)"],    bookDate)) partB += onbAmt;
    if (flag("Stage Completion Flag(Use)")        && dateLT(r["Stage Completion Date(Use)"],        lciStart) && dateGTE(r["Stage Completion Date(Use)"],        bookDate)) partB += useAmt;
    if (flag("Stage Completion Flag(Engage)")     && dateLT(r["Stage Completion Date(Engage)"],     lciStart) && dateGTE(r["Stage Completion Date(Engage)"],     bookDate)) partB += engAmt;
    if (flag("Stage Completion Flag(Adopt)")      && dateLT(r["Stage Completion Date(Adopt)"],      lciStart) && dateGTE(r["Stage Completion Date(Adopt)"],      bookDate)) partB += adpAmt;
    var missedB = optStatus === "OPTED IN" ? partB : 0;

    r["Missed Incentives"] = missedA + missedB;

    // Step 12: Potential Incentives
    var stageNorm = norm(r["Stage"]);
    var potential = 0;
    if (stageNorm === "ELIGIBLE") {
      if (!flag("Stage Completion Flag(onboard)"))    potential += onbAmt;
      if (!flag("Stage Completion Flag(Use)"))        potential += useAmt;
      if (!flag("Stage Completion Flag(Engage)"))     potential += engAmt;
      if (!flag("Stage Completion Flag(Adopt)"))      potential += adpAmt;
    }
    r["Potential Incentives"] = potential;

    // Step 13: Estimated Earned Incentives
    var expiry = r["Deal Incentive Expiry Date"];
    var earned = 0;
    if (optStatus === "OPTED IN" && stageNorm !== "NOT ELIGIBLE") {
      if (flag("Stage Completion Flag(onboard)")    && dateGTE(r["Stage Completion Date(onboard)"],    lciStart) && dateLTE(r["Stage Completion Date(onboard)"],    expiry)) earned += onbAmt;
      if (flag("Stage Completion Flag(Use)")        && dateGTE(r["Stage Completion Date(Use)"],        lciStart) && dateLTE(r["Stage Completion Date(Use)"],        expiry)) earned += useAmt;
      if (flag("Stage Completion Flag(Engage)")     && dateGTE(r["Stage Completion Date(Engage)"],     lciStart) && dateLTE(r["Stage Completion Date(Engage)"],     expiry)) earned += engAmt;
      if (flag("Stage Completion Flag(Adopt)")      && dateGTE(r["Stage Completion Date(Adopt)"],      lciStart) && dateLTE(r["Stage Completion Date(Adopt)"],      expiry)) earned += adpAmt;
    }
    r["Estimated Earned Incentives"] = earned;

    // Step 14: Earned?
    r["Earned?"] = earned > 0;

    // Step 15: UC 25-50% eligible w/o opt-in
    r["UC 25-50% eligible w/o opt-in"] =
      !r["Offer opted-in?"] &&
      r["1st stage?"] === true &&
      norm(r["Stage Completion Flag(Engage)"]) !== "YES" &&
      stageNorm === "ELIGIBLE";

    // Step 16: UC 75% eligible w/o opt-in
    r["UC 75% eligible w/o opt-in"] =
      !r["Offer opted-in?"] &&
      stageNorm === "ELIGIBLE" &&
      norm(r["Stage Completion Flag(Engage)"]) === "YES" &&
      norm(r["Stage Completion Flag(Adopt)"]) !== "YES";

    // Step 17: UC progressed and missed w/o opt-in
    var firstStage = r["1st stage?"] === true;
    var isExpired  = stageNorm === "EXPIRED";
    var notOptedIn = !r["Offer opted-in?"];
    var missedNZ   = r["Missed Incentives"] !== 0;
    var adoptDone  = norm(r["Stage Completion Flag(Adopt)"]) === "YES";
    r["UC progressed and missed w/o opt-in"] =
      (firstStage && isExpired && notOptedIn && missedNZ) ||
      (adoptDone && !isExpired && notOptedIn && missedNZ);

    // Step 18: EA Flag standardization
    var ea = r["EA Flag"];
    if (ea === "Y" || ea === "y") r["EA Flag"] = "Yes";
    else if (ea === "N" || ea === "n") r["EA Flag"] = "No";

    // Step 18b: AAP Flag normalization — find column regardless of exact casing/spacing
    var aapVal = aapColumnKey ? r[aapColumnKey] : null;
    r["AAP Flag"] = (aapVal === "Y" || aapVal === "y") ? "Yes" : "No";

    // Step 19: Offer Risk Level (calendar-based 18-month window)
    var bookDateObj = toDate(r["Booking Date"]);
    var past18CalStart = new Date(today.getFullYear(), today.getMonth() - 17, 1);
    var isRecent = bookDateObj !== null && bookDateObj >= past18CalStart && bookDateObj <= today;
    var maxFlag  = norm(r["Maximum Incentive Deal Flag"]) === "YES";

    if (maxFlag && isRecent) {
      if (cs === "Purchase" || cs === "Onboard") r["Offer Risk Level"] = "High";
      else if (cs === "Implement" || cs === "Use") r["Offer Risk Level"] = "Medium";
      else if (cs === "Engage" || cs === "Adopt" || cs === "Completed") r["Offer Risk Level"] = "Low";
      else r["Offer Risk Level"] = null;
    } else {
      r["Offer Risk Level"] = null;
    }

    // Step 20: Is within 18 FM
    r["Is within 18 FM"] = bookDateObj !== null && month18AgoStart !== null
      ? bookDateObj >= month18AgoStart
      : false;

    // Step 21: PVI Eligible
    r["PVI Eligible"] =
      r["Is within 18 FM"] === true &&
      maxFlag &&
      stageNorm === "ELIGIBLE" &&
      norm(r["Deal CPI Portfolio"]) !== "COLLABORATION";

    // Step 22: PVI Onboard
    r["PVI Onboard"] =
      r["Is within 18 FM"] === true &&
      maxFlag &&
      stageNorm === "ELIGIBLE" &&
      norm(r["Stage Completion Flag(onboard)"]) === "YES" &&
      norm(r["Deal CPI Portfolio"]) !== "COLLABORATION";

    // Step 23: PVI Adopt
    r["PVI Adopt"] =
      r["Is within 18 FM"] === true &&
      maxFlag &&
      stageNorm === "ELIGIBLE" &&
      norm(r["Stage Completion Flag(Adopt)"]) === "YES" &&
      norm(r["Deal CPI Portfolio"]) !== "COLLABORATION";

    // Step 24: CRPartyNameID
    r["CRPartyNameID"] = String(r["CR Party Name"] || "") + "-" + String(r["CR Party ID"] || "");

    // Step 25: New eligible
    var thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
    r["New eligible"] =
      stageNorm === "ELIGIBLE" &&
      norm(r["Adopt Rebate Opt-In Status"]) === "PENDING" &&
      bookDateObj !== null &&
      bookDateObj >= thirtyDaysAgo &&
      bookDateObj <= today;

    return r;
  });
}

window.transformData = transformData;
