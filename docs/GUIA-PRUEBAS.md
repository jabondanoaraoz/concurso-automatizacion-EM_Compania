# Guía de pruebas — EM-Pedidos

Pruebas end-to-end de **todo** el proyecto, en los dos modos:
- **Modo A — Vercel (nube):** la demo pública, sin levantar nada. Camino in-app (WO mock + correo SMTP de la app).
- **Modo B — Local + n8n:** el mismo flujo **orquestado por n8n** (webhook → adapter → estado/reintentos → correo SMTP de n8n).

Marca cada caso: `[ ]` pendiente · `[x]` OK · `[!]` falló (anota qué pasó para corregirlo).

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
- [ ] **A1.1** Entrar a `/login`, ingresar como **vendedor** → aterriza en el panel de cotizar.
- [ ] **A1.2** Cerrar sesión (botón "Salir") → vuelve a `/login`.
- [ ] **A1.3** Repetir con **contable** → aterriza en panel de pedidos; con **admin** → panel de administración.
- [ ] **A1.4** Estando como vendedor, escribir a mano `/admin` en la URL → te **redirige** a tu panel (no te deja entrar). *(RLS + guard por rol.)*

## A2. Vendedor — cotizar
- [ ] **A2.1** Buscar por **código**: escribir `0200004` → aparece "Capacitor de marcha 35 µF".
- [ ] **A2.2** Buscar por **descripción**: `sello 7/8 resorte corto` → aparecen sellos 7/8" primero.
- [ ] **A2.3** **Asistente (IA semántica)**: escribir algo que NO usa las palabras del catálogo, p. ej. `empaque para bomba de agua` → pulsar **Asistente** → sugiere **sellos mecánicos**. Probar también `gas para aire acondicionado` → **refrigerantes**.
- [ ] **A2.4** Elegir un **cliente** (ej. *Servitécnica Industrial*) → el **descuento** se autocompleta (12.5%).
- [ ] **A2.5** Agregar 2–3 productos, cambiar cantidades → **Subtotal / Descuento / Total** se recalculan bien.
- [ ] **A2.6** **Confirmar pedido** → aparece el número (ej. `PED-5`) y estado **sincronizado_wo** con número WO.
- [ ] **A2.7** En **Mis pedidos** (abajo) figura el pedido con su estado.
- [ ] **A2.8** Pulsar **PDF** en el historial → descarga el PDF con marca E.M. (cliente, líneas, descuento, total).

## A3. Correo automático (nube)
- [ ] **A3.1** Tras confirmar (A2.6), llega a `joabon2799@gmail.com` el correo **"Nuevo pedido PED-x"** con la marca E.M. y el botón "Ver en el panel contable". *(Enviado por la app vía SMTP.)*

## A4. Contable — tiempo real, descargas, facturar
- [ ] **A4.1** **Realtime:** abre el panel **contable** en una pestaña y el de **vendedor** en otra. Confirma un pedido como vendedor → aparece en contable **sin recargar**.
- [ ] **A4.2** Filtrar por **vendedor** (selector arriba) → la lista se filtra.
- [ ] **A4.3** Pulsar **Ver** en un pedido → se muestra el **payload World Office (JSON)**.
- [ ] **A4.4** Descargar **PDF**, **payload JSON** y **estructura CSV** → los 3 archivos bajan bien.
- [ ] **A4.5** Pulsar **Marcar como facturado** → el estado cambia a **facturado**.

## A5. Administrador
- [ ] **A5.1** Pestaña **Usuarios** → crear un vendedor de prueba (nombre, correo, contraseña ≥8) → aparece en la lista.
- [ ] **A5.2** Cerrar sesión y **entrar con ese usuario nuevo** → funciona. *(Luego puedes eliminarlo.)*
- [ ] **A5.3** Pestaña **Empresa** → cambiar el *prefijo* o *forma de pago* → **Guardar** → confirma "Configuración guardada".
- [ ] **A5.4** Pestaña **Clientes** → cambiar el **descuento** de un cliente → **Guardar**. Verifícalo cotizando con ese cliente (A2.4).
- [ ] **A5.5** Pestaña **Catálogo** → crear un producto nuevo (código `0100200`, descripción, familia, precio) → buscarlo desde el panel del **vendedor**.
- [ ] **A5.6** En Catálogo, editar **precio/stock** de un producto → **Guardar**.

---

# MODO B — Local + n8n (orquestación)

> Demuestra el camino crítico orquestado por n8n (lo que más pesa: integración WO con reintentos e idempotencia).

## B0. Preparación
- [ ] **B0.1** n8n corriendo en `localhost:5678` con los flujos **`concurso_em_crearPedido`** y **`concurso_em_agenteBusqueda`** en **Active**.
- [ ] **B0.2** App local corriendo limpio: `cd apps/web && npm run dev` → `http://localhost:3000/login` carga sin error 500.

## B1. Camino crítico vía n8n (crearPedido)
- [ ] **B1.1** Entrar como **vendedor** en `localhost:3000`, armar y **confirmar un pedido nuevo**.
- [ ] **B1.2** El pedido aparece en **Mis pedidos**. (Con n8n, nace `confirmado` y en 1–3 s pasa a `sincronizado_wo`.)
- [ ] **B1.3** En **n8n → Executions**, la última ejecución de `concurso_em_crearPedido` figura **Success**, pasando por: Leer pedido → Crear en WO → Marcar sincronizado → Obtener contenido → **Enviar Gmail**.
- [ ] **B1.4** Llega el **correo** a `joabon2799@gmail.com` con el pie *"sent automatically with n8n"*. *(Enviado por n8n vía SMTP.)*
- [ ] **B1.5** En el panel **contable** (local), el pedido figura `sincronizado_wo` con su número WO y payload descargable.

## B2. Agente de búsqueda vía n8n (webhook)
- [ ] **B2.1** Desde una terminal:
  ```bash
  curl -s -X POST http://localhost:5678/webhook/agente-busqueda \
    -H "Content-Type: application/json" -d '{"query":"sello 7/8 resorte corto"}'
  ```
  Devuelve `{"candidatos":[ ... ]}` con sellos 7/8". *(n8n → Supabase, solo sugiere.)*

## B3. (Opcional) Manejo de errores de World Office
> Demuestra que cada error documentado de WO se captura, deja el pedido `pendiente_sync` y se reintenta.
- [ ] **B3.1** En `apps/web/.env.local` agregar `WO_MOCK_FORCE_ERROR=TERCERO_ERRADO`, reiniciar `npm run dev`.
- [ ] **B3.2** Confirmar un pedido → el adapter devuelve el error; el pedido queda **pendiente_sync** y se registra en **`sync_logs`** (visible para contable/admin).
- [ ] **B3.3** Quitar la variable y reiniciar → vuelve a funcionar normal.

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
