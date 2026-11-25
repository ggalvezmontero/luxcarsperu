/**
 * PDF de una `Estructura` con `@react-pdf/renderer`. SOLO SERVIDOR: lo importa
 * la ruta que genera documentos, nunca el bundle del navegador.
 *
 * Mismo árbol que `renderHtml` y `renderDocx`. A4, Helvetica (fuente estándar
 * del PDF: cubre el español sin incrustar archivos), cabecera con la razón
 * social y pie con el código de expediente y la página en cada hoja. El logo
 * de `public/brand/logo-blanco.svg` es blanco sobre fondo oscuro, pensado para
 * la web; en un documento legal impreso en blanco va el nombre de la empresa.
 */
import "server-only";

import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";

import { partirInline, type Bloque, type Estructura, type Texto } from "@/core/expedientes/documentos/estructura";

/**
 * Helvetica no parte palabras. Un CCI ("002-194-000000000000-00") o un VIN en
 * una celda angosta se saldría de la tabla; con esto, lo que pasa de 14
 * caracteres seguidos se puede cortar donde haga falta (de preferencia en los
 * guiones). El texto normal no se toca.
 */
const LARGO_SIN_CORTE = 14;
Font.registerHyphenationCallback((palabra) => {
  if (palabra.length <= LARGO_SIN_CORTE) return [palabra];
  const trozos = palabra.split(/(?<=-)/);
  const salida: string[] = [];
  for (const t of trozos) {
    for (let i = 0; i < t.length; i += LARGO_SIN_CORTE) salida.push(t.slice(i, i + LARGO_SIN_CORTE));
  }
  return salida;
});

const COLOR_TEXTO = "#111111";
const COLOR_GRIS = "#5f6368";
const COLOR_LINEA = "#b8b8be";
const COLOR_CABECERA_TABLA = "#f1f1f3";

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 64,
    paddingBottom: 58,
    paddingHorizontal: 54,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.4,
    color: COLOR_TEXTO,
  },
  cabecera: {
    position: "absolute",
    top: 26,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR_LINEA,
    paddingBottom: 5,
    fontSize: 8,
    color: COLOR_GRIS,
    letterSpacing: 0.8,
  },
  pie: {
    position: "absolute",
    bottom: 26,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: COLOR_LINEA,
    paddingTop: 5,
    fontSize: 7.5,
    color: COLOR_GRIS,
  },
  titulo: { fontSize: 15, fontFamily: "Helvetica-Bold", lineHeight: 1.25, marginBottom: 4 },
  subtitulo: { fontSize: 9.5, color: COLOR_GRIS, marginBottom: 12 },
  h1: { fontSize: 12.5, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 11, marginBottom: 4 },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 },
  parrafo: { marginBottom: 5 },
  centro: { textAlign: "center" },
  nota: { fontSize: 8, color: COLOR_GRIS, marginTop: 6, marginBottom: 4 },
  salto: { borderBottomWidth: 0.5, borderBottomColor: COLOR_LINEA, marginVertical: 8 },
  item: { flexDirection: "row", marginBottom: 2.5 },
  marcador: { width: 16, flexShrink: 0 },
  casilla: { width: 8, height: 8, borderWidth: 0.8, borderColor: COLOR_TEXTO, marginTop: 2.2, marginRight: 8, flexShrink: 0 },
  itemTexto: { flex: 1 },
  tabla: { marginTop: 3, marginBottom: 7, borderWidth: 0.5, borderColor: COLOR_LINEA },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR_LINEA },
  filaUltima: { flexDirection: "row" },
  filaCabecera: { backgroundColor: COLOR_CABECERA_TABLA },
  celda: { paddingVertical: 3, paddingHorizontal: 4, borderRightWidth: 0.5, borderRightColor: COLOR_LINEA, fontSize: 8.5, lineHeight: 1.3 },
  celdaUltima: { borderRightWidth: 0 },
  celdaCabecera: { fontFamily: "Helvetica-Bold" },
  firmas: { flexDirection: "row", marginTop: 34, marginBottom: 6 },
  firma: { flex: 1, marginHorizontal: 10, alignItems: "center" },
  raya: { width: "100%", borderTopWidth: 0.8, borderTopColor: COLOR_TEXTO, marginBottom: 4 },
  firmaLinea: { fontSize: 8.5, textAlign: "center", lineHeight: 1.3 },
  firmaNombre: { fontFamily: "Helvetica-Bold" },
  negrita: { fontFamily: "Helvetica-Bold" },
  cursiva: { fontFamily: "Helvetica-Oblique" },
});

function Inline({ texto }: { texto: Texto }) {
  return (
    <>
      {partirInline(texto).map((t, i) => (
        <Text key={i} style={t.negrita ? estilos.negrita : t.cursiva ? estilos.cursiva : undefined}>
          {t.texto}
        </Text>
      ))}
    </>
  );
}

function normalizar(anchos: number[] | undefined, columnas: number): number[] {
  const base = anchos && anchos.length === columnas ? anchos : Array.from({ length: columnas }, () => 1);
  const suma = base.reduce((s, x) => s + x, 0) || 1;
  return base.map((x) => (x / suma) * 100);
}

function Bloques({ bloques }: { bloques: Bloque[] }) {
  return (
    <>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case "titulo":
            return (
              <Text key={i} style={b.nivel === 1 ? estilos.h1 : b.nivel === 2 ? estilos.h2 : estilos.h3} minPresenceAhead={40}>
                <Inline texto={b.texto} />
              </Text>
            );
          case "parrafo":
            return (
              <Text key={i} style={[estilos.parrafo, b.alineacion === "centro" ? estilos.centro : {}]}>
                <Inline texto={b.texto} />
              </Text>
            );
          case "nota":
            return (
              <Text key={i} style={estilos.nota}>
                <Inline texto={b.texto} />
              </Text>
            );
          case "salto":
            return <View key={i} style={estilos.salto} />;
          case "lista":
            return (
              <View key={i} style={{ marginBottom: 4 }}>
                {b.items.map((item, j) => (
                  <View key={j} style={estilos.item} wrap={false}>
                    {b.estilo === "casillas" ? (
                      <View style={estilos.casilla} />
                    ) : b.estilo === "simple" ? (
                      <View style={{ width: 8 }} />
                    ) : (
                      <Text style={estilos.marcador}>{b.estilo === "numerada" ? `${j + 1}.` : "•"}</Text>
                    )}
                    <Text style={estilos.itemTexto}>
                      <Inline texto={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case "tabla": {
            const columnas = b.cabecera?.length ?? b.filas[0]?.length ?? 1;
            const anchos = normalizar(b.anchos, columnas);
            const fila = (celdas: Texto[], esCabecera: boolean, ultima: boolean, key: string) => (
              <View key={key} style={[ultima ? estilos.filaUltima : estilos.fila, esCabecera ? estilos.filaCabecera : {}]} wrap={false}>
                {celdas.map((celda, k) => (
                  <View key={k} style={[estilos.celda, { width: `${anchos[k] ?? 10}%` }, k === celdas.length - 1 ? estilos.celdaUltima : {}]}>
                    <Text style={esCabecera ? estilos.celdaCabecera : undefined}>
                      <Inline texto={celda} />
                    </Text>
                  </View>
                ))}
              </View>
            );
            return (
              <View key={i} style={estilos.tabla}>
                {b.cabecera ? fila(b.cabecera, true, b.filas.length === 0, "cab") : null}
                {b.filas.map((f, j) => fila(f, false, j === b.filas.length - 1, `f${j}`))}
              </View>
            );
          }
          case "firmas":
            return (
              <View key={i} style={estilos.firmas} wrap={false}>
                {b.columnas.map((col, j) => (
                  <View key={j} style={estilos.firma}>
                    <View style={estilos.raya} />
                    {col.lineas.map((l, k) => (
                      <Text key={k} style={[estilos.firmaLinea, k === 0 ? estilos.firmaNombre : {}]}>
                        <Inline texto={l} />
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            );
        }
      })}
    </>
  );
}

function DocumentoPdf({ estructura }: { estructura: Estructura }): ReactElement {
  const tituloCorto = estructura.titulo.length > 70 ? `${estructura.titulo.slice(0, 67)}…` : estructura.titulo;
  return (
    <Document title={estructura.titulo} author="Lux Cars Import S.A.C." subject={`Expediente ${estructura.codigoExpediente}`} language={estructura.idioma}>
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.cabecera} fixed>
          <Text>LUX CARS IMPORT S.A.C.</Text>
          <Text>{estructura.idioma === "en" ? "File" : "Expediente"} {estructura.codigoExpediente}</Text>
        </View>
        <Text style={estilos.titulo}>{estructura.titulo}</Text>
        {estructura.subtitulo ? (
          <Text style={estilos.subtitulo}>
            <Inline texto={estructura.subtitulo} />
          </Text>
        ) : null}
        <Bloques bloques={estructura.bloques} />
        <View style={estilos.pie} fixed>
          <Text>
            {estructura.codigoExpediente} · {tituloCorto}
          </Text>
          <Text render={({ pageNumber, totalPages }) => (estructura.idioma === "en" ? `Page ${pageNumber} of ${totalPages}` : `Página ${pageNumber} de ${totalPages}`)} />
        </View>
      </Page>
    </Document>
  );
}

/** El PDF como bytes. */
export async function renderPdf(estructura: Estructura): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<DocumentoPdf estructura={estructura} />);
  return new Uint8Array(buffer);
}
