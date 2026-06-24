-- ============================================================================
-- EM-Pedidos — 0001 Esquema base (sección 4 del Build Spec)
-- Modelo de datos: catálogo, clientes, cotizaciones, pedidos, sync_logs.
-- ============================================================================

-- Extensiones
create extension if not exists pg_trgm;
create extension if not exists vector;

-- Enums
do $$ begin
  create type rol_usuario as enum ('vendedor','contable','administrador');
exception when duplicate_object then null; end $$;

do $$ begin
  create type familia_producto as enum ('sello_mecanico','capacitor','refrigeracion');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_cotizacion as enum ('borrador','confirmada','convertida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_pedido as enum ('confirmado','sincronizado_wo','pendiente_sync','facturado','error');
exception when duplicate_object then null; end $$;

-- Configuración global (single-tenant E.M.)
create table if not exists empresa (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text not null default 'E.M. Compañía S.A.S',
  wo_id_empresa        text,                 -- se llena al cablear WO
  documento_tipo_pedido text,                -- nombre exacto del tipo 'Pedido' (a confirmar)
  prefijo_pedido       text not null default 'PED',
  forma_pago_default   text not null default 'contado',
  moneda               text not null default 'COP',
  bodega_default       text,                 -- wo_id bodega
  centro_costo_default text,                 -- wo_id centro de costo
  consecutivo_pedido   bigint not null default 1
);

-- Usuarios (1:1 con auth.users de Supabase)
create table if not exists usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  email       text not null unique,
  rol         rol_usuario not null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Clientes (terceros)
create table if not exists clientes (
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
create table if not exists productos (
  id                uuid primary key default gen_random_uuid(),
  codigo_interno    text not null unique,        -- p.ej. '0100178'
  descripcion       text not null,
  familia           familia_producto not null,
  atributos         jsonb not null default '{}', -- specs por familia (sección 6)
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
create index if not exists idx_productos_tsv       on productos using gin (search_tsv);
create index if not exists idx_productos_desc_trgm on productos using gin (descripcion gin_trgm_ops);
create index if not exists idx_productos_cod_trgm  on productos using gin (codigo_interno gin_trgm_ops);
create index if not exists idx_productos_embedding on productos using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Cotizaciones
create table if not exists cotizaciones (
  id            uuid primary key default gen_random_uuid(),
  vendedor_id   uuid not null references usuarios(id),
  cliente_id    uuid not null references clientes(id),
  estado        estado_cotizacion not null default 'borrador',
  descuento_pct numeric(5,2) not null default 0,  -- snapshot del descuento del cliente
  subtotal      numeric(14,2) not null default 0,
  total         numeric(14,2) not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists cotizacion_items (
  id                        uuid primary key default gen_random_uuid(),
  cotizacion_id             uuid not null references cotizaciones(id) on delete cascade,
  producto_id               uuid not null references productos(id),
  -- snapshots (inmutables aunque cambie el catálogo)
  descripcion_snapshot      text not null,
  codigo_interno_snapshot   text not null,
  codigo_contable_snapshot  text not null,
  wo_id_inventario_snapshot text,
  cantidad                  integer not null check (cantidad > 0),
  valor_unitario            numeric(14,2) not null,
  descuento_pct             numeric(5,2) not null default 0,
  total_linea               numeric(14,2) not null
);

-- Pedidos
create table if not exists pedidos (
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

create table if not exists pedido_items (
  id                        uuid primary key default gen_random_uuid(),
  pedido_id                 uuid not null references pedidos(id) on delete cascade,
  producto_id               uuid not null references productos(id),
  descripcion_snapshot      text not null,
  codigo_interno_snapshot   text not null,
  codigo_contable_snapshot  text not null,
  wo_id_inventario_snapshot text,
  cantidad                  integer not null,
  valor_unitario            numeric(14,2) not null,
  descuento_pct             numeric(5,2) not null default 0,
  total_linea               numeric(14,2) not null
);

-- Auditoría de sincronización con WO
create table if not exists sync_logs (
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
