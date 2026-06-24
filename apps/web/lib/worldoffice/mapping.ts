// ============================================================================
// WorldOffice — Mapeo determinista Supabase → WOPedidoPayload (sección 8).
// CERO IA: pura transformación de datos congelados (snapshots) a payload.
// Reusado por el camino crítico (n8n) y por el módulo generador (sección 10),
// para que lo que se muestra y lo que se enviaría sean idénticos.
// ============================================================================

import type { WOMode, WOPedidoPayload, WORenglon } from "./types";
import { CAMPO_A_ERROR, WOValidationError, type WOErrorCode } from "./errors";

// Datos de entrada = lo ya congelado en Supabase (config empresa + cliente +
// snapshots de cada línea). Los wo_id_* pueden ser null antes del go-live.
export interface EmpresaWOConfig {
  woIdEmpresa: string | null;
  documentoTipoPedido: string | null;
  formaPago: string;
  moneda: string;
  bodegaDefault: string | null;
  centroCostoDefault: string | null;
}

export interface ClienteWOData {
  woIdTercero: string | null;
  woIdDireccion: string | null;
  descuentoPct: number;
}

export interface RenglonInput {
  woIdInventario: string | null; // snapshot del producto
  woIdUnidad: string | null;
  woIdImpuesto: string | null;
  codigoContable: string; // SIEMPRE viaja: trazabilidad + base del id simulado
  cantidad: number;
  valorUnitario: number;
  descuentoPct: number;
}

export interface PedidoWOInput {
  empresa: EmpresaWOConfig;
  cliente: ClienteWOData;
  prefijo: string;
  numero: string;
  fecha: string; // YYYY-MM-DD
  renglones: RenglonInput[];
}

// En modo mock, los wo_id_* aún no existen (se reconcilian en go-live, 19.3).
// Para demostrar un payload completo, sustituimos los null por IDs SIMULADOS
// deterministas y namespaced. En live, un id null es un error de validación.
function resolver(
  valor: string | null,
  campo: string,
  simuladoSeed: string,
  mode: WOMode
): string {
  if (valor && valor.trim() !== "") return valor;
  if (mode === "mock") return `SIM-${simuladoSeed}`;
  const code = CAMPO_A_ERROR[campo] as WOErrorCode | undefined;
  throw new WOValidationError(campo, code ?? "EMPRESA_ERRADA");
}

export function buildWOPayload(input: PedidoWOInput, mode: WOMode): WOPedidoPayload {
  const { empresa, cliente } = input;

  const renglones: WORenglon[] = input.renglones.map((r, i) => ({
    idInventario: resolver(r.woIdInventario, "idInventario", `INV-${r.codigoContable}`, mode),
    unidadMedida: resolver(r.woIdUnidad, "unidadMedida", `UND-${r.codigoContable}`, mode),
    cantidad: r.cantidad,
    valorUnitario: r.valorUnitario,
    porcentajeDescuento: r.descuentoPct,
    idBodega: resolver(empresa.bodegaDefault, "idBodega", "BODEGA", mode),
    idCentroCosto: resolver(empresa.centroCostoDefault, "idCentroCosto", "CC", mode),
    idImpuesto: resolver(r.woIdImpuesto, "idImpuesto", `IMP-${i}`, mode),
  }));

  return {
    documentoTipo: resolver(empresa.documentoTipoPedido, "documentoTipo", "PEDIDO", mode),
    idEmpresa: resolver(empresa.woIdEmpresa, "idEmpresa", "EMPRESA", mode),
    prefijo: input.prefijo,
    numero: input.numero,
    fecha: input.fecha,
    idTerceroExterno: resolver(cliente.woIdTercero, "idTerceroExterno", "TERCERO", mode),
    idDireccionTercero: resolver(cliente.woIdDireccion, "idDireccionTercero", "DIR", mode),
    formaPago: empresa.formaPago,
    idMoneda: empresa.moneda,
    renglones,
  };
}

// Validación server-side antes de cualquier POST a WO (sección 13).
// Lanza WOValidationError con el código de WO que el campo previene.
export function validateWOPayload(p: WOPedidoPayload): void {
  const requeridos: Array<[string, string]> = [
    ["documentoTipo", p.documentoTipo],
    ["idEmpresa", p.idEmpresa],
    ["prefijo", p.prefijo],
    ["numero", p.numero],
    ["idTerceroExterno", p.idTerceroExterno],
    ["idDireccionTercero", p.idDireccionTercero],
    ["formaPago", p.formaPago],
    ["idMoneda", p.idMoneda],
  ];
  for (const [campo, valor] of requeridos) {
    if (!valor || valor.trim() === "") {
      const code = CAMPO_A_ERROR[campo] as WOErrorCode | undefined;
      throw new WOValidationError(campo, code ?? "EMPRESA_ERRADA");
    }
  }
  if (!Array.isArray(p.renglones) || p.renglones.length === 0) {
    throw new WOValidationError("renglones", "INVENTARIO_NO_ENCONTRADO", "El pedido no tiene renglones.");
  }
  p.renglones.forEach((r, i) => {
    const reqs: Array<[string, string]> = [
      ["idInventario", r.idInventario],
      ["unidadMedida", r.unidadMedida],
      ["idBodega", r.idBodega],
      ["idCentroCosto", r.idCentroCosto],
      ["idImpuesto", r.idImpuesto],
    ];
    for (const [campo, valor] of reqs) {
      if (!valor || valor.trim() === "") {
        const code = CAMPO_A_ERROR[campo] as WOErrorCode | undefined;
        throw new WOValidationError(`renglones[${i}].${campo}`, code ?? "INVENTARIO_NO_ENCONTRADO");
      }
    }
    if (!(r.cantidad > 0)) {
      throw new WOValidationError(`renglones[${i}].cantidad`, "INVENTARIO_NO_ENCONTRADO", "Cantidad inválida.");
    }
  });
}

// Idempotencia (sección 8): WO marca duplicado por
// prefijo + idEmpresa + documentoTipo + numero. La key reproduce esa regla.
export function idempotencyKey(p: WOPedidoPayload): string {
  return [p.prefijo, p.idEmpresa, p.documentoTipo, p.numero].join("::");
}
