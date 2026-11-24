import { NextResponse } from 'next/server';
import { getDb } from '@rv/db';

export const dynamic = 'force-dynamic';

// GET /api/models - Listar todos os modelos (filtrar por marca opcional)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const cronSecret = process.env.CRON_SECRET || 'change-me';
    if (key !== cronSecret) {
      return new Response('Unauthorized', { status: 401 });
    }
    const { brandName } = Object.fromEntries(searchParams.entries());
    const db = getDb();
    let models;
    if (brandName) {
      const brandRow = db.prepare('SELECT id FROM brands WHERE name = ? AND is_active = 1').get(brandName);
      if (brandRow) {
        models = db.prepare('SELECT id, name FROM models WHERE brand_id = ? AND is_active = 1 ORDER BY name').all(brandRow.id);
      } else {
        models = [];
      }
    } else {
      models = db.prepare('SELECT id, name FROM models WHERE is_active = 1 ORDER BY name').all();
    }
    return NextResponse.json({ models });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/models - Cadastrar novo modelo
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const cronSecret = process.env.CRON_SECRET || 'change-me';
    if (key !== cronSecret) {
      return new Response('Unauthorized', { status: 401 });
    }
    const body = await request.json();
    const { brandName, modelName } = body;
    if (!brandName || !modelName) {
      return NextResponse.json({ error: 'Nome da marca e do modelo são obrigatórios' }, { status: 400 });
    }
    const db = getDb();
    // Verifica se a marca existe
    const brandRow = db.prepare('SELECT id FROM brands WHERE name = ? AND is_active = 1').get(brandName);
    if (!brandRow) {
      return NextResponse.json({ error: 'Marca não encontrada ou inativa' }, { status: 404 });
    }
    // Verifica se modelo já existe para esta marca
    const existing = db.prepare('SELECT id FROM models WHERE brand_id = ? AND name = ?').get(brandRow.id, modelName);
    if (existing) {
      return NextResponse.json({ error: 'Modelo já cadastrado para esta marca', id: existing.id }, { status: 200 });
    }
    const result = db.prepare('INSERT INTO models (brand_id, name, is_active) VALUES (?, ?, 1)').run(brandRow.id, modelName);
    const newModel = db.prepare('SELECT id, name FROM models WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ success: true, model: newModel, message: 'Modelo cadastrado com sucesso' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}