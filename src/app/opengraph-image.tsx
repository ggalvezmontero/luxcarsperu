import { BRAND_PALETTE } from "@/lib/brandPalette";
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
 * Es una composicion tipografica a proposito: no lleva foto de auto porque no
 * hay ninguna foto propia todavia y meter stock ajeno como si fuera inventario
 * de LuxCars es justo lo que esta auditoria vino a sacar. Cuando exista una
 * toma real del stock (ver docs/IMAGENES.md) se puede montar aqui de fondo.
 *
 * Los colores vienen de BRAND_PALETTE: satori resuelve estilos inline y no ve
 * las variables de globals.css, por eso no se usan tokens de Tailwind aqui.
 * -------------------------------------------------------------------------- */

export const alt = `${LUXCARS_CONFIG.brandName} — importación, compra y venta de autos de lujo en Perú`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Filete plateado superior: el mismo gesto que abre cada seccion. */}
        <div
          style={{
            display: "flex",
            width: "120px",
            height: "2px",
            background: BRAND_PALETTE.silver,
          }}
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              letterSpacing: "0.22em",
              color: BRAND_PALETTE.ink,
              fontWeight: 600,
            }}
          >
            LUX
            <span style={{ color: BRAND_PALETTE.gold, padding: "0 18px" }}>
              |
            </span>
            CARS
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 36,
              fontSize: 40,
              lineHeight: 1.25,
              color: BRAND_PALETTE.silverBright,
              maxWidth: 900,
            }}
          >
            Importación, compra y venta de autos de lujo en Perú
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 26,
              color: BRAND_PALETTE.ink3,
              maxWidth: 880,
            }}
          >
            Calculadora pública de impuestos de importación · Consignación sin
            exclusividad
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${BRAND_PALETTE.line}`,
            paddingTop: 28,
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
