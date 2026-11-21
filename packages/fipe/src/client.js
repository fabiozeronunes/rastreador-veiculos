// Cliente da API FIPE (parallelum.com.br) — não oficial.
// Todo dado é cacheado localmente no SQLite pra nunca depender da API em runtime.

const BASE = process.env.FIPE_API_BASE || 'https://parallelum.com.br/fipe/api/v1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, { retries = 3, delay = 400 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${path}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      await sleep(delay * (i + 1));
    }
  }
  throw lastErr;
}

export const fipe = {
  brands: () => get('/carros/marcas'),
  models: (brandCode) => get(`/carros/marcas/${brandCode}/modelos`),
  years: (brandCode, modelCode) =>
    get(`/carros/marcas/${brandCode}/modelos/${modelCode}/anos`),
  price: (brandCode, modelCode, yearCode) =>
    get(`/carros/marcas/${brandCode}/modelos/${modelCode}/anos/${yearCode}`),
};

export default fipe;
