// ============================================================================
// WorldOffice — Adapter (anti-corruption layer, sección 8).
// Único punto que conoce el formato de WO. getAdapter() decide mock|live por
// WO_MODE. La interfaz es idéntica en ambos modos.
// ============================================================================

import type {
  WODocTipo,
  WOInventario,
  WOPedidoPayload,
  WOResult,
  WOTercero,
} from "./types";

export interface WorldOfficeAdapter {
  authenticate(): Promise<string>; // JWT (12h), header "WO <token>"
  listarTiposDocumento(): Promise<WODocTipo[]>;
  listarInventarios(): Promise<WOInventario[]>; // reconciliar IDs en go-live
  listarTerceros(): Promise<WOTercero[]>;
  crearPedido(p: WOPedidoPayload): Promise<WOResult>;
}

export function getAdapter(): WorldOfficeAdapter {
  // Import perezoso para evitar cargar el live (con fetch a WO) en modo mock.
  if (process.env.WO_MODE === "live") {
    const { WorldOfficeLiveAdapter } = require("./live") as typeof import("./live");
    return new WorldOfficeLiveAdapter();
  }
  const { WorldOfficeMockAdapter } = require("./mock") as typeof import("./mock");
  return new WorldOfficeMockAdapter();
}
