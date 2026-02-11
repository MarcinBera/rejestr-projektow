const path = require("path");
const express = require("express");
const session = require("express-session");
const dotenv = require("dotenv");

dotenv.config();

const { initDb } = require("./src/db/db");

const authRoutes = require("./src/routes/auth");
const calculationRoutes = require("./src/routes/calculations");
const assignmentRoutes = require("./src/routes/assignments");
const apiRoutes = require("./src/routes/api");

const app = express();

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret";
const DB_FILE = process.env.DB_FILE || "./data/app.db";

initDb(DB_FILE);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "src", "public")));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true }
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.msg = req.session.msg || null;
  res.locals.err = req.session.err || null;
  delete req.session.msg;
  delete req.session.err;
  next();
});

app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/calculations");
  return res.redirect("/login");
});

app.use("/", authRoutes);
app.use("/calculations", calculationRoutes);

app.post("/calculations/:id/save", (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, turnover, offerType, plItems, foreignItems, quickOffer, summary } = req.body || {};

    const stmt = db.prepare(`
      UPDATE calculations
      SET
        status = ?,
        turnover = ?,
        offer_type = ?,
        pl_items_json = ?,
        foreign_items_json = ?,
        quick_offer_json = ?,
        summary_json = ?
      WHERE id = ?
    `);

    stmt.run(
      status ?? null,
      turnover ?? null,
      offerType ?? null,
      JSON.stringify(plItems ?? []),
      JSON.stringify(foreignItems ?? []),
      JSON.stringify(quickOffer ?? []),
      JSON.stringify(summary ?? {}),
      id
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error("SAVE error:", e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});
app.get("/calculations/:id/pdf", (req, res) => {
  try {
    const id = Number(req.params.id);

    const row = db.prepare("SELECT * FROM calculations WHERE id = ?").get(id);
    if (!row) return res.status(404).send("Not found");

    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ margin: 30, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="kalkulacja-${id}.pdf"`);

    doc.pipe(res);

    // MINIMALNY PDF (żeby sprawdzić, że działa)
    doc.fontSize(16).text(`Kalkulacja #${id}`);
    doc.moveDown();
    doc.fontSize(10).text(`NIP: ${row.nip || ""}`);
    doc.text(`Klient: ${row.company_name || ""}`);
    doc.text(`Adres: ${row.company_address || ""}`);
    doc.moveDown();

    const quick = JSON.parse(row.quick_offer_json || "[]");
    doc.fontSize(12).text("Szybka oferta:");
    doc.moveDown(0.5);
    doc.fontSize(9);
    quick.forEach((it, idx) => {
      doc.text(`${idx + 1}. ${it.element || ""} | ${it.producer || ""} | S:${it.s || ""} L:${it.l || ""} W:${it.w || ""} G:${it.g || ""}`);
    });

    doc.end();
  } catch (e) {
    console.error("PDF error:", e);
    res.status(500).send(String(e.message || e));
  }
});

// app.get("/calculations/:id/pdf", (req, res) => {
//   try {
//     const id = Number(req.params.id);

//     const row = db.prepare("SELECT * FROM calculations WHERE id = ?").get(id);
//     if (!row) return res.status(404).send("Not found");

//     // Minimalny PDF żeby sprawdzić czy działa
//     const PDFDocument = require("pdfkit");
//     const doc = new PDFDocument({ margin: 30 });

//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader("Content-Disposition", `inline; filename="kalkulacja-${id}.pdf"`);

//     doc.pipe(res);

//     doc.fontSize(16).text(`Kalkulacja #${id}`);
//     doc.moveDown();
//     doc.fontSize(10).text(`NIP: ${row.nip || ""}`);
//     doc.text(`Klient: ${row.company_name || ""}`);
//     doc.text(`Adres: ${row.company_address || ""}`);
//     doc.moveDown();

//     doc.fontSize(12).text("Szybka oferta:");
//     const quick = JSON.parse(row.quick_offer_json || "[]");
//     quick.forEach((it, idx) => {
//       doc.fontSize(9).text(`${idx + 1}. ${it.element || ""} | ${it.producer || ""} | qty: ${it.qtyNeed || ""}`);
//     });

//     doc.end();
//   } catch (e) {
//     console.error("PDF error:", e);
//     return res.status(500).send(String(e.message || e));
//   }
// });

app.use("/assignments", assignmentRoutes);
app.use("/api", apiRoutes);

app.use((req, res) => res.status(404).send("404 Not Found"));

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`Działa na http://localhost:${PORT}`));
}

module.exports = app;
