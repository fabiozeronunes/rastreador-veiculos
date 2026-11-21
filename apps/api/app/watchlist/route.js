import { getDb } from '@rv/db';
import { upsertListing } from '@rv/scrapers/src/listings.js';
import { lookupPrice } from '@rv/fipe';

export async function GET(request) {
  const db = getDb();
  const watchlist = db.prepare('SELECT * FROM watchlist').all();
  const listings = db.prepare('SELECT * FROM listing WHERE status = ? ORDER BY last_seen_at DESC').all('active');
  return new Response(
    JSON.stringify({ watchlist, listings }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

export async function POST(request) {
  const body = await request.json();
  const { brand, model, yearMin, yearMax, discountMin } = body;
  if (!brand || !model) {
    return new Response('Missing params', { status: 400 });
  }
  const result = db.prepare(
    'INSERT INTO watchlist (brand, model, year_min, year_max, discount_min) VALUES (?, ?, ?, ?, ?)',
  ).run(brand, model, yearMin ?? null, yearMax ?? null, discountMin ?? 30);
  return new Response(
    JSON.stringify({ ok: true, id: result.lastID }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}