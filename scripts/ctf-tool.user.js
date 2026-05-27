(function () {
  "use strict";

  // ========================================================================
  // Pure functions (mirror of lib.js — kept in sync, unit-tested via vitest)
  // ========================================================================

  function normalizeName(s) {
    if (s == null) return "";
    return String(s).toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
  }

  function matchHeader(normalizedHeader, candidatePrefixes) {
    for (const cand of candidatePrefixes) {
      const c = cand.toLowerCase();
      if (normalizedHeader === c) return true;
      if (normalizedHeader.startsWith(c + " ")) return true;
    }
    return false;
  }

  function coerceRotation(v) {
    if (v === 0) return 0;
    if (v == null || v === "") throw new Error("rotation missing");
    if (typeof v === "number") {
      if (!isFinite(v)) throw new Error(`rotation not finite: ${v}`);
      return v >= 1 ? v / 100 : v;
    }
    const s = String(v).replace(/\s+/g, "").replace(/%+$/, "");
    if (s === "") throw new Error("rotation missing");
    if (/^\d+\/\d+$/.test(s)) {
      const [a, b] = s.split("/").map((x) => parseFloat(x));
      if (b === 0) throw new Error(`rotation divide-by-zero: ${v}`);
      return a / b;
    }
    const n = parseFloat(s);
    if (isNaN(n)) throw new Error(`rotation not numeric: ${v}`);
    return n >= 1 ? n / 100 : n;
  }

  function isEvenRotation(v) {
    if (v == null) return false;
    // Match "even" or "equal" (case-insensitive). Different CTF templates use
    // different wording for the same "Prism distributes evenly, weight = 1" concept.
    return /even|equal/i.test(String(v));
  }

  function computeWeight(v) {
    if (isEvenRotation(v)) return 1;
    return Math.round(coerceRotation(v) * 100);
  }

  function tzOffsetForDate(date, ianaTz) {
    if (!(date instanceof Date) || isNaN(date.getTime())) throw new Error("tzOffsetForDate: invalid date");
    if (!ianaTz) throw new Error("tzOffsetForDate: missing timezone");
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: ianaTz, timeZoneName: "longOffset" }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (!tzPart) throw new Error(`tzOffsetForDate: no offset returned for ${ianaTz}`);
    const raw = tzPart.value.replace("GMT", "");
    return raw === "" ? "+00:00" : raw;
  }

  function toISO(date, ianaTz, timeOfDay = "00:00:00") {
    if (!(date instanceof Date) || isNaN(date.getTime())) throw new Error("toISO: invalid date");
    if (!/^\d{2}:\d{2}:\d{2}$/.test(timeOfDay)) throw new Error(`toISO: invalid timeOfDay "${timeOfDay}"`);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    const probe = new Date(Date.UTC(y, date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
    const offset = tzOffsetForDate(probe, ianaTz);
    return `${y}-${m}-${d}T${timeOfDay}${offset}`;
  }

  function parseLineItemsString(s) {
    return s ? String(s).split(/\s*,\s*/).filter(Boolean) : [];
  }

  function lineItemsSignature(s) {
    return parseLineItemsString(s).slice().sort().join(",");
  }

  function nextDay(isoDateOrDateTime) {
    const [y, m, d] = String(isoDateOrDateTime).slice(0, 10).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    return dt.toISOString().slice(0, 10);
  }

  function isContiguousOrOverlapping(prev, cur) {
    const prevEndDay = String(prev.end_date).slice(0, 10);
    const curStartDay = String(cur.start_date).slice(0, 10);
    if (curStartDay <= prevEndDay) return true;
    return curStartDay === nextDay(prevEndDay);
  }

  // v0.8: group by (advertiser_id, creative_id, line_items_signature, weight).
  // Within a group, sort intervals and merge contiguous/overlapping ones.
  // Disjoint intervals stay as separate output rows. Different RFPIs (different
  // line_items) or different weights produce separate rows. See lib.js for the
  // full algorithm comment.
  function groupRows(rows) {
    const groups = new Map();
    for (const r of rows) {
      const liSig = lineItemsSignature(r.line_items);
      const key = `${r.advertiser_id}|${r.creative_id}|${liSig}|${r.weight}`;
      if (!groups.has(key)) {
        groups.set(key, {
          advertiser_id: r.advertiser_id,
          creative_id: r.creative_id,
          line_items: parseLineItemsString(r.line_items).join(", "),
          weight: r.weight,
          intervals: [],
        });
      }
      groups.get(key).intervals.push({ start_date: r.start_date, end_date: r.end_date });
    }
    const sortedGroups = [...groups.values()].sort((a, b) => {
      if (a.advertiser_id !== b.advertiser_id) return a.advertiser_id - b.advertiser_id;
      if (a.creative_id !== b.creative_id) return a.creative_id - b.creative_id;
      if (a.weight !== b.weight) return a.weight - b.weight;
      return a.line_items.localeCompare(b.line_items);
    });
    const out = [];
    for (const g of sortedGroups) {
      g.intervals.sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
      const merged = [g.intervals[0]];
      for (let i = 1; i < g.intervals.length; i++) {
        const last = merged[merged.length - 1];
        const cur = g.intervals[i];
        if (isContiguousOrOverlapping(last, cur)) {
          if (String(cur.end_date) > String(last.end_date)) last.end_date = cur.end_date;
        } else {
          merged.push(cur);
        }
      }
      for (const iv of merged) {
        out.push({
          advertiser_id: g.advertiser_id,
          creative_id: g.creative_id,
          line_items: g.line_items,
          weight: g.weight,
          start_date: iv.start_date,
          end_date: iv.end_date,
        });
      }
    }
    return { rows: out, warnings: [] };
  }

  // Post-grouping invariant: same (creative_id, line_item_id) cannot appear in
  // two output rows with intersecting date ranges. Returns array of collision
  // messages, or [] if clean. Adjacent days are not collisions.
  function validateNoOverlap(rows) {
    const collisions = [];
    const byPair = new Map();
    for (const r of rows) {
      const cid = r.creative_id;
      for (const lid of parseLineItemsString(r.line_items)) {
        const k = `${cid}|${lid}`;
        if (!byPair.has(k)) byPair.set(k, []);
        byPair.get(k).push({ start_date: r.start_date, end_date: r.end_date });
      }
    }
    for (const [pairKey, entries] of byPair) {
      if (entries.length < 2) continue;
      entries.sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
      for (let i = 1; i < entries.length; i++) {
        const prev = entries[i - 1];
        const cur = entries[i];
        const prevEndDay = String(prev.end_date).slice(0, 10);
        const curStartDay = String(cur.start_date).slice(0, 10);
        if (curStartDay <= prevEndDay) {
          const [cid, lid] = pairKey.split("|");
          collisions.push(
            `Date overlap for creative ${cid} on line_item ${lid}: ` +
            `[${String(prev.start_date).slice(0, 10)}..${prevEndDay}] and ` +
            `[${curStartDay}..${String(cur.end_date).slice(0, 10)}] intersect. ` +
            `Prism rejects duplicate creative_id rows with intersecting date ranges on the same line_item.`
          );
        }
      }
    }
    return collisions;
  }

  function validateInputRows(rows) {
    const errors = [];
    if (!Array.isArray(rows) || rows.length === 0) return ["input has zero rows"];
    // v0.9: multi-advertiser CTFs supported. Each advertiser group resolves
    // independently downstream. Per-row checks still apply.
    rows.forEach((r, i) => {
      const n = i + 1;
      if (!r.advertiser_name || !String(r.advertiser_name).trim()) errors.push(`row ${n}: advertiser_name is empty`);
      if (!r.creative_name && !r.isci) errors.push(`row ${n}: creative_name AND isci both empty`);
      if (r.rotation == null || r.rotation === "") errors.push(`row ${n}: rotation is empty`);
      else { try { computeWeight(r.rotation); } catch (e) { errors.push(`row ${n}: ${e.message}`); } }
      if (!(r.start_date instanceof Date) || isNaN(r.start_date?.getTime?.())) errors.push(`row ${n}: start_date is not a valid Date`);
      if (!(r.end_date instanceof Date) || isNaN(r.end_date?.getTime?.())) errors.push(`row ${n}: end_date is not a valid Date`);
    });
    return errors;
  }

  // True when a cell value carries no user-typed content. Numbers (incl. 0),
  // Dates, and booleans are NEVER empty. See lib.js for full spec.
  function isCellEmpty(v) {
    return v == null || v === "" || (typeof v === "string" && v.trim() === "");
  }

  // Detect a "blank" data row that should be skipped during xlsx parsing.
  // Two-tier: fast path (every cell empty/whitespace) + slow path (required
  // cells empty even if stray content elsewhere). isci is in the required
  // list so isci-only rows still process and produce clear validation errors.
  // Empty requiredFields array bypasses slow path (avoids vacuous-true trap).
  // See lib.js for full spec.
  function isBlankDataRow(row, colIndex, requiredFields = ["creative_name", "isci", "advertiser_name", "rotation", "start_date", "end_date"]) {
    if (!row) return true;
    if (row.every(isCellEmpty)) return true;
    if (!colIndex || !Array.isArray(requiredFields) || requiredFields.length === 0) return false;
    return requiredFields.every((field) => {
      const idx = colIndex[field];
      if (idx == null) return true;
      return isCellEmpty(row[idx]);
    });
  }

  // Group input rows by advertiser_name (normalized). Returns Map preserving
  // insertion order. Same advertiser under different forms ("Acme Inc",
  // "ACME INC", "Acme, Inc.") groups together. Empty advertiser_name skipped
  // defensively. See lib.js for the full spec.
  function groupRowsByAdvertiserName(rows) {
    const groups = new Map();
    if (!Array.isArray(rows)) return groups;
    for (const r of rows) {
      if (!r || !r.advertiser_name || !String(r.advertiser_name).trim()) continue;
      const key = normalizeName(r.advertiser_name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    return groups;
  }

  function matchCreative(xlsxRow, apiCreatives) {
    const targetName = normalizeName(xlsxRow.creative_name);
    const targetIsci = xlsxRow.isci ? String(xlsxRow.isci).trim() : "";
    const altFields = ["alternative_id", "alternative_id2", "alternative_id3", "alternative_id4", "alternative_id5"];
    if (targetName) {
      const byName = apiCreatives.filter((c) => normalizeName(c.creative_name) === targetName);
      if (byName.length === 1) return { match: "name", creative: byName[0] };
      if (byName.length > 1) return { match: "multiple", candidates: byName, reason: "name" };
    }
    if (targetIsci) {
      const byIsci = apiCreatives.filter((c) => altFields.some((f) => c[f] && String(c[f]).trim() === targetIsci));
      if (byIsci.length === 1) return { match: "isci", creative: byIsci[0] };
      if (byIsci.length > 1) return { match: "multiple", candidates: byIsci, reason: "isci" };
    }
    const assetCandidate = targetName || targetIsci;
    if (assetCandidate) {
      const byAsset = apiCreatives.filter((c) => String(c.primary_asset) === assetCandidate);
      if (byAsset.length === 1) return { match: "primary_asset", creative: byAsset[0] };
      if (byAsset.length > 1) return { match: "multiple", candidates: byAsset, reason: "primary_asset" };
    }
    return { match: "none" };
  }

  function creativeKeyFromRow(row) {
    return `${normalizeName(row.creative_name)}|${row.isci ? String(row.isci).trim() : ""}`;
  }

  function resolveCreativeIdForKey(key, ctf) {
    const res = ctf.creativeResolution?.[key];
    if (!res) return null;
    if (res.match === "name" || res.match === "isci" || res.match === "primary_asset") {
      return res.creative.creative_id;
    }
    if (res.match === "multiple") {
      const picked = ctf.edits?.multiPicks?.[key];
      return picked != null ? picked : null;
    }
    if (res.match === "none") {
      const pasted = ctf.edits?.manualCreativeIds?.[key];
      return pasted != null ? pasted : null;
    }
    return null;
  }

  function mergeStagedOutputs(stagedCtfs, ianaTz) {
    if (!ianaTz) throw new Error("mergeStagedOutputs: missing timezone");
    if (!Array.isArray(stagedCtfs) || stagedCtfs.length === 0) return { rows: [], warnings: [] };
    const enriched = [];
    const collectedWarnings = [];
    let skippedUnresolved = 0;
    for (const ctf of stagedCtfs) {
      const advertiserId = ctf.advertiser.advertiser_id;
      // Carry per-CTF warnings (line-items gaps etc.) through to the done view.
      if (Array.isArray(ctf.warnings)) collectedWarnings.push(...ctf.warnings);
      for (const row of ctf.rows) {
        const key = creativeKeyFromRow(row);
        const creativeId = resolveCreativeIdForKey(key, ctf);
        if (creativeId == null || Number.isNaN(creativeId)) { skippedUnresolved++; continue; }
        const rfpiCode = row.rfp_line_item_code ? String(row.rfp_line_item_code).trim() : "";
        const rfpiLineItems = (ctf.lineItemsByRfpi && rfpiCode) ? (ctf.lineItemsByRfpi[rfpiCode] || []) : [];
        enriched.push({
          advertiser_id: advertiserId,
          creative_id: creativeId,
          line_items: rfpiLineItems.join(", "),
          weight: computeWeight(row.rotation),
          start_date: toISO(row.start_date, ianaTz, "00:00:00"),
          end_date: toISO(row.end_date, ianaTz, "23:59:59"),
        });
      }
    }
    if (skippedUnresolved > 0) {
      collectedWarnings.push(`${skippedUnresolved} CTF row${skippedUnresolved === 1 ? " was" : "s were"} skipped because their creative didn't resolve (unexpected — the UI should have blocked Generate).`);
    }
    const { rows, warnings } = groupRows(enriched);
    const collisions = validateNoOverlap(rows);
    if (collisions.length > 0) {
      throw new Error(`Cannot generate: ${collisions.length} date overlap${collisions.length === 1 ? "" : "s"} detected.\n\n${collisions.join("\n\n")}`);
    }
    return { rows, warnings: [...collectedWarnings, ...warnings] };
  }

  function writeEdit(appState, ctfId, field, key, value) {
    if (!appState || !Array.isArray(appState.stagedCtfs)) return appState;
    const idx = appState.stagedCtfs.findIndex((c) => c.id === ctfId);
    if (idx === -1) return appState;
    const ctf = appState.stagedCtfs[idx];
    const newEdits = {
      ...(ctf.edits || { manualCreativeIds: {}, multiPicks: {} }),
      [field]: { ...(ctf.edits?.[field] || {}), [key]: value },
    };
    const newCtf = { ...ctf, edits: newEdits };
    const newStaged = [...appState.stagedCtfs];
    newStaged[idx] = newCtf;
    return { ...appState, stagedCtfs: newStaged };
  }

  function matchesStagedCtf(filename, advertiserId, stagedCtfs) {
    if (!Array.isArray(stagedCtfs) || stagedCtfs.length === 0) return false;
    if (!filename || advertiserId == null) return false;
    return stagedCtfs.some((c) => c.filename === filename && c.advertiser?.advertiser_id === advertiserId);
  }

  // Canonical form: lowercase, strip ALL whitespace (so "RFPI -4813" and "RFPI-4813"
  // and "rfpi - 4813" all collapse to "rfpi-4813"). Used for tolerant comparison
  // between CTF RFPI codes and Octillion's line_item_name prefixes.
  function canonicalizeRfpi(s) {
    return String(s ?? "").toLowerCase().replace(/\s+/g, "");
  }

  // Canonicalize a CTF RFPI CODE (not a line_item_name) for matching. Bare-digit
  // codes get the "rfpi-" prefix so they match against line_item names like
  // "RFPI-4772073_Foo". Without this, bare-digit CTFs only resolve via the
  // inactive+date-overlap fallback (Step 3.5) and miss most line_items.
  function canonicalizeRfpiCode(s) {
    const canon = canonicalizeRfpi(s);
    return /^\d+$/.test(canon) ? `rfpi-${canon}` : canon;
  }

  function bucketLineItemsByRfpi(lineItems, rfpiCodes) {
    const out = {};
    if (!Array.isArray(lineItems) || !Array.isArray(rfpiCodes)) return out;
    const normalizedCodes = rfpiCodes
      .map((c) => ({ raw: c, canon: canonicalizeRfpiCode(c) })) // CODE-side normalization
      .filter((c) => c.canon.length > 0)
      .sort((a, b) => b.canon.length - a.canon.length); // longer codes first
    for (const code of normalizedCodes) out[code.raw] = [];
    for (const li of lineItems) {
      if (!li || typeof li.line_item_name !== "string") continue;
      const nameCanon = canonicalizeRfpi(li.line_item_name);
      if (!nameCanon) continue;
      for (const { raw, canon } of normalizedCodes) {
        // Match if canon is the full name, or name starts with canon followed by
        // an underscore or any alphanumeric-boundary marker. Since we've stripped
        // whitespace, we check for the separator char that would've existed.
        if (nameCanon === canon || nameCanon.startsWith(canon + "_") ||
            // Also allow any non-digit char right after the code (handles cases
            // where whitespace was the only separator and got stripped)
            (nameCanon.startsWith(canon) && !/[0-9]/.test(nameCanon.charAt(canon.length)))) {
          out[raw].push(li.line_item_id);
          break;
        }
      }
    }
    return out;
  }

  function pickCampaignForRfpid(searchResults, rfpid) {
    if (!Array.isArray(searchResults) || searchResults.length === 0) return null;
    if (!rfpid) return null;
    const prefix = String(rfpid).trim();
    const startsExact = (c) => {
      const n = String(c && c.campaign_name || "");
      return n === prefix || n.startsWith(prefix + "_") || n.startsWith(prefix + "-") || n.startsWith(prefix + " ");
    };
    if (searchResults.length === 1) return searchResults[0];
    const exact = searchResults.filter(startsExact);
    const pool = exact.length > 0 ? exact : searchResults;
    const active = pool.find((c) => c.active === true);
    return active || pool[0];
  }

  // ========================================================================
  // Auth + API
  // ========================================================================

  const API_BASE = "https://auth.api.octillion.tv/rest";
  const ACCOUNT_ID = 2;
  const PLATFORM_ID = 1;

  function getToken() {
    const t = localStorage.getItem("token");
    return t ? t.trim() : null;
  }

  function apiFetch(url) {
    const token = getToken();
    if (!token) return Promise.reject(new Error("No JWT in localStorage — reload the Prism tab"));
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        redirect: "manual",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "X-App-Id": "octilliontv" },
        onload: (r) => {
          if (r.status === 401) return reject(new Error("Session expired — refresh the Prism tab and retry"));
          if (r.status >= 400) return reject(new Error(`${r.status} ${r.statusText}: ${r.responseText?.slice(0, 200)}`));
          try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(new Error(`Bad JSON from ${url}: ${e.message}`)); }
        },
        onerror: (e) => reject(new Error(`Network error on ${url}: ${e?.error || "unknown"}`)),
        ontimeout: () => reject(new Error(`Request timed out: ${url}`)),
        timeout: 30000,
      });
    });
  }

  async function paginatedFetchAll(buildUrl, { pageSize = 500, batchSize = 4, maxPages = 20, retryPage1 = false } = {}) {
    const all = [];
    const fetchPage = (p) => apiFetch(buildUrl(p, pageSize));
    let page1Data;
    try {
      page1Data = await fetchPage(1);
    } catch (e) {
      if (retryPage1 && !/Session expired/i.test(e.message || "")) {
        console.warn("[CTF] page 1 failed, retrying:", e.message);
        page1Data = await fetchPage(1);
      } else throw e;
    }
    const page1 = page1Data.results || [];
    all.push(...page1);
    if (page1.length < pageSize) return all;
    let nextPage = 2;
    while (nextPage <= maxPages) {
      const batchPromises = [];
      for (let i = 0; i < batchSize && nextPage + i <= maxPages; i++) {
        batchPromises.push(fetchPage(nextPage + i));
      }
      const settled = await Promise.allSettled(batchPromises);
      let done = false;
      for (const result of settled) {
        if (result.status === "rejected") { done = true; break; }
        const results = result.value.results || [];
        all.push(...results);
        if (results.length < pageSize) { done = true; break; }
      }
      if (done) break;
      nextPage += batchSize;
    }
    return all;
  }

  async function searchAdvertiser(name) {
    const q = new URLSearchParams({
      search: name, account_id: ACCOUNT_ID, platform_id: PLATFORM_ID,
      compact: 1, page_size: 100, sort_by: "advertiser_id", order: "DESC",
    });
    const data = await apiFetch(`${API_BASE}/advertisers?${q}`);
    return data.results || [];
  }

  async function listCreatives(advertiserId) {
    return paginatedFetchAll((page, pageSize) => {
      const q = new URLSearchParams({
        advertiser_id: advertiserId, account_id: ACCOUNT_ID, platform_id: PLATFORM_ID,
        page, page_size: pageSize, sort_by: "updated_at", order: "DESC",
      });
      return `${API_BASE}/creatives?${q}`;
    });
  }

  // ========================================================================
  // TZ scrape
  // ========================================================================

  function scrapeTimezone() {
    const valid = new Set(Intl.supportedValuesOf("timeZone"));
    for (const el of document.querySelectorAll("span.position-relative.font-size-10")) {
      const t = el.textContent.trim();
      if (valid.has(t)) return t;
    }
    // Fallback: any element on the page whose text is a valid IANA.
    for (const el of document.querySelectorAll("span, div")) {
      const t = el.textContent?.trim?.();
      if (t && t.length < 40 && valid.has(t)) return t;
    }
    return null;
  }

  // ========================================================================
  // XLSX parse
  // ========================================================================

  // Each field lists short PREFIX candidates. A column header matches if its
  // normalized form starts with any of these prefixes (followed by space or end).
  // This is robust to Octillion rewording the parenthetical "(must match exact
  // filename...)" hint — we only rely on the first couple of words.
  const HEADER_MAP = {
    creative_name: ["creative name"],
    isci: ["isci code", "isci"],
    station: ["station"],
    rfp_id: ["rfp-id", "rfp id", "rfpid"],
    rfp_line_item_code: ["rfp line items number", "rfp line item number", "rfp line item", "rfp line id", "rfpi"],
    advertiser_name: ["advertiser name"],
    dma: ["dma target location", "dma"],
    premium: ["premium audience select", "premium"],
    creative_state: ["new revision existing creative", "new revision exisiting creative", "new revision existing", "new revision exisiting"],
    rotation: ["creative rotation", "rotation"],
    start_date: ["creative start date", "start date"],
    end_date: ["creative end date", "end date"],
    vast_tag: ["vast tag"],
    click_tracker: ["click thru or click tracker", "click thru", "click tracker"],
    notes: ["notes"],
  };

  // Coerce a cell value into a Date. Handles:
  //   - Date objects (cellDates: true path)
  //   - Excel serial numbers (plain numbers)
  //   - Strings like "4/20/2026", "04/20/26", "2026-04-20" (user-typed dates Excel left as text)
  // Returns a UTC-midnight Date so downstream toISO() extraction via getUTCDate()
  // yields the calendar date the user intended, regardless of the runtime timezone.
  function coerceDateCell(v) {
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    if (typeof v === "number" && isFinite(v)) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      return new Date(epoch.getTime() + v * 86400000);
    }
    if (typeof v === "string" && v.trim()) {
      const s = v.trim();
      // Try "M/D/YYYY" or "M/D/YY" explicitly first (most common CTF format)
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (m) {
        const mo = parseInt(m[1], 10), da = parseInt(m[2], 10);
        let yr = parseInt(m[3], 10);
        if (yr < 100) yr += 2000; // "26" → 2026
        const d = new Date(Date.UTC(yr, mo - 1, da));
        if (!isNaN(d.getTime())) return d;
      }
      // Fallback: Date constructor. Extract local Y/M/D and rebuild as UTC midnight
      // so a timezone shift doesn't slide the calendar day.
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) {
        return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
      }
    }
    return null;
  }

  let lastHiddenRowCount = 0;

  function getHiddenRows(wsRows) {
    const hidden = new Set();
    if (!Array.isArray(wsRows)) return hidden;
    wsRows.forEach((r, i) => { if (r && r.hidden) hidden.add(i); });
    return hidden;
  }

  function parseInputXlsx(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { cellDates: true, cellStyles: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const hiddenRows = getHiddenRows(ws["!rows"]);
    lastHiddenRowCount = hiddenRows.size;
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    if (raw.length < 2) throw new Error("xlsx has no data rows");

    const headerRow = raw[0].map((h, ci) => {
      if (h instanceof Date || (h && typeof h === "object" && !(typeof h === "string"))) {
        const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
        const cell = ws[addr];
        if (cell && typeof cell.v === "string") return normalizeName(cell.v);
      }
      return normalizeName(h);
    });
    const colIndex = {};
    for (const [field, candidates] of Object.entries(HEADER_MAP)) {
      const normCandidates = candidates.map(normalizeName);
      const idx = headerRow.findIndex((h) => matchHeader(h, normCandidates));
      if (idx !== -1) colIndex[field] = idx;
    }
    console.log("[CTF] Header → field mapping:", Object.fromEntries(
      Object.entries(colIndex).map(([field, idx]) => [field, headerRow[idx]])
    ));
    const required = ["creative_name", "advertiser_name", "rotation", "start_date", "end_date"];
    const missing = required.filter((f) => colIndex[f] == null);
    if (missing.length) throw new Error(`xlsx missing required columns: ${missing.join(", ")}`);

    const rows = [];
    for (let r = 1; r < raw.length; r++) {
      if (hiddenRows.has(r)) {
        console.log(`[CTF] skipping row ${r + 1}: hidden in spreadsheet`);
        continue;
      }
      const row = raw[r];
      if (isBlankDataRow(row, colIndex)) {
        // Log slow-path skips (rows that LOOK populated by .every-check but have
        // all required cells empty) so future "where did my row go?" debugging
        // is possible. Fast-path all-null rows stay silent (boring case).
        const allCellsEmpty = !row || row.every(isCellEmpty);
        if (!allCellsEmpty) {
          console.log(`[CTF] skipping row ${r + 1}: required cells all empty (Excel formatting artifact?)`);
        }
        continue;
      }
      const cnIdx = colIndex.creative_name;
      const isciIdx = colIndex.isci;
      const cnVal = cnIdx != null ? row[cnIdx] : undefined;
      const isciVal = isciIdx != null ? row[isciIdx] : undefined;
      if (isCellEmpty(cnVal) && isCellEmpty(isciVal)) {
        console.log(`[CTF] skipping row ${r + 1}: creative_name and isci both empty (reference row)`);
        continue;
      }
      const obj = {};
      for (const field of Object.keys(colIndex)) {
        if (field === "rotation") {
          // Excel stores percent-formatted cells as decimals: "100%" is internally 1.0
          // and "25%" is 0.25. That collides with plain-number "1" (which means 1% in
          // our convention). Disambiguate using SheetJS's computed display string
          // (cell.w): if it ends in "%", Excel is showing a percent to the user, so we
          // pass that string ("100%", "25%") to coerceRotation instead of the raw decimal.
          const addr = XLSX.utils.encode_cell({ r, c: colIndex[field] });
          const cell = ws[addr];
          const displayIsPercent = cell && typeof cell.w === "string" && /%\s*$/.test(cell.w);
          if (displayIsPercent && typeof cell.v === "number") {
            obj[field] = cell.w.trim();
          } else {
            obj[field] = row[colIndex[field]];
          }
        } else if (field === "start_date" || field === "end_date") {
          // CTFs in the wild often have dates typed as plain text ("4/20/2026") that
          // Excel never converted to a date cell, so SheetJS returns a string. Coerce
          // to a Date here so validation passes and toISO() extracts the right calendar day.
          obj[field] = coerceDateCell(row[colIndex[field]]);
        } else {
          obj[field] = row[colIndex[field]];
        }
      }
      rows.push(obj);
    }
    return rows;
  }

  // ========================================================================
  // Output xlsx — template-based (Prism sample as the wrapper, our data spliced in)
  //
  // Prism rejects hand-built xlsx with a vague "not in the format" error but accepts
  // files built FROM its own sample. Empirical finding (2026-04-23): pasting our
  // data rows INTO the sample workbook produces a working upload. So we embed the
  // sample file as a base64 blob, load it with ExcelJS on generate, splice our
  // data rows into the Main sheet starting at row 2, and write the workbook back.
  // All of the sample's cosmetics (bold green header row, tooltips, column widths,
  // the "Creative Template IDs" reference sheet) are preserved verbatim.
  // ========================================================================

  const TEMPLATE_XLSX_B64 = "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";

  function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    return buf;
  }

  async function downloadXlsx(outputRows, filename = "bulk-associate-line-items.xlsx") {
    if (typeof ExcelJS === "undefined") {
      throw new Error("ExcelJS library didn't load. Refresh the Prism tab and retry.");
    }
    const templateBuf = base64ToArrayBuffer(TEMPLATE_XLSX_B64);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(templateBuf);
    const main = wb.getWorksheet("Main");
    if (!main) throw new Error("Template is missing the Main sheet. Template corrupted?");

    // Strip all data rows (row 2 onwards). CRITICAL: spliceRows(2, N) is a no-op
    // on this sheet because rows 3-999 are styled-but-empty. Looping bottom-up and
    // deleting one row at a time is the only approach that actually shrinks rowCount.
    // Verified empirically: after the loop, rowCount === 1 and addRow appends at row 2.
    const initialRowCount = main.rowCount;
    for (let r = initialRowCount; r >= 2; r--) {
      main.spliceRows(r, 1);
    }

    // Append our rows. Data types flow through: numbers stay numbers, strings stay
    // strings — matches the sample's column types exactly.
    const header = ["advertiser_id", "creative_id", "line_items", "weight", "start_date", "end_date"];
    outputRows.forEach((row) => {
      const rowValues = header.map((h) => row[h] == null ? "" : row[h]);
      main.addRow(rowValues);
    });

    const outBuf = await wb.xlsx.writeBuffer();
    const blob = new Blob([outBuf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ========================================================================
  // Panel UI
  // ========================================================================

  const CSS = `
    #prt-button { position: fixed; bottom: 24px; right: 24px; z-index: 2147483646;
      background: #1a73e8; color: white; border: none; border-radius: 24px;
      padding: 12px 20px; font: 600 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 3px 12px rgba(26,115,232,.35); cursor: pointer;
      transition: background .15s, box-shadow .15s, transform .1s; letter-spacing: .2px; }
    #prt-button:hover { background: #155ec1; box-shadow: 0 5px 16px rgba(26,115,232,.5); }
    #prt-button:active { transform: translateY(1px); }

    #prt-panel { position: fixed; top: 56px; right: 24px; width: 620px; max-height: 84vh;
      overflow-y: auto; background: #fff; color: #1f2937; z-index: 2147483647;
      border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 12px 40px rgba(15,23,42,.18);
      padding: 22px 24px 20px; font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }

    #prt-panel h3 { margin: 0 0 4px; font-size: 18px; font-weight: 700; color: #0f172a;
      letter-spacing: -.01em; }
    #prt-panel .prt-subtitle { color: #64748b; font-size: 12px; margin-bottom: 18px;
      padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
    #prt-panel h4 { margin: 18px 0 8px; font-size: 11px; font-weight: 700; color: #475569;
      text-transform: uppercase; letter-spacing: .08em; }

    #prt-panel .prt-drop { border: 2px dashed #94a3b8; background: #f8fafc; border-radius: 8px;
      padding: 32px 20px; text-align: center; color: #475569; cursor: pointer;
      transition: border-color .15s, background .15s; }
    #prt-panel .prt-drop:hover { border-color: #1a73e8; background: #eff6ff; }
    #prt-panel .prt-drop.dragover { border-color: #1a73e8; background: #dbeafe; }
    #prt-panel .prt-drop strong { display: block; font-size: 15px; color: #0f172a; margin-bottom: 4px; }
    #prt-panel .prt-drop .prt-meta { margin-top: 4px; }
    #prt-panel .prt-instruct { background: #fef3c7; border: 1px solid #fde68a;
      color: #78350f; border-radius: 6px; padding: 10px 12px; margin-top: 12px;
      font-size: 13px; line-height: 1.5; }
    #prt-panel .prt-instruct strong { color: #451a03; }

    #prt-panel table { width: 100%; border-collapse: collapse; margin: 6px 0 2px; font-size: 13px; }
    #prt-panel th { text-align: left; font-size: 11px; font-weight: 600; color: #64748b;
      padding: 6px 8px; border-bottom: 1px solid #e5e7eb;
      text-transform: uppercase; letter-spacing: .05em; }
    #prt-panel td { padding: 9px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    #prt-panel tr:last-child td { border-bottom: none; }

    #prt-panel input[type=text], #prt-panel select { width: 100%; padding: 6px 9px;
      border: 1px solid #cbd5e1; border-radius: 5px; font-size: 13px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; box-sizing: border-box;
      background: #fff; transition: border-color .15s, box-shadow .15s; }
    #prt-panel input[type=text]:focus, #prt-panel select:focus { outline: none;
      border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,.15); }

    #prt-panel .prt-err { color: #991b1b; background: #fef2f2; border: 1px solid #fecaca;
      padding: 12px 14px; border-radius: 6px; margin: 6px 0; white-space: pre-wrap;
      font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.6; }
    #prt-panel .prt-warn { color: #78350f; background: #fef3c7; border: 1px solid #fde68a;
      padding: 10px 12px; border-radius: 6px; margin: 6px 0; font-size: 13px; }
    #prt-panel .prt-ok { color: #047857; font-weight: 600; }
    #prt-panel .prt-bad { color: #b91c1c; font-weight: 600; }

    #prt-panel .prt-pill { display: inline-block; padding: 2px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 600; letter-spacing: .02em; white-space: nowrap; }
    #prt-panel .prt-pill-ok { background: #d1fae5; color: #065f46; }
    #prt-panel .prt-pill-warn { background: #fef3c7; color: #78350f; }
    #prt-panel .prt-pill-bad { background: #fee2e2; color: #991b1b; }

    #prt-panel button.prt-go { background: #1a73e8; color: white; border: none; border-radius: 6px;
      padding: 10px 20px; font-weight: 600; font-size: 14px; cursor: pointer; margin-top: 14px;
      transition: background .15s, box-shadow .15s; letter-spacing: .2px; }
    #prt-panel button.prt-go:hover:not(:disabled) { background: #155ec1; box-shadow: 0 2px 8px rgba(26,115,232,.3); }
    #prt-panel button.prt-go:disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; }
    #prt-panel button.prt-close { background: transparent; border: none; color: #94a3b8; float: right;
      cursor: pointer; font-size: 20px; line-height: 1; padding: 0 4px; margin-top: -2px;
      transition: color .15s; }
    #prt-panel button.prt-close:hover { color: #1f2937; }

    #prt-panel .prt-meta { color: #64748b; font-size: 12px; }
    #prt-panel code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #334155; }
    #prt-panel .prt-offset { font-size: 15px; font-weight: 600; color: #0f172a; padding: 4px 10px;
      background: #f1f5f9; border-radius: 5px; font-family: ui-monospace, monospace; }
    #prt-panel .prt-label-cell { color: #0f172a; font-weight: 500; }

    /* Accordion (staged CTFs list) */
    #prt-panel .prt-ctf { border: 1px solid #e5e7eb; border-radius: 8px; margin: 8px 0;
      background: #fff; transition: box-shadow .15s; }
    #prt-panel .prt-ctf.prt-ctf-expanded { box-shadow: 0 2px 8px rgba(15,23,42,.06); }
    #prt-panel .prt-ctf-summary { display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; cursor: pointer; user-select: none;
      border-radius: 8px; transition: background .12s; }
    #prt-panel .prt-ctf-summary:hover { background: #f8fafc; }
    #prt-panel .prt-ctf-caret { color: #94a3b8; font-size: 12px; width: 12px;
      transition: transform .15s; }
    #prt-panel .prt-ctf-expanded .prt-ctf-caret { transform: rotate(90deg); }
    #prt-panel .prt-ctf-idx { color: #94a3b8; font-weight: 700; font-size: 13px;
      font-family: ui-monospace, monospace; min-width: 24px; }
    #prt-panel .prt-ctf-title { flex: 1; color: #0f172a; font-weight: 600; font-size: 14px; }
    #prt-panel .prt-ctf-meta { color: #64748b; font-size: 12px; margin-left: 8px; font-weight: 400; }
    #prt-panel .prt-ctf-remove { background: transparent; border: 1px solid #e5e7eb;
      color: #94a3b8; border-radius: 4px; width: 26px; height: 26px; cursor: pointer;
      font-size: 14px; line-height: 1; padding: 0; transition: all .12s; }
    #prt-panel .prt-ctf-remove:hover { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
    #prt-panel .prt-ctf-body { padding: 0 14px 14px; border-top: 1px solid #f1f5f9; }

    /* Secondary (outline) button for "+Add another" */
    #prt-panel button.prt-go-secondary { background: #fff; color: #1a73e8;
      border: 1px solid #1a73e8; border-radius: 6px; padding: 10px 20px;
      font-weight: 600; font-size: 14px; cursor: pointer; margin-top: 14px; margin-left: 8px;
      transition: background .15s; letter-spacing: .2px; }
    #prt-panel button.prt-go-secondary:hover:not(:disabled) { background: #eff6ff; }

    /* Bottom action bar */
    #prt-panel .prt-actions { margin-top: 4px; display: flex; gap: 0; align-items: center; }
  `;

  function injectStyle() {
    if (document.getElementById("prt-style")) return;
    const s = document.createElement("style");
    s.id = "prt-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function mountButton() {
    if (document.getElementById("prt-button")) return;
    const btn = document.createElement("button");
    btn.id = "prt-button";
    btn.textContent = "CTF → Bulk Form";
    btn.onclick = togglePanel;
    document.body.appendChild(btn);
  }

  // ========================================================================
  // App state (single source of truth for multi-CTF)
  // ========================================================================
  //
  //   stagedCtfs: Array of staged-CTF objects (see stageCtf for shape).
  //   stage:      "drop" | "resolving" | "review" | "done"
  //   currentExpandedId:   id of the expanded CTF in review stage
  //   advertiserCache:     name → {advertiser} (per-session, refetched on reload)
  //   creativeCache:       advertiser_id → [creatives]
  //   ianaTz:              scraped once on first CTF stage, shared across all
  //   resolvingMessage, errorMessages, doneState: stage-specific props
  //
  // State is mutated via reducers below. Render always reads appState directly.
  let appState = freshAppState();

  function freshAppState() {
    return {
      stage: "drop",
      stagedCtfs: [],
      currentExpandedId: null,
      advertiserCache: {},
      creativeCache: {},
      lineItemCache: {},
      campaignCache: {},
      ianaTz: "",
      resolvingMessage: "",
      errorMessages: [],
      doneState: null,
      hiddenRowCount: 0,
    };
  }

  function togglePanel() {
    const existing = document.getElementById("prt-panel");
    if (existing) { existing.remove(); return; }
    // Keep state across re-open so the user doesn't lose staged CTFs if they accidentally close.
    if (!appState) appState = freshAppState();
    renderPanel();
  }

  function renderPanel() {
    const existing = document.getElementById("prt-panel");
    if (existing) existing.remove();
    const panel = document.createElement("div");
    panel.id = "prt-panel";
    panel.innerHTML = `
      <button class="prt-close" id="prt-close-btn">✕</button>
      <h3>CTF → Bulk Form</h3>
      <div class="prt-subtitle">Convert a Creative Trafficking Form into a Prism bulk-associate upload.</div>
      <div id="prt-body"></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector("#prt-close-btn").onclick = () => panel.remove();

    const body = panel.querySelector("#prt-body");
    if (appState.stage === "drop") renderDrop(body);
    else if (appState.stage === "resolving") renderResolving(body);
    else if (appState.stage === "review") renderReview(body);
    else if (appState.stage === "done") renderDone(body);
  }

  function renderDrop(body) {
    const staged = appState.stagedCtfs.length;
    body.innerHTML = `
      <div class="prt-drop" id="prt-drop">
        <strong>Drop CTF xlsx here</strong>
        <div class="prt-meta">or click to browse</div>
        <input type="file" id="prt-file" accept=".xlsx" style="display:none">
      </div>
      <div class="prt-instruct">
        <strong>Before uploading:</strong> delete any rows from the CTF you don't want to update.
        Every row left in the file will be written to the output form.
      </div>
      ${appState.errorMessages.length ? `<h4 style="color:#991b1b">Couldn't process last file</h4><div class="prt-err">${appState.errorMessages.join("\n")}</div>` : ""}
      ${staged > 0 ? `
        <div class="prt-meta" style="margin-top:14px">
          ${staged} CTF${staged === 1 ? "" : "s"} already staged.
          <a href="#" id="prt-back-to-review" style="color:#1a73e8;text-decoration:none;font-weight:600">Back to review</a>
        </div>
      ` : ""}
    `;
    const drop = body.querySelector("#prt-drop");
    const fileInput = body.querySelector("#prt-file");
    drop.onclick = () => fileInput.click();
    fileInput.onchange = (e) => stageCtf(e.target.files[0]);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("dragover"); };
    drop.ondragleave = () => drop.classList.remove("dragover");
    drop.ondrop = (e) => {
      e.preventDefault();
      drop.classList.remove("dragover");
      if (e.dataTransfer.files[0]) stageCtf(e.dataTransfer.files[0]);
    };
    const back = body.querySelector("#prt-back-to-review");
    if (back) back.onclick = (e) => { e.preventDefault(); appState.stage = "review"; appState.errorMessages = []; renderPanel(); };
  }

  function renderResolving(body) {
    body.innerHTML = `
      <div style="padding:24px 0;text-align:center;color:#475569">
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">${appState.resolvingMessage || "Loading..."}</div>
        <div class="prt-meta">One moment...</div>
      </div>
    `;
  }

  function renderReview(body) {
    let displayOffset = "(unknown)";
    if (appState.ianaTz) {
      try { displayOffset = tzOffsetForDate(new Date(), appState.ianaTz); } catch { /* leave unknown */ }
    }
    const n = appState.stagedCtfs.length;
    // Per-advertiser failures from the latest staging attempt — surface above
    // the accordion so the user sees them even after stage transitions to review.
    const partialErrorBanner = appState.errorMessages.length > 0
      ? `<div class="prt-warn"><strong>Some advertisers couldn't be staged:</strong><br>${appState.errorMessages.map(escapeHtml).join("<br>")}</div>`
      : "";
    const hiddenRowBanner = appState.hiddenRowCount > 0
      ? `<div style="background:#e0f2fe;border:1px solid #7dd3fc;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:13px;color:#0c4a6e">${appState.hiddenRowCount} hidden row${appState.hiddenRowCount === 1 ? "" : "s"} skipped from spreadsheet</div>`
      : "";
    body.innerHTML = `
      ${partialErrorBanner}
      ${hiddenRowBanner}
      <h4>Staged CTFs <span class="prt-meta" style="font-weight:400;text-transform:none;letter-spacing:0">· ${n}</span></h4>
      <div id="prt-ctf-list"></div>

      <h4>Time offset</h4>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="prt-offset">${displayOffset}</span>
        <span class="prt-meta">${appState.ianaTz ? "Scraped from page" : "⚠️ could not scrape"}</span>
      </div>
      <div class="prt-meta" style="margin-top:6px">Output uses per-date offsets, so flights crossing DST get the correct offset on each end.</div>

      <div class="prt-actions">
        <button class="prt-go" id="prt-generate">Generate Bulk Form</button>
        <button class="prt-go-secondary" id="prt-add-more">+ Add another CTF</button>
      </div>
      <div class="prt-meta" id="prt-status" style="margin-top:8px"></div>
    `;

    const list = body.querySelector("#prt-ctf-list");
    for (const ctf of appState.stagedCtfs) list.appendChild(renderCtfCard(ctf));

    body.querySelector("#prt-add-more").onclick = () => { appState.stage = "drop"; appState.errorMessages = []; renderPanel(); };
    body.querySelector("#prt-generate").onclick = () => handleGenerate();
    updateGenerateButtonState();
  }

  function renderCtfCard(ctf) {
    const idx = appState.stagedCtfs.indexOf(ctf) + 1;
    const expanded = appState.currentExpandedId === ctf.id;
    const status = computeCtfStatus(ctf);
    const statusPill = status.unresolvedCount > 0
      ? `<span class="prt-pill prt-pill-warn">⚠ ${status.unresolvedCount} unresolved</span>`
      : `<span class="prt-pill prt-pill-ok">ready</span>`;

    const card = document.createElement("div");
    card.className = "prt-ctf" + (expanded ? " prt-ctf-expanded" : "");
    card.dataset.ctfId = ctf.id;
    card.innerHTML = `
      <div class="prt-ctf-summary" data-role="summary">
        <span class="prt-ctf-caret">▶</span>
        <span class="prt-ctf-idx">#${idx}</span>
        <span class="prt-ctf-title">${escapeHtml(ctf.advertiser.advertiser_name)}
          <span class="prt-ctf-meta">· ${Object.keys(ctf.creativeResolution).length} creatives · ${ctf.rows.length} rows · ${escapeHtml(ctf.filename)}</span>
        </span>
        ${statusPill}
        <button class="prt-ctf-remove" data-role="remove" title="Remove this CTF">✕</button>
      </div>
      <div class="prt-ctf-body" style="display:${expanded ? "block" : "none"}"></div>
    `;

    card.querySelector('[data-role="summary"]').onclick = (e) => {
      if (e.target.closest('[data-role="remove"]')) return;
      toggleExpand(ctf.id);
    };
    card.querySelector('[data-role="remove"]').onclick = (e) => { e.stopPropagation(); confirmRemoveCtf(ctf.id); };

    if (expanded) renderCtfBody(ctf, card.querySelector(".prt-ctf-body"));
    return card;
  }

  function renderCtfBody(ctf, container) {
    container.innerHTML = `
      <table>
        <thead><tr><th style="width:40%">Creative</th><th style="width:30%">ID</th><th>Status</th></tr></thead>
        <tbody data-role="creatives-tbody"></tbody>
      </table>
    `;
    const tbody = container.querySelector('[data-role="creatives-tbody"]');
    for (const [key, res] of Object.entries(ctf.creativeResolution)) {
      tbody.appendChild(renderCreativeRow(ctf, key, res));
    }
  }

  function renderCreativeRow(ctf, key, res) {
    const sample = ctf.rows.find((r) => creativeKeyFromRow(r) === key);
    const label = escapeHtml(sample.creative_name + (sample.isci ? ` / ${sample.isci}` : ""));
    const tr = document.createElement("tr");
    tr.dataset.ckey = key;

    if (res.match === "none") {
      const existing = ctf.edits?.manualCreativeIds?.[key] ?? "";
      tr.innerHTML = `<td class="prt-label-cell">${label}</td>
        <td><input type="text" placeholder="paste creative_id" class="prt-manual-cid" value="${existing}"></td>
        <td><span class="prt-pill prt-pill-bad">not found</span></td>`;
      const input = tr.querySelector(".prt-manual-cid");
      input.oninput = () => {
        const val = input.value.trim();
        const parsed = val && /^\d+$/.test(val) ? parseInt(val, 10) : null;
        appState = writeEdit(appState, ctf.id, "manualCreativeIds", key, parsed);
        // Scoped update: summary status badge + generate-button state. No full re-render.
        updateCtfSummaryStatus(ctf.id);
        updateGenerateButtonState();
      };
    } else if (res.match === "multiple") {
      const picked = ctf.edits?.multiPicks?.[key] ?? res.candidates[0].creative_id;
      tr.innerHTML = `<td class="prt-label-cell">${label}</td>
        <td><select class="prt-pick-cid">${res.candidates.map((c) => `<option value="${c.creative_id}"${c.creative_id === picked ? " selected" : ""}>${escapeHtml(c.creative_name)} (${c.creative_id})</option>`).join("")}</select></td>
        <td><span class="prt-pill prt-pill-warn">${res.candidates.length} matches</span></td>`;
      const sel = tr.querySelector(".prt-pick-cid");
      // Seed the default pick into state immediately so Generate uses it without the user touching the dropdown.
      if (ctf.edits?.multiPicks?.[key] == null) {
        appState = writeEdit(appState, ctf.id, "multiPicks", key, picked);
      }
      sel.oninput = () => {
        appState = writeEdit(appState, ctf.id, "multiPicks", key, parseInt(sel.value, 10));
        updateCtfSummaryStatus(ctf.id);
        updateGenerateButtonState();
      };
    } else {
      const approvalPill = res.creative.creative_approval_status === "Approved"
        ? `<span class="prt-pill prt-pill-ok">${res.creative.creative_approval_status}</span>`
        : `<span class="prt-pill prt-pill-warn">${escapeHtml(res.creative.creative_approval_status || "")}</span>`;
      const activePill = res.creative.active
        ? `<span class="prt-pill prt-pill-ok">active</span>`
        : `<span class="prt-pill prt-pill-bad">INACTIVE</span>`;
      tr.innerHTML = `<td class="prt-label-cell">${label}</td>
        <td><code>${res.creative.creative_id}</code></td>
        <td>${approvalPill} ${activePill}</td>`;
    }
    return tr;
  }

  function renderDone(body) {
    const ds = appState.doneState || { outputRowCount: 0, filename: "", warnings: [], resolvedPerCtf: [] };
    const expiryRows = buildExpiryTableRowsForStaged(ds.resolvedPerCtf);
    const hasWarnings = expiryRows.some((r) => r.severity !== "ok" && r.severity !== "manual");

    body.innerHTML = `
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin:8px 0">
        <div style="font-size:15px;font-weight:700;color:#065f46;margin-bottom:4px">✓ Bulk form generated</div>
        <div style="font-size:13px;color:#047857">${ds.outputRowCount} row${ds.outputRowCount === 1 ? "" : "s"} from ${ds.ctfCount} CTF${ds.ctfCount === 1 ? "" : "s"} → <code>${escapeHtml(ds.filename)}</code></div>
      </div>
      ${ds.warnings?.length ? `<div class="prt-warn"><strong>Warnings:</strong><br>${ds.warnings.map(escapeHtml).join("<br>")}</div>` : ""}

      <h4>Check the flight dates to ensure the creative isn't expiring</h4>
      <table id="prt-expiry-table">
        <thead>
          <tr>
            <th style="width:35%">Creative</th>
            <th style="width:22%">Creative expires</th>
            <th style="width:22%">Latest flight end</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      ${hasWarnings ? `<div class="prt-warn" style="margin-top:6px"><strong>⚠️ Review the rows above.</strong> At least one creative expires before or shortly after its flight.</div>` : ""}

      ${(ds.creativeExpiresRows?.length > 0) ? `
        <div style="margin-top:8px;padding:10px 14px;background:#fee2e2;border:1px solid #fecaca;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:8px;" id="prt-ce-reopen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#991b1b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style="color:#991b1b;font-size:13px;font-weight:600;">${ds.creativeExpiresRows.length} creative${ds.creativeExpiresRows.length === 1 ? "" : "s"} expire${ds.creativeExpiresRows.length === 1 ? "s" : ""} before flight ends.</span>
          <span style="color:#b91c1c;font-size:12px;margin-left:auto;text-decoration:underline;">Review</span>
        </div>
      ` : ""}

      <div class="prt-meta" style="margin-top:12px">Upload the downloaded file to Prism.</div>
      <button class="prt-go" id="prt-again">Start over</button>
    `;
    const tbody = body.querySelector("#prt-expiry-table tbody");
    for (const r of expiryRows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="prt-label-cell">${escapeHtml(r.label)}</td>
        <td><code>${r.creativeEndDisplay}</code></td>
        <td><code>${r.flightEndDisplay}</code></td>
        <td><span class="prt-pill ${r.pillClass}">${r.statusLabel}</span></td>
      `;
      tbody.appendChild(tr);
    }
    body.querySelector("#prt-again").onclick = () => { appState = freshAppState(); renderPanel(); };
    const ceReopen = body.querySelector("#prt-ce-reopen");
    if (ceReopen) ceReopen.onclick = () => showCreativeExpiresPopup(ds.creativeExpiresRows);
    const ceRows = ds.creativeExpiresRows || [];
    if (ceRows.length > 0) showCreativeExpiresPopup(ceRows);
  }

  function showCreativeExpiresPopup(rows) {
    const existing = document.getElementById("prt-ce-popup");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "prt-ce-popup";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,.55);z-index:2147483647;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);";

    const popup = document.createElement("div");
    popup.style.cssText = "background:#fff;border-radius:12px;box-shadow:0 16px 48px rgba(15,23,42,.3),0 0 0 1px rgba(15,23,42,.06);padding:0;max-width:760px;width:92vw;max-height:80vh;overflow:hidden;font:14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;display:flex;flex-direction:column;";

    const tableId = "prt-ce-table";
    const count = rows.length;
    popup.innerHTML = `
      <div style="background:linear-gradient(135deg,#991b1b 0%,#b91c1c 100%);padding:18px 24px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:14px;position:relative;">
        <div style="background:rgba(255,255,255,.18);border-radius:10px;width:42px;height:42px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div style="flex:1;">
          <h3 style="margin:0;font-size:17px;font-weight:700;color:#fff;">Creative Expires Before Flight Ends</h3>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.8);">${count} creative${count === 1 ? "" : "s"} will stop serving before ${count === 1 ? "its" : "their"} flight${count === 1 ? "" : "s"} end${count === 1 ? "s" : ""}</p>
        </div>
        <button id="prt-ce-close" style="background:rgba(255,255,255,.15);border:none;color:#fff;cursor:pointer;font-size:18px;line-height:1;padding:4px 8px;border-radius:6px;position:absolute;top:14px;right:14px;" onmouseover="this.style.background='rgba(255,255,255,.3)'" onmouseout="this.style.background='rgba(255,255,255,.15)'">✕</button>
      </div>
      <div style="padding:16px 24px 20px;overflow-y:auto;flex:1;">
        <table id="${tableId}" style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #e2e8f0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.03em">Creative Name</th>
              <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #e2e8f0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.03em">RFPI Code</th>
              <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #e2e8f0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.03em">Creative End</th>
              <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #e2e8f0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.03em">Flight End</th>
              <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #e2e8f0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.03em">Status</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <div style="margin-top:16px;padding:12px 14px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;color:#78350f;font-size:13px;display:flex;align-items:flex-start;gap:8px;">
          <span style="font-size:16px;line-height:1.3;flex-shrink:0;">&#9888;</span>
          <span><strong>Action needed:</strong> Update the team creative doc to include this flight in expiring creatives.</span>
        </div>
      </div>
    `;

    const popupTbody = popup.querySelector(`#${tableId} tbody`);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const stripe = i % 2 === 1 ? "background:#f8fafc;" : "";
      const tr = document.createElement("tr");
      tr.style.cssText = stripe;
      tr.innerHTML = `
        <td style="padding:10px 10px;border-bottom:1px solid #f1f5f9;font-weight:500;">${escapeHtml(r.creativeName)}</td>
        <td style="padding:10px 10px;border-bottom:1px solid #f1f5f9;"><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;">${escapeHtml(r.rfpiCode)}</code></td>
        <td style="padding:10px 10px;border-bottom:1px solid #f1f5f9;"><code style="font-size:12px;">${r.creativeEndDisplay}</code></td>
        <td style="padding:10px 10px;border-bottom:1px solid #f1f5f9;"><code style="font-size:12px;">${r.flightEndDisplay}</code></td>
        <td style="padding:10px 10px;border-bottom:1px solid #f1f5f9;"><span style="display:inline-block;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;background:#fee2e2;color:#991b1b;white-space:nowrap;">${r.statusLabel}</span></td>
      `;
      popupTbody.appendChild(tr);
    }

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    popup.querySelector("#prt-ce-close").onclick = () => overlay.remove();
  }

  // ------------------------------------------------------------------------
  // Scoped re-render helpers (preserve input focus/caret on edits)
  // ------------------------------------------------------------------------
  function updateCtfSummaryStatus(ctfId) {
    const card = document.querySelector(`.prt-ctf[data-ctf-id="${ctfId}"]`);
    if (!card) return;
    const pillHolder = card.querySelector(".prt-ctf-summary");
    if (!pillHolder) return;
    const ctf = appState.stagedCtfs.find((c) => c.id === ctfId);
    if (!ctf) return;
    const status = computeCtfStatus(ctf);
    const oldPill = pillHolder.querySelector(".prt-pill");
    const newPillHtml = status.unresolvedCount > 0
      ? `<span class="prt-pill prt-pill-warn">⚠ ${status.unresolvedCount} unresolved</span>`
      : `<span class="prt-pill prt-pill-ok">ready</span>`;
    if (oldPill) oldPill.outerHTML = newPillHtml;
  }

  function updateGenerateButtonState() {
    const btn = document.querySelector("#prt-generate");
    if (!btn) return;
    const ready = appState.stagedCtfs.length > 0
      && appState.stagedCtfs.every((c) => computeCtfStatus(c).unresolvedCount === 0)
      && !!appState.ianaTz;
    btn.disabled = !ready;
  }

  function computeCtfStatus(ctf) {
    let unresolvedCount = 0;
    for (const [key, res] of Object.entries(ctf.creativeResolution)) {
      if (res.match === "none") {
        const pasted = ctf.edits?.manualCreativeIds?.[key];
        if (pasted == null || Number.isNaN(pasted)) unresolvedCount++;
      }
      // multiple: auto-seeded to first candidate on render, so always "resolved"
    }
    return { unresolvedCount };
  }

  // ------------------------------------------------------------------------
  // Expand / collapse / remove
  // ------------------------------------------------------------------------
  function toggleExpand(ctfId) {
    appState.currentExpandedId = appState.currentExpandedId === ctfId ? null : ctfId;
    renderPanel();
  }

  function confirmRemoveCtf(ctfId) {
    const ctf = appState.stagedCtfs.find((c) => c.id === ctfId);
    if (!ctf) return;
    const hasEdits = Object.keys(ctf.edits?.manualCreativeIds || {}).some((k) => ctf.edits.manualCreativeIds[k] != null);
    const msg = hasEdits
      ? `Remove "${ctf.filename}"? Your manually-pasted creative IDs for this CTF will be lost.`
      : `Remove "${ctf.filename}"?`;
    if (!confirm(msg)) return;
    appState.stagedCtfs = appState.stagedCtfs.filter((c) => c.id !== ctfId);
    if (appState.currentExpandedId === ctfId) appState.currentExpandedId = null;
    if (appState.stagedCtfs.length === 0) { appState.stage = "drop"; appState.errorMessages = []; }
    renderPanel();
  }

  // ------------------------------------------------------------------------
  // Cached API helpers
  // ------------------------------------------------------------------------
  async function cachedSearchAdvertiser(name) {
    const k = normalizeName(name);
    if (appState.advertiserCache[k]) return appState.advertiserCache[k];
    const results = await searchAdvertiser(name);
    appState.advertiserCache[k] = results;
    return results;
  }

  async function cachedListCreatives(advertiserId) {
    if (appState.creativeCache[advertiserId]) return appState.creativeCache[advertiserId];
    const results = await listCreatives(advertiserId);
    appState.creativeCache[advertiserId] = results;
    return results;
  }

  // Fetch every line_item whose name contains the RFPI code. Uses the same search
  // pattern Prism's UI uses. Includes active AND inactive (user-confirmed decision
  // — inactive "Wild Card Placeholder" LIs are still required to be associated).
  // Safety filter: only keep results whose line_item_name STARTS WITH the exact
  // RFPI code — guards against substring false positives across codes.
  async function cachedListLineItemsForRfpi(rfpiCode) {
    const key = String(rfpiCode).trim();
    if (appState.lineItemCache[key]) return appState.lineItemCache[key];
    const all = await paginatedFetchAll((page, pageSize) => {
      const q = new URLSearchParams({
        search: key, search_type: "include",
        account_id: ACCOUNT_ID, platform_id: PLATFORM_ID, paranoid: 1,
        sort_by: "line_item_id", order: "ASC",
        page, page_size: pageSize,
      });
      return `${API_BASE}/line_items?${q}`;
    });
    // CODE-side normalization: bare-digit CTF codes → "rfpi-DDDDD" so they match
    // line_item_names that have the "RFPI-" prefix.
    const keyCanon = canonicalizeRfpiCode(key);
    const matched = all.filter((li) => {
      if (typeof li.line_item_name !== "string") return false;
      const nameCanon = canonicalizeRfpi(li.line_item_name);
      if (!nameCanon || !keyCanon) return false;
      return nameCanon === keyCanon
        || nameCanon.startsWith(keyCanon + "_")
        || (nameCanon.startsWith(keyCanon) && !/[0-9]/.test(nameCanon.charAt(keyCanon.length)));
    });
    const droppedBySafety = all.length - matched.length;
    console.log(`[CTF] per-RFPI search "${key}" → ${all.length} raw result(s), ${matched.length} matched after safety filter`);
    if (all.length > 0 && matched.length === 0) {
      console.log(`[CTF] DIAG: all ${all.length} result(s) dropped. First 5 names returned for search "${key}":`);
      for (const li of all.slice(0, 5)) console.log(`[CTF]   "${li.line_item_name}" (id=${li.line_item_id})`);
    }
    const maxEndDate = matched.reduce((best, li) => {
      if (!li.end_date) return best;
      return (!best || li.end_date > best) ? li.end_date : best;
    }, null);
    const result = {
      ids: matched.map((li) => li.line_item_id),
      totalFetched: all.length,
      droppedBySafety,
      maxEndDate,
    };
    appState.lineItemCache[key] = result;
    return result;
  }

  // v0.7 fast path: find the campaign_id behind an RFPID. Cached per session.
  //
  // Campaigns in Octillion always have names prefixed "RFPID-NNNNN_...". CTFs
  // store the RFPID either as a plain number (255743) or with the prefix
  // ("RFPID-255743"). Normalize to the prefixed form before searching so the
  // substring match is tight — bare numeric searches can collide with other
  // campaigns whose names contain the digit sequence elsewhere.
  //
  // Fallback: if prefixed search returns zero and the original was bare numeric,
  // retry with the bare form (defensive — covers edge cases where Octillion
  // doesn't have "RFPID-" in the campaign_name for some historical records).
  // Returns an ARRAY of {id, name} for every campaign matching this RFPID.
  // A single RFPID can span multiple campaigns (different markets / products);
  // picking one and ignoring the rest loses line_items in the siblings.
  async function cachedFindCampaignIdsForRfpid(rfpid) {
    const raw = String(rfpid).trim();
    if (!raw) return [];
    // Normalize: if purely digits (optionally with leading/trailing ws), prepend "RFPID-".
    const normalized = /^\d+$/.test(raw) ? `RFPID-${raw}` : raw;
    if (appState.campaignCache[normalized] !== undefined) return appState.campaignCache[normalized];

    const searchOnce = async (searchKey) => {
      const q = new URLSearchParams({
        page: 1, page_size: 100,
        sort_by: "active", order: "DESC",
        compact: 1, paranoid: 1,
        search: searchKey,
        account_id: ACCOUNT_ID, platform_id: PLATFORM_ID,
      });
      const data = await apiFetch(`${API_BASE}/campaigns?${q}`);
      return data.results || [];
    };

    let results = await searchOnce(normalized);
    console.log(`[CTF] campaigns search "${normalized}" → ${results.length} result${results.length === 1 ? "" : "s"}${results.length > 0 ? ` (first: "${results[0].campaign_name}" id=${results[0].campaign_id})` : ""}`);

    // Defensive fallback: if prefixed returned zero and the input was numeric, try bare.
    if (results.length === 0 && normalized !== raw) {
      console.log(`[CTF] retrying campaigns search with bare "${raw}"`);
      results = await searchOnce(raw);
      console.log(`[CTF] campaigns search "${raw}" → ${results.length} result${results.length === 1 ? "" : "s"}`);
    }

    // Keep ALL campaigns whose name starts with the RFPID prefix — siblings split
    // by market/product still carry line_items the CTF needs. Active-first ordering.
    const prefix = normalized;
    const startsWithPrefix = (c) => {
      const n = String((c && c.campaign_name) || "");
      return n === prefix || n.startsWith(prefix + "_") || n.startsWith(prefix + "-") || n.startsWith(prefix + " ");
    };
    let matching = results.filter(startsWithPrefix);
    if (matching.length === 0 && results.length > 0) matching = results; // degrade gracefully
    matching.sort((a, b) => (b.active === true) - (a.active === true));
    const value = matching.map((c) => ({ id: c.campaign_id, name: c.campaign_name }));
    if (value.length > 0) console.log(`[CTF] RFPID ${raw} → ${value.length} campaign(s): ${value.map((v) => `${v.id} ("${v.name}")`).join(", ")}`);
    else console.log(`[CTF] RFPID ${raw} → NO CAMPAIGN (will fall back to per-RFPI search)`);
    appState.campaignCache[normalized] = value;
    return value;
  }

  // v0.7 fast path: batch-fetch line_items for multiple campaigns in one call.
  // Retries once on transient failure. Caller handles retry-exhausted fallback.
  async function fetchLineItemsByCampaignIds(campaignIds) {
    if (!Array.isArray(campaignIds) || campaignIds.length === 0) return [];
    const joined = campaignIds.join(",");
    return paginatedFetchAll((page, pageSize) => {
      const q = new URLSearchParams({
        sort_by: "line_item_id", order: "ASC",
        page, page_size: pageSize,
        paranoid: 1,
        in_campaign_ids: joined,
        account_id: ACCOUNT_ID, platform_id: PLATFORM_ID,
      });
      return `${API_BASE}/line_items?${q}`;
    }, { retryPage1: true });
  }

  // ------------------------------------------------------------------------
  // Stage a new CTF (the primary entry point from the drop zone)
  // ------------------------------------------------------------------------
  //
  // v0.9: multi-advertiser CTFs supported. Pipeline:
  //   parse → validate → groupRowsByAdvertiserName
  //   → for each advertiser group: processAdvertiserGroup(filename, rows)
  //     → push success to stagedCtfs OR collect per-advertiser error
  //   → final state: review (if any success) or drop (if total failure)
  //
  // Failure isolation: one advertiser failing (not in Octillion, dup-block,
  // etc.) does NOT abort the others. Errors land in errorMessages and render
  // as a yellow banner above the accordion in the review view.
  async function stageCtf(file) {
    if (!file) return;
    appState.stage = "resolving";
    appState.resolvingMessage = "Parsing xlsx...";
    renderPanel();

    let rows;
    try {
      const buf = await file.arrayBuffer();
      rows = parseInputXlsx(buf);
      appState.hiddenRowCount = lastHiddenRowCount;
    } catch (e) {
      console.error(e);
      appState.stage = "drop";
      appState.errorMessages = [e.message];
      renderPanel();
      return;
    }

    const errors = validateInputRows(rows);
    if (errors.length) {
      appState.stage = "drop";
      appState.errorMessages = errors;
      renderPanel();
      return;
    }

    // TZ: scrape once per session, before any advertiser processing.
    if (!appState.ianaTz) {
      const scraped = scrapeTimezone();
      if (scraped) appState.ianaTz = scraped;
    }

    const byAdvertiser = groupRowsByAdvertiserName(rows);
    const total = byAdvertiser.size;
    const newStagedCtfs = [];
    const partialErrors = [];
    let i = 0;

    for (const [, advRows] of byAdvertiser) {
      i++;
      const progressPrefix = total > 1 ? `[${i}/${total}] ` : "";
      try {
        const ctf = await processAdvertiserGroup(file.name, advRows, progressPrefix);
        newStagedCtfs.push(ctf);
      } catch (e) {
        console.error(`[CTF] processAdvertiserGroup failed for "${advRows[0].advertiser_name}":`, e);
        partialErrors.push(`Advertiser "${advRows[0].advertiser_name}": ${e.message}`);
      }
    }

    appState.stagedCtfs.push(...newStagedCtfs);
    appState.errorMessages = partialErrors;
    appState.resolvingMessage = "";
    if (newStagedCtfs.length > 0) {
      appState.currentExpandedId = newStagedCtfs[newStagedCtfs.length - 1].id;
      appState.stage = "review";
    } else {
      appState.stage = "drop";
    }
    renderPanel();
  }

  // Resolve one advertiser's worth of rows into a staged CTF object.
  // Throws on hard failures (advertiser not found, ambiguous + cancelled,
  // already staged, session expired). Soft failures (per-RFPI lookup gaps)
  // accumulate in the returned ctf.warnings array.
  async function processAdvertiserGroup(filename, rows, progressPrefix = "") {
    const repAdvName = rows[0].advertiser_name;

    appState.resolvingMessage = `${progressPrefix}Resolving advertiser "${repAdvName}"...`;
    renderPanel();
    const advResults = await cachedSearchAdvertiser(repAdvName);
    const target = normalizeName(repAdvName);
    const exact = advResults.filter((a) => normalizeName(a.advertiser_name) === target);
    let advertiser;
    if (exact.length === 1) advertiser = exact[0];
    else if (exact.length === 0) {
      throw new Error(`not found in Octillion. Create it first, then re-stage.`);
    } else {
      advertiser = await pickAdvertiser(exact);
    }

    if (matchesStagedCtf(filename, advertiser.advertiser_id, appState.stagedCtfs)) {
      throw new Error(`already staged from "${filename}". Remove it first if you want to re-stage.`);
    }

    // v0.7 fast path: batch-fetch line_items via campaigns. See bottom comment for full pipeline.
    const uniqueRfpiCodes = [...new Set(rows.map((r) => r.rfp_line_item_code).filter(Boolean).map((s) => String(s).trim()))];
    const uniqueRfpids = [...new Set(rows.map((r) => r.rfp_id).filter((v) => v != null).map((s) => String(s).trim()).filter(Boolean))];
    const lineItemsByRfpi = {};
    const lineItemEndDatesByRfpi = {};
    const lineItemWarnings = [];
    const rfpidToCampaigns = {};

    // Round 1: resolve creatives + RFPID→campaign_ids (parallel — independent calls)
    appState.resolvingMessage = `${progressPrefix}Resolving creatives and campaigns for ${advertiser.advertiser_name}...`;
    renderPanel();
    const [creatives] = await Promise.all([
      cachedListCreatives(advertiser.advertiser_id),
      (async () => {
        await Promise.all(uniqueRfpids.map(async (rfpid) => {
          try {
            rfpidToCampaigns[rfpid] = await cachedFindCampaignIdsForRfpid(rfpid);
          } catch (e) {
            console.error(`[CTF] Campaign lookup failed for ${rfpid}:`, e);
            rfpidToCampaigns[rfpid] = [];
            lineItemWarnings.push(`Campaign lookup failed for RFPID ${rfpid} — falling back to per-RFPI search.`);
          }
        }));
      })(),
    ]);

    const uniqueKeys = {};
    for (const r of rows) if (!uniqueKeys[creativeKeyFromRow(r)]) uniqueKeys[creativeKeyFromRow(r)] = r;
    const creativeResolution = {};
    for (const [key, sample] of Object.entries(uniqueKeys)) {
      creativeResolution[key] = matchCreative(sample, creatives);
    }
    const resolvedRfpids = uniqueRfpids.filter((r) => (rfpidToCampaigns[r] || []).length > 0);
    const unresolvedRfpids = uniqueRfpids.filter((r) => (rfpidToCampaigns[r] || []).length === 0);
    for (const rfpid of unresolvedRfpids) {
      lineItemWarnings.push(`RFPID ${rfpid} did not resolve to a campaign in Octillion — will fall back to per-RFPI search for its RFPIs.`);
    }

    // Round 2: batch line_items fetch for ALL found campaigns.
    const campaignIds = [...new Set(resolvedRfpids.flatMap((r) => rfpidToCampaigns[r].map((c) => c.id)))];
    let batchLineItems = [];
    let batchFailed = false;
    if (campaignIds.length > 0) {
      appState.resolvingMessage = `${progressPrefix}Fetching line items for ${campaignIds.length} campaign${campaignIds.length === 1 ? "" : "s"}...`;
      renderPanel();
      try {
        batchLineItems = await fetchLineItemsByCampaignIds(campaignIds);
      } catch (e) {
        console.error("[CTF] Batch line_items fetch failed after retry:", e);
        if (/Session expired/i.test(e.message || "")) {
          throw e; // propagate 401 — user needs to refresh tab, no fallback helps
        }
        batchFailed = true;
        lineItemWarnings.push(`Batch line_items fetch failed (${e.message}) — falling back to per-RFPI search for all codes.`);
      }
    }

    // Build line_item_id -> end_date lookup for flight-end-date derivation
    const liEndDateMap = {};
    for (const li of batchLineItems) {
      if (li && li.line_item_id && li.end_date) liEndDateMap[li.line_item_id] = li.end_date;
    }

    // Step 3: client-side bucket
    if (!batchFailed && batchLineItems.length > 0) {
      console.log(`[CTF] batch line_items returned ${batchLineItems.length} item(s); bucketing across ${uniqueRfpiCodes.length} RFPI code(s)`);
      const bucketed = bucketLineItemsByRfpi(batchLineItems, uniqueRfpiCodes);
      for (const code of uniqueRfpiCodes) {
        const count = (bucketed[code] || []).length;
        console.log(`[CTF]   bucket "${code}" → ${count} id(s)${count > 0 ? `: ${bucketed[code].join(", ")}` : ""}`);
        if (count > 0) {
          lineItemsByRfpi[code] = bucketed[code];
          const maxEnd = bucketed[code].reduce((best, id) => {
            const ed = liEndDateMap[id];
            return ed && (!best || ed > best) ? ed : best;
          }, null);
          if (maxEnd) lineItemEndDatesByRfpi[code] = maxEnd;
        }
      }
      const zeroMatchCodes = uniqueRfpiCodes.filter((c) => (bucketed[c] || []).length === 0);
      if (zeroMatchCodes.length > 0) {
        console.log(`[CTF] DIAG: ${zeroMatchCodes.length} code(s) had zero matches.`);
        if (batchLineItems.length > 0) {
          console.log(`[CTF] DIAG: full shape of first line_item (all fields):`);
          console.log(batchLineItems[0]);
          console.log(`[CTF] DIAG: keys:`, Object.keys(batchLineItems[0]));
        }
        for (const code of zeroMatchCodes) {
          const digits = String(code).replace(/\D/g, "");
          if (!digits) continue;
          const hits = [];
          for (const li of batchLineItems) {
            try {
              const asJson = JSON.stringify(li);
              if (asJson.includes(digits)) {
                const found = [];
                for (const [k, v] of Object.entries(li)) {
                  if (v != null && String(JSON.stringify(v)).includes(digits)) found.push(k);
                }
                hits.push({ id: li.line_item_id, name: li.line_item_name, found });
              }
            } catch {}
          }
          if (hits.length > 0) {
            console.log(`[CTF]   "${code}" (digits "${digits}") found in ${hits.length} line_item(s):`);
            for (const h of hits.slice(0, 5)) {
              console.log(`[CTF]     id=${h.id} name="${h.name}" fields_with_digits=[${h.found.join(", ")}]`);
            }
          } else {
            console.log(`[CTF]   "${code}" → digits "${digits}" appear in NO field of any batch line_item`);
          }
        }
      }
    } else {
      console.log(`[CTF] skipping bucketing: batchFailed=${batchFailed}, batchLineItems=${batchLineItems.length}`);
    }

    // Step 3.5: "freshly-pushed campaign" fallback (inactive + date-overlap)
    const nameUnmatched = uniqueRfpiCodes.filter((c) => !lineItemsByRfpi[c] || lineItemsByRfpi[c].length === 0);
    if (nameUnmatched.length > 0 && batchLineItems.length > 0) {
      console.log(`[CTF] ${nameUnmatched.length} code(s) unmatched by name — trying inactive + date-overlap fallback`);
      for (const code of nameUnmatched) {
        const rep = rows.find((r) => String(r.rfp_line_item_code || "").trim() === code);
        if (!rep) continue;
        const rfpid = String(rep.rfp_id || "").trim();
        const campaigns = rfpidToCampaigns[rfpid] || [];
        if (campaigns.length === 0) {
          console.log(`[CTF]   "${code}" has no resolved campaign — skipping`);
          continue;
        }
        const campaignIdSet = new Set(campaigns.map((c) => c.id));
        const rowS = rep.start_date instanceof Date ? rep.start_date.getTime() : null;
        const rowE = rep.end_date instanceof Date ? rep.end_date.getTime() : null;
        if (rowS == null || rowE == null) {
          console.log(`[CTF]   "${code}" CTF row has no flight dates — skipping`);
          continue;
        }
        const matches = batchLineItems.filter((li) => {
          if (!li) return false;
          const cid = li.campaign_id ?? (li.campaign && li.campaign.campaign_id);
          if (!campaignIdSet.has(cid)) return false;
          if (li.active !== false) return false;
          const s = li.start_date ? Date.parse(li.start_date) : NaN;
          const e = li.end_date ? Date.parse(li.end_date) : NaN;
          if (isNaN(s) || isNaN(e)) return false;
          return s <= rowE && e >= rowS;
        });
        if (matches.length > 0) {
          lineItemsByRfpi[code] = matches.map((li) => li.line_item_id);
          const maxEnd = matches.reduce((best, li) => {
            return li.end_date && (!best || li.end_date > best) ? li.end_date : best;
          }, null);
          if (maxEnd) lineItemEndDatesByRfpi[code] = maxEnd;
          console.log(`[CTF]   "${code}" → ${matches.length} inactive+overlapping line_item(s): ${matches.map((li) => `${li.line_item_id} ("${li.line_item_name}")`).join(", ")}`);
        } else {
          console.log(`[CTF]   "${code}" → no inactive line_items with overlapping dates in campaigns [${[...campaignIdSet].join(",")}]`);
        }
      }
    }

    // Step 4: per-RFPI fallback for any RFPI codes that didn't bucket
    const orphanCodes = uniqueRfpiCodes.filter((c) => !lineItemsByRfpi[c] || lineItemsByRfpi[c].length === 0);
    if (orphanCodes.length > 0) {
      if (!batchFailed) {
        console.log(`[CTF] ${orphanCodes.length} RFPI code(s) not found in batch, falling back to per-RFPI: ${orphanCodes.join(", ")}`);
      }
      appState.resolvingMessage = `${progressPrefix}Falling back to per-RFPI search for ${orphanCodes.length} code${orphanCodes.length === 1 ? "" : "s"}...`;
      renderPanel();
      await Promise.all(orphanCodes.map(async (code) => {
        try {
          const r = await cachedListLineItemsForRfpi(code);
          lineItemsByRfpi[code] = r.ids;
          if (r.maxEndDate) lineItemEndDatesByRfpi[code] = r.maxEndDate;
          if (r.ids.length === 0) {
            lineItemWarnings.push(`RFPI "${code}" returned no line items — output rows for this RFPI will have empty line_items.`);
          } else if (r.droppedBySafety > 0) {
            lineItemWarnings.push(`RFPI "${code}": ${r.droppedBySafety} of ${r.totalFetched} API results were rejected by the name-prefix safety check (excluded from output).`);
          }
        } catch (e) {
          console.error(`[CTF] Per-RFPI fallback failed for ${code}:`, e);
          lineItemsByRfpi[code] = [];
          lineItemWarnings.push(`Per-RFPI lookup failed for "${code}" (${e.message}) — output rows will have empty line_items.`);
        }
      }));
    }

    const rowsWithoutRfpi = rows.filter((r) => !r.rfp_line_item_code || !String(r.rfp_line_item_code).trim()).length;
    if (rowsWithoutRfpi > 0) {
      lineItemWarnings.push(`${rowsWithoutRfpi} CTF row${rowsWithoutRfpi === 1 ? "" : "s"} have no RFP Line Item Number — those rows will have empty line_items in the output.`);
    }

    return {
      id: `ctf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filename,
      rows,
      advertiser,
      creativeResolution,
      lineItemsByRfpi,
      lineItemEndDatesByRfpi,
      warnings: lineItemWarnings,
      edits: { manualCreativeIds: {}, multiPicks: {} },
    };
  }

  async function pickAdvertiser(candidates) {
    const labels = candidates.map((c, i) => `${i + 1}. ${c.advertiser_name} (id ${c.advertiser_id})`).join("\n");
    const choice = prompt(`Multiple advertisers match. Enter 1-${candidates.length}:\n\n${labels}`);
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) throw new Error("No advertiser selected");
    return candidates[idx];
  }

  // ------------------------------------------------------------------------
  // Generate combined xlsx across all staged CTFs (template-based for Prism-compat)
  // ------------------------------------------------------------------------
  async function handleGenerate() {
    try {
      if (!appState.stagedCtfs.length) throw new Error("No CTFs staged");
      if (!appState.ianaTz) throw new Error("Timezone not set — reload the Prism tab so the TZ badge appears");

      const { rows: outputRows, warnings } = mergeStagedOutputs(appState.stagedCtfs, appState.ianaTz);

      // Filename: single-advertiser keeps the old naming; multi-CTF uses count form.
      const uniqueAdvertisers = new Set(appState.stagedCtfs.map((c) => c.advertiser.advertiser_id));
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = appState.stagedCtfs.length === 1
        ? `bulk-associate-${appState.stagedCtfs[0].advertiser.advertiser_name.replace(/\W+/g, "_")}-${dateStr}.xlsx`
        : `bulk-associate-${appState.stagedCtfs.length}-CTFs-${uniqueAdvertisers.size}-advertisers-${dateStr}.xlsx`;

      await downloadXlsx(outputRows, filename);

      // Collect resolved creatives per CTF for the expiry table (needs API end_date).
      const resolvedPerCtf = appState.stagedCtfs.map((ctf) => ({
        ctfId: ctf.id,
        advertiser: ctf.advertiser,
        rows: ctf.rows,
        resolved: collectResolvedCreatives(ctf),
      }));

      const creativeExpiresRows = buildCreativeExpiresRows(appState.stagedCtfs, appState.ianaTz);

      appState.stage = "done";
      appState.doneState = {
        outputRowCount: outputRows.length,
        ctfCount: appState.stagedCtfs.length,
        filename,
        warnings,
        resolvedPerCtf,
        creativeExpiresRows,
      };
      renderPanel();
    } catch (e) {
      console.error(e);
      const status = document.querySelector("#prt-status");
      if (status) status.innerHTML = `<span class="prt-bad">Error: ${escapeHtml(e.message)}</span>`;
    }
  }

  // Collect the full resolved-creative object per key for a CTF, preserving
  // API-provided end_date so the expiry table can flag at-risk creatives.
  function collectResolvedCreatives(ctf) {
    const out = {};
    for (const [key, res] of Object.entries(ctf.creativeResolution)) {
      if (res.match === "none") {
        const sample = ctf.rows.find((r) => creativeKeyFromRow(r) === key);
        const pastedId = ctf.edits?.manualCreativeIds?.[key];
        out[key] = {
          creative_id: pastedId,
          creative_name: sample.creative_name,
          end_date: null,
          _manual: true,
        };
      } else if (res.match === "multiple") {
        const pickedId = ctf.edits?.multiPicks?.[key] ?? res.candidates[0].creative_id;
        out[key] = res.candidates.find((c) => c.creative_id === pickedId) || res.candidates[0];
      } else {
        out[key] = res.creative;
      }
    }
    return out;
  }

  // Build expiry-table rows aggregated across all staged CTFs, sorted by severity.
  function buildExpiryTableRowsForStaged(resolvedPerCtf) {
    const out = [];
    for (const perCtf of resolvedPerCtf) {
      for (const [key, cr] of Object.entries(perCtf.resolved)) {
        let flightMaxEnd = null;
        for (const r of perCtf.rows) {
          if (creativeKeyFromRow(r) !== key) continue;
          if (!(r.end_date instanceof Date) || isNaN(r.end_date.getTime())) continue;
          if (!flightMaxEnd || r.end_date > flightMaxEnd) flightMaxEnd = r.end_date;
        }
        let allRfpisCovered = true;
        for (const r of perCtf.rows) {
          if (creativeKeyFromRow(r) !== key) continue;
          const rfpi = r.rfp_line_item_code ? String(r.rfp_line_item_code).trim() : "";
          if (!rfpi) { allRfpisCovered = false; continue; }
          if (!(r.end_date instanceof Date) || isNaN(r.end_date.getTime())) continue;
          let coveredByOther = false;
          for (const r2 of perCtf.rows) {
            if (creativeKeyFromRow(r2) === key) continue;
            const rfpi2 = r2.rfp_line_item_code ? String(r2.rfp_line_item_code).trim() : "";
            if (rfpi2 !== rfpi) continue;
            const otherCr = perCtf.resolved[creativeKeyFromRow(r2)];
            if (!otherCr || !otherCr.end_date) continue;
            if (new Date(otherCr.end_date) >= r.end_date) { coveredByOther = true; break; }
          }
          if (!coveredByOther) allRfpisCovered = false;
        }
        const label = cr.creative_name + (cr._manual ? " (manual)" : "") + ` · id ${cr.creative_id} · ${perCtf.advertiser.advertiser_name}`;
        const flightEndDisplay = flightMaxEnd ? flightMaxEnd.toISOString().slice(0, 10) : "—";
        if (cr._manual || !cr.end_date) {
          out.push({ label, creativeEndDisplay: "—", flightEndDisplay, severity: "manual", pillClass: "prt-pill-warn", statusLabel: "no data", sortKey: 2 });
          continue;
        }
        const creativeEnd = new Date(cr.end_date);
        const creativeEndDisplay = creativeEnd.toISOString().slice(0, 10);
        if (allRfpisCovered && flightMaxEnd) {
          out.push({ label, creativeEndDisplay, flightEndDisplay, severity: "ok", pillClass: "prt-pill-ok", statusLabel: "covered", sortKey: 3 });
          continue;
        }
        if (!flightMaxEnd) {
          out.push({ label, creativeEndDisplay, flightEndDisplay, severity: "ok", pillClass: "prt-pill-ok", statusLabel: "no flight", sortKey: 3 });
          continue;
        }
        const msPerDay = 86400000;
        const daysAfterFlight = Math.floor((creativeEnd - flightMaxEnd) / msPerDay);
        if (daysAfterFlight < 0) {
          out.push({ label, creativeEndDisplay, flightEndDisplay, severity: "bad", pillClass: "prt-pill-bad", statusLabel: `EXPIRES ${-daysAfterFlight}d BEFORE flight ends`, sortKey: 0 });
        } else if (daysAfterFlight < 30) {
          out.push({ label, creativeEndDisplay, flightEndDisplay, severity: "warn", pillClass: "prt-pill-warn", statusLabel: `expires ${daysAfterFlight}d after flight`, sortKey: 1 });
        } else {
          out.push({ label, creativeEndDisplay, flightEndDisplay, severity: "ok", pillClass: "prt-pill-ok", statusLabel: `valid (+${daysAfterFlight}d)`, sortKey: 3 });
        }
      }
    }
    out.sort((a, b) => a.sortKey - b.sortKey);
    return out;
  }

  function dateToLocalDay(date, ianaTz) {
    if (!ianaTz) return date.toISOString().slice(0, 10);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: ianaTz, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year").value;
    const m = parts.find((p) => p.type === "month").value;
    const d = parts.find((p) => p.type === "day").value;
    return `${y}-${m}-${d}`;
  }

  function apiEndDateToLocalDay(date, ianaTz) {
    if (!ianaTz) return date.toISOString().slice(0, 10);
    const hParts = new Intl.DateTimeFormat("en-US", {
      timeZone: ianaTz, hour: "numeric", hour12: false,
    }).formatToParts(date);
    const hour = parseInt(hParts.find((p) => p.type === "hour").value, 10);
    const adjusted = (hour >= 0 && hour < 6) ? new Date(date.getTime() - 6 * 3600000) : date;
    return dateToLocalDay(adjusted, ianaTz);
  }

  function buildCreativeExpiresRows(stagedCtfs, ianaTz) {
    const coveredRfpis = new Set();
    for (const ctf of stagedCtfs) {
      const maxEndByRfpi = {};
      for (const row of ctf.rows) {
        const code = row.rfp_line_item_code ? String(row.rfp_line_item_code).trim() : "";
        if (!code) continue;
        if (!(row.end_date instanceof Date) || isNaN(row.end_date.getTime())) continue;
        const ceDay = row.end_date.toISOString().slice(0, 10);
        const ceNorm = new Date(ceDay + "T00:00:00Z");
        if (!maxEndByRfpi[code] || ceNorm > maxEndByRfpi[code]) maxEndByRfpi[code] = ceNorm;
      }
      for (const [code, maxCreativeEnd] of Object.entries(maxEndByRfpi)) {
        const flightEnd = ctf.lineItemEndDatesByRfpi?.[code];
        if (!flightEnd) continue;
        const flightEndDate = new Date(flightEnd);
        if (isNaN(flightEndDate.getTime())) continue;
        const flightEndDay = apiEndDateToLocalDay(flightEndDate, ianaTz);
        const feNorm = new Date(flightEndDay + "T00:00:00Z");
        if (maxCreativeEnd >= feNorm) coveredRfpis.add(code);
      }
    }
    const out = [];
    for (const ctf of stagedCtfs) {
      for (const row of ctf.rows) {
        const rfpiCode = row.rfp_line_item_code ? String(row.rfp_line_item_code).trim() : "";
        if (!rfpiCode) continue;
        if (coveredRfpis.has(rfpiCode)) continue;
        if (!(row.end_date instanceof Date) || isNaN(row.end_date.getTime())) continue;
        const creativeEnd = row.end_date;
        const flightEnd = ctf.lineItemEndDatesByRfpi?.[rfpiCode];
        if (!flightEnd) continue;
        const flightEndDate = new Date(flightEnd);
        if (isNaN(flightEndDate.getTime())) continue;
        const creativeEndDay = creativeEnd.toISOString().slice(0, 10);
        const flightEndDay = apiEndDateToLocalDay(flightEndDate, ianaTz);
        const msPerDay = 86400000;
        const ceNorm = new Date(creativeEndDay + "T00:00:00Z");
        const feNorm = new Date(flightEndDay + "T00:00:00Z");
        const daysBeforeFlight = Math.round((feNorm - ceNorm) / msPerDay);
        if (daysBeforeFlight <= 0) continue;
        out.push({
          creativeName: row.creative_name || "(unknown)",
          rfpiCode,
          creativeEndDisplay: creativeEndDay,
          flightEndDisplay: flightEndDay,
          daysBeforeFlight,
          statusLabel: `EXPIRES ${daysBeforeFlight}d BEFORE flight ends`,
          pillClass: "prt-pill-bad",
        });
      }
    }
    out.sort((a, b) => b.daysBeforeFlight - a.daysBeforeFlight);
    const seen = new Set();
    return out.filter((r) => {
      const key = `${r.creativeName}|${r.rfpiCode}|${r.creativeEndDisplay}|${r.flightEndDisplay}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ========================================================================
  // Boot — route-aware activation for Vue SPA
  // ========================================================================

  let routeActive = false;
  let observer = null;
  let pollTimer = null;

  function isCreativesPage() {
    return /^\/creatives(\/|$|\?)/.test(location.pathname);
  }

  function activate() {
    if (routeActive) return;
    routeActive = true;
    injectStyle();
    mountButton();

    observer = new MutationObserver(() => {
      if (!document.getElementById("prt-button")) mountButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    let stableCount = 0;
    pollTimer = setInterval(() => {
      if (document.getElementById("prt-button")) {
        if (++stableCount >= 3) clearInterval(pollTimer);
      } else {
        stableCount = 0;
        mountButton();
      }
    }, 2000);
  }

  function deactivate() {
    if (!routeActive) return;
    routeActive = false;
    if (observer) { observer.disconnect(); observer = null; }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    const btn = document.getElementById("prt-button");
    if (btn) btn.remove();
    const panel = document.getElementById("prt-panel");
    if (panel) panel.remove();
  }

  function checkRoute() {
    if (isCreativesPage()) activate();
    else deactivate();
  }

  const _pushState = history.pushState;
  const _replaceState = history.replaceState;
  history.pushState = function() {
    _pushState.apply(this, arguments);
    checkRoute();
  };
  history.replaceState = function() {
    _replaceState.apply(this, arguments);
    checkRoute();
  };
  window.addEventListener("popstate", checkRoute);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkRoute);
  } else {
    checkRoute();
  }
})();





