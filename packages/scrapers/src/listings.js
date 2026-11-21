import { createHash } from 'node:crypto';
import { getDb } from '@rv/db';

const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 20);

/**
 * Upsert de um anúncio. Retorna { listing, isNew, priceChanged }.
 * Dedup por (source_id, external_id).
 */
export function upsertListing(input) {
  const db = getDb();
  const id = hash(`${input.source_id}:${input.external_id}`);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const existing = db.prepare('SELECT * FROM listing WHERE id = ?').get(id);

  if (!existing) {
    db.prepare(
      `INSERT INTO listing
         (id, source_id, external_id, url, title, brand, model, version, year,
          price, auction_ends_at, status, first_seen_at, last_seen_at, raw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
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
       last_seen_at = ?, raw = COALESCE(?, raw)
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
