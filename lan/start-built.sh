#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${YANYUAN_ADMIN_EMAILS:?请设置本机管理员邮箱}"
export HEZHI_BUILT=1 YANYUAN_LAN_AUTH=1 WRANGLER_SEND_METRICS=false
data="${YANYUAN_DATA_DIR:-$HOME/.local/share/yanyuan-lan}"
umask 077
mkdir -p "$data"
test -f "${YANYUAN_TLS_DIR:-$data}/server.crt" && test -f "${YANYUAN_TLS_DIR:-$data}/server.key" || { echo '请先配置网关 TLS 证书与密钥'; exit 1; }
test -f dist/server/index.js || npm run build
node --input-type=module <<'JS'
import fs from 'node:fs';
const config=JSON.parse(fs.readFileSync('dist/server/wrangler.json'));
config.d1_databases[0].migrations_dir='../../drizzle';
fs.writeFileSync('dist/server/lan.json',JSON.stringify(config));
JS
wrangler=(node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js)
cfg=(--config dist/server/lan.json --local --persist-to "$data/storage")
"${wrangler[@]}" d1 migrations apply DB "${cfg[@]}"
vars=()
if [[ -f "$data/worker.env" ]]; then vars=(--env-file "$data/worker.env"); fi
"${wrangler[@]}" dev "${cfg[@]}" "${vars[@]}" --ip 127.0.0.1 --port 5173 --inspector-port 0 &
backend=$!
gateway=''
trap 'kill "$backend" ${gateway:+"$gateway"} 2>/dev/null || true' EXIT
node lan/gateway.mjs &
gateway=$!
wait -n "$backend" "$gateway"
