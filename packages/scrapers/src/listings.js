import { createHash } from 'node:crypto';
import { getDb } from '@rv/db';

const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 20);

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

/**
 * Upsert de um anúncio. Retorna { listing, isNew, priceChanged }.
 * Dedup por (source_id, external_id).
 */
export function upsertListing(input) {
  const db = getDb();
  const id = hash(`${input.source_id}:${input.external_id}`);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const existing = db.prepare('SELECT * FROM listing WHERE id = ?').get(id);

  // Extrai imagem e telefone do HTML bruto (se disponíveis)
  const html = typeof input.raw === 'string' ? input.raw : (input.raw?.html || '');
  const image = input.image ?? extractImage(html);
  const phone = input.phone ?? extractPhone(html);

  if (!existing) {
    db.prepare(
      `INSERT INTO listing
         (id, source_id, external_id, url, title, brand, model, version, year,
          price, auction_ends_at, status, first_seen_at, last_seen_at, raw, image, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.source_id,
      String(input.external_id),
      input.url,
      input.title ?? null,
      input.brand ?? null,
      input.model ?? null,
      input.version ?? null,
      input.year ?? null,
      input.price ?? null,
      input.auction_ends_at ?? null,
      now,
      now,
      input.raw ? JSON.stringify(input.raw).slice(0, 4000) : null,
      image,
      phone,
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
       image = COALESCE(?, image), phone = COALESCE(?, phone)
     WHERE id = ?`,
  ).run(
    input.url,
    input.title ?? null,
    input.brand ?? null,
    input.model ?? null,
    input.version ?? null,
    input.year ?? null,
    input.price ?? null,
    input.auction_ends_at ?? null,
    now,
    input.raw ? JSON.stringify(input.raw).slice(0, 4000) : null,
    image,
    phone,
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
