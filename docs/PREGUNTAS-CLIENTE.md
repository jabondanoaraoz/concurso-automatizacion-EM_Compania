# Preguntas abiertas a confirmar con WO / E.M.

> Derivadas de la sección 19.5 del Build Spec (riesgos y supuestos abiertos).
> Ninguna bloquea la construcción en modo `mock`; sí son necesarias para el **go-live** (modo `live`).
> Estado: todas **PENDIENTES**. No asumir respuesta sin confirmación del cliente.

---

## P1 — URL base real del tenant de World Office
- **Pregunta:** ¿Cuál es la `WO_BASE_URL` real de la cuenta Enterprise de E.M.? La documentación muestra `localhost:8080` como placeholder, lo que sugiere que la URL es por-tenant.
- **Por qué importa:** sin la URL real no se puede apuntar el adapter `live`. En concurso se deja como variable de entorno vacía y se corre en `mock`.
- **Impacto si cambia:** solo configuración (`WO_BASE_URL` en `.env`); no afecta el código del adapter.
- **Estado:** ⏳ PENDIENTE.

## P2 — Nombre exacto del `documentoTipo` "Pedido"
- **Pregunta:** ¿Cuál es el nombre/identificador exacto del tipo de documento "Pedido" tal como lo devuelve "Listar tipos de documentos" en la cuenta de E.M.? (Puede no llamarse literalmente "Pedido".)
- **Por qué importa:** es un campo obligatorio del payload (`documentoTipo`). Un valor errado dispara `TIPO_DOCUMENTO_NO_ADMITO_API`.
- **Impacto si cambia:** se ajusta `config.documento_tipo_pedido`; en go-live se obtiene vía `listarTiposDocumento()`.
- **Estado:** ⏳ PENDIENTE.

## P3 — Aplicación del descuento por cliente: por renglón vs. por documento
- **Pregunta:** ¿El descuento del cliente se aplica como `%` por **renglón** (`porcentajeDescuento` en cada `WORenglon`) o como descuento global por **documento**?
- **Por qué importa:** define dónde se mapea `clientes.descuento_pct` en el payload y cómo se calculan los totales que deben coincidir con WO.
- **Supuesto provisional (a confirmar):** el spec modela `porcentajeDescuento` por renglón; se construirá así en mock, marcando el supuesto.
- **Impacto si cambia:** ajuste en el armado del payload y en el cálculo de totales del módulo generador.
- **Estado:** ⏳ PENDIENTE.

## P4 — Consulta de inventario en vivo: por producto vs. por lote
- **Pregunta:** ¿La consulta de stock/inventario en WO se hace por **producto individual** o por **lote/batch**?
- **Por qué importa:** impacta el diseño del panel de stock (en concurso el stock es simulado; en prod vendría de WO).
- **Impacto si cambia:** afecta el método de `listarInventarios()`/consulta de stock y el refresco del panel de disponibilidad.
- **Estado:** ⏳ PENDIENTE.

---

## Otros datos a confirmar para el cableado en producción (sección 19.3)
> No son supuestos de la 19.5, pero son necesarios para go-live. Se listan como recordatorio.

- **D1 —** Correo registrado para `gestionarTokenAPILicencia` (`WO_CORREO_REGISTRADO`). ⏳ PENDIENTE.
- **D2 —** Token API generado desde la cuenta Enterprise (Configuración → Configuración General → API). ⏳ PENDIENTE.
- **D3 —** IDs reales para reconciliación: `wo_id_empresa`, `wo_id_inventario`, `wo_id_unidad`, `wo_id_impuesto`, `wo_id_tercero`, `wo_id_direccion`, `bodega_default`, `centro_costo_default`. Se obtienen vía `listarInventarios` / `listarTerceros` / `listarTiposDocumento`. ⏳ PENDIENTE.
- **D4 —** Correo del área contable de E.M. (reemplaza el correo de Joaquín en las notificaciones de producción). ⏳ PENDIENTE.
- **D5 —** Confirmar si la migración del catálogo de escritorio a WO Cloud la hace el equipo de World Office (asumido fuera de alcance según 19.4). ⏳ PENDIENTE.
