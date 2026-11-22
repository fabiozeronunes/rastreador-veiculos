// Registro de fontes. Cada entrada vira uma linha na tabela `source`.

export const SOURCES = [
  {
    id: 'icarros-leilao',
    name: 'iCarros Leilão',
    kind: 'auction',
    base_url: 'https://www.leilao.icarros.com.br',
    enabled: true,
    order: ['fetch', 'playwright'],
  },
  {
    id: 'kavak',
    name: 'Kavak',
    kind: 'classified',
    base_url: 'https://www.kavak.com/br',
    enabled: true,
    order: ['fetch', 'playwright'],
  },
  {
    id: 'mobiauto',
    name: 'Mobiauto',
    kind: 'classified',
    base_url: 'https://www.mobiauto.com.br',
    enabled: true,
    order: ['fetch', 'playwright'],
  },
  {
    id: 'copart',
    name: 'Copart Brasil',
    kind: 'auction',
    base_url: 'https://www.copart.com.br',
    enabled: true,
    order: ['playwright', 'scrapfly', 'scrapingbee', 'fetch'],
  },
  {
    id: 'plural',
    name: 'Leilão Plural',
    kind: 'auction',
    base_url: 'https://www.plural.com.br',
    enabled: false, // ativa depois de validar bypass
    order: ['playwright', 'scrapfly', 'scrapingbee'],
  },
  // --- Repasse (bancos/seguradoras) ---
  {
    id: 'leilao-bb',
    name: 'Leilão Banco do Brasil',
    kind: 'repass',
    base_url: 'https://www.leilao.bb.com.br',
    enabled: true,
    order: ['fetch', 'playwright'],
  },
  {
    id: 'leilao-caixa',
    name: 'Leilão Caixa',
    kind: 'repass',
    base_url: 'https://www.leiloescaixa.com.br',
    enabled: true,
    order: ['fetch', 'playwright'],
  },
  {
    id: 'leilao-santander',
    name: 'Santander Leilões',
    kind: 'repass',
    base_url: 'https://www.santander.com.br/leiloes',
    enabled: true,
    order: ['fetch', 'playwright'],
  },
];

export function seedSources(db) {
  const stmt = db.prepare(
    `INSERT INTO source (id, name, kind, base_url, enabled)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind,
       base_url = excluded.base_url`,
  );
  for (const s of SOURCES) {
    stmt.run(s.id, s.name, s.kind, s.base_url, s.enabled ? 1 : 0);
  }
}
