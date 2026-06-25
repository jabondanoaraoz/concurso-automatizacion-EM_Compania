// PDF de cotización/pedido con marca E.M. (sección 10 del Build Spec).
// Generación server-side con @react-pdf/renderer (sin headless browser).
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Tokens E.M. (sección 11).
const ACCENT = "#CC3527";
const INK = "#1D1E20";
const INK2 = "#5F6368";
const BORDER = "#DADCE0";
const BG2 = "#E8EAEF";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export interface LineaDoc {
  codigo: string;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  descuentoPct: number;
  totalLinea: number;
}
export interface DatosDocumento {
  empresaNombre: string;
  tipo: "Pedido" | "Cotización";
  numero: string;
  fecha: string;
  estado: string;
  numeroWo: string | null;
  clienteNombre: string;
  clienteNit: string | null;
  vendedorNombre: string;
  lineas: LineaDoc[];
  subtotal: number;
  total: number;
}

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: INK, fontFamily: "Helvetica" },
  topbar: { height: 4, backgroundColor: ACCENT, marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  logo: { width: 22, height: 22, borderRadius: 4, backgroundColor: ACCENT, marginRight: 8 },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  empresa: { fontSize: 9, color: INK2, marginTop: 2 },
  docBox: { alignItems: "flex-end" },
  docTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: ACCENT },
  meta: { fontSize: 9, color: INK2, marginTop: 2 },
  section: { marginTop: 18, flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 8, color: INK2, marginBottom: 2, textTransform: "uppercase" },
  value: { fontSize: 10 },
  table: { marginTop: 18, borderWidth: 1, borderColor: BORDER, borderRadius: 4 },
  th: { flexDirection: "row", backgroundColor: BG2, paddingVertical: 6, paddingHorizontal: 8 },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: BORDER },
  cCod: { width: "16%" },
  cDesc: { width: "40%" },
  cCant: { width: "10%", textAlign: "right" },
  cVal: { width: "16%", textAlign: "right" },
  cDesc2: { width: "8%", textAlign: "right" },
  cTot: { width: "10%", textAlign: "right" },
  thText: { fontSize: 8, color: INK2, fontFamily: "Helvetica-Bold" },
  totales: { marginTop: 14, alignSelf: "flex-end", width: "45%" },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totLabel: { color: INK2 },
  totBig: { fontSize: 13, fontFamily: "Helvetica-Bold", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 4, marginTop: 2 },
  footer: { position: "absolute", bottom: 28, left: 36, right: 36, fontSize: 8, color: "#9AA0A6", textAlign: "center" },
});

export function documentoPedido(d: DatosDocumento) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.topbar} />
        <View style={s.header}>
          <View>
            <View style={s.brandRow}>
              <View style={s.logo} />
              <Text style={s.brand}>EM-Pedidos</Text>
            </View>
            <Text style={s.empresa}>{d.empresaNombre}</Text>
          </View>
          <View style={s.docBox}>
            <Text style={s.docTitle}>
              {d.tipo} {d.numero}
            </Text>
            <Text style={s.meta}>Fecha: {d.fecha}</Text>
            <Text style={s.meta}>Estado: {d.estado}</Text>
            {d.numeroWo ? <Text style={s.meta}>Número WO: {d.numeroWo}</Text> : null}
          </View>
        </View>

        <View style={s.section}>
          <View>
            <Text style={s.label}>Cliente</Text>
            <Text style={s.value}>{d.clienteNombre}</Text>
            <Text style={s.meta}>NIT: {d.clienteNit ?? "—"}</Text>
          </View>
          <View>
            <Text style={s.label}>Vendedor</Text>
            <Text style={s.value}>{d.vendedorNombre}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.th}>
            <Text style={[s.cCod, s.thText]}>Código</Text>
            <Text style={[s.cDesc, s.thText]}>Descripción</Text>
            <Text style={[s.cCant, s.thText]}>Cant.</Text>
            <Text style={[s.cVal, s.thText]}>V. unit.</Text>
            <Text style={[s.cDesc2, s.thText]}>Desc.</Text>
            <Text style={[s.cTot, s.thText]}>Total</Text>
          </View>
          {d.lineas.map((l, i) => (
            <View style={s.tr} key={i}>
              <Text style={s.cCod}>{l.codigo}</Text>
              <Text style={s.cDesc}>{l.descripcion}</Text>
              <Text style={s.cCant}>{l.cantidad}</Text>
              <Text style={s.cVal}>{cop.format(l.valorUnitario)}</Text>
              <Text style={s.cDesc2}>{l.descuentoPct}%</Text>
              <Text style={s.cTot}>{cop.format(l.totalLinea)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totales}>
          <View style={s.totRow}>
            <Text style={s.totLabel}>Subtotal</Text>
            <Text>{cop.format(d.subtotal)}</Text>
          </View>
          <View style={s.totRow}>
            <Text style={s.totLabel}>Descuento</Text>
            <Text>− {cop.format(d.subtotal - d.total)}</Text>
          </View>
          <View style={[s.totRow, s.totBig]}>
            <Text>Total</Text>
            <Text>{cop.format(d.total)}</Text>
          </View>
        </View>

        <Text style={s.footer} fixed>
          Documento generado por EM-Pedidos · E.M. Compañía S.A.S · Integración World Office
        </Text>
      </Page>
    </Document>
  );
}
