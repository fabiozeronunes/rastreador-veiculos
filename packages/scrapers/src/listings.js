import { createHash } from 'node:crypto';
import { getDb } from '@rv/db';

const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 20);

/** DB lookup assíncrono de marca - pode ser chamado separadamente */
export async function lookupBrandFromDb(html) {
  const title = extractTitle(html);
  if (!title) return null;
  const db = getDb();
  const brandRow = db.prepare('SELECT id, name FROM brands WHERE is_active = 1 AND name = ?').get(title.split(' ')[0]);
  if (brandRow) return brandRow.name;
  // Fallback: tenta conhecidas pelo título
  const known = ['Honda', 'Fiat', 'Chevrolet', 'Volkswagen', 'Toyota', 'Ford', 'Renault', 'Peugeot', 'Citroen', 'Kia', 'Hyundai', 'Volvo', 'Audi', 'BMW', 'Mercedes', 'JAC', 'Chery', 'Caoa', 'Nissan', 'Mitsubishi'];
  for (const b of known) {
    if (title.startsWith(b + ' ') || title === b) return b;
  }
  const firstWord = title.split(' ')[0];
  if (firstWord.length >= 2) return firstWord;
  return null;
}

/** DB lookup assíncrono de modelo - pode ser chamado separadamente */
export async function lookupModelFromDb(html) {
  const title = extractTitle(html);
  if (!title) return null;
  const brandName = title.split(' ')[0];
  const db = getDb();
  // Pega o brand_id pelo nome e busca modelos associados
  const brandRow = db.prepare('SELECT id FROM brands WHERE name = ?').get(brandName);
  if (!brandRow) return null;
  const modelRow = db.prepare('SELECT name FROM models WHERE brand_id = ? AND is_active = 1').all(brandRow.id).map(r => r.name);
  if (modelRow.length > 0) return modelRow[0];
  // Fallback simples: pega a parte após a marca no título
  const remaining = title.replace(brandName + ' ', '');
  const knownModels = ['HR-V', 'Corolla', 'Onix', 'Civic', 'Ka', 'Sandero', 'Argo', 'Strada', 'Saveiro', 'Uno', 'Celta', 'Palio', 'Conex', 'Avante', 'Cerato', 'Optima', 'K5', 'Kona', 'Tucson', 'Sportage', 'Creta', 'Ranger', 'Hilux', 'Strada'];
  for (const mod of knownModels) {
    if (remaining.includes(mod)) return mod;
  }
  // Fallback: última palavra antes do ano
  const parts = remaining.split(' ');
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (last && !/^\d{4}$/.test(last)) return parts[parts.length - 1];
    return parts[parts.length - 2];
  }
  return null;
}

/** Extrai URL de imagem do HTML do anúncio (og:image > twitter:image > 1ª img). */
export function extractImage(html) {
  if (!html) return null;
  const patterns = [
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
    /<img[^>]+src=["'](https?:\/\/[^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1] && !m[1].includes('logo') && !m[1].includes('icon')) return m[1];
  }
  return null;
}

/** Extrai telefone/WhatsApp do HTML (wa.me > tel: > padrão BR). */
export function extractPhone(html) {
  if (!html) return null;
  // wa.me/5511999998888 ou api.whatsapp.com/send?phone=5511999998888
  let m = html.match(/wa\.me\/(?:55)?(\d{10,13})/i);
  if (m) return normalizePhone(m[1]);
  m = html.match(/whatsapp\.com\/send\?phone=(?:55)?(\d{10,13})/i);
  if (m) return normalizePhone(m[1]);
  // tel:+5511999998888
  m = html.match(/tel:\+?(?:55)?(\d{10,13})/i);
  if (m) return normalizePhone(m[1]);
  // padrão brasileiro (11) 99999-8888 / 11 99999-8888
  m = html.match(/\(?\b(\d{2})\)?\s?(\d{4,5})-(\d{4})\b/);
  if (m) return normalizePhone(`55${m[1]}${m[2]}${m[3]}`);
  return null;
}

function normalizePhone(digits) {
  let d = String(digits).replace(/\D/g, '');
  if (d.length > 13) return null;
  if (d.length === 10 || d.length === 11) d = '55' + d; // fixo/móvel BR
  if (d.length < 12 || d.length > 13) return null;
  return d;
}

/** Extrai placa brasileira (antiga ABC1234 ou Mercosul ABC1D23). */
export function extractPlate(html) {
  if (!html) return null;
  const m = html.match(/\b([A-Za-z]{3})[- ]?(\d{4}|[0-9][A-Za-z][0-9]{2})\b/);
  if (!m) return null;
  const plate = (m[1] + m[2]).toUpperCase();
  // valida formato
  if (/^[A-Z]{3}\d{4}$/.test(plate) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(plate)) return plate;
  return null;
}

/** Extrai título do anúncio (h1, h2, .title, .anuncio). */
export function extractTitle(html) {
  if (!html) return null;
  const m = html.match(/<h[12][^>]*>([^<]+)<\/h[12]>|<title>([^<]+)<\/title>|class=["']title["'][^>]*>([^<]+)/i);
  if (m) return m[1] || m[2] || m[3] ? (m[1] || m[2] || m[3]).trim() : null;
  return null;
}

/** Extrai marca do anúncio usando heurística (síncrona - usada pelo worker). */
export function extractBrand(html) {
  const title = extractTitle(html);
  if (!title) return null;
  const knownBrands = ['Honda', 'Fiat', 'Chevrolet', 'Volkswagen', 'Toyota', 'Ford', 'Renault', 'Peugeot', 'Citroen', 'Kia', 'Hyundai', 'Volvo', 'Audi', 'BMW', 'Mercedes', 'JAC', 'Chery', 'Caoa', 'Nissan', 'Mitsubishi'];
  for (const b of knownBrands) {
    if (title.startsWith(b + ' ') || title === b) return b;
  }
  const firstWord = title.split(' ')[0];
  if (firstWord.length >= 2) return firstWord;
  return null;
}

/** Extrai modelo do anúncio usando heurística (síncrona - usada pelo worker). */
export function extractModel(html) {
  const title = extractTitle(html);
  if (!title) return null;
  const knownBrands = ['Honda', 'Fiat', 'Chevrolet', 'Volkswagen', 'Toyota', 'Ford', 'Renault', 'Peugeot', 'Citroen', 'Kia', 'Hyundai', 'Volvo', 'Audi', 'BMW', 'Mercedes', 'JAC', 'Chery', 'Caoa', 'Nissan', 'Mitsubishi'];
  let remaining = title;
  for (const b of knownBrands) {
    if (title.startsWith(b + ' ')) {
      remaining = title.substring(b.length + 1);
      break;
    }
  }
  const knownModels = ['HR-V', 'Corolla', 'Onix', 'Civic', 'Ka', 'Sandero', 'Argo', 'Strada', 'Saveiro', 'Uno', 'Celta', 'Palio', 'Conex', 'Avante', 'Cerato', 'Optima', 'K5', 'Kona', 'Tucson', 'Sportage', 'Creta', 'Ranger', 'Hilux', 'Strada'];
  for (const mod of knownModels) {
    if (remaining.includes(mod)) return mod;
  }
  // Fallback: última palavra antes do ano
  const parts = remaining.split(' ');
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (last && !/^\d{4}$/.test(last)) return parts[parts.length - 1];
    return parts[parts.length - 2];
  }
  return null;
}

/** Extrai ano do anúncio. */
export function extractYear(html) {
  if (!html) return null;
  const m = html.match(/\b(19|20)\d{2}\b/);
  if (m) return parseInt(m[0], 10);
  return null;
}

/** Extrai preço do anúncio (R$ 89.990 ou R$89990). */
export function extractPrice(html) {
  if (!html) return null;
  const m = html.match(/R\$\s*[\d.,]+/i);
  if (m) {
    const num = m[0].replace('R$', '').trim().replace('.', '').replace(',', '.');
    return parseFloat(num);
  }
  // Também tenta em spans/classes de preço
  const m2 = html.match(/class=["']price["'][^>]*>(R\$?\s*[\d.,]+)/i);
  if (m2) {
    const num = m2[1].replace('R$', '').trim().replace('.', '').replace(',', '.');
    return parseFloat(num);
  }
  return null;
}

/**
 * Upsert de um anúncio. Retorna { listing, isNew, priceChanged }.
 * Dedup por (source_id, external_id).
 * 
 * Nota: brand e model vêm como parâmetro input. Se não vierem, são extraídos
 * sinteticamente do título usando listas conhecidas + lookup opcional DB via lookupBrandFromDb/lookupModelFromDb (async).
 */
export async function upsertListing(input) {
  const db = getDb();
  const id = hash(`${input.source_id}:${input.external_id}`);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const existing = db.prepare('SELECT * FROM listing WHERE id = ?').get(id);

  // Extrai imagem, telefone e placa do HTML bruto (se disponíveis)
  const html = typeof input.raw === 'string' ? input.raw : (input.raw?.html || '');
  const image = input.image ?? extractImage(html);
  const phone = input.phone ?? extractPhone(html);
  const plate = input.plate ?? extractPlate(html);

  // Marca e modelo: usa o do input, ou extrai sinteticamente do título (sync fallback)
  // Para enriquecimento com DB, recomenda-se chamar lookupBrandFromDb/lookupModelFromDb
  // antes de primeira inserção ou deixar para o próximo ciclo.
  let brand = input.brand ?? extractBrand(html);
  let model = input.model ?? extractModel(html);

  if (!existing) {
    db.prepare(
      `INSERT INTO listing
         (id, source_id, external_id, url, title, brand, model, version, year,
          price, auction_ends_at, status, first_seen_at, last_seen_at, raw, image, phone, plate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.source_id,
      String(input.external_id),
      input.url,
      input.title ?? null,
      brand ?? null,
      model ?? null,
      input.version ?? null,
      input.year ?? null,
      input.price ?? null,
      input.auction_ends_at ?? null,
      now,
      now,
      input.raw ? JSON.stringify(input.raw).slice(0, 4000) : null,
      image,
      phone,
      plate,
    );
    return { listing: getById(id), isNew: true, priceChanged: false };
  }

  const priceChanged =
    input.price != null && existing.price !== input.price;

  db.prepare(
    `UPDATE listing SET
       url = ?, title = COALESCE(?, title), brand = COALESCE(?, brand),
       model = COALESCE(?, model), version = COALESCE(?, version),
       year = COALESCE(?, year), price = COALESCE(?, price),
       auction_ends_at = COALESCE(?, auction_ends_at),
       last_seen_at = ?, raw = COALESCE(?, raw),
       image = COALESCE(?, image), phone = COALESCE(?, phone),
       plate = COALESCE(?, plate)
     WHERE id = ?`,
  ).run(
    input.url,
    input.title ?? null,
    brand ?? null,
    model ?? null,
    input.version ?? null,
    input.year ?? null,
    input.price ?? null,
    input.auction_ends_at ?? null,
    now,
    input.raw ? JSON.stringify(input.raw).slice(0, 4000) : null,
    image,
    phone,
    plate,
    id,
  );

  return { listing: getById(id), isNew: false, priceChanged };
}

export function getById(id) {
  return getDb().prepare('SELECT * FROM listing WHERE id = ?').get(id);
}

/** Marca como encerrado o que não foi visto na última varredura. */
export function markMissingStale(sourceId, seenIds) {
  if (!seenIds.length) return 0;
  const db = getDb();
  const placeholders = seenIds.map(() => '?').join(',');
  const res = db
    .prepare(
      `UPDATE listing SET status = 'ended', last_seen_at = datetime('now')
       WHERE source_id = ? AND status = 'active' AND id NOT IN (${placeholders})`,
    )
    .run(sourceId, ...seenIds);
  return res.changes;
}