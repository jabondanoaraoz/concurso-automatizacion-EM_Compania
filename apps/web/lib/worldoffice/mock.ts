// ============================================================================
// WorldOffice — Mock adapter (sección 8).
// Valida el MISMO payload que el live, simula éxito/error y detecta duplicados
// por idempotency_key. Persistencia real (wo_payload/wo_response) la hace el
// camino crítico en Supabase; aquí solo se simula la respuesta de WO.
// ============================================================================

import type {
  WODocTipo,
  WOInventario,
  WOPedidoPayload,
  WOResult,
  WOTercero,
} from "./types";
import { MENSAJES_ERROR, WOValidationError, type WOErrorCode } from "./errors";
import { idempotencyKey, validateWOPayload } from "./mapping";
import type { WorldOfficeAdapter } from "./adapter";

// Memoria de duplicados para demostrar idempotencia dentro de un proceso.
// La garantía dura está en el unique constraint de Supabase (pedidos.idempotency_key).
const vistos = new Set<string>();

export class WorldOfficeMockAdapter implements WorldOfficeAdapter {
  async authenticate(): Promise<string> {
    return "MOCK-TOKEN";
  }

  async listarTiposDocumento(): Promise<WODocTipo[]> {
    return [
      { id: "SIM-PEDIDO", nombre: "Pedido", admiteApi: true },
      { id: "SIM-FACTURA", nombre: "Factura de venta", admiteApi: true },
    ];
  }

  async listarInventarios(): Promise<WOInventario[]> {
    return [];
  }

  async listarTerceros(): Promise<WOTercero[]> {
    return [];
  }

  async crearPedido(p: WOPedidoPayload): Promise<WOResult> {
    // 1) Misma validación que el live.
    try {
      validateWOPayload(p);
    } catch (e) {
      if (e instanceof WOValidationError) {
        return { ok: false, errorCode: e.code, moreInfo: `${e.campo}: ${e.message}` };
      }
      throw e;
    }

    // 2) Simulación de error forzada (demo de manejo de errores de WO).
    //    WO_MOCK_FORCE_ERROR=TERCERO_ERRADO, etc.
    const forzar = process.env.WO_MOCK_FORCE_ERROR as WOErrorCode | undefined;
    if (forzar && MENSAJES_ERROR[forzar]) {
      return { ok: false, errorCode: forzar, moreInfo: MENSAJES_ERROR[forzar] };
    }

    // 3) Idempotencia: mismo prefijo+empresa+tipo+numero → duplicado.
    const key = idempotencyKey(p);
    if (vistos.has(key)) {
      return { ok: false, errorCode: "DUPLICATE_KEY", moreInfo: MENSAJES_ERROR.DUPLICATE_KEY };
    }
    vistos.add(key);

    // 4) Éxito: WO devolvería el número del documento creado.
    const numero = `${p.prefijo}-${p.numero}`;
    return {
      ok: true,
      numero,
      raw: { simulado: true, documentoTipo: p.documentoTipo, numero, renglones: p.renglones.length },
    };
  }
}
