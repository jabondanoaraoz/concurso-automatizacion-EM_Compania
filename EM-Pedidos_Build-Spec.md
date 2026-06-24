# EM-Pedidos — Build Spec / PRD Técnico
**Plataforma de cotización y pedidos para E.M. Compañía S.A.S, integrada a World Office Cloud**
Versión 1.0 · Documento para construcción asistida (Claude Code) · Concurso Aztec

---

## 0. Cómo usar este documento (instrucciones para Claude Code)

Este es el contrato de construcción. Constrúyelo en fases (sección 14). Reglas no negociables:

1. **La IA nunca está en el camino crítico.** Solo el agente de búsqueda usa LLM, y únicamente *sugiere*. La creación de pedidos, el armado de payloads y el envío a World Office (WO) son 100% deterministas.
2. **Adapter con doble modo.** Toda llamada a WO pasa por `WorldOfficeAdapter` con `WO_MODE = mock | live`. En el concurso corre en `mock`; en producción se cambia el flag. La interfaz es idéntica en ambos modos.
3. **El código contable se conserva siempre.** Cada producto carga `wo_id_inventario` + `codigo_contable`; cada línea de cotización/pedido guarda un *snapshot* de ambos aunque el vendedor haya buscado por descripción.
4. **Idempotencia obligatoria** en la creación de pedidos (evita `DUPLICATE_KEY` de WO).
5. **Tokens de marca E.M.** (sección 11) en todo el front. Nada de azules/verdes genéricos.
6. Stack fijo: **Next.js (App Router) en Vercel + Supabase (Postgres/Auth/RLS) + n8n** para camino crítico y agente. Gmail vía **Composio**.

---

## 1. Contexto y objetivo

E.M. Compañía S.A.S (40 años, líder en Colombia en **sellos mecánicos, capacitores y artículos de refrigeración**) vende mediante 3 vendedores en calle. Hoy los pedidos se toman por WhatsApp (fotos/audios) → errores y re-digitación antes de facturar.

**Objetivo:** plataforma web cerrada (acceso interno, 3 roles) donde el vendedor cotiza, aplica el descuento del cliente y genera un pedido que llega en tiempo real a World Office Cloud vía API, listo para que contabilidad lo convierta en factura con un clic.

### Criterios de evaluación → cómo los atacamos

| Criterio (peso) | Estrategia en esta build |
|---|---|
| **Planteamiento integración API WO (el que más pesa)** | `WorldOfficeAdapter` con payload mapeado campo a campo, manejo de cada error documentado, idempotencia, ciclo de token, y el documento de integración (sección 19). |
| Solidez de la plataforma | Núcleo determinista, idempotencia, estados de pedido, reintentos, RLS estricto. |
| Calidad de archivos y estructuras que alimentan WO | Módulo generador (sección 10): payload JSON + export + PDF, validado contra el esquema objetivo. |
| Experiencia de usuario | 3 paneles por rol con búsqueda doble (descripción/código) y agente opcional. |
| Manual de onboarding | Sección 16; entregable para persona no técnica. |

> **Realidad del concurso:** WO no tiene sandbox público. El 90% se construye y demuestra ahora; el 10% (conexión viva) lo enciende el ganador con la cuenta real. Por eso *demostrar* dominio de la API (payload + mapeo + errores + plan) vale más que una conexión en vivo que nadie puede ejecutar.

---

## 2. Principios de arquitectura

- **Frontera de IA:** agente de búsqueda en rama aislada → devuelve sugerencias a la UI; el vendedor confirma; el código ejecuta. Entre confirmación y `POST` a WO no hay tokens de IA.
- **Fuente de verdad:** Supabase Postgres. n8n no guarda estado; orquesta y escribe de vuelta en Supabase.
- **Determinismo + idempotencia:** consecutivo de pedido controlado por nosotros; reintentos reusan la misma `idempotency_key`.
- **Anti-corruption layer:** el resto de la app no conoce el formato de WO; solo el `WorldOfficeAdapter`.

---

## 3. Diagrama de arquitectura

```
 VENDEDOR / CONTABLE / ADMIN
        │ (login + rol)
        ▼
 NEXT.JS @ VERCEL  ── 3 paneles, Auth UI, cotizar, confirmar
        │
        ▼
 SUPABASE (fuente de verdad)
   · Postgres: catálogo, clientes, cotizaciones, pedidos, estados, usuarios
   · Auth + RLS por rol
   · Búsqueda: pg_trgm + FTS + pgvector
        │  sugerencias (no escribe)        │ webhook al confirmar pedido
        ▼                                  ▼
 n8n · AGENTE BÚSQUEDA              n8n · CAMINO CRÍTICO (sin IA)
   nodo LLM interpreta                1 lee pedido (IDs congelados)
   consultas ambiguas                 2 arma payload WO (código puro)
   → candidatos rankeados             3 idempotency-key
   ⚠ SOLO sugiere                     4 POST World Office  ◄ mock|live
                                      5 OK → Gmail (Composio)
                                           + estado=sincronizado_wo
                                        ERR → estado=pendiente_sync + retry
                                               │
                                               ▼
                                    WORLD OFFICE CLOUD API
                         [CONCURSO: adapter mock] · [PROD: flag→live]
```

---

## 4. Modelo de datos (Supabase / Postgres)

```sql
-- Extensiones
create extension if not exists pg_trgm;
create extension if not exists vector;

-- Enums
create type rol_usuario as enum ('vendedor','contable','administrador');
create type familia_producto as enum ('sello_mecanico','capacitor','refrigeracion');
create type estado_cotizacion as enum ('borrador','confirmada','convertida');
create type estado_pedido as enum ('confirmado','sincronizado_wo','pendiente_sync','facturado','error');

-- Configuración global (single-tenant E.M.)
create table empresa (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null default 'E.M. Compañía S.A.S',
  wo_id_empresa       text,                 -- se llena al cablear WO
  prefijo_pedido      text not null default 'PED',
  forma_pago_default  text not null default 'contado',
  moneda              text not null default 'COP',
  bodega_default      text,                 -- wo_id bodega
  centro_costo_default text,                -- wo_id centro de costo
  consecutivo_pedido  bigint not null default 1
);

-- Usuarios (1:1 con auth.users de Supabase)
create table usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  email       text not null unique,
  rol         rol_usuario not null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Clientes (terceros)
create table clientes (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  nit             text,
  email           text,
  telefono        text,
  descuento_pct   numeric(5,2) not null default 0,   -- parámetro por cliente
  wo_id_tercero   text,        -- se reconcilia al cablear WO
  wo_id_direccion text,
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Catálogo de productos
create table productos (
  id                uuid primary key default gen_random_uuid(),
  codigo_interno    text not null unique,        -- p.ej. '0100178'
  descripcion       text not null,               -- 'sello mecánico 7 octavos, resorte corto Parxial'
  familia           familia_producto not null,
  atributos         jsonb not null default '{}', -- specs por familia (ver sección 6)
  unidad_medida     text not null default 'UND',
  precio_lista      numeric(14,2) not null,
  iva_pct           numeric(5,2) not null default 19,
  stock             integer not null default 0,  -- simulado en concurso; en prod viene de WO
  -- Llaves técnicas hacia World Office (el código contable SIEMPRE viaja)
  codigo_contable   text not null,
  wo_id_inventario  text,        -- se reconcilia al cablear WO
  wo_id_unidad      text,
  wo_id_impuesto    text,
  -- Búsqueda
  search_tsv        tsvector generated always as (
                      to_tsvector('spanish', coalesce(descripcion,'') || ' ' || coalesce(codigo_interno,''))
                    ) stored,
  embedding         vector(1536),
  activo            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index idx_productos_tsv      on productos using gin (search_tsv);
create index idx_productos_desc_trgm on productos using gin (descripcion gin_trgm_ops);
create index idx_productos_cod_trgm  on productos using gin (codigo_interno gin_trgm_ops);
create index idx_productos_embedding on productos using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Cotizaciones
create table cotizaciones (
  id            uuid primary key default gen_random_uuid(),
  vendedor_id   uuid not null references usuarios(id),
  cliente_id    uuid not null references clientes(id),
  estado        estado_cotizacion not null default 'borrador',
  descuento_pct numeric(5,2) not null default 0,  -- snapshot del descuento del cliente
  subtotal      numeric(14,2) not null default 0,
  total         numeric(14,2) not null default 0,
  created_at    timestamptz not null default now()
);

create table cotizacion_items (
  id                       uuid primary key default gen_random_uuid(),
  cotizacion_id            uuid not null references cotizaciones(id) on delete cascade,
  producto_id              uuid not null references productos(id),
  -- snapshots (inmutables aunque cambie el catálogo)
  descripcion_snapshot     text not null,
  codigo_interno_snapshot  text not null,
  codigo_contable_snapshot text not null,
  wo_id_inventario_snapshot text,
  cantidad                 integer not null check (cantidad > 0),
  valor_unitario           numeric(14,2) not null,
  descuento_pct            numeric(5,2) not null default 0,
  total_linea              numeric(14,2) not null
);

-- Pedidos
create table pedidos (
  id              uuid primary key default gen_random_uuid(),
  cotizacion_id   uuid references cotizaciones(id),
  vendedor_id     uuid not null references usuarios(id),
  cliente_id      uuid not null references clientes(id),
  prefijo         text not null,
  consecutivo     bigint not null,
  numero_wo       text,                 -- número devuelto/confirmado por WO
  estado          estado_pedido not null default 'confirmado',
  idempotency_key text not null unique,
  wo_payload      jsonb,                -- payload enviado (auditable)
  wo_response     jsonb,                -- respuesta de WO
  subtotal        numeric(14,2) not null,
  total           numeric(14,2) not null,
  created_at      timestamptz not null default now(),
  synced_at       timestamptz,
  unique (prefijo, consecutivo)
);

create table pedido_items (
  id                       uuid primary key default gen_random_uuid(),
  pedido_id                uuid not null references pedidos(id) on delete cascade,
  producto_id              uuid not null references productos(id),
  descripcion_snapshot     text not null,
  codigo_interno_snapshot  text not null,
  codigo_contable_snapshot text not null,
  wo_id_inventario_snapshot text,
  cantidad                 integer not null,
  valor_unitario           numeric(14,2) not null,
  descuento_pct            numeric(5,2) not null default 0,
  total_linea              numeric(14,2) not null
);

-- Auditoría de sincronización con WO
create table sync_logs (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid references pedidos(id),
  intento         integer not null default 1,
  request         jsonb,
  response        jsonb,
  status          text,        -- 'ok' | 'error'
  error_code      text,        -- p.ej. INVENTARIO_NO_ENCONTRADO
  error_more_info text,
  created_at      timestamptz not null default now()
);
```

---

## 5. Roles y RLS (Row Level Security)

Helper para leer el rol del usuario autenticado:

```sql
create or replace function auth_rol() returns rol_usuario
language sql stable as $$
  select rol from usuarios where id = auth.uid()
$$;
```

Políticas (resumen; aplicar `enable row level security` en cada tabla):

- **productos / clientes:** `select` para cualquier usuario autenticado y activo. `insert/update/delete` solo `administrador`.
- **cotizaciones / cotizacion_items:**
  - `vendedor`: CRUD solo donde `vendedor_id = auth.uid()`.
  - `contable` / `administrador`: `select` a todo.
- **pedidos / pedido_items:**
  - `vendedor`: `select` propios; `insert` propios.
  - `contable`: `select` a todo; `update` solo del campo `estado` (`confirmado→facturado`).
  - `administrador`: full.
- **usuarios:** `administrador` puede `insert`/`update`/`delete` (solo crea/elimina `vendedor` y `contable`). Cada usuario puede `select` su propia fila.
- **empresa / sync_logs:** `administrador` lectura/escritura; `contable` lectura de `sync_logs`.

```sql
-- Ejemplo: pedidos
alter table pedidos enable row level security;

create policy pedidos_vendedor_select on pedidos for select
  using ( auth_rol() = 'vendedor' and vendedor_id = auth.uid() );
create policy pedidos_vendedor_insert on pedidos for insert
  with check ( auth_rol() = 'vendedor' and vendedor_id = auth.uid() );
create policy pedidos_contable_select on pedidos for select
  using ( auth_rol() in ('contable','administrador') );
create policy pedidos_contable_update on pedidos for update
  using ( auth_rol() in ('contable','administrador') );
```

---

## 6. Catálogo de muestra (100–200 SKUs generados con IA)

**Esquema de código** (replica el ejemplo `0100178`): 7 dígitos = `[2 familia][5 consecutivo]`.
`01` = sello mecánico · `02` = capacitor · `03` = refrigeración. Ej: `0100178`.

**Atributos por familia (`productos.atributos` jsonb):**

```jsonc
// sello_mecanico
{ "tamano": "7/8\"", "resorte": "corto", "material": "carbon/ceramica",
  "marca": "Parxial", "aplicacion": "bomba centrífuga" }
// capacitor
{ "tipo": "marcha", "capacitancia_uf": 35, "voltaje_v": 440,
  "tolerancia_pct": 5, "terminal": "faston" }
// refrigeracion
{ "subfamilia": "compresor|filtro_secador|contactor|termostato|relay|motor|refrigerante",
  "specs": { "hp": 1.5, "gas": "R134a", "voltaje_v": 220, "btu": 12000 } }
```

**Generación (script `seed/generate-catalog.ts`):**
1. Generar 150 SKUs distribuidos ~ 40% sellos / 30% capacitores / 30% refrigeración con descripciones realistas (incluir tamaños en octavos, µF/voltaje, gases, HP, marcas como `Parxial`).
2. Asignar `codigo_interno` secuencial por familia, `codigo_contable` (puede coincidir con `codigo_interno` o tener su propio esquema contable; documentar el supuesto), `precio_lista`, `iva_pct=19`, `stock` aleatorio realista.
3. Calcular `embedding` de `descripcion` (modelo de embeddings 1536-dim) y poblar `productos`.
4. Dejar `wo_id_*` en `null` (se reconcilian al cablear WO — ver sección 19).

> Documentar en el manual que esta muestra es generada con IA (el brief lo exige) y que el catálogo real lo depura/migra el equipo de World Office.

---

## 7. Búsqueda (determinista + agente opcional)

**Capa base (siempre responde, sin IA):**
```sql
-- Búsqueda combinada por código (trigram), descripción (FTS) y semántica (vector)
-- Orden: match exacto de código > FTS rank > similitud trigram.
select id, codigo_interno, descripcion, precio_lista, stock
from productos
where activo
  and ( codigo_interno ilike $1 || '%'
        or search_tsv @@ plainto_tsquery('spanish', $1)
        or descripcion % $1 )                    -- pg_trgm similarity
order by
  (codigo_interno = $1) desc,
  ts_rank(search_tsv, plainto_tsquery('spanish', $1)) desc,
  similarity(descripcion, $1) desc
limit 20;
```
Ninguna vía es obligatoria: el vendedor encuentra por código **o** por descripción.

**Capa agente (opcional, sub-flujo n8n con nodo LLM):** reinterpreta consultas ambiguas (`"sello 7/8 res corto"`) → normaliza términos y devuelve candidatos rankeados (búsqueda vectorial sobre embeddings). **Su salida son sugerencias que el vendedor toca; nunca crea ni modifica un pedido.**

---

## 8. WorldOfficeAdapter (anti-corruption layer)

Único punto que conoce el formato de WO. Vive como módulo TS (consumido por server actions y por n8n vía HTTP wrapper).

```typescript
// lib/worldoffice/types.ts
export interface WOPedidoPayload {
  documentoTipo: string;        // tipo 'Pedido' de "Listar tipos de documentos"
  idEmpresa: string;
  prefijo: string;
  numero: string;               // consecutivo controlado por nosotros
  fecha: string;                // YYYY-MM-DD
  idTerceroExterno: string;
  idDireccionTercero: string;
  formaPago: string;
  idMoneda: string;             // COP
  renglones: WORenglon[];
}
export interface WORenglon {
  idInventario: string;
  unidadMedida: string;
  cantidad: number;
  valorUnitario: number;
  porcentajeDescuento: number;
  idBodega: string;
  idCentroCosto: string;
  idImpuesto: string;
}
export interface WOResult {
  ok: boolean;
  numero?: string;
  raw?: unknown;
  errorCode?: string;           // p.ej. INVENTARIO_NO_ENCONTRADO
  moreInfo?: string;
}

// lib/worldoffice/adapter.ts
export interface WorldOfficeAdapter {
  authenticate(): Promise<string>;                 // JWT, vigencia 12h, header "WO <token>"
  listarTiposDocumento(): Promise<WODocTipo[]>;
  listarInventarios(): Promise<WOInventario[]>;     // para reconciliar IDs en go-live
  listarTerceros(): Promise<WOTercero[]>;
  crearPedido(p: WOPedidoPayload): Promise<WOResult>;
}

export function getAdapter(): WorldOfficeAdapter {
  return process.env.WO_MODE === 'live'
    ? new WorldOfficeLiveAdapter()
    : new WorldOfficeMockAdapter();
}
```

**Mock (`WorldOfficeMockAdapter`):** lee fixtures locales / tablas Supabase, valida el payload con el mismo esquema que el live, simula respuestas de éxito y de error (para demostrar manejo de `TERCERO_ERRADO`, `INVENTARIO_NO_ENCONTRADO`, etc.) y devuelve un `numero` simulado. Persiste `wo_payload` y `wo_response` igual que en live.

**Live (`WorldOfficeLiveAdapter`):**
- Auth: `POST /gestionarTokenAPILicencia` (body `text/plain` con correo registrado) → JWT (12h). Header de cada request: `Authorization: WO <token>`. Refrescar antes de expirar.
- Base URL: **dato a confirmar con WO/E.M.** (la doc muestra `localhost:8080` como placeholder → es por-tenant). Marcar como variable de entorno.
- `crearPedido`: `POST` documento de venta tipo Pedido con `WOPedidoPayload`.
- Rate limit: generoso (la doc menciona ~500 req/seg); aun así, encolar en n8n.

**Mapeo Supabase → WO y error que blinda cada campo:**

| Interno (Supabase) | WO | Error que previene |
|---|---|---|
| `empresa.wo_id_empresa` | `idEmpresa` | `EMPRESA_ERRADA` |
| `config.documento_tipo_pedido` | `documentoTipo` | `TIPO_DOCUMENTO_NO_ADMITO_API` |
| `pedidos.prefijo` + `consecutivo` | `prefijo` + `numero` | `PREFIJO_FACTURA_ERRADO` / `DUPLICATE_KEY` |
| `clientes.wo_id_tercero` | `idTerceroExterno` | `TERCERO_ERRADO` |
| `clientes.wo_id_direccion` | `idDireccionTercero` | `DIRRECCION_TERCERO_EXTERNO_ERRADO` |
| `config.forma_pago` | `formaPago` | `FORMA_PAGO_NO_SOPORTADA` |
| `config.moneda` (COP) | `idMoneda` | `ERROR_MONEDA` |
| `producto.wo_id_inventario` | `idInventario` | `INVENTARIO_NO_ENCONTRADO` |
| `producto.wo_id_unidad` | `unidadMedida` | `ERROR_UNIDAD_INVENTARIO` |
| `config.bodega_default` | `idBodega` | `BODEGA_NO_EXISTE` |
| `config.centro_costo_default` | `idCentroCosto` | `CENTRO_COSTO_NO_EXISTE` |
| `clientes.descuento_pct` | `porcentajeDescuento` | (regla de negocio) |

**Idempotencia:** WO marca duplicado si coinciden `prefijo + idEmpresa + documentoTipo + numero`. El consecutivo lo controla Supabase; el reintento reusa el mismo `numero` e `idempotency_key`. Nunca se duplica ni se pierde un pedido.

---

## 9. Flujos n8n

Todos los flujos críticos son deterministas. n8n se conecta a Supabase (Postgres + Database Webhooks) y a Gmail vía Composio.

**9.1 `crearPedido` (camino crítico)**
1. **Webhook** ← Supabase DB Webhook al insertar pedido con `estado='confirmado'` (envía `pedido_id`).
2. **Supabase Get** → cabecera + items (IDs ya congelados en snapshots).
3. **Code** → construye `WOPedidoPayload` (mapeo sección 8) + `idempotency_key`.
4. **HTTP Request** → `crearPedido` (apunta a adapter `mock` en concurso / `live` en prod). Header `Authorization: WO {{token}}`.
5. **IF** éxito → **Gmail (Composio)** notifica al contable + **Supabase Update** `estado='sincronizado_wo'`, `numero_wo`, `synced_at`, `wo_response`.
   error → **Supabase Update** `estado='pendiente_sync'` + insert en `sync_logs` + reintento (backoff, misma `idempotency_key`).

**9.2 `refreshToken`** — cron cada ~11h: renueva el JWT de WO y lo guarda cifrado (solo modo live).

**9.3 `agenteBusqueda`** — webhook desde la app con la consulta del vendedor → nodo LLM normaliza → búsqueda vectorial en Supabase → devuelve candidatos. **Solo sugiere.**

**9.4 `notificacionContable`** — sub-flujo Gmail reutilizable (plantilla de correo con resumen del pedido y link al panel contable). En concurso, destinatario = correo de Joaquín; documentar el switch a la cuenta del cliente en prod.

---

## 10. Módulo generador de documentos / "archivos y estructuras que alimentan WO"

Pieza que suma puntos directos en el criterio #3. Por cada pedido confirmado se produce:

1. **Payload WO (JSON)** — el `WOPedidoPayload` exacto, visible y descargable desde el panel contable (auditable).
2. **PDF de cotización y de pedido** — formato con marca E.M. (logo, tokens), datos de cliente, líneas, descuento, totales.
3. **Estructura de carga WO (export)** — JSON/CSV que representa lo que alimentaría a World Office, descargable por el contable/admin (sirve como respaldo y como evidencia de la integración).

Implementación: generación server-side (route handler) con plantillas; almacenar referencias en `pedidos.wo_payload`. Reusa el mismo mapeo del adapter (cero divergencia entre lo que se muestra y lo que se enviaría).

---

## 11. Paneles / UX (Next.js + shadcn/ui + tokens E.M.)

**Tokens** (de `tokens.css`): bg `#F2F3F6`/`#E8EAEF`/`#DFE1E8`, texto `#1D1E20`/`#5F6368`/`#9AA0A6`, **accent `#CC3527`**, accent-sec `#D74A3A`, borde `#DADCE0@70%`, focus `#CC3527`. Tipografías **Outfit** (títulos) + **DM Sans** (texto) vía `next/font`.

**Panel Vendedor**
- Buscador dual (código/descripción) con resultados en vivo + botón "Asistente" (agente).
- Armado de cotización: cantidades, descuento del cliente autocompletado (editable según permiso), subtotal/total.
- Convertir cotización → pedido (confirmación explícita).
- Historial de sus pedidos con estado (`confirmado`/`sincronizado_wo`/`pendiente_sync`/`facturado`).
- Disponibilidad de inventario visible (stock simulado en concurso).

**Panel Contable**
- Lista de pedidos en tiempo real (Supabase Realtime), filtrable por vendedor, orden por más reciente.
- Detalle con payload WO y export descargable.
- Acción "Marcar como facturado" (un clic). Recibe notificación por correo de pedido nuevo.

**Panel Administrador**
- Gestión de usuarios: crear/eliminar vendedores y contables.
- Vista global de todo lo creado por cada usuario.
- Configuración general (parámetros de empresa: prefijo, forma de pago, bodega, centro de costo, moneda; descuentos por cliente; gestión de catálogo).

---

## 12. Notificaciones (Gmail vía Composio)

- Trigger: pedido nuevo (`estado='confirmado'` → flujo 9.1).
- Acción Composio `GMAIL_SEND_EMAIL`. Cuenta conectada: la de Joaquín (`apify, gmail, ...` ya activas en Composio).
- Concurso: destinatario = correo de Joaquín, con nota visible "en producción → correo del área contable de E.M.".
- Contenido: resumen del pedido (cliente, líneas, total) + link directo al panel contable.

---

## 13. Seguridad

- Auth de Supabase (email/clave); rol en tabla `usuarios`; RLS en todas las tablas.
- Token WO: guardado en variable de entorno cifrada / secret de n8n; nunca en el front. Header `Authorization: WO <token>`.
- Secrets de Composio gestionados por Composio; la app no los almacena.
- Validación de payload server-side antes de cualquier `POST` a WO.

---

## 14. Plan de entrega (2 semanas · checkpoint semana 1)

**Semana 1 (avance de control):**
- [ ] Repo + Vercel + Supabase + esquema (sección 4) + RLS (sección 5).
- [ ] Seed de catálogo 150 SKUs con embeddings (sección 6).
- [ ] Auth + 3 roles.
- [ ] Búsqueda dual (sección 7).
- [ ] Panel vendedor: cotizar → descuento → confirmar pedido.
- [ ] `WorldOfficeAdapter` en modo `mock` + payload + mapeo (sección 8).

**Semana 2 (entrega final):**
- [ ] Panel contable (realtime, filtro, export, "facturar") + notificación Gmail (Composio).
- [ ] Panel admin (usuarios + config + catálogo).
- [ ] Módulo generador de documentos (PDF + JSON + export) (sección 10).
- [ ] Flujos n8n (9.1–9.4).
- [ ] Agente de búsqueda (opcional, si hay tiempo).
- [ ] Documento de integración API WO (sección 19).
- [ ] Manual de onboarding (sección 16).
- [ ] Demo desplegada pública + README.

---

## 15. Estructura del repositorio (GitHub)

```
em-pedidos/
├─ apps/web/                # Next.js (App Router) en Vercel
│  ├─ app/(auth)/ (vendedor)/ (contable)/ (admin)/
│  ├─ components/ui/        # shadcn/ui con tokens E.M.
│  └─ lib/worldoffice/      # adapter (types, mock, live)
├─ supabase/
│  ├─ migrations/           # DDL secciones 4-5
│  └─ seed/generate-catalog.ts
├─ n8n/
│  └─ workflows/            # crearPedido, refreshToken, agenteBusqueda, notificacionContable (export JSON)
├─ docs/
│  ├─ integracion-world-office.md   # sección 19 (documento que más pesa)
│  └─ manual-onboarding.md          # sección 16
├─ tokens.css
└─ README.md
```

---

## 16. Manual de onboarding (índice mínimo)

Para persona no técnica de E.M.:
1. Qué es la plataforma y qué resuelve.
2. Ingresar (login) según rol.
3. **Vendedor:** buscar producto (código o descripción), armar cotización, aplicar descuento, generar pedido, ver estado/historial.
4. **Contable:** ver pedidos en tiempo real, filtrar por vendedor, descargar estructura/PDF, marcar como facturado, qué llega por correo.
5. **Administrador:** crear/eliminar usuarios, configurar parámetros, gestionar catálogo y descuentos por cliente.
6. Qué pasa "por debajo" con World Office (explicado en lenguaje simple).
7. Preguntas frecuentes y a quién contactar.

---

## 17. Entregables del concurso

- Demo pública (Vercel) con login por rol y catálogo de muestra cargado.
- Repo GitHub con todo (web + supabase + n8n + docs).
- `docs/integracion-world-office.md` (sección 19).
- `docs/manual-onboarding.md`.
- Breve nota de "qué es real / qué es mock y por qué" (transparencia frente a la ausencia de sandbox).

---

## 18. Variables de entorno

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# World Office (solo prod / live)
WO_MODE=mock                 # mock | live
WO_BASE_URL=                 # CONFIRMAR con WO (por-tenant; doc muestra localhost:8080 como placeholder)
WO_CORREO_REGISTRADO=        # para gestionarTokenAPILicencia
WO_TOKEN=                    # JWT (12h) — gestionado por n8n refreshToken en prod

# n8n
N8N_WEBHOOK_CREAR_PEDIDO=
N8N_WEBHOOK_AGENTE_BUSQUEDA=

# Embeddings (seed)
EMBEDDINGS_API_KEY=
```

---

## 19. Plan de integración API World Office (documento que más pesa)

> Este es el centro de la evaluación. Resume cómo se ejecuta el 10% restante en producción y por qué la plataforma ya está lista para ello.

**19.1 Estado de la API (investigado).** WO Cloud expone API REST (JSON, GET/POST/PUT/DELETE), gratis en plan Enterprise. Autenticación por JWT (vigencia 12h) vía `gestionarTokenAPILicencia` o token de la app; se envía en header con prefijo `WO`. Módulos: Terceros, Ventas (incluye Pedidos y Facturas), Inventarios, Compras, Contabilidad, Cartera, Cuentas por Pagar. La creación de documentos de venta exige `documentoTipo` (de "Listar tipos de documentos"), `idEmpresa`, tercero, prefijo, forma de pago, moneda, bodega, centro de costo y renglones con `idInventario`. Control de duplicados por `prefijo+idEmpresa+documentoTipo+numero`.

**19.2 Por qué no hay conexión viva en el concurso.** WO no ofrece ambiente de pruebas público; la API solo opera contra la cuenta real del cliente. Por eso corremos `WO_MODE=mock`, que valida el mismo payload y simula respuestas de éxito/error.

**19.3 Pasos de cableado en producción (el ganador, con contrato):**
1. E.M. genera el token API desde su cuenta Enterprise (Configuración → Configuración General → API).
2. Confirmar `WO_BASE_URL` real del tenant y registrar `WO_CORREO_REGISTRADO`.
3. Ejecutar **reconciliación de IDs**: llamar `listarInventarios`, `listarTerceros`, `listarTiposDocumento` y mapear el catálogo/clientes reales → poblar `productos.wo_id_inventario`, `wo_id_unidad`, `wo_id_impuesto`, `clientes.wo_id_tercero`, `empresa.*`. (Este es el paso clave: nuestra muestra usa IDs simulados; en go-live se sustituyen por los reales del cliente.)
4. Cambiar `WO_MODE=live` y activar `refreshToken` en n8n.
5. Prueba controlada: crear 1 pedido real → verificar que aparece en WO listo para factura.
6. Activar el flujo completo para los 3 vendedores.

**19.4 Manejo de errores y robustez.** Cada error documentado de WO (sección 8) se captura en `sync_logs` con `moreInfo`; el pedido queda en `pendiente_sync` y se reintenta con idempotencia. La migración del catálogo de escritorio a WO Cloud la hace el equipo de World Office (no es alcance nuestro).

**19.5 Riesgos y supuestos abiertos (a confirmar con WO/E.M.):**
- URL base real del tenant y nombre exacto del `documentoTipo` "Pedido".
- Si el descuento por cliente se aplica como `%` por renglón o por documento.
- Si la consulta de inventario en vivo se hace por producto o por lote (impacta el panel de stock).

---

*Fin del Build Spec v1.0.*
