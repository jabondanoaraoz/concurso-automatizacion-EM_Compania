-- ============================================================================
-- EM-Pedidos — 0003 Funciones
-- Búsqueda dual determinista (sección 7) + consecutivo atómico (idempotencia).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- buscar_productos(q): capa base de búsqueda, SIEMPRE responde, sin IA.
-- Orden: match exacto de código > FTS rank > similitud trigram de descripción.
-- ---------------------------------------------------------------------------
create or replace function buscar_productos(q text)
returns table (
  id              uuid,
  codigo_interno  text,
  descripcion     text,
  familia         familia_producto,
  precio_lista    numeric,
  iva_pct         numeric,
  stock           integer,
  unidad_medida   text
)
language sql stable as $$
  select p.id, p.codigo_interno, p.descripcion, p.familia,
         p.precio_lista, p.iva_pct, p.stock, p.unidad_medida
  from productos p
  where p.activo
    and ( p.codigo_interno ilike q || '%'
          or p.search_tsv @@ plainto_tsquery('spanish', q)
          or p.descripcion % q )                       -- pg_trgm similarity
  order by
    (p.codigo_interno = q) desc,
    ts_rank(p.search_tsv, plainto_tsquery('spanish', q)) desc,
    similarity(p.descripcion, q) desc
  limit 20;
$$;

-- ---------------------------------------------------------------------------
-- siguiente_consecutivo(): reserva el próximo número de pedido de forma
-- atómica (lock de fila). El consecutivo lo controlamos nosotros, no WO; esto
-- sostiene la idempotencia (un reintento reusa el mismo numero + idempotency_key).
-- Single-tenant: opera sobre la única fila de empresa.
-- ---------------------------------------------------------------------------
create or replace function siguiente_consecutivo()
returns bigint
language sql volatile security definer set search_path = public as $$
  update empresa
     set consecutivo_pedido = consecutivo_pedido + 1
   where id = (select id from empresa order by id limit 1)
  returning consecutivo_pedido - 1;
$$;
