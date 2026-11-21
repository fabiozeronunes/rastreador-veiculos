"use strict";(()=>{var e={};e.id=877,e.ids=[877],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},7913:(e,T,t)=>{t.r(T),t.d(T,{originalPathname:()=>I,patchFetch:()=>f,requestAsyncStorage:()=>m,routeModule:()=>O,serverHooks:()=>X,staticGenerationAsyncStorage:()=>U});var a={};t.r(a),t.d(a,{GET:()=>R,POST:()=>_});var E=t(3036),r=t(5736),n=t(5262);let i=require("node:sqlite"),o=require("node:fs"),s=require("node:path"),d=require("node:url"),c=(0,s.dirname)((0,d.fileURLToPath)("file:///home/fabionunes/rastreador-veiculos/packages/db/src/index.js")),L=(0,s.resolve)(c,"../../../data/rastreador.db"),N=null,l=[`CREATE TABLE IF NOT EXISTS fipe_brand (
     code TEXT PRIMARY KEY,
     name TEXT NOT NULL
  )`,`CREATE TABLE IF NOT EXISTS fipe_model (
     brand_code TEXT NOT NULL,
     code TEXT NOT NULL,
     name TEXT NOT NULL,
     PRIMARY KEY (brand_code, code),
     FOREIGN KEY (brand_code) REFERENCES fipe_brand(code) ON DELETE CASCADE
  )`,`CREATE TABLE IF NOT EXISTS fipe_year (
     brand_code TEXT NOT NULL,
     model_code TEXT NOT NULL,
     code TEXT NOT NULL,
     name TEXT NOT NULL,
     PRIMARY KEY (brand_code, model_code, code),
     FOREIGN KEY (brand_code, model_code) REFERENCES fipe_model(brand_code, code) ON DELETE CASCADE
  )`,`CREATE TABLE IF NOT EXISTS fipe_price (
     brand_code TEXT NOT NULL,
     model_code TEXT NOT NULL,
     year_code TEXT NOT NULL,
     fipe_code TEXT NOT NULL,
     price REAL,
     ref_month TEXT,
     fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
     PRIMARY KEY (brand_code, model_code, year_code)
  )`,`CREATE TABLE IF NOT EXISTS source (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     kind TEXT NOT NULL,          -- 'auction' | 'classified' | 'repass'
     base_url TEXT NOT NULL,
     enabled INTEGER NOT NULL DEFAULT 1,
     strategy TEXT NOT NULL DEFAULT 'fetch',  -- fetch | playwright | scrapfly | scrapingbee
     meta_consecutive INTEGER NOT NULL DEFAULT 0,
     last_success_at TEXT,
     last_error TEXT,
     last_error_at TEXT
  )`,`CREATE TABLE IF NOT EXISTS listing (
     id TEXT PRIMARY KEY,              -- hash(source + external_id)
     source_id TEXT NOT NULL,
     external_id TEXT NOT NULL,
     url TEXT NOT NULL,
     title TEXT,
     brand TEXT,
     model TEXT,
     version TEXT,
     year INTEGER,
     price REAL,                       -- lance/pre\xe7o atual
     fipe_price REAL,
     discount_pct REAL,
     auction_ends_at TEXT,
     status TEXT NOT NULL DEFAULT 'active', -- active | ended | sold | removed
     first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
     last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
     notified INTEGER NOT NULL DEFAULT 0,
     raw TEXT,
     UNIQUE (source_id, external_id)
  )`,`CREATE TABLE IF NOT EXISTS watchlist (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     brand TEXT,
     model TEXT,
     year_min INTEGER,
     year_max INTEGER,
     discount_min REAL NOT NULL DEFAULT 30,
     max_price REAL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,`CREATE TABLE IF NOT EXISTS alert (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     listing_id TEXT NOT NULL,
     channel TEXT NOT NULL,            -- telegram | push
     sent_at TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE (listing_id, channel),
     FOREIGN KEY (listing_id) REFERENCES listing(id) ON DELETE CASCADE
  )`,`CREATE TABLE IF NOT EXISTS push_subscription (
     endpoint TEXT PRIMARY KEY,
     keys TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`];require("node:crypto");let u=process.env.FIPE_API_BASE||"https://parallelum.com.br/fipe/api/v1",p=e=>new Promise(T=>setTimeout(T,e));async function A(e,{retries:T=3,delay:t=400}={}){let a;for(let E=0;E<T;E++)try{let T=await fetch(`${u}${e}`,{headers:{accept:"application/json"},signal:AbortSignal.timeout(2e4)});if(!T.ok)throw Error(`HTTP ${T.status} em ${e}`);return await T.json()}catch(e){a=e,await p(t*(E+1))}throw a}async function R(e){let T=function(){if(N)return N;let e=process.env.DB_PATH||L;return(0,o.mkdirSync)((0,s.dirname)(e),{recursive:!0}),(N=new i.DatabaseSync(e)).exec("PRAGMA journal_mode = WAL;"),N.exec("PRAGMA foreign_keys = ON;"),function(e){for(let T of l)e.exec(T);e.prepare("PRAGMA table_info(source)").all().some(e=>"meta_consecutive"===e.name)||e.exec("ALTER TABLE source ADD COLUMN meta_consecutive INTEGER NOT NULL DEFAULT 0")}(N),N}();return new Response(JSON.stringify({watchlist:T.prepare("SELECT * FROM watchlist").all(),listings:T.prepare("SELECT * FROM listing WHERE status = ? ORDER BY last_seen_at DESC").all("active")}),{headers:{"Content-Type":"application/json"}})}async function _(e){let{brand:T,model:t,yearMin:a,yearMax:E,discountMin:r}=await e.json();return T&&t?new Response(JSON.stringify({ok:!0,id:db.prepare("INSERT INTO watchlist (brand, model, year_min, year_max, discount_min) VALUES (?, ?, ?, ?, ?)").run(T,t,a??null,E??null,r??30).lastID}),{headers:{"Content-Type":"application/json"}}):new Response("Missing params",{status:400})}let O=new E.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/watchlist/route",pathname:"/watchlist",filename:"route",bundlePath:"app/watchlist/route"},resolvedPagePath:"/home/fabionunes/rastreador-veiculos/apps/api/app/watchlist/route.js",nextConfigOutput:"",userland:a}),{requestAsyncStorage:m,staticGenerationAsyncStorage:U,serverHooks:X}=O,I="/watchlist/route";function f(){return(0,n.patchFetch)({serverHooks:X,staticGenerationAsyncStorage:U})}}};var T=require("../../webpack-runtime.js");T.C(e);var t=e=>T(T.s=e),a=T.X(0,[335],()=>t(7913));module.exports=a})();