// Embedding de la consulta del vendedor (OpenAI text-embedding-3-small, 1536-dim).
// Server-only. Devuelve el vector como string '[...]' listo para la RPC
// buscar_semantica, o null si no hay key / falla (el agente cae a léxico).

const MODEL = "text-embedding-3-small";

export async function embedQuery(texto: string): Promise<string | null> {
  const key = process.env.EMBEDDINGS_API_KEY;
  if (!key || !texto.trim()) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, input: texto.trim() }),
    });
    const j = (await res.json()) as { data?: { embedding: number[] }[] };
    if (!j.data?.[0]) return null;
    return "[" + j.data[0].embedding.join(",") + "]";
  } catch {
    return null;
  }
}
