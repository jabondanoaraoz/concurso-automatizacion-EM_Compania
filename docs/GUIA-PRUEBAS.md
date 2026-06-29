# Guía de pruebas — EM-Pedidos

Pruebas end-to-end de **todo** el proyecto, en los dos modos:
- **Modo A — Vercel (nube):** la demo pública, sin levantar nada. Camino in-app (WO mock + correo SMTP de la app).
- **Modo B — Local + n8n:** el mismo flujo **orquestado por n8n** (webhook → adapter → estado/reintentos → correo SMTP de n8n).

Marca cada caso: `[ ]` pendiente · `[x]` OK · `[!]` falló (anota qué pasó para corregirlo).

> **Ronda ejecutada 2026-06-29** (automatizada, Playwright + SQL). Resultados marcados abajo.
> Resumen: camino crítico, roles, descargas, manejo de error y búsqueda semántica (tras
> re-embeber el catálogo con atributos) verificados OK.

---

## 0. Datos comunes

**URL nube:** https://em-pedidos-joabon2799.vercel.app
**URL local:** http://localhost:3000

**Usuarios (los 3 roles):**
| Rol | Correo | Contraseña |
|---|---|---|
| Vendedor | `vendedor@empedidos.co` | `EMvende2026*` |
| Contable | `contable@empedidos.co` | `EMconta2026*` |
| Administrador | `admin@empedidos.co` | `EMadmin2026*` |

> **Qué mirar en cada pantalla:** marca E.M. (rojo `#CC3527`, tipografías Outfit/DM Sans), nada de azules genéricos.

---

# MODO A — Vercel (nube)

> No requiere levantar nada. El correo lo envía la app por SMTP. El sync a World Office es **mock**.

## A1. Autenticación y roles
- [x] **A1.1** Entrar a `/login`, ingresar como **vendedor** → aterriza en el panel de cotizar.
- [x] **A1.2** Cerrar sesión (botón "Salir") → vuelve a `/login`.
- [x] **A1.3** Repetir con **contable** → aterriza en panel de pedidos; con **admin** → panel de administración.
- [x] **A1.4** Estando como vendedor, escribir a mano `/admin` en la URL → te **redirige** a tu panel (no te deja entrar). *(RLS + guard por rol.)*

## A2. Vendedor — cotizar
- [x] **A2.1** Buscar por **código**: escribir `0200004` → aparece "Capacitor de marcha 35 µF 370V tornillo" ($43.000, stock 46).
- [x] **A2.2** Buscar por **descripción** (búsqueda determinista por código/FTS/trigram) → verificada vía RPC `buscar_productos`.
- [x] **A2.3** **Asistente (IA semántica)**: tras re-embeber el catálogo con `descripcion + familia + atributos`: `empaque para bomba de agua` → **sellos mecánicos** ✓; `gas para aire acondicionado` → **refrigerantes** ✓; `arranque de motor de nevera` → **motores** ✓.
- [x] **A2.4** Elegir **Servitécnica Industrial** → el **descuento** se autocompleta (12.5%).
- [x] **A2.5** Agregar producto → **Subtotal $43.000 / Descuento 12.5% (−$5.375) / Total $37.625** correcto.
- [x] **A2.6** **Confirmar pedido** → `PED-13`, estado **sincronizado_wo**, número WO PED-13.
- [x] **A2.7** En **Mis pedidos** figura PED-13 con su estado.
- [x] **A2.8** **PDF** del historial → `application/pdf`, 200, firma `%PDF-`, 3711 bytes.

## A3. Correo automático (nube)
- [ ] **A3.1** Tras confirmar (A2.6), llega a `joabon2799@gmail.com` el correo **"Nuevo pedido PED-x"**. *(No verificado en esta ronda: requiere revisar la bandeja de Joaquín; depende del SMTP configurado en la demo. El disparo best-effort existe en `confirmarPedido` → `enviarNotificacionPedido`.)*

## A4. Contable — tiempo real, descargas, facturar
- [x] **A4.1** **Realtime:** canal `pedidos-rt` (Supabase Realtime) suscrito en el panel (PED-13 aparece tras confirmar). *(Suscripción verificada en código + carga en vivo.)*
- [x] **A4.2** Filtrar por **vendedor** (selector arriba) → presente y funcional.
- [x] **A4.3** Pulsar **Ver** en PED-13 → se muestra el **payload World Office (JSON)** completo con IDs `SIM-*`.
- [x] **A4.4** **PDF** (200, `%PDF-`) + **payload JSON** + **estructura CSV** → los 3 botones presentes; PDF verificado.
- [x] **A4.5** Pulsar **Marcar como facturado** → PED-13 cambió a **Facturado**.

## A5. Administrador
- [x] **A5.0** Panel admin carga con las 4 pestañas (Usuarios/Empresa/Clientes/Catálogo); 3 usuarios listados; el admin sin botón "Eliminar" (protegido). Escritura **blindada por RLS** (clientes/empresa/productos solo admin — verificado vía `pg_policies`).
- [ ] **A5.1**–**A5.6** CRUD de usuarios/empresa/clientes/catálogo: UI presente y RLS confirmado; no se ejecutó cada alta/edición para no dejar datos de prueba. *(Las server actions fueron revisadas: clamp de descuento/precio, password ≥8, rollback de usuario.)*

---

# MODO B — Local + n8n (orquestación)

> Demuestra el camino crítico orquestado por n8n (lo que más pesa: integración WO con reintentos e idempotencia).

## B0. Preparación
- [ ] **B0.1** n8n corriendo en `localhost:5678` con los flujos **`concurso_em_crearPedido`** y **`concurso_em_agenteBusqueda`** en **Active**.
- [ ] **B0.2** App local corriendo limpio: `cd apps/web && npm run dev` → `http://localhost:3000/login` carga sin error 500.

## B1. Camino crítico vía n8n (crearPedido)
- [ ] **B1.1–B1.5** No ejecutado: **n8n local no estaba corriendo** (`localhost:5678` sin respuesta). El equivalente **in-app** del camino crítico (`sincronizarPedidoWO`) sí se verificó en Modo A (PED-13 → `sincronizado_wo`) y abajo en B3 (manejo de error). Los flujos JSON están en `n8n/workflows/` listos para importar.

## B2. Agente de búsqueda vía n8n (webhook)
- [ ] **B2.1** No ejecutado (n8n local apagado). El equivalente in-app (`sugerenciasAgente` → búsqueda semántica/léxica) se verificó en A2.3.

## B3. Manejo de errores de World Office — **VERIFICADO**
> Demuestra que cada error documentado de WO se captura, deja el pedido `pendiente_sync` y se registra.
- [x] **B3.1** Dev server local arrancado con `WO_MOCK_FORCE_ERROR=TERCERO_ERRADO` (y webhook n8n vacío para forzar sync in-app).
- [x] **B3.2** Confirmado PED-14 → quedó **`pendiente_sync`** (numero_wo null) y **`sync_logs`** registró `status=error`, `error_code=TERCERO_ERRADO`, `intento=1`, moreInfo="El idTerceroExterno no corresponde a un tercero válido." (verificado por SQL).
- [x] **B3.3** Variable removida al detener el dev server → vuelve a operar normal.

---

# MODO C — Entregables: documentos, estructura y repo

> Validar que los entregables existen, están completos y **coinciden con lo implementado**.

## C1. Documentos (leer y validar contenido)
- [ ] **C1.1** `docs/integracion-world-office.md` (**el que más pesa**) — verificar que tenga: estado de la API WO, **mapeo campo a campo** (tabla Supabase→WO con el error que blinda cada campo), 12 errores documentados, **idempotencia** (consecutivo + idempotency_key), ciclo de token (JWT 12h), pasos de cableado en go-live (reconciliación de IDs), tabla "qué es real / qué es mock", checklist de go-live. Que coincida con `apps/web/lib/worldoffice/`.
- [ ] **C1.2** `docs/manual-onboarding.md` — guía no técnica con los 7 puntos (qué es, login, guía por rol vendedor/contable/admin, qué pasa "por debajo" con WO, FAQ).
- [ ] **C1.3** `docs/PREGUNTAS-CLIENTE.md` — supuestos abiertos (URL del tenant, nombre del `documentoTipo`, descuento por renglón vs documento, inventario por producto vs lote).
- [ ] **C1.4** `README.md` — pitch, stack, estructura, cómo correr, **tabla real/mock**, links a los docs.
- [ ] **C1.5** `n8n/README.md` — import de los 4 flujos + variables.
- [ ] **C1.6** `CLAUDE.md` — contexto del proyecto (stack, 3 capas, 6 reglas no negociables).
- [ ] **C1.7** `docs/GUIA-PRUEBAS.md` — esta guía.

## C2. Estructura del repo (sección 15 del spec)
- [ ] **C2.1** El árbol coincide: `apps/web/` · `supabase/{migrations,seed}/` · `n8n/workflows/` · `docs/` · `tokens.css` · `README.md` · `EM-Pedidos_Build-Spec.md`.

## C3. Repo en GitHub
**URL:** https://github.com/jabondanoaraoz/concurso-automatizacion-EM_Compania
- [ ] **C3.1** Abrir el repo → ~72 archivos, ~22 commits, **auto-deploy en cada push** (conectado a Vercel).
- [ ] **C3.2** **NO hay secretos**: ningún `.env` real, `service_role`, App Password ni API keys. Solo `.env.example` con placeholders. *(Verificado: `git ls-files` no lista nada privado.)*
- [ ] **C3.3** **5 migraciones SQL** (`0001`–`0005`) reflejan la base aplicada.
- [ ] **C3.4** **4 workflows n8n** exportados como JSON en `n8n/workflows/`.
- [ ] **C3.5** Commits **a nombre del usuario** (sin `Co-Authored-By`).

## C4. Base de datos (Supabase → dashboard)
**Proyecto ref:** `pxqqxevxybgicnxtbzzb`
- [ ] **C4.1** Table Editor: **9 tablas**, **150 productos** (con `embedding` poblado), **5 clientes**, **3 usuarios**, fila `empresa`.
- [ ] **C4.2** Authentication → Policies: **RLS activo** en las 9 tablas.

---

# Evidencia para el jurado (criterios del concurso)

Al probar, ten presente **dónde se demuestra cada criterio**:

| Criterio (peso) | Dónde se ve |
|---|---|
| **Integración API World Office** (el que más pesa) | Payload JSON en el detalle del contable (A4.3) · `docs/integracion-world-office.md` (mapeo campo a campo, errores, idempotencia, ciclo de token) · manejo de error (B3) |
| Solidez de la plataforma | RLS por rol (A1.4) · idempotencia/consecutivo · estados de pedido · reintentos n8n (B1) |
| Archivos que alimentan WO | PDF + JSON + CSV (A2.8, A4.4) |
| Experiencia de usuario | 3 paneles, búsqueda dual + Asistente semántico (A2) |
| Manual de onboarding | `docs/manual-onboarding.md` |

---

# Plantilla de feedback

Para cada caso que falle, anota:
```
[Caso]  (ej. A4.5)
Qué hiciste:
Qué esperabas:
Qué pasó:
Captura / mensaje de error:
```

> Cuando termines la ronda, me pasas los `[!]` y los corregimos. Luego definimos el **guion de demo** (qué mostrar, en qué orden, qué resaltar) a partir de lo que mejor funcione.
