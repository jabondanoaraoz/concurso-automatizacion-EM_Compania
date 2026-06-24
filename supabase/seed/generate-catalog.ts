// ============================================================================
// EM-Pedidos — Generador de catálogo de muestra (sección 6 del Build Spec).
// Genera 150 SKUs reproducibles (PRNG con semilla) y emite catalog.sql con los
// INSERT idempotentes. Muestra generada con IA/heurística — el catálogo real lo
// depura/migra el equipo de World Office (documentado en el manual).
//
// Uso:  node supabase/seed/generate-catalog.ts   →  escribe supabase/seed/catalog.sql
//
// SUPUESTO codigo_contable: en esta muestra el código contable ESPEJA al
// codigo_interno (se documenta así). En go-live, WO entrega el código contable
// real durante la reconciliación de IDs (sección 19.3); aquí solo es un placeholder
// trazable que SIEMPRE viaja en los snapshots.
// ============================================================================

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// PRNG determinista (mulberry32) — catálogo estable entre corridas.
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260624);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const intBetween = (a: number, b: number): number => a + Math.floor(rnd() * (b - a + 1));
const sqlStr = (s: string): string => "'" + s.replace(/'/g, "''") + "'";

type Familia = "sello_mecanico" | "capacitor" | "refrigeracion";
const PREFIJO: Record<Familia, string> = {
  sello_mecanico: "01",
  capacitor: "02",
  refrigeracion: "03",
};

interface Producto {
  codigo_interno: string;
  descripcion: string;
  familia: Familia;
  atributos: Record<string, unknown>;
  unidad_medida: string;
  precio_lista: number;
  iva_pct: number;
  stock: number;
  codigo_contable: string;
}

// ---- Vocabularios por familia ----
const OCTAVOS = ['3/8"', '1/2"', '5/8"', '3/4"', '7/8"', '1"', '1 1/4"', '1 3/8"', '1 3/4"', '2"'];
const RESORTES = ["corto", "largo"];
const MAT_SELLO = ["carbón/cerámica", "carbón/tungsteno", "cerámica/grafito", "silicio/silicio"];
const MARCAS_SELLO = ["Parxial", "EM-Seal", "Burgmann", "Roten"];
const APLIC_SELLO = ["bomba centrífuga", "motobomba", "bomba sumergible", "compresor de agua"];

const TIPO_CAP = ["marcha", "arranque"];
const UF = [5, 7.5, 10, 12.5, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80];
const VOLT_CAP = [250, 370, 440];
const TERMINAL = ["faston", "tornillo", "cable"];

const SUBFAM_REF = [
  "compresor",
  "filtro_secador",
  "contactor",
  "termostato",
  "relay",
  "motor",
  "refrigerante",
] as const;
const GASES = ["R134a", "R410a", "R404a", "R22", "R600a"];
const VOLT_REF = [110, 220, 380];
const HP = [0.5, 0.75, 1, 1.5, 2, 3, 5];
const BTU = [9000, 12000, 18000, 24000, 36000];
const MARCAS_REF = ["Tecumseh", "Embraco", "Danfoss", "Elco", "EM-Cool"];

function genSello(n: number): Producto {
  const tamano = pick(OCTAVOS);
  const resorte = pick(RESORTES);
  const material = pick(MAT_SELLO);
  const marca = pick(MARCAS_SELLO);
  const aplicacion = pick(APLIC_SELLO);
  const codigo = PREFIJO.sello_mecanico + String(n).padStart(5, "0");
  return {
    codigo_interno: codigo,
    descripcion: `Sello mecánico ${tamano} resorte ${resorte} ${material} ${marca}`,
    familia: "sello_mecanico",
    atributos: { tamano, resorte, material, marca, aplicacion },
    unidad_medida: "UND",
    precio_lista: intBetween(18, 220) * 1000,
    iva_pct: 19,
    stock: intBetween(0, 80),
    codigo_contable: codigo,
  };
}

function genCapacitor(n: number): Producto {
  const tipo = pick(TIPO_CAP);
  const uf = pick(UF);
  const voltaje = pick(VOLT_CAP);
  const terminal = pick(TERMINAL);
  const codigo = PREFIJO.capacitor + String(n).padStart(5, "0");
  return {
    codigo_interno: codigo,
    descripcion: `Capacitor de ${tipo} ${uf} µF ${voltaje}V ${terminal}`,
    familia: "capacitor",
    atributos: { tipo, capacitancia_uf: uf, voltaje_v: voltaje, tolerancia_pct: 5, terminal },
    unidad_medida: "UND",
    precio_lista: intBetween(8, 90) * 1000,
    iva_pct: 19,
    stock: intBetween(0, 150),
    codigo_contable: codigo,
  };
}

function genRefrigeracion(n: number): Producto {
  const sub = pick([...SUBFAM_REF]);
  const codigo = PREFIJO.refrigeracion + String(n).padStart(5, "0");
  let descripcion = "";
  const specs: Record<string, unknown> = {};
  const marca = pick(MARCAS_REF);
  if (sub === "compresor" || sub === "motor") {
    const hp = pick(HP);
    const gas = pick(GASES);
    const v = pick(VOLT_REF);
    specs.hp = hp;
    specs.gas = gas;
    specs.voltaje_v = v;
    descripcion = `${sub === "compresor" ? "Compresor" : "Motor"} ${hp} HP ${gas} ${v}V ${marca}`;
  } else if (sub === "refrigerante") {
    const gas = pick(GASES);
    specs.gas = gas;
    specs.presentacion = "cilindro";
    descripcion = `Refrigerante ${gas} cilindro ${marca}`;
  } else if (sub === "termostato" || sub === "relay" || sub === "contactor") {
    const v = pick(VOLT_REF);
    specs.voltaje_v = v;
    descripcion = `${sub.charAt(0).toUpperCase() + sub.slice(1)} ${v}V ${marca}`;
  } else {
    // filtro_secador
    const btu = pick(BTU);
    specs.btu = btu;
    descripcion = `Filtro secador ${btu} BTU ${marca}`;
  }
  return {
    codigo_interno: codigo,
    descripcion,
    familia: "refrigeracion",
    atributos: { subfamilia: sub, marca, specs },
    unidad_medida: "UND",
    precio_lista: intBetween(10, 600) * 1000,
    iva_pct: 19,
    stock: intBetween(0, 60),
    codigo_contable: codigo,
  };
}

function generar(): Producto[] {
  const productos: Producto[] = [];
  for (let i = 1; i <= 60; i++) productos.push(genSello(i)); // 40%
  for (let i = 1; i <= 45; i++) productos.push(genCapacitor(i)); // 30%
  for (let i = 1; i <= 45; i++) productos.push(genRefrigeracion(i)); // 30%
  return productos;
}

function toSQL(productos: Producto[]): string {
  const valores = productos
    .map((p) => {
      const atributos = sqlStr(JSON.stringify(p.atributos));
      return `(${sqlStr(p.codigo_interno)}, ${sqlStr(p.descripcion)}, ${sqlStr(p.familia)}::familia_producto, ${atributos}::jsonb, ${sqlStr(p.unidad_medida)}, ${p.precio_lista}, ${p.iva_pct}, ${p.stock}, ${sqlStr(p.codigo_contable)})`;
    })
    .join(",\n");
  return `-- Catálogo de muestra (150 SKUs) generado por generate-catalog.ts. NO editar a mano.
-- wo_id_* quedan en null: se reconcilian al cablear WO (sección 19.3).
insert into productos
  (codigo_interno, descripcion, familia, atributos, unidad_medida, precio_lista, iva_pct, stock, codigo_contable)
values
${valores}
on conflict (codigo_interno) do nothing;
`;
}

const productos = generar();
const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "catalog.sql");
writeFileSync(out, toSQL(productos), "utf8");
console.log(`Generados ${productos.length} productos → ${out}`);
