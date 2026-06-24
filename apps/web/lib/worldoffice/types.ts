// ============================================================================
// WorldOffice — Tipos del anti-corruption layer (sección 8 del Build Spec).
// Único lugar (junto con mapping/adapter) que conoce el formato de WO.
// ============================================================================

export interface WORenglon {
  idInventario: string;
  unidadMedida: string;
  cantidad: number;
  valorUnitario: number;
  porcentajeDescuento: number;
  idBodega: string;
  idCentroCosto: string;
  idImpuesto: string;
}

export interface WOPedidoPayload {
  documentoTipo: string; // tipo 'Pedido' de "Listar tipos de documentos"
  idEmpresa: string;
  prefijo: string;
  numero: string; // consecutivo controlado por nosotros
  fecha: string; // YYYY-MM-DD
  idTerceroExterno: string;
  idDireccionTercero: string;
  formaPago: string;
  idMoneda: string; // COP
  renglones: WORenglon[];
}

export interface WOResult {
  ok: boolean;
  numero?: string;
  raw?: unknown;
  errorCode?: string; // p.ej. INVENTARIO_NO_ENCONTRADO
  moreInfo?: string;
}

// Catálogos de reconciliación (se usan en go-live, sección 19.3).
export interface WODocTipo {
  id: string;
  nombre: string;
  admiteApi: boolean;
}
export interface WOInventario {
  id: string;
  codigo: string;
  descripcion: string;
  idUnidad: string;
  idImpuesto: string;
}
export interface WOTercero {
  id: string;
  nit: string;
  nombre: string;
  idDireccion: string;
}

export type WOMode = "mock" | "live";
