// jspdf + jspdf-autotable pesan ~500 KB. Solo se cargan al pulsar "PDF":
// aquí entran como tipo y el módulo real se pide con import() dinámico.
import type jsPDF from "jspdf";
import type { PremiumImportQuote } from "@/core/pricing/priceCalculator";
import { findBrandLogo } from "./brandLogos";
import { LUXCARS_CONFIG } from "./config";
import { formatCurrency, formatPercentage } from "./utils";

type DocWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };
type RGB = [number, number, number];

/* Paleta del PDF: mismo sistema que la web, sobre papel blanco. */
const INK: RGB = [10, 10, 11];
const INK_2: RGB = [70, 70, 76];
const INK_3: RGB = [120, 120, 128];
const LINE: RGB = [225, 225, 229];
const PAPER: RGB = [245, 245, 247];
const WHITE: RGB = [255, 255, 255];
const SILVER: RGB = [192, 192, 192];

type Raster = { data: string; width: number; height: number };

/** Carga una imagen de /public y la devuelve como PNG en base64 (los SVG se rasterizan). */
async function loadRaster(url: string, rasterWidth = 1200): Promise<Raster | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    return await new Promise<Raster | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const ratio = img.naturalWidth / img.naturalHeight;
          const canvas = document.createElement("canvas");
          canvas.width = rasterWidth;
          canvas.height = Math.round(rasterWidth / ratio);
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({ data: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height });
        } catch {
          resolve(null);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}

/** Dibuja una imagen dentro de una caja respetando la proporción. */
function drawFitted(doc: jsPDF, img: Raster, x: number, y: number, w: number, h: number, align: "left" | "right" = "left") {
  const ratio = img.width / img.height;
  let dw = w;
  let dh = dw / ratio;
  if (dh > h) {
    dh = h;
    dw = dh * ratio;
  }
  const dx = align === "right" ? x + w - dw : x;
  const dy = y + (h - dh) / 2;
  doc.addImage(img.data, "PNG", dx, dy, dw, dh, undefined, "FAST");
}

export async function generatePDF(estimate: PremiumImportQuote): Promise<void> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = W - 2 * M;
  const { contact, legalName, ruc } = LUXCARS_CONFIG;

  const [logo, brandLogo] = await Promise.all([
    loadRaster("/brand/logo-blanco.svg", 1000),
    (() => {
      const logo = findBrandLogo(estimate.input.brand);
      // Sobre papel blanco solo sirven los logos oscuros (los blancos se pierden).
      return logo && logo.mode === "invert" ? loadRaster(logo.src, 600) : Promise.resolve(null);
    })(),
  ]);

  /* ── Cabecera negra ─────────────────────────────────────────────── */
  const HEAD_H = 30;
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, HEAD_H, "F");
  if (logo) {
    drawFitted(doc, logo, M, 4, 40, 22);
  } else {
    doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(16);
    doc.text("LUX | CARS", M, 20);
  }
  doc.setTextColor(...SILVER).setFont("helvetica", "normal").setFontSize(8);
  doc.text("ESTIMADO DE IMPORTACIÓN", W - M, 12, { align: "right", charSpace: 0.6 });
  const fecha = new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
  doc.setTextColor(...WHITE).setFontSize(9);
  doc.text(fecha, W - M, 19, { align: "right" });
  doc.setTextColor(...SILVER).setFontSize(8);
  doc.text("Puesto en Lima · referencial", W - M, 24.5, { align: "right" });

  let y = HEAD_H + 10;

  /* ── Vehículo ───────────────────────────────────────────────────── */
  doc.setTextColor(...INK_3).setFont("helvetica", "bold").setFontSize(8);
  doc.text("VEHÍCULO", M, y, { charSpace: 0.5 });
  y += 7;
  doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(22);
  const titulo = `${estimate.input.brand} ${estimate.input.model} ${estimate.input.year}`;
  doc.text(doc.splitTextToSize(titulo, CW - 40), M, y);
  if (brandLogo) drawFitted(doc, brandLogo, W - M - 34, y - 12, 34, 16, "right");
  y += 6;

  const chips = [
    estimate.condition === "nuevo" ? "Nuevo" : "Usado",
    estimate.vehicleCategory.label,
    `Plan ${estimate.planConfig.label} · ${estimate.planConfig.timelineLabel}`,
    `ISC ${formatPercentage(estimate.iscRate)}`,
    `Ad valorem ${formatPercentage(estimate.adValoremRate)}`,
  ];
  let cx = M;
  doc.setFontSize(7.5).setFont("helvetica", "bold");
  chips.forEach((chip) => {
    const tw = doc.getTextWidth(chip) + 7;
    if (cx + tw > W - M) {
      cx = M;
      y += 8;
    }
    doc.setFillColor(...PAPER).setDrawColor(...LINE).setLineWidth(0.2);
    doc.roundedRect(cx, y, tw, 6.5, 3.25, 3.25, "FD");
    doc.setTextColor(...INK_2);
    doc.text(chip, cx + 3.5, y + 4.4);
    cx += tw + 2.5;
  });
  y += 13;

  /* ── Dos tarjetas de resumen ────────────────────────────────────── */
  const cardH = 27;
  const gap = 5;
  const cardW = (CW - gap) / 2;

  doc.setFillColor(...INK);
  doc.roundedRect(M, y, cardW, cardH, 3, 3, "F");
  doc.setTextColor(...SILVER).setFont("helvetica", "bold").setFontSize(7.5);
  doc.text("PUESTO EN LIMA, CON PLACAS", M + 6, y + 8, { charSpace: 0.4 });
  doc.setTextColor(...WHITE).setFontSize(22);
  doc.text(formatCurrency(estimate.finalEstimate), M + 6, y + 17.5);
  doc.setTextColor(...SILVER).setFont("helvetica", "normal").setFontSize(7.5);
  doc.text(
    `Rango ${formatCurrency(estimate.finalRange.min)} – ${formatCurrency(estimate.finalRange.max)}`,
    M + 6,
    y + 23.5,
  );

  const x2 = M + cardW + gap;
  doc.setFillColor(...PAPER).setDrawColor(...LINE).setLineWidth(0.3);
  doc.roundedRect(x2, y, cardW, cardH, 3, 3, "FD");
  doc.setTextColor(...INK_3).setFont("helvetica", "bold").setFontSize(7.5);
  doc.text("EFECTIVO A DESEMBOLSAR", x2 + 6, y + 8, { charSpace: 0.4 });
  doc.setTextColor(...INK).setFontSize(22);
  doc.text(formatCurrency(estimate.cashRequired), x2 + 6, y + 17.5);
  doc.setTextColor(...INK_3).setFont("helvetica", "normal").setFontSize(7.5);
  doc.text(
    `Incluye percepción del IGV (${formatPercentage(estimate.percepcionRate)}), recuperable como crédito fiscal.`,
    x2 + 6,
    y + 23.5,
  );
  y += cardH + 6;

  /* ── Desglose agrupado ──────────────────────────────────────────── */
  type Row = [string, string];
  const group = (title: string, rows: Row[]) => [
    [{ content: title, colSpan: 2, styles: { fontStyle: "bold" as const, textColor: INK_3, fillColor: WHITE, fontSize: 7.5, cellPadding: { top: 3, bottom: 1.2, left: 0, right: 0 } } }],
    ...rows,
  ];

  const servicio = estimate.stateComplianceFee + estimate.brokerFee + estimate.documentHandlingFee;
  const body = [
    ...group("VEHÍCULO Y LOGÍSTICA", [
      ["Precio en EE.UU.", formatCurrency(estimate.input.priceMiami)],
      ["Flete marítimo hasta el Callao", formatCurrency(estimate.freight)],
      ["Seguro internacional", formatCurrency(estimate.insurance)],
      ["Valor CIF", formatCurrency(estimate.cif)],
    ]),
    ...group("TRIBUTOS SUNAT", [
      [`Ad valorem ${formatPercentage(estimate.adValoremRate)} sobre CIF`, formatCurrency(estimate.adValorem)],
      [`ISC ${formatPercentage(estimate.iscRate)} sobre CIF + ad valorem`, formatCurrency(estimate.isc)],
      ["IGV 15.5% sobre CIF + ad valorem + ISC", formatCurrency(estimate.igv)],
      ["IPM 2.5% sobre la misma base", formatCurrency(estimate.ipm)],
    ]),
    ...group("SERVICIO LUXCARS", [
      ["Inspección, negociación, logística y gestión documentaria", formatCurrency(servicio)],
    ]),
  ];

  autoTable(doc, {
    startY: y,
    body,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9, textColor: INK_2, cellPadding: { top: 2.1, bottom: 2.1, left: 0, right: 0 }, lineColor: LINE, lineWidth: 0 },
    columnStyles: {
      0: { cellWidth: CW - 45 },
      1: { cellWidth: 45, halign: "right", fontStyle: "bold", textColor: INK },
    },
    margin: { left: M, right: M },
    didDrawCell: (data) => {
      // Filete fino bajo cada fila de dato (no bajo los títulos de grupo).
      if (data.column.index === 1 && data.row.raw && Array.isArray(data.row.raw) && data.row.raw.length === 2) {
        doc.setDrawColor(...LINE).setLineWidth(0.2);
        doc.line(M, data.cell.y + data.cell.height, W - M, data.cell.y + data.cell.height);
      }
    },
  });
  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 3;

  // Total
  doc.setFillColor(...PAPER);
  doc.roundedRect(M, y, CW, 11, 2, 2, "F");
  doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(10);
  doc.text("Costo total puesto en Lima", M + 4, y + 7.2);
  doc.text(formatCurrency(estimate.finalEstimate), W - M - 4, y + 7.2, { align: "right" });
  y += 14;

  // Percepción, aparte
  doc.setDrawColor(...SILVER).setLineWidth(0.6);
  doc.line(M, y, M, y + 12);
  doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(9);
  doc.text(`Percepción del IGV ${formatPercentage(estimate.percepcionRate)}: ${formatCurrency(estimate.percepcion)}`, M + 4, y + 4.5);
  doc.setTextColor(...INK_3).setFont("helvetica", "normal").setFontSize(8);
  doc.text(
    doc.splitTextToSize("No es un costo: es un adelanto del IGV que se recupera como crédito fiscal. Sí es efectivo que debes tener el día del despacho.", CW - 6),
    M + 4,
    y + 9.5,
  );
  y += 17;

  /* ── Qué incluye ────────────────────────────────────────────────── */
  doc.setTextColor(...INK_3).setFont("helvetica", "bold").setFontSize(8);
  doc.text("QUÉ INCLUYE EL SERVICIO", M, y, { charSpace: 0.5 });
  y += 6;
  const incluye = [
    "Búsqueda en dealers verificados de EE.UU.",
    "CarFax, AutoCheck e inspección presencial antes de pagar",
    "Flete marítimo y seguro internacional",
    "Despacho SUNAT, homologación, placas y tarjeta de propiedad",
    "Seguimiento semanal por WhatsApp",
    `Entrega estimada: ${estimate.planConfig.timelineLabel} desde la reserva`,
  ];
  const colW = CW / 2;
  doc.setTextColor(...INK_2).setFont("helvetica", "normal").setFontSize(8.5);
  incluye.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const ix = M + col * colW;
    const iy = y + row * 6;
    doc.setFillColor(...INK);
    doc.circle(ix + 1.2, iy - 1.1, 1, "F");
    doc.text(item, ix + 5, iy);
  });
  y += Math.ceil(incluye.length / 2) * 6 + 3;

  /* ── Nota legal ─────────────────────────────────────────────────── */
  doc.setTextColor(...INK_3).setFont("helvetica", "normal").setFontSize(7.5);
  doc.text(
    doc.splitTextToSize(
      "Estimado referencial calculado con las tasas vigentes. Los tributos son tasas fijas; varían el tipo de cambio del día, el flete del mes y el valor que SUNAT acepte como base imponible. El ad valorem de 0% aplica solo a vehículos nuevos originarios de EE.UU. con certificado de origen. No constituye oferta en firme.",
      CW,
    ),
    M,
    y,
  );

  /* ── Pie ────────────────────────────────────────────────────────── */
  const FOOT_H = 22;
  doc.setFillColor(...INK);
  doc.rect(0, H - FOOT_H, W, FOOT_H, "F");
  doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(8.5);
  doc.text(legalName, M, H - FOOT_H + 8);
  doc.setTextColor(...SILVER).setFont("helvetica", "normal").setFontSize(7.5);
  doc.text(`RUC ${ruc} · ${contact.address}, ${contact.city}`, M, H - FOOT_H + 13.5);
  doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(8.5);
  doc.text(`WhatsApp ${contact.phone}`, W - M, H - FOOT_H + 8, { align: "right" });
  doc.setTextColor(...SILVER).setFont("helvetica", "normal").setFontSize(7.5);
  doc.text(`${contact.email} · luxcars.pe`, W - M, H - FOOT_H + 13.5, { align: "right" });

  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`LuxCars_Estimado_${clean(estimate.input.brand)}_${clean(estimate.input.model)}_${estimate.input.year}.pdf`);
}
