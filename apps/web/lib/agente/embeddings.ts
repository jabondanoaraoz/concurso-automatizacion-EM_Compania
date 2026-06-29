// Embedding de la consulta del vendedor (OpenAI text-embedding-3-small, 1536-dim).
// Server-only. Devuelve el vector como string '[...]' listo para la RPC
// buscar_semantica, o null si no hay key / falla (el agente cae a léxico).
// Robusto: timeout explícito, 1 reintento y sin caché (la respuesta no se reusa);
// loguea el motivo del fallo para diagnóstico en los logs de la función.

const MODEL = "text-embedding-3-small";
const TIMEOUT_MS = 8000;

async function pedirEmbedding(texto: string, key: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, input: texto }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[embedQuery] OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const j = (await res.json()) as { data?: { embedding: number[] }[] };
    if (!j.data?.[0]) {
      console.error("[embedQuery] respuesta de OpenAI sin data.");
      return null;
    }
    return "[" + j.data[0].embedding.join(",") + "]";
  } finally {
    clearTimeout(t);
  }
}

export async function embedQuery(texto: string): Promise<string | null> {
  const key = process.env.EMBEDDINGS_API_KEY;
  const q = (texto ?? "").trim();
  if (!key || !q) return null;
  // 2 intentos: un fallo puntual (timeout/red/429) no debe degradar a léxico.
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const vec = await pedirEmbedding(q, key);
      if (vec) return vec;
    } catch (e) {
      console.error(`[embedQuery] intento ${intento} falló:`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}
