# Guion de demo y respuestas al feedback del jurado

**EM-Pedidos · E.M. Compañía S.A.S**

Este documento (1) responde punto por punto el feedback del jurado y (2) da un guion de demo
de ~7 minutos pensado para **demostrar con evidencia** lo que en la primera ronda no se vio.

---

## 1. Respuestas al feedback

| Observación del jurado | Realidad | Dónde verlo |
|---|---|---|
| "Falta un plan escrito de cómo conectaría con World Office de verdad." | **Ya existe** y es exhaustivo: endpoint, token JWT (12 h, header `Authorization: WO <token>`), mapeo SIM-→ID real por reconciliación, qué pasa si la llamada falla (12 errores → `pendiente_sync` + `sync_logs` + reintento con misma `idempotency_key`), checklist de go-live. | `docs/integracion-world-office.md` · y ahora **dentro de la app**: panel admin → **Ayuda → "Integración World Office (técnico)"**. |
| "Falta el manual de onboarding para alguien no técnico." | **Ya existe**, escrito sin tecnicismos y por rol. | `docs/manual-onboarding.md` · y ahora **dentro de la app**: cualquier rol → **Ayuda → "Manual de uso"**. |
| "Los datos viven en el navegador, no en un backend." | **Percepción equivocada.** La app está respaldada por **Supabase Postgres** (9 tablas, RLS por rol, consecutivo atómico, auditoría). Los datos se **comparten entre usuarios en tiempo real**. No hay estado en el navegador. | Ver guion paso 4 (persistencia compartida en vivo) y paso 6 (tablas en Supabase). |
| "¿La notificación por correo está simulada o por Gmail?" | **Es real**: Gmail vía Composio (o SMTP si está configurado), disparo *best-effort* al confirmar. Hoy llega al correo de Joaquín; en producción, al área contable de E.M. | `apps/web/lib/notificaciones/email.ts` · ahora la UI muestra **"✓ Notificación enviada a contabilidad por correo"** al confirmar. |
| "El botón 'Asistente' no me abrió nada." | Estaba cableado pero con UX pobre (deshabilitado con el buscador vacío y panel poco visible). **Corregido**: feedback al clic, panel visible con auto-scroll, estado de carga y texto guía. | Panel vendedor → buscador → **Asistente**. |
| "El admin está completo y las rutas quedaron protegidas por rol." | Confirmado. RLS en Postgres + guards de rol en cada layout. | — |

**Resumen:** de los 6 puntos, 2 eran documentos que ya existían (ahora también embebidos en la app),
1 era una percepción a corregir con evidencia, 1 era una duda (el correo es real) y solo 1 era un
bug real de UX (ya corregido).

---

## 2. Guion de demo (~7 min)

> Preparación: dos navegadores (o ventana normal + incógnito) lado a lado. Izquierda: **vendedor**.
> Derecha: **contable**. Esto es lo que prueba que hay backend compartido.

1. **Login por rol (30 s).** Entra como `vendedor@empedidos.co` (izq.) y `contable@empedidos.co` (der.).
   Muestra que cada uno cae en su panel y que escribir la URL del otro panel redirige (guard de rol).

2. **Búsqueda dual (1 min).** En vendedor, busca por **código** (`0100012`) y por **descripción**
   (`sello 7/8 resorte corto`). Resultados al instante.

3. **Asistente (1 min).** Escribe algo ambiguo (`cap 35 uf`) y pulsa **Asistente**: aparece el panel
   "Interpretando tu consulta…" y luego las sugerencias. Agrega una. *(Punto clave: ahora el botón da
   feedback inmediato; antes parecía no responder.)*

4. **Confirmar pedido → persistencia compartida EN VIVO (1.5 min). ← el momento que mata "vive en el navegador".**
   Elige cliente (el **descuento se autocompleta**), revisa totales, **Confirmar pedido**. Aparece
   `PED-N`, el estado WO y **"✓ Notificación enviada a contabilidad por correo"**.
   **Sin recargar**, en la ventana del **contable** el pedido aparece solo (Supabase Realtime).
   *Di explícitamente:* "esto no es estado del navegador — el vendedor escribió en Postgres y el
   contable, en otra sesión, lo recibió en vivo."

5. **Panel contable (1 min).** Abre el pedido: descarga **PDF** (marca E.M.), **payload JSON** (campos
   reales de World Office) y **CSV**. Pulsa **Facturar** y muestra el cambio de estado.

6. **Evidencia de backend (1 min).** Abre Supabase → tabla `pedidos` (y `pedido_items`, `sync_logs`):
   ahí está el pedido recién creado, con su `wo_payload` y consecutivo. Menciona RLS por rol.
   *(Refuerza el paso 4: el dato es persistente y auditable, no efímero.)*

7. **Ayuda en la app + plan WO (1 min).** Como **admin**, abre **Ayuda**: el **Manual de uso** (con
   "Ir a mi sección" por rol) y la **Integración World Office (técnico)** con el mapeo campo a campo y
   el checklist de go-live. "Descargar PDF" para llevarlo impreso. Cierra con la tesis: pasar a
   producción es `WO_MODE=live` + reconciliar IDs reales; el 90% ya está construido y probado.

---

## 3. Producción vs. demo (una frase para cada duda)

- **¿Backend?** Sí: Supabase Postgres es la fuente de verdad desde el día uno; la demo ya es multiusuario.
- **¿World Office?** En `mock` por falta de sandbox público; en `live` se enciende con un flag + IDs reales.
- **¿Correo?** Real (Gmail/Composio); en producción cambia el destinatario al área contable de E.M.
