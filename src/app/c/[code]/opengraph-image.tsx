import { BRAND_PALETTE } from "@/lib/brandPalette";
import { formatCurrency } from "@/lib/utils";
import { ImageResponse } from "next/og";
import { resolveSharedEstimate } from "./estimado";

/* -----------------------------------------------------------------------------
 * Imagen de la vista previa de un estimado compartido.
 *
 * Es lo que se ve cuando el enlace `/c/<código>` se pega en WhatsApp, Facebook
 * o una historia: el auto y la cifra puesta en Lima, antes de abrir nada. Sale
 * del mismo cálculo que la página (`estimado.ts`), así que no pueden decir
 * números distintos.
 *
 * Misma composición tipográfica que la imagen general del sitio
 * (`src/app/opengraph-image.tsx`) y por la misma razón: no hay foto propia de
 * cada modelo, y poner una ajena como si fuera la unidad es lo que el sitio
 * evita. Los colores vienen de BRAND_PALETTE porque satori no ve globals.css.
 * -------------------------------------------------------------------------- */

export const alt = "Estimado de importación de un auto a Perú, calculado con Luxcars";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function SharedQuoteImage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const shared = resolveSharedEstimate(code);
  const estimate = shared?.evaluation.kind === "ready" ? shared.evaluation.estimate : null;

  const titulo = shared?.vehicleName ?? "Importación de autos a pedido";
  const cifra = estimate ? formatCurrency(estimate.finalEstimate) : null;
  const detalle = estimate
    ? `Precio en EE.UU. ${formatCurrency(estimate.input.priceMiami)} · flete y seguro · tributos SUNAT · servicio`
    : "Calcula el costo puesto en Lima, con tributos SUNAT, flete y seguro";

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
          padding: "64px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              letterSpacing: "0.22em",
              color: BRAND_PALETTE.ink,
              fontWeight: 600,
            }}
          >
            LUX
            <span style={{ color: BRAND_PALETTE.silver, padding: "0 12px" }}>|</span>
            CARS
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: "0.16em",
              color: BRAND_PALETTE.ink3,
            }}
          >
            ESTIMADO DE IMPORTACIÓN
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: titulo.length > 34 ? 52 : 64,
              lineHeight: 1.1,
              color: BRAND_PALETTE.ink,
              fontWeight: 600,
              maxWidth: 1040,
            }}
          >
            {titulo}
          </div>

          {cifra ? (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  letterSpacing: "0.14em",
                  color: BRAND_PALETTE.ink3,
                }}
              >
                PUESTO EN LIMA, CON PLACAS
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  fontSize: 104,
                  lineHeight: 1,
                  color: BRAND_PALETTE.silverBright,
                  fontWeight: 600,
                }}
              >
                {cifra}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${BRAND_PALETTE.line}`,
            paddingTop: 26,
            fontSize: 22,
            color: BRAND_PALETTE.ink3,
          }}
        >
          <div style={{ display: "flex", maxWidth: 880 }}>{detalle}</div>
          <div style={{ display: "flex", color: BRAND_PALETTE.silver, letterSpacing: "0.12em" }}>
            luxcars.pe
          </div>
        </div>
      </div>
    ),
    size,
  );
}
