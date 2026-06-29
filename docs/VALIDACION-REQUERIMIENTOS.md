# Validación de requerimientos — EM-Pedidos

> Cruce de los requerimientos del Build Spec (`EM-Pedidos_Build-Spec.md`) contra lo
> implementado, con evidencia. Ronda de validación: 2026-06-29.
> Estados: ✓ cumple · ⚠ parcial / con nota · ✗ falta.

## Resumen ejecutivo
La plataforma cumple los requerimientos del concurso. El núcleo determinista (integración
World Office) está cubierto por **31 tests automatizados** y verificado en vivo end-to-end
(cotizar → confirmar → payload WO → estados → manejo de error). El único punto ⚠ es la
**calidad del ranking** de la búsqueda semántica (función opcional que solo sugiere); la
búsqueda determinista —la garantizada— funciona perfecta.

## Reglas no negociables (sección 0)
| # | Regla | Estado | Evidencia |
|---|---|---|---|
| 1 | IA nunca en el camino crítico | ✓ | `confirmarPedido`/`buildWOPayload`/`crear_pedido_atomico` son 100% deterministas; el agente solo devuelve sugerencias (`lib/agente/`, panel "Asistente"). |
| 2 | Adapter doble modo `mock\|live`, interfaz idéntica | ✓ | `lib/worldoffice/adapter.ts` (`getAdapter()`), mock y live comparten `validateWOPayload`. Tests `mock.test.ts`. |
| 3 | Código contable siempre viaja (snapshot inmutable) | ✓ | `codigo_contable_snapshot` en `cotizacion_items`/`pedido_items`; el payload muestra `SIM-INV-0200004` derivado del código. Test "codigo_contable SIEMPRE viaja". |
| 4 | Idempotencia en creación de pedidos | ✓ | `idempotency_key` único + RPC atómica `crear_pedido_atomico`; `idempotencyKey()` (`prefijo::idEmpresa::documentoTipo::numero`). Tests de idempotencia + DUPLICATE_KEY. |
| 5 | Tokens de marca E.M. (accent #CC3527) | ✓ | `tokens.css`, fuentes Outfit/DM Sans; verificado en vivo en los 3 paneles. |
| 6 | Supabase fuente de verdad; n8n no guarda estado | ✓ | RLS + datos en Postgres; n8n orquesta y escribe de vuelta. |

## Criterios de evaluación (sección 1)
| Criterio (peso) | Estado | Evidencia |
|---|---|---|
| **Integración API WO** (el que más pesa) | ✓ | Mapeo campo a campo (`mapping.ts`), 12 errores tipados (`errors.ts`), idempotencia, ciclo de token (`live.ts`), `docs/integracion-world-office.md`. Payload visible en panel contable (PED-13). **31 tests**. Manejo de error en vivo (PED-14 → pendiente_sync + sync_logs). |
| Solidez de la plataforma | ✓ | RLS por rol (verificado: escritura clientes/empresa/productos solo admin; pedidos update solo contable/admin), idempotencia, estados de pedido, reintento sobre RPC atómica. |
| Archivos que alimentan WO | ✓ | PDF (server, `%PDF-`, 200), payload JSON descargable + visible, estructura CSV. (`panel-contable.tsx`, `lib/documentos/pedido-pdf.tsx`). |
| Experiencia de usuario | ✓ | 3 paneles por rol, búsqueda dual (código/descripción) + Asistente semántico. Verificado en vivo. |
| Manual de onboarding | ✓ | `docs/manual-onboarding.md` (7 secciones, no técnico). |

## Modelo de datos y seguridad (secciones 4-5, 13)
| Requerimiento | Estado | Evidencia |
|---|---|---|
| 9 tablas + enums + índices (pg_trgm/FTS/pgvector) | ✓ | DB en vivo: 9 tablas base; migraciones `0001`–`0006`. |
| RLS en todas las tablas | ✓ | `relrowsecurity=true` en las 9; políticas por rol confirmadas vía `pg_policies`. |
| 150 SKUs con embeddings | ✓ | DB: 150 productos, **150 con `embedding`** (no nulo). |
| 3 roles / auth | ✓ | 3 usuarios (admin/contable/vendedor); guard de rol verificado (vendedor→/admin redirige). |
| Validación payload server-side antes del POST | ✓ | `validateWOPayload` dentro de mock y live. |
| Consecutivo atómico sin huecos | ✓ | RPC `crear_pedido_atomico` (0006); consecutivo avanza sin huecos. |

## Búsqueda (sección 7)
| Requerimiento | Estado | Evidencia |
|---|---|---|
| Búsqueda determinista (código exacto > FTS > trigram) | ✓ | RPC `buscar_productos`; verificado: `0200004` → capacitor correcto. |
| Agente semántico opcional (solo sugiere) | ⚠ | Pipeline activo (embeddings presentes). `gas para aire acondicionado` → refrigeración ✓. `empaque para bomba de agua` → capacitores (ranking pobre): el embedding se calcula solo sobre `descripcion`, que no incluye la aplicación ("bomba"). No bloquea: solo sugiere y la búsqueda determinista cubre el caso. Mejora propuesta: embeber `descripcion + atributos`. |

## Entregables (secciones 10, 16, 17, 19)
| Entregable | Estado | Evidencia |
|---|---|---|
| Módulo generador (PDF + JSON + CSV) | ✓ | Verificado en vivo (PED-13). |
| `docs/integracion-world-office.md` (sección 19) | ✓ | Mapeo, 12 errores, idempotencia, ciclo token, go-live, tabla real/mock. |
| `docs/manual-onboarding.md` (sección 16) | ✓ | 7 secciones. |
| `docs/PREGUNTAS-CLIENTE.md` | ✓ | 4 supuestos abiertos (pendientes de WO/E.M., esperado). |
| Demo pública + README + repo | ✓ | `em-pedidos-joabon2799.vercel.app`; README con tabla real/mock. |
| Flujos n8n (9.1–9.4) | ✓/⚠ | 4 JSON exportados. `crearPedido`/`notificacionContable` completos; `agenteBusqueda` con normalización placeholder; `refreshToken` no persiste el JWT (solo go-live). |

## Notas / pendientes esperados (no bloqueantes)
- **Modo `live` no verificable**: WO no tiene sandbox público (documentado en spec 19.2). Por eso `WO_MODE=mock`.
- **Reconciliación de `wo_id_*`**: se hace en go-live (sección 19.3); en mock se usan IDs `SIM-*`.
- **`codigo_contable = codigo_interno`** en la muestra: placeholder trazable documentado.
