-- ============================================================================
-- EM-Pedidos — 0004 Seed de configuración base (single-tenant)
-- Crea la única fila de empresa con los defaults del concurso.
-- Los wo_id_* quedan en null: se reconcilian al cablear WO (sección 19.3).
-- ============================================================================

insert into empresa (nombre, prefijo_pedido, forma_pago_default, moneda)
select 'E.M. Compañía S.A.S', 'PED', 'contado', 'COP'
where not exists (select 1 from empresa);
