import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PremiumImportQuote } from '@/core/pricing/priceCalculator';
import { formatCurrency, formatPercentage } from './utils';
import { LUXCARS_CONFIG } from './config';

// Mapeo de marcas a sus logos
const BRAND_LOGOS: Record<string, string> = {
  'Porsche': '/images/brands/porsche.png',
  'BMW': '/images/brands/bmw.png',
  'Mercedes-Benz': '/images/brands/mercedes.png',
  'Audi': '/images/brands/audi.png',
  'Lexus': '/images/brands/lexus.png',
  'Tesla': '/images/brands/tesla.png',
  'Range Rover': '/images/brands/rangerover.png',
  'Cadillac': '/images/brands/cadillac.png',
  'Dodge SRT': '/images/brands/dodge.png',
  'Dodge': '/images/brands/dodge.png',
  'Bentley': '/images/brands/bentley.png',
  'Ferrari': '/images/brands/ferrari.png',
  'Lamborghini': '/images/brands/lamborghini.png',
  'McLaren': '/images/brands/mclaren.png',
  'Aston Martin': '/images/brands/astonmartin.png',
  'Rolls-Royce': '/images/brands/rollsroyce.png',
  'Toyota': '/images/brands/toyota.svg',
  'Jeep': '/images/brands/jeep.svg',
  'Ford': '/images/brands/ford.svg',
  'Chevrolet': '/images/brands/chevrolet.svg',
};

// Función para convertir imagen a base64
async function getImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  
  try {
    const fullUrl = url.startsWith('/') ? url : `/${url}`;
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      return null;
    }
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generatePDF(estimate: PremiumImportQuote): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // Colores mejorados
  const gold = [245, 208, 114]; // #f5d072 - más sutil
  const black = [20, 20, 20];
  const gray = [120, 120, 120];
  const badgeGray = [80, 80, 80]; // Gris más oscuro para badges
  const white = [255, 255, 255];
  const lightGray = [248, 248, 248];
  const priceBg = [250, 245, 235]; // Fondo crema muy claro para el precio

  let yPos = margin;

  // Header - Logo de empresa (izquierda) - mismo del navbar
  const companyLogo = await getImageAsBase64('/images/logo-clean.svg');
  
  if (companyLogo) {
    try {
      // Mantener aspect ratio del logo (cuadrado aproximadamente)
      const logoSize = 20; // Tamaño más grande y proporcionado
      doc.addImage(companyLogo, 'PNG', margin, yPos, logoSize, logoSize);
    } catch {
      // Fallback a texto
      doc.setFontSize(20);
      doc.setTextColor(...gold);
      doc.setFont('helvetica', 'bold');
      doc.text('LuxCars', margin, yPos + 7);
    }
  } else {
    doc.setFontSize(20);
    doc.setTextColor(...gold);
    doc.setFont('helvetica', 'bold');
    doc.text('LuxCars', margin, yPos + 7);
  }

  // Logo de marca (derecha) - mantener aspect ratio
  const brandLogo = estimate.input.brand 
    ? await getImageAsBase64(BRAND_LOGOS[estimate.input.brand] || '')
    : null;

  if (brandLogo) {
    try {
      // Mantener proporción del logo de marca (generalmente más ancho que alto)
      const brandLogoHeight = 18;
      const brandLogoWidth = 28; // Proporción más natural
      doc.addImage(
        brandLogo, 
        'PNG', 
        pageWidth - margin - brandLogoWidth, 
        yPos, 
        brandLogoWidth, 
        brandLogoHeight
      );
    } catch {
      // Silenciosamente fallar
    }
  }

  yPos += 22;

  // Título principal
  doc.setFontSize(24);
  doc.setTextColor(...gold);
  doc.setFont('helvetica', 'bold');
  doc.text('Estimado de Importación', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Información del vehículo
  doc.setFontSize(16);
  doc.setTextColor(...black);
  doc.setFont('helvetica', 'bold');
  const vehicleInfo = `${estimate.input.brand} ${estimate.input.model} ${estimate.input.year}`;
  doc.text(vehicleInfo, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Badges - mejor diseño con fondo más oscuro
  const badges = [
    estimate.vehicleCategory.label,
    estimate.planConfig.label,
    `ISC ${formatPercentage(estimate.iscRate)}`,
  ];

  const badgeWidth = 42;
  const badgeSpacing = 8;
  const badgeHeight = 10;
  let badgeX = (pageWidth - (badges.length * badgeWidth + (badges.length - 1) * badgeSpacing)) / 2;

  badges.forEach((badge) => {
    // Fondo gris oscuro más elegante
    doc.setFillColor(...badgeGray);
    doc.setDrawColor(...badgeGray);
    doc.roundedRect(badgeX, yPos - 5, badgeWidth, badgeHeight, 3, 3, 'FD');
    
    // Texto blanco
    doc.setFontSize(9);
    doc.setTextColor(...white);
    doc.setFont('helvetica', 'normal');
    doc.text(badge, badgeX + badgeWidth / 2, yPos + 1, { align: 'center' });
    badgeX += badgeWidth + badgeSpacing;
  });

  yPos += 15;

  // Precio final destacado - fondo más sutil
  const priceBoxHeight = 28;
  
  // Fondo crema muy claro en lugar de amarillo fuerte
  doc.setFillColor(...priceBg);
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos - 12, contentWidth, priceBoxHeight, 4, 4, 'FD');
  
  // Borde dorado sutil
  doc.setDrawColor(...gold);
  doc.setLineWidth(1);
  doc.roundedRect(margin, yPos - 12, contentWidth, priceBoxHeight, 4, 4, 'D');
  
  doc.setFontSize(11);
  doc.setTextColor(...black);
  doc.setFont('helvetica', 'normal');
  doc.text('Precio Final Estimado Lima', pageWidth / 2, yPos + 1, { align: 'center' });
  
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(formatCurrency(estimate.finalEstimate), pageWidth / 2, yPos + 16, { align: 'center' });
  
  yPos += priceBoxHeight + 12;

  // Tabla de desglose
  const tableData = [
    ['Precio Miami', formatCurrency(estimate.input.priceMiami)],
    ['Flete', formatCurrency(estimate.freight)],
    ['Seguro (1.5%)', formatCurrency(estimate.insurance)],
    ['CIF (Costo + Seguro + Flete)', formatCurrency(estimate.cif)],
    ['Ad Valorem (6%)', formatCurrency(estimate.adValorem)],
    [`ISC (${formatPercentage(estimate.iscRate)})`, formatCurrency(estimate.isc)],
    ['IGV (18%)', formatCurrency(estimate.igv)],
    ['State Compliance Fee (5%)', formatCurrency(estimate.stateComplianceFee)],
    ['Broker Fee (10%)', formatCurrency(estimate.brokerFee)],
  ];

  if (estimate.documentHandlingFee > 0) {
    tableData.push(['Extra FastTrack', formatCurrency(estimate.documentHandlingFee)]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [['Concepto', 'Monto']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: gold,
      textColor: black,
      fontStyle: 'bold',
      fontSize: 11,
      cellPadding: 6,
    },
    bodyStyles: {
      textColor: black,
      fontSize: 10,
      cellPadding: 6,
    },
    alternateRowStyles: {
      fillColor: lightGray,
    },
    styles: {
      cellPadding: 6,
      lineColor: [230, 230, 230],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // Timeline
  doc.setFontSize(10);
  doc.setTextColor(...gold);
  doc.setFont('helvetica', 'bold');
  doc.text(`Timeline estimado: ${estimate.planConfig.timelineLabel}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Nota legal
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.setFont('helvetica', 'italic');
  const noteText = 'Este es un estimado de importación. El valor final puede variar según la partida arancelaria, condición del vehículo y determinación de SUNAT.';
  const splitNote = doc.splitTextToSize(noteText, contentWidth - 5);
  doc.text(splitNote, pageWidth / 2, yPos, { align: 'center' });
  yPos += splitNote.length * 4 + 10;

  // Footer
  const footerY = pageHeight - 25;
  
  // Línea separadora
  doc.setDrawColor(...gray);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

  // Nombre empresa
  doc.setFontSize(10);
  doc.setTextColor(...black);
  doc.setFont('helvetica', 'bold');
  doc.text(LUXCARS_CONFIG.brandName, margin, footerY);
  
  // Contacto
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.setFont('helvetica', 'normal');
  
  let contactY = footerY + 5;
  doc.text(`Teléfono: ${LUXCARS_CONFIG.contact.phone}`, margin, contactY);
  contactY += 4;
  doc.text(`Email: ${LUXCARS_CONFIG.contact.email}`, margin, contactY);
  
  // Dirección (derecha)
  contactY = footerY + 5;
  const addressLines = doc.splitTextToSize(LUXCARS_CONFIG.contact.address, 75);
  doc.text(addressLines, pageWidth - margin, contactY, { align: 'right' });

  // Fecha
  const date = new Date().toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.setFontSize(7);
  doc.text(`Generado el ${date}`, pageWidth / 2, pageHeight - 5, { align: 'center' });

  // Guardar
  const cleanBrand = estimate.input.brand.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanModel = estimate.input.model.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `LuxCars_Estimado_${cleanBrand}_${cleanModel}_${estimate.input.year}.pdf`;
  doc.save(fileName);
}
