# n8n — Flujos EM-Pedidos

Workflows deterministas del camino crítico y el agente. **Ninguno usa IA en el camino
crítico**; el agente solo sugiere. Todos los `wo_*` viajan vía el `WorldOfficeAdapter` de
la app (único conocedor del formato WO).

## Workflows (`workflows/`)
| Archivo | Disparador | Qué hace |
|---|---|---|
| `crearPedido.json` | Webhook `POST /crear-pedido` (recibe `{pedido_id}`) | Lee el pedido → POST al adapter (`/api/worldoffice/crear-pedido`) → IF éxito: marca `sincronizado_wo` + notifica; error: `pendiente_sync` + `sync_logs` + reintento. Reusa la misma `idempotency_key` (no duplica). |
| `refreshToken.json` | Cron cada 11 h | Renueva el JWT de WO (`gestionarTokenAPILicencia`). **Solo live.** |
| `notificacionContable.json` | Webhook `POST /notificacion-contable` | Sub-flujo reutilizable: dispara el correo (composer de la app + Composio Gmail). |
| `agenteBusqueda.json` | Webhook `POST /agente-busqueda` (`{query}`) | Normaliza (placeholder LLM) → `buscar_productos` en Supabase → devuelve candidatos. **Solo sugiere.** |

## Cómo importarlos
1. En n8n: **Workflows → Import from File** → seleccionar cada `.json`.
2. Quedan **inactivos**; activarlos tras configurar variables y credenciales.

## Variables de entorno en n8n (Settings → Variables / `$env`)
| Variable | Uso |
|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service_role (lectura/escritura de pedidos, sync_logs) |
| `APP_URL` | base del front Next (ej. URL de Vercel) |
| `N8N_SHARED_SECRET` | mismo valor que en la app; protege `/api/worldoffice/*` y `/api/notificaciones/*` |
| `WO_BASE_URL`, `WO_CORREO_REGISTRADO` | solo `refreshToken` (go-live) |

## Wiring del disparador (crearPedido)
La app, al confirmar un pedido, hace `POST` a `N8N_WEBHOOK_CREAR_PEDIDO` con `{pedido_id}`
**si esa variable está configurada** en la app (`.env.local`). Si no, la app sincroniza in-app
(mismo resultado determinista). Alternativa del spec: un Database Webhook de Supabase sobre
`insert` en `pedidos` con `estado='confirmado'`.

## Modo mock vs live
El endpoint `/api/worldoffice/crear-pedido` usa `getAdapter()`, que decide `mock|live` por
`WO_MODE` en la app. n8n no cambia: el mismo flujo sirve para concurso (mock) y producción (live).
