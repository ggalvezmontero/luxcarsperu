/**
 * PDF de una `Estructura` con `@react-pdf/renderer`. SOLO SERVIDOR: lo importa
 * la ruta que genera documentos, nunca el bundle del navegador.
 *
 * Mismo árbol que `renderHtml` y `renderDocx`, con formato de documento legal:
 * A4 con márgenes de 25 × 22 mm, Luxcars Serif (Source Serif 4) incrustada (10,5 pt, interlineado
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
import type { ComponentProps, ReactElement } from "react";

import {
  alineacionesDeTabla,
  partirInline,
  partirNumeracion,
  tituloCortoDe,
  unirCifras,
  type Alineacion,
  type Bloque,
  type Estructura,
  type Texto,
} from "@/core/expedientes/documentos/estructura";

import { EMPRESA, FILAS_TABLA_JUNTA, MEDIDAS_MM, ORO, PROPORCION, RELLENO_CELDA_PT, TABLA_PT, anchosDeTabla, recursos, rotulos } from "./recursos";

const FAMILIA = "Luxcars Serif";
/**
 * Cuerpo de texto. El interlineado (1,35) va en cada estilo de texto junto a
 * este `fontSize`, no en la página ni en un contenedor: con `lineHeight` en
 * `Page` react-pdf 4.9 deja de pintar el pie fijo, y sin `fontSize` en el mismo
 * estilo calcula el interlineado sobre 18 pt.
 */
const CUERPO_PT = 10.5;
const ALINEAR: Record<Alineacion, "left" | "center" | "right"> = { izquierda: "left", centro: "center", derecha: "right" };

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
   * Nunca partir una palabra. react-pdf pone un guion en cada corte dentro de una
   * palabra (incluso detrás de un guion que ya estaba), así que un CCI salía como
   * "002-194--000…" y un VIN como "1FMEE5DP0PLA00-" / "000": un dato falso en un
   * documento de pagos. En su lugar, `anchosDeTabla` da a cada columna el ancho de
   * su palabra o cifra más larga, y en el cuerpo del texto cualquier palabra cabe.
   */
  Font.registerHyphenationCallback((palabra) => [palabra]);
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
/** Fondo de la cabecera de tabla: gris claro que se imprime nítido en blanco y negro. */
const GRIS_CABECERA = "#e4e4e4";

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: TOP_CUERPO,
    paddingBottom: BOTTOM_CUERPO,
    paddingHorizontal: MARGEN_X,
    fontFamily: FAMILIA,
    fontSize: 10.5,
    color: TINTA,
  },
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
  /** Cabecera destacada: fondo gris, negrita y una raya negra debajo. */
  filaCabecera: { backgroundColor: GRIS_CABECERA, borderBottomWidth: 0.9, borderBottomColor: TINTA },
  celda: {
    paddingVertical: 3.5,
    paddingHorizontal: RELLENO_CELDA_PT,
    borderRightWidth: 0.5,
    borderRightColor: GRIS_LINEA,
  },
  celdaUltima: { borderRightWidth: 0 },
  celdaTexto: { fontSize: TABLA_PT, lineHeight: 1.3 },
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

/**
 * Penalización "infinita" de textkit (`linebreak.infinity`): un punto con ella
 * nunca es candidato a corte de línea. Con la de fábrica, react-pdf corta y
 * pone un guion donde no hay sílabas: tras dos o más espacios seguidos
 * ("registrales-") y en el límite entre una negrita y la puntuación que la
 * sigue ("**Mandante**,"). Así las líneas solo se cortan en espacios.
 */
const NUNCA_CORTAR_PALABRA = 10000;

/** `Text` de react-pdf que nunca corta dentro de una palabra. Todo el texto del documento pasa por aquí. */
function Txt(props: ComponentProps<typeof Text>) {
  return <Text hyphenationPenalty={NUNCA_CORTAR_PALABRA} {...props} />;
}

function Inline({ texto }: { texto: Texto }) {
  return (
    <>
      {partirInline(texto).map((t, i) => (
        <Txt key={i} style={t.negrita ? estilos.negrita : t.cursiva ? estilos.cursiva : undefined}>
          {unirCifras(t.texto)}
        </Txt>
      ))}
    </>
  );
}

/** Firmas de dos en dos por fila. */
function enPares<T>(xs: T[]): T[][] {
  const filas: T[][] = [];
  for (let i = 0; i < xs.length; i += 2) filas.push(xs.slice(i, i + 2));
  return filas;
}

/** Un bloque del árbol como elemento de react-pdf. */
function bloque(b: Bloque, key: string | number): ReactElement {
  switch (b.tipo) {
    case "titulo":
      return (
        <Txt key={key} style={b.nivel === 1 ? estilos.h1 : b.nivel === 2 ? estilos.h2 : estilos.h3} minPresenceAhead={60}>
          <Inline texto={b.texto} />
        </Txt>
      );
    case "parrafo": {
      const num = b.alineacion === "centro" ? null : partirNumeracion(b.texto);
      if (num) {
        return (
          <View key={key} style={estilos.numerado}>
            <Txt style={estilos.numero}>{num.numero}</Txt>
            <Txt style={estilos.numeradoTexto}>
              <Inline texto={num.resto} />
            </Txt>
          </View>
        );
      }
      return (
        <Txt key={key} style={[estilos.parrafo, b.alineacion === "centro" ? estilos.centro : {}]}>
          <Inline texto={b.texto} />
        </Txt>
      );
    }
    case "nota":
      return (
        <View key={key} style={estilos.nota} wrap={false}>
          <Txt>
            <Inline texto={b.texto} />
          </Txt>
        </View>
      );
    case "salto":
      return <View key={key} break />;
    case "lista":
      return (
        <View key={key} style={estilos.lista}>
          {b.items.map((item, j) => (
            <View key={j} style={estilos.item} wrap={false}>
              {b.estilo === "casillas" ? (
                <View style={estilos.casilla} />
              ) : b.estilo === "simple" ? (
                <View style={{ width: 6 }} />
              ) : (
                <Txt style={estilos.marcador}>{b.estilo === "numerada" ? `${j + 1}.` : "•"}</Txt>
              )}
              <Txt style={estilos.itemTexto}>
                <Inline texto={item} />
              </Txt>
            </View>
          ))}
        </View>
      );
    case "tabla": {
      const anchos = anchosDeTabla(b).map((f) => f * 100);
      const alineaciones = alineacionesDeTabla(b);
      // Corta: entera en una página. Larga: se parte entre filas y la cabecera
      // (`fixed` dentro de la tabla) se repite arriba de cada página; nunca
      // queda sola al pie (`minPresenceAhead`).
      const junta = b.filas.length <= FILAS_TABLA_JUNTA;
      const fila = (celdas: Texto[], esCabecera: boolean, ultima: boolean, key: string) => (
        <View
          key={key}
          style={[ultima ? estilos.filaUltima : estilos.fila, esCabecera ? estilos.filaCabecera : {}]}
          wrap={false}
          fixed={esCabecera && !junta}
          minPresenceAhead={esCabecera && !junta ? 40 : undefined}
        >
          {celdas.map((celda, k) => (
            <View key={k} style={[estilos.celda, { width: `${anchos[k] ?? 10}%` }, k === celdas.length - 1 ? estilos.celdaUltima : {}]}>
              <Txt style={[estilos.celdaTexto, esCabecera ? estilos.celdaCabecera : {}, { textAlign: ALINEAR[alineaciones[k] ?? "izquierda"] }]}>
                <Inline texto={celda} />
              </Txt>
            </View>
          ))}
        </View>
      );
      return (
        <View key={key} style={estilos.tabla} wrap={!junta}>
          {b.cabecera ? fila(b.cabecera, true, b.filas.length === 0, "cab") : null}
          {b.filas.map((f, j) => fila(f, false, j === b.filas.length - 1, `f${j}`))}
        </View>
      );
    }
    case "firmas":
      // El bloque entero en la misma página, con dos firmantes por fila.
      return (
        <View key={key} wrap={false}>
          {enPares(b.columnas).map((par, j) => (
            <View key={j} style={estilos.firmasFila}>
              {par.map((col, k) => (
                <View key={k} style={estilos.firma}>
                  <View style={estilos.raya} />
                  {col.lineas.map((l, m) => (
                    <Txt key={m} style={[estilos.firmaLinea, m === 0 ? estilos.firmaNombre : {}]}>
                      <Inline texto={l} />
                    </Txt>
                  ))}
                </View>
              ))}
              {par.length === 1 && b.columnas.length > 1 ? <View style={estilos.firma} /> : null}
            </View>
          ))}
        </View>
      );
  }
}

/** Va entero en una página: las tablas cortas y el bloque de firmas. */
function esIndivisible(b: Bloque | undefined): boolean {
  return (b?.tipo === "tabla" && b.filas.length <= FILAS_TABLA_JUNTA) || b?.tipo === "firmas";
}

/**
 * Sitio mínimo (en puntos) que necesita una tabla larga para empezar en una
 * página: la cabecera y dos filas. Si no lo hay, la tabla empieza en la siguiente.
 */
const SITIO_INICIO_TABLA = 64;

/**
 * Los bloques en orden, con las reglas de paginación de un documento legal que
 * react-pdf no resuelve solo (`minPresenceAhead` no mueve un título cuando lo
 * que sigue es indivisible y no cabe):
 * - un título va pegado al bloque indivisible que le sigue (tabla corta, firmas);
 * - las firmas van pegadas al párrafo que las precede ("Firmado en…, el…");
 * - una tabla larga no empieza con la cabecera sola al pie de la página.
 */
function Bloques({ bloques }: { bloques: Bloque[] }) {
  const salida: ReactElement[] = [];
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    if (!b) continue;
    const siguiente = bloques[i + 1];
    if (siguiente && esIndivisible(siguiente) && (b.tipo === "titulo" || (b.tipo === "parrafo" && siguiente.tipo === "firmas"))) {
      salida.push(
        <View key={i} wrap={false}>
          {bloque(b, "a")}
          {bloque(siguiente, "b")}
        </View>,
      );
      i += 1;
      continue;
    }
    if (b.tipo === "tabla" && !esIndivisible(b)) salida.push(<View key={`${i}-sitio`} minPresenceAhead={SITIO_INICIO_TABLA} />);
    salida.push(bloque(b, i));
  }
  return <>{salida}</>;
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
            <Txt style={estilos.cabeceraLinea}>{t.lineaEmpresa}</Txt>
            <Txt style={estilos.cabeceraLinea}>
              {t.expediente} {estructura.codigoExpediente} · {corto}
            </Txt>
          </View>
        </View>

        <View style={estilos.pie} fixed>
          <Txt style={estilos.pieIzq}>
            {estructura.codigoExpediente} · {corto}
          </Txt>
          <Txt style={estilos.pieCentro} render={({ pageNumber, totalPages }) => t.pagina(pageNumber, totalPages)} />
          <Txt style={estilos.pieDer}>{EMPRESA.web}</Txt>
        </View>

        <>
          <View style={estilos.portada}>
            <Txt style={estilos.titulo}>{estructura.titulo}</Txt>
            {estructura.subtitulo ? (
              <Txt style={estilos.subtitulo}>
                <Inline texto={estructura.subtitulo} />
              </Txt>
            ) : null}
            {estructura.lugarFecha ? <Txt style={estilos.lugarFecha}>{estructura.lugarFecha}</Txt> : null}
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
