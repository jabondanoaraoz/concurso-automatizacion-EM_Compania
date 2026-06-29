// Tests del WorldOfficeMockAdapter (sección 8): valida el mismo payload que el
// live, simula error forzado y detecta duplicados por idempotency_key.
// Nota: el adapter usa un Set de duplicados a nivel de módulo; cada test usa un
// `numero` único para no colisionar con otros.
import { describe, it, expect, afterEach } from "vitest";
import { WorldOfficeMockAdapter } from "../mock";
import { buildWOPayload, type PedidoWOInput } from "../mapping";

function input(numero: string): PedidoWOInput {
  return {
    empresa: {
      woIdEmpresa: "EMP-1",
      documentoTipoPedido: "DOC-PEDIDO",
      formaPago: "contado",
      moneda: "COP",
      bodegaDefault: "BOD-1",
      centroCostoDefault: "CC-1",
    },
    cliente: { woIdTercero: "TER-1", woIdDireccion: "DIR-1", descuentoPct: 0 },
    prefijo: "PED",
    numero,
    fecha: "2026-06-29",
    renglones: [
      {
        woIdInventario: "INV-1",
        woIdUnidad: "UND-1",
        woIdImpuesto: "IMP-1",
        codigoContable: "0100178",
        cantidad: 2,
        valorUnitario: 1500,
        descuentoPct: 0,
      },
    ],
  };
}

const adapter = new WorldOfficeMockAdapter();

afterEach(() => {
  delete process.env.WO_MOCK_FORCE_ERROR;
});

describe("WorldOfficeMockAdapter.crearPedido", () => {
  it("éxito: devuelve ok y un numero prefijo-numero", async () => {
    const p = buildWOPayload(input("1001"), "mock");
    const res = await adapter.crearPedido(p);
    expect(res.ok).toBe(true);
    expect(res.numero).toBe("PED-1001");
    expect((res.raw as { simulado?: boolean }).simulado).toBe(true);
  });

  it("idempotencia: segunda llamada con misma key → DUPLICATE_KEY", async () => {
    const p = buildWOPayload(input("1002"), "mock");
    const primera = await adapter.crearPedido(p);
    expect(primera.ok).toBe(true);
    const segunda = await adapter.crearPedido(p);
    expect(segunda.ok).toBe(false);
    expect(segunda.errorCode).toBe("DUPLICATE_KEY");
  });

  it("WO_MOCK_FORCE_ERROR fuerza el código pedido (manejo de errores)", async () => {
    process.env.WO_MOCK_FORCE_ERROR = "TERCERO_ERRADO";
    const p = buildWOPayload(input("1003"), "mock");
    const res = await adapter.crearPedido(p);
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe("TERCERO_ERRADO");
  });

  it("valida el payload igual que el live: payload inválido → errorCode, no excepción", async () => {
    const p = buildWOPayload(input("1004"), "mock");
    p.idTerceroExterno = ""; // romper un campo requerido
    const res = await adapter.crearPedido(p);
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe("TERCERO_ERRADO");
  });

  it("authenticate y listarTiposDocumento responden en mock", async () => {
    expect(await adapter.authenticate()).toBe("MOCK-TOKEN");
    const tipos = await adapter.listarTiposDocumento();
    expect(tipos.some((t) => t.nombre === "Pedido" && t.admiteApi)).toBe(true);
  });
});
