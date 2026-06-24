// ============================================================================
// WorldOffice — Live adapter (sección 8). Se activa en go-live (WO_MODE=live).
// Endpoints documentados; las llamadas reales se ejecutan contra el tenant de
// E.M. cuando WO_BASE_URL/WO_CORREO_REGISTRADO estén configurados (sección 19.3).
// ============================================================================

import type {
  WODocTipo,
  WOInventario,
  WOPedidoPayload,
  WOResult,
  WOTercero,
} from "./types";
import { validateWOPayload } from "./mapping";
import { WOValidationError } from "./errors";
import type { WorldOfficeAdapter } from "./adapter";

function baseUrl(): string {
  const url = process.env.WO_BASE_URL;
  if (!url) {
    // Por-tenant; la doc muestra localhost:8080 como placeholder (sección 8/18).
    throw new Error("WO_BASE_URL no configurado: requerido en modo live (ver docs/PREGUNTAS-CLIENTE.md).");
  }
  return url.replace(/\/$/, "");
}

export class WorldOfficeLiveAdapter implements WorldOfficeAdapter {
  private token: string | null = process.env.WO_TOKEN ?? null;

  // Auth: POST /gestionarTokenAPILicencia (body text/plain con el correo
  // registrado) → JWT (12h). Header de cada request: "Authorization: WO <token>".
  async authenticate(): Promise<string> {
    const correo = process.env.WO_CORREO_REGISTRADO;
    if (!correo) throw new Error("WO_CORREO_REGISTRADO no configurado.");
    const res = await fetch(`${baseUrl()}/gestionarTokenAPILicencia`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: correo,
    });
    if (!res.ok) throw new Error(`Auth WO falló: ${res.status}`);
    const token = (await res.text()).trim();
    this.token = token;
    return token;
  }

  private async authHeader(): Promise<string> {
    if (!this.token) await this.authenticate();
    return `WO ${this.token}`;
  }

  async listarTiposDocumento(): Promise<WODocTipo[]> {
    const res = await fetch(`${baseUrl()}/documentos/tipos`, {
      headers: { Authorization: await this.authHeader() },
    });
    return (await res.json()) as WODocTipo[];
  }

  async listarInventarios(): Promise<WOInventario[]> {
    const res = await fetch(`${baseUrl()}/inventarios`, {
      headers: { Authorization: await this.authHeader() },
    });
    return (await res.json()) as WOInventario[];
  }

  async listarTerceros(): Promise<WOTercero[]> {
    const res = await fetch(`${baseUrl()}/terceros`, {
      headers: { Authorization: await this.authHeader() },
    });
    return (await res.json()) as WOTercero[];
  }

  async crearPedido(p: WOPedidoPayload): Promise<WOResult> {
    try {
      validateWOPayload(p);
    } catch (e) {
      if (e instanceof WOValidationError) {
        return { ok: false, errorCode: e.code, moreInfo: `${e.campo}: ${e.message}` };
      }
      throw e;
    }
    const res = await fetch(`${baseUrl()}/documentos/venta`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: await this.authHeader(),
      },
      body: JSON.stringify(p),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        errorCode: (raw as { errorCode?: string }).errorCode ?? `HTTP_${res.status}`,
        moreInfo: (raw as { moreInfo?: string }).moreInfo,
        raw,
      };
    }
    return { ok: true, numero: (raw as { numero?: string }).numero, raw };
  }
}
