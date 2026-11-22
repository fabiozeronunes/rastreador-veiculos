import { NextResponse } from 'next/server';
import { extractImage, extractPhone, extractPlate, extractTitle, extractBrand, extractModel, extractYear, extractPrice } from '../../../../../packages/scrapers/src/listings.js';
import { STRATEGIES } from '../../../../../packages/scrapers/src/fetch.js';

export const dynamic = 'force-dynamic';

const DEFAULT_STRATEGY = 'fetch';
const TIMEOUT = 30000;

async function handler(request) {
  let url;
  let strategy;

  try {
    const body = await request.json();
    url = body?.url;
    strategy = body?.strategy || DEFAULT_STRATEGY;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL é obrigatória' }, { status: 400 });
    }

    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'URL deve iniciar com http:// ou https://' }, { status: 400 });
    }

    // Tenta fazer fetch usando a estratégia especificada
    let html = null;
    let usedStrategy = null;

    const strategyFunc = STRATEGIES[strategy];
    if (!strategyFunc) {
      const available = Object.keys(STRATEGIES).join(', ');
      return NextResponse.json({ error: `Estratégia '${strategy}' não disponível. Use: ${available}` }, { status: 400 });
    }

    try {
      const abort = AbortSignal.timeout(TIMEOUT);
      html = await strategyFunc(url, { signal: abort });
      usedStrategy = strategy;
      console.log(`URL fetch via ${strategy} OK, length: ${html?.length}`);
    } catch (err) {
      console.error(`Erro via ${strategy}:`, err.message);
      // Fallback para fetch se a estratégia escolhida falhar
      if (strategy !== 'fetch') {
        try {
          const fetchFunc = STRATEGIES['fetch'];
          html = await fetchFunc(url, { signal: AbortSignal.timeout(TIMEOUT) });
          usedStrategy = 'fetch';
          console.log('Fallback fetch OK, length:', html?.length);
        } catch (e) {
          return NextResponse.json({ error: `Não foi possível acessar a URL com nenhuma estratégia. ${strategy}=${err.message}, fetch=${e.message}` }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: `Não foi possível acessar a URL: ${err.message}` }, { status: 400 });
      }
    }

    if (!html) {
      return NextResponse.json({ error: 'Não foi possível obter o HTML da URL' }, { status: 400 });
    }

    // Extrai dados do HTML
    const title = extractTitle(html) || 'Anúncio via link';
    const brand = extractBrand(html) || 'Não identificado';
    const model = extractModel(html) || 'Não identificado';
    const year = extractYear(html) || null;
    const price = extractPrice(html) || null;
    const image = extractImage(html);
    const phone = extractPhone(html);
    const plate = extractPlate(html);

    // Gera ID único baseado na URL
    const urlHash = require('crypto').createHash('sha256').update(url).digest('hex').slice(0, 20);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // Tenta salvar no banco
    let listingId;
    try {
      const { getDb } = await import('@rv/db');
      const db = getDb();

      // Verifica se já existe um anúncio com este URL
      const existing = db.prepare('SELECT id FROM listing WHERE url = ?').get(url);
      if (existing) {
        listingId = existing.id;
        // Atualiza o existente
        db.prepare(
          `UPDATE listing SET title = ?, brand = ?, model = ?, version = ?, year = ?, price = ?, image = ?, phone = ?, plate = ?, raw = ?, last_seen_at = ?, status = 'active' WHERE id = ?`
        ).run(title, brand, model, '', year, price, image, phone, plate, JSON.stringify({ html, strategy: usedStrategy, source: 'custom_url' }), now, listingId);
      } else {
        // Insere novo
        db.prepare(
          `INSERT INTO listing
             (id, source_id, external_id, url, title, brand, model, version, year,
              price, auction_ends_at, status, first_seen_at, last_seen_at, raw)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
        ).run(
          urlHash,
          'custom',
          urlHash,
          url,
          title,
          brand,
          model,
          '',
          year,
          price,
          now,
          now,
          now,
          JSON.stringify({ html, strategy: usedStrategy, source: 'custom_url' })
        );
        listingId = urlHash;
      }
    } catch (dbError) {
      console.error('Erro no banco de dados:', dbError);
      return NextResponse.json({ error: 'Erro ao salvar no banco: ' + dbError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      listingId,
      data: {
        title,
        brand,
        model,
        year,
        price,
        image,
        phone,
        plate,
        url,
        source: 'custom',
        strategyUsed: usedStrategy,
      },
      message: 'Anúncio importado com sucesso!'
    });

  } catch (error) {
    console.error('Erro no endpoint scrape-url:', error);
    return NextResponse.json({ error: 'Erro interno: ' + error.message }, { status: 500 });
  }
}

export { handler as GET, handler as POST };