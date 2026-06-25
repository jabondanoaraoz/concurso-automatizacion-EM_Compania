// Intérprete de consultas del agente de búsqueda (sección 7).
// Reescribe consultas ambiguas/abreviadas del vendedor a términos del catálogo
// (ej. "sello 7/8 res corto" → "sello 7/8 resorte corto carbón cerámica").
//
// Es un STAND-IN determinista del nodo LLM: sin IA, sin keys, funciona ya.
// La versión de producción (LLM que interpreta + búsqueda vectorial sobre
// embeddings) entra por el flujo n8n `agenteBusqueda` cuando haya EMBEDDINGS_API_KEY.
// En cualquier caso, el agente SOLO SUGIERE: el vendedor confirma, el código ejecuta.

const EXPANSIONES: Record<string, string> = {
  res: "resorte",
  cap: "capacitor",
  capac: "capacitor",
  ceram: "cerámica",
  ceramica: "cerámica",
  graf: "grafito",
  grafito: "grafito",
  tungs: "tungsteno",
  carb: "carbón",
  carbon: "carbón",
  ref: "refrigeración",
  refrig: "refrigeración",
  comp: "compresor",
  term: "termostato",
  cont: "contactor",
  mec: "mecánico",
  mecanico: "mecánico",
};

export function interpretarConsulta(q: string): string {
  const limpio = (q ?? "").toLowerCase().trim().replace(/\s+/g, " ");
  if (!limpio) return "";
  const palabras = limpio.split(" ").map((p) => EXPANSIONES[p] ?? p);
  // Deduplicar conservando orden.
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const w of palabras) {
    if (!vistas.has(w)) {
      vistas.add(w);
      out.push(w);
    }
  }
  return out.join(" ");
}
