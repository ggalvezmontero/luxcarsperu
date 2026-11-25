/**
 * Vista previa HTML de una `Estructura`. Isomórfico: corre en el navegador
 * (vista previa antes de generar, vista del cliente) y en pruebas. Devuelve un
 * fragmento (sin <html>) con clases `doc-*` que la pantalla estiliza; todo el
 * texto va escapado.
 */

import { partirInline, type Bloque, type Estructura, type Texto, type Tramo } from "./estructura";

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tramo(t: Tramo): string {
  let s = escapar(t.texto);
  if (t.negrita) s = `<strong>${s}</strong>`;
  if (t.cursiva) s = `<em>${s}</em>`;
  return s;
}

export function inlineHtml(texto: Texto): string {
  return partirInline(texto).map(tramo).join("");
}

function bloqueHtml(b: Bloque): string {
  switch (b.tipo) {
    case "titulo": {
      const nivel = b.nivel + 1; // el h1 lo ocupa el título del documento
      return `<h${nivel} class="doc-h${b.nivel}">${inlineHtml(b.texto)}</h${nivel}>`;
    }
    case "parrafo":
      return `<p class="doc-p${b.alineacion === "centro" ? " doc-centro" : ""}">${inlineHtml(b.texto)}</p>`;
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
      const cab = b.cabecera
        ? `<thead><tr>${b.cabecera.map((c) => `<th>${inlineHtml(c)}</th>`).join("")}</tr></thead>`
        : "";
      const filas = b.filas
        .map((f) => `<tr>${f.map((c) => `<td>${inlineHtml(c)}</td>`).join("")}</tr>`)
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

/** Fragmento HTML del documento completo, con título y subtítulo. */
export function renderHtml(estructura: Estructura): string {
  const cabecera = `<header class="doc-cabecera"><h1 class="doc-titulo">${escapar(estructura.titulo)}</h1>${
    estructura.subtitulo ? `<p class="doc-subtitulo">${inlineHtml(estructura.subtitulo)}</p>` : ""
  }</header>`;
  return `<article class="doc" lang="${estructura.idioma}">${cabecera}${estructura.bloques.map(bloqueHtml).join("")}</article>`;
}
