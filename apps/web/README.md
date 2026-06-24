# apps/web — EM-Pedidos (Next.js)

Next.js (App Router) con tokens de marca E.M. y el `WorldOfficeAdapter`.

## Correr en local
```bash
cd apps/web
npm install
cp ../../.env.example .env.local   # completar NEXT_PUBLIC_SUPABASE_* y WO_MODE
npm run dev                        # http://localhost:3000
```

## Estructura
```
app/                 # rutas (App Router)
components/ui/        # shadcn/ui con tokens E.M.
lib/utils.ts         # helper cn()
lib/worldoffice/     # anti-corruption layer
  types.ts           # WOPedidoPayload, WORenglon, WOResult, ...
  errors.ts          # errores documentados de WO + validación tipada
  mapping.ts         # Supabase → payload (determinista) + validación + idempotency_key
  mock.ts            # WorldOfficeMockAdapter (valida + simula éxito/error/duplicado)
  live.ts            # WorldOfficeLiveAdapter (go-live; endpoints documentados)
  adapter.ts         # interfaz + getAdapter() (decide mock|live por WO_MODE)
```

## WorldOfficeAdapter
- `getAdapter()` devuelve mock o live según `WO_MODE` (`mock` por defecto).
- El mock valida el **mismo** payload que el live (`validateWOPayload`).
- Para demostrar manejo de errores: `WO_MOCK_FORCE_ERROR=TERCERO_ERRADO` (o cualquier
  código de `errors.ts`) hace que el mock devuelva ese error.
- Idempotencia: el mock detecta duplicados por `prefijo+idEmpresa+documentoTipo+numero`.
