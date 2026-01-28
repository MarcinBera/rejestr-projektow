const express = require("express");
const { getDb } = require("../db/db");
const { requireSales } = require("../middleware/auth");

const router = express.Router();

// ekran: lista przypisanych projektantów + lista dostępnych projektantów
router.get("/", requireSales, (req, res) => {
  const db = getDb();
  const user = req.session.user;

  const assigned = db.prepare(`
    SELECT u.id, u.first_name, u.last_name, u.email
    FROM users u
    JOIN salesperson_designers sd ON sd.designer_id = u.id
    WHERE sd.salesperson_id = ?
    ORDER BY u.last_name, u.first_name
  `).all(user.id);

  const available = db.prepare(`
    SELECT u.id, u.first_name, u.last_name, u.email
    FROM users u
    WHERE u.role = 'designer'
      AND u.id NOT IN (
        SELECT designer_id FROM salesperson_designers WHERE salesperson_id = ?
      )
    ORDER BY u.last_name, u.first_name
  `).all(user.id);

  res.render("assign-designers", { assigned, available });
});

router.post("/add", requireSales, (req, res) => {
  const db = getDb();
  const user = req.session.user;

  const designerId = parseInt(req.body.designerId, 10);
  if (!designerId) {
    req.session.err = "Wybierz projektanta.";
    return res.redirect("/assignments");
  }

  const designer = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'designer'").get(designerId);
  if (!designer) {
    req.session.err = "Nieprawidłowy projektant.";
    return res.redirect("/assignments");
  }

  db.prepare(`
    INSERT OR IGNORE INTO salesperson_designers(salesperson_id, designer_id)
    VALUES(?,?)
  `).run(user.id, designerId);

  req.session.msg = "Projektant przypisany.";
  return res.redirect("/assignments");
});

router.post("/remove", requireSales, (req, res) => {
  const db = getDb();
  const user = req.session.user;

  const designerId = parseInt(req.body.designerId, 10);
  if (!designerId) return res.redirect("/assignments");

  db.prepare(`
    DELETE FROM salesperson_designers
    WHERE salesperson_id = ? AND designer_id = ?
  `).run(user.id, designerId);

  req.session.msg = "Projektant odpięty.";
  return res.redirect("/assignments");
});

module.exports = router;
