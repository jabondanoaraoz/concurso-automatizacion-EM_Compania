-- ============================================================================
-- EM-Pedidos — 0005 Búsqueda semántica (capa agente, sección 7)
-- Ordena por distancia coseno sobre productos.embedding (1536-dim).
-- Los embeddings se pueblan con supabase/seed/embed-catalog.ts (requiere
-- EMBEDDINGS_API_KEY). El agente cae a la búsqueda léxica si no hay embeddings.
-- ============================================================================

create or replace function buscar_semantica(query_embedding text, match_count int default 10)
returns table (
  id            uuid,
  codigo_interno text,
  descripcion   text,
  familia       familia_producto,
  precio_lista  numeric,
  iva_pct       numeric,
  stock         integer,
  unidad_medida text,
  distancia     float
)
language sql stable as $$
  select p.id, p.codigo_interno, p.descripcion, p.familia,
         p.precio_lista, p.iva_pct, p.stock, p.unidad_medida,
         (p.embedding <=> query_embedding::vector) as distancia
  from productos p
  where p.activo and p.embedding is not null
  order by p.embedding <=> query_embedding::vector
  limit match_count;
$$;
