import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST /api/favorite — alterna favorito do anúncio
export async function POST(request) {
  let id;
  try {
    const body = await request.json();
    id = body.id;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!id || typeof id !== 'string' || id.length > 64) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  try {
    const { getDb } = await import('@rv/db');
    const db = getDb();
    const row = db.prepare('SELECT id, favorite FROM listing WHERE id = ?').get(id);
    if (!row) return NextResponse.json({ error: 'não encontrado' }, { status: 404 });

    const next = row.favorite ? 0 : 1;
    db.prepare('UPDATE listing SET favorite = ? WHERE id = ?').run(next, id);
    return NextResponse.json({ id, favorite: next });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}

// GET /api/favorite — lista favoritos (para inspeção)
export async function GET() {
  try {
    const { getDb } = await import('@rv/db');
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT l.id, l.brand, l.model, l.year, l.price, l.url, l.image, l.phone, s.name AS source_name
         FROM listing l JOIN source s ON s.id = l.source_id
         WHERE l.favorite = 1 ORDER BY l.last_seen_at DESC`
      )
      .all();
    return NextResponse.json({ favorites: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
