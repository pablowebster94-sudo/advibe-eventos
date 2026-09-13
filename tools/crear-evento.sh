#!/usr/bin/env bash
# Crea un evento en el backend desplegado y escupe token, galería y QR.
#
# Es el equivalente en terminal de la pantalla /nuevo, para cuando es más rápido
# teclear una línea que abrir el navegador.
#
#   ADMIN_TOKEN=xxx tools/crear-evento.sh "Fiesta del sábado"
#   ADMIN_TOKEN=xxx BASE=https://mi-backend.up.railway.app tools/crear-evento.sh "Boda Ana y Luis" boda-ana-luis
#
# Espera a que el deploy responda antes de crear: si acabas de mergear, no hace
# falta que adivines cuándo terminó Railway.

set -euo pipefail

BASE="${BASE:-https://backend-production-8a2a.up.railway.app}"
NOMBRE="${1:-}"
SLUG="${2:-}"
MARCA="${MARCA:-AdVibe}"

if [[ -z "${ADMIN_TOKEN:-}" ]]; then
  echo "falta ADMIN_TOKEN. Es la variable que configuraste en Railway." >&2
  echo "  ADMIN_TOKEN=xxx $0 \"Nombre del evento\"" >&2
  exit 1
fi

if [[ -z "$NOMBRE" ]]; then
  echo "falta el nombre del evento." >&2
  echo "  ADMIN_TOKEN=xxx $0 \"Fiesta del sábado\"" >&2
  exit 1
fi

# El deploy puede estar todavía construyendo: /nuevo solo existe si la versión
# con la creación de eventos ya está arriba.
printf 'esperando a %s ' "$BASE"
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "$BASE/nuevo"; then
    echo " listo"
    break
  fi
  printf '.'
  sleep 5
done

if ! curl -sf -o /dev/null "$BASE/nuevo"; then
  echo ""
  echo "el backend no responde en /nuevo." >&2
  echo "Si da 404, el deploy con la creación de eventos aún no está arriba." >&2
  exit 1
fi

cuerpo=$(
  NOMBRE="$NOMBRE" SLUG="$SLUG" MARCA="$MARCA" node -e '
    const { NOMBRE, SLUG, MARCA } = process.env;
    process.stdout.write(JSON.stringify({
      name: NOMBRE,
      slug: SLUG || undefined,
      brandName: MARCA || undefined,
    }));
  '
)

respuesta=$(
  curl -sS -X POST "$BASE/api/events" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$cuerpo"
)

echo "$respuesta" | node -e '
  let raw = "";
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      console.error("respuesta inesperada del servidor:\n" + raw);
      process.exit(1);
    }

    if (!body.ok) {
      const explica = {
        admin_not_configured:
          "el servidor no tiene ADMIN_TOKEN configurado: añádelo en Railway → Variables.",
        invalid_admin_token: "ADMIN_TOKEN no coincide con el del servidor.",
        slug_taken: "ya existe un evento con ese enlace: elige otro.",
        invalid_slug: "el enlace no es válido: minúsculas, números y guiones.",
        missing_field: "falta el nombre del evento.",
      };
      console.error("no se creó: " + (explica[body.error] ?? body.error));
      process.exit(1);
    }

    const e = body.event;
    console.log("");
    console.log("  evento : " + e.name);
    console.log("  TOKEN  : " + e.token + "   ← esto se escribe en la app del celular");
    console.log("  galería: " + e.galleryUrl);
    console.log("  QR     : " + e.qrUrl);
    console.log("");
    console.log("  El token se muestra una sola vez. Guárdalo.");
    console.log("");
  });
'
