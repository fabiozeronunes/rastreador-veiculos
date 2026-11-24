import Card from './components/Card';

export const dynamic = 'force-dynamic';

async function getListings(filters) {
  try {
    const { getDb } = await import('@rv/db');
    const db = getDb();

    const where = ['1=1'];
    const params = [];

    if (filters.kind === 'auction') {
      where.push("s.kind = 'auction'");
    } else if (filters.kind === 'classified') {
      where.push("s.kind = 'classified'");
    } else if (filters.kind === 'repass') {
      where.push("s.kind = 'repass'");
    }
    if (filters.brand) {
      where.push('l.brand = ?');
      params.push(filters.brand);
    }
    if (filters.model) {
      where.push('l.model = ?');
      params.push(filters.model);
    }
    if (filters.year) {
      where.push('l.year = ?');
      params.push(Number(filters.year));
    }
    if (filters.fav) {
      where.push('l.favorite = 1');
    }
    if (filters.vehicle_type) {
      where.push('l.vehicle_type = ?');
      params.push(filters.vehicle_type);
    }
    if (filters.q) {
      where.push('(l.title LIKE ? OR l.brand LIKE ? OR l.model LIKE ?)');
      const like = `%${filters.q}%`;
      params.push(like, like, like);
    }

    return db
      .prepare(
        `SELECT l.*, s.name AS source_name, s.kind AS source_kind
         FROM listing l
         JOIN source s ON s.id = l.source_id
         WHERE ${where.join(' AND ')}
         ORDER BY l.favorite DESC, COALESCE(l.discount_pct, -1) DESC, l.last_seen_at DESC
         LIMIT 100`
      )
      .all(...params);
  } catch {
    return [];
  }
}

async function getFacets() {
  try {
    const { getDb } = await import('@rv/db');
    const db = getDb();
    const brands = db
      .prepare('SELECT DISTINCT brand FROM listing WHERE brand IS NOT NULL ORDER BY brand')
      .all()
      .map((r) => r.brand);
    const models = db
      .prepare('SELECT DISTINCT model FROM listing WHERE model IS NOT NULL ORDER BY model')
      .all()
      .map((r) => r.model);
    const years = db
      .prepare('SELECT DISTINCT year FROM listing WHERE year IS NOT NULL ORDER BY year DESC')
      .all()
      .map((r) => r.year);
    const sources = db.prepare('SELECT id, name, kind FROM source').all();
    return { brands, models, years, sources };
  } catch {
    return { brands: [], models: [], years: [], sources: [] };
  }
}

const BRL = (v) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR')}`);

function AggregatorStatus({ sources }) {
  const total = sources.length;
  const enabled = sources.filter(s => s.enabled).length;
  const byKind = {
    auction: sources.filter(s => s.kind === 'auction').length,
    classified: sources.filter(s => s.kind === 'classified').length,
    repass: sources.filter(s => s.kind === 'repass').length,
  };
  return (
    <div
      style={{
        background: '#e8f4fd',
        border: '1px solid #b3e5fc',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span>📡 Agregador de Leilões e Repasses</span>
        <span style={{ fontWeight: 700, color: '#002f51' }}>{total} fontes • {enabled} ativas</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12 }}>
        <div>
          <strong>{byKind.auction}</strong> Leilão
        </div>
        <div>
          <strong>{byKind.classified}</strong> Classificados
        </div>
        <div>
          <strong>{byKind.repass}</strong> Repasse
        </div>
      </div>
    </div>
  );
}


export default async function Home({ searchParams }) {
  const filters = {
    kind: searchParams?.tipo || '',
    brand: searchParams?.marca || '',
    model: searchParams?.modelo || '',
    year: searchParams?.ano || '',
    q: searchParams?.q || '',
    fav: searchParams?.fav === '1',
  };

  const [rawListings, facets] = await Promise.all([getListings(filters), getFacets()]);
  const listings = JSON.parse(JSON.stringify(rawListings));
  const threshold = Number(process.env.DISCOUNT_MIN) || 30;

  const select = {
    width: '100%',
    padding: '9px 10px',
    border: '1px solid #ccc',
    borderRadius: 6,
    fontSize: 14,
    background: '#fff',
  };

  return (
    <>
    <main style={{ fontFamily: 'system-ui, sans-serif', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* header OLX-style */}
      <header style={{ background: '#002f51', color: '#fff', padding: '16px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>🚗 Rastreador de Oportunidades</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              Veículos abaixo do FIPE · desconto mínimo {threshold}%
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href={filters.fav ? '/' : '/?fav=1'}
              style={{
                background: filters.fav ? '#ff5c00' : 'rgba(255,255,255,.15)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,.4)',
                borderRadius: 20,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              ★ Favoritos {filters.fav ? '✓' : ''}
            </a>
            <span style={{ fontSize: 13, opacity: 0.85 }}>
              {listings.length} anúncio(s)
            </span>
          </div>
        </div>
      </header>

      {/* filtros */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e6e6e6', padding: 16 }}>
        <form
          method="GET"
          action="/"
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            alignItems: 'end',
          }}
        >
          <label style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
            Tipo
            <select name="tipo" defaultValue={filters.kind} style={{ ...select, marginTop: 4 }}>
              <option value="">Todos</option>
              <option value="auction">Leilão</option>
              <option value="repass">Repasse</option>
              <option value="classified">Classificado</option>
            </select>
          </label>

          <label style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
            Veículo
            <select name="vehicle_type" defaultValue={filters.vehicle_type} style={{ ...select, marginTop: 4 }}>
              <option value="">Todos</option>
              <option value="carro">Carro</option>
              <option value="SUV">SUV</option>
              <option value="pickup">Pickup</option>
            </select>
          </label>

          <label style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
            Marca
            <select name="marca" defaultValue={filters.brand} style={{ ...select, marginTop: 4 }}>
              <option value="">Todas</option>
              {facets.brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
            Modelo
            <select name="modelo" defaultValue={filters.model} style={{ ...select, marginTop: 4 }}>
              <option value="">Todos</option>
              {facets.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
            Ano
            <select name="ano" defaultValue={filters.year} style={{ ...select, marginTop: 4 }}>
              <option value="">Todos</option>
              {facets.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
            Busca livre
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="marca, modelo, versão..."
              style={{ ...select, marginTop: 4 }}
            />
          </label>

          <label
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 0',
            }}
          >
            <input
              type="checkbox"
              name="fav"
              value="1"
              defaultChecked={filters.fav}
              style={{ width: 18, height: 18, accentColor: '#ff5c00' }}
            />
            ★ Só favoritos
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              style={{
                flex: 1,
                background: '#ff5c00',
                color: '#fff',
                border: 0,
                borderRadius: 6,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Filtrar
            </button>
            <a
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 14px',
                border: '1px solid #ccc',
                borderRadius: 6,
                fontSize: 14,
                color: '#333',
                textDecoration: 'none',
              }}
            >
              Limpar
            </a>
          </div>
        </form>
      </div>

      {/* grid de anúncios */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        {listings.length === 0 ? (
          <div
            style={{
              background: '#fff',
              border: '1px dashed #ccc',
              borderRadius: 8,
              padding: 48,
              textAlign: 'center',
              color: '#777',
            }}
          >
            <div style={{ fontSize: 40 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>
              Nenhum anúncio encontrado
            </div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              Ajuste os filtros ou rode <code>npm start</code> /{' '}
              <code>POST /api?key=change-me</code> para sincronizar.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 16,
            }}
          >
            {listings.map((l) => (
              <Card key={l.id} l={l} threshold={threshold} onDetail={null} />
            ))}
          </div>
        )}

        {/* comparação FIPE × preço de venda */}
        {listings.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 16, color: '#002f51', marginBottom: 12 }}>
              💰 Comparativo: preço FIPE × preço de venda
            </h2>
            <div style={{ background: '#fff', border: '1px solid #e6e6e6', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#002f51', color: '#fff', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Veículo</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>FIPE</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Venda</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Diferença</th>
                    <th style={{ padding: '10px 12px', width: 180 }}>Barra</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l) => {
                    const fipe = l.fipe_price;
                    const venda = l.price;
                    const diff = fipe != null && venda != null ? fipe - venda : null;
                    const pct = diff != null && fipe > 0 ? Math.round((diff / fipe) * 100) : null;
                    const pctWidth = pct != null ? Math.min(Math.abs(pct), 100) : 0;
                    const below = diff != null && diff > 0;
                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 12px' }}>
                          {l.brand} {l.model} {l.version || ''} · {l.year ?? '—'}
                          <div style={{ fontSize: 12, color: '#888' }}>{l.source_name}</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#666' }}>
                          {fipe != null ? BRL(fipe) : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                          {BRL(venda)}
                        </td>
                        <td
                          style={{
                            padding: '10px 12px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: below ? '#2e9e44' : diff != null && diff < 0 ? '#d93025' : '#666',
                          }}
                        >
                          {diff == null
                            ? '—'
                            : `${below ? '−' : '+'}${BRL(Math.abs(diff))} · ${below ? pct + '% abaixo' : Math.abs(pct) + '% acima'}`}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {pct == null ? (
                            <span style={{ color: '#aaa', fontSize: 12 }}>sem FIPE</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div
                                style={{
                                  flex: 1,
                                  height: 10,
                                  background: '#eee',
                                  borderRadius: 5,
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${pctWidth}%`,
                                    height: '100%',
                                    background: below ? '#2e9e44' : '#d93025',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: below ? '#2e9e44' : '#d93025', minWidth: 38 }}>
                                {pct}%
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
              Verde = venda abaixo do FIPE (oportunidade) · Vermelho = venda acima do FIPE
            </div>
          </section>
        )}

        {/* fontes */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 16, color: '#002f51' }}>Fontes monitoradas</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {facets.sources.map((s) => (
              <span
                key={s.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e6e6e6',
                  borderRadius: 20,
                  padding: '5px 12px',
                  fontSize: 13,
                }}
              >
                {s.name}{' '}
                <span
                  style={{
                    color:
                      s.kind === 'auction' ? '#ff5c00' : s.kind === 'repass' ? '#7b2ff7' : '#00a0af',
                  }}
                >
                  {s.kind === 'auction' ? '• leilão' : s.kind === 'repass' ? '• repasse' : '• classificado'}
                </span>
              </span>
            ))}
          </div>
        </section>

        <footer style={{ marginTop: 40, fontSize: 13, color: '#999' }}>
          API: <code>GET /api?key=change-me</code> (sync FIPE) ·{' '}
          <code>POST /api?key=change-me</code> (1 ciclo) · <code>GET /api/favorite</code> (favoritos) ·{' '}
          <code>GET /watchlist</code>
        </footer>
      </div>
    </main>
    </>
  );
}
