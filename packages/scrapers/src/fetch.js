// Estratégias de acesso. Cada fonte declara uma ordem de tentativa; quando
// uma falha 2x seguidas, a próxima execução pula direto pra seguinte.
//
//   fetch       -> HTTP direto (mais barato, 1 crédito = 0)
//   playwright  -> browser real no IP de casa (0 crédito, lento)
//   scrapfly    -> API free tier (1 crédito/req datacenter)
//   scrapingbee -> API free tier (1 crédito/req)

import { getDb } from '@rv/db';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function viaFetch(url, { timeout = 25000 } = {}) {
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Incapsula/Cloudflare devolvem 200 com página de desafio
  if (/_Incapsula_Resource|cf-browser-verification|Just a moment/i.test(body)) {
    throw new Error('bloqueado: página de desafio');
  }
  return body;
}

async function viaScrapfly(url) {
  const key = process.env.SCRAPFLY_API_KEY;
  if (!key) throw new Error('SCRAPFLY_API_KEY ausente');
  const u = new URL('https://api.scrapfly.io/scrape');
  u.searchParams.set('url', url);
  u.searchParams.set('key', key);
  u.searchParams.set('render', 'html');
  const res = await fetch(u, { signal: AbortSignal.timeout(60000) });
  const data = await res.json();
  if (data.status !== 'success') {
    throw new Error(`scrapfly: ${data.message || res.status}`);
  }
  return data.result.body;
}

async function viaScrapingBee(url) {
  const key = process.env.SCRAPINGBEE_API_KEY;
  if (!key) throw new Error('SCRAPINGBEE_API_KEY ausente');
  const u = new URL('https://app.scrapingbee.com/api/v1/');
  u.searchParams.set('api_key', key);
  u.searchParams.set('url', url);
  u.searchParams.set('render', 'true');
  const res = await fetch(u, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`scrapingbee: HTTP ${res.status}`);
  return await res.text();
}

async function viaPlaywright(url) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('playwright não instalado');
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      userAgent: UA,
      locale: 'pt-BR',
      viewport: { width: 1366, height: 900 },
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500); // deixa JS assinar o token
    return await page.content();
  } finally {
    await browser.close();
  }
}

const STRATEGIES = {
  fetch: viaFetch,
  playwright: viaPlaywright,
  scrapfly: viaScrapfly,
  scrapingbee: viaScrapingBee,
};

/** Ordem padrão: barato -> browser local -> APIs free. */
export const DEFAULT_ORDER = ['fetch', 'playwright', 'scrapfly', 'scrapingbee'];

function bumpFailure(sourceId, strategy, err) {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT strategy, last_error FROM source WHERE id = ?',
    )
    .get(sourceId);
  const consecutive =
    row?.last_error && row.strategy === strategy
      ? Number(row.meta_consecutive ?? 0) + 1
      : 1;
  db.prepare(
    `UPDATE source SET strategy = ?, last_error = ?, last_error_at = datetime('now'),
      meta_consecutive = ? WHERE id = ?`,
  ).run(strategy, String(err.message).slice(0, 500), consecutive, sourceId);
}

function markSuccess(sourceId) {
  const db = getDb();
  db.prepare(
    `UPDATE source SET last_success_at = datetime('now'), last_error = NULL,
      meta_consecutive = 0 WHERE id = ?`,
  ).run(sourceId);
}

/**
 * Busca HTML de uma URL tentando as estratégias em ordem.
 * Pula as que falharam 2x seguidas (registrado em source.last_error).
 */
export async function fetchHtml(sourceId, url, { order = DEFAULT_ORDER } = {}) {
  const db = getDb();
  const src = db.prepare('SELECT * FROM source WHERE id = ?').get(sourceId);
  const skipAfter = src?.meta_consecutive >= 2 ? src.strategy : null;

  const tries = order.filter((s) => s !== skipAfter);
  let lastErr;
  for (const strategy of tries) {
    try {
      const html = await STRATEGIES[strategy](url);
      markSuccess(sourceId);
      return { html, strategy };
    } catch (err) {
      lastErr = err;
      bumpFailure(sourceId, strategy, err);
    }
  }
  throw lastErr ?? new Error('nenhuma estratégia disponível');
}

export { STRATEGIES };
