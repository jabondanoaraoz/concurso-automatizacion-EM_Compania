# CLAUDE.md — EM-Pedidos

## Qué es
Plataforma web cerrada (acceso interno, 3 roles) de cotización y pedidos para **E.M. Compañía S.A.S**,
integrada a **World Office Cloud** vía API. El vendedor cotiza, aplica el descuento del cliente y genera
un pedido que llega en tiempo real a World Office, listo para que contabilidad lo convierta en factura.
Reemplaza el flujo actual por WhatsApp (fotos/audios + re-digitación con errores).

Spec completa: `EM-Pedidos_Build-Spec.md`. Progreso: `PROGRESS.md` (raíz, no se commitea).

## Stack (fijo, no negociable)
- **Front:** Next.js (App Router) + shadcn/ui, desplegado en **Vercel**.
- **Datos/Auth:** **Supabase** (Postgres + Auth + RLS) con `pg_trgm` + FTS + `pgvector`.
- **Orquestación:** **n8n** (camino crítico + agente de búsqueda). No guarda estado.
- **Correo:** **Gmail vía Composio** (`GMAIL_SEND_EMAIL`).
- **Embeddings:** modelo 1536-dim para búsqueda semántica del catálogo.

## Arquitectura de 3 capas
1. **Directiva (qué hacer):** el Build Spec (`EM-Pedidos_Build-Spec.md`).
2. **Orquestación (decisiones):** el agente lee, enruta, maneja errores. Next.js server actions + n8n.
3. **Ejecución (hacer):** código determinista (mapeo de payload, adapter, scripts de seed).

## Reglas no negociables (sección 0 del spec)
1. **La IA nunca está en el camino crítico.** Solo el agente de búsqueda usa LLM y únicamente *sugiere*.
   Entre la confirmación del vendedor y el `POST` a World Office no hay tokens de IA.
2. **Adapter con doble modo.** Todo acceso a WO pasa por `WorldOfficeAdapter` con `WO_MODE = mock | live`.
   Interfaz idéntica en ambos modos. Concurso corre en `mock`.
3. **El código contable se conserva siempre.** Cada producto carga `wo_id_inventario` + `codigo_contable`;
   cada línea de cotización/pedido guarda un **snapshot inmutable** de ambos.
4. **Idempotencia obligatoria** en la creación de pedidos. Consecutivo controlado por Supabase;
   el reintento reusa la misma `idempotency_key` (evita `DUPLICATE_KEY` de WO).
5. **Tokens de marca E.M.** (sección 11) en todo el front. Accent `#CC3527`. Nada de azules/verdes genéricos.
6. **Fuente de verdad:** Supabase Postgres. n8n orquesta y escribe de vuelta; no es fuente de verdad.

## Convenciones de código
- Anti-corruption layer: solo `lib/worldoffice/` conoce el formato de WO. El resto de la app no.
- Cero divergencia: el módulo generador de documentos reusa el mismo mapeo del adapter.
- Validación de payload server-side antes de cualquier `POST` a WO.
- Archivos intermedios en `.tmp/` (regenerables, nunca se commitean).

## Integraciones externas y particularidades
- **World Office:** sin sandbox público; la API solo opera contra la cuenta real. Por eso el concurso
  corre en `mock`. Auth por JWT (12h) vía `gestionarTokenAPILicencia`; header `Authorization: WO <token>`.
  `WO_BASE_URL` es por-tenant (a confirmar — ver `docs/PREGUNTAS-CLIENTE.md`).
- **Composio (Gmail):** cuenta conectada = la de Joaquín. En concurso el destinatario de las
  notificaciones es el correo de Joaquín; en prod se cambia al área contable de E.M.
- **n8n:** flujos exportados como JSON en `n8n/workflows/`.

## Variables de entorno
Ver `.env.example`. Nunca commitear `.env` (está en `.gitignore`).

## Qué NO hacer
- No poner IA en el camino crítico de creación de pedidos.
- No llamar a World Office fuera del `WorldOfficeAdapter`.
- No mutar snapshots de líneas (son inmutables aunque cambie el catálogo).
- No subir `.claude/`, `.env`, `PROGRESS.md` ni credenciales al repo.
- No commitear con `Co-Authored-By`.

## Progreso
`PROGRESS.md` (raíz del proyecto, excluido de git) es la **única fuente de progreso**. Se trabaja
una fase a la vez; al terminar cada fase se pausa, se muestra y se espera OK. Si una tarea tiene
>=3 pasos nuevos, se refleja en `PROGRESS.md`.
