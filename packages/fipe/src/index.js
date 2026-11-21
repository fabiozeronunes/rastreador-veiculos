// Lookup de FIPE sob demanda: resolve marca/modelo/ano -> valor, cacheando
// tudo no SQLite. Runtime nunca bate na API se já tiver em cache.

import { getDb } from '@rv/db';
import { fipe } from './client.js';

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toUpperCase();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Similaridade simples: 1 = igual, 0 = nada. Usada porque a normalização
// vira "HR V" e o SQL não normaliza — comparar em JS é mais robusto.
function score(a, b) {
  if (a === b) return 1;
  if (a.startsWith(b)) return 0.9;
  if (a.includes(b)) return 0.75;
  const aw = new Set(a.split(' '));
  const bw = b.split(' ').filter((w) => aw.has(w));
  if (!bw.length) return 0;
  return 0.5 * (bw.length / b.split(' ').length);
}

function bestMatch(items, name, getName) {
  const n = norm(name);
  if (!n) return null;
  let top = null;
  let topScore = 0;
  for (const it of items) {
    const s = score(norm(getName(it)), n);
    if (s > topScore) {
      topScore = s;
      top = it;
    }
  }
  return topScore >= 0.5 ? top : null;
}

export function findBrand(name) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM fipe_brand').all();
  return bestMatch(rows, name, (r) => r.name);
}

export function findModel(brandCode, name) {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM fipe_model WHERE brand_code = ?')
    .all(brandCode);
  return bestMatch(rows, name, (r) => r.name);
}

/**
 * Escolhe o código FIPE de ano a partir de um ano civil (ex: 2019).
 * Formato do código: "YYYY-N" (ex "2019-1", "2019-5") e "32000-N" = 0km.
 */
export function pickYearCode(brandCode, modelCode, year) {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT code, name FROM fipe_year WHERE brand_code = ? AND model_code = ?',
    )
    .all(brandCode, modelCode);
  if (!rows.length) return null;

  const y = Number(year);
  const yearOf = (code) => {
    const m = /^(\d{4})-/.exec(code);
    if (!m) return NaN;
    const n = Number(m[1]);
    return n === 32000 || n === 30000 ? NaN : n; // 32000 = 0km, não é ano
  };

  // Preferir código usado (não 0km). "usado" costuma ser 30xxx-N ou ano direto.
  const used = rows.filter((r) => !/^(32000|30000)-/.test(r.code));
  const pool = used.length ? used : rows;

  const exact = pool.find((r) => yearOf(r.code) === y);
  if (exact) return exact.code;

  // fallback: maior ano <= y. Se nenhum, a versão não existia nesse ano
  // (FIPE agrupa por versão) — devolver null pra caller tentar outra versão.
  const lower = pool
    .filter((r) => yearOf(r.code) <= y)
    .sort((a, b) => yearOf(b.code) - yearOf(a.code));
  return lower[0]?.code ?? null;
}

async function ensurePrice(brandCode, modelCode, yearCode) {
  const db = getDb();
  const cached = db
    .prepare(
      `SELECT price, fetched_at FROM fipe_price
       WHERE brand_code = ? AND model_code = ? AND year_code = ?`,
    )
    .get(brandCode, modelCode, yearCode);

  const fresh =
    cached &&
    Date.now() - Date.parse(cached.fetched_at.replace(' ', 'T') + 'Z') <
      30 * 864e5;
  if (fresh) return cached.price;

  try {
    const p = await fipe.price(brandCode, modelCode, yearCode);
    const price =
      Number(String(p.Valor).replace(/[^\d,]/g, '').replace(',', '.')) || null;
    db.prepare(
      `INSERT INTO fipe_price (brand_code, model_code, year_code, fipe_code, price, ref_month, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(brand_code, model_code, year_code) DO UPDATE SET
         price = excluded.price, ref_month = excluded.ref_month, fetched_at = excluded.fetched_at`,
    ).run(brandCode, modelCode, yearCode, p.CodigoFipe, price, p.MesReferencia);
    await sleep(150);
    return price;
  } catch (err) {
    if (cached) return cached.price; // degrada pro cache velho
    throw err;
  }
}

/**
 * Resolve valor FIPE de um veículo.
 * A FIPE agrupa por VERSÃO (ex "HR-V Advance" só existe 2023+), então
 * tentamos as versões parecidas em ordem de score até achar uma que tenha
 * o ano pedido.
 * @returns {Promise<{fipeCode, price, brand, model, year, refMonth}|null>}
 */
export async function lookupPrice({ brand, model, year }) {
  const b = findBrand(brand);
  if (!b) return null;

  const db = getDb();
  const candidates = db
    .prepare(
      `SELECT m.*,
 (SELECT COUNT(*) FROM fipe_year y
         WHERE y.brand_code = m.brand_code AND y.model_code = m.code) AS n_years
       FROM fipe_model m WHERE m.brand_code = ?`,
    )
    .all(b.code);
  const ranked = candidates
    .map((m) => ({ m, s: score(norm(m.name), norm(model)) }))
    .filter((x) => x.s >= 0.5)
    // score, depois mais anos de cobertura (versão principal), depois nome
    // mais curto — evita "Civic" casar com "Civic Coupe EX 1.6 2p".
    .sort(
      (a, c) =>
        c.s - a.s ||
        (c.m.n_years ?? 0) - (a.m.n_years ?? 0) ||
        a.m.name.length - c.m.name.length,
    )
    .slice(0, 8);

  for (const { m } of ranked) {
    const yc = pickYearCode(b.code, m.code, year);
    if (!yc) continue;
    const hasYear = db
      .prepare(
        'SELECT 1 FROM fipe_year WHERE brand_code = ? AND model_code = ? AND code = ?',
      )
      .get(b.code, m.code, yc);
    if (!hasYear) continue;

    try {
      const price = await ensurePrice(b.code, m.code, yc);
      if (price == null) continue;
      const ref = db
        .prepare(
          'SELECT fipe_code, ref_month FROM fipe_price WHERE brand_code = ? AND model_code = ? AND year_code = ?',
        )
        .get(b.code, m.code, yc);
      return {
        fipeCode: ref?.fipe_code,
        price,
        refMonth: ref?.ref_month,
        brand: b.name,
        model: m.name,
        year,
      };
    } catch (err) {
      continue;
    }
  }
  return null;
}

export default { lookupPrice, findBrand, findModel, pickYearCode };
