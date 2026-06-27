-- ============================================================================
-- EM-Pedidos — 0006 Creación de pedido ATÓMICA (idempotencia + sin huecos)
-- ----------------------------------------------------------------------------
-- Antes: el server action reservaba el consecutivo (siguiente_consecutivo) y
-- LUEGO hacía 4 inserts no transaccionales. Si un insert posterior fallaba
-- (p. ej. un 503 transitorio), el consecutivo ya estaba consumido → HUECO en
-- la numeración (se observaron PED-8 / PED-9 fantasma en QA).
--
-- Ahora: una sola función plpgsql hace TODO en una transacción. Si cualquier
-- paso falla, el rollback revierte también el incremento del consecutivo → el
-- número solo se gasta cuando el pedido se persiste con éxito.
--
-- El MAPEO a formato World Office sigue viviendo en lib/worldoffice (JS): aquí
-- solo se completa el `numero` real y se deriva idempotency_key (misma regla
-- que mapping.idempotencyKey: prefijo::idEmpresa::documentoTipo::numero).
-- SECURITY DEFINER (como siguiente_consecutivo) para poder tocar empresa; el
-- vendedor se toma de auth.uid() para que no sea suplantable.
-- ============================================================================

create or replace function crear_pedido_atomico(
  p_cliente   uuid,
  p_descuento numeric,
  p_subtotal  numeric,
  p_total     numeric,
  p_wo_payload jsonb,   -- payload WO ya mapeado en JS, con numero placeholder ("")
  p_items     jsonb     -- arreglo de líneas con snapshots inmutables
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_vendedor uuid := auth.uid();
  v_consec   bigint;
  v_prefijo  text;
  v_coti     uuid;
  v_pedido   uuid;
  v_payload  jsonb;
  v_idem     text;
  it         jsonb;
begin
  if v_vendedor is null then
    raise exception 'Sesión no válida';
  end if;
  if p_cliente is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cliente y al menos un producto son obligatorios';
  end if;
  if not (p_total > 0) then
    raise exception 'El total del pedido debe ser mayor a cero';
  end if;

  -- 1) Reservar consecutivo DENTRO de la transacción (si algo falla luego, se revierte).
  update empresa
     set consecutivo_pedido = consecutivo_pedido + 1
   where id = (select id from empresa order by id limit 1)
  returning consecutivo_pedido - 1, prefijo_pedido into v_consec, v_prefijo;

  -- 2) Completar payload con el número real + derivar idempotency_key.
  v_payload := jsonb_set(p_wo_payload, '{numero}', to_jsonb(v_consec::text));
  v_idem := (v_payload->>'prefijo') || '::' || (v_payload->>'idEmpresa') || '::' ||
            (v_payload->>'documentoTipo') || '::' || v_consec::text;

  -- 3) Cotización + items (snapshots).
  insert into cotizaciones (vendedor_id, cliente_id, estado, descuento_pct, subtotal, total)
  values (v_vendedor, p_cliente, 'convertida', p_descuento, p_subtotal, p_total)
  returning id into v_coti;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into cotizacion_items (
      cotizacion_id, producto_id, descripcion_snapshot, codigo_interno_snapshot,
      codigo_contable_snapshot, wo_id_inventario_snapshot, cantidad, valor_unitario,
      descuento_pct, total_linea
    ) values (
      v_coti, (it->>'producto_id')::uuid, it->>'descripcion', it->>'codigo_interno',
      it->>'codigo_contable', nullif(it->>'wo_id_inventario', ''), (it->>'cantidad')::int,
      (it->>'valor_unitario')::numeric, p_descuento, (it->>'total_linea')::numeric
    );
  end loop;

  -- 4) Pedido + items.
  insert into pedidos (
    cotizacion_id, vendedor_id, cliente_id, prefijo, consecutivo, estado,
    idempotency_key, wo_payload, subtotal, total
  ) values (
    v_coti, v_vendedor, p_cliente, v_prefijo, v_consec, 'confirmado',
    v_idem, v_payload, p_subtotal, p_total
  ) returning id into v_pedido;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into pedido_items (
      pedido_id, producto_id, descripcion_snapshot, codigo_interno_snapshot,
      codigo_contable_snapshot, wo_id_inventario_snapshot, cantidad, valor_unitario,
      descuento_pct, total_linea
    ) values (
      v_pedido, (it->>'producto_id')::uuid, it->>'descripcion', it->>'codigo_interno',
      it->>'codigo_contable', nullif(it->>'wo_id_inventario', ''), (it->>'cantidad')::int,
      (it->>'valor_unitario')::numeric, p_descuento, (it->>'total_linea')::numeric
    );
  end loop;

  return jsonb_build_object(
    'pedido_id',   v_pedido,
    'consecutivo', v_consec,
    'numero',      v_prefijo || '-' || v_consec::text,
    'wo_payload',  v_payload
  );
end;
$$;

-- Solo usuarios autenticados pueden invocarla (no anon).
revoke all on function crear_pedido_atomico(uuid, numeric, numeric, numeric, jsonb, jsonb) from public, anon;
grant execute on function crear_pedido_atomico(uuid, numeric, numeric, numeric, jsonb, jsonb) to authenticated, service_role;
