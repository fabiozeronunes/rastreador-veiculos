import { consultVehicle } from '../../lib/consult.js';
import PlateInput from '../components/PlateInput';

export const dynamic = 'force-dynamic';

const CHECK_LABELS = {
  multa: 'Multa / débitos',
  ipva: 'IPVA',
  leilao: 'Oferta em leilão',
  monta: 'Monta / sinistro',
  gravame: 'Gravame',
  roubo: 'Roubo e furto',
  recall: 'Recall',
};

const STATUS_STYLE = {
  ok: { bg: '#e6f4ea', color: '#1e7e34', text: '✅ Sem pendência' },
  restricted: { bg: '#fdecea', color: '#c5221f', text: '⚠️ Com pendência' },
  unconfigured: { bg: '#f1f3f4', color: '#5f6368', text: '⚙️ Não configurado' },
  unknown: { bg: '#fef7e0', color: '#b06000', text: '❓ Sem dado' },
};

function Badge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.unknown;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        fontWeight: 700,
        fontSize: 13,
        padding: '4px 10px',
        borderRadius: 12,
        whiteSpace: 'nowrap',
      }}
    >
      {s.text}
    </span>
  );
}

export default async function ConsultarPage({ searchParams }) {
  const plate = (searchParams?.placa || '').toUpperCase().trim();
  const uf = (searchParams?.uf || '').toUpperCase().trim();
  const run = searchParams?.placa ? await consultVehicle(plate, uf) : null;

  const ufs = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', background: '#f5f5f5', minHeight: '100vh' }}>
      <header style={{ background: '#002f51', color: '#fff', padding: '16px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>🔍 Consulta veicular</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            FIPE por placa · multa · monta · leilão · IPVA · gravame
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        {/* formulário */}
        <form
          method="GET"
          action="/consultar"
          style={{
            background: '#fff',
            border: '2px solid #e6e6e6',
            borderRadius: 12,
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          <label style={{ fontSize: 15, fontWeight: 700, color: '#002f51', display: 'block' }}>
            🚗 Placa do veículo
            <div style={{ marginTop: 6 }}>
              <PlateInput defaultValue={plate} />
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 6, fontWeight: 400 }}>
              Formato Mercosul (ABC1D23) ou antigo (ABC1234)
            </div>
          </label>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#333', flex: 1 }}>
              UF (opcional — ativa links do Detran)
              <select
                name="uf"
                defaultValue={uf}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #ccc',
                  borderRadius: 6,
                  fontSize: 15,
                  boxSizing: 'border-box',
                  background: '#fff',
                }}
              >
                <option value="">—</option>
                {ufs.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              style={{
                background: '#ff5c00',
                color: '#fff',
                border: 0,
                borderRadius: 10,
                padding: '14px 32px',
                fontSize: 17,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(255,92,0,.3)',
              }}
            >
              🔍 Consultar
            </button>
          </div>
        </form>

        {/* resultado */}
        {run && !run.ok && (
          <div
            style={{
              background: '#fdecea',
              border: '1px solid #f5c6cb',
              color: '#c5221f',
              borderRadius: 8,
              padding: 16,
              marginTop: 16,
              fontWeight: 600,
            }}
          >
            {run.error}
          </div>
        )}

        {run && run.ok && (
          <>
            {/* FIPE */}
            <section
              style={{
                background: '#fff',
                border: '1px solid #e6e6e6',
                borderRadius: 8,
                padding: 16,
                marginTop: 16,
              }}
            >
              <h2 style={{ fontSize: 16, margin: '0 0 8px', color: '#002f51' }}>
                🚗 FIPE por placa <span style={{ fontWeight: 400, color: '#888' }}>({run.plate})</span>
              </h2>
              {run.fipe.ok ? (
                <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                  <strong>{run.fipe.brand} {run.fipe.model}</strong> {run.fipe.version || ''}
                  <br />
                  Ano: {run.fipe.year || '—'} · Código FIPE: {run.fipe.fipeCode || '—'}
                </div>
              ) : (
                <div style={{ fontSize: 14, color: '#888' }}>
                  FIPE por placa indisponível agora ({run.fipe.error}). Consulte manual em{' '}
                  <a href="https://placas.fipe.org.br" target="_blank" rel="noopener noreferrer">
                    placas.fipe.org.br
                  </a>
                  .
                </div>
              )}
            </section>

            {/* checks */}
            <section
              style={{
                background: '#fff',
                border: '1px solid #e6e6e6',
                borderRadius: 8,
                padding: 16,
                marginTop: 16,
              }}
            >
              <h2 style={{ fontSize: 16, margin: '0 0 12px', color: '#002f51' }}>
                📋 Situação do veículo
              </h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {Object.keys(CHECK_LABELS).map((key) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: '#fafafa',
                      borderRadius: 6,
                      border: '1px solid #f0f0f0',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{CHECK_LABELS[key]}</span>
                    <Badge status={run.checks[key]} />
                  </div>
                ))}
              </div>

              {run.provider === 'unconfigured' && (
                <div
                  style={{
                    marginTop: 14,
                    background: '#fff8e1',
                    border: '1px solid #ffe082',
                    borderRadius: 6,
                    padding: 12,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  <strong>💡 Como ativar dados reais:</strong> {run.providerHowto}
                  <br />
                  <a href={run.providerManualUrl} target="_blank" rel="noopener noreferrer">
                    Consultar manualmente no CheckAuto →
                  </a>
                </div>
              )}
            </section>

            {/* Detran */}
            <section
              style={{
                background: '#fff',
                border: '1px solid #e6e6e6',
                borderRadius: 8,
                padding: 16,
                marginTop: 16,
              }}
            >
              <h2 style={{ fontSize: 16, margin: '0 0 8px', color: '#002f51' }}>
                🏛️ Consultas manuais (grátis)
              </h2>
              {run.detran.manual ? (
                <div style={{ fontSize: 14, color: '#888' }}>
                  Selecione a UF acima para receber os links do Detran.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <a
                    href={run.detran.multa}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkBtn('#00a0af')}
                  >
                    Multas Detran-{run.detran.uf}
                  </a>
                  <a
                    href={run.detran.ipva}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkBtn('#7b2ff7')}
                  >
                    IPVA {run.detran.uf}
                  </a>
                  <a
                    href="https://www.gov.br/pt-br/servicos/consultar-restricoes-de-veiculo"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkBtn('#2e9e44')}
                  >
                    Restrições (SENATRAN)
                  </a>
                </div>
              )}
            </section>

            <div style={{ fontSize: 12, color: '#999', marginTop: 16 }}>
              Consultado em {new Date(run.checkedAt).toLocaleString('pt-BR')} ·
              FIPE placa: grátis · CheckAuto: serviço pago de terceiros
            </div>
          </>
        )}

        {!run && (
          <div
            style={{
              background: '#fff',
              border: '1px dashed #ccc',
              borderRadius: 8,
              padding: 40,
              textAlign: 'center',
              color: '#777',
              marginTop: 16,
            }}
          >
            <div style={{ fontSize: 36 }}>🔎</div>
            <div style={{ fontWeight: 600, marginTop: 8 }}>
              Digite a placa para consultar
            </div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              FIPE (grátis) · multa · monta · leilão · IPVA · gravame
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function linkBtn(color) {
  return {
    display: 'inline-block',
    background: color,
    color: '#fff',
    textDecoration: 'none',
    borderRadius: 6,
    padding: '9px 14px',
    fontSize: 14,
    fontWeight: 700,
  };
}
