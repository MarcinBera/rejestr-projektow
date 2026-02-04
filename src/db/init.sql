PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL CHECK(role IN ('sales', 'designer')),
  sales_number TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS salesperson_designers (
  salesperson_id INTEGER NOT NULL,
  designer_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (salesperson_id, designer_id),
  FOREIGN KEY (salesperson_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (designer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- KALKULACJE: właścicielem jest handlowiec
CREATE TABLE IF NOT EXISTS calculations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  created_by_user_id INTEGER NOT NULL,     -- kto utworzył kalkulację (handlowiec lub projektant)
  calculation_date TEXT NOT NULL,          -- YYYY-MM-DD

  nip TEXT NOT NULL,                       -- z ręki
  company_name TEXT,                       -- po NIP z MF
  company_address TEXT,                    -- po NIP z MF (opcjonalnie)

  contact_person TEXT NOT NULL,            -- z ręki
  contact_email TEXT NOT NULL,             -- z ręki

  branch_city TEXT NOT NULL,               -- z ręki
  voivodeship TEXT NOT NULL,               -- z ręki
  end_customer TEXT NOT NULL,              -- z ręki

  is_new_customer INTEGER NOT NULL CHECK(is_new_customer IN (0,1)), -- TAK/NIE

  product_type TEXT NOT NULL,              -- lista
  product_details TEXT NOT NULL,           -- z ręki


  status INTEGER NOT NULL CHECK(status IN (1,2,3,4,5,6,7,8)),

  turnover REAL,
  offer_type TEXT CHECK(offer_type IN ('Podstawowa','Uproszczona')),

  pl_items_json TEXT NOT NULL DEFAULT '[]',
  foreign_items_json TEXT NOT NULL DEFAULT '[]',
  quick_offer_json TEXT NOT NULL DEFAULT '[]',

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calc_created_by ON calculations(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_calc_nip ON calculations(nip);

