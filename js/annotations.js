// =============================================================================
// annotations.js — Per-deal tags, comments & exclusions, stored in IndexedDB
// =============================================================================
// Each record: { wsId, tags: [], comment: "", excluded: false }
// Unique identifier: Deal WS-ID
// =============================================================================

var ANNOTATIONS = (function () {

  // In-memory cache: { [wsId]: { tags:[], comment:"", excluded:false } }
  var _cache = {};
  var _loaded = false;

  // ── Load all from IDB into cache (idempotent — returns cached on re-call) ─
  function load() {
    if (_loaded) return Promise.resolve(_cache);
    return IDB.loadAllAnnotations().then(function (rows) {
      _cache = {};
      rows.forEach(function (r) {
        _cache[r.wsId] = { tags: r.tags || [], comment: r.comment || "", excluded: !!r.excluded };
      });
      _loaded = true;
      return _cache;
    });
  }

  function reload() {
    _loaded = false;
    return load();
  }

  // ── Get annotation for one wsId (from cache) ─────────────────────────────
  function get(wsId) {
    return _cache[wsId] || null;
  }

  // ── Get all cached annotations ────────────────────────────────────────────
  function getAll() {
    return _cache;
  }

  // ── Save (upsert) tags + comment, preserving existing excluded state ───────
  function set(wsId, tags, comment) {
    if (!wsId) return Promise.resolve();
    tags    = (tags    || []).filter(function (t) { return t && t.trim(); });
    comment = (comment || "").trim();
    var existing = _cache[wsId] || {};
    var excluded = !!existing.excluded;
    if (tags.length === 0 && comment === "" && !excluded) {
      delete _cache[wsId];
      return IDB.removeAnnotation(wsId);
    }
    _cache[wsId] = { tags: tags, comment: comment, excluded: excluded };
    return IDB.saveAnnotation(wsId, tags, comment, excluded);
  }

  // ── Save tags + comment + excluded atomically (no race condition) ─────────
  function saveFull(wsId, tags, comment, excluded) {
    if (!wsId) return Promise.resolve();
    tags    = (tags    || []).filter(function (t) { return t && t.trim(); });
    comment = (comment || "").trim();
    excluded = !!excluded;
    if (tags.length === 0 && !comment && !excluded) {
      delete _cache[wsId];
      return IDB.removeAnnotation(wsId);
    }
    _cache[wsId] = { tags: tags, comment: comment, excluded: excluded };
    return IDB.saveAnnotation(wsId, tags, comment, excluded);
  }

  // ── Set excluded flag for a single WS-ID ─────────────────────────────────
  function setExcluded(wsId, excluded) {
    if (!wsId) return Promise.resolve();
    var existing = _cache[wsId] || { tags: [], comment: "" };
    excluded = !!excluded;
    if (!excluded && existing.tags.length === 0 && !existing.comment) {
      delete _cache[wsId];
      return IDB.removeAnnotation(wsId);
    }
    _cache[wsId] = { tags: existing.tags || [], comment: existing.comment || "", excluded: excluded };
    return IDB.saveAnnotation(wsId, existing.tags || [], existing.comment || "", excluded);
  }

  // ── Bulk exclude/un-exclude all WS-IDs for a customer ────────────────────
  function setExcludedForCustomer(wsIds, excluded) {
    var saves = wsIds.map(function (id) { return setExcluded(id, excluded); });
    return Promise.all(saves);
  }

  // ── Exclusion helpers ─────────────────────────────────────────────────────
  function isExcluded(wsId) {
    var a = _cache[wsId];
    return !!(a && a.excluded);
  }

  function getExcludedWsIds() {
    return Object.keys(_cache).filter(function (id) { return !!_cache[id].excluded; });
  }

  // ── Remove annotation entirely (tags, comment AND exclusion) ─────────────
  function remove(wsId) {
    delete _cache[wsId];
    return IDB.removeAnnotation(wsId);
  }

  // ── CSV helpers ───────────────────────────────────────────────────────────
  function csvEscape(val) {
    var s = String(val === null || val === undefined ? "" : val);
    if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function csvParseLine(line, delim) {
    var sep = delim || ",";
    var fields = [];
    var cur = "", inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === sep) { fields.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }

  function detectDelimiter(headerLine) {
    var semicolons = (headerLine.match(/;/g) || []).length;
    var commas     = (headerLine.match(/,/g) || []).length;
    return semicolons > commas ? ";" : ",";
  }

  // ── Export all annotations as a CSV file download ────────────────────────
  // Columns: Deal WS-ID, Excluded, Tags (pipe-separated), Comment
  function exportCSV() {
    return IDB.loadAllAnnotations().then(function (rows) {
      var lines = ["Deal WS-ID,Excluded,Tags,Comment"];
      rows.forEach(function (r) {
        lines.push([
          csvEscape(r.wsId),
          r.excluded ? "TRUE" : "FALSE",
          csvEscape((r.tags || []).join("|")),
          csvEscape(r.comment || "")
        ].join(","));
      });
      var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement("a");
      a.href     = url;
      a.download = "annotations-" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
    });
  }

  // ── Import annotations from CSV (merge — existing wsIds overwritten) ──────
  // Columns (flexible order): Deal WS-ID, Excluded, Tags, Comment
  function importCSV(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var raw   = e.target.result.replace(/^\uFEFF/, ""); // strip UTF-8 BOM if present
          var lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
          if (lines.length < 2) throw new Error("File appears empty");
          var delim    = detectDelimiter(lines[0]);
          var header   = csvParseLine(lines[0], delim).map(function (h) { return h.trim().toLowerCase(); });
          var iWsId    = header.indexOf("deal ws-id");
          if (iWsId === -1) iWsId = header.indexOf("ws deal id"); // backward-compat
          var iTags    = header.indexOf("tags");
          var iComment = header.indexOf("comment");
          var iExcl    = header.indexOf("excluded");
          if (iWsId === -1) throw new Error("Missing 'Deal WS-ID' column");
          var saves = [], count = 0;
          for (var i = 1; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var fields  = csvParseLine(line, delim);
            var wsId    = (fields[iWsId]    || "").trim();
            var tags    = iTags    !== -1 ? (fields[iTags]    || "").trim() : "";
            var comment = iComment !== -1 ? (fields[iComment] || "").trim() : "";
            var excl    = iExcl    !== -1 ? (fields[iExcl]    || "").trim().toUpperCase() === "TRUE" : false;
            if (!wsId) continue;
            var tagsArr = tags ? tags.split("|").map(function (t) { return t.trim(); }).filter(Boolean) : [];
            _cache[wsId] = { tags: tagsArr, comment: comment, excluded: excl };
            saves.push(IDB.saveAnnotation(wsId, tagsArr, comment, excl));
            count++;
          }
          Promise.all(saves).then(function () { resolve(count); }).catch(reject);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsText(file, "UTF-8");
    });
  }

  function clearAll() {
    _cache = {};
    _loaded = false;
    return IDB.clearAllAnnotations();
  }

  function clearForWsIds(wsIds) {
    wsIds.forEach(function (id) { delete _cache[id]; });
    return Promise.all(wsIds.map(function (id) { return IDB.removeAnnotation(id); }));
  }

  // ── Get all unique user-created tag names ─────────────────────────────────
  function allTagNames() {
    var tags = new Set();
    Object.keys(_cache).forEach(function (id) {
      (_cache[id].tags || []).forEach(function (t) { tags.add(t); });
    });
    return Array.from(tags).sort();
  }

  // ── Deterministic color per tag (HSL based on tag name hash) ─────────────
  function tagColor(tag) {
    var hash = 0;
    for (var i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
      hash |= 0;
    }
    var hue = Math.abs(hash) % 360;
    return {
      bg:     "hsl(" + hue + ",65%,88%)",
      color:  "hsl(" + hue + ",50%,28%)",
      border: "hsl(" + hue + ",55%,70%)"
    };
  }

  return {
    load:                   load,
    reload:                 reload,
    get:                    get,
    getAll:                 getAll,
    set:                    set,
    saveFull:               saveFull,
    setExcluded:            setExcluded,
    setExcludedForCustomer: setExcludedForCustomer,
    isExcluded:             isExcluded,
    getExcludedWsIds:       getExcludedWsIds,
    remove:                 remove,
    clearAll:               clearAll,
    clearForWsIds:          clearForWsIds,
    exportCSV:              exportCSV,
    exportJSON:             exportCSV,  // alias
    importCSV:              importCSV,
    importJSON:             importCSV,  // alias
    allTagNames:            allTagNames,
    tagColor:               tagColor
  };
})();
