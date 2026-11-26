# Hoja de ruta de la importación a pedido (PDF)

Genera `public/documentos/ruta-importacion-a-pedido.pdf` a partir de los textos de
`src/lib/rutaAPedido.ts` (los mismos que usa la página `/importar/ruta`) y de
`plantilla.html`. Necesita Google Chrome instalado y `puppeteer-core`:

```bash
npm i --no-save puppeteer-core@24 && node scripts/ruta-pdf/generar.mjs
# o, con puppeteer-core instalado en otra carpeta:
# PUPPETEER_DIR=/ruta/a/esa/carpeta node scripts/ruta-pdf/generar.mjs
```

Si cambias un texto en `rutaAPedido.ts`, vuelve a correrlo y sube el PDF. El script
imprime la altura del contenido: debe quedar en 1123 px (A4); si se pasa, baja el
`zoom` de `main` en la plantilla.
