/**
 * Vista previa HTML de una `Estructura`. Isomórfico: corre en el navegador
 * (vista previa antes de generar, vista del cliente) y en pruebas. Devuelve un
 * fragmento (sin <html>) con clases `doc-*` que la pantalla estiliza; todo el
 * texto va escapado.
 *
 * Refleja la jerarquía del PDF y del DOCX (cabecera con razón social y
 * expediente, portada centrada, numerales en sangría francesa, notas con filete,
 * firmas de dos en dos) sin cargar fuentes ni imágenes: los estilos están en
 * `src/app/globals.css`, utilidad `papel-doc`.
 */

import { alineacionesDeTabla, partirInline, partirNumeracion, tituloCortoDe, unirCifras, type Alineacion, type Bloque, type Estructura, type Texto, type Tramo } from "./estructura";

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tramo(t: Tramo): string {
  let s = escapar(unirCifras(t.texto));
  if (t.negrita) s = `<strong>${s}</strong>`;
  if (t.cursiva) s = `<em>${s}</em>`;
  return s;
}

export function inlineHtml(texto: Texto): string {
  return partirInline(texto).map(tramo).join("");
}

/** Clase de alineación de una celda; la izquierda es la de siempre y no lleva clase. */
function claseCelda(alineacion: Alineacion | undefined): string {
  if (alineacion === "derecha") return ' class="doc-celda-der"';
  if (alineacion === "centro") return ' class="doc-celda-centro"';
  return "";
}

function bloqueHtml(b: Bloque): string {
  switch (b.tipo) {
    case "titulo": {
      const nivel = b.nivel + 1; // el h1 lo ocupa el título del documento
      return `<h${nivel} class="doc-h${b.nivel}">${inlineHtml(b.texto)}</h${nivel}>`;
    }
    case "parrafo": {
      const num = b.alineacion === "centro" ? null : partirNumeracion(b.texto);
      if (num) return `<p class="doc-p doc-p-numerado"><span class="doc-num">${escapar(num.numero)}</span>${inlineHtml(num.resto)}</p>`;
      return `<p class="doc-p${b.alineacion === "centro" ? " doc-centro" : ""}">${inlineHtml(b.texto)}</p>`;
    }
    case "nota":
      return `<p class="doc-nota">${inlineHtml(b.texto)}</p>`;
    case "salto":
      return `<hr class="doc-salto" />`;
    case "lista": {
      const items = b.items.map((i) => `<li>${b.estilo === "casillas" ? '<span class="doc-casilla" aria-hidden="true"></span>' : ""}${inlineHtml(i)}</li>`).join("");
      if (b.estilo === "numerada") return `<ol class="doc-ol">${items}</ol>`;
      return `<ul class="doc-ul doc-ul-${b.estilo}">${items}</ul>`;
    }
    case "tabla": {
      const alineaciones = alineacionesDeTabla(b);
      const cab = b.cabecera
        ? `<thead><tr>${b.cabecera.map((c, k) => `<th${claseCelda(alineaciones[k])}>${inlineHtml(c)}</th>`).join("")}</tr></thead>`
        : "";
      const filas = b.filas
        .map((f) => `<tr>${f.map((c, k) => `<td${claseCelda(alineaciones[k])}>${inlineHtml(c)}</td>`).join("")}</tr>`)
        .join("");
      return `<table class="doc-tabla">${cab}<tbody>${filas}</tbody></table>`;
    }
    case "firmas": {
      const cols = b.columnas
        .map(
          (c) =>
            `<div class="doc-firma"><div class="doc-firma-raya"></div>${c.lineas
              .map((l, i) => `<p class="doc-firma-linea${i === 0 ? " doc-firma-nombre" : ""}">${inlineHtml(l)}</p>`)
              .join("")}</div>`,
        )
        .join("");
      return `<div class="doc-firmas">${cols}</div>`;
    }
  }
}

/**
 * Fragmento HTML del documento completo: cabecera de página (una sola vez en la
 * vista previa; en el PDF y el DOCX se repite en cada hoja), portada con título,
 * subtítulo y lugar y fecha, y los bloques.
 */
export function renderHtml(estructura: Estructura): string {
  const en = estructura.idioma === "en";
  const cabecera = `<div class="doc-pagina-cabecera"><span class="doc-pagina-empresa">LUX CARS IMPORT S.A.C. · RUC 20615410935</span><span class="doc-pagina-expediente">${
    en ? "File" : "Expediente"
  } ${escapar(estructura.codigoExpediente)} · ${escapar(tituloCortoDe(estructura))}</span></div>`;
  const portada = `<header class="doc-cabecera"><h1 class="doc-titulo">${escapar(estructura.titulo)}</h1>${
    estructura.subtitulo ? `<p class="doc-subtitulo">${inlineHtml(estructura.subtitulo)}</p>` : ""
  }${estructura.lugarFecha ? `<p class="doc-lugar-fecha">${escapar(estructura.lugarFecha)}</p>` : ""}</header>`;
  return `<article class="doc${estructura.marcaDeAgua === "borrador" ? " doc-borrador" : ""}" lang="${estructura.idioma}">${cabecera}${portada}${estructura.bloques.map(bloqueHtml).join("")}</article>`;
}
