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
  'Chrysler': '/images/brands/chrysler.png',
};

// Función mejorada para convertir imagen a base64 con dimensiones
async function getImageAsBase64(url: string): Promise<{data: string; width: number; height: number} | null> {
  if (!url) return null;
  
  try {
    const fullUrl = url.startsWith('/') ? url : `/${url}`;
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      console.warn(`No se pudo cargar la imagen: ${fullUrl}`);
      return null;
    }
    
    const blob = await response.blob();
    
    // Para SVG, intentar convertir a PNG usando canvas con alta calidad
    if (blob.type === 'image/svg+xml') {
      try {
        const svgText = await blob.text();
        const img = new Image();
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
        const urlObj = URL.createObjectURL(svgBlob);
        
        return new Promise((resolve) => {
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              // Usar dimensiones reales de la imagen SVG
              const aspectRatio = img.naturalWidth / img.naturalHeight;
              canvas.width = 800;
              canvas.height = canvas.width / aspectRatio;
              
              const ctx = canvas.getContext('2d', { alpha: true });
              if (ctx) {
                // Limpiar canvas con transparencia
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Habilitar suavizado para mejor calidad
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                // Dibujar la imagen
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pngData = canvas.toDataURL('image/png', 1.0); // Máxima calidad
                URL.revokeObjectURL(urlObj);
                resolve({
                  data: pngData,
                  width: img.naturalWidth,
                  height: img.naturalHeight
                });
              } else {
                URL.revokeObjectURL(urlObj);
                resolve(null);
              }
            } catch {
              URL.revokeObjectURL(urlObj);
              resolve(null);
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(urlObj);
            resolve(null);
          };
          img.src = urlObj;
        });
      } catch {
        // Si falla la conversión, devolver null
        return null;
      }
    }
    
    // Para PNG/JPG, devolver directamente con dimensiones
    return new Promise((resolve) => {
      const img = new Image();
      const urlObj = URL.createObjectURL(blob);
      
      img.onload = () => {
        const reader = new FileReader();
        reader.onloadend = () => {
          URL.revokeObjectURL(urlObj);
          resolve({
            data: reader.result as string,
            width: img.naturalWidth,
            height: img.naturalHeight
          });
        };
        reader.onerror = () => {
          URL.revokeObjectURL(urlObj);
          resolve(null);
        };
        reader.readAsDataURL(blob);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(urlObj);
        resolve(null);
      };
      
      img.src = urlObj;
    });
  } catch (error) {
    console.warn('Error cargando imagen:', error);
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
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // Paleta de colores moderna y elegante - tema oscuro premium
  const darkBlue: [number, number, number] = [15, 23, 42]; // Slate 900
  const mediumGray: [number, number, number] = [51, 65, 85]; // Slate 700
  const lightGray: [number, number, number] = [148, 163, 184]; // Slate 400
  const veryLightGray: [number, number, number] = [241, 245, 249]; // Slate 100
  const white: [number, number, number] = [255, 255, 255];
  const accentBlue: [number, number, number] = [59, 130, 246]; // Blue 500
  const successGreen: [number, number, number] = [16, 185, 129]; // Emerald 500

  let yPos = margin;

  // Barra superior oscura con información de marca
  doc.setFillColor(...darkBlue);
  doc.rect(0, 0, pageWidth, 30, 'F');
  
  // Logo de LuxCars (pequeño icono al lado del texto)
  const companyLogoData = await getImageAsBase64('/images/logo-clean.svg');
  let textStartX = margin;
  
  if (companyLogoData) {
    try {
      const logoSize = 11; // Logo cuadrado pequeño
      doc.addImage(
        companyLogoData.data, 
        'PNG',
        margin, 
        yPos + 1, 
        logoSize, 
        logoSize,
        undefined,
        'SLOW'
      );
      textStartX = margin + logoSize + 3; // Espacio después del logo
    } catch (error) {
      // Si falla, solo usar texto
      textStartX = margin;
    }
  }
  
  // Logo de empresa - minimalista (sin PERÚ)
  doc.setFontSize(20);
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.text('LUXCARS', textStartX, yPos + 9);

  // Logo de marca (derecha) - en card blanco con bordes redondeados
  const brandLogoData = estimate.input.brand 
    ? await getImageAsBase64(BRAND_LOGOS[estimate.input.brand] || '')
    : null;

  if (brandLogoData) {
    try {
      // Card blanco con bordes redondeados para el logo
      const cardWidth = 50;
      const cardHeight = 20;
      const cardPadding = 4; // Padding interno del card
      const cardX = pageWidth - margin - cardWidth;
      const cardY = yPos - 1; // Centrado verticalmente en la barra
      
      // Dibujar card blanco con bordes redondeados
      doc.setFillColor(...white);
      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, 'F');
      
      // Calcular dimensiones del logo respetando aspect ratio REAL
      const maxLogoWidth = cardWidth - (cardPadding * 2);
      const maxLogoHeight = cardHeight - (cardPadding * 2);
      
      // Obtener aspect ratio real de la imagen
      const imageAspectRatio = brandLogoData.width / brandLogoData.height;
      
      // Calcular dimensiones manteniendo el aspect ratio
      let logoWidth = maxLogoWidth;
      let logoHeight = logoWidth / imageAspectRatio;
      
      // Si la altura excede el máximo, ajustar por altura
      if (logoHeight > maxLogoHeight) {
        logoHeight = maxLogoHeight;
        logoWidth = logoHeight * imageAspectRatio;
      }
      
      // Centrar el logo dentro del card
      const logoX = cardX + (cardWidth - logoWidth) / 2;
      const logoY = cardY + (cardHeight - logoHeight) / 2;
      
      doc.addImage(
        brandLogoData.data, 
        'PNG',
        logoX, 
        logoY, 
        logoWidth, 
        logoHeight,
        undefined,
        'SLOW'
      );
    } catch (error) {
      console.error('Error adding brand logo:', error);
      // Fallback: card blanco con nombre de marca
      const cardWidth = 50;
      const cardHeight = 20;
      const cardX = pageWidth - margin - cardWidth;
      const cardY = yPos - 1;
      
      doc.setFillColor(...white);
      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(...darkBlue);
      doc.setFont('helvetica', 'bold');
      doc.text(estimate.input.brand, cardX + cardWidth / 2, cardY + cardHeight / 2 + 2, { align: 'center' });
    }
  }

  yPos = 37;

  // Título y vehículo en layout horizontal compacto
  doc.setFontSize(11);
  doc.setTextColor(...lightGray);
  doc.setFont('helvetica', 'normal');
  doc.text('ESTIMADO DE IMPORTACIÓN', margin, yPos);
  
  doc.setFontSize(20);
  doc.setTextColor(...darkBlue);
  doc.setFont('helvetica', 'bold');
  const vehicleInfo = `${estimate.input.brand} ${estimate.input.model} ${estimate.input.year}`;
  doc.text(vehicleInfo, margin, yPos + 8);
  
  yPos += 15;

  // Badges compactos - inline
  const badges = [
    estimate.vehicleCategory.label,
    estimate.planConfig.label,
    `ISC ${formatPercentage(estimate.iscRate)}`,
  ];

  const badgeWidth = 38;
  const badgeSpacing = 4;
  const badgeHeight = 8;
  let badgeX = margin;

  badges.forEach((badge) => {
    doc.setFillColor(...veryLightGray);
    doc.setDrawColor(...mediumGray);
    doc.setLineWidth(0.2);
    doc.roundedRect(badgeX, yPos - 4, badgeWidth, badgeHeight, 2, 2, 'FD');
    
    doc.setFontSize(8);
    doc.setTextColor(...mediumGray);
    doc.setFont('helvetica', 'bold');
    doc.text(badge, badgeX + badgeWidth / 2, yPos + 1, { align: 'center' });
    badgeX += badgeWidth + badgeSpacing;
  });

  yPos += 10;

  // Precio final - diseño premium compacto
  const priceBoxHeight = 24;
  
  // Gradiente sutil con borde
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, yPos, contentWidth, priceBoxHeight, 3, 3, 'F');
  
  doc.setDrawColor(...accentBlue);
  doc.setLineWidth(1);
  doc.roundedRect(margin, yPos, contentWidth, priceBoxHeight, 3, 3, 'S');
  
  // Layout horizontal: label | precio
  doc.setFontSize(10);
  doc.setTextColor(...lightGray);
  doc.setFont('helvetica', 'bold');
  doc.text('PRECIO FINAL ESTIMADO', margin + 5, yPos + 8);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Lima, Perú', margin + 5, yPos + 14);
  
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkBlue);
  doc.text(formatCurrency(estimate.finalEstimate), pageWidth - margin - 5, yPos + 16, { align: 'right' });
  
  yPos += priceBoxHeight + 8;

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
    theme: 'plain',
    headStyles: {
      fillColor: darkBlue,
      textColor: white,
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: 4,
      halign: 'left',
    },
    bodyStyles: {
      textColor: mediumGray,
      fontSize: 9,
      cellPadding: 3.5,
    },
    alternateRowStyles: {
      fillColor: [252, 252, 253],
    },
    styles: {
      cellPadding: 3.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left', fontStyle: 'normal' },
      1: { cellWidth: 55, halign: 'right', fontStyle: 'bold', textColor: darkBlue },
    },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 6;

  // Timeline y nota en una línea compacta
  doc.setFontSize(8);
  doc.setTextColor(...accentBlue);
  doc.setFont('helvetica', 'bold');
  doc.text(`Timeline estimado: ${estimate.planConfig.timelineLabel}`, margin, yPos);
  
  yPos += 5;

  // Nota legal compacta
  doc.setFontSize(7);
  doc.setTextColor(...lightGray);
  doc.setFont('helvetica', 'italic');
  const noteText = 'Estimado sujeto a variaciones según partida arancelaria, condición del vehículo y determinación de SUNAT.';
  const splitNote = doc.splitTextToSize(noteText, contentWidth);
  doc.text(splitNote, margin, yPos);
  yPos += splitNote.length * 3 + 5;

  // Footer minimalista - barra inferior
  const footerY = pageHeight - 20;
  
  // Barra oscura inferior
  doc.setFillColor(...darkBlue);
  doc.rect(0, footerY, pageWidth, 20, 'F');
  
  // Información de contacto en una línea
  doc.setFontSize(7);
  doc.setTextColor(...lightGray);
  doc.setFont('helvetica', 'normal');
  
  const contactY = footerY + 7;
  
  // Izquierda: Empresa
  doc.setFont('helvetica', 'bold');
  doc.text('LUXCARS PERU', margin, contactY);
  
  // Centro: Contacto
  doc.setFont('helvetica', 'normal');
  doc.text(`Email: ${LUXCARS_CONFIG.contact.email}`, pageWidth / 2 - 30, contactY);
  doc.text(`Tel: ${LUXCARS_CONFIG.contact.phone}`, pageWidth / 2 - 30, contactY + 4);
  
  // Derecha: Fecha
  const date = new Date().toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  doc.text(`Generado: ${date}`, pageWidth - margin, contactY, { align: 'right' });
  doc.text('Lima, Peru', pageWidth - margin, contactY + 4, { align: 'right' });

  // Guardar
  const cleanBrand = estimate.input.brand.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanModel = estimate.input.model.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `LuxCars_Estimado_${cleanBrand}_${cleanModel}_${estimate.input.year}.pdf`;
  doc.save(fileName);
}
