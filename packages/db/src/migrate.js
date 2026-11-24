import { getDb, dbPath } from './index.js';

const db = getDb();
console.log('Migração OK ->', dbPath());

// Cria tabelas se não existirem
db.exec(`
CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  country TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT (datetime('now'))
)`);

db.exec(`
CREATE TABLE IF NOT EXISTS models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(brand_id, name)
)`);

// Inserir marcas conhecidas inicialmente (com INSERT OR IGNORE pra ser idempotente)
const knownBrands = [
  'Honda', 'Fiat', 'Chevrolet', 'Volkswagen', 'Toyota', 'Ford',
  'Renault', 'Peugeot', 'Citroen', 'Kia', 'Hyundai', 'Volvo',
  'Audi', 'BMW', 'Mercedes', 'JAC', 'Chery', 'Caoa', 'Nissan', 'Mitsubishi'
];
const stmtBrand = db.prepare('INSERT OR IGNORE INTO brands (name, country) VALUES (?, ?)');
for (const b of knownBrands) {
  stmtBrand.run(b, 'Brasil');
}

// Inserir modelos populares por marca
const knownModels = {
  'Honda': ['HR-V', 'Civic', 'Fit', 'City'],
  'Fiat': ['Argo', 'Cronos', 'Mobi', 'Strada'],
  'Chevrolet': ['Onix', 'Onix Plus', 'Prisma'],
  'Volkswagen': ['Gol', 'Fox', 'Polo'],
  'Toyota': ['Corolla', 'Etios', 'Yaris'],
  'Ford': ['Ka', 'Ka Sport', 'New Ka'],
  'Renault': ['Kwid', 'Duster', 'Sandero'],
  'Peugeot': ['208', '2008', 'Partner'],
  'Kia': ['Picanto', 'Cerato', 'Sportage'],
  'Hyundai': ['HB20', 'Creta', 'Tucson'],
  'Volkswagen': ['T-Cross', 'Nivus'],
};
for (const [brandName, modelNames] of Object.entries(knownModels)) {
  const brandRow = db.prepare('SELECT id FROM brands WHERE name = ?').get(brandName);
  if (brandRow) {
    const stmtModel = db.prepare('INSERT OR IGNORE INTO models (brand_id, name) VALUES (?, ?)');
    for (const mn of modelNames) {
      stmtModel.run(brandRow.id, mn);
    }
  }
}

// Contagem final
const brandCount = db.prepare('SELECT count(*) c FROM brands').get().c;
const modelCount = db.prepare('SELECT count(*) c FROM models').get().c;
console.log(`Migração concluída - ${brandCount} marcas, ${modelCount} modelos cadastrados`);