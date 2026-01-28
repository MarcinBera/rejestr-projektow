const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../db/db");

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/projects");
  res.render("login");
});

router.post("/login", (req, res) => {
  const db = getDb();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  const user = db
    .prepare("SELECT id, first_name, last_name, email, role, sales_number, password_hash FROM users WHERE email = ?")
    .get(email);

  if (!user) {
    req.session.err = "Nieprawidłowy e-mail lub hasło.";
    return res.redirect("/login");
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    req.session.err = "Nieprawidłowy e-mail lub hasło.";
    return res.redirect("/login");
  }

  req.session.user = {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role: user.role,
    salesNumber: user.sales_number || null
  };

  req.session.msg = "Zalogowano.";
  return res.redirect("/projects");
});

router.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/projects");
  res.render("register");
});

router.post("/register", (req, res) => {
  const db = getDb();

  const firstName = (req.body.firstName || "").trim();
  const lastName = (req.body.lastName || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const role = req.body.role; // sales / designer
  const salesNumber = (req.body.salesNumber || "").trim();
  const password = req.body.password || "";

  if (!firstName || !lastName || !email || !role || !password) {
    req.session.err = "Uzupełnij wszystkie wymagane pola.";
    return res.redirect("/register");
  }

  if (!["sales", "designer"].includes(role)) {
    req.session.err = "Nieprawidłowa rola.";
    return res.redirect("/register");
  }

  if (role === "sales" && !salesNumber) {
    req.session.err = "Handlowiec musi podać numer handlowca.";
    return res.redirect("/register");
  }

  if (password.length < 6) {
    req.session.err = "Hasło musi mieć minimum 6 znaków.";
    return res.redirect("/register");
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    req.session.err = "Konto z takim e-mailem już istnieje.";
    return res.redirect("/register");
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users(first_name, last_name, email, role, sales_number, password_hash)
    VALUES(?,?,?,?,?,?)
  `).run(
    firstName,
    lastName,
    email,
    role,
    role === "sales" ? salesNumber : null,
    passwordHash
  );

  req.session.msg = "Konto utworzone. Zaloguj się.";
  return res.redirect("/login");
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
