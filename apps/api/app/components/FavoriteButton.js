'use client';

import { useState } from 'react';

export default function FavoriteButton({ id, initial }) {
  const [fav, setFav] = useState(!!initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) setFav(!!data.favorite);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={fav ? 'Remover dos favoritos' : 'Favoritar'}
      title={fav ? 'Remover dos favoritos' : 'Favoritar'}
      style={{
        border: '1px solid #e6e6e6',
        background: fav ? '#fff3e0' : '#fff',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 16,
        cursor: 'pointer',
        lineHeight: 1,
        color: fav ? '#ff5c00' : '#999',
      }}
    >
      {fav ? '★' : '☆'}
    </button>
  );
}
