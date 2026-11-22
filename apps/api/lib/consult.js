// Consulta veicular completa: 20 verificações + FIPE por placa + links Detran.
// Provider: CheckAuto (pago, via API key) ou manual.

const UF_DETTRAN = {
  AC: 'https://www.detran.ac.gov.br',
  AL: 'https://www.detran.al.gov.br',
  AM: 'https://www.detran.am.gov.br',
  AP: 'https://www.detran.ap.gov.br',
  BA: 'https://www.detran.ba.gov.br',
  CE: 'https://www.detran.ce.gov.br',
  DF: 'https://www.detran.df.gov.br',
  ES: 'https://www.detran.es.gov.br',
  GO: 'https://www.detran.go.gov.br',
  MA: 'https://www.detran.ma.gov.br',
  MG: 'https://www.detran.mg.gov.br',
  MS: 'https://www.detran.ms.gov.br',
  MT: 'https://www.detran.mt.gov.br',
  PA: 'https://www.detran.pa.gov.br',
  PB: 'https://www.detran.pb.gov.br',
  PE: 'https://www.detran.pe.gov.br',
  PI: 'https://www.detran.pi.gov.br',
  PR: 'https://www.detran.pr.gov.br',
  RJ: 'https://www.detran.rj.gov.br',
  RN: 'https://www.detran.rn.gov.br',
  RO: 'https://www.detran.ro.gov.br',
  RR: 'https://www.detran.rr.gov.br',
  RS: 'https://www.detran.rs.gov.br',
  SC: 'https://www.detran.sc.gov.br',
  SE: 'https://www.detran.se.gov.br',
  SP: 'https://www.detran.sp.gov.br',
  TO: 'https://www.detran.to.gov.br',
};

const TIMEOUT = 8000;

// ---------- 20 verificações ----------
// Cada item: { key, label, category }
// category agrupa na tela: 'cadastral' | 'restricao' | 'debito' | 'historico' | 'leilao' | 'fipe'
export const CHECK_DEFS = [
  // Cadastro
  { key: 'dados_nacionais', label: 'Dados Cadastrais Nacionais', category: 'cadastral' },
  { key: 'dados_estaduais', label: 'Dados Cadastrais Estaduais', category: 'cadastral' },
  { key: 'decodificacao', label: 'Decodificação', category: 'cadastral' },
  { key: 'qtd_proprietarios', label: 'Quantidade Proprietário', category: 'cadastral' },
  { key: 'historico_consultas', label: 'Histórico de Consultas', category: 'cadastral' },

  // Restrições
  { key: 'restricoes_federais', label: 'Restrições Federais', category: 'restricao' },
  { key: 'restricoes_estaduais', label: 'Restrições Estaduais', category: 'restricao' },
  { key: 'gravame', label: 'Gravame', category: 'restricao' },

  // Débitos / Multas
  { key: 'debitos_multas', label: 'Débitos e Multas', category: 'debito' },
  { key: 'renainf', label: 'RENAINF (multas rodoviárias)', category: 'debito' },
  { key: 'renajud', label: 'RENAJUD (judiciais)', category: 'debito' },

  // Recall
  { key: 'recall_info', label: 'Informação de RECALL', category: 'recall' },
  { key: 'recall_pendente', label: 'Pendência de RECALL', category: 'recall' },

  // Histórico
  { key: 'roubo_furto', label: 'Histórico de Roubo e Furto', category: 'historico' },
  { key: 'indicio_sinistro', label: 'Indício de Sinistro', category: 'historico' },
  { key: 'historico_km', label: 'Histórico de KM', category: 'historico' },

  // Leilão
  { key: 'leilao_base1', label: 'Leilão - Base 1', category: 'leilao' },
  { key: 'leilao_base2', label: 'Leilão - Base 2', category: 'leilao' },
  { key: 'remarketing', label: 'Remarketing', category: 'leilao' },

  // FIPE
  { key: 'precificador_fipe', label: 'Precificador FIPE', category: 'fipe' },
];

export const CHECK_CATEGORIES = {
  cadastral: { label: '📋 Cadastro', color: '#00a0af' },
  restricao: { label: '⛔ Restrições', color: '#d93025' },
  debito: { label: '💰 Débitos e Multas', color: '#b06000' },
  recall: { label: '🔔 Recall', color: '#7b2ff7' },
  historico: { label: '📜 Histórico', color: '#002f51' },
  leilao: { label: '🔨 Leilão', color: '#ff5c00' },
  fipe: { label: '🏷️ FIPE', color: '#2e9e44' },
};

export function detranLinks(uf) {
  const u = (uf || '').toUpperCase();
  const detran = UF_DETTRAN[u];
  return {
    uf: u || null,
    detran: detran || null,
    ipva: u === 'SP' ? 'https://www.fazenda.sp.gov.br/sigeo_lei131/Paginas/consultaIpxa.aspx' : detran,
    multa: detran,
    manual: !detran,
  };
}

// ---------- FIPE por placa (grátis) ----------
export async function fipePlate(plate) {
  const url = process.env.FIPE_PLATE_URL || 'https://placas.fipe.org.br/api/plate/consult';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://placas.fipe.org.br',
        Referer: 'https://placas.fipe.org.br/',
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
      body: JSON.stringify({ plate }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return {
      ok: true,
      brand: data.brand || data.marca || null,
      model: data.model || data.modelo || null,
      version: data.version || data.versao || null,
      year: data.year || data.ano || null,
      fipeCode: data.fipeCode || data.codigo_fipe || null,
      raw: data,
    };
  } catch (e) {
    return { ok: false, error: e.name === 'TimeoutError' ? 'timeout' : String(e.message || e) };
  }
}

// ---------- CheckAuto (pago) ----------
export async function checkauto(plate) {
  const apiUrl = process.env.CHECKAUTO_API_URL;
  const apiKey = process.env.CHECKAUTO_API_KEY;
  if (!apiUrl || !apiKey) {
    return {
      ok: false,
      status: 'unconfigured',
      error: 'CHECKAUTO_API_URL/CHECKAUTO_API_KEY ausente',
      howto:
        'Crie conta em nova.checkauto.com.br, compre créditos e configure ' +
        'CHECKAUTO_API_URL + CHECKAUTO_API_KEY no .env para automação.',
      manualUrl: 'https://nova.checkauto.com.br/',
    };
  }
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ plate }),
      signal: AbortSignal.timeout(TIMEOUT * 3),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return normalizeCheckauto(data);
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

// Mapeia resposta do CheckAuto para nossas 20 chaves.
function normalizeCheckauto(d) {
  const pick = (...keys) => {
    for (const k of keys) {
      const v = k.split('.').reduce((o, p) => (o == null ? undefined : o[p]), d);
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  };

  const yes = (v) =>
    v === true || v === 1 || /^(sim|true|possui|consta|consta\/sim|com pendência|pendente)$/i.test(String(v));
  const no = (v) =>
    v === false || v === 0 || /^(nao|não|false|nenhum|nenhuma|sem|ok|regular|sem pendência|sem pendencia)$/i.test(String(v));

  const status = (v) => (yes(v) ? 'restricted' : no(v) ? 'ok' : v == null ? 'unknown' : 'unknown');
  const value = (v) => (v == null ? null : v);

  return {
    ok: true,
    checks: {
      // Cadastro
      dados_nacionais: status(pick('dadosCadastraisNacionais', 'nacionalData', 'cadastro.nacional')),
      dados_estaduais: status(pick('dadosCadastraisEstaduais', 'estadualData', 'cadastro.estadual')),
      decodificacao: status(pick('decodificacao', 'decoding', 'vin')),
      qtd_proprietarios: value(pick('quantidadeProprietarios', 'owners', 'proprietarios')),
      historico_consultas: value(pick('historicoConsultas', 'consultHistory', 'consultas')),

      // Restrições
      restricoes_federais: status(pick('restricoesFederais', 'federalRestrictions', 'restricao.federal')),
      restricoes_estaduais: status(pick('restricoesEstaduais', 'stateRestrictions', 'restricao.estadual')),
      gravame: status(pick('gravame', 'lien', 'alienacao')),

      // Débitos
      debitos_multas: status(pick('debitosMultas', 'fines', 'multas', 'debitos')),
      renainf: status(pick('renainf', 'renainfMultas', 'multasRodoviarias')),
      renajud: status(pick('renajud', 'renajudMultas', 'multasJudiciais')),

      // Recall
      recall_info: status(pick('recallInfo', 'recall', 'recallInformation')),
      recall_pendente: status(pick('recallPendente', 'recallPending', 'recall.pendente')),

      // Histórico
      roubo_furto: status(pick('rouboFurto', 'theft', 'roubo', 'furto')),
      indicio_sinistro: status(pick('indicioSinistro', 'salvage', 'sinistro', 'monta', 'accident')),
      historico_km: value(pick('historicoKm', 'kmHistory', 'km', 'odometer')),

      // Leilão
      leilao_base1: status(pick('leilaoBase1', 'auctionBase1', 'leilao.base1')),
      leilao_base2: status(pick('leilaoBase2', 'auctionBase2', 'leilao.base2')),
      remarketing: status(pick('remarketing', 'remarketingStatus')),

      // FIPE
      precificador_fipe: value(pick('precificadorFipe', 'fipePrice', 'fipe.price', 'valorFipe')),
    },
    raw: d,
  };
}

// ---------- Relatório completo ----------
export async function consultVehicle(plate, uf) {
  const clean = String(plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{3}\d{4}$/.test(clean) && !/^[A-Z]{3}\d[A-Z]\d{2}$/.test(clean)) {
    return { ok: false, error: 'Placa inválida (use ABC1D23 ou ABC1234)' };
  }

  const [fipe, hist, detran] = await Promise.all([
    fipePlate(clean),
    checkauto(clean),
    Promise.resolve(detranLinks(uf)),
  ]);

  // Monta checks com todas as 20 chaves
  const checks = {};
  const unconfigured = !hist.ok;
  for (const def of CHECK_DEFS) {
    if (!unconfigured && hist.checks && hist.checks[def.key] !== undefined) {
      checks[def.key] = hist.checks[def.key];
    } else {
      checks[def.key] = 'unconfigured';
    }
  }

  return {
    ok: true,
    plate: clean,
    fipe,
    checks,
    provider: hist.ok ? 'checkauto' : 'unconfigured',
    providerError: hist.ok ? null : hist.error,
    providerHowto: hist.howto || null,
    providerManualUrl: hist.manualUrl || null,
    detran,
    checkedAt: new Date().toISOString(),
  };
}
