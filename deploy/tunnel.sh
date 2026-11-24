#!/usr/bin/env bash
# Sobe o túnel Cloudflare e grava a URL pública em ~/.rastreador-url
set -u

URL_FILE="${HOME}/.rastreador-url"
LOG_FILE="${HOME}/.rastreador-tunnel.log"

: > "$LOG_FILE"

cloudflared tunnel --url http://localhost:3000 --no-autoupdate >> "$LOG_FILE" 2>&1 &
CF_PID=$!

# Espera o cloudflared imprimir a URL e a grava
for _ in $(seq 1 60); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_FILE" | tail -1)
  if [ -n "${URL:-}" ]; then
    printf '%s\n' "$URL" > "$URL_FILE"
    break
  fi
  kill -0 "$CF_PID" 2>/dev/null || break
  sleep 1
done

wait "$CF_PID"
