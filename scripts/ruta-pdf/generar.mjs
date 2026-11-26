// Genera public/documentos/ruta-importacion-a-pedido.pdf a partir de
// src/lib/rutaAPedido.ts (misma fuente que la página /importar/ruta).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const require = createRequire(path.join(RAIZ, "package.json"));
const ts = require("typescript");
// puppeteer-core no es dependencia del proyecto: se busca en el proyecto o en
// la carpeta que indique PUPPETEER_DIR (p. ej. un scratchpad con `npm i puppeteer-core`).
let puppeteer;
try {
  puppeteer = require("puppeteer-core");
} catch {
  if (!process.env.PUPPETEER_DIR) throw new Error("Instala puppeteer-core (npm i --no-save puppeteer-core@24) o define PUPPETEER_DIR.");
  puppeteer = createRequire(path.join(process.env.PUPPETEER_DIR, "package.json"))("puppeteer-core");
}

// Transpila el módulo de contenido sin su import de tipos.
const fuente = readFileSync(path.join(RAIZ, "src/lib/rutaAPedido.ts"), "utf8").replace(/^import type .*$/m, "");
const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { PASOS_RUTA, FIRMAS_RUTA, DINERO_RUTA, CUENTA_RUTA } = mod.exports;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const pasosHtml = PASOS_RUTA.map((p, i) => `
  <div class="paso">
    <div class="n">${String(i + 1).padStart(2, "0")}</div>
    <div><h3>${esc(p.titulo)}</h3><p class="tu"><b>Tu parte:</b> ${esc(p.tuParte)}</p></div>
    <p class="txt">${esc(p.texto)}</p>
    ${p.pago
      ? `<div class="pago"><div class="lab">Pago ${p.pago.numero}</div><b>${esc(p.pago.titulo)}</b><span>${esc(p.pago.detalle)}</span></div>`
      : `<div class="sinpago"><span class="lab">Sin pago</span>Cotizar no cuesta. Decidimos juntos si conviene traerlo.</div>`}
  </div>`).join("");
const dineroHtml = DINERO_RUTA.map((d, i) => `<div class="card"><div class="ic">${i + 1}</div><div><h4>${esc(d.titulo)}</h4><p>${esc(d.texto)}</p></div></div>`).join("");
const firmasHtml = FIRMAS_RUTA.map((f, i) => `<div class="card"><div class="ic">${i + 1}</div><div><h4>${esc(f.titulo)}</h4><p>${esc(f.texto)}</p></div></div>`).join("");
const cuentaHtml = CUENTA_RUTA.map((c) => `<li>${esc(c)}</li>`).join("");

const logo = "data:image/svg+xml;base64," + readFileSync(path.join(RAIZ, "public/brand/logo-blanco.svg")).toString("base64");
const html = readFileSync(new URL("./plantilla.html", import.meta.url), "utf8")
  .replace("LOGO_SRC", logo)
  .replace("PASOS_HTML", pasosHtml)
  .replace("DINERO_HTML", dineroHtml)
  .replace("FIRMAS_HTML", firmasHtml)
  .replace("CUENTA_HTML", cuentaHtml);
const htmlPath = new URL("./.compilado.html", import.meta.url);
writeFileSync(htmlPath, html);

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
await page.goto(htmlPath.href, { waitUntil: "networkidle0" });
await page.evaluateHandle("document.fonts.ready");
const alto = await page.evaluate(() => ({ page: document.querySelector(".page").scrollHeight, main: document.querySelector("main").scrollHeight }));
console.log("alturas px", alto, "(A4 = 1123 px aprox.)");
const salida = path.join(RAIZ, "public/documentos/ruta-importacion-a-pedido.pdf");
await page.pdf({ path: salida, format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await page.screenshot({ path: new URL("./.vista.png", import.meta.url).pathname, fullPage: true });
await browser.close();
console.log("PDF en", salida);
