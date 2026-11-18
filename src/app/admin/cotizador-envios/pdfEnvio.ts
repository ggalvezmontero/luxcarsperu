/**
 * PDF de la cotización de envío, para mandárselo al cliente.
 *
 * Misma plantilla que el estimado de la calculadora pública (`lib/pdfExport`):
 * cabecera negra con el logo, tarjetas de resumen, desglose agrupado, pie con
 * la razón social. Aquí además va la comparación Ley del Retorno vs.
 * importación regular y los "puntos a tener en cuenta", que son las mismas
 * alertas que lleva el mensaje de WhatsApp: solo las marcadas `paraCliente`.
 * Lo interno (margen frente al tope, método del valor en aduana) no sale.
 *
 * jspdf y jspdf-autotable se cargan con import() al pulsar el botón, igual
 * que en la calculadora: ~500 KB que no deben entrar en la carga de la página.
 */

import { CONFIG_ENVIOS, CONFIG_ENVIOS_VERIFICADA } from "@/core/envios/configEnvios";
import type { DesgloseRegimen, EntradaCotizacionEnvio, ResultadoCotizacionEnvio } from "@/core/envios/tipos";
import { fechaCorta } from "@/core/envios/validaciones";
import { getVehicleCategory } from "@/core/pricing/vehicleCategories";
import { findBrandLogo } from "@/lib/brandLogos";
import { LUXCARS_CONFIG } from "@/lib/config";
import { PDF_PALETTE, drawFitted, loadRaster, type DocWithAutoTable } from "@/lib/pdfExport";
import { formatCurrency, formatNumber, formatRate } from "@/lib/utils";

const { INK, INK_2, INK_3, LINE, PAPER, WHITE, SILVER } = PDF_PALETTE;

const NOMBRE_CORTO: Record<DesgloseRegimen["regimen"], string> = {
  "ley-retorno": "Ley del Retorno",
  "importacion-regular": "Importación regular",
};

const usd = (n: number) => formatCurrency(n);

export async function generarPdfEnvio(
  entrada: EntradaCotizacionEnvio,
  resultado: ResultadoCotizacionEnvio,
  numero?: string | null,
): Promise<void> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = W - 2 * M;
  const FOOT_H = 22;
  const LIMITE = H - FOOT_H - 8;
  const { contact, legalName, ruc } = LUXCARS_CONFIG;
  const { vehiculo, origen, cliente } = entrada;
  const { elegido, retorno, regular } = resultado;
  const totalElegido = elegido.tributos || elegido.regimen === "ley-retorno" ? usd(elegido.totalUsd) : "No aplica";

  const [logo, brandLogo] = await Promise.all([
    loadRaster("/brand/logo-blanco.svg", 1000),
    (() => {
      const l = findBrandLogo(vehiculo.marca);
      return l && l.mode !== "none" ? loadRaster(l.src, 600) : Promise.resolve(null);
    })(),
  ]);

  /* Salto de página si la sección siguiente no cabe sobre el pie. */
  let y = 0;
  const asegurar = (alto: number) => {
    if (y + alto > LIMITE) {
      doc.addPage();
      y = M;
    }
  };

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
  // Sin charSpace: jsPDF no lo descuenta al alinear a la derecha y el texto se saldría del papel.
  doc.text("ESTIMADO DE ENVÍO · VEHÍCULO PROPIO", W - M, 12, { align: "right" });
  const fecha = new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
  doc.setTextColor(...WHITE).setFontSize(9);
  doc.text(fecha, W - M, 19, { align: "right" });
  doc.setTextColor(...SILVER).setFontSize(8);
  doc.text(numero ? `${numero} · referencial` : "Referencial", W - M, 24.5, { align: "right" });

  y = HEAD_H + 10;

  /* ── Para quién ─────────────────────────────────────────────────── */
  doc.setTextColor(...INK_3).setFont("helvetica", "bold").setFontSize(8);
  doc.text("PREPARADO PARA", M, y, { charSpace: 0.5 });
  doc.text("RÉGIMEN", W - M, y, { align: "right", charSpace: 0.5 });
  y += 5.5;
  doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(11);
  doc.text(cliente.nombre.trim() || "Cliente", M, y);
  doc.text(NOMBRE_CORTO[elegido.regimen], W - M, y, { align: "right" });
  if (cliente.whatsapp.trim()) {
    y += 5;
    doc.setTextColor(...INK_3).setFont("helvetica", "normal").setFontSize(8.5);
    doc.text(`WhatsApp ${cliente.whatsapp.trim()}`, M, y);
  }
  y += 10;

  /* ── Vehículo ───────────────────────────────────────────────────── */
  doc.setTextColor(...INK_3).setFont("helvetica", "bold").setFontSize(8);
  doc.text("VEHÍCULO", M, y, { charSpace: 0.5 });
  y += 7;
  doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(22);
  const titulo = [vehiculo.marca, vehiculo.modelo, vehiculo.anioModelo].filter(Boolean).join(" ").trim() || "Vehículo";
  const lineasTitulo = doc.splitTextToSize(titulo, CW - 40) as string[];
  doc.text(lineasTitulo, M, y);
  if (brandLogo) drawFitted(doc, brandLogo, W - M - 34, y - 12, 34, 16, "right");
  y += 6 + (lineasTitulo.length - 1) * 9;

  const desde = [origen.ciudad, origen.estado].filter((s) => s.trim()).join(", ");
  const chips = [
    vehiculo.condicion === "nuevo" ? "Nuevo" : "Usado",
    getVehicleCategory(vehiculo.combustible).label,
    vehiculo.paisFabricacion.trim() ? `Fabricado en ${vehiculo.paisFabricacion.trim()}` : null,
    vehiculo.condicion === "usado" ? `${formatNumber(resultado.recorridoKm)} km` : null,
    desde ? `Desde ${desde}` : null,
    `Sale por ${origen.puertoSalida || CONFIG_ENVIOS.puertoSalidaPorDefecto}`,
    `Valor declarado ${usd(vehiculo.valorFacturaUsd)}`,
  ].filter((c): c is string => Boolean(c));
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
  doc.text("TOTAL REFERENCIAL HASTA LIMA", M + 6, y + 8, { charSpace: 0.4 });
  doc.setTextColor(...WHITE).setFontSize(22);
  doc.text(totalElegido, M + 6, y + 17.5);
  doc.setTextColor(...SILVER).setFont("helvetica", "normal").setFontSize(7.5);
  doc.text(
    elegido.regimen === "ley-retorno"
      ? "Sin tributos de importación, por la Ley del Retorno."
      : "Sin la percepción del IGV, que va aparte.",
    M + 6,
    y + 23.5,
  );

  const x2 = M + cardW + gap;
  doc.setFillColor(...PAPER).setDrawColor(...LINE).setLineWidth(0.3);
  doc.roundedRect(x2, y, cardW, cardH, 3, 3, "FD");
  doc.setTextColor(...INK_3).setFont("helvetica", "bold").setFontSize(7.5);
  if (elegido.regimen === "ley-retorno") {
    doc.text("AHORRO FRENTE A LA IMPORTACIÓN REGULAR", x2 + 6, y + 8, { charSpace: 0.4 });
    doc.setTextColor(...INK).setFontSize(22);
    doc.text(regular.tributos ? usd(regular.totalUsd - retorno.totalUsd) : "—", x2 + 6, y + 17.5);
    doc.setTextColor(...INK_3).setFont("helvetica", "normal").setFontSize(7.5);
    doc.text(
      regular.tributos
        ? `Como importación regular costaría ${usd(regular.totalUsd)} más percepción.`
        : "Como importación regular el vehículo no podría nacionalizarse.",
      x2 + 6,
      y + 23.5,
    );
  } else {
    doc.text("EFECTIVO A DESEMBOLSAR", x2 + 6, y + 8, { charSpace: 0.4 });
    doc.setTextColor(...INK).setFontSize(22);
    doc.text(elegido.tributos ? usd(elegido.efectivoUsd) : "—", x2 + 6, y + 17.5);
    doc.setTextColor(...INK_3).setFont("helvetica", "normal").setFontSize(7.5);
    doc.text(
      elegido.tributos
        ? `Incluye percepción del IGV (${formatRate(elegido.tributos.tasas.percepcion)}), recuperable como crédito fiscal.`
        : "El vehículo no puede nacionalizarse por esta vía.",
      x2 + 6,
      y + 23.5,
    );
  }
  y += cardH + 6;

  /* ── Desglose agrupado ──────────────────────────────────────────── */
  type Row = [string, string];
  const group = (title: string, rows: Row[]) => [
    [{ content: title, colSpan: 2, styles: { fontStyle: "bold" as const, textColor: INK_3, fillColor: WHITE, fontSize: 7.5, cellPadding: { top: 3, bottom: 1.2, left: 0, right: 0 } } }],
    ...rows,
  ];

  const tributos: Row[] =
    elegido.regimen === "ley-retorno"
      ? [["Tributos de importación (exonerados por la Ley del Retorno)", usd(0)]]
      : elegido.tributos
        ? [
            [`Ad valorem ${formatRate(elegido.tributos.tasas.adValorem)} sobre el CIF (${usd(elegido.cifUsd)})`, usd(elegido.tributos.adValorem)],
            [`ISC ${formatRate(elegido.tributos.tasas.isc)} sobre CIF + ad valorem`, usd(elegido.tributos.isc)],
            [`IGV ${formatRate(elegido.tributos.tasas.igv)} + IPM ${formatRate(elegido.tributos.tasas.ipm)} sobre CIF + ad valorem + ISC`, usd(elegido.tributos.igv + elegido.tributos.ipm)],
          ]
        : [["Tributos de importación: no aplica, el vehículo no puede nacionalizarse por esta vía", "—"]];

  const servicioNota =
    entrada.costos.servicio.tipo === "porcentaje"
      ? ` (${formatRate(entrada.costos.servicio.tasa)} del valor declarado)`
      : "";

  const body = [
    ...group("LOGÍSTICA", [
      ["Transporte interno en EE.UU. hasta el puerto", usd(elegido.transporteInternoUsd)],
      [`Flete marítimo ${origen.puertoSalida || CONFIG_ENVIOS.puertoSalidaPorDefecto}–Callao`, usd(elegido.fleteUsd)],
      ["Seguro internacional", usd(elegido.seguroUsd)],
    ]),
    ...group("TRIBUTOS SUNAT", tributos),
    ...group("ADUANA Y SERVICIO", [
      ["Gastos de aduana y puerto en el Callao", usd(elegido.gastosAduanaUsd)],
      [`Servicio Luxcars: gestión documentaria, coordinación del embarque y despacho${servicioNota}`, usd(elegido.servicioUsd)],
    ]),
  ];

  asegurar(60);
  autoTable(doc, {
    startY: y,
    body,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9, textColor: INK_2, cellPadding: { top: 2.1, bottom: 2.1, left: 0, right: 0 }, lineColor: LINE, lineWidth: 0 },
    columnStyles: {
      0: { cellWidth: CW - 45 },
      1: { cellWidth: 45, halign: "right", fontStyle: "bold", textColor: INK },
    },
    margin: { left: M, right: M, bottom: FOOT_H + 8 },
    didDrawCell: (data) => {
      if (data.column.index === 1 && Array.isArray(data.row.raw) && data.row.raw.length === 2) {
        doc.setDrawColor(...LINE).setLineWidth(0.2);
        doc.line(M, data.cell.y + data.cell.height, W - M, data.cell.y + data.cell.height);
      }
    },
  });
  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 3;

  asegurar(14);
  doc.setFillColor(...PAPER);
  doc.roundedRect(M, y, CW, 11, 2, 2, "F");
  doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(10);
  doc.text("Total referencial hasta Lima", M + 4, y + 7.2);
  doc.text(totalElegido, W - M - 4, y + 7.2, { align: "right" });
  y += 14;

  if (elegido.tributos && elegido.tributos.percepcion > 0) {
    asegurar(17);
    doc.setDrawColor(...SILVER).setLineWidth(0.6);
    doc.line(M, y, M, y + 12);
    doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(9);
    doc.text(`Percepción del IGV ${formatRate(elegido.tributos.tasas.percepcion)}: ${usd(elegido.tributos.percepcion)}`, M + 4, y + 4.5);
    doc.setTextColor(...INK_3).setFont("helvetica", "normal").setFontSize(8);
    doc.text(
      doc.splitTextToSize("No es un costo: es un adelanto del IGV que se recupera como crédito fiscal. Sí es efectivo que hay que tener el día del despacho.", CW - 6),
      M + 4,
      y + 9.5,
    );
    y += 17;
  }

  /* ── Comparación ────────────────────────────────────────────────── */
  // Título y tabla van juntos: si no caben enteros, pasan a la página siguiente.
  asegurar(72);
  doc.setTextColor(...INK_3).setFont("helvetica", "bold").setFontSize(8);
  doc.text("LEY DEL RETORNO FRENTE A IMPORTACIÓN REGULAR", M, y, { charSpace: 0.5 });
  y += 3;

  const celda = (n: number | null) => (n === null ? "—" : usd(n));
  const igvIpm = (d: DesgloseRegimen) => (d.tributos ? d.tributos.igv + d.tributos.ipm : null);
  const comparacion: [string, string, string][] = [
    ["Transporte interno, flete y seguro", celda(retorno.transporteInternoUsd + retorno.fleteUsd + retorno.seguroUsd), celda(regular.transporteInternoUsd + regular.fleteUsd + regular.seguroUsd)],
    ["Ad valorem", celda(retorno.tributos?.adValorem ?? 0), celda(regular.tributos?.adValorem ?? null)],
    ["ISC", celda(retorno.tributos?.isc ?? 0), celda(regular.tributos?.isc ?? null)],
    ["IGV + IPM", celda(igvIpm(retorno) ?? 0), celda(igvIpm(regular))],
    ["Gastos de aduana y servicio", celda(retorno.gastosAduanaUsd + retorno.servicioUsd), celda(regular.gastosAduanaUsd + regular.servicioUsd)],
    ["Total referencial", usd(retorno.totalUsd), regular.tributos ? usd(regular.totalUsd) : "No aplica"],
    ["Percepción del IGV (adelanto, aparte)", usd(0), celda(regular.tributos?.percepcion ?? null)],
  ];
  const FILA_TOTAL = 5;
  const marca = (r: DesgloseRegimen["regimen"]) => (elegido.regimen === r ? " · elegido" : "");
  autoTable(doc, {
    startY: y,
    head: [["Concepto", `Ley del Retorno${marca("ley-retorno")}${retorno.beneficioAplica ? "" : " · sin beneficio"}`, `Importación regular${marca("importacion-regular")}`]],
    body: comparacion,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8.5, textColor: INK_2, cellPadding: { top: 2, bottom: 2, left: 0, right: 0 } },
    headStyles: { fontStyle: "bold", textColor: INK_3, fontSize: 7.5, fillColor: WHITE },
    columnStyles: {
      0: { cellWidth: CW - 84 },
      1: { cellWidth: 42, halign: "right", fontStyle: elegido.regimen === "ley-retorno" ? "bold" : "normal", textColor: elegido.regimen === "ley-retorno" ? INK : INK_2 },
      2: { cellWidth: 42, halign: "right", fontStyle: elegido.regimen === "importacion-regular" ? "bold" : "normal", textColor: elegido.regimen === "importacion-regular" ? INK : INK_2 },
    },
    margin: { left: M, right: M, bottom: FOOT_H + 8 },
    pageBreak: "avoid",
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index > 0) data.cell.styles.halign = "right";
      if (data.section === "body" && data.row.index === FILA_TOTAL) {
        data.cell.styles.fillColor = PAPER;
        data.cell.styles.fontStyle = "bold";
        if (data.column.index === 0) data.cell.styles.textColor = INK;
      }
    },
    didDrawCell: (data) => {
      if (data.column.index === 2) {
        doc.setDrawColor(...LINE).setLineWidth(0.2);
        doc.line(M, data.cell.y + data.cell.height, W - M, data.cell.y + data.cell.height);
      }
    },
  });
  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 8;

  /* ── Puntos a tener en cuenta (las mismas alertas del WhatsApp) ─── */
  const avisos = resultado.alertas.filter((a) => a.paraCliente && a.nivel !== "info");
  const fechaLimite = resultado.alertas.find((a) => a.clave === "antiguedad" && a.nivel === "info");
  const puntos = [...avisos, ...(fechaLimite ? [fechaLimite] : [])];
  if (puntos.length > 0) {
    asegurar(20);
    doc.setTextColor(...INK_3).setFont("helvetica", "bold").setFontSize(8);
    doc.text("PUNTOS A TENER EN CUENTA", M, y, { charSpace: 0.5 });
    y += 6;
    for (const a of puntos) {
      const lineas = doc.splitTextToSize(a.detalle, CW - 6) as string[];
      const alto = 4.5 + lineas.length * 3.8 + 2.5;
      asegurar(alto);
      doc.setFillColor(...INK);
      doc.circle(M + 1.2, y - 1.1, 1, "F");
      doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(8.5);
      doc.text(a.titulo, M + 5, y);
      doc.setTextColor(...INK_2).setFont("helvetica", "normal").setFontSize(8);
      doc.text(lineas, M + 5, y + 4.2);
      y += alto;
    }
    y += 2;
  }

  /* ── Nota legal ─────────────────────────────────────────────────── */
  const nota = `${resultado.nota} Los tributos son tasas fijas; varían el tipo de cambio del día, el flete del mes y el valor que SUNAT acepte como base imponible. Parámetros verificados el ${fechaCorta(CONFIG_ENVIOS_VERIFICADA)}. No constituye oferta en firme.`;
  const lineasNota = doc.splitTextToSize(nota, CW) as string[];
  asegurar(lineasNota.length * 3.5 + 2);
  doc.setTextColor(...INK_3).setFont("helvetica", "normal").setFontSize(7.5);
  doc.text(lineasNota, M, y);

  /* ── Pie en todas las páginas ───────────────────────────────────── */
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFillColor(...INK);
    doc.rect(0, H - FOOT_H, W, FOOT_H, "F");
    doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(8.5);
    doc.text(legalName, M, H - FOOT_H + 8);
    doc.setTextColor(...SILVER).setFont("helvetica", "normal").setFontSize(7.5);
    doc.text(`RUC ${ruc} · ${contact.address}, ${contact.city}`, M, H - FOOT_H + 13.5);
    doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(8.5);
    doc.text(`WhatsApp ${contact.phone}`, W - M, H - FOOT_H + 8, { align: "right" });
    doc.setTextColor(...SILVER).setFont("helvetica", "normal").setFontSize(7.5);
    doc.text(`${contact.email} · luxcars.pe${paginas > 1 ? ` · ${i}/${paginas}` : ""}`, W - M, H - FOOT_H + 13.5, { align: "right" });
  }

  const limpio = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const partes = ["Luxcars_Envio", numero ?? "", limpio(vehiculo.marca), limpio(vehiculo.modelo), String(vehiculo.anioModelo)].filter(Boolean);
  doc.save(`${partes.join("_")}.pdf`);
}
