// Genera apps/web/content/instructivo.generated.ts a partir de los markdown
// canónicos de docs/. Única fuente de verdad: los .md. El módulo TS resultante
// embebe el contenido como strings (JSON-escapados) para que el bundle de Vercel
// lo incluya siempre, sin lecturas de archivos en runtime.
//
// Uso: node scripts/gen-instructivo.mjs   (desde apps/web)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raizRepo = join(aqui, "..", "..", "..");
const docs = join(raizRepo, "docs");

const FUENTES = {
  onboarding: join(docs, "manual-onboarding.md"),
  worldoffice: join(docs, "integracion-world-office.md"),
};

const entradas = Object.entries(FUENTES)
  .map(([clave, ruta]) => `  ${clave}: ${JSON.stringify(readFileSync(ruta, "utf8"))},`)
  .join("\n");

const salida = `// GENERADO por scripts/gen-instructivo.mjs — NO editar a mano.
// Fuente de verdad: docs/manual-onboarding.md y docs/integracion-world-office.md.
// Regenerar con: node scripts/gen-instructivo.mjs
export const INSTRUCTIVO = {
${entradas}
} as const;
`;

const destino = join(aqui, "..", "content", "instructivo.generated.ts");
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, salida, "utf8");
console.log("Generado:", destino);
