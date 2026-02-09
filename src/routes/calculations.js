const express = require("express");
const { getDb } = require("../db/db");
const { requireAuth, requireSales } = require("../middleware/auth");

const router = express.Router();

const PRODUCTS = [
  "AKCESORIA",
  "ANTRESOLE",
  "CZĘŚCI ZAMIENNE",
  "NAPRAWA ROS",
  "PROJEKTOWANIE",
  "REGAŁY PÓŁKOWE",
  "REGAŁY",
  "SERWIS",
  "WÓZKI WIDŁOWE",
  "PRZEGLĄD",
  "PRSES",
  "STOREGANIZER",
  "PRSES ONLINE",
  "PRSES ODNOWIENIE",
];

const STATUS = [
  { id: 1, name: "w przygotowaniu" },
  { id: 2, name: "oferta email" },
  { id: 3, name: "oferta oficjalna" },
  { id: 4, name: "przegrana" },
  { id: 5, name: "rezygnacja" },
  { id: 6, name: "w realizacji" },
  { id: 7, name: "zlecono wystawnie faktury" },
  { id: 8, name: "sprzedaż - zafakturowano" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// LISTA
router.get("/", requireAuth, (req, res) => {
  const db = getDb();
  const user = req.session.user;

  // użytkownicy, których kalkulacje widzę: ja + połączeni (w obie strony)
  const rows = db.prepare(`
    SELECT c.*, u.first_name AS creator_first, u.last_name AS creator_last
    FROM calculations c
    JOIN users u ON u.id = c.created_by_user_id
    WHERE c.created_by_user_id = ?
       OR c.created_by_user_id IN (
            SELECT designer_id FROM salesperson_designers WHERE salesperson_id = ?
          )
       OR c.created_by_user_id IN (
            SELECT salesperson_id FROM salesperson_designers WHERE designer_id = ?
          )
    ORDER BY c.created_at DESC
  `).all(user.id, user.id, user.id);

  res.render("calculations", { rows, STATUS });
});

// NOWA KALKULACJA – tylko handlowiec
router.get("/new", requireAuth, (req, res) => {
  const db = getDb();
  const user = req.session.user;

  let salespeople = [];

  if (user.role === "designer") {
    salespeople = db
      .prepare(
        `
      SELECT u.id, u.first_name, u.last_name, u.sales_number
      FROM users u
      JOIN salesperson_designers sd ON sd.salesperson_id = u.id
      WHERE sd.designer_id = ?
      ORDER BY u.last_name, u.first_name
    `,
      )
      .all(user.id);
  }

  res.render("new-calculation", {
    PRODUCTS,
    STATUS,
    calculationDate: todayISO(),
    performerName: `${req.session.user.firstName} ${req.session.user.lastName}`,
  });
});

// ZATWIERDŹ (create)

router.post("/new", requireAuth, (req, res) => {
  const db = getDb();
  const user = req.session.user;
  // owner = handlowiec
//   let ownerSalespersonId = user.id;

  // jeśli projektant - owner wybierany z formularza
//   if (user.role === "designer") {
//     ownerSalespersonId = parseInt(req.body.ownerSalespersonId, 10);

//     if (!ownerSalespersonId) {
//       req.session.err = "Musisz wybrać handlowca.";
//       return res.redirect("/calculations/new");
//     }
//   }
  const nip = String(req.body.nip || "").replace(/[\s-]/g, "");
  const companyName = (req.body.companyName || "").trim();
  const companyAddress = (req.body.companyAddress || "").trim();

  const calculationDate = (req.body.calculationDate || "").trim() || todayISO();

  const contactPerson = (req.body.contactPerson || "").trim();
  const contactEmail = (req.body.contactEmail || "").trim();

  const branchCity = (req.body.branchCity || "").trim();
  const voivodeship = (req.body.voivodeship || "").trim();
  const endCustomer = (req.body.endCustomer || "").trim();

  const isNewCustomer = req.body.isNewCustomer === "1" ? 1 : 0;

  const productType = (req.body.productType || "").trim();
  const productDetails = (req.body.productDetails || "").trim();

  const status = parseInt(req.body.status, 10);

  // opcjonalne
  const turnoverRaw = (req.body.turnover || "").trim();
  const offerType = (req.body.offerType || "").trim(); // Podstawowa/Uproszczona albo puste

  if (!/^\d{10}$/.test(nip)) {
    req.session.err = "NIP musi mieć 10 cyfr.";
    return res.redirect("/calculations/new");
  }

  if (
    !contactPerson ||
    !contactEmail ||
    !branchCity ||
    !voivodeship ||
    !endCustomer ||
    !productType ||
    !productDetails ||
    !status
  ) {
    req.session.err = "Uzupełnij wszystkie wymagane pola.";
    return res.redirect("/calculations/new");
  }

  if (!PRODUCTS.includes(productType)) {
    req.session.err = "Nieprawidłowy rodzaj produktu.";
    return res.redirect("/calculations/new");
  }

  if (!STATUS.some((s) => s.id === status)) {
    req.session.err = "Nieprawidłowy status.";
    return res.redirect("/calculations/new");
  }

  let turnover = null;
  if (turnoverRaw) {
    const t = Number(turnoverRaw.replace(",", "."));
    if (!Number.isFinite(t) || t < 0) {
      req.session.err = "Obrót musi być liczbą >= 0 (albo zostaw puste).";
      return res.redirect("/calculations/new");
    }
    turnover = t;
  }

  let offerTypeFinal = null;
  if (offerType) {
    if (!["Podstawowa", "Uproszczona"].includes(offerType)) {
      req.session.err =
        "Rodzaj oferty: Podstawowa albo Uproszczona (albo puste).";
      return res.redirect("/calculations/new");
    }
    offerTypeFinal = offerType;
  }

  const info = db
    .prepare(
      `
  INSERT INTO calculations(
    created_by_user_id,
    calculation_date,
    nip, company_name, company_address,
    contact_person, contact_email,
    branch_city, voivodeship, end_customer,
    is_new_customer,
    product_type, product_details,
    status,
    turnover, offer_type
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`,
    )
    .run(
      user.id,
      calculationDate,
      nip,
      companyName || null,
      companyAddress || null,
      contactPerson,
      contactEmail,
      branchCity,
      voivodeship,
      endCustomer,
      isNewCustomer,
      productType,
      productDetails,
      status,
      turnover,
      offerTypeFinal,
    );

  req.session.msg = "Kalkulacja zapisana.";
  return res.redirect(`/calculations/${info.lastInsertRowid}`);
});

// SZCZEGÓŁY (klik)
router.get("/:id", requireAuth, (req, res) => {
  const db = getDb();
  const user = req.session.user;

  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect("/calculations");

  const row = db.prepare(`
    SELECT c.*, u.first_name AS creator_first, u.last_name AS creator_last
    FROM calculations c
    JOIN users u ON u.id = c.created_by_user_id
    WHERE c.id = ?
      AND (
        c.created_by_user_id = ?
        OR c.created_by_user_id IN (
            SELECT designer_id FROM salesperson_designers WHERE salesperson_id = ?
        )
        OR c.created_by_user_id IN (
            SELECT salesperson_id FROM salesperson_designers WHERE designer_id = ?
        )
      )
  `).get(id, user.id, user.id, user.id);

  if (!row) {
    req.session.err = "Brak dostępu albo nie istnieje.";
    return res.redirect("/calculations");
  }

  res.render("calculation", { row, STATUS, PRODUCTS });
});

router.post("/:id/save", requireAuth, express.json(), (req, res) => {
  const db = getDb();
  const user = req.session.user;
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: "Bad id" });

  // Dostęp: ja lub połączeni (w obie strony)
  const can = db.prepare(`
    SELECT c.id
    FROM calculations c
    WHERE c.id = ?
      AND (
        c.created_by_user_id = ?
        OR c.created_by_user_id IN (SELECT designer_id FROM salesperson_designers WHERE salesperson_id = ?)
        OR c.created_by_user_id IN (SELECT salesperson_id FROM salesperson_designers WHERE designer_id = ?)
      )
  `).get(id, user.id, user.id, user.id);

  if (!can) return res.status(403).json({ ok: false, error: "Brak dostępu" });

  // --- pola "nagłówka" (te co wcześniej były w "Zapisz zmiany") ---
  const status = parseInt(req.body.status, 10);
  const turnover = req.body.turnover === "" || req.body.turnover == null ? null : Number(String(req.body.turnover).replace(",", "."));
  const offerType = (req.body.offerType || "").trim() || null;

  if (!STATUS.some(s => s.id === status)) {
    return res.status(400).json({ ok: false, error: "Nieprawidłowy status" });
  }
  if (turnover !== null && (!Number.isFinite(turnover) || turnover < 0)) {
    return res.status(400).json({ ok: false, error: "Nieprawidłowy obrót" });
  }
  if (offerType && !["Podstawowa", "Uproszczona"].includes(offerType)) {
    return res.status(400).json({ ok: false, error: "Nieprawidłowy rodzaj oferty" });
  }

  // --- tabelki ---
  const summary = (req.body.summary && typeof req.body.summary === "object") ? req.body.summary : {};

  const plItems = Array.isArray(req.body.plItems) ? req.body.plItems : [];
  const foreignItems = Array.isArray(req.body.foreignItems) ? req.body.foreignItems : [];
  const quickOffer = Array.isArray(req.body.quickOffer) ? req.body.quickOffer : [];

  db.prepare(`
UPDATE calculations
SET status = ?, turnover = ?, offer_type = ?,
    pl_items_json = ?, foreign_items_json = ?, quick_offer_json = ?,
    summary_json = ?
WHERE id = ?
  `).run(
    status,
    turnover,
    offerType,
    JSON.stringify(plItems),
    JSON.stringify(foreignItems),
    JSON.stringify(quickOffer),
    JSON.stringify(summary),
    id
  );

  return res.json({ ok: true });
});

const PDFDocument = require("pdfkit");

router.get("/:id/pdf", requireAuth, (req, res) => {
  const db = getDb();
  const user = req.session.user;
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).send("Bad id");

  // dostęp: taki sam jak podgląd
  const row = db.prepare(`
    SELECT c.*, u.first_name AS creator_first, u.last_name AS creator_last
    FROM calculations c
    JOIN users u ON u.id = c.created_by_user_id
    WHERE c.id = ?
      AND (
        c.created_by_user_id = ?
        OR c.created_by_user_id IN (SELECT designer_id FROM salesperson_designers WHERE salesperson_id = ?)
        OR c.created_by_user_id IN (SELECT salesperson_id FROM salesperson_designers WHERE designer_id = ?)
      )
  `).get(id, user.id, user.id, user.id);

  if (!row) return res.status(403).send("Brak dostępu");

  const plItems = JSON.parse(row.pl_items_json || "[]");
  const foreignItems = JSON.parse(row.foreign_items_json || "[]");
  const quickOffer = JSON.parse(row.quick_offer_json || "[]");
  const summary = JSON.parse(row.summary_json || "{}");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="kalkulacja-${row.id}.pdf"`);

  const doc = new PDFDocument({ margin: 30 });
  doc.pipe(res);

  doc.fontSize(16).text(`Kalkulacja #${row.id}`, { align: "left" });
  doc.moveDown(0.5);

  doc.fontSize(10).text(`Data: ${row.calculation_date || ""}`);
  doc.text(`NIP: ${row.nip || ""}`);
  doc.text(`Klient: ${row.company_name || ""}`);
  doc.text(`Adres: ${row.company_address || ""}`);
  doc.text(`Kontakt: ${row.contact_person || ""} / ${row.contact_email || ""}`);
  doc.text(`Miasto: ${row.branch_city || ""} | Woj.: ${row.voivodeship || ""}`);
  doc.text(`Produkt: ${row.product_type || ""}`);
  doc.text(`Status: ${row.status || ""}`);
  doc.moveDown(1);

  function table(title, headers, rows) {
    doc.fontSize(12).text(title);
    doc.moveDown(0.3);
    doc.fontSize(8);

    // nagłówek
    doc.text(headers.join(" | "));
    doc.moveDown(0.2);
    doc.text("-".repeat(120));
    doc.moveDown(0.2);

    for (const r of rows) {
      doc.text(r.map(x => (x ?? "")).join(" | "));
    }
    doc.moveDown(0.8);
  }

  table(
    "Specyfikacja PL",
    ["qty","typ","wymiary","dostawca","cena","waga","kurs"],
    plItems.map(it => [it.qty, it.type, it.dims, it.supplier, it.unitPrice, it.unitWeight, it.rate])
  );

  table(
    "Specyfikacja Zagranica",
    ["qty","typ","wymiary","dostawca","cena","waga","rabat"],
    foreignItems.map(it => [it.qty, it.type, it.dims, it.supplier, it.unitPrice, it.unitWeight, it.discount])
  );

  table(
    "Szybka oferta",
    ["producent","element","wymiary","qtyNeed","qtyStock","sprzedaż","transport","montaż"],
    quickOffer.map(it => [it.producer, it.element, it.dims, it.qtyNeed, it.qtyStock, it.salePrice, it.transport, it.assembly])
  );

  doc.fontSize(12).text("Podsumowanie");
  doc.moveDown(0.3);
  doc.fontSize(9);
  doc.text(`Towar zagranica (EUR): wartość=${summary.valEur ?? ""} kurs=${summary.fxEur ?? ""} sprzedaż=${summary.saleEur ?? ""} marża%=${summary.marginEur ?? ""}`);
  doc.text(`Towar PL (PLN): wartość=${summary.valPln ?? ""} kurs=${summary.fxPln ?? ""} sprzedaż=${summary.salePln ?? ""} marża%=${summary.marginPln ?? ""}`);
  doc.text(`Serwis: wartość=${summary.valSrv ?? ""} sprzedaż=${summary.saleSrv ?? ""} marża%=${summary.marginSrv ?? ""}`);
  doc.text(`Montaż: wartość=${summary.valMnt ?? ""} sprzedaż=${summary.saleMnt ?? ""} marża%=${summary.marginMnt ?? ""}`);
  doc.text(`Transport: wartość=${summary.valTrn ?? ""} sprzedaż=${summary.saleTrn ?? ""} marża%=${summary.marginTrn ?? ""}`);
  doc.moveDown(0.5);
  doc.text(`SUMA sprzedaży: ${summary.saleTotal ?? ""}`);
  doc.text(`Marża końcowa projektu: ${summary.marginTotal ?? ""}%`);

  doc.end();
});



// EDYCJA pól “do wypełnienia później” (na razie: obrót + rodzaj oferty + status)
router.post("/:id/update", requireAuth, (req, res) => {
  const db = getDb();
  const user = req.session.user;

  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect("/calculations");

  const status = parseInt(req.body.status, 10);
  const turnoverRaw = (req.body.turnover || "").trim();
  const offerType = (req.body.offerType || "").trim();

  if (!STATUS.some(s => s.id === status)) {
    req.session.err = "Nieprawidłowy status.";
    return res.redirect(`/calculations/${id}`);
  }

  let turnover = null;
  if (turnoverRaw) {
    const t = Number(turnoverRaw.replace(",", "."));
    if (!Number.isFinite(t) || t < 0) {
      req.session.err = "Obrót musi być liczbą >= 0 (albo puste).";
      return res.redirect(`/calculations/${id}`);
    }
    turnover = t;
  }

  let offerTypeFinal = null;
  if (offerType) {
    if (!["Podstawowa", "Uproszczona"].includes(offerType)) {
      req.session.err = "Rodzaj oferty: Podstawowa albo Uproszczona (albo puste).";
      return res.redirect(`/calculations/${id}`);
    }
    offerTypeFinal = offerType;
  }

  // Sprawdź czy user ma dostęp do tej kalkulacji (ja lub połączeni)
  const row = db.prepare(`
    SELECT id, created_by_user_id
    FROM calculations
    WHERE id = ?
  `).get(id);

  if (!row) {
    req.session.err = "Nie istnieje.";
    return res.redirect("/calculations");
  }

  const creatorId = row.created_by_user_id;

  const isConnected = db.prepare(`
    SELECT 1
    WHERE ? = ?
       OR EXISTS (SELECT 1 FROM salesperson_designers WHERE salesperson_id = ? AND designer_id = ?)
       OR EXISTS (SELECT 1 FROM salesperson_designers WHERE salesperson_id = ? AND designer_id = ?)
  `).get(user.id, creatorId, creatorId, user.id, user.id, creatorId);

  if (!isConnected) {
    req.session.err = "Brak dostępu.";
    return res.redirect("/calculations");
  }

  db.prepare(`
    UPDATE calculations
    SET status = ?, turnover = ?, offer_type = ?
    WHERE id = ?
  `).run(status, turnover, offerTypeFinal, id);

  req.session.msg = "Zaktualizowano kalkulację.";
  return res.redirect(`/calculations/${id}`);
});

router.post("/:id/tables", requireAuth, express.json(), (req, res) => {
  const db = getDb();
  const user = req.session.user;
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: "Bad id" });

  // sprawdź dostęp (Ty masz już “połączenia” w obie strony – użyj tej samej logiki co do wglądu)
  const can = db.prepare(`
    SELECT 1
    FROM calculations c
    WHERE c.id = ?
      AND (
        c.created_by_user_id = ?
        OR c.created_by_user_id IN (SELECT designer_id FROM salesperson_designers WHERE salesperson_id = ?)
        OR c.created_by_user_id IN (SELECT salesperson_id FROM salesperson_designers WHERE designer_id = ?)
      )
  `).get(id, user.id, user.id, user.id);

  if (!can) return res.status(403).json({ ok: false, error: "Brak dostępu" });

  const plItems = Array.isArray(req.body.plItems) ? req.body.plItems : [];
  const foreignItems = Array.isArray(req.body.foreignItems) ? req.body.foreignItems : [];
  const quickOffer = Array.isArray(req.body.quickOffer) ? req.body.quickOffer : [];

  db.prepare(`
    UPDATE calculations
    SET pl_items_json = ?, foreign_items_json = ?, quick_offer_json = ?
    WHERE id = ?
  `).run(JSON.stringify(plItems), JSON.stringify(foreignItems), JSON.stringify(quickOffer), id);

  return res.json({ ok: true });
});


module.exports = router;
