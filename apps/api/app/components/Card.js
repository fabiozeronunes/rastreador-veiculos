"use client";
import FavoriteButton from './FavoriteButton';

const BRL = (v) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR')}`);

function WhatsAppButton({ phone, title }) {
  const text = encodeURIComponent(`Olá! Vi seu anúncio: ${title || 'veículo'}`);
  return (
    <a
      href={`https://wa.me/${phone}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: '#25d366',
        color: '#fff',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 13,
        fontWeight: 700,
        textDecoration: 'none',
      }}
    >
      💬 WhatsApp
    </a>
  );
}

function Card({ l, threshold, onDetail }) {
  const discount = l.discount_pct;
  const hot = discount != null && discount >= threshold;
  const auction = l.source_kind === 'auction';
  const repass = l.source_kind === 'repass';

  const badge = repass
    ? { text: 'Repasse', color: '#7b2ff7' }
    : auction
      ? { text: 'Leilão', color: '#ff5c00' }
      : { text: 'Classificado', color: '#00a0af' };

  const handleDetail = () => onDetail && onDetail(l);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        border: l.favorite ? '2px solid #ff5c00' : '1px solid #e6e6e6',
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'box-shadow .15s',
        cursor: 'pointer',
      }}
      onClick={handleDetail}
    >
      {/* imagem + link */}
      <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        <div
          style={{
            position: 'relative',
            height: 160,
            background: repass
              ? 'linear-gradient(135deg,#7b2ff7 0%,#002f51 100%)'
              : auction
                ? 'linear-gradient(135deg,#002f51 0%,#3b5998 100%)'
                : 'linear-gradient(135deg,#00a0af 0%,#002f51 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {l.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={l.image}
              alt={l.title || `${l.brand} ${l.model}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: 42 }}>🚗</span>
          )}

          <span
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              background: badge.color,
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 4,
              textTransform: 'uppercase',
            }}
          >
            {badge.text}
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
      </a>

      {/* corpo */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#002f51' }}>{BRL(l.price)}</div>

        {l.fipe_price != null && (
          <div style={{ fontSize: 13, color: '#666' }}>
            <span style={{ textDecoration: 'line-through' }}>{BRL(l.fipe_price)}</span>{' '}
            <span style={{ color: discount > 0 ? '#2e9e44' : '#d93025', fontWeight: 600 }}>
              FIPE {BRL(l.fipe_price)}
              {discount != null ? ` · ${discount > 0 ? '−' : '+'}${Math.abs(discount)}%` : ''}
            </span>
          </div>
        )}

        <a
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: 'inherit', textDecoration: 'none' }}
        >
          {l.brand} {l.model} {l.version || ''} ↗
        </a>

        <div style={{ fontSize: 13, color: '#666' }}>
          {l.year ?? '—'} · {l.title || ''}
          {l.plate ? (
            <>
              {' · '}
              <span
                style={{
                  background: '#eef2ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: '#3730a3',
                  fontSize: 12,
                }}
              >
                {l.plate}
              </span>
            </>
          ) : null}
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

        {/* ações: favorito + whatsapp + consulta */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4, flexWrap: 'wrap' }}>
          <FavoriteButton id={l.id} initial={l.favorite} />
          <a
            href={l.plate ? `/consultar?placa=${l.plate}` : '/consultar'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: '#002f51',
              color: '#fff',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            🔍 Consultar
          </a>
          {l.phone && <WhatsAppButton phone={l.phone} title={`${l.brand} ${l.model} ${l.version || ''}`} />}
        </div>
      </div>
    </div>
  );
}

export default Card;
