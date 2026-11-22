'use client';

import { useState } from 'react';

// Formata placa Mercosul: ABC1D23 ou antiga ABC1234
function formatPlate(v) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

export default function PlateInput({ defaultValue }) {
  const [val, setVal] = useState(formatPlate(defaultValue || ''));

  return (
    <input
      name="placa"
      value={val}
      onChange={(e) => setVal(formatPlate(e.target.value))}
      placeholder="ABC1D23"
      maxLength={7}
      required
      autoComplete="off"
      spellCheck={false}
      style={{
        width: '100%',
        padding: '16px 20px',
        border: '2px solid #002f51',
        borderRadius: 10,
        fontSize: 32,
        fontWeight: 800,
        letterSpacing: '0.15em',
        fontFamily: "'Courier New', monospace",
        textAlign: 'center',
        textTransform: 'uppercase',
        color: '#002f51',
        background: '#f8fafc',
        boxSizing: 'border-box',
        outline: 'none',
        transition: 'border-color .15s, box-shadow .15s',
      }}
      onFocus={(e) => {
        e.target.style.borderColor = '#ff5c00';
        e.target.style.boxShadow = '0 0 0 3px rgba(255,92,0,.2)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = '#002f51';
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}
