// ============================================================================
// WorldOffice — Errores documentados (sección 8 del Build Spec).
// Cada campo del payload tiene un error de WO que lo blinda. Esta tabla es la
// fuente para la validación (mapping.ts) y para la simulación de errores (mock).
// ============================================================================

export type WOErrorCode =
  | "EMPRESA_ERRADA"
  | "TIPO_DOCUMENTO_NO_ADMITO_API"
  | "PREFIJO_FACTURA_ERRADO"
  | "DUPLICATE_KEY"
  | "TERCERO_ERRADO"
  | "DIRRECCION_TERCERO_EXTERNO_ERRADO"
  | "FORMA_PAGO_NO_SOPORTADA"
  | "ERROR_MONEDA"
  | "INVENTARIO_NO_ENCONTRADO"
  | "ERROR_UNIDAD_INVENTARIO"
  | "BODEGA_NO_EXISTE"
  | "CENTRO_COSTO_NO_EXISTE";

// Campo del payload → error que se previene validándolo. Documenta el mapeo
// Supabase → WO de la sección 8.
export const CAMPO_A_ERROR: Record<string, WOErrorCode> = {
  idEmpresa: "EMPRESA_ERRADA",
  documentoTipo: "TIPO_DOCUMENTO_NO_ADMITO_API",
  prefijo: "PREFIJO_FACTURA_ERRADO",
  numero: "DUPLICATE_KEY",
  idTerceroExterno: "TERCERO_ERRADO",
  idDireccionTercero: "DIRRECCION_TERCERO_EXTERNO_ERRADO",
  formaPago: "FORMA_PAGO_NO_SOPORTADA",
  idMoneda: "ERROR_MONEDA",
  idInventario: "INVENTARIO_NO_ENCONTRADO",
  unidadMedida: "ERROR_UNIDAD_INVENTARIO",
  idBodega: "BODEGA_NO_EXISTE",
  idCentroCosto: "CENTRO_COSTO_NO_EXISTE",
};

export const MENSAJES_ERROR: Record<WOErrorCode, string> = {
  EMPRESA_ERRADA: "El idEmpresa no corresponde a una empresa válida en World Office.",
  TIPO_DOCUMENTO_NO_ADMITO_API: "El documentoTipo no admite creación por API.",
  PREFIJO_FACTURA_ERRADO: "El prefijo no existe o no aplica al tipo de documento.",
  DUPLICATE_KEY: "Ya existe un documento con prefijo + idEmpresa + documentoTipo + numero.",
  TERCERO_ERRADO: "El idTerceroExterno no corresponde a un tercero válido.",
  DIRRECCION_TERCERO_EXTERNO_ERRADO: "La dirección del tercero externo es inválida.",
  FORMA_PAGO_NO_SOPORTADA: "La forma de pago no está soportada.",
  ERROR_MONEDA: "La moneda indicada es inválida.",
  INVENTARIO_NO_ENCONTRADO: "El idInventario no existe en World Office.",
  ERROR_UNIDAD_INVENTARIO: "La unidad de medida del inventario es inválida.",
  BODEGA_NO_EXISTE: "La bodega indicada no existe.",
  CENTRO_COSTO_NO_EXISTE: "El centro de costo indicado no existe.",
};

export class WOValidationError extends Error {
  code: WOErrorCode;
  campo: string;
  constructor(campo: string, code: WOErrorCode, msg?: string) {
    super(msg ?? MENSAJES_ERROR[code]);
    this.name = "WOValidationError";
    this.code = code;
    this.campo = campo;
  }
}
