// Tests de la tabla de errores documentados de WO (sección 8).
// Garantiza completitud: 12 códigos, cada uno con mensaje y con su campo del payload.
import { describe, it, expect } from "vitest";
import {
  CAMPO_A_ERROR,
  MENSAJES_ERROR,
  WOValidationError,
  type WOErrorCode,
} from "../errors";

const CODIGOS: WOErrorCode[] = [
  "EMPRESA_ERRADA",
  "TIPO_DOCUMENTO_NO_ADMITO_API",
  "PREFIJO_FACTURA_ERRADO",
  "DUPLICATE_KEY",
  "TERCERO_ERRADO",
  "DIRRECCION_TERCERO_EXTERNO_ERRADO",
  "FORMA_PAGO_NO_SOPORTADA",
  "ERROR_MONEDA",
  "INVENTARIO_NO_ENCONTRADO",
  "ERROR_UNIDAD_INVENTARIO",
  "BODEGA_NO_EXISTE",
  "CENTRO_COSTO_NO_EXISTE",
];

describe("errores documentados de WO", () => {
  it("hay un mensaje en español para los 12 códigos", () => {
    expect(Object.keys(MENSAJES_ERROR)).toHaveLength(12);
    for (const code of CODIGOS) {
      expect(MENSAJES_ERROR[code]).toBeTruthy();
      expect(typeof MENSAJES_ERROR[code]).toBe("string");
    }
  });

  it("CAMPO_A_ERROR mapea los campos clave del payload a un código válido", () => {
    const camposEsperados = [
      "idEmpresa",
      "documentoTipo",
      "prefijo",
      "numero",
      "idTerceroExterno",
      "idDireccionTercero",
      "formaPago",
      "idMoneda",
      "idInventario",
      "unidadMedida",
      "idBodega",
      "idCentroCosto",
    ];
    for (const campo of camposEsperados) {
      const code = CAMPO_A_ERROR[campo];
      expect(code, `falta mapeo para ${campo}`).toBeTruthy();
      expect(CODIGOS).toContain(code);
    }
  });

  it("WOValidationError expone code, campo y mensaje por defecto del código", () => {
    const err = new WOValidationError("idInventario", "INVENTARIO_NO_ENCONTRADO");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("WOValidationError");
    expect(err.code).toBe("INVENTARIO_NO_ENCONTRADO");
    expect(err.campo).toBe("idInventario");
    expect(err.message).toBe(MENSAJES_ERROR.INVENTARIO_NO_ENCONTRADO);
  });

  it("WOValidationError admite mensaje personalizado", () => {
    const err = new WOValidationError("renglones", "INVENTARIO_NO_ENCONTRADO", "sin renglones");
    expect(err.message).toBe("sin renglones");
  });
});
