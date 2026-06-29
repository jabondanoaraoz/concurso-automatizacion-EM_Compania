// Tests del núcleo determinista de mapeo Supabase → WorldOffice (sección 8).
// Cubre buildWOPayload (mapeo campo a campo + resolver mock/live),
// validateWOPayload (cada campo blinda su error) e idempotencyKey.
import { describe, it, expect } from "vitest";
import {
  buildWOPayload,
  validateWOPayload,
  idempotencyKey,
  type PedidoWOInput,
} from "../mapping";
import { WOValidationError } from "../errors";
import type { WOPedidoPayload } from "../types";

// Entrada base con TODOS los wo_id_* reales (como sería en go-live / live).
function inputCompleto(): PedidoWOInput {
  return {
    empresa: {
      woIdEmpresa: "EMP-1",
      documentoTipoPedido: "DOC-PEDIDO",
      formaPago: "contado",
      moneda: "COP",
      bodegaDefault: "BOD-1",
      centroCostoDefault: "CC-1",
    },
    cliente: {
      woIdTercero: "TER-1",
      woIdDireccion: "DIR-1",
      descuentoPct: 10,
    },
    prefijo: "PED",
    numero: "5",
    fecha: "2026-06-29",
    renglones: [
      {
        woIdInventario: "INV-1",
        woIdUnidad: "UND-1",
        woIdImpuesto: "IMP-1",
        codigoContable: "0100178",
        cantidad: 3,
        valorUnitario: 1000,
        descuentoPct: 10,
      },
    ],
  };
}

describe("buildWOPayload — mapeo campo a campo", () => {
  it("mapea cabecera y renglones con los wo_id reales (modo live)", () => {
    const p = buildWOPayload(inputCompleto(), "live");
    expect(p.documentoTipo).toBe("DOC-PEDIDO");
    expect(p.idEmpresa).toBe("EMP-1");
    expect(p.prefijo).toBe("PED");
    expect(p.numero).toBe("5");
    expect(p.fecha).toBe("2026-06-29");
    expect(p.idTerceroExterno).toBe("TER-1");
    expect(p.idDireccionTercero).toBe("DIR-1");
    expect(p.formaPago).toBe("contado");
    expect(p.idMoneda).toBe("COP");
    expect(p.renglones).toHaveLength(1);
    const r = p.renglones[0];
    expect(r.idInventario).toBe("INV-1");
    expect(r.unidadMedida).toBe("UND-1");
    expect(r.idImpuesto).toBe("IMP-1");
    expect(r.idBodega).toBe("BOD-1");
    expect(r.idCentroCosto).toBe("CC-1");
    expect(r.cantidad).toBe(3);
    expect(r.valorUnitario).toBe(1000);
    expect(r.porcentajeDescuento).toBe(10);
  });

  it("en mock sustituye los wo_id null por IDs SIM-* deterministas", () => {
    const input = inputCompleto();
    // Vaciar todos los wo_id para simular el estado pre-go-live.
    input.empresa.woIdEmpresa = null;
    input.empresa.documentoTipoPedido = null;
    input.empresa.bodegaDefault = null;
    input.empresa.centroCostoDefault = null;
    input.cliente.woIdTercero = null;
    input.cliente.woIdDireccion = null;
    input.renglones[0].woIdInventario = null;
    input.renglones[0].woIdUnidad = null;
    input.renglones[0].woIdImpuesto = null;

    const p = buildWOPayload(input, "mock");
    expect(p.idEmpresa).toBe("SIM-EMPRESA");
    expect(p.documentoTipo).toBe("SIM-PEDIDO");
    expect(p.idTerceroExterno).toBe("SIM-TERCERO");
    expect(p.idDireccionTercero).toBe("SIM-DIR");
    // El id simulado del inventario se deriva del codigo_contable (trazable).
    expect(p.renglones[0].idInventario).toBe("SIM-INV-0100178");
    expect(p.renglones[0].unidadMedida).toBe("SIM-UND-0100178");
    expect(p.renglones[0].idBodega).toBe("SIM-BODEGA");
    expect(p.renglones[0].idCentroCosto).toBe("SIM-CC");
  });

  it("el codigo_contable SIEMPRE viaja: aparece en el id simulado del renglón", () => {
    const input = inputCompleto();
    input.renglones[0].woIdInventario = null;
    input.renglones[0].codigoContable = "0299999";
    const p = buildWOPayload(input, "mock");
    expect(p.renglones[0].idInventario).toContain("0299999");
  });

  it("en live, un wo_id null lanza WOValidationError con el código que ese campo previene", () => {
    const input = inputCompleto();
    input.cliente.woIdTercero = null;
    try {
      buildWOPayload(input, "live");
      throw new Error("debió lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(WOValidationError);
      expect((e as WOValidationError).code).toBe("TERCERO_ERRADO");
    }
  });

  it("en live, inventario null → INVENTARIO_NO_ENCONTRADO", () => {
    const input = inputCompleto();
    input.renglones[0].woIdInventario = null;
    expect(() => buildWOPayload(input, "live")).toThrowError(WOValidationError);
    try {
      buildWOPayload(input, "live");
    } catch (e) {
      expect((e as WOValidationError).code).toBe("INVENTARIO_NO_ENCONTRADO");
    }
  });
});

describe("validateWOPayload — cada campo blinda su error WO", () => {
  function payloadValido(): WOPedidoPayload {
    return buildWOPayload(inputCompleto(), "live");
  }

  it("acepta un payload completo sin lanzar", () => {
    expect(() => validateWOPayload(payloadValido())).not.toThrow();
  });

  const casos: Array<[keyof WOPedidoPayload, string]> = [
    ["documentoTipo", "TIPO_DOCUMENTO_NO_ADMITO_API"],
    ["idEmpresa", "EMPRESA_ERRADA"],
    ["prefijo", "PREFIJO_FACTURA_ERRADO"],
    ["numero", "DUPLICATE_KEY"],
    ["idTerceroExterno", "TERCERO_ERRADO"],
    ["idDireccionTercero", "DIRRECCION_TERCERO_EXTERNO_ERRADO"],
    ["formaPago", "FORMA_PAGO_NO_SOPORTADA"],
    ["idMoneda", "ERROR_MONEDA"],
  ];
  for (const [campo, code] of casos) {
    it(`cabecera: ${campo} vacío → ${code}`, () => {
      const p = payloadValido();
      (p as unknown as Record<string, unknown>)[campo] = "";
      try {
        validateWOPayload(p);
        throw new Error("debió lanzar");
      } catch (e) {
        expect(e).toBeInstanceOf(WOValidationError);
        expect((e as WOValidationError).code).toBe(code);
      }
    });
  }

  it("sin renglones → INVENTARIO_NO_ENCONTRADO", () => {
    const p = payloadValido();
    p.renglones = [];
    try {
      validateWOPayload(p);
      throw new Error("debió lanzar");
    } catch (e) {
      expect((e as WOValidationError).code).toBe("INVENTARIO_NO_ENCONTRADO");
    }
  });

  const casosRenglon: Array<[string, string]> = [
    ["idInventario", "INVENTARIO_NO_ENCONTRADO"],
    ["unidadMedida", "ERROR_UNIDAD_INVENTARIO"],
    ["idBodega", "BODEGA_NO_EXISTE"],
    ["idCentroCosto", "CENTRO_COSTO_NO_EXISTE"],
  ];
  for (const [campo, code] of casosRenglon) {
    it(`renglón: ${campo} vacío → ${code}`, () => {
      const p = payloadValido();
      (p.renglones[0] as unknown as Record<string, unknown>)[campo] = "";
      try {
        validateWOPayload(p);
        throw new Error("debió lanzar");
      } catch (e) {
        expect((e as WOValidationError).code).toBe(code);
      }
    });
  }

  it("cantidad <= 0 → INVENTARIO_NO_ENCONTRADO", () => {
    const p = payloadValido();
    p.renglones[0].cantidad = 0;
    try {
      validateWOPayload(p);
      throw new Error("debió lanzar");
    } catch (e) {
      expect((e as WOValidationError).code).toBe("INVENTARIO_NO_ENCONTRADO");
    }
  });
});

describe("idempotencyKey — regla de duplicado de WO", () => {
  it("compone prefijo::idEmpresa::documentoTipo::numero", () => {
    const p = buildWOPayload(inputCompleto(), "live");
    expect(idempotencyKey(p)).toBe("PED::EMP-1::DOC-PEDIDO::5");
  });

  it("es estable para el mismo pedido y distinta entre números", () => {
    const a = buildWOPayload(inputCompleto(), "live");
    const input2 = inputCompleto();
    input2.numero = "6";
    const b = buildWOPayload(input2, "live");
    expect(idempotencyKey(a)).toBe(idempotencyKey(a));
    expect(idempotencyKey(a)).not.toBe(idempotencyKey(b));
  });
});
