-- ============================================================================
-- EM-Pedidos — 0002 RLS (sección 5 del Build Spec)
-- Helper de rol + Row Level Security por tabla y rol.
-- ============================================================================

-- Helper: rol del usuario autenticado.
-- security definer + search_path fijo: evita recursión cuando hay RLS sobre
-- usuarios y garantiza que la lectura del rol no quede limitada por políticas.
create or replace function auth_rol() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from usuarios where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- usuarios
-- ---------------------------------------------------------------------------
alter table usuarios enable row level security;

drop policy if exists usuarios_self_select on usuarios;
create policy usuarios_self_select on usuarios for select
  using ( id = auth.uid() );

drop policy if exists usuarios_admin_select on usuarios;
create policy usuarios_admin_select on usuarios for select
  using ( auth_rol() = 'administrador' );

-- El admin solo puede crear/editar vendedores y contables (no otros admin).
drop policy if exists usuarios_admin_insert on usuarios;
create policy usuarios_admin_insert on usuarios for insert
  with check ( auth_rol() = 'administrador' and rol in ('vendedor','contable') );

drop policy if exists usuarios_admin_update on usuarios;
create policy usuarios_admin_update on usuarios for update
  using ( auth_rol() = 'administrador' )
  with check ( auth_rol() = 'administrador' and rol in ('vendedor','contable') );

drop policy if exists usuarios_admin_delete on usuarios;
create policy usuarios_admin_delete on usuarios for delete
  using ( auth_rol() = 'administrador' and rol in ('vendedor','contable') );

-- ---------------------------------------------------------------------------
-- productos: lectura para autenticado; escritura solo administrador
-- ---------------------------------------------------------------------------
alter table productos enable row level security;

drop policy if exists productos_select on productos;
create policy productos_select on productos for select
  using ( auth.uid() is not null );

drop policy if exists productos_admin_write on productos;
create policy productos_admin_write on productos for all
  using ( auth_rol() = 'administrador' )
  with check ( auth_rol() = 'administrador' );

-- ---------------------------------------------------------------------------
-- clientes: lectura para autenticado; escritura solo administrador
-- ---------------------------------------------------------------------------
alter table clientes enable row level security;

drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes for select
  using ( auth.uid() is not null );

drop policy if exists clientes_admin_write on clientes;
create policy clientes_admin_write on clientes for all
  using ( auth_rol() = 'administrador' )
  with check ( auth_rol() = 'administrador' );

-- ---------------------------------------------------------------------------
-- cotizaciones: vendedor CRUD propias; contable/admin lectura total
-- ---------------------------------------------------------------------------
alter table cotizaciones enable row level security;

drop policy if exists cotizaciones_vendedor_all on cotizaciones;
create policy cotizaciones_vendedor_all on cotizaciones for all
  using ( auth_rol() = 'vendedor' and vendedor_id = auth.uid() )
  with check ( auth_rol() = 'vendedor' and vendedor_id = auth.uid() );

drop policy if exists cotizaciones_staff_select on cotizaciones;
create policy cotizaciones_staff_select on cotizaciones for select
  using ( auth_rol() in ('contable','administrador') );

-- ---------------------------------------------------------------------------
-- cotizacion_items: heredan el dueño desde la cotización padre
-- ---------------------------------------------------------------------------
alter table cotizacion_items enable row level security;

drop policy if exists coti_items_vendedor_all on cotizacion_items;
create policy coti_items_vendedor_all on cotizacion_items for all
  using ( exists (
    select 1 from cotizaciones c
    where c.id = cotizacion_items.cotizacion_id
      and auth_rol() = 'vendedor' and c.vendedor_id = auth.uid() ) )
  with check ( exists (
    select 1 from cotizaciones c
    where c.id = cotizacion_items.cotizacion_id
      and auth_rol() = 'vendedor' and c.vendedor_id = auth.uid() ) );

drop policy if exists coti_items_staff_select on cotizacion_items;
create policy coti_items_staff_select on cotizacion_items for select
  using ( auth_rol() in ('contable','administrador') );

-- ---------------------------------------------------------------------------
-- pedidos: vendedor select/insert propios; contable select+update; admin full
-- ---------------------------------------------------------------------------
alter table pedidos enable row level security;

drop policy if exists pedidos_vendedor_select on pedidos;
create policy pedidos_vendedor_select on pedidos for select
  using ( auth_rol() = 'vendedor' and vendedor_id = auth.uid() );

drop policy if exists pedidos_vendedor_insert on pedidos;
create policy pedidos_vendedor_insert on pedidos for insert
  with check ( auth_rol() = 'vendedor' and vendedor_id = auth.uid() );

drop policy if exists pedidos_staff_select on pedidos;
create policy pedidos_staff_select on pedidos for select
  using ( auth_rol() in ('contable','administrador') );

drop policy if exists pedidos_staff_update on pedidos;
create policy pedidos_staff_update on pedidos for update
  using ( auth_rol() in ('contable','administrador') )
  with check ( auth_rol() in ('contable','administrador') );

drop policy if exists pedidos_admin_all on pedidos;
create policy pedidos_admin_all on pedidos for all
  using ( auth_rol() = 'administrador' )
  with check ( auth_rol() = 'administrador' );

-- ---------------------------------------------------------------------------
-- pedido_items: heredan el dueño desde el pedido padre
-- ---------------------------------------------------------------------------
alter table pedido_items enable row level security;

drop policy if exists pedido_items_vendedor_select on pedido_items;
create policy pedido_items_vendedor_select on pedido_items for select
  using ( exists (
    select 1 from pedidos p
    where p.id = pedido_items.pedido_id
      and auth_rol() = 'vendedor' and p.vendedor_id = auth.uid() ) );

drop policy if exists pedido_items_vendedor_insert on pedido_items;
create policy pedido_items_vendedor_insert on pedido_items for insert
  with check ( exists (
    select 1 from pedidos p
    where p.id = pedido_items.pedido_id
      and auth_rol() = 'vendedor' and p.vendedor_id = auth.uid() ) );

drop policy if exists pedido_items_staff_select on pedido_items;
create policy pedido_items_staff_select on pedido_items for select
  using ( auth_rol() in ('contable','administrador') );

drop policy if exists pedido_items_admin_all on pedido_items;
create policy pedido_items_admin_all on pedido_items for all
  using ( auth_rol() = 'administrador' )
  with check ( auth_rol() = 'administrador' );

-- ---------------------------------------------------------------------------
-- empresa: admin lectura/escritura; staff lectura (para parámetros)
-- ---------------------------------------------------------------------------
alter table empresa enable row level security;

drop policy if exists empresa_read on empresa;
create policy empresa_read on empresa for select
  using ( auth.uid() is not null );

drop policy if exists empresa_admin_write on empresa;
create policy empresa_admin_write on empresa for all
  using ( auth_rol() = 'administrador' )
  with check ( auth_rol() = 'administrador' );

-- ---------------------------------------------------------------------------
-- sync_logs: admin lectura/escritura; contable lectura
-- ---------------------------------------------------------------------------
alter table sync_logs enable row level security;

drop policy if exists sync_logs_staff_select on sync_logs;
create policy sync_logs_staff_select on sync_logs for select
  using ( auth_rol() in ('contable','administrador') );

drop policy if exists sync_logs_admin_write on sync_logs;
create policy sync_logs_admin_write on sync_logs for all
  using ( auth_rol() = 'administrador' )
  with check ( auth_rol() = 'administrador' );
