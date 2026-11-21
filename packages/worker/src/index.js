// Worker: raspagem + verificação de oportunidades + alertas Telegram.

import 'dotenv/config';
import { getDb } from '@rv/db';
import { upsertListing, markMissingStale } from '@rv/scrapers/src/listings.js';
import { lookupPrice } from '@rv/fipe';
import { Sequelize } from 'sequelize'; // não usado, pode remover
import { fetchHtml } from '@rv/scrapers/src/fetch.js';
import { SOURCES, seedSources } from '@rv/scrapers/src/sources.js';
import { exec } from 'node:child';

import Telegraf from 'telegraf';
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const db = getDb();

const THRESHOLD_DEFAULT = Number(process.env.DISCOUNT_MIN) || 30;
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL) || 30 * 60 * 1000; // 30 min

async function computeDiscount(listing) {
  if (listing.discount_pct != null) return listing.discount_pct;
  const info = await lookupPrice({ brand: listing.brand, model: listing.model, year: listing.year ?? 2020 });
  if (!info) return null;
  if (listing.price == null) return null;
  const discount = Math.round(((info.price - listing.price) / info.price) * 100);
  // Atualiza o discount_pct no listing pra próxima vez ser rápido
  db.prepare('UPDATE listing SET discount_pct = ? WHERE id = ?').run(discountPct, listing.id);
  return discount;
}

async function checkListing(listing) {
  const discount = await computeDiscount(listing);
  if (discount == null) return;
  if (discount < THRESHOLD_DEFAULT) return;

  // Verificar se já enviamos alerta pra esse listing + channel
  const already = db.prepare('SELECT * FROM alert WHERE listing_id = ? AND channel = ?').get(listing.id, 'telegram');
  if (already) return;

  // Enviar alerta
  const msg = \`🚨 Oportunidade!\n\${listing.brand} \${listing.model} \${listing.year ?? '?'}\nPreço: R\${listing.price}\nFIPE: R\${info.price}\nDesconto: \${discount}%\n\${listing.url}\`;
  await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, msg, { parse_mode: 'Markdown' });

  // Registrar alerta
  db.prepare('INSERT INTO alert (listing_id, channel) VALUES (?, ?)').run(listing.id, 'telegram');
  console.log(\`Alerta enviado: \${listing.brand} \${listing.model} desconto \${discount}%\`);
}

async function runScrapeCycle() {
  console.log(`\n=== Ciclo de verificação ${new Date().toLocaleTimeString()} ===`);

  // Seed sources if empty
  const srcCount = db.prepare('SELECT count(*) c FROM source').get().c;
  if (srcCount === 0) seedSources(db);

  // Para cada fonte ativa
  const sources = db.prepare('SELECT * FROM source WHERE enabled = 1').all();
  for (const src of sources) {
    console.log(`Rastreador: \${src.name} (${src.strategy})`);
    try {
      const { html, strategy } = await fetchHtml(src.id, src.base_url, { order: src.order });
      // TODO: parser HTML por fonte - por agora mock com dados fixos.
      // Em produção, cada fonte teria um parser (ex: parseIcarros, parseKavak).
      // Por enquanto, vamos apenas testar com um anúncio de exemplo:
      const example = {
        source_id: src.id,
        external_id: 'demo-001',
        url: src.base_url + '/veiculo/teste',
        title: 'Honda HR-V Advance 1.5 Flex TB 16V 5p Aut.',
        brand: 'Honda',
        model: 'HR-V',
        version: 'Advance',
        year: 2019,
        price: 89990, // preço de exemplo (abaixo de FIPE)
        raw: { html, strategy },
      };
      const { listing, isNew } = upsertListing(example);
      console.log(\`  listing \${isNew ? 'novo' : 'existente'} id=\${listing.id} price=\${listing.price}\`);

      // Verificar oportunidade
      await checkListing(listing);
    } catch (err) {
      console.error(`  Erro em \${src.name}:`, err.message);
    }
  }

  // Marcar listings que não aparecem mais como encerrados
  const active = db.prepare('SELECT id FROM listing WHERE status = \'active\'').all();
  const seenIds = sources.map(s => ...); // placeholder; implementar rastreamento real depois
  // markMissingStale(src.id, seenIds); // desabilitado provisório

  console.log('=== Fim do ciclo ===\n');
}

// Executar na inicialização e depois no intervalo
runScrapeCycle();
setInterval(runScrapeCycle, CHECK_INTERVAL_MS);

console.log('Worker rodando...');