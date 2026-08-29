# Integración con la cámara Sony

## Corrección de compatibilidad

La ZV-E10 original **no está soportada por el Camera Remote SDK de Sony**.

La lista oficial de cuerpos compatibles incluye la **ZV-E1** y la **ZV-E10 II**
(también llamada ZV-E10M2). La ZV-E10 II es una cámara distinta de la ZV-E10:
comparten casi el nombre y nada más a efectos de control remoto. Comprobarlo
antes de escribir código ahorra semanas.

Referencia: <https://support.d-imaging.sony.co.jp/app/sdk/en/index.html>

**Creators' App** tampoco cubre la ZV-E10 original.

Lo que sí aplica a este cuerpo es **Imaging Edge Mobile**, que tiene
transferencia automática al smartphone en segundo plano. Esa es la única vía
soportada, y es la que usa esta arquitectura.

### Qué queda descartado, y por qué

| Descartado | Razón |
|---|---|
| Helper nativo en C++ sobre el Camera Remote SDK | El SDK no reconoce el cuerpo. El helper no tendría cámara con la que hablar. |
| Control remoto del disparo desde el backend | Depende del mismo SDK. |
| Creators' App como transporte | No soporta la ZV-E10 original. |

Esto es específico del modelo. Si algún día el parque de cámaras pasa a ZV-E1 o
ZV-E10 II, el SDK vuelve a estar sobre la mesa y el helper nativo se puede
retomar: nada de lo que hay aquí lo impide.

## Arquitectura actual

El operador ya no lleva portátil al evento. La cadena es:

```
ZV-E10
  └─ Wi-Fi ─→ Imaging Edge Mobile (transferencia automática en segundo plano)
       └─→ galería del celular
            └─ el operador comparte ─→ PWA "AdVibe Capture"  (Web Share Target)
                 └─ cola en IndexedDB ─→ POST /api/ingest
                      └─→ Sharp + sello de marca ─→ galería pública (SSE)
                           └─→ QR del evento
```

El límite es importante: **la foto llega a la galería del celular por Imaging
Edge Mobile, y ahí termina la parte de Sony**. Nuestro código no habla con la
cámara, no descubre la cámara y no tiene ninguna API de Sony enlazada. Solo
recibe archivos que el sistema operativo le entrega por el Web Share Target.

## El bridge de portátil

`apps/bridge` **no existe en este repositorio**. El MVP anterior que lo contenía
no llegó a este entorno, y no se ha reconstruido: era la vía para el Camera
Remote SDK, que en esta cámara no aplica.

Su único papel que seguía siendo útil —poder probar el backend sin celular ni
cámara— lo cubre `tools/mock-ingest.mjs`, que habla el mismo contrato de ingest.

Si en el futuro hay un modo portátil (con una cámara que el SDK sí soporte), el
contrato de ingest ya está definido y versionado más abajo: un bridge nuevo solo
tendría que hablarlo.

## Contrato de ingest v1

Es el punto de acoplamiento entre cualquier cliente (PWA, mock, un futuro
bridge) y el backend. Cambiarlo rompe a todos a la vez.

```
POST /api/ingest
Authorization: Bearer <token del evento>
Content-Type: multipart/form-data

  photo           File    requerido   jpeg | png | webp | heic, <= 25 MB
  idempotencyKey  string  requerido   uuid generado AL ENCOLAR
  clientId        string  requerido   uuid estable por dispositivo
  capturedAt      string  opcional    ISO-8601

200 { ok:true, duplicate:boolean, photo:{ id, url, thumbUrl, width, height, createdAt } }
401 { ok:false, error:"invalid_token" }
413 { ok:false, error:"too_large" }
415 { ok:false, error:"unsupported_type" | "unreadable_image" }
422 { ok:false, error:"missing_field", field:string }
```

`idempotencyKey` es lo que hace segura la cola offline. Se fija cuando la foto
entra en la cola y no cambia entre reintentos: si la respuesta se pierde por red
y el cliente reenvía, el servidor devuelve la foto original con
`duplicate:true` en vez de crear un duplicado.

Los códigos 400, 401, 413, 415 y 422 se tratan como definitivos en el cliente:
reintentarlos no los va a arreglar. Todo lo demás se reintenta con espera
creciente.

## El QR

El QR es **del evento, no de cada foto**. Apunta a `/g/<slug>`, la galería
completa, y no cambia en toda la noche. La PWA lo muestra a pantalla completa
con un botón para enseñárselo al cliente en la mano.
