/**
 * PDF de una `Estructura` con `@react-pdf/renderer`. SOLO SERVIDOR: lo importa
 * la ruta que genera documentos, nunca el bundle del navegador.
 *
 * Mismo árbol que `renderHtml` y `renderDocx`, con formato de documento legal:
 * A4 con márgenes de 25 × 22 mm, Source Serif 4 incrustada (10,5 pt, interlineado
 * 1,35, justificado), cabecera fija con el logotipo y la razón social sobre un
 * filete dorado, portada con el título en mayúsculas espaciadas, cláusulas en
 * mayúsculas, numerales "4.3" en sangría francesa, tablas de bordes finos, notas
 * con filete lateral, bloque de firmas que no se parte, pie con código, página
 * x de y y la web, y el isotipo como marca de agua en cada hoja.
 *
 * Los recursos (fuentes, logo, marcas) viven en `recursos.ts` y se registran
 * una sola vez por proceso.
 */
/* eslint-disable jsx-a11y/alt-text -- el `Image` de react-pdf no es un <img> HTML y no admite `alt`. */
import "server-only";

import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";

import { partirInline, partirNumeracion, tituloCortoDe, type Bloque, type Estructura, type Texto } from "@/core/expedientes/documentos/estructura";

import { EMPRESA, MEDIDAS_MM, ORO, PROPORCION, recursos, rotulos } from "./recursos";

const FAMILIA = "Source Serif 4";
/** Cuerpo de texto. Va en cada estilo junto a `lineHeight`: sin `fontSize` al lado, react-pdf calcula el interlineado sobre 18 pt. */
const CUERPO_PT = 10.5;

/* -------------------------------------------------------------------------- */
/* Fuentes: una sola vez por proceso                                          */
/* -------------------------------------------------------------------------- */

let vecesRegistradas = 0;

/**
 * Registra la familia en el almacén global de react-pdf. Idempotente: la
 * segunda llamada no hace nada. Devuelve cuántas veces se registró de verdad
 * (para la prueba que exige exactamente una).
 */
export function registrarFuentes(): number {
  if (vecesRegistradas > 0) return vecesRegistradas;
  const { fuentes } = recursos();
  const uri = (b: Buffer) => `data:font/ttf;base64,${b.toString("base64")}`;
  Font.register({
    family: FAMILIA,
    fonts: [
      { src: uri(fuentes.regular), fontWeight: 400, fontStyle: "normal" },
      { src: uri(fuentes.negrita), fontWeight: 700, fontStyle: "normal" },
      { src: uri(fuentes.cursiva), fontWeight: 400, fontStyle: "italic" },
      {
        src: uri(fuentes.negritaCursiva),
        fontWeight: 700,
        fontStyle: "italic",
      },
    ],
  });
  /**
   * Un CCI ("002-194-000000000000-00") o un VIN en una celda angosta se saldría
   * de la tabla; lo que pasa de 14 caracteres seguidos se puede cortar donde
   * haga falta (de preferencia en los guiones). El texto normal no se toca.
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
  vecesRegistradas += 1;
  return vecesRegistradas;
}

/* -------------------------------------------------------------------------- */
/* Medidas y estilos                                                          */
/* -------------------------------------------------------------------------- */

const mm = (x: number) => x * 2.834645669;
const A4 = { ancho: mm(210), alto: mm(297) };
const MARGEN_X = mm(MEDIDAS_MM.margenLateral);
const MARGEN_Y = mm(MEDIDAS_MM.margenVertical);
/** La cabecera ocupa de 10 a 22 mm; el cuerpo empieza a 30 mm. */
const TOP_CABECERA = mm(10);
const TOP_CUERPO = mm(30);
const BOTTOM_PIE = mm(10);
const BOTTOM_CUERPO = MARGEN_Y + mm(4);

const TINTA = "#111111";
const GRIS = "#5f6368";
const GRIS_LINEA = "#c4c4c8";
const GRIS_FONDO = "#efefef";

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: TOP_CUERPO,
    paddingBottom: BOTTOM_CUERPO,
    paddingHorizontal: MARGEN_X,
    fontFamily: FAMILIA,
    fontSize: 10.5,
    color: TINTA,
  },
  /**
   * El interlineado (1,35) va en cada estilo de texto, no en la página ni en un
   * contenedor: con `lineHeight` en `Page` react-pdf 4.9 deja de pintar el pie
   * fijo, y sin `fontSize` en el mismo estilo se calcula sobre 18 pt.
   */
  marca: { position: "absolute" },
  cabecera: {
    position: "absolute",
    top: TOP_CABECERA,
    left: MARGEN_X,
    right: MARGEN_X,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 0.75,
    borderBottomColor: ORO,
    paddingBottom: 5,
  },
  logo: {
    height: mm(MEDIDAS_MM.altoLogo),
    width: mm(MEDIDAS_MM.altoLogo) * PROPORCION.logo,
  },
  cabeceraTexto: { alignItems: "flex-end" },
  cabeceraLinea: {
    fontSize: 7.5,
    color: GRIS,
    lineHeight: 1.4,
    letterSpacing: 0.6,
  },
  pie: {
    position: "absolute",
    bottom: BOTTOM_PIE,
    left: MARGEN_X,
    right: MARGEN_X,
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: GRIS_LINEA,
    paddingTop: 5,
    fontSize: 7.5,
    color: GRIS,
  },
  pieIzq: { width: "40%", textAlign: "left" },
  pieCentro: { width: "20%", textAlign: "center" },
  pieDer: { width: "40%", textAlign: "right" },

  portada: { alignItems: "center", marginBottom: 16 },
  titulo: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 2.2,
    lineHeight: 1.3,
  },
  subtitulo: { fontStyle: "italic", textAlign: "center", marginTop: 5, color: "#333333", fontSize: CUERPO_PT, lineHeight: 1.35 },
  lugarFecha: { textAlign: "center", marginTop: 5, fontSize: CUERPO_PT, lineHeight: 1.35 },
  filetePortada: {
    width: 60,
    borderBottomWidth: 0.6,
    borderBottomColor: TINTA,
    marginTop: 12,
  },

  h1: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginTop: 16,
    marginBottom: 6,
    lineHeight: 1.3,
  },
  h2: {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 5,
    lineHeight: 1.3,
  },
  h3: { fontWeight: 700, marginTop: 10, marginBottom: 4, fontSize: CUERPO_PT, lineHeight: 1.35 },
  parrafo: { textAlign: "justify", marginBottom: 6, fontSize: CUERPO_PT, lineHeight: 1.35 },
  centro: { textAlign: "center" },
  numerado: { flexDirection: "row", marginBottom: 6 },
  numero: { width: 32, flexShrink: 0, fontSize: CUERPO_PT, lineHeight: 1.35 },
  numeradoTexto: { flex: 1, textAlign: "justify", fontSize: CUERPO_PT, lineHeight: 1.35 },
  nota: {
    fontSize: 9,
    fontStyle: "italic",
    color: "#444444",
    lineHeight: 1.35,
    borderLeftWidth: 1.2,
    borderLeftColor: GRIS_LINEA,
    paddingLeft: 8,
    marginLeft: 2,
    marginTop: 8,
    marginBottom: 6,
  },
  lista: { marginBottom: 5, marginLeft: 10 },
  item: { flexDirection: "row", marginBottom: 3 },
  marcador: { width: 18, flexShrink: 0, fontSize: CUERPO_PT, lineHeight: 1.35 },
  casilla: {
    width: 8,
    height: 8,
    borderWidth: 0.8,
    borderColor: TINTA,
    marginTop: 3,
    marginRight: 10,
    flexShrink: 0,
  },
  itemTexto: { flex: 1, textAlign: "justify", fontSize: CUERPO_PT, lineHeight: 1.35 },
  tabla: {
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: GRIS_LINEA,
  },
  fila: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: GRIS_LINEA,
  },
  filaUltima: { flexDirection: "row" },
  filaCabecera: { backgroundColor: GRIS_FONDO },
  celda: {
    paddingVertical: 3.5,
    paddingHorizontal: 5,
    borderRightWidth: 0.5,
    borderRightColor: GRIS_LINEA,
    fontSize: 9.5,
    lineHeight: 1.3,
  },
  celdaUltima: { borderRightWidth: 0 },
  celdaCabecera: { fontWeight: 700 },
  firmasFila: { flexDirection: "row", marginBottom: 8 },
  firma: {
    flex: 1,
    marginHorizontal: 14,
    alignItems: "center",
    paddingTop: mm(MEDIDAS_MM.espacioFirma),
  },
  raya: {
    width: "100%",
    borderTopWidth: 0.8,
    borderTopColor: TINTA,
    marginBottom: 5,
  },
  firmaLinea: { fontSize: 9.5, textAlign: "center", lineHeight: 1.3 },
  firmaNombre: { fontWeight: 700 },
  negrita: { fontWeight: 700 },
  cursiva: { fontStyle: "italic" },
});

/* -------------------------------------------------------------------------- */
/* Componentes                                                                */
/* -------------------------------------------------------------------------- */

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

/** Firmas de dos en dos: cada fila entera se mantiene en la misma página. */
function enPares<T>(xs: T[]): T[][] {
  const filas: T[][] = [];
  for (let i = 0; i < xs.length; i += 2) filas.push(xs.slice(i, i + 2));
  return filas;
}

function Bloques({ bloques }: { bloques: Bloque[] }) {
  return (
    <>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case "titulo":
            return (
              <Text key={i} style={b.nivel === 1 ? estilos.h1 : b.nivel === 2 ? estilos.h2 : estilos.h3} minPresenceAhead={60}>
                <Inline texto={b.texto} />
              </Text>
            );
          case "parrafo": {
            const num = b.alineacion === "centro" ? null : partirNumeracion(b.texto);
            if (num) {
              return (
                <View key={i} style={estilos.numerado}>
                  <Text style={estilos.numero}>{num.numero}</Text>
                  <Text style={estilos.numeradoTexto}>
                    <Inline texto={num.resto} />
                  </Text>
                </View>
              );
            }
            return (
              <Text key={i} style={[estilos.parrafo, b.alineacion === "centro" ? estilos.centro : {}]}>
                <Inline texto={b.texto} />
              </Text>
            );
          }
          case "nota":
            return (
              <View key={i} style={estilos.nota} wrap={false}>
                <Text>
                  <Inline texto={b.texto} />
                </Text>
              </View>
            );
          case "salto":
            return <View key={i} break />;
          case "lista":
            return (
              <View key={i} style={estilos.lista}>
                {b.items.map((item, j) => (
                  <View key={j} style={estilos.item} wrap={false}>
                    {b.estilo === "casillas" ? (
                      <View style={estilos.casilla} />
                    ) : b.estilo === "simple" ? (
                      <View style={{ width: 6 }} />
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
              <View key={i}>
                {enPares(b.columnas).map((par, j) => (
                  <View key={j} style={estilos.firmasFila} wrap={false}>
                    {par.map((col, k) => (
                      <View key={k} style={estilos.firma}>
                        <View style={estilos.raya} />
                        {col.lineas.map((l, m) => (
                          <Text key={m} style={[estilos.firmaLinea, m === 0 ? estilos.firmaNombre : {}]}>
                            <Inline texto={l} />
                          </Text>
                        ))}
                      </View>
                    ))}
                    {par.length === 1 && b.columnas.length > 1 ? <View style={estilos.firma} /> : null}
                  </View>
                ))}
              </View>
            );
        }
      })}
    </>
  );
}

function MarcaDeAgua({ tipo }: { tipo: Estructura["marcaDeAgua"] }) {
  if (tipo === null) return null;
  const r = recursos();
  const anchoIso = mm(MEDIDAS_MM.anchoMarcaIsotipo);
  const altoIso = anchoIso / PROPORCION.marcaIsotipo;
  const anchoBorr = mm(MEDIDAS_MM.anchoMarcaBorrador);
  const altoBorr = anchoBorr / PROPORCION.marcaBorrador;
  return (
    <>
      <Image
        fixed
        src={{ data: r.marcaIsotipo, format: "png" }}
        style={[
          estilos.marca,
          {
            left: (A4.ancho - anchoIso) / 2,
            top: (A4.alto - altoIso) / 2,
            width: anchoIso,
            height: altoIso,
          },
        ]}
      />
      {tipo === "borrador" ? (
        <Image
          fixed
          src={{ data: r.marcaBorrador, format: "png" }}
          style={[
            estilos.marca,
            {
              left: (A4.ancho - anchoBorr) / 2,
              top: (A4.alto - altoBorr) / 2,
              width: anchoBorr,
              height: altoBorr,
            },
          ]}
        />
      ) : null}
    </>
  );
}

function DocumentoPdf({ estructura }: { estructura: Estructura }): ReactElement {
  const r = recursos();
  const t = rotulos(estructura.idioma);
  const corto = tituloCortoDe(estructura);
  return (
    <Document title={estructura.titulo} author={EMPRESA.razonSocial} subject={`${t.expediente} ${estructura.codigoExpediente}`} language={estructura.idioma}>
      <Page size="A4" style={estilos.pagina}>
        <MarcaDeAgua tipo={estructura.marcaDeAgua ?? "isotipo"} />
        <View style={estilos.cabecera} fixed>
          <Image src={{ data: r.logo, format: "png" }} style={estilos.logo} />
          <View style={estilos.cabeceraTexto}>
            <Text style={estilos.cabeceraLinea}>{t.lineaEmpresa}</Text>
            <Text style={estilos.cabeceraLinea}>
              {t.expediente} {estructura.codigoExpediente} · {corto}
            </Text>
          </View>
        </View>

        <View style={estilos.pie} fixed>
          <Text style={estilos.pieIzq}>
            {estructura.codigoExpediente} · {corto}
          </Text>
          <Text style={estilos.pieCentro} render={({ pageNumber, totalPages }) => t.pagina(pageNumber, totalPages)} />
          <Text style={estilos.pieDer}>{EMPRESA.web}</Text>
        </View>

        <>
          <View style={estilos.portada}>
            <Text style={estilos.titulo}>{estructura.titulo}</Text>
            {estructura.subtitulo ? (
              <Text style={estilos.subtitulo}>
                <Inline texto={estructura.subtitulo} />
              </Text>
            ) : null}
            {estructura.lugarFecha ? <Text style={estilos.lugarFecha}>{estructura.lugarFecha}</Text> : null}
            <View style={estilos.filetePortada} />
          </View>

          <Bloques bloques={estructura.bloques} />
        </>
      </Page>
    </Document>
  );
}

/** El PDF como bytes. */
export async function renderPdf(estructura: Estructura): Promise<Uint8Array> {
  registrarFuentes();
  const buffer = await renderToBuffer(<DocumentoPdf estructura={estructura} />);
  return new Uint8Array(buffer);
}
