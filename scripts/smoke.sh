#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE_URL:-http://localhost:8080/api/v1}"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT

echo '1. Health'
curl -fsS "$BASE/health"
echo
echo '2. Categorias'
curl -fsS "$BASE/categories" | head -c 200
echo
echo '3. Criando relato'
HTTP="$(curl -sS -o "$TMP" -w '%{http_code}' -F 'category=lixo' -F 'latitude=-23.55' -F 'longitude=-46.63' -F 'description=Teste do MVP' "$BASE/reports")"
cat "$TMP"; echo
[ "$HTTP" = 201 ] || { echo "Falha: HTTP $HTTP"; exit 1; }
ID="$(node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1])).issue.id)' "$TMP")"
echo "4. Consultando ocorrência $ID"
curl -fsS "$BASE/issues/$ID"; echo
echo '5. Buscando no mapa'
curl -fsS "$BASE/issues?bbox=-47,-24,-46,-23" | head -c 300; echo
echo '6. Sessão administrativa ausente'
HTTP="$(curl -sS -o "$TMP" -w '%{http_code}' "$BASE/admin/session")"
[ "$HTTP" = 401 ] || { echo "Falha: HTTP $HTTP"; exit 1; }
echo '7. Lista pública com resolvidas'
curl -fsS "$BASE/issues?bbox=-47,-24,-46,-23&includeResolved=true" | head -c 300; echo
printf 'OK: smoke test concluído.\n'
