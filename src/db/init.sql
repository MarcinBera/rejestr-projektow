PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL CHECK(role IN ('sales', 'designer')),
  sales_number TEXT, -- tylko dla handlowca
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- relacja wiele-do-wielu: handlowiec <-> projektant
CREATE TABLE IF NOT EXISTS salesperson_designers (
  salesperson_id INTEGER NOT NULL,
  designer_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (salesperson_id, designer_id),
  FOREIGN KEY (salesperson_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (designer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- projekty należą do handlowca (owner_salesperson_id)
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_salesperson_id INTEGER NOT NULL,
  project_no TEXT NOT NULL UNIQUE,

  client_name TEXT NOT NULL,
  branch_city TEXT NOT NULL,
  voivodeship TEXT NOT NULL,
  end_customer TEXT NOT NULL,

  product TEXT NOT NULL,
  details TEXT NOT NULL,

  calculator_person TEXT, -- opcjonalnie
  turnover REAL NOT NULL,
  offer_month TEXT NOT NULL,
  status INTEGER NOT NULL CHECK(status IN (1,2,3,4,5,6,7,8)),

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (owner_salesperson_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_salesperson_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
