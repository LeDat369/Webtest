const ACCESS_TOKEN = "";

const SHEETS = {
  overview: "Overview",
  members: "Members",
  timeline: "Timeline",
  gallery: "Gallery",
  tree: "Tree",
};

const META = {
  overview: {
    headers: ["key", "value"],
    widths: [180, 520],
  },
  members: {
    headers: ["name", "role", "birthYear", "deathYear", "bio"],
    widths: [220, 160, 120, 120, 520],
  },
  timeline: {
    headers: ["year", "text"],
    widths: [120, 620],
  },
  gallery: {
    headers: ["label", "url"],
    widths: [220, 620],
  },
  tree: {
    headers: ["id", "parentId", "label", "order"],
    widths: [120, 120, 520, 80],
  },
};

function isAllowed(e) {
  if (!ACCESS_TOKEN) return true;
  return e && e.parameter && e.parameter.token === ACCESS_TOKEN;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name, meta) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const headers = meta.headers;
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
  sheet.appendRow(META.overview.headers);

  const rows = Object.entries(data.overview || {});
  rows.push(["contactEmail", data.contactEmail || ""]);
  rows.forEach(([key, value]) => sheet.appendRow([key, value]));
}

function getList(name, meta) {
  const sheet = getSheet(name, meta);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map((h) => String(h || "").trim());
  return values
    .slice(1)
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => {
      const obj = {};
      headers.forEach((key, idx) => {
        obj[key] = row[idx] ?? "";
      });
      return obj;
    });
}

function setList(name, meta, rows) {
  const sheet = getSheet(name, meta);
  sheet.clearContents();
  sheet.appendRow(meta.headers);

  (rows || []).forEach((row) => {
    sheet.appendRow(meta.headers.map((key) => row[key] ?? ""));
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
