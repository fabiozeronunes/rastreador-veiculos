import 'telegraf/bedrock';
import { getDb } from '@rv/db';
import { lookupPrice } from '@rv/fipe';
import { upsertListing, markMissingStale } from '@rv/scrapers/src/listings.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!BOT_TOKEN || !CHAT_ID) {
  console.error('Defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env');
  process.exit(1);
}

import Telegraf from 'telegraf';
const bot = new Telegraf(BOT_TOKEN);

const db = getDb();

// --- Comandos ---

bot.start((ctx) => ctx.reply('Olá! Use /watch <marca> <modelo> <ano-min> <ano-max> <desconto-min> para salvar buscas.'));

bot.help((ctx) => ctx.reply(
  '/watch Honda HR-V 2018 2020 30  ← alerta se achar HR-V 2018/2020 com ≥30% abaixo da Tabela FIPE\n'
  + '/lista  ← ver suas buscas salvas\n'
  + '/remover <id>  ← remover busca'
));

bot.command('lista', async (ctx) => {
  const rows = db.prepare('SELECT * FROM watchlist').all();
  if (!rows.length) return ctx.reply('Nenhuma busca salva ainda.');
  const list = rows.map(r => \`#\${r.id}: \${r.brand} \${r.model} anos \${r.year_min}-\${r.year_max}, desconto ≥\${r.discount_min}%\`).join('\n');
  ctx.reply('Suas buscas salvas:\n' + list);
});

bot.command('remover', async (ctx) => {
  const [, id] = ctx.message.text.split(' ');
  if (!id) return ctx.reply('Uso: /remover <id>');
  const r = db.prepare('DELETE FROM watchlist WHERE id = ?').run(id);
  ctx.reply(r.changes ? 'Removido.' : 'Não encontrado.');
});

bot.command('watch', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 5) return ctx.reply('Formato: /watch <marca> <modelo> <ano-min> <ano-max> <desconto-min>');
  const [brand, model, yearMinS, yearMaxS, discountMinS] = args;
  const yearMin = Math.max(1900, Math.min(2030, Number(yearMinS)));
  const yearMax = Math.max(1900, Math.min(2030, Number(yearMaxS)));
  const discountMin = Math.max(0, Math.min(100, Number(discountMinS)));

  const already = db.prepare('SELECT * FROM watchlist WHERE brand = ? AND model = ? AND year_min = ? AND year_max = ? AND discount_min = ?').get(brand, model, yearMin, yearMax, discountMin);
  if (already) return ctx.reply('Essa busca já está salva. Use /remover <id> para alterar.');

  const result = db.prepare(
    'INSERT INTO watchlist (brand, model, year_min, year_max, discount_min) VALUES (?, ?, ?, ?, ?)',
  ).run(brand, model, yearMin, yearMax, discountMin);

  ctx.reply(\`✅ Busca salva!\n\${brand} \${model} anos \${yearMin}-\${yearMax}, desconto ≥\${discountMin}%\nID: \${result.lastID}\`);
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

console.log('Telegram bot iniciado.');