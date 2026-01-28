const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

let db;

function initDb(dbFile) {
  // testy: :memory:
  if (dbFile !== ":memory:") {
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbFile);
  db.pragma("foreign_keys = ON");

  const initSqlPath = path.join(__dirname, "init.sql");
  const initSql = fs.readFileSync(initSqlPath, "utf8");
  db.exec(initSql);

  return db;
}

function getDb() {
  if (!db) throw new Error("DB not initialized. Call initDb() first.");
  return db;
}

module.exports = { initDb, getDb };
