'use client';

import { useState } from 'react';

export default function ImportPage() {
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const file = form.file.files[0];

    if (!file) {
      setStatus({ type: 'error', message: 'Selecione um arquivo' });
      return;
    }

    const allowedTypes = ['.csv', '.txt', '.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(ext)) {
      setStatus({ type: 'error', message: `Tipo inválido. Use: ${allowedTypes.join(', ')}` });
      return;
    }

    setStatus({ type: 'loading', message: 'Importando...' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/import-spreadsheet', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (res.ok) {
        setStatus({
          type: 'success',
          message: `${result.imported} veículos importados${result.errors > 0 ? ', ' + result.errors + ' erros' : ''}`,
        });
      } else {
        setStatus({ type: 'error', message: result.error || 'Erro desconhecido' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Erro de conexão: ' + err.message });
    }
  };

  return (
    <main style={mainStyle}>
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={h2Style}>📥 Importar Veículos</h2>
          <p style={pStyle}>
            Upload de planilha para adicionar múltiplos veículos de uma vez
          </p>

          <form onSubmit={handleSubmit} style={formStyle}>
            <div style={divStyle}>
              <label style={labelStyle}>Arquivo</label>
              <input
                type="file"
                name="file"
                accept=".csv,.txt,.xlsx,.xls"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              style={buttonStyle}
            >
              Importar
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

const mainStyle = {
  fontFamily: 'system-ui, sans-serif',
  background: '#f5f5f5',
  minHeight: '100vh',
  padding: '40px 20px',
};

const containerStyle = {
  maxWidth: 600,
  margin: '0 auto',
};

const cardStyle = {
  background: '#fff',
  border: '2px solid #e6e6e6',
  borderRadius: 12,
  padding: 32,
  textAlign: 'center',
};

const h2Style = {
  color: '#002f51',
  marginBottom: 16,
};

const pStyle = {
  color: '#666',
  marginBottom: 24,
  fontSize: 14,
};

const formStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const divStyle = {
  marginBottom: 16,
};

const labelStyle = {
  fontSize: 14,
  color: '#555',
  marginBottom: 8,
};

const inputStyle = {
  padding: '10px 16px',
  border: '1px solid #ccc',
  borderRadius: 6,
  fontSize: 14,
  cursor: 'pointer',
  background: '#f8fafc',
};

const buttonStyle = {
  background: '#ff5c00',
  color: '#fff',
  border: 0,
  borderRadius: 6,
  padding: '12px 24px',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
}