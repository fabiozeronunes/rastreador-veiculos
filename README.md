# Rastreador de Oportunidades Veiculares

Aplicativo que rastreia na internet sites de leilão e repasses de veículos para encontrar oportunidades de compra e venda.

## Funcionalidades

- **Raspagem de fontes**: iCarros Leilão, Kavak, Mobiauto, Copart (via Playwright/Scrapfly)
- **Tabela FIPE**: Integração com API parallelum.com.br, cache local no SQLite
- **Motor de oportunidade**: Cálculo de desconto `(FIPE - preço) / FIPE * 100`
- **Alertas Telegram**: Notificação quando encontrar veículo com desconto ≥ threshold (padrão 30%)
- **Watchlist**: Salvando buscas por marca/modelo/ano/desconto mínimo
- **Dashboard**: (planeado) Interface web PWA para visualizar oportunidades

## Quick Start

```bash
# 1. Instalar dependências
npm install

# 2. Sincronizar base FIPE (download das marcas/modelos/anos/preços)
npm run fipe:sync

# 3. Configurar credenciais .env
cp .env.example .env
# Editar .env com TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID

# 4. Iniciar worker (raspagem + verificação + a cada 30 min)
npm start
```

## Comandos Telegram

| Comando | Descrição |
|---|---|
| `/watch Honda HR-V 2018 2020 30` | Salva busca: HR-V 2018/2020 com ≥30% abaixo da FIPE |
| `/lista` | Lista todas as buscas salvas |
| `/remover 1` | Remove busca de ID 1 |

## Estrutura

```
packages/
  db/          ← schema SQLite + migrações
  fipe/        ← cliente FIPE + sync + lookupPrice
  scrapers/    ← framework de fetchHtml (ordem: fetch → playwright → scrapfly → scrapingbee)
  bot/         ← bot Telegram + envio de alerta
  worker/      ← orquestrador (raspagem + cálculo + alertas)
```

## Fontes cadastradas

| ID | Nome | Kind | Status |
|---|---|---|---|
| icarr... | iCarros Leilão | auction | HTML aberto (redireciona catálogo) |
| kavak | Kavak | classified | Acesso direto |
| mobiauto | Mobiauto | classified | 310 mil ofertas |
| copart | Copart Brasil | auction | Incapsula — precisa Playwright/Scrapfly |
| plural | Leilão Plural | auction | 403 — proxy/Scrapfly necessário |

## Licença

Projeto pessoal — livre para estudo e adaptação.