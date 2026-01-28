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
  "PRSES ODNOWIENIE"
];

const STATUS = [
  { id: 1, name: "w przygotowaniu" },
  { id: 2, name: "oferta email" },
  { id: 3, name: "oferta oficjalna" },
  { id: 4, name: "przegrana" },
  { id: 5, name: "rezygnacja" },
  { id: 6, name: "w realizacji" },
  { id: 7, name: "zlecono wystawnie faktury" },
  { id: 8, name: "sprzedaż - zafakturowano" }
];

// numer projektu: YY/nrHandlowca/najbliższy wolny numer
function computeNextProjectNo(db, salesNumber) {
  const year = new Date().getFullYear();
  const yy = String(year).slice(2); // 2026 -> "26"

  // Wyciągamy max z suffixu (po ostatnim slashu) dla danego roku i handlowca
  const rows = db
    .prepare(`SELECT project_no FROM projects WHERE project_no LIKE ?`)
    .all(`${yy}/${salesNumber}/%`);

  let maxNum = 0;
  for (const r of rows) {
    const parts = String(r.project_no).split("/");
    const n = parseInt(parts[2], 10);
    if (!Number.isNaN(n) && n > maxNum) maxNum = n;
  }

  const next = maxNum + 1;
  return `${yy}/${salesNumber}/${next}`;
}

// Lista projektów:
// - sales: swoje
// - designer: projekty handlowców, do których jest przypisany
router.get("/", requireAuth, (req, res) => {
  const db = getDb();
  const user = req.session.user;

  let projects = [];

  if (user.role === "sales") {
    projects = db.prepare(`
      SELECT p.*
      FROM projects p
      WHERE p.owner_salesperson_id = ?
      ORDER BY p.created_at DESC
    `).all(user.id);
  } else {
    projects = db.prepare(`
      SELECT p.*
      FROM projects p
      JOIN salesperson_designers sd ON sd.salesperson_id = p.owner_salesperson_id
      WHERE sd.designer_id = ?
      ORDER BY p.created_at DESC
    `).all(user.id);
  }

  res.render("projects", { projects, STATUS });
});

// Nowy projekt – tylko handlowiec
router.get("/new", requireSales, (req, res) => {
  const db = getDb();
  const user = req.session.user;

  const projectNo = computeNextProjectNo(db, user.salesNumber);

  res.render("new-project", {
    PRODUCTS,
    STATUS,
    projectNo
  });
});

router.post("/new", requireSales, (req, res) => {
  const db = getDb();
  const user = req.session.user;

  // ProjectNo liczymy na serwerze (nie ufamy polu z formularza)
  const projectNo = computeNextProjectNo(db, user.salesNumber);

  const clientName = (req.body.clientName || "").trim();
  const branchCity = (req.body.branchCity || "").trim();
  const voivodeship = (req.body.voivodeship || "").trim();
  const endCustomer = (req.body.endCustomer || "").trim();

  const product = (req.body.product || "").trim();
  const details = (req.body.details || "").trim();

  const calculatorPerson = (req.body.calculatorPerson || "").trim();
  const turnoverRaw = (req.body.turnover || "").trim().replace(",", ".");
  const offerMonth = (req.body.offerMonth || "").trim();
  const status = parseInt(req.body.status, 10);

  if (!clientName || !branchCity || !voivodeship || !endCustomer || !product || !details || !turnoverRaw || !offerMonth || !status) {
    req.session.err = "Uzupełnij wszystkie wymagane pola projektu.";
    return res.redirect("/projects/new");
  }

  if (!PRODUCTS.includes(product)) {
    req.session.err = "Nieprawidłowy produkt.";
    return res.redirect("/projects/new");
  }

  const allowedStatus = new Set(STATUS.map(s => s.id));
  if (!allowedStatus.has(status)) {
    req.session.err = "Nieprawidłowy status.";
    return res.redirect("/projects/new");
  }

  const turnover = Number(turnoverRaw);
  if (!Number.isFinite(turnover) || turnover < 0) {
    req.session.err = "Obrót musi być liczbą (>= 0).";
    return res.redirect("/projects/new");
  }

  try {
    db.prepare(`
      INSERT INTO projects(
        owner_salesperson_id, project_no,
        client_name, branch_city, voivodeship, end_customer,
        product, details,
        calculator_person, turnover, offer_month, status
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      user.id,
      projectNo,
      clientName,
      branchCity,
      voivodeship,
      endCustomer,
      product,
      details,
      calculatorPerson || null,
      turnover,
      offerMonth,
      status
    );
  } catch (e) {
    // np. konflikt unikalnego project_no (mało prawdopodobne w 1 instancji, ale możliwe)
    req.session.err = `Nie udało się zapisać projektu: ${e.message}`;
    return res.redirect("/projects/new");
  }

  req.session.msg = `Zapisano ofertę: ${projectNo}`;
  return res.redirect("/projects");
});

module.exports = router;
