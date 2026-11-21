// Sincroniza a base FIPE pro SQLite.
//
// Uso:
//   node packages/fipe/src/sync.js                 # marcas + modelos (rápido, ~200 req)
//   node packages/fipe/src/sync.js --brand 59      # + anos da marca
//   node packages/fipe/src/sync.js --brand 59 --model 1714   # + preços daquele modelo
//
// Preços da tabela inteira são ~50k requisições — não faz isso. Preço é
// buscado sob demanda pelo matcher e cacheado (ver lookupPrice).

import { getDb } from '@rv/db';
import { fipe } from './client.js';

const db = getDb();
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// API FIPE devolve código às vezes como number, às vez como string.
// Bind de number vira REAL no SQLite e REAL->TEXT rende "10216.0".
// Sempre converter antes.
const code = (v) => String(v);

async function syncBrands() {
  const rows = await fipe.brands();
  const stmt = db.prepare(
    'INSERT INTO fipe_brand (code, name) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name',
  );
  db.exec('BEGIN');
  for (const b of rows) stmt.run(code(b.codigo), b.nome);
  db.exec('COMMIT');
  console.log(`✓ ${rows.length} marcas`);
  return rows;
}

async function syncModels(brandCode) {
  const { modelos } = await fipe.models(brandCode);
  const stmt = db.prepare(
    'INSERT INTO fipe_model (brand_code, code, name) VALUES (?, ?, ?) ON CONFLICT(brand_code, code) DO UPDATE SET name = excluded.name',
  );
  db.exec('BEGIN');
  for (const m of modelos) stmt.run(brandCode, code(m.codigo), m.nome);
  db.exec('COMMIT');
  console.log(`✓ ${modelos.length} modelos (marca ${brandCode})`);
  return modelos;
}

async function syncYears(brandCode, modelCode) {
  const rows = await fipe.years(brandCode, modelCode);
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO fipe_year (brand_code, model_code, code, name) VALUES (?, ?, ?, ?)',
  );
  db.exec('BEGIN');
  for (const y of rows) stmt.run(brandCode, modelCode, code(y.codigo), y.nome);
  db.exec('COMMIT');
  console.log(`✓ ${rows.length} anos (${brandCode}/${modelCode})`);
  return rows;
}

async function syncPrices(brandCode, modelCode) {
  const years = await fipe.years(brandCode, modelCode);
  const stmt = db.prepare(
    `INSERT INTO fipe_price (brand_code, model_code, year_code, fipe_code, price, ref_month, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(brand_code, model_code, year_code) DO UPDATE SET
       price = excluded.price, ref_month = excluded.ref_month, fetched_at = excluded.fetched_at`,
  );
  db.exec('BEGIN');
  let ok = 0;
  for (const y of years) {
    try {
      const p = await fipe.price(brandCode, modelCode, y.codigo);
      stmt.run(
        brandCode,
        modelCode,
        code(y.codigo),
        p.CodigoFipe,
        Number(String(p.Valor).replace(/[^\d,]/g, '').replace(',', '.')) || null,
        p.MesReferencia,
      );
      ok++;
      await sleep(120);
    } catch (err) {
      console.warn(`  ! erro preço ${y.codigo}: ${err.message}`);
    }
  }
  db.exec('COMMIT');
  console.log(`✓ ${ok}/${years.length} preços (${brandCode}/${modelCode})`);
}

async function main() {
  const brand = flag('brand');
  const model = flag('model');

  await syncBrands();

  if (!brand) {
    console.log('Dica: use --brand <codigo> pra baixar modelos/anos/preços.');
    return;
  }
  await syncModels(brand);

  if (!model) {
    const models = db
      .prepare('SELECT code FROM fipe_model WHERE brand_code = ?')
      .all(brand);
    for (const m of models) await syncYears(brand, m.code);
    return;
  }

  await syncYears(brand, model);
  await syncPrices(brand, model);
}

main()
  .then(() => {
    console.log('Sync FIPE concluída.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Falha na sync FIPE:', err.message);
    process.exit(1);
  });
