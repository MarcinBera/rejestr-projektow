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

module.exports = router;
