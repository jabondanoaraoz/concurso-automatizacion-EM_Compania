# EM-Pedidos

Plataforma de cotización y pedidos para **E.M. Compañía S.A.S**, integrada a **World Office Cloud**.
El vendedor cotiza, aplica el descuento del cliente y genera un pedido que llega en tiempo real a
World Office, listo para que contabilidad lo convierta en factura con un clic.

> **Concurso Aztec.** World Office no ofrece sandbox público: su API solo opera contra la cuenta real
> del cliente. Por eso la plataforma corre con `WO_MODE=mock`, que valida el mismo payload y simula
> respuestas de éxito/error. El cableado a la cuenta real (`live`) lo enciende el ganador con contrato.
> Ver `docs/integracion-world-office.md` (en construcción) y la sección 19 del spec.

## Stack
Next.js (App Router) + Vercel · Supabase (Postgres + Auth + RLS, `pg_trgm`/FTS/`pgvector`) ·
n8n (camino crítico + agente) · Gmail vía Composio.

## Estructura
```
em-pedidos/
├─ apps/web/        # Next.js (App Router) — paneles por rol, adapter WO
├─ supabase/        # migraciones (DDL) + seed de catálogo
├─ n8n/             # workflows exportados (crearPedido, refreshToken, agente, notificación)
├─ docs/            # PREGUNTAS-CLIENTE.md, integración WO, manual onboarding
├─ tokens.css       # tokens de marca E.M.
└─ EM-Pedidos_Build-Spec.md
```

## Documentos clave
- `EM-Pedidos_Build-Spec.md` — contrato de construcción (PRD técnico).
- `docs/PREGUNTAS-CLIENTE.md` — supuestos abiertos a confirmar con WO/E.M.

## Configuración
Copiar `.env.example` a `.env` y completar las variables. Nunca commitear `.env`.

## Qué es real / qué es mock
- **Real:** modelo de datos, RLS, búsqueda dual, paneles, armado determinista del payload WO,
  mapeo campo a campo, manejo de errores, idempotencia, módulo generador de documentos.
- **Mock:** la conexión viva a World Office. El `WorldOfficeMockAdapter` valida el mismo payload
  que el live y simula éxito/error. Se pasa a `live` cambiando un flag, sin tocar el resto de la app.
