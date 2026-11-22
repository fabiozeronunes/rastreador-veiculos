import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(here, '../../../data/rastreador.db');

let _db = null;

export function dbPath() {
  return process.env.DB_PATH || DEFAULT_PATH;
}

export function getDb() {
  if (_db) return _db;
  const p = dbPath();
  mkdirSync(dirname(p), { recursive: true });
  _db = new DatabaseSync(p);
  _db.exec('PRAGMA journal_mode = WAL;');
  _db.exec('PRAGMA foreign_keys = ON;');
  migrate(_db);
  return _db;
}

const SCHEMA = [
  // --- FIPE ---
  `CREATE TABLE IF NOT EXISTS fipe_brand (
     code TEXT PRIMARY KEY,
     name TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS fipe_model (
     brand_code TEXT NOT NULL,
     code TEXT NOT NULL,
     name TEXT NOT NULL,
     PRIMARY KEY (brand_code, code),
     FOREIGN KEY (brand_code) REFERENCES fipe_brand(code) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS fipe_year (
     brand_code TEXT NOT NULL,
     model_code TEXT NOT NULL,
     code TEXT NOT NULL,
     name TEXT NOT NULL,
     PRIMARY KEY (brand_code, model_code, code),
     FOREIGN KEY (brand_code, model_code) REFERENCES fipe_model(brand_code, code) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS fipe_price (
     brand_code TEXT NOT NULL,
     model_code TEXT NOT NULL,
     year_code TEXT NOT NULL,
     fipe_code TEXT NOT NULL,
     price REAL,
     ref_month TEXT,
     fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
     PRIMARY KEY (brand_code, model_code, year_code)
  )`,

  // --- Fontes de dados ---
  `CREATE TABLE IF NOT EXISTS source (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     kind TEXT NOT NULL,          -- 'auction' | 'classified' | 'repass'
     base_url TEXT NOT NULL,
     enabled INTEGER NOT NULL DEFAULT 1,
     strategy TEXT NOT NULL DEFAULT 'fetch',  -- fetch | playwright | scrapfly | scrapingbee
     meta_consecutive INTEGER NOT NULL DEFAULT 0,
     last_success_at TEXT,
     last_error TEXT,
     last_error_at TEXT
  )`,

  // --- Anúncios/leilões capturados ---
  `CREATE TABLE IF NOT EXISTS listing (
     id TEXT PRIMARY KEY,              -- hash(source + external_id)
     source_id TEXT NOT NULL,
     external_id TEXT NOT NULL,
     url TEXT NOT NULL,
     title TEXT,
     brand TEXT,
     model TEXT,
     version TEXT,
     year INTEGER,
     price REAL,                       -- lance/preço atual
     fipe_price REAL,
     discount_pct REAL,
     auction_ends_at TEXT,
     status TEXT NOT NULL DEFAULT 'active', -- active | ended | sold | removed
     first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
     last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
     notified INTEGER NOT NULL DEFAULT 0,
     raw TEXT,
     UNIQUE (source_id, external_id)
  )`,

  // --- Watchlist do usuário ---
  `CREATE TABLE IF NOT EXISTS watchlist (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     brand TEXT,
     model TEXT,
     year_min INTEGER,
     year_max INTEGER,
     discount_min REAL NOT NULL DEFAULT 30,
     max_price REAL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // --- Alertas enviados ---
  `CREATE TABLE IF NOT EXISTS alert (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     listing_id TEXT NOT NULL,
     channel TEXT NOT NULL,            -- telegram | push
     sent_at TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE (listing_id, channel),
     FOREIGN KEY (listing_id) REFERENCES listing(id) ON DELETE CASCADE
  )`,

  // --- Push subscriptions ---
  `CREATE TABLE IF NOT EXISTS push_subscription (
     endpoint TEXT PRIMARY KEY,
     keys TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

function migrate(db) {
  for (const sql of SCHEMA) db.exec(sql);
  // Migrações aditivas pós-criação (CREATE TABLE IF NOT EXISTS não altera
  // tabela já existente).
  const cols = db.prepare('PRAGMA table_info(source)').all();
  if (!cols.some((c) => c.name === 'meta_consecutive')) {
    db.exec(
      'ALTER TABLE source ADD COLUMN meta_consecutive INTEGER NOT NULL DEFAULT 0',
    );
  }
  const lcols = db.prepare('PRAGMA table_info(listing)').all();
  const addListingCol = (name, ddl) => {
    if (!lcols.some((c) => c.name === name)) {
      db.exec(`ALTER TABLE listing ADD COLUMN ${name} ${ddl}`);
    }
  };
  addListingCol('image', 'TEXT');        // URL da foto do anúncio
  addListingCol('phone', 'TEXT');        // WhatsApp/telefone (E.164 com 55)
  addListingCol('favorite', 'INTEGER NOT NULL DEFAULT 0');
}

export default getDb;
