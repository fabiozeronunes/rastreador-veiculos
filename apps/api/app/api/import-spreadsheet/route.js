import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const VALID_EXTENSIONS = ['.csv', '.txt', '.xlsx', '.xls'];

// Aliases: todo nome possível -> campo canonical
const FIELD_ALIASES = {
  brand: ['brand', 'marca', 'marca_do_veiculo', 'fabricante'],
  model: ['model', 'modelo', 'nome_do_modelo', 'versao'],
  year: ['year', 'ano', 'ano_do_modelo', 'ano_modelo'],
  price: ['price', 'preco', 'valor', 'valor_venda'],
  fipe_price: ['fipe_price', 'fipe', 'valor_fipe', 'preco_fipe'],
  discount_pct: ['discount_pct', 'desconto', 'percentual_desconto', 'desconto_pct'],
  plate: ['plate', 'placa', 'numero_placa'],
  phone: ['phone', 'telefone', 'whatsapp', 'celular'],
  image: ['image', 'foto', 'url_imagem', 'url_imagem_do_veiculo'],
  title: ['title', 'titulo', 'nome_do_veiculo', 'descricao'],
};

// Mapear campo canonical -> primeiro nome possível (para usar como chave)
const FIELD_FIRST_NAME = {
  brand: 'brand',
  model: 'model',
  year: 'year',
  price: 'price',
  fipe_price: 'fipe_price',
  discount_pct: 'discount_pct',
  plate: 'plate',
  phone: 'phone',
  image: 'image',
  title: 'title',
};

// Função para obter o campo canonical a partir do nome da coluna
function getFieldIndex(headerName) {
  const normalized = headerName.trim().toLowerCase();
  const aliases = FIELD_ALIASES[normalized];
  return aliases ? aliases[0] : normalized;
}

// Função para parsear arquivo CSV
async function parseCSVFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  if (lines.length === 0) return [];

  // Primeira linha é header
  const headers = lines[0].split(',').map(h => h.trim());
  columnIndices = {};

  for (let i = 0; i < headers.length; i++) {
    const mapped = getFieldIndex(headers[i]);
    columnIndices[mapped] = i;
  }

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());

    const record = {};
    // Campos obrigatórios ou importantes
    for (const field of ['brand', 'model', 'year', 'price']) {
      const idx = columnIndices[field];
      record[field] = idx !== undefined ? values[idx] : null;
    }

    // Campos opcionais
    for (const field of ['fipe_price', 'discount_pct', 'plate', 'phone', 'image', 'title', 'version']) {
      const idx = columnIndices[field];
      record[field] = idx !== undefined ? values[idx] : null;
    }

    // Only add if has at least brand or model
    if (record.brand || record.model) {
      records.push(record);
    }
  }

  return records;
}

// Função para parsear arquivo TXT
async function parseTXTFile(filePath, delimiter=',') {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  if (lines.length === 0) return [];

  // Primeira linha é header
  const headers = lines[0].split(delimiter).map(h => h.trim());
  columnIndices = {};

  for (let i = 0; i < headers.length; i++) {
    const mapped = getFieldIndex(headers[i]);
    columnIndices[mapped] = i;
  }

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim());

    const record = {};
    for (const field of ['brand', 'model', 'year', 'price']) {
      const idx = columnIndices[field];
      record[field] = idx !== undefined ? values[idx] : null;
    }

    for (const field of ['fipe_price', 'discount_pct', 'plate', 'phone', 'image', 'title', 'version']) {
      const idx = columnIndices[field];
      record[field] = idx !== undefined ? values[idx] : null;
    }

    if (record.brand || record.model) {
      records.push(record);
    }
  }

  return records;
}

// Função para parsear arquivo Excel (fallback para CSV)
async function parseExcelFile(filePath) {
  try {
    const { parse } = require('xlsx');
    const workbook = parse(fs.readFileSync(filePath));
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const records = require('xlsx').utils.sheet_to_json(worksheet);

    // Mapear para nossos campos
    return records.map(record => {
      const mapped = {};
      for (const [key, value] of Object.entries(record)) {
        const canonical = getFieldIndex(key);
        mapped[canonical] = value;
      }
      return mapped;
    }).filter(r => r.brand || r.model);
  } catch (e) {
    console.log('Excel parse falhou, usando CSV fallback:', e.message);
    return parseCSVFile(filePath);
  }
}

function generateIdFromData(record) {
  // Gera ID único baseado nos dados do veículo
  const hashInput = `${record.brand || ''}-${record.model || ''}-${record.year || ''}-${record.price || ''}`;
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 20);
}

async function handler(request) {
  try {
    const data = await request.formData();
    const file = data.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 });
    }

    // Validar extensão
    const fileName = file.fileName || '';
    const ext = path.extname(fileName).toLowerCase();

    if (!VALID_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Extensão inválida. Use: ${VALID_EXTENSIONS.join(', ')}` }, { status: 400 });
    }

    // Salvar arquivo temporariamente
    const tempDir = path.join(process.cwd(), 'tmp_import');
    fs.mkdirSync(tempDir, { recursive: true });

    // Ler buffer do arquivo
    const buffer = await file.arrayBuffer();
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    let records;

    // Parse baseado no tipo
    if (ext === '.csv' || ext === '.txt') {
      // Tenta detectar delimitador
      const firstLine = fs.readFileSync(filePath, 'utf-8').split('\n')[0];
      const hasSemicolon = firstLine.includes(';') && !firstLine.includes(',');
      const hasTab = firstLine.includes('\t');

      if (hasTab) {
        records = await parseTXTFile(filePath, '\t');
      } else if (hasSemicolon) {
        records = await parseTXTFile(filePath, ';');
      } else {
        records = await parseCSVFile(filePath);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      records = await parseExcelFile(filePath);
    } else {
      return NextResponse.json({ error: 'Formato de arquivo não suportado' }, { status: 400 });
    }

    if (!records || records.length === 0) {
      // Limpar temp file
      try { fs.unlinkSync(filePath); } catch {}
      return NextResponse.json({ error: 'Nenhum registro encontrado no arquivo' }, { status: 400 });
    }

    // Importar para o banco
    const { getDb } = await import('@rv/db');
    const db = getDb();

    const imported = [];
    const errors = [];
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    for (const record of records) {
      try {
        // Gerar ID único
        const id = generateIdFromData(record);

        // Verificar se já existe
        const existing = db.prepare('SELECT id FROM listing WHERE id = ?').get(id);
        if (existing) {
          imported.push({ id, existing: true, message: 'Já estava no sistema' });
          continue;
        }

        // Montar dados para INSERT
        const dbFields = {
          id,
          source_id: 'import_spreadsheet',
          external_id: id,
          url: '',
          title: record.title || `${record.brand} ${record.model} ${record.year || ''}`.trim(),
          brand: record.brand || null,
          model: record.model || null,
          version: record.version || null,
          year: record.year ? parseInt(record.year, 10) : null,
          price: record.price ? parseFloat(record.price.replace(/[R$\s.,]/g, '').replace(',', '.')) : null,
          fipe_price: record.fipe_price ? parseFloat(record.fipe_price.replace(/[R$\s.,]/g, '').replace(',', '.')) : null,
          discount_pct: record.discount_pct ? parseInt(record.discount_pct, 10) : null,
          auction_ends_at: null,
          status: 'active',
          first_seen_at: now,
          last_seen_at: now,
          raw: JSON.stringify({ source: 'import_spreadsheet', original_data: record }),
          image: record.image || null,
          phone: record.phone || null,
          plate: record.plate || null,
        };

        // Verificar se tem pelo menos brand ou model com ano/price preenchidos
        if (!dbFields.brand && !dbFields.model) {
          errors.push({ row: imported.length + 1, reason: 'Faltando marca ou modelo' });
          continue;
        }

        db.prepare(
          `INSERT INTO listing
             (id, source_id, external_id, url, title, brand, model, version, year,
              price, auction_ends_at, status, first_seen_at, last_seen_at, raw, image, phone, plate)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          'import_spreadsheet',
          id,
          '',
          dbFields.title,
          dbFields.brand,
          dbFields.model,
          dbFields.version,
          dbFields.year,
          dbFields.price,
          dbFields.auction_ends_at,
          now,
          now,
          now,
          JSON.stringify(dbFields.raw),
          dbFields.image,
          dbFields.phone,
          dbFields.plate
        );

        imported.push({ id, existing: false, record });
      } catch (e) {
        errors.push({ row: imported.length + 1, reason: e.message });
      }
    }

    // Limpar arquivo temporário
    try { fs.unlinkSync(filePath); } catch {}

    // Remover diretório tmp se vazio
    try {
      const tmpDir = path.join(process.cwd(), 'tmp_import');
      if (fs.readdirSync(tmpDir).length === 0) {
        fs.rmdirSync(tmpDir);
      }
    } catch {}

    return NextResponse.json({
      success: true,
      totalRecords: records.length,
      imported: imported.length,
      errors: errors.length,
      importedList: imported.map(i => ({ id: i.id, brand: i.record.brand, model: i.record.model, year: i.record.year })),
      errorDetails: errors.map(e => ({ row: e.row, reason: e.reason })),
      message: `${imported.length} veículos importados${errors.length > 0 ? ', ' + errors.length + ' erros' : ''}`
    });

  } catch (error) {
    console.error('Erro no endpoint import-spreadsheet:', error);
    return NextResponse.json({ error: 'Erro interno: ' + error.message }, { status: 500 });
  }
}

export { handler as GET, handler as POST };