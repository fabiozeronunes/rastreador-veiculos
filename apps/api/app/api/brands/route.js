import { NextResponse } from 'next/server';
import { getDb } from '@rv/db';

export const dynamic = 'force-dynamic';

// GET /api/brands - Listar todas as marcas cadastradas
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const cronSecret = process.env.CRON_SECRET || 'change-me';
    if (key !== cronSecret) {
      return new Response('Unauthorized', { status: 401 });
    }
    const db = getDb();
    const brands = db.prepare('SELECT id, name, country, is_active FROM brands ORDER BY name').all();
    const modelsByBrand = {};
    const allModels = db.prepare('SELECT m.id, m.brand_id, m.name, b.name AS brand_name FROM models m JOIN brands b ON m.brand_id = b.id WHERE m.is_active = 1 ORDER BY b.name, m.name').all();
    for (const m of allModels) {
      if (!modelsByBrand[m.brand_name]) modelsByBrand[m.brand_name] = [];
      modelsByBrand[m.brand_name].push(m.name);
    }
    return NextResponse.json({ brands, modelsByBrand });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/brands - Cadastrar nova marca
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const cronSecret = process.env.CRON_SECRET || 'change-me';
    if (key !== cronSecret) {
      return new Response('Unauthorized', { status: 401 });
    }
    const body = await request.json();
    const { name, country } = body;
    if (!name) {
      return NextResponse.json({ error: 'Nome da marca é obrigatório' }, { status: 400 });
    }
    const db = getDb();
    // Verifica se já existe
    const existing = db.prepare('SELECT id FROM brands WHERE name = ?').get(name);
    if (existing) {
      return NextResponse.json({ error: 'Marca já cadastrada', id: existing.id }, { status: 200 });
    }
    const result = db.prepare('INSERT INTO brands (name, country, is_active) VALUES (?, ?, 1)').run(name, country || 'Brasil');
    const newBrand = db.prepare('SELECT id, name, country, is_active FROM brands WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ success: true, brand: newBrand, message: 'Marca cadastrada com sucesso' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}