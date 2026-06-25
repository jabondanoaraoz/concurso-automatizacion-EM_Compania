# Manual de uso — EM-Pedidos

**Para el equipo de E.M. Compañía S.A.S** · Guía sencilla, sin tecnicismos.

---

## 1. ¿Qué es EM-Pedidos y qué resuelve?

EM-Pedidos es la plataforma web donde los vendedores **cotizan y generan pedidos** que llegan
en tiempo real a contabilidad y, de ahí, a **World Office** listos para facturar.

Reemplaza el flujo de WhatsApp (fotos y audios que había que volver a digitar). Ahora:
- El vendedor arma el pedido en pantalla, con precios y descuentos correctos.
- Contabilidad lo recibe al instante, sin re-digitar, y lo factura con un clic.
- Cada pedido queda guardado, numerado y auditable.

> **Nota de la demo (concurso):** la conexión viva con World Office está en modo *demostración*
> (mock). Todo funciona igual; la diferencia es que el envío final a World Office se "simula".
> Al contratar, se activa la conexión real cambiando una sola configuración.

---

## 2. Ingresar (según tu rol)

1. Abre la dirección de la plataforma en el navegador.
2. Pulsa **Ingresar** y escribe tu **correo** y **contraseña**.
3. Según tu rol, entras a tu panel:
   - **Vendedor** → panel para cotizar.
   - **Contable** → panel de pedidos.
   - **Administrador** → panel de administración.

Si te equivocas de panel, el sistema te lleva automáticamente al tuyo. Para salir, usa el
botón **Salir** arriba a la derecha.

*Usuarios de demostración:* `vendedor@empedidos.co`, `contable@empedidos.co`,
`admin@empedidos.co` (las contraseñas las entrega el administrador).

---

## 3. Si eres **Vendedor**

Tu pantalla tiene el buscador a la izquierda y la cotización a la derecha.

1. **Elige el cliente** en la lista. El **descuento** del cliente se completa solo
   (puedes ajustarlo si tienes permiso).
2. **Busca el producto** escribiendo el **código** (ej. `0100012`) o la **descripción**
   (ej. `sello 7/8 resorte corto`). Los resultados aparecen al instante.
   - ¿La búsqueda no encuentra algo? Pulsa **Asistente**: interpreta lo que escribiste
     (ej. `cap 35 uf` → *capacitor 35 µF*) y te sugiere productos. Tú eliges cuáles agregar.
3. Pulsa **Agregar** en cada producto y ajusta la **cantidad** en la cotización.
4. Revisa **Subtotal**, **Descuento** y **Total**.
5. Pulsa **Confirmar pedido**. Verás el número del pedido (ej. `PED-15`) y su estado.
6. Más abajo, en **Mis pedidos**, ves tu historial con el estado de cada uno y un enlace **PDF**
   para descargar el pedido.

**Estados de un pedido:**
- *Confirmado* — creado, en camino a World Office.
- *Sincronizado WO* — ya llegó a World Office.
- *Pendiente sync* — hubo un problema; el sistema reintenta solo.
- *Facturado* — contabilidad ya lo facturó.

---

## 4. Si eres **Contable**

Tu panel muestra **todos los pedidos en tiempo real** (aparecen solos, sin recargar).

1. **Filtra por vendedor** con el selector de arriba.
2. Pulsa **Ver** en un pedido para ver su detalle.
3. En el detalle puedes:
   - **Descargar PDF** — el pedido con la marca de E.M.
   - **Descargar payload JSON** — la estructura exacta que va a World Office.
   - **Descargar estructura CSV** — un respaldo en planilla.
   - **Marcar como facturado** — cuando ya lo facturaste en World Office.
4. **Correo:** cada vez que se confirma un pedido nuevo, te llega un **correo** con el resumen
   (cliente, productos, total) y un botón para abrir el panel.

---

## 5. Si eres **Administrador**

Tu panel tiene cuatro pestañas:

- **Usuarios** — crea o elimina **vendedores** y **contables** (nombre, correo, contraseña).
- **Empresa** — configura los parámetros del negocio: prefijo de pedido, forma de pago, moneda,
  bodega y centro de costo (estos dos últimos se completan al conectar World Office).
- **Clientes** — ajusta el **descuento** de cada cliente o crea clientes nuevos.
- **Catálogo** — busca productos, edita **precio**, **stock** y si están **activos**, o crea
  productos nuevos.

---

## 6. ¿Qué pasa "por debajo" con World Office?

En palabras simples: cuando un vendedor **confirma** un pedido, la plataforma arma
automáticamente el "paquete" que World Office necesita (cliente, productos, cantidades,
descuento, impuestos, bodega) y lo envía. Si World Office lo acepta, el pedido queda
**Sincronizado** y listo para factura. Si algo falla, el pedido queda **Pendiente** y el
sistema **reintenta solo**, sin duplicar nunca el pedido.

El **código contable** de cada producto siempre viaja con el pedido, aunque el vendedor lo haya
buscado por descripción. Así, contabilidad nunca tiene que adivinar ni corregir.

---

## 7. Preguntas frecuentes

**¿Se puede duplicar un pedido por error?** No. Cada pedido tiene un número único; si se reintenta
el envío, World Office reconoce que es el mismo y no lo duplica.

**Confirmé un pedido y quedó "Pendiente sync". ¿Qué hago?** Nada: el sistema reintenta solo.
Si persiste, avisa al administrador (puede revisar el detalle del error).

**¿El cliente recibe algo?** No. El correo de pedido nuevo es interno, para contabilidad.

**¿Puedo cambiar el descuento de un cliente?** El administrador sí, desde la pestaña *Clientes*.
El vendedor puede ajustarlo en la cotización si tiene permiso.

**¿A quién contacto ante un problema?** Al administrador de la plataforma en E.M.
(soporte técnico durante la implementación: el equipo del proyecto).
