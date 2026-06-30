// Genera PDFs con marca E.M. a partir de los markdown canónicos de docs/.
// Reusa @react-pdf/renderer (ya en deps) + remark (parser de react-markdown):
// misma fuente de verdad que el instructivo de la app, sin navegador headless.
//
// Uso: node scripts/gen-pdf.mjs   (desde apps/web)  → escribe en docs/pdf/

import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToFile } from "@react-pdf/renderer";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

const h = React.createElement;
const ACCENT = "#CC3527";
const aqui = dirname(fileURLToPath(import.meta.url));
const docs = join(aqui, "..", "..", "..", "docs");

const s = StyleSheet.create({
  page: { padding: 44, fontFamily: "Helvetica", fontSize: 10, color: "#1D1E20", lineHeight: 1.5 },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 18, marginBottom: 6, color: "#1D1E20" },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 13, marginTop: 14, marginBottom: 5, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#DADCE0", color: "#1D1E20" },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 10, marginBottom: 3 },
  p: { marginVertical: 4 },
  li: { flexDirection: "row", marginVertical: 1.5 },
  bullet: { width: 14, color: ACCENT },
  liBody: { flex: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
  italic: { fontFamily: "Helvetica-Oblique" },
  code: { fontFamily: "Courier", backgroundColor: "#E8EAEF" },
  pre: { backgroundColor: "#E8EAEF", borderRadius: 4, padding: 6, marginVertical: 6 },
  preText: { fontFamily: "Courier", fontSize: 9 },
  link: { color: ACCENT },
  quote: { borderLeftWidth: 3, borderLeftColor: ACCENT, paddingLeft: 8, marginVertical: 6, color: "#5F6368" },
  hr: { borderBottomWidth: 1, borderBottomColor: "#DADCE0", marginVertical: 8 },
  table: { marginVertical: 6, borderWidth: 1, borderColor: "#DADCE0", borderBottomWidth: 0, borderRightWidth: 0 },
  row: { flexDirection: "row" },
  cell: { flex: 1, padding: 4, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#DADCE0", fontSize: 9 },
  th: { backgroundColor: "#E8EAEF", fontFamily: "Helvetica-Bold" },
});

// Inline → array de <Text>/strings. La fuente se hereda y cada wrapper la sobrescribe.
function inline(node, key) {
  switch (node.type) {
    case "text": return node.value;
    case "strong": return h(Text, { key, style: s.bold }, node.children.map(inline));
    case "emphasis": return h(Text, { key, style: s.italic }, node.children.map(inline));
    case "inlineCode": return h(Text, { key, style: s.code }, node.value);
    case "link": return h(Text, { key, style: s.link }, node.children.map(inline));
    case "break": return "\n";
    default: return node.children ? node.children.map(inline) : (node.value ?? "");
  }
}
const inlineKids = (node) => (node.children ?? []).map((c, i) => inline(c, i));

// Bloque → elemento react-pdf.
function block(node, key) {
  switch (node.type) {
    case "heading": {
      const st = node.depth === 1 ? s.h1 : node.depth === 2 ? s.h2 : s.h3;
      return h(Text, { key, style: st }, inlineKids(node));
    }
    case "paragraph":
      return h(Text, { key, style: s.p }, inlineKids(node));
    case "list":
      return h(View, { key, style: { marginVertical: 4 } },
        node.children.map((li, i) =>
          h(View, { key: i, style: s.li }, [
            h(Text, { key: "b", style: s.bullet }, node.ordered ? `${(node.start ?? 1) + i}.` : "•"),
            h(View, { key: "c", style: s.liBody },
              li.children.map((c, j) => block(c, j))),
          ])
        ));
    case "code":
      return h(View, { key, style: s.pre }, h(Text, { style: s.preText }, node.value));
    case "blockquote":
      return h(View, { key, style: s.quote }, node.children.map((c, i) => block(c, i)));
    case "thematicBreak":
      return h(View, { key, style: s.hr });
    case "table": {
      const cols = node.children[0]?.children.length ?? 1;
      return h(View, { key, style: s.table },
        node.children.map((rowNode, ri) =>
          h(View, { key: ri, style: s.row, wrap: false },
            rowNode.children.map((cell, ci) =>
              h(Text, { key: ci, style: ri === 0 ? [s.cell, s.th] : s.cell, ...(cols ? {} : {}) },
                inlineKids(cell))
            ))
        ));
    }
    default:
      return node.children
        ? h(View, { key }, node.children.map((c, i) => block(c, i)))
        : null;
  }
}

function pdf(md) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md);
  return h(Document, null, h(Page, { size: "A4", style: s.page }, tree.children.map((n, i) => block(n, i))));
}

const FUENTES = [
  ["manual-onboarding.md", "manual-onboarding.pdf"],
  ["integracion-world-office.md", "integracion-world-office.pdf"],
];

const destino = join(docs, "pdf");
mkdirSync(destino, { recursive: true });
for (const [src, out] of FUENTES) {
  const md = readFileSync(join(docs, src), "utf8");
  await renderToFile(pdf(md), join(destino, out));
  console.log("Generado:", join("docs", "pdf", out));
}
