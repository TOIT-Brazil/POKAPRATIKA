#!/bin/sh
set -eu

: "${VITE_API_URL:?VITE_API_URL precisa estar definida no serviço de frontend da Railway.}"

case "$VITE_API_URL" in
  https://*) ;;
  *) echo "VITE_API_URL precisa usar HTTPS em produção." >&2; exit 1 ;;
esac

case "$VITE_API_URL" in
  *localhost*|*127.0.0.1*|*0.0.0.0*) echo "VITE_API_URL não pode apontar para ambiente local em produção." >&2; exit 1 ;;
esac

escaped_api_url=$(printf '%s' "$VITE_API_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__POKA_PRATIKA_CONFIG__ = {
  VITE_API_URL: "$escaped_api_url"
};
EOF

exec nginx -g 'daemon off; error_log stderr warn;'
