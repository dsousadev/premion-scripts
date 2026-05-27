(function () {
  "use strict";

  if (window.trustedTypes && !window.trustedTypes.defaultPolicy) {
    window.trustedTypes.createPolicy("default", {
      createHTML: (s) => s,
    });
  }

  // ─── OPTIONS ──────────────────────────────────────

  const OPTIONS = {
    from: "",
    lineEnding: "\r\n",
    encoding: "utf-8",
    openAsDraft: true,
    debug: true,
  };

  // ─── STATION CONFIG, KEYED BY GID ─────────────────

  const STATION_CONFIG = {
    "1067978833": { callLetters: "KPNX", station: "Phoenix", to: ["PREMIONAdOpsPhoenix@tegna.com"] },
    "475639220": { callLetters: "WFAA", station: "Dallas", to: ["PREMIONAdOpsDallas@tegna.com"] },
    "1342881567": { callLetters: "KTVB", station: "Boise", to: ["PREMIONAdOpsBoise@tegna.com"] },
    "517069525": { callLetters: "WUSA", station: "Washington", to: ["PREMIONAdOpsWashingtonDC@tegna.com"] },
    "34710856": { callLetters: "KMSB", station: "Tucson", to: ["PREMIONAdOpsTucson@tegna.com"] },
    "1325581205": { callLetters: "WATN", station: "Memphis", to: ["PremionAdOpsMemphis@tegna.com"] },
    "301828008": { callLetters: "WHAS", station: "Louisville", to: ["PREMIONAdOpsLouisville@tegna.com"] },
    "588299379": { callLetters: "WTIC", station: "Hartford", to: ["PremionAdOpsHartford@tegna.com"] },
    "52125525": { callLetters: "KING", station: "Seattle", to: ["PREMIONAdOpsSeattle@tegna.com"] },
    "1593522649": { callLetters: "WNEP", station: "Scranton", to: ["PremionAdOpsScranton@tegna.com"] },
    "2030918627": { callLetters: "KENS", station: "San Antonio", to: ["PREMIONAdOpsSanAntonio@tegna.com"] },
    "113222679": { callLetters: "WTOL", station: "Toledo", to: ["PremionAdOpsToledo@tegna.com"] },
    "264391268": { callLetters: "WCSH", station: "Portland, ME", to: ["PREMIONAdOpsPortland-BangorMaine@tegna.com"] },
    "912533109": { callLetters: "WVEC", station: "Norfolk", to: ["PREMIONAdOpsNorfolk@tegna.com"] },
    "1905320717": { callLetters: "WQAD", station: "Quad Cities", to: ["PremionAdOpsQuadCities@tegna.com"] },
    "1408296214": { callLetters: "WXIA", station: "Atlanta", to: ["PREMIONAdOpsAtlanta@tegna.com"] },
    "1441003462": { callLetters: "KGW", station: "Portland, OR", to: ["PREMIONAdOpsPortlandOR@tegna.com"] },
    "872288224": { callLetters: "WTSP", station: "Tampa", to: ["PREMIONAdOpsTampa@tegna.com"] },
    "1665878424": { callLetters: "KVUE", station: "Austin", to: ["PREMIONAdOpsAustin@tegna.com"] },
    "1066665962": { callLetters: "WBNS", station: "Columbus", to: ["PremionAdOpsColumbus@premion.com"] },
    "112381845": { callLetters: "KARE", station: "Minneapolis", to: ["PREMIONAdOpsMinneapolis@tegna.com"] },
    "99746230": { callLetters: "KTHV", station: "Little Rock", to: ["premionadopslittlerock@tegna.com"] },
    "960699319": { callLetters: "KXVA", station: "Abilene/San Angelo", to: ["PREMIONAdOpsAbileneSanAngelo@tegna.com"] },
    "1820463088": { callLetters: "KUSA", station: "Denver", to: ["PREMIONAdOpsDenver@tegna.com"] },
    "1936812173": { callLetters: "KFSM", station: "Ft. Smith", to: ["PremionAdOpsFortSmith@tegna.com"] },
    "833773631": { callLetters: "KBMT", station: "Beaumont", to: ["premionadopsbeaumont@tegna.com"] },
    "1810794265": { callLetters: "WOI", station: "Des Moines", to: ["PremionAdOpsDesMoinesAmes@tegna.com"] },
    "350627193": { callLetters: "WMAZ", station: "Macon", to: ["premionadopsMacon@tegna.com"] },
    "1556429480": { callLetters: "WWL", station: "New Orleans", to: ["PREMIONAdOpsNewOrleans@tegna.com"] },
    "1294645755": { callLetters: "KCEN", station: "Waco", to: ["PREMIONAdOpsWaco@tegna.com"] },
    "1550311147": { callLetters: "WPMT", station: "Harrisburg", to: ["PremionAdOpsHarrisburg@tegna.com"] },
    "1061693977": { callLetters: "WKYC", station: "Cleveland", to: ["PREMIONAdOpsCleveland@tegna.com"] },
    "1680675840": { callLetters: "WBIR", station: "Knoxville", to: ["PREMIONAdOpsKnoxville@tegna.com"] },
    "1277549953": { callLetters: "WGRZ", station: "Buffalo", to: ["PREMIONAdOpsBuffalo@tegna.com"] },
    "1760676617": { callLetters: "KFMB", station: "San Diego", to: ["PremionAdOpsSanDiego@tegna.com"] },
    "112993121": { callLetters: "KREM", station: "Spokane", to: ["PREMIONAdOpsSpokane@tegna.com"] },
    "393255779": { callLetters: "WLTX", station: "Columbia", to: ["PREMIONAdOpsColumbia@tegna.com"] },
    "1409154955": { callLetters: "WCNC", station: "Charlotte", to: ["PREMIONAdOpsCharlotte@tegna.com"] },
    "1751952843": { callLetters: "KXTV", station: "Sacramento", to: ["PREMIONAdOpsSacramento@tegna.com"] },
    "1586834375": { callLetters: "KSDK", station: "St Louis", to: ["PremionAdOpsStLouis@tegna.com"] },
    "1832008032": { callLetters: "KYTX", station: "Tyler", to: ["PREMIONAdOpsTyler@tegna.com"] },
    "1033282805": { callLetters: "WTHR", station: "Indianapolis", to: ["PREMIONAdOpsIndianapolis@tegna.com"] },
    "1481273951": { callLetters: "WFMY", station: "Greensboro", to: ["PREMIONAdOpsGreensboro@tegna.com"] },
    "1970097116": { callLetters: "WZZM", station: "Grand Rapids", to: ["PREMIONAdOpsGrandRapids@tegna.com"] },
    "2134161072": { callLetters: "KIII", station: "Corpus Christi", to: ["PREMIONAdOpsCorpusChristi@tegna.com"] },
    "170275914": { callLetters: "WTLV", station: "Jacksonville", to: ["PREMIONAdOpsJacksonville@tegna.com"] },
    "872492505": { callLetters: "KHOU", station: "Houston", to: ["PREMIONAdOpsHouston@tegna.com"] },
    "928035035": { callLetters: "WZDX", station: "Huntsville", to: ["PremionAdOpsHuntsville@tegna.com"] },
    "1454383126": { callLetters: "KWES", station: "Odessa", to: ["PremionAdOpsOdessa-Midland@tegna.com"] },
  };

  // ─── EMAIL TEMPLATES ──────────────────────────────
  // Important:
  // fileNameLabel fixes the bug where Awaiting / Expiring Creatives
  // was downloading with ReadyToGoLive in the file name.

  const EMAIL_TEMPLATES = {
    "ready-to-go-live": {
      displayName: "Ready To Go Live",
      fileNameLabel: "ReadyToGoLive",
      dataCols: [1, 2, 3, 4, 5],
      columns: ["Advertiser", "RFPID", "RFP Line Item", "Flight Start Date", "Flight End Date"],
      subjectFn: (cfg) =>
        `${cfg.callLetters} - Ready To Go Live Report ${formatDateShort(new Date())}`,
      intro:
        "The following orders have been trafficked with the creatives and are ready to go live for the respected flight dates.",
      closing: "Please let me know if you have any questions.",
      sections: [
        {
          title: "Orders:",
          filterCol: 9,
          filterValue: "Send Email",
        },
        {
          title: "Revisions:",
          filterCol: 9,
          filterValue: "Creative Revision Completed",
          dateCol: 13,
        },
      ],
    },

    "awaiting-expiring-creatives": {
      displayName: "Awaiting / Expiring Creatives",
      fileNameLabel: "AwaitingExpiringCreatives",
      dataCols: [1, 2, 3, 4, 5],
      columns: ["Advertiser", "RFPID", "RFP Line Item", "Flight Start Date", "Flight End Date"],
      subjectFn: (cfg) =>
        `${cfg.callLetters} - Awaiting / Expiring Creatives Report ${formatDateShort(new Date())}`,
      note:
        "Note: There may be some orders on this report which have had creatives recently submitted. They will fall off the report once they've been QA'd and the pass email has been sent.",
      intro:
        "We are currently awaiting Creative and/or Creative Trafficking Forms for the following orders, if we are continuing with the same creatives, please upload a revised Creative Trafficking Form for however long the creatives will be in use.",
      closing:
        "Please let us know if you have any questions, concerns or if you feel something is missing or should not be on this report.",
      sections: [
        {
          title: "Awaiting Creative:",
          filterCol: 9,
          filterValue: "Awaiting Creative",
          dateCol: 4,
          dateFilter: "within30",
          icon: "⏳",
          accent: "#F9A825",
          style: {
            accent: "#F9A825",
            tint: "#FFFDE7",
          },
        },
        {
          title: "Expiring Creatives:",
          filterCol: 9,
          filterValue: "Creative Expiring",
          dataCols: [1, 2, 3, 4, 5, 9, 10],
          columns: ["Advertiser", "RFPID", "Line Item", "Start", "End", "Status", "Expires"],
          icon: "⚠",
          accent: "#E65100",
          style: {
            accent: "#E65100",
            tint: "#FFF3E0",
            highlightCol: 6,
          },
        },
      ],
    },

    // Live Sports is a per-row "selectable-digest" template:
    // each matching row represents one creative going live.
    // User picks which matches to bundle into a single .eml.
    "live-sports": {
      displayName: "Live Sports",
      fileNameLabel: "LiveSports",
      mode: "selectable-digest",
      to: ["TEGNALiveSports@premion.com"],
      cc: [
        "bwalker@premion.com",
        "CWatters@premion.com",
        "KRosemann@premion.com",
      ],
      filters: [
        { col: 6, mode: "contains", value: "Asellus" }, // Column G (Package)
        { col: 9, mode: "equals", value: "Send Email" }, // Column J (Status)
      ],
      columnMap: {
        advertiser: 1,   // B
        rfpid: 2,        // C
        rfpi: 3,         // D
        startDate: 4,    // E
        flightEnd: 5,    // F
        creativeEnd: 10, // K
        sonyUrl: 14,     // O
      },
      accent: "#1565C0",
      tint: "#E3F2FD",
    },
  };

  // ─── UTILITIES ────────────────────────────────────

  function formatDateShort(d) {
    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
  }

  function formatDateLong(d) {
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }

  function formatDateForFileName(d) {
    return formatDateShort(d).replace(/\//g, "-");
  }

  function formatRfc2822(d) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const mm = String(Math.abs(offset) % 60).padStart(2, "0");

    return (
      `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")} ` +
      `${months[d.getMonth()]} ${d.getFullYear()} ` +
      `${String(d.getHours()).padStart(2, "0")}:` +
      `${String(d.getMinutes()).padStart(2, "0")}:` +
      `${String(d.getSeconds()).padStart(2, "0")} ${sign}${hh}${mm}`
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sanitizeForFileName(str) {
    return String(str || "").replace(/[^a-zA-Z0-9]/g, "");
  }

  function mimeEncode(str) {
    try {
      const encoded = new TextEncoder().encode(str);
      let binary = "";

      for (let i = 0; i < encoded.length; i++) {
        binary += String.fromCharCode(encoded[i]);
      }

      return `=?UTF-8?B?${btoa(binary)}?=`;
    } catch {
      return str;
    }
  }

  function needsEncoding(str) {
    return /[^\x20-\x7E]/.test(str);
  }

  function generateBoundary() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";

    for (let i = 0; i < 24; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `----=NextPart_${id}`;
  }

  function generateMessageId() {
    return `<${Date.now()}.${Math.random().toString(36).slice(2)}@station-email-generator>`;
  }

  function getTemplateDisplayName(templateKey) {
    const template = EMAIL_TEMPLATES[templateKey];

    if (template && template.displayName) {
      return template.displayName;
    }

    return templateKey
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function buildDownloadFileName(stationCfg, template) {
    const safeCallLetters = sanitizeForFileName(stationCfg.callLetters || "Station");
    const safeTemplateLabel = sanitizeForFileName(template.fileNameLabel || "EmailDraft");
    const dateStamp = formatDateForFileName(new Date());

    return `${safeCallLetters}_${safeTemplateLabel}_${dateStamp}.eml`;
  }

  function colIndexToLetter(idx) {
    // 0=A, 1=B, ..., 25=Z, 26=AA
    let n = idx;
    let letter = "";
    while (n >= 0) {
      letter = String.fromCharCode(65 + (n % 26)) + letter;
      n = Math.floor(n / 26) - 1;
    }
    return letter;
  }

  // ─── DATA ACCESS ──────────────────────────────────

  function getGidFromUrl() {
    const hash = window.location.hash || "";
    const hashMatch = hash.match(/gid=(\d+)/);

    if (hashMatch) {
      return hashMatch[1];
    }

    const url = new URL(window.location.href);
    const gidParam = url.searchParams.get("gid");

    if (gidParam) {
      return gidParam;
    }

    return null;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          row.push(field);
          field = "";
        } else if (ch === "\r" && next === "\n") {
          row.push(field);
          field = "";
          rows.push(row);
          row = [];
          i++;
        } else if (ch === "\n") {
          row.push(field);
          field = "";
          rows.push(row);
          row = [];
        } else {
          field += ch;
        }
      }
    }

    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  async function fetchSheetCsv(gid) {
    const spreadsheetId = "1EQwTclB0QPJwgIEmdX7RM9kEgxbaMuuSfDEndCartlI";
    const url =
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export` +
      `?format=csv&gid=${encodeURIComponent(gid)}`;

    const response = await fetch(url, {
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error(`CSV export failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();

    if (OPTIONS.debug) {
      console.log("[Station Email] Raw CSV response:", text.slice(0, 500));
    }

    const rows = parseCsv(text);

    if (!rows.length) {
      throw new Error("Sheet returned no data");
    }

    return rows;
  }

  function parseDate(dateStr) {
    const value = String(dateStr || "").trim();
    if (!value) return null;

    const parts = value.split("/");
    if (parts.length < 2) return null;

    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    let year = parts[2] != null && parts[2] !== ""
      ? parseInt(parts[2], 10)
      : new Date().getFullYear();

    if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) {
      return null;
    }

    if (year < 100) {
      year += 2000;
    }

    const parsed = new Date(year, month - 1, day);
    parsed.setHours(0, 0, 0, 0);

    return parsed;
  }

  function normalizeDate(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    const parsed = parseDate(value);
    if (!parsed) return value;
    return formatDateShort(parsed);
  }

  function isToday(dateStr) {
    const parsed = parseDate(dateStr);
    if (!parsed) return false;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return parsed.getTime() === now.getTime();
  }

  function isWithinDays(dateStr, days) {
    const parsed = parseDate(dateStr);
    if (!parsed) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const future = new Date(today);
    future.setDate(future.getDate() + days);

    return parsed >= today && parsed <= future;
  }

  function rowMatchesFilters(row, filters) {
    return filters.every((f) => {
      const cell = String(row[f.col] || "").trim();
      if (f.mode === "contains") {
        return cell.toLowerCase().includes(String(f.value).toLowerCase());
      }
      return cell === f.value;
    });
  }

  function filterRows(allRows, section, dataCols) {
    return allRows
      .filter((row) => {
        const status = String(row[section.filterCol] || "").trim();

        if (status !== section.filterValue) {
          return false;
        }

        if (section.dateCol != null) {
          const cellVal = String(row[section.dateCol] || "").trim();

          if (section.dateFilter === "within30") {
            const result = isWithinDays(cellVal, 30);

            if (OPTIONS.debug) {
              console.log(
                `[Station Email] dateCol ${section.dateCol} value: "${cellVal}", isWithin30: ${result}`
              );
            }

            if (!result) return false;
          } else {
            const result = isToday(cellVal);

            if (OPTIONS.debug) {
              console.log(
                `[Station Email] dateCol ${section.dateCol} value: "${cellVal}", isToday: ${result}`
              );
            }

            if (!result) return false;
          }
        }

        return true;
      })
      .map((row) => dataCols.map((colIdx) => row[colIdx] || ""));
  }

  // ─── EMAIL BODY BUILDING (DIGEST TEMPLATES) ───────

  function buildTableHtml(rows, headerCols, cellFont, msoLine, style) {
    const accent = style?.accent || "#4EA72E";
    const tint = style?.tint || null;
    const highlightCol = style?.highlightCol != null ? style.highlightCol : -1;
    const numCols = headerCols.length;

    let headerCells = "";

    for (let c = 0; c < numCols; c++) {
      const header = String(headerCols[c] || "");
      const lower = header.toLowerCase();
      const isDate =
        lower.includes("date") ||
        lower.includes("expires") ||
        lower.includes("start") ||
        lower.includes("end");

      const align = isDate ? "right" : "left";

      headerCells +=
        `<th style="padding:8px 12px;${cellFont}font-size:13px;` +
        `font-weight:700;color:#666666;background-color:#F5F5F5;` +
        `border-bottom:2px solid #D0D0D0;line-height:1.3;${msoLine}` +
        `text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;" ` +
        `align="${align}">${escapeHtml(header)}</th>`;
    }

    let tableRows = "";

    rows.forEach((row, idx) => {
      const evenBg = tint || "#FFFFFF";
      const oddBg = tint || "#F9F9F9";
      const bgColor = idx % 2 === 0 ? evenBg : oddBg;

      let cells = "";

      for (let c = 0; c < numCols; c++) {
        const header = String(headerCols[c] || "");
        const lower = header.toLowerCase();
        const value = row[c] || "";

        const isDate =
          lower.includes("date") ||
          lower.includes("expires") ||
          lower.includes("start") ||
          lower.includes("end");

        const align = isDate ? "right" : "left";
        const isHighlight = c === highlightCol;
        const cellBg = isHighlight ? "#EF5350" : bgColor;
        const cellColor = isHighlight ? "#FFFFFF" : "#333333";
        const cellWeight = isHighlight ? "font-weight:700;" : "";

        cells +=
          `<td style="padding:8px 12px;${cellFont}font-size:14px;` +
          `color:${cellColor};${cellWeight}background-color:${cellBg};` +
          `border-bottom:1px solid #E0E0E0;line-height:1.5;${msoLine}` +
          `vertical-align:top;white-space:nowrap;" ` +
          `align="${align}">${escapeHtml(value)}</td>`;
      }

      tableRows += `<tr>${cells}</tr>`;
    });

    return [
      `<table cellpadding="0" cellspacing="0" border="0" ` +
        `style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;` +
        `border-top:3px solid ${accent};">`,
      `<tr>${headerCells}</tr>`,
      tableRows,
      `</table>`,
    ].join("");
  }

  function buildEmailHtml(allRows, template) {
    const cellFont = "font-family:Arial,'Aptos Narrow',sans-serif;";
    const msoLine = "mso-line-height-rule:exactly;";

    let sectionsHtml = "";

    for (const section of template.sections) {
      const cols = section.dataCols || template.dataCols;
      const headers = section.columns || template.columns;
      const rows = filterRows(allRows, section, cols);

      if (!rows.length) {
        continue;
      }

      const icon = section.icon || "";
      const titleColor = section.accent ? `color:${section.accent};` : "";

      sectionsHtml +=
        `<p style="margin:24px 0 8px 0;font-weight:700;${titleColor}">` +
        `${icon ? icon + " " : ""}${escapeHtml(section.title)}</p>`;

      sectionsHtml += buildTableHtml(rows, headers, cellFont, msoLine, section.style);
    }

    const noteHtml = template.note
      ? `<p style="margin:0 0 16px 0;padding:10px 14px;background:#FFF8E1;` +
        `border-left:4px solid #FFB300;font-size:14px;color:#555555;` +
        `line-height:1.5;${msoLine}">${escapeHtml(template.note)}</p>`
      : "";

    const closing = template.closing || "Please let me know if you have any questions.";

    return [
      `<html>`,
      `<body style="font-family:Arial,'Aptos',sans-serif;font-size:14px;color:#333333;` +
        `line-height:1.6;${msoLine}">`,
      noteHtml,
      `<p style="margin:0 0 16px 0;">Hi Team,</p>`,
      `<p style="margin:0 0 16px 0;">${escapeHtml(template.intro)}</p>`,
      sectionsHtml,
      `<p style="margin:24px 0 16px 0;">${escapeHtml(closing)}</p>`,
      `<p style="margin:0;">Thanks!</p>`,
      `</body>`,
      `</html>`,
    ].join("");
  }

  function buildPlainText(allRows, template) {
    const lines = [];

    if (template.note) {
      lines.push(template.note);
      lines.push("");
    }

    lines.push("Hi Team,");
    lines.push("");
    lines.push(template.intro);
    lines.push("");

    for (const section of template.sections) {
      const cols = section.dataCols || template.dataCols;
      const headers = section.columns || template.columns;
      const rows = filterRows(allRows, section, cols);

      if (!rows.length) {
        continue;
      }

      lines.push(section.title);
      lines.push("");
      lines.push(headers.join(" | "));
      lines.push(headers.map((h) => "-".repeat(String(h).length)).join("-+-"));

      rows.forEach((row) => {
        const values = [];

        for (let c = 0; c < headers.length; c++) {
          values.push(row[c] || "");
        }

        lines.push(values.join(" | "));
      });

      lines.push("");
    }

    const closing = template.closing || "Please let me know if you have any questions.";

    lines.push(closing);
    lines.push("");
    lines.push("Thanks!");

    return lines.join("\n");
  }

  // ─── EMAIL BODY BUILDING (LIVE SPORTS) ────────────

  function mapToLiveSportsRecord(row, columnMap) {
    const creativeEndRaw = String(row[columnMap.creativeEnd] || "").trim();
    const flightEndRaw = String(row[columnMap.flightEnd] || "").trim();

    const flightEndDate = normalizeDate(flightEndRaw);
    const creativeEndDate = normalizeDate(creativeEndRaw);

    const sonyUrl = String(row[columnMap.sonyUrl] || "").trim();

    return {
      advertiser: String(row[columnMap.advertiser] || "").trim(),
      rfpid: String(row[columnMap.rfpid] || "").trim(),
      rfpi: String(row[columnMap.rfpi] || "").trim(),
      startDate: normalizeDate(row[columnMap.startDate]),
      flightEndDate,
      creativeEndDate,
      hasCreativeEnd: creativeEndDate.length > 0,
      sonyUrl,
      hasUrl: sonyUrl.length > 0,
    };
  }

  function buildBulletproofButton(url, label, accent) {
    if (!url) return "";

    return [
      `<table cellpadding="0" cellspacing="0" border="0" style="margin:6px 0;border-collapse:collapse;">`,
      `<tr>`,
      `<td bgcolor="${accent}" style="border-radius:6px;">`,
      `<a href="${escapeHtml(url)}" target="_blank" `,
      `style="display:inline-block;padding:12px 28px;color:#FFFFFF;`,
      `text-decoration:none;font-weight:700;font-family:Arial,sans-serif;`,
      `font-size:14px;border-radius:6px;">${escapeHtml(label)} →</a>`,
      `</td>`,
      `</tr>`,
      `</table>`,
    ].join("");
  }

  function buildCtfButton(url, accent) {
    if (!url) {
      return `<span style="color:#999999;">—</span>`;
    }

    return [
      `<table cellpadding="0" cellspacing="0" border="0" `,
      `style="border-collapse:collapse;display:inline-block;">`,
      `<tr>`,
      `<td bgcolor="${accent}" style="border-radius:6px;">`,
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" `,
      `style="display:inline-block;padding:10px 22px;color:#FFFFFF;`,
      `text-decoration:none;font-weight:700;font-family:Arial,sans-serif;`,
      `font-size:13px;border-radius:6px;letter-spacing:0.5px;`,
      `mso-line-height-rule:exactly;">CTF&nbsp;↗</a>`,
      `</td>`,
      `</tr>`,
      `</table>`,
    ].join("");
  }

  function buildLiveSportsSubject(callLetters, records) {
    const pairs = records.map((r) => `${r.advertiser} - ${r.rfpid}`).join(", ");
    return `LIVE SPORTS CREATIVE: ${callLetters} - ${pairs}`;
  }

  function buildLiveSportsFileName(callLetters, records, template) {
    const safeCallLetters = sanitizeForFileName(callLetters || "Station");
    const safeLabel = sanitizeForFileName(template.fileNameLabel || "LiveSports");
    const dateStamp = formatDateForFileName(new Date());

    if (records.length === 1) {
      const adv = sanitizeForFileName(records[0].advertiser);
      const rfp = sanitizeForFileName(records[0].rfpid);
      return `${safeCallLetters}_${safeLabel}_${adv}_${rfp}_${dateStamp}.eml`;
    }
    return `${safeCallLetters}_${safeLabel}_${dateStamp}.eml`;
  }

  function buildEndDatesParagraphHtml(rec) {
    if (rec.hasCreativeEnd) {
      return (
        `<p style="margin:0 0 4px 0;">Creative end date: ` +
        `<b>${escapeHtml(rec.creativeEndDate)}</b></p>` +
        `<p style="margin:0 0 16px 0;">Flight end date: ` +
        `<b>${escapeHtml(rec.flightEndDate)}</b></p>`
      );
    }
    return (
      `<p style="margin:0 0 16px 0;">Creative end date: ` +
      `<b>${escapeHtml(rec.flightEndDate)}</b> ` +
      `<span style="color:#888888;font-style:italic;font-size:12px;">(flight end)</span></p>`
    );
  }

  function buildSingleLiveSportsHtml(rec, template, cellFont, msoLine) {
    const accent = template.accent || "#1565C0";
    const tint = template.tint || "#E3F2FD";

    const headerCellStyle =
      `padding:8px 14px;${cellFont}font-size:11px;font-weight:700;` +
      `color:#666666;background-color:#F5F5F5;border-bottom:2px solid #D0D0D0;` +
      `text-transform:uppercase;letter-spacing:0.5px;${msoLine}`;

    const dataCellStyle =
      `padding:10px 14px;${cellFont}font-size:14px;color:#333333;` +
      `background-color:${tint};border-bottom:1px solid #E0E0E0;${msoLine}`;

    const detailsTable = [
      `<table cellpadding="0" cellspacing="0" border="0" `,
      `style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;`,
      `border-top:3px solid ${accent};margin:16px 0;">`,
      `<tr>`,
      `<th align="left" style="${headerCellStyle}">Advertiser</th>`,
      `<th align="left" style="${headerCellStyle}">RFPID</th>`,
      `<th align="left" style="${headerCellStyle}">RFPI</th>`,
      `<th align="right" style="${headerCellStyle}">Flight Window</th>`,
      `<th align="right" style="${headerCellStyle}">Creative End</th>`,
      `</tr>`,
      `<tr>`,
      `<td align="left" style="${dataCellStyle}font-weight:700;">${escapeHtml(rec.advertiser)}</td>`,
      `<td align="left" style="${dataCellStyle}">${escapeHtml(rec.rfpid)}</td>`,
      `<td align="left" style="${dataCellStyle}">${escapeHtml(rec.rfpi)}</td>`,
      `<td align="right" style="${dataCellStyle}white-space:nowrap;">${escapeHtml(rec.startDate)} – ${escapeHtml(rec.flightEndDate)}</td>`,
      `<td align="right" style="${dataCellStyle}white-space:nowrap;">${rec.hasCreativeEnd ? escapeHtml(rec.creativeEndDate) : '<span style="color:#999999;">—</span>'}</td>`,
      `</tr>`,
      `</table>`,
    ].join("");

    const button = buildBulletproofButton(rec.sonyUrl, "Open Sony Cloud Asset", accent);

    return [
      `<html>`,
      `<body style="font-family:Arial,'Aptos',sans-serif;font-size:14px;color:#333333;`,
      `line-height:1.6;${msoLine}">`,
      `<p style="margin:0 0 16px 0;">Hi Team,</p>`,
      `<p style="margin:0 0 16px 0;">We have a live sports creative for `,
      `<b>${escapeHtml(rec.advertiser)}</b>. It's a `,
      `<b>${escapeHtml(rec.startDate)}</b> start date.</p>`,
      buildEndDatesParagraphHtml(rec),
      detailsTable,
      `<p style="margin:24px 0 6px 0;font-weight:700;color:${accent};">Sony Cloud Link:</p>`,
      button,
      `<p style="margin:6px 0 0 0;font-size:12px;color:#666666;word-break:break-all;">`,
      `${escapeHtml(rec.sonyUrl)}</p>`,
      `<p style="margin:32px 0 16px 0;">Let me know if you have any questions!</p>`,
      `<p style="margin:0;">Thank you!</p>`,
      `</body>`,
      `</html>`,
    ].join("");
  }

  function buildMultiLiveSportsHtml(records, template, cellFont, msoLine) {
    const accent = template.accent || "#1565C0";

    const headerCellStyle =
      `padding:8px 12px;${cellFont}font-size:13px;font-weight:700;` +
      `color:#666666;background-color:#F5F5F5;border-bottom:2px solid #D0D0D0;` +
      `line-height:1.3;${msoLine}text-transform:uppercase;letter-spacing:0.5px;` +
      `white-space:nowrap;`;

    const headerCells = [
      `<th align="left" style="${headerCellStyle}">Advertiser</th>`,
      `<th align="left" style="${headerCellStyle}">RFPID</th>`,
      `<th align="left" style="${headerCellStyle}">RFPI</th>`,
      `<th align="right" style="${headerCellStyle}">Start</th>`,
      `<th align="right" style="${headerCellStyle}">Flight End</th>`,
      `<th align="right" style="${headerCellStyle}">Creative End</th>`,
      `<th align="center" style="${headerCellStyle}">Creative Asset` +
        `<div style="font-size:10px;font-weight:400;color:#999999;` +
        `letter-spacing:0;text-transform:none;margin-top:2px;">` +
        `(clickable URL)</div></th>`,
    ].join("");

    const dataRows = records
      .map((rec, idx) => {
        const bg = idx % 2 === 0 ? "#FFFFFF" : "#F9F9F9";
        const baseCell =
          `padding:8px 12px;${cellFont}font-size:14px;color:#333333;` +
          `background-color:${bg};border-bottom:1px solid #E0E0E0;` +
          `line-height:1.5;${msoLine}vertical-align:middle;white-space:nowrap;`;

        const creativeEndCell = rec.hasCreativeEnd
          ? escapeHtml(rec.creativeEndDate)
          : `<span style="color:#999999;">—</span>`;

        const ctfButton = buildCtfButton(rec.sonyUrl, accent);

        return [
          `<tr>`,
          `<td align="left" style="${baseCell}font-weight:700;">${escapeHtml(rec.advertiser)}</td>`,
          `<td align="left" style="${baseCell}">${escapeHtml(rec.rfpid)}</td>`,
          `<td align="left" style="${baseCell}">${escapeHtml(rec.rfpi)}</td>`,
          `<td align="right" style="${baseCell}">${escapeHtml(rec.startDate)}</td>`,
          `<td align="right" style="${baseCell}">${escapeHtml(rec.flightEndDate)}</td>`,
          `<td align="right" style="${baseCell}">${creativeEndCell}</td>`,
          `<td align="center" style="${baseCell}">${ctfButton}</td>`,
          `</tr>`,
        ].join("");
      })
      .join("");

    const summaryTable = [
      `<table cellpadding="0" cellspacing="0" border="0" `,
      `style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;`,
      `border-top:3px solid ${accent};margin:16px 0;">`,
      `<tr>${headerCells}</tr>`,
      dataRows,
      `</table>`,
    ].join("");

    return [
      `<html>`,
      `<body style="font-family:Arial,'Aptos',sans-serif;font-size:14px;color:#333333;`,
      `line-height:1.6;${msoLine}">`,
      `<p style="margin:0 0 16px 0;">Hi Team,</p>`,
      `<p style="margin:0 0 8px 0;">We have `,
      `<b>${records.length} live sports creatives</b> ready to launch:</p>`,
      summaryTable,
      `<p style="margin:32px 0 16px 0;">Let me know if you have any questions!</p>`,
      `<p style="margin:0;">Thank you!</p>`,
      `</body>`,
      `</html>`,
    ].join("");
  }

  function buildLiveSportsHtml(records, template) {
    const cellFont = "font-family:Arial,'Aptos Narrow',sans-serif;";
    const msoLine = "mso-line-height-rule:exactly;";

    if (records.length === 1) {
      return buildSingleLiveSportsHtml(records[0], template, cellFont, msoLine);
    }
    return buildMultiLiveSportsHtml(records, template, cellFont, msoLine);
  }

  function buildLiveSportsPlainText(records, template) {
    const lines = ["Hi Team,", ""];

    if (records.length === 1) {
      const rec = records[0];
      lines.push(
        `We have a live sports creative for ${rec.advertiser}. ` +
          `It's a ${rec.startDate} start date.`
      );
      lines.push("");
      if (rec.hasCreativeEnd) {
        lines.push(`Creative end date: ${rec.creativeEndDate}`);
        lines.push(`Flight end date: ${rec.flightEndDate}`);
      } else {
        lines.push(`Creative end date: ${rec.flightEndDate} (flight end)`);
      }
      lines.push("");
      lines.push(`RFPID-${rec.rfpid} - RFPI-${rec.rfpi}`);
      lines.push("");
      lines.push("Sony Cloud Link:");
      lines.push(rec.sonyUrl);
      lines.push("");
    } else {
      lines.push(`We have ${records.length} live sports creatives ready to launch:`);
      lines.push("");
      records.forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec.advertiser}`);
        lines.push(`   RFPID-${rec.rfpid} - RFPI-${rec.rfpi}`);
        lines.push(`   Start: ${rec.startDate}`);
        lines.push(`   Flight end: ${rec.flightEndDate}`);
        if (rec.hasCreativeEnd) {
          lines.push(`   Creative end: ${rec.creativeEndDate}`);
        } else {
          lines.push(`   Creative end: ${rec.flightEndDate} (flight end)`);
        }
        lines.push(`   Sony Cloud Link: ${rec.sonyUrl}`);
        lines.push("");
      });
    }

    lines.push("Let me know if you have any questions!");
    lines.push("");
    lines.push("Thank you!");

    return lines.join("\n");
  }

  // ─── .EML GENERATION ──────────────────────────────

  function generateEml(opts) {
    const nl = OPTIONS.lineEnding;
    const boundary = generateBoundary();
    const now = new Date();

    const toList = Array.isArray(opts.to) ? opts.to.join(", ") : opts.to || "";
    const ccList = opts.cc?.length
      ? Array.isArray(opts.cc)
        ? opts.cc.join(", ")
        : opts.cc
      : null;

    const subject = needsEncoding(opts.subject)
      ? mimeEncode(opts.subject)
      : opts.subject;

    const headers = [
      `X-Unsent: 1`,
      `Date: ${formatRfc2822(now)}`,
      `From: ${OPTIONS.from}`,
      `To: ${toList}`,
    ];

    if (ccList) {
      headers.push(`Cc: ${ccList}`);
    }

    headers.push(
      `Message-ID: ${generateMessageId()}`,
      `MIME-Version: 1.0`,
      `Subject: ${subject}`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`
    );

    const plainPart = [
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      opts.plainTextBody,
    ].join(nl);

    const htmlPart = [
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      opts.htmlBody,
    ].join(nl);

    const eml = [
      headers.join(nl),
      ``,
      plainPart,
      ``,
      htmlPart,
      ``,
      `--${boundary}--`,
    ].join(nl);

    if (OPTIONS.debug) {
      console.log("[Station Email] Generated .eml:", eml);
    }

    return eml;
  }

  // ─── DOWNLOAD ─────────────────────────────────────

  function downloadEml(emlContent, fileName) {
    const blob = new Blob([emlContent], {
      type: "message/rfc822;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    URL.revokeObjectURL(url);
  }

  // ─── UI: TOAST ────────────────────────────────────

  function showToast(message, isError) {
    const toast = document.createElement("div");
    toast.textContent = message;

    Object.assign(toast.style, {
      position: "fixed",
      bottom: "80px",
      right: "24px",
      padding: "12px 20px",
      borderRadius: "8px",
      color: "#FFFFFF",
      background: isError ? "#D32F2F" : "#4EA72E",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      zIndex: "2147483647",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      transition: "opacity 0.3s",
      maxWidth: "480px",
    });

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ─── UI: PREVIEW MODAL ────────────────────────────

  function showPreviewModal(opts) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");

      Object.assign(overlay.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        zIndex: "2147483646",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      });

      const card = document.createElement("div");

      Object.assign(card.style, {
        background: "#FFFFFF",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        width: "80vw",
        maxWidth: "900px",
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, sans-serif",
        overflow: "hidden",
      });

      const header = document.createElement("div");

      Object.assign(header.style, {
        padding: "16px 20px",
        borderBottom: "1px solid #E0E0E0",
        fontSize: "13px",
        color: "#333333",
        lineHeight: "1.6",
      });

      const toLine = opts.to?.length ? opts.to.join(", ") : "(no recipients configured)";
      const hasRecipients = opts.to?.length > 0;

      header.innerHTML = [
        `<div><strong>To:</strong> ${escapeHtml(toLine)}</div>`,
        opts.cc?.length ? `<div><strong>Cc:</strong> ${escapeHtml(opts.cc.join(", "))}</div>` : "",
        `<div><strong>Subject:</strong> ${escapeHtml(opts.subject)}</div>`,
      ]
        .filter(Boolean)
        .join("");

      if (!hasRecipients) {
        header.innerHTML +=
          `<div style="color:#D32F2F;font-weight:bold;margin-top:4px;">` +
          `Warning: No recipient email configured for this station</div>`;
      }

      const iframe = document.createElement("iframe");

      Object.assign(iframe.style, {
        flex: "1",
        border: "none",
        width: "100%",
        minHeight: "300px",
      });

      iframe.srcdoc = opts.htmlBody;

      const footer = document.createElement("div");

      Object.assign(footer.style, {
        padding: "12px 20px",
        borderTop: "1px solid #E0E0E0",
        display: "flex",
        justifyContent: "flex-end",
        gap: "10px",
      });

      const btnStyle = {
        padding: "8px 20px",
        borderRadius: "6px",
        border: "none",
        fontSize: "14px",
        fontWeight: "bold",
        cursor: "pointer",
      };

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";

      Object.assign(cancelBtn.style, {
        ...btnStyle,
        background: "#E0E0E0",
        color: "#333333",
      });

      const downloadBtn = document.createElement("button");
      downloadBtn.textContent = hasRecipients ? "Download Draft" : "Download Draft (no recipient)";

      Object.assign(downloadBtn.style, {
        ...btnStyle,
        background: hasRecipients ? "#4EA72E" : "#F9A825",
        color: "#FFFFFF",
      });

      function close(result) {
        overlay.remove();
        document.removeEventListener("keydown", onKey);
        resolve(result);
      }

      function onKey(e) {
        if (e.key === "Escape") {
          close(false);
        }
      }

      cancelBtn.addEventListener("click", () => close(false));
      downloadBtn.addEventListener("click", () => close(true));

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          close(false);
        }
      });

      document.addEventListener("keydown", onKey);

      footer.appendChild(cancelBtn);
      footer.appendChild(downloadBtn);

      card.appendChild(header);
      card.appendChild(iframe);
      card.appendChild(footer);

      overlay.appendChild(card);
      document.body.appendChild(overlay);
    });
  }

  // ─── UI: LIVE SPORTS ROW PICKER ───────────────────

  function showLiveSportsPickerModal(records, template) {
    return new Promise((resolve) => {
      const accent = template.accent || "#1565C0";

      const overlay = document.createElement("div");
      Object.assign(overlay.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        zIndex: "2147483646",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      });

      const card = document.createElement("div");
      Object.assign(card.style, {
        background: "#FFFFFF",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        width: "85vw",
        maxWidth: "1000px",
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, sans-serif",
        overflow: "hidden",
      });

      const missingCount = records.filter((r) => !r.hasUrl).length;
      const selectableCount = records.length - missingCount;

      const header = document.createElement("div");
      Object.assign(header.style, {
        padding: "16px 20px",
        borderBottom: "1px solid #E0E0E0",
      });

      const missingNotice =
        missingCount > 0
          ? `<div style="margin-top:6px;padding:8px 12px;background:#FFEBEE;` +
            `border-left:4px solid #D32F2F;color:#B71C1C;font-size:12px;font-weight:600;">` +
            `${missingCount} row${missingCount === 1 ? "" : "s"} ` +
            `${missingCount === 1 ? "is" : "are"} missing a Sony Cloud Link ` +
            `(column O) and cannot be included. Fix the sheet, then re-run.</div>`
          : "";

      header.innerHTML =
        `<div style="font-size:16px;font-weight:700;color:#333333;margin-bottom:2px;">` +
        `Live Sports — Select Creatives</div>` +
        `<div style="font-size:13px;color:#666666;">` +
        `Found ${records.length} matching row${records.length === 1 ? "" : "s"}. ` +
        `Uncheck any you don't want to include.</div>` +
        missingNotice;

      const body = document.createElement("div");
      Object.assign(body.style, {
        flex: "1",
        overflow: "auto",
        padding: "12px 20px",
      });

      const table = document.createElement("table");
      Object.assign(table.style, {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "13px",
      });

      const thStyle =
        "padding:8px;font-size:11px;text-transform:uppercase;color:#666666;" +
        "letter-spacing:0.5px;border-bottom:2px solid #D0D0D0;background:#FAFAFA;";

      const thead = document.createElement("thead");
      thead.innerHTML =
        `<tr>` +
        `<th style="${thStyle}text-align:center;width:40px;">✓</th>` +
        `<th style="${thStyle}text-align:left;">Advertiser</th>` +
        `<th style="${thStyle}text-align:left;">RFPID</th>` +
        `<th style="${thStyle}text-align:left;">RFPI</th>` +
        `<th style="${thStyle}text-align:right;">Start</th>` +
        `<th style="${thStyle}text-align:right;">Flight End</th>` +
        `<th style="${thStyle}text-align:right;">Creative End</th>` +
        `<th style="${thStyle}text-align:left;">Sony Link</th>` +
        `</tr>`;
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      const checkboxes = [];

      records.forEach((rec) => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #EEEEEE";

        if (!rec.hasUrl) {
          tr.style.background = "#FFF5F5";
          tr.style.color = "#999999";
        }

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = rec.hasUrl;
        checkbox.disabled = !rec.hasUrl;
        checkbox.style.cursor = rec.hasUrl ? "pointer" : "not-allowed";
        checkboxes.push({ checkbox, rec });

        const cbCell = document.createElement("td");
        cbCell.style.padding = "10px 8px";
        cbCell.style.textAlign = "center";
        cbCell.appendChild(checkbox);
        tr.appendChild(cbCell);

        const cell = (text, align, isBold) => {
          const td = document.createElement("td");
          td.style.padding = "10px 8px";
          td.style.textAlign = align || "left";
          if (isBold) td.style.fontWeight = "700";
          td.textContent = text;
          return td;
        };

        tr.appendChild(cell(rec.advertiser, "left", true));
        tr.appendChild(cell(rec.rfpid, "left", false));
        tr.appendChild(cell(rec.rfpi, "left", false));
        tr.appendChild(cell(rec.startDate, "right", false));
        tr.appendChild(cell(rec.flightEndDate, "right", false));

        const creativeEndTd = document.createElement("td");
        creativeEndTd.style.padding = "10px 8px";
        creativeEndTd.style.textAlign = "right";
        if (rec.hasCreativeEnd) {
          creativeEndTd.textContent = rec.creativeEndDate;
        } else {
          creativeEndTd.innerHTML =
            `<span style="color:#999999;font-style:italic;font-size:11px;">` +
            `— (uses flight end)</span>`;
        }
        tr.appendChild(creativeEndTd);

        const sonyTd = document.createElement("td");
        sonyTd.style.padding = "10px 8px";
        if (rec.hasUrl) {
          sonyTd.innerHTML = `<span style="color:#2E7D32;font-weight:600;">✓ OK</span>`;
        } else {
          sonyTd.innerHTML =
            `<span style="color:#D32F2F;font-weight:700;">` +
            `✗ Missing — fix sheet</span>`;
        }
        tr.appendChild(sonyTd);

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      body.appendChild(table);

      const footer = document.createElement("div");
      Object.assign(footer.style, {
        padding: "12px 20px",
        borderTop: "1px solid #E0E0E0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      });

      const countLabel = document.createElement("div");
      countLabel.style.fontSize = "13px";
      countLabel.style.color = "#666666";

      const btnStyle = {
        padding: "8px 20px",
        borderRadius: "6px",
        border: "none",
        fontSize: "14px",
        fontWeight: "bold",
        cursor: "pointer",
      };

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      Object.assign(cancelBtn.style, {
        ...btnStyle,
        background: "#E0E0E0",
        color: "#333333",
      });

      const continueBtn = document.createElement("button");
      continueBtn.textContent = "Continue to Preview";
      Object.assign(continueBtn.style, {
        ...btnStyle,
        background: accent,
        color: "#FFFFFF",
      });

      function updateCount() {
        const selected = checkboxes.filter(({ checkbox }) => checkbox.checked).length;
        countLabel.textContent = `${selected} of ${selectableCount} selected`;
        const disabled = selected === 0;
        continueBtn.disabled = disabled;
        continueBtn.style.opacity = disabled ? "0.5" : "1";
        continueBtn.style.cursor = disabled ? "not-allowed" : "pointer";
      }

      checkboxes.forEach(({ checkbox }) => {
        checkbox.addEventListener("change", updateCount);
      });

      const buttonRow = document.createElement("div");
      buttonRow.style.display = "flex";
      buttonRow.style.gap = "10px";
      buttonRow.appendChild(cancelBtn);
      buttonRow.appendChild(continueBtn);

      footer.appendChild(countLabel);
      footer.appendChild(buttonRow);

      function close(result) {
        overlay.remove();
        document.removeEventListener("keydown", onKey);
        resolve(result);
      }

      function onKey(e) {
        if (e.key === "Escape") close(null);
      }

      cancelBtn.addEventListener("click", () => close(null));
      continueBtn.addEventListener("click", () => {
        if (continueBtn.disabled) return;
        const selected = checkboxes
          .filter(({ checkbox }) => checkbox.checked)
          .map(({ rec }) => rec);
        close(selected);
      });

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close(null);
      });

      document.addEventListener("keydown", onKey);

      card.appendChild(header);
      card.appendChild(body);
      card.appendChild(footer);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      updateCount();
    });
  }

  // ─── UI: FLOATING BUTTON ──────────────────────────

  let floatingContainer = null;
  let dropdownVisible = false;

  function removeFloatingButton() {
    if (floatingContainer) {
      floatingContainer.remove();
      floatingContainer = null;
    }

    dropdownVisible = false;
  }

  function buildSectionHints(template) {
    if (template.mode === "selectable-digest" && template.filters) {
      const parts = template.filters.map((f) => {
        const colLetter = colIndexToLetter(f.col);
        if (f.mode === "contains") {
          return `Col ${colLetter} contains "${escapeHtml(f.value)}"`;
        }
        return `Col ${colLetter} = "${escapeHtml(f.value)}"`;
      });
      return [`<b>Matches:</b> ${parts.join(" AND ")}`];
    }

    return template.sections.map((section) => {
      let hint = `<b>${escapeHtml(section.title)}</b> Status = "${escapeHtml(section.filterValue)}"`;

      if (section.dateCol != null && section.dateFilter === "within30") {
        hint += ` and date within 30 days`;
      } else if (section.dateCol != null) {
        hint += ` and date = today`;
      }

      return hint;
    });
  }

  function injectFloatingButton(stationCfg) {
    removeFloatingButton();

    floatingContainer = document.createElement("div");

    Object.assign(floatingContainer.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: "2147483645",
      fontFamily: "Arial, sans-serif",
    });

    const mainBtn = document.createElement("button");
    mainBtn.innerHTML = "✉";
    mainBtn.title = `Generate email for ${stationCfg.callLetters} - ${stationCfg.station}`;

    Object.assign(mainBtn.style, {
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      border: "none",
      background: "#4EA72E",
      color: "#FFFFFF",
      fontSize: "24px",
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      transition: "transform 0.15s",
    });

    mainBtn.addEventListener("mouseenter", () => {
      mainBtn.style.transform = "scale(1.1)";
    });

    mainBtn.addEventListener("mouseleave", () => {
      mainBtn.style.transform = "scale(1)";
    });

    const dropdown = document.createElement("div");

    Object.assign(dropdown.style, {
      position: "absolute",
      bottom: "64px",
      right: "0",
      background: "#FFFFFF",
      borderRadius: "8px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
      overflow: "visible",
      display: "none",
      minWidth: "250px",
    });

    const label = document.createElement("div");
    label.textContent = `${stationCfg.callLetters} - ${stationCfg.station}`;

    Object.assign(label.style, {
      padding: "10px 16px",
      fontSize: "12px",
      color: "#888888",
      borderBottom: "1px solid #E0E0E0",
      fontWeight: "bold",
    });

    dropdown.appendChild(label);

    Object.keys(EMAIL_TEMPLATES).forEach((templateKey) => {
      const template = EMAIL_TEMPLATES[templateKey];

      const row = document.createElement("div");

      Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        position: "relative",
      });

      const item = document.createElement("button");
      item.textContent = getTemplateDisplayName(templateKey);

      Object.assign(item.style, {
        flex: "1",
        padding: "12px 16px",
        border: "none",
        background: "none",
        textAlign: "left",
        fontSize: "14px",
        cursor: "pointer",
        color: "#333333",
      });

      item.addEventListener("mouseenter", () => {
        row.style.background = "#F0F0F0";
      });

      item.addEventListener("mouseleave", () => {
        row.style.background = "none";
      });

      item.addEventListener("click", () => {
        dropdown.style.display = "none";
        dropdownVisible = false;
        handleEmailGeneration(templateKey, stationCfg);
      });

      const hints = buildSectionHints(template);

      const infoBtn = document.createElement("span");
      infoBtn.textContent = "ⓘ";

      Object.assign(infoBtn.style, {
        padding: "0 12px 0 0",
        fontSize: "15px",
        color: "#BBBBBB",
        cursor: "default",
        flexShrink: "0",
      });

      const tooltip = document.createElement("div");
      tooltip.innerHTML =
        `<div style="font-weight:700;margin-bottom:6px;">Includes rows where:</div>` +
        hints.join(`<br>`);

      Object.assign(tooltip.style, {
        display: "none",
        position: "absolute",
        right: "100%",
        top: "50%",
        transform: "translateY(-50%)",
        marginRight: "8px",
        background: "#333333",
        color: "#FFFFFF",
        padding: "10px 14px",
        borderRadius: "8px",
        fontSize: "12px",
        lineHeight: "1.5",
        whiteSpace: "nowrap",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: "2147483647",
        pointerEvents: "none",
      });

      infoBtn.addEventListener("mouseenter", () => {
        tooltip.style.display = "block";
      });

      infoBtn.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });

      row.appendChild(item);
      row.appendChild(infoBtn);
      row.appendChild(tooltip);
      dropdown.appendChild(row);
    });

    mainBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownVisible = !dropdownVisible;
      dropdown.style.display = dropdownVisible ? "block" : "none";
    });

    document.addEventListener("click", () => {
      if (dropdownVisible) {
        dropdown.style.display = "none";
        dropdownVisible = false;
      }
    });

    floatingContainer.appendChild(dropdown);
    floatingContainer.appendChild(mainBtn);
    document.body.appendChild(floatingContainer);
  }

  // ─── ORCHESTRATION ────────────────────────────────

  async function handleLiveSportsGeneration(template, stationCfg) {
    const gid = getGidFromUrl();

    if (!gid) {
      showToast("Could not determine sheet GID from URL", true);
      return;
    }

    showToast(`Fetching data for ${stationCfg.callLetters}...`, false);

    let allRows;
    try {
      allRows = await fetchSheetCsv(gid);
    } catch (err) {
      showToast(`Could not read sheet data: ${err.message}`, true);
      return;
    }

    const matchingRows = allRows.filter((row) => rowMatchesFilters(row, template.filters));

    if (OPTIONS.debug) {
      console.log(
        `[Station Email] Live Sports: ${matchingRows.length} matching rows ` +
          `out of ${allRows.length} total`
      );
    }

    if (!matchingRows.length) {
      const criteriaText = template.filters
        .map((f) => {
          const colLetter = colIndexToLetter(f.col);
          return f.mode === "contains"
            ? `Col ${colLetter} contains "${f.value}"`
            : `Col ${colLetter} = "${f.value}"`;
        })
        .join(" AND ");
      showToast(`No rows found. Criteria: ${criteriaText}`, true);
      return;
    }

    const records = matchingRows.map((row) => mapToLiveSportsRecord(row, template.columnMap));
    const anyMissing = records.some((r) => !r.hasUrl);

    let selected;

    if (records.length === 1 && !anyMissing) {
      // Single valid match: skip picker, go straight to preview
      selected = records;
    } else {
      // 2+ matches OR any missing URLs: show picker
      const result = await showLiveSportsPickerModal(records, template);
      if (result === null) {
        return; // cancelled
      }
      if (!result.length) {
        showToast("No rows selected", true);
        return;
      }
      selected = result;
    }

    const subject = buildLiveSportsSubject(stationCfg.callLetters, selected);
    const htmlBody = buildLiveSportsHtml(selected, template);
    const plainTextBody = buildLiveSportsPlainText(selected, template);

    // Template recipients override station recipients
    const to = template.to || stationCfg.to;
    const cc = template.cc || stationCfg.cc;

    const confirmed = await showPreviewModal({
      to,
      cc,
      subject,
      htmlBody,
    });

    if (!confirmed) {
      return;
    }

    const emlContent = generateEml({
      to,
      cc,
      subject,
      htmlBody,
      plainTextBody,
    });

    const fileName = buildLiveSportsFileName(stationCfg.callLetters, selected, template);

    downloadEml(emlContent, fileName);
    showToast(`Draft downloaded: ${fileName}`, false);
  }

  async function handleEmailGeneration(templateKey, stationCfg) {
    const template = EMAIL_TEMPLATES[templateKey];

    if (!template) {
      showToast(`Unknown email template: ${templateKey}`, true);
      return;
    }

    // Branch for per-row selectable-digest templates (Live Sports)
    if (template.mode === "selectable-digest") {
      return handleLiveSportsGeneration(template, stationCfg);
    }

    // Existing digest flow
    const gid = getGidFromUrl();

    if (!gid) {
      showToast("Could not determine sheet GID from URL", true);
      return;
    }

    showToast(`Fetching data for ${stationCfg.callLetters}...`, false);

    let allRows;

    try {
      allRows = await fetchSheetCsv(gid);
    } catch (err) {
      showToast(`Could not read sheet data: ${err.message}`, true);
      return;
    }

    const hasData = template.sections.some((section) => {
      const cols = section.dataCols || template.dataCols;
      return filterRows(allRows, section, cols).length > 0;
    });

    if (!hasData) {
      const criteria = template.sections.map((section) => {
        let criterion = `Status = "${section.filterValue}"`;

        if (section.dateCol != null && section.dateFilter === "within30") {
          criterion += ` + within next 30 days`;
        } else if (section.dateCol != null) {
          criterion += ` + today's date`;
        }

        return criterion;
      });

      showToast(`No rows found. Looked for: ${criteria.join("; ")}`, true);
      return;
    }

    const htmlBody = buildEmailHtml(allRows, template);
    const plainTextBody = buildPlainText(allRows, template);
    const subject = template.subjectFn(stationCfg);

    const confirmed = await showPreviewModal({
      to: stationCfg.to,
      cc: stationCfg.cc,
      subject,
      htmlBody,
    });

    if (!confirmed) {
      return;
    }

    const emlContent = generateEml({
      to: stationCfg.to,
      cc: stationCfg.cc,
      subject,
      htmlBody,
      plainTextBody,
    });

    const fileName = buildDownloadFileName(stationCfg, template);

    downloadEml(emlContent, fileName);
    showToast(`Draft downloaded: ${fileName}`, false);
  }

  // ─── INIT ─────────────────────────────────────────

  let lastGid = null;

  function updateButton() {
    const gid = getGidFromUrl();

    if (gid === lastGid) {
      return;
    }

    lastGid = gid;

    if (!gid || !STATION_CONFIG[gid]) {
      removeFloatingButton();
      return;
    }

    injectFloatingButton(STATION_CONFIG[gid]);
  }

  function main() {
    updateButton();

    window.addEventListener("hashchange", updateButton);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        updateButton();
      }
    });

    setInterval(updateButton, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
