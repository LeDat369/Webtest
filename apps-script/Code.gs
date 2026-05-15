const ACCESS_TOKEN = "";

const SHEETS = {
  overview: { name: "Tổng quan", legacy: "Overview" },
  members: { name: "Thành viên", legacy: "Members" },
  timeline: { name: "Dòng thời gian", legacy: "Timeline" },
  gallery: { name: "Thư viện", legacy: "Gallery" },
  tree: { name: "Cây gia phả", legacy: "Tree" },
};

const META = {
  overview: {
    keys: ["key", "value"],
    labels: ["Trường", "Giá trị"],
    widths: [180, 520],
  },
  members: {
    keys: ["name", "role", "birthYear", "deathYear", "bio"],
    labels: ["Họ tên", "Vai trò", "Năm sinh", "Năm mất", "Ghi chú"],
    widths: [220, 160, 120, 120, 520],
  },
  timeline: {
    keys: ["year", "text"],
    labels: ["Năm", "Sự kiện"],
    widths: [120, 620],
  },
  gallery: {
    keys: ["label", "url"],
    labels: ["Nhãn", "URL"],
    widths: [220, 620],
  },
  tree: {
    keys: ["id", "parentId", "label", "order"],
    labels: ["ID", "ID cha", "Nhãn", "Thứ tự"],
    widths: [120, 120, 520, 80],
  },
};

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase();
}

function getDisplayHeaders(meta) {
  return meta.labels || meta.headers || meta.keys || [];
}

function getDataKeys(meta) {
  return meta.keys || meta.headers || [];
}

function mapHeadersToKeys(meta, headers) {
  const keys = getDataKeys(meta);
  const labels = meta.labels || [];
  const lookup = {};

  keys.forEach((key, index) => {
    lookup[normalizeHeader(key)] = key;
    if (labels[index]) lookup[normalizeHeader(labels[index])] = key;
  });

  return headers.map((header) => {
    const normalized = normalizeHeader(header);
    return lookup[normalized] || String(header || "").trim();
  });
}

function isAllowed(e) {
  if (!ACCESS_TOKEN) return true;
  return e && e.parameter && e.parameter.token === ACCESS_TOKEN;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(sheetInfo, meta) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const info =
    typeof sheetInfo === "string" ? { name: sheetInfo } : sheetInfo || {};
  const primaryName = info.name || "Sheet1";
  const legacyName = info.legacy;

  let sheet = ss.getSheetByName(primaryName);
  if (!sheet && legacyName) {
    const legacySheet = ss.getSheetByName(legacyName);
    if (legacySheet) {
      legacySheet.setName(primaryName);
      sheet = legacySheet;
    }
  }
  if (!sheet) sheet = ss.insertSheet(primaryName);

  const headers = getDisplayHeaders(meta);
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(headers);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#f2e6d8");

  meta.widths.forEach((width, index) => {
    sheet.setColumnWidth(index + 1, width);
  });

  return sheet;
}

function getOverview() {
  const sheet = getSheet(SHEETS.overview, META.overview);
  const values = sheet.getDataRange().getValues();
  const overview = {};
  values.slice(1).forEach(([key, value]) => {
    if (key) overview[String(key)] = value ?? "";
  });

  const contactEmail = overview.contactEmail || "";
  delete overview.contactEmail;
  return { overview, contactEmail };
}

function setOverview(data) {
  const sheet = getSheet(SHEETS.overview, META.overview);
  sheet.clearContents();
  sheet.appendRow(getDisplayHeaders(META.overview));

  const rows = Object.entries(data.overview || {});
  rows.push(["contactEmail", data.contactEmail || ""]);
  rows.forEach(([key, value]) => sheet.appendRow([key, value]));
}

function getList(name, meta) {
  const sheet = getSheet(name, meta);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map((h) => String(h || "").trim());
  const mappedHeaders = mapHeadersToKeys(meta, headers);
  return values
    .slice(1)
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => {
      const obj = {};
      mappedHeaders.forEach((key, idx) => {
        obj[key] = row[idx] ?? "";
      });
      return obj;
    });
}

function setList(name, meta, rows) {
  const sheet = getSheet(name, meta);
  sheet.clearContents();
  const dataKeys = getDataKeys(meta);
  sheet.appendRow(getDisplayHeaders(meta));

  (rows || []).forEach((row) => {
    sheet.appendRow(dataKeys.map((key) => row[key] ?? ""));
  });
}

function doGet(e) {
  if (!isAllowed(e)) return json({ ok: false, error: "unauthorized" });

  const { overview, contactEmail } = getOverview();
  const data = {
    overview,
    contactEmail,
    members: getList(SHEETS.members, META.members),
    timeline: getList(SHEETS.timeline, META.timeline),
    gallery: getList(SHEETS.gallery, META.gallery),
    treeRows: getList(SHEETS.tree, META.tree),
  };
  return json(data);
}

function doPost(e) {
  if (!isAllowed(e)) return json({ ok: false, error: "unauthorized" });

  const body = JSON.parse((e.postData && e.postData.contents) || "{}");
  setOverview(body);
  setList(SHEETS.members, META.members, body.members);
  setList(SHEETS.timeline, META.timeline, body.timeline);
  setList(SHEETS.gallery, META.gallery, body.gallery);
  setList(SHEETS.tree, META.tree, body.treeRows);
  return json({ ok: true });
}
