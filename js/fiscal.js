// =============================================================================
// fiscal.js — Cisco Fiscal Calendar (FY24M1 through FY28M12)
// =============================================================================
// Excel serial date → JS Date: new Date((serial - 25569) * 86400 * 1000)
// =============================================================================

(function () {
  function serialToDate(serial) {
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }

  var RAW = [
    { fiscalMonth: "FY24M1",  fy: "FY24", fm: 1,  startSerial: 45137, endSerial: 45164,  count: 1  },
    { fiscalMonth: "FY24M2",  fy: "FY24", fm: 2,  startSerial: 45165, endSerial: 45192,  count: 2  },
    { fiscalMonth: "FY24M3",  fy: "FY24", fm: 3,  startSerial: 45193, endSerial: 45227,  count: 3  },
    { fiscalMonth: "FY24M4",  fy: "FY24", fm: 4,  startSerial: 45228, endSerial: 45255,  count: 4  },
    { fiscalMonth: "FY24M5",  fy: "FY24", fm: 5,  startSerial: 45256, endSerial: 45283,  count: 5  },
    { fiscalMonth: "FY24M6",  fy: "FY24", fm: 6,  startSerial: 45284, endSerial: 45318,  count: 6  },
    { fiscalMonth: "FY24M7",  fy: "FY24", fm: 7,  startSerial: 45319, endSerial: 45346,  count: 7  },
    { fiscalMonth: "FY24M8",  fy: "FY24", fm: 8,  startSerial: 45347, endSerial: 45374,  count: 8  },
    { fiscalMonth: "FY24M9",  fy: "FY24", fm: 9,  startSerial: 45375, endSerial: 45409,  count: 9  },
    { fiscalMonth: "FY24M10", fy: "FY24", fm: 10, startSerial: 45410, endSerial: 45437,  count: 10 },
    { fiscalMonth: "FY24M11", fy: "FY24", fm: 11, startSerial: 45438, endSerial: 45465,  count: 11 },
    { fiscalMonth: "FY24M12", fy: "FY24", fm: 12, startSerial: 45466, endSerial: 45500,  count: 12 },
    { fiscalMonth: "FY25M1",  fy: "FY25", fm: 1,  startSerial: 45501, endSerial: 45528,  count: 13 },
    { fiscalMonth: "FY25M2",  fy: "FY25", fm: 2,  startSerial: 45529, endSerial: 45556,  count: 14 },
    { fiscalMonth: "FY25M3",  fy: "FY25", fm: 3,  startSerial: 45557, endSerial: 45591,  count: 15 },
    { fiscalMonth: "FY25M4",  fy: "FY25", fm: 4,  startSerial: 45592, endSerial: 45619,  count: 16 },
    { fiscalMonth: "FY25M5",  fy: "FY25", fm: 5,  startSerial: 45620, endSerial: 45647,  count: 17 },
    { fiscalMonth: "FY25M6",  fy: "FY25", fm: 6,  startSerial: 45648, endSerial: 45682,  count: 18 },
    { fiscalMonth: "FY25M7",  fy: "FY25", fm: 7,  startSerial: 45683, endSerial: 45710,  count: 19 },
    { fiscalMonth: "FY25M8",  fy: "FY25", fm: 8,  startSerial: 45711, endSerial: 45738,  count: 20 },
    { fiscalMonth: "FY25M9",  fy: "FY25", fm: 9,  startSerial: 45739, endSerial: 45773,  count: 21 },
    { fiscalMonth: "FY25M10", fy: "FY25", fm: 10, startSerial: 45774, endSerial: 45801,  count: 22 },
    { fiscalMonth: "FY25M11", fy: "FY25", fm: 11, startSerial: 45802, endSerial: 45829,  count: 23 },
    { fiscalMonth: "FY25M12", fy: "FY25", fm: 12, startSerial: 45830, endSerial: 45864,  count: 24 },
    { fiscalMonth: "FY26M1",  fy: "FY26", fm: 1,  startSerial: 45865, endSerial: 45892,  count: 25 },
    { fiscalMonth: "FY26M2",  fy: "FY26", fm: 2,  startSerial: 45893, endSerial: 45920,  count: 26 },
    { fiscalMonth: "FY26M3",  fy: "FY26", fm: 3,  startSerial: 45921, endSerial: 45955,  count: 27 },
    { fiscalMonth: "FY26M4",  fy: "FY26", fm: 4,  startSerial: 45956, endSerial: 45983,  count: 28 },
    { fiscalMonth: "FY26M5",  fy: "FY26", fm: 5,  startSerial: 45984, endSerial: 46011,  count: 29 },
    { fiscalMonth: "FY26M6",  fy: "FY26", fm: 6,  startSerial: 46012, endSerial: 46046,  count: 30 },
    { fiscalMonth: "FY26M7",  fy: "FY26", fm: 7,  startSerial: 46047, endSerial: 46074,  count: 31 },
    { fiscalMonth: "FY26M8",  fy: "FY26", fm: 8,  startSerial: 46075, endSerial: 46102,  count: 32 },
    { fiscalMonth: "FY26M9",  fy: "FY26", fm: 9,  startSerial: 46103, endSerial: 46137,  count: 33 },
    { fiscalMonth: "FY26M10", fy: "FY26", fm: 10, startSerial: 46138, endSerial: 46165,  count: 34 },
    { fiscalMonth: "FY26M11", fy: "FY26", fm: 11, startSerial: 46166, endSerial: 46193,  count: 35 },
    { fiscalMonth: "FY26M12", fy: "FY26", fm: 12, startSerial: 46194, endSerial: 46228,  count: 36 },
    { fiscalMonth: "FY27M1",  fy: "FY27", fm: 1,  startSerial: 46229, endSerial: 46256,  count: 37 },
    { fiscalMonth: "FY27M2",  fy: "FY27", fm: 2,  startSerial: 46257, endSerial: 46284,  count: 38 },
    { fiscalMonth: "FY27M3",  fy: "FY27", fm: 3,  startSerial: 46285, endSerial: 46319,  count: 39 },
    { fiscalMonth: "FY27M4",  fy: "FY27", fm: 4,  startSerial: 46320, endSerial: 46347,  count: 40 },
    { fiscalMonth: "FY27M5",  fy: "FY27", fm: 5,  startSerial: 46348, endSerial: 46375,  count: 41 },
    { fiscalMonth: "FY27M6",  fy: "FY27", fm: 6,  startSerial: 46376, endSerial: 46410,  count: 42 },
    { fiscalMonth: "FY27M7",  fy: "FY27", fm: 7,  startSerial: 46411, endSerial: 46438,  count: 43 },
    { fiscalMonth: "FY27M8",  fy: "FY27", fm: 8,  startSerial: 46439, endSerial: 46466,  count: 44 },
    { fiscalMonth: "FY27M9",  fy: "FY27", fm: 9,  startSerial: 46467, endSerial: 46501,  count: 45 },
    { fiscalMonth: "FY27M10", fy: "FY27", fm: 10, startSerial: 46502, endSerial: 46529,  count: 46 },
    { fiscalMonth: "FY27M11", fy: "FY27", fm: 11, startSerial: 46530, endSerial: 46557,  count: 47 },
    { fiscalMonth: "FY27M12", fy: "FY27", fm: 12, startSerial: 46558, endSerial: 46599,  count: 48 },
    // FY28 — estimated using standard Cisco 4-4-5 pattern (52 weeks / 364 days). Confirm with
    // the official fiscal calendar owner and adjust as needed.
    { fiscalMonth: "FY28M1",  fy: "FY28", fm: 1,  startSerial: 46600, endSerial: 46627,  count: 49 },
    { fiscalMonth: "FY28M2",  fy: "FY28", fm: 2,  startSerial: 46628, endSerial: 46655,  count: 50 },
    { fiscalMonth: "FY28M3",  fy: "FY28", fm: 3,  startSerial: 46656, endSerial: 46690,  count: 51 },
    { fiscalMonth: "FY28M4",  fy: "FY28", fm: 4,  startSerial: 46691, endSerial: 46718,  count: 52 },
    { fiscalMonth: "FY28M5",  fy: "FY28", fm: 5,  startSerial: 46719, endSerial: 46746,  count: 53 },
    { fiscalMonth: "FY28M6",  fy: "FY28", fm: 6,  startSerial: 46747, endSerial: 46781,  count: 54 },
    { fiscalMonth: "FY28M7",  fy: "FY28", fm: 7,  startSerial: 46782, endSerial: 46809,  count: 55 },
    { fiscalMonth: "FY28M8",  fy: "FY28", fm: 8,  startSerial: 46810, endSerial: 46837,  count: 56 },
    { fiscalMonth: "FY28M9",  fy: "FY28", fm: 9,  startSerial: 46838, endSerial: 46872,  count: 57 },
    { fiscalMonth: "FY28M10", fy: "FY28", fm: 10, startSerial: 46873, endSerial: 46900,  count: 58 },
    { fiscalMonth: "FY28M11", fy: "FY28", fm: 11, startSerial: 46901, endSerial: 46928,  count: 59 },
    { fiscalMonth: "FY28M12", fy: "FY28", fm: 12, startSerial: 46929, endSerial: 46963,  count: 60 }
  ];

  // Build the calendar with real Date objects
  var FISCAL_CALENDAR = RAW.map(function (r) {
    return {
      fiscalMonth: r.fiscalMonth,
      fy:   r.fy,
      fm:   r.fm,
      start: serialToDate(r.startSerial),
      end:   serialToDate(r.endSerial),
      count: r.count
    };
  });

  // Returns the matching FISCAL_CALENDAR entry for a JS Date, or null
  function getFiscalMonth(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
    var t = date.getTime();
    for (var i = 0; i < FISCAL_CALENDAR.length; i++) {
      var fc = FISCAL_CALENDAR[i];
      if (t >= fc.start.getTime() && t <= fc.end.getTime()) return fc;
    }
    return null;
  }

  // Returns the start Date of the fiscal month 17 months before the current one
  function get18MonthAgoStart() {
    var today = new Date();
    var cur = getFiscalMonth(today);
    if (!cur) {
      // Fallback: use last known fiscal month
      cur = FISCAL_CALENDAR[FISCAL_CALENDAR.length - 1];
    }
    var targetCount = cur.count - 17;
    for (var i = 0; i < FISCAL_CALENDAR.length; i++) {
      if (FISCAL_CALENDAR[i].count === targetCount) return FISCAL_CALENDAR[i].start;
    }
    // If target is before our calendar range, return the earliest start
    return FISCAL_CALENDAR[0].start;
  }

  // Expose globally
  window.FISCAL_CALENDAR   = FISCAL_CALENDAR;
  window.getFiscalMonth    = getFiscalMonth;
  window.get18MonthAgoStart = get18MonthAgoStart;
})();
