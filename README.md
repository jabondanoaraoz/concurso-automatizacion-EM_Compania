# EM-Pedidos

Plataforma de **cotización y pedidos** para **E.M. Compañía S.A.S** (sellos mecánicos, capacitores
y refrigeración), integrada a **World Office Cloud**. El vendedor cotiza, aplica el descuento del
cliente y genera un pedido que llega en tiempo real a contabilidad y a World Office, listo para
facturar con un clic.

> **Concurso Aztec.** World Office no ofrece sandbox público: su API solo opera contra la cuenta
> real del cliente. Por eso la plataforma corre con `WO_MODE=mock`, que **valida el mismo payload**
> y simula respuestas de éxito/error. El paso a producción es cambiar **un flag** (`WO_MODE=live`)
> y poblar los IDs reales del tenant — sin tocar el resto de la app. Ver
> [`docs/integracion-world-office.md`](docs/integracion-world-office.md).

---

## Qué incluye

- **3 roles** con paneles propios y RLS estricto: **vendedor**, **contable**, **administrador**.
- **Búsqueda dual** sin IA (código + texto completo + similitud) sobre 150 SKUs de muestra.
- **Cotizador**: cliente → descuento → carrito → confirmar pedido (consecutivo atómico + idempotencia).
- **WorldOfficeAdapter** (anti-corruption layer) con modo `mock | live`, mapeo campo a campo,
  12 errores documentados, validación y `idempotency_key`.
- **Panel contable** en tiempo real (Supabase Realtime), con descarga de **PDF / JSON / CSV** y
  acción **facturar**.
- **Panel admin**: usuarios, parámetros de empresa, descuentos por cliente y catálogo.
- **Notificación por correo** (Gmail vía Composio) al confirmar pedido — *envío real verificado*.
- **Flujos n8n** del camino crítico (con reintentos e idempotencia) + agente + refresh de token.
- **Agente de búsqueda** ("Asistente") que reinterpreta consultas ambiguas — **solo sugiere**.
- **Instructivo dentro de la app** (menú **Ayuda**): manual de uso para los 3 roles + documentación
  técnica de World Office (solo admin), con descarga a PDF. Se genera desde los mismos `docs/*.md`.

## Stack

Next.js (App Router) en **Vercel** · **Supabase** (Postgres + Auth + RLS, `pg_trgm`/FTS/`pgvector`) ·
**n8n** (camino crítico + agente) · **Gmail vía Composio** · PDFs con `@react-pdf/renderer`.
Tipografías Outfit + DM Sans; accent de marca `#CC3527`.

## Estructura

```
em-pedidos/
├─ apps/web/                 # Next.js (App Router) — paneles por rol
│  ├─ app/(auth)/login/      # login
│  ├─ app/vendedor|contable|admin/   # paneles por rol (guards + RLS)
│  ├─ app/api/               # wrappers para n8n (adapter, notificación) + PDF
│  └─ lib/worldoffice/       # adapter (types, errors, mapping, mock, live)
├─ supabase/
│  ├─ migrations/            # esquema (sección 4) + RLS (sección 5) + funciones
│  └─ seed/                  # generador de catálogo (150 SKUs)
├─ n8n/workflows/            # crearPedido, refreshToken, notificacion, agente (JSON)
├─ docs/                     # integración WO + manual onboarding + preguntas cliente
├─ tokens.css                # tokens de marca E.M.
└─ EM-Pedidos_Build-Spec.md  # contrato de construcción (PRD)
```

## Correr en local

```bash
cd apps/web
npm install
cp ../../.env.example .env.local   # completar las variables (ver abajo)
npm run dev                        # http://localhost:3000

npm run test        # 31 tests del núcleo World Office (vitest)
npm run typecheck   # tsc --noEmit
npm run build       # build de producción
```

Login por rol (usuarios de demostración; contraseñas las entrega el administrador):
`vendedor@empedidos.co` · `contable@empedidos.co` · `admin@empedidos.co`.

## Variables de entorno

Mínimas para correr en mock (ver `.env.example` para el resto):

```bash
NEXT_PUBLIC_SUPABASE_URL=        # https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # clave anon (pública)
SUPABASE_SERVICE_ROLE_KEY=       # solo servidor (crear usuarios, n8n)
WO_MODE=mock                     # mock | live
```

Opcionales: `COMPOSIO_API_KEY` (envío de correo autónomo desde la app),
`N8N_WEBHOOK_CREAR_PEDIDO` + `N8N_SHARED_SECRET` (delegar el camino crítico a n8n).

## Qué es real / qué es mock

| Real (construido y probado) | Mock (se enciende con un flag) |
|---|---|
| Modelo de datos, RLS por rol, búsqueda dual, 3 paneles | La conexión **viva** a World Office |
| Armado determinista del payload + mapeo campo a campo | El mock valida el **mismo** esquema |
| Idempotencia (consecutivo atómico + `idempotency_key`) | El mock simula éxito/error/duplicado |
| Auditoría (`wo_payload`, `wo_response`, `sync_logs`) | — |
| PDF/JSON/CSV, panel realtime, flujos n8n | — |
| Notificación Gmail (Composio) — **envío real verificado** | — |

Pasar a producción: `WO_MODE=live` + IDs reconciliados + `refreshToken` activo. **Nada más.**

## Estado de validación

Ronda de validación integral (2026-06-29) — detalle en
[`docs/VALIDACION-REQUERIMIENTOS.md`](docs/VALIDACION-REQUERIMIENTOS.md) y
[`docs/GUIA-PRUEBAS.md`](docs/GUIA-PRUEBAS.md).

| Área | Estado |
|---|---|
| Estática (typecheck · build · lint) | ✅ verde |
| Tests automatizados (vitest, núcleo WO: mapeo, validación, idempotencia, errores) | ✅ 31 tests |
| Base de datos (9 tablas + RLS, 150 SKUs con embeddings, RLS de escritura por rol) | ✅ verificado |
| E2E en vivo (login 3 roles, guard de rol, cotizar→confirmar, PDF, contable, facturar) | ✅ |
| Manejo de error WO (pedido→`pendiente_sync` + `sync_logs`) | ✅ verificado |
| Matriz de requerimientos vs Build Spec | ✅ sin faltantes |
| Búsqueda semántica (embeddings sobre descripción + familia + atributos) | ✅ con 1 nota* |

\* La búsqueda semántica (opcional, **solo sugiere**) responde bien para la mayoría de consultas;
algunas (las que contienen "empaque") caen a la búsqueda léxica en la demo por un fallo de
`embedQuery` en el runtime de Vercel — documentado en `docs/VALIDACION-REQUERIMIENTOS.md`. La
búsqueda determinista (código/descripción) cubre el caso. No bloqueante.

## Documentos

- [`docs/GUION-DEMO.md`](docs/GUION-DEMO.md) — guion de demo + respuestas punto por punto al feedback del jurado.
- [`docs/integracion-world-office.md`](docs/integracion-world-office.md) — plan de integración API (el que más pesa).
- [`docs/manual-onboarding.md`](docs/manual-onboarding.md) — guía de uso para E.M. (no técnica).
- [`docs/PREGUNTAS-CLIENTE.md`](docs/PREGUNTAS-CLIENTE.md) — supuestos abiertos a confirmar con WO/E.M.
- [`docs/GUIA-PRUEBAS.md`](docs/GUIA-PRUEBAS.md) — guía de pruebas E2E con resultados de la última ronda.
- [`docs/VALIDACION-REQUERIMIENTOS.md`](docs/VALIDACION-REQUERIMIENTOS.md) — matriz de trazabilidad spec → implementación.
- [`n8n/README.md`](n8n/README.md) — import y wiring de los flujos.
- [`docs/pdf/`](docs/pdf/) — versiones en **PDF** (marca E.M.) del manual de uso y del plan de
  integración World Office, para enviar sin abrir la app. Se regeneran con `npm run gen:pdf`
  (desde `apps/web`) a partir de los mismos `docs/*.md`.
