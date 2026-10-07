const PROPS = PropertiesService.getScriptProperties();

function cfg_(key) {
  return PROPS.getProperty(key) || "";
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function auth_(token) {
  const expected = cfg_("API_TOKEN");
  return expected && token && String(token) === expected;
}

function sheet_() {
  const id = cfg_("SPREADSHEET_ID");
  if (!id) throw new Error("SPREADSHEET_ID não configurado");
  const sh = SpreadsheetApp.openById(id).getSheetByName("Movimentações");
  if (!sh) throw new Error("Aba Movimentações não encontrada");
  return sh;
}

function formatDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, "America/Sao_Paulo", "yyyy-MM-dd");
  }
  return String(value || "");
}

function monthPt_(date) {
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return months[date.getMonth()];
}

function list_() {
  const sh = sheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter(r => r[0] !== "").map(r => ({
    id: r[0],
    date: formatDate_(r[1]),
    type: r[2],
    description: r[3],
    category: r[4],
    subcategory: r[5],
    purpose: r[6],
    classification: r[7],
    amount: Number(r[8]) || 0,
    month: r[9],
    year: r[10],
    status: r[11],
    note: r[12]
  }));
}

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  if (!auth_(p.token)) return json_({ error: "unauthorized" });
  if ((p.action || "list") === "list") {
    return json_({ ok: true, transactions: list_() });
  }
  return json_({ error: "unknown_action" });
}

function doPost(e) {
  let d = {};
  try {
    d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (_) {
    return json_({ error: "invalid_json" });
  }
  if (!auth_(d.token)) return json_({ error: "unauthorized" });
  if ((d.action || "create") !== "create") return json_({ error: "unknown_action" });

  const sh = sheet_();
  const date = new Date((d.date || Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd")) + "T12:00:00");
  const id = Date.now();

  sh.appendRow([
    id,
    date,
    d.type || "Saída",
    d.description || "",
    d.category || "Outros",
    d.subcategory || "",
    d.purpose || "Registrado pelo Nexus Finance",
    d.classification || "Controlável",
    Number(d.amount) || 0,
    monthPt_(date),
    Number(Utilities.formatDate(date, "America/Sao_Paulo", "yyyy")),
    d.status || "Realizado",
    d.note || ""
  ]);

  return json_({
    ok: true,
    transaction: {
      id,
      date: Utilities.formatDate(date, "America/Sao_Paulo", "yyyy-MM-dd"),
      type: d.type || "Saída",
      description: d.description || "",
      category: d.category || "Outros",
      subcategory: d.subcategory || "",
      purpose: d.purpose || "Registrado pelo Nexus Finance",
      classification: d.classification || "Controlável",
      amount: Number(d.amount) || 0,
      status: d.status || "Realizado",
      note: d.note || ""
    }
  });
}