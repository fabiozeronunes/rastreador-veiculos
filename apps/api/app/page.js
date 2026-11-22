export const dynamic = 'force-dynamic';

async function getWatchlist() {
  try {
    const { getDb } = await import('@rv/db');
    const db = getDb();
    return db.prepare('SELECT * FROM listing ORDER BY created_at DESC LIMIT 50').all();
  } catch {
    return [];
  }
}

async function getSources() {
  try {
    const { getDb } = await import('@rv/db');
    const db = getDb();
    return db.prepare('SELECT * FROM source').all();
  } catch {
    return [];
  }
}

export default async function Home() {
  const listings = await getWatchlist();
  const sources = await getSources();
  const threshold = process.env.DISCOUNT_MIN || '30';

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Rastreador de Oportunidades Veiculares</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Monitorando veículos abaixo do FIPE &middot; desconto mínimo: <strong>{threshold}%</strong>
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18 }}>Fontes ({sources.length})</h2>
        {sources.length === 0 ? (
          <p style={{ color: '#999' }}>Nenhuma fonte cadastrada ainda.</p>
        ) : (
          <ul>
            {sources.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong> — {s.strategy} {s.enabled ? '✅' : '⏸️'}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18 }}>Oportunidades ({listings.length})</h2>
        {listings.length === 0 ? (
          <p style={{ color: '#999' }}>Nenhum anúncio rastreado ainda. Rode <code>npm start</code> ou acesse a API para sincronizar.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
                <th style={{ padding: 8 }}>Veículo</th>
                <th style={{ padding: 8 }}>Ano</th>
                <th style={{ padding: 8 }}>Preço</th>
                <th style={{ padding: 8 }}>Desconto</th>
                <th style={{ padding: 8 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>
                    {l.brand} {l.model} {l.version || ''}
                  </td>
                  <td style={{ padding: 8 }}>{l.year ?? '?'}</td>
                  <td style={{ padding: 8 }}>{l.price ? `R$ ${l.price.toLocaleString('pt-BR')}` : '—'}</td>
                  <td style={{ padding: 8, color: (l.discount_pct ?? 0) >= threshold ? 'green' : '#666' }}>
                    {l.discount_pct != null ? `${l.discount_pct}%` : '—'}
                  </td>
                  <td style={{ padding: 8 }}>{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer style={{ marginTop: 40, fontSize: 13, color: '#999' }}>
        API: <code>GET /api?key=change-me</code> (sync FIPE) &middot;{' '}
        <code>POST /api?key=change-me</code> (1 ciclo de scrape) &middot;{' '}
        <code>GET /watchlist</code>
      </footer>
    </main>
  );
}
