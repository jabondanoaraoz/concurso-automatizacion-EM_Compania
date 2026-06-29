// Calcula embeddings (OpenAI text-embedding-3-small, 1536-dim) del catálogo y los
// guarda en productos.embedding (sección 6). Embebe descripción + familia +
// valores de atributos (jsonb), para que términos como la aplicación ("bomba
// centrífuga") —que viven en atributos y no en la descripción— pesen en la
// búsqueda semántica. Self-contained: solo fetch + REST de Supabase.
//
// Uso (desde la raíz del repo):
//   node --env-file=apps/web/.env.local supabase/seed/embed-catalog.ts
//
// Requiere en el entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMBEDDINGS_API_KEY

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OA = process.env.EMBEDDINGS_API_KEY!;
const MODEL = "text-embedding-3-small";

const sbHeaders = {
  apikey: SR,
  Authorization: `Bearer ${SR}`,
  "Content-Type": "application/json",
};

async function embed(textos: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OA}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: textos }),
  });
  const j = (await res.json()) as { data?: { embedding: number[] }[]; error?: unknown };
  if (!j.data) throw new Error("OpenAI: " + JSON.stringify(j.error ?? j));
  return j.data.map((d) => d.embedding);
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

type Producto = {
  id: string;
  descripcion: string;
  familia: string;
  atributos: Record<string, unknown> | null;
};

const FAMILIA_LABEL: Record<string, string> = {
  sello_mecanico: "sello mecánico",
  capacitor: "capacitor",
  refrigeracion: "refrigeración",
};

// Aplana recursivamente los valores de atributos (incluye specs anidados).
function valoresAtributos(obj: unknown, acc: string[] = []): string[] {
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) valoresAtributos(v, acc);
  } else if (obj != null && obj !== "") {
    acc.push(String(obj));
  }
  return acc;
}

// Texto a embeber: descripción + familia legible + valores de atributos.
function textoEmbedding(p: Producto): string {
  const familia = FAMILIA_LABEL[p.familia] ?? p.familia;
  const attrs = valoresAtributos(p.atributos).join(" ");
  return `${p.descripcion}. ${familia}. ${attrs}`.trim();
}

// 1) Traer productos (con familia y atributos).
const resp = await fetch(
  `${SB}/rest/v1/productos?select=id,descripcion,familia,atributos&order=codigo_interno`,
  { headers: sbHeaders }
);
const productos = (await resp.json()) as Producto[];
console.log(`Productos: ${productos.length}`);

// 2) Embeber por lotes y actualizar.
let hechos = 0;
for (const lote of chunk(productos, 100)) {
  const embs = await embed(lote.map((p) => textoEmbedding(p)));
  await Promise.all(
    lote.map((p, i) =>
      fetch(`${SB}/rest/v1/productos?id=eq.${p.id}`, {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ embedding: "[" + embs[i].join(",") + "]" }),
      })
    )
  );
  hechos += lote.length;
  console.log(`Embebidos ${hechos}/${productos.length}`);
}
console.log("Listo: embeddings poblados.");
