const express = require("express");
const router = express.Router();

// Prosty walidator NIP (tylko format: 10 cyfr)
function normalizeNip(nip) {
  return String(nip || "").replace(/[\s-]/g, "");
}

router.get("/mf/nip/:nip", async (req, res) => {
  const nip = normalizeNip(req.params.nip);

  if (!/^\d{10}$/.test(nip)) {
    return res.status(400).json({ ok: false, error: "Nieprawidłowy NIP (wymagane 10 cyfr)." });
  }

  // API MF wymaga parametru date=YYYY-MM-DD
  const today = new Date().toISOString().slice(0, 10);

  // Oficjalny endpoint API wykazu VAT (białej listy)
  // GET /api/search/nip/{nip}?date=YYYY-MM-DD :contentReference[oaicite:1]{index=1}
  const url = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${today}`;

  try {
    const r = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!r.ok) {
      return res.status(502).json({ ok: false, error: `MF API error: ${r.status}` });
    }

    const data = await r.json();

    const subject = data?.result?.subject || null;

    return res.json({
      ok: true,
      nip,
      companyName: subject?.name || null,
      companyAddress: subject?.workingAddress || subject?.residenceAddress || null
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: `MF API fetch failed: ${e.message}` });
  }
});

const fs = require("fs");
const path = require("path");

function parseCsvLine(line) {
  // proste CSV z cudzysłowami i przecinkami
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function loadClosedProducts() {
  const filePath = path.join(__dirname, "..", "data", "closed-products.csv");
  const raw = fs.readFileSync(filePath, "utf8")
    .replace(/^\uFEFF/, "") // BOM
    .split(/\r?\n/)
    .filter(Boolean);

  // w pliku: nagłówek Imported table, potem linia kolumn, potem dane
  // szukamy linii która zaczyna się od "Column 1"
  const headerIdx = raw.findIndex(l => l.startsWith('"Column 1"'));
  if (headerIdx === -1) return [];

  const headers = parseCsvLine(raw[headerIdx]).map(h => h.replace(/^"|"$/g, ""));
  const dataLines = raw.slice(headerIdx + 1);

  const rows = [];
  for (const line of dataLines) {
    if (!line.startsWith('"')) continue;
    const vals = parseCsvLine(line).map(v => v.replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] ?? "");
    // mapowanie na sensowne pola
    rows.push({
      element: obj["Column 1"] || "",
      width: obj["Column 2"] || "",
      length: obj["Column 3"] || "",
      height: obj["Column 4"] || "",
      thickness: obj["Column 5"] || ""
    });
  }

  // odfiltruj puste wiersze
  return rows.filter(r => r.element);
}

router.get("/closed-products", (req, res) => {
  try {
    const products = loadClosedProducts();
    res.json({ ok: true, products });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


module.exports = router;
