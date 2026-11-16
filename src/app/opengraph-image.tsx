import { BRAND_PALETTE } from "@/lib/brandPalette";
import { logoOgSize, logoOgSrc } from "@/lib/brandLogoOg";
import { LUXCARS_CONFIG } from "@/lib/config";
import { ImageResponse } from "next/og";

/* -----------------------------------------------------------------------------
 * Imagen social (Open Graph + Twitter Card).
 *
 * POR QUE SE GENERA Y NO ES UN ARCHIVO:
 * el metadata de src/app/layout.tsx apuntaba a /brand/social-1024.png, un
 * archivo que NO existe en public/. Resultado: cada vez que alguien compartia
 * luxcars.pe por WhatsApp, Facebook o LinkedIn, la vista previa salia en blanco.
 * Era la imagen mas vista del sitio y estaba rota.
 *
 * Se genera con next/og en vez de subir un PNG para que no vuelva a
 * desincronizarse: no hay archivo que se pueda borrar ni renombrar por error, y
 * el nombre legal y la web salen de LUXCARS_CONFIG.
 *
 * Lleva el logo real de la marca (el mismo SVG de la barra de navegacion, via
 * src/lib/brandLogoOg.ts), centrado y grande: WhatsApp y otras apps recortan la
 * miniatura a un cuadrado por el centro, y ahi tiene que quedar el logo entero.
 * No lleva foto de auto porque no hay ninguna foto propia todavia y meter stock
 * ajeno como si fuera inventario de Luxcars es justo lo que la auditoria vino a
 * sacar. Cuando exista una toma real del stock (ver docs/IMAGENES.md) se puede
 * montar aqui de fondo.
 *
 * Los colores vienen de BRAND_PALETTE: satori resuelve estilos inline y no ve
 * las variables de globals.css, por eso no se usan tokens de Tailwind aqui.
 * -------------------------------------------------------------------------- */

export const alt = `${LUXCARS_CONFIG.brandName} — importación, compra y venta de autos de lujo en Perú`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await logoOgSrc();
  const medidas = logoOgSize(330);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BRAND_PALETTE.void,
          padding: "52px 80px 48px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexGrow: 1,
          }}
        >
          {/* El logo real, no un texto: ver src/lib/brandLogoOg.ts. */}
          <img src={logo} width={medidas.width} height={medidas.height} alt="" />

          <div
            style={{
              display: "flex",
              marginTop: 30,
              fontSize: 34,
              lineHeight: 1.25,
              color: BRAND_PALETTE.silverBright,
              textAlign: "center",
            }}
          >
            Importación, compra y venta de autos de lujo en Perú
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${BRAND_PALETTE.line}`,
            paddingTop: 24,
            fontSize: 22,
            color: BRAND_PALETTE.ink3,
            letterSpacing: "0.12em",
          }}
        >
          <div style={{ display: "flex" }}>San Isidro, Lima · Miami</div>
          <div style={{ display: "flex", color: BRAND_PALETTE.silver }}>
            luxcars.pe
          </div>
        </div>
      </div>
    ),
    size,
  );
}
