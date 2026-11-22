'use client';

import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: '📋 Oportunidades', match: (p) => p === '/' },
  { href: '/consultar', label: '🔍 Consultar veículo', match: (p) => p.startsWith('/consultar') },
  { href: '/favoritos', label: '★ Favoritos', match: (p) => p.startsWith('/favoritos') },
  { href: '/importar', label: '📥 Importar Planilha', match: (p) => p.startsWith('/importar') },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        background: '#001a33',
        borderBottom: '1px solid rgba(255,255,255,.12)',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
        }}
      >
        {LINKS.map((l) => {
          const active = l.match(pathname || '/');
          return (
            <a
              key={l.href}
              href={l.href}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 700,
                padding: '12px 16px',
                borderBottom: active ? '3px solid #ff5c00' : '3px solid transparent',
                background: active ? 'rgba(255,92,0,.12)' : 'transparent',
                whiteSpace: 'nowrap',
              }}
            >
              {l.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
