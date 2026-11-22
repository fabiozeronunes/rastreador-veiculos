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
    }
    if (filters.model) {
      where.push('l.model = ?');
      params.push(filters.model);
    }
    if (filters.year) {
      where.push('l.year = ?');
      params.push(Number(filters.year));
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
         ORDER BY COALESCE(l.discount_pct, -1) DESC, l.last_seen_at DESC
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
    const models = db
      .prepare('SELECT DISTINCT model FROM listing WHERE model IS NOT NULL ORDER BY model')
      .all()
      .map((r) => r.model);
    const years = db
      .prepare('SELECT DISTINCT year FROM listing WHERE year IS NOT NULL ORDER BY year DESC')
      .all()
      .map((r) => r.year);
    const sources = db.prepare('SELECT id, name, kind FROM source').all();
    return { models, years, sources };
  } catch {
    return { models: [], years: [], sources: [] };
  }
}

const BRL = (v) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR')}`);

function Card({ l, threshold }) {
  const discount = l.discount_pct;
  const hot = discount != null && discount >= threshold;
  const auction = l.source_kind === 'auction';

  return (
    <a
      href={l.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        border: '1px solid #e6e6e6',
        borderRadius: 8,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'box-shadow .15s, transform .15s',
      }}
    >
      {/* imagem (placeholder OLX-style) */}
      <div
        style={{
          position: 'relative',
          height: 160,
          background: auction
            ? 'linear-gradient(135deg,#002f51 0%,#3b5998 100%)'
            : 'linear-gradient(135deg,#00a0af 0%,#002f51 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 42,
        }}
      >
        🚗
        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: auction ? '#ff5c00' : '#00a0af',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 4,
            textTransform: 'uppercase',
          }}
        >
          {auction ? 'Leilão' : 'Classificado'}
        </span>
        {hot && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: '#2e9e44',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 4,
            }}
          >
            −{discount}%
          </span>
        )}
      </div>

      {/* corpo */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#002f51' }}>{BRL(l.price)}</div>

        {discount != null && (
          <div style={{ fontSize: 13, color: '#666' }}>
            <span style={{ textDecoration: 'line-through' }}>{BRL(l.fipe_price)}</span>{' '}
            <span style={{ color: '#2e9e44', fontWeight: 600 }}>
              FIPE {BRL(l.fipe_price)} · −{discount}%
            </span>
          </div>
        )}

        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
          {l.brand} {l.model} {l.version || ''}
        </div>

        <div style={{ fontSize: 13, color: '#666' }}>
          {l.year ?? '—'} · {l.title || ''}
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: '#888',
            paddingTop: 6,
            borderTop: '1px solid #f0f0f0',
          }}
        >
          <span>{l.source_name}</span>
          <span>{l.auction_ends_at ? `até ${l.auction_ends_at}` : ''}</span>
        </div>
      </div>
    </a>
  );
}

export default async function Home({ searchParams }) {
  const filters = {
    kind: searchParams?.tipo || '',
    model: searchParams?.modelo || '',
    year: searchParams?.ano || '',
    q: searchParams?.q || '',
  };

  const [listings, facets] = await Promise.all([getListings(filters), getFacets()]);
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
          <div style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.85 }}>
            {listings.length} anúncio(s)
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            alignItems: 'end',
          }}
        >
          <label style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
            Tipo
            <select name="tipo" defaultValue={filters.kind} style={{ ...select, marginTop: 4 }}>
              <option value="">Todos</option>
              <option value="auction">Leilão</option>
              <option value="classified">Classificado</option>
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
              <Card key={l.id} l={l} threshold={threshold} />
            ))}
          </div>
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
                <span style={{ color: s.kind === 'auction' ? '#ff5c00' : '#00a0af' }}>
                  {s.kind === 'auction' ? '• leilão' : '• classificado'}
                </span>
              </span>
            ))}
          </div>
        </section>

        <footer style={{ marginTop: 40, fontSize: 13, color: '#999' }}>
          API: <code>GET /api?key=change-me</code> (sync FIPE) ·{' '}
          <code>POST /api?key=change-me</code> (1 ciclo) · <code>GET /watchlist</code>
        </footer>
      </div>
    </main>
  );
}
