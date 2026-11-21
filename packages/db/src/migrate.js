import { getDb, dbPath } from './index.js';

const db = getDb();
console.log('Migração OK ->', dbPath());
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();
console.log('Tabelas:', tables.map((t) => t.name).join(', '));
