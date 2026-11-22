/** Worker: raspagem + verificação de oportunidades + alertas Telegram. */

const dotenv = require('dotenv');
dotenv.config();

const { getDb } = require('@rv/db');
const { upsertListing, markMissingStale } = require('@rv/scrapers/src/listings.js');
const { lookupPrice } = require('@rv/fipe');
const { fetchHtml } = require('@rv/scrapers/src/fetch.js');
const { SOURCES, seedSources } = require('@rv/scrapers/src/sources.js');
const { exec } = require('child_process');

const telegraf_module = require('telegraf');
const bot = process.env.TELEGRAM_BOT_TOKEN
  ? new telegraf_module.Telegraf(process.env.TELEGRAM_BOT_TOKEN)
  : null;

const db = getDb();

const THRESHOLD_DEFAULT = Number(process.env.DISCOUNT_MIN) || 30;
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL) || 30 * 60 * 1000; // 30 min

async function computeDiscount(listing) {
  if (listing.discount_pct != null && listing.fipe_price != null) {
    return { discount: listing.discount_pct, fipePrice: listing.fipe_price };
  }
  const info = await lookupPrice({ brand: listing.brand, model: listing.model, year: listing.year ?? 2020 });
  if (!info) return null;
  if (listing.price == null) return null;
  const discount = Math.round(((info.price - listing.price) / info.price) * 100);
  // Atualiza discount_pct e fipe_price no listing pra próxima vez ser rápido
  db.prepare('UPDATE listing SET discount_pct = ?, fipe_price = ? WHERE id = ?').run(discount, info.price, listing.id);
  return { discount, fipePrice: info.price };
}

async function checkListing(listing) {
  const result = await computeDiscount(listing);
  if (!result) return;
  const { discount, fipePrice } = result;
  if (discount < THRESHOLD_DEFAULT) return;

  // Verificar se já enviamos alerta pra esse listing + channel
  const already = db.prepare('SELECT * FROM alert WHERE listing_id = ? AND channel = ?').get(listing.id, 'telegram');
  if (already) return;

  // Enviar alerta (só se houver token configurado)
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const msg = '🚨 Oportunidade!\n' + listing.brand + ' ' + listing.model + ' ' + (listing.year ?? '?') + '\nPreço: R$' + listing.price + '\nFIPE: R$' + fipePrice + '\nDesconto: ' + discount + '%\n' + listing.url;
    await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, msg);
  }

  // Registrar alerta
  db.prepare('INSERT INTO alert (listing_id, channel) VALUES (?, ?)').run(listing.id, 'telegram');
  console.log('Alerta: ' + listing.brand + ' ' + listing.model + ' desconto ' + discount + '%');
}

async function runScrapeCycle() {
  console.log('\n=== Ciclo de verificação ' + new Date().toLocaleTimeString() + ' ===');

  // Seed sources if empty
  const srcCount = db.prepare('SELECT count(*) c FROM source').get().c;
  if (srcCount === 0) seedSources(db);

  // Para cada fonte ativa
  const sources = db.prepare('SELECT * FROM source WHERE enabled = 1').all();
  for (const src of sources) {
    console.log('Rastreador: ' + src.name + ' (' + src.strategy + ')');
    try {
      const { html, strategy } = await fetchHtml(src.id, src.base_url, { order: src.order });
      // TODO: parser HTML por fonte - por enquanto mock com dados fixos.
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
      console.log('  listing ' + (isNew ? 'novo' : 'existente') + ' id=' + listing.id + ' price=' + listing.price);

      // Verificar oportunidade
      await checkListing(listing);
    } catch (err) {
      console.error('  Erro em ' + src.name + ':', err.message);
    }
  }

  // Marcar listings que não aparecem mais como encerrados
  const active = db.prepare('SELECT id FROM listing WHERE status = \'active\'').all();
  console.log('  Listings ativos: ' + active.length);

  console.log('=== Fim do ciclo ===\n');
}

// Executar na inicialização e depois no intervalo
runScrapeCycle().then(() => {
  if (process.argv.includes('--once')) {
    console.log('Modo --once: encerrando após um ciclo.');
    process.exit(0);
  }
  setInterval(runScrapeCycle, CHECK_INTERVAL_MS);
});

console.log('Worker rodando...');