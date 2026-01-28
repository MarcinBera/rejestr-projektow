const path = require("path");
const express = require("express");
const session = require("express-session");
const dotenv = require("dotenv");

dotenv.config();

const { initDb } = require("./src/db/db");
const authRoutes = require("./src/routes/auth");
const projectRoutes = require("./src/routes/projects");
const assignmentRoutes = require("./src/routes/assignments");

const app = express();

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret";
const DB_FILE = process.env.DB_FILE || "./data/app.db";

// init db (creates file + tables if not exist)
initDb(DB_FILE);

// views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));

// middleware
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

// user + komunikaty (prosty flash)
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.msg = req.session.msg || null;
  res.locals.err = req.session.err || null;
  delete req.session.msg;
  delete req.session.err;
  next();
});

app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/projects");
  return res.redirect("/login");
});

app.use("/", authRoutes);
app.use("/projects", projectRoutes);
app.use("/assignments", assignmentRoutes);

app.use((req, res) => res.status(404).send("404 Not Found"));

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Rejestr projektów działa na http://localhost:${PORT}`);
  });
}

module.exports = app;
