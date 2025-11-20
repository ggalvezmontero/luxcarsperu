/**
 * Script para descargar imágenes mejoradas desde Unsplash
 * Ejecutar con: node scripts/download-images.js
 * 
 * Imágenes seleccionadas específicamente para representar cada sección
 * Todas son gratuitas, de alta calidad y sin Bugatti
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// URLs específicas de Unsplash para cada imagen
// Seleccionadas para representar mejor cada concepto
const IMAGES_TO_DOWNLOAD = {
  // WhyUsSection - Imágenes más representativas
  'whyus/transparency.jpg': {
    url: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=85&fit=crop',
    description: 'Documentos y transparencia financiera'
  },
  'whyus/exotics.jpg': {
    url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=85&fit=crop',
    description: 'Autos exóticos premium (Porsche/Lamborghini)'
  },
  'whyus/advisory.jpg': {
    url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=85&fit=crop',
    description: 'Asesoría profesional y consultoría'
  },
  
  // HowItWorksSection - Proceso paso a paso
  'how/search.jpg': {
    url: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200&q=85&fit=crop',
    description: 'Búsqueda de vehículos en concesionarios'
  },
  'how/inspection.jpg': {
    url: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=85&fit=crop',
    description: 'Inspección técnica profesional'
  },
  'how/purchase.jpg': {
    url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=85&fit=crop',
    description: 'Negociación y compra de vehículo'
  },
  'how/shipping.jpg': {
    url: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1200&q=85&fit=crop',
    description: 'Contenedor marítimo y envío'
  },
  'how/customs.jpg': {
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=85&fit=crop',
    description: 'Aduanas y documentación'
  },
  'how/delivery.jpg': {
    url: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=85&fit=crop',
    description: 'Entrega final del vehículo'
  },
  
  // Otras secciones
  'calculator/dashboard.jpg': {
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=85&fit=crop',
    description: 'Dashboard y calculadora financiera'
  },
  'timeline/journey.jpg': {
    url: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1200&q=85&fit=crop',
    description: 'Proceso de importación marítima'
  },
  'contact/concierge.jpg': {
    url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=85&fit=crop',
    description: 'Servicio concierge profesional'
  },
  'faq/questions.jpg': {
    url: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=85&fit=crop',
    description: 'Consultas y preguntas frecuentes'
  },
};

function downloadImage(url, filePath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(filePath);
    
    // Crear directorio si no existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const file = fs.createWriteStream(filePath);
    
    const request = https.get(url, (response) => {
      // Seguir redirecciones
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadImage(response.headers.location, filePath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    
    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(err);
    });
    
    file.on('error', (err) => {
      file.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(err);
    });
  });
}

async function main() {
  const publicDir = path.join(__dirname, '..', 'public', 'images');
  
  console.log('📥 Descargando imágenes mejoradas desde Unsplash...\n');
  console.log('   Todas las imágenes son gratuitas y de alta calidad\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const [relativePath, config] of Object.entries(IMAGES_TO_DOWNLOAD)) {
    const filePath = path.join(publicDir, relativePath);
    try {
      await downloadImage(config.url, filePath);
      console.log(`✓ ${relativePath}`);
      console.log(`  └─ ${config.description}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Error: ${relativePath}`);
      console.error(`  └─ ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n✅ Completado: ${successCount} descargadas, ${errorCount} errores`);
  
  if (errorCount > 0) {
    console.log('\n💡 Si algunas imágenes fallaron, puedes descargarlas manualmente desde:');
    console.log('   - Unsplash: https://unsplash.com');
    console.log('   - Pexels: https://pexels.com');
  }
}

main().catch(console.error);
