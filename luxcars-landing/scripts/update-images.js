const https = require('https');
const fs = require('fs');
const path = require('path');

// Imágenes apropiadas de Unsplash con IDs verificados
const IMAGES = {
  // HowItWorks Section - Proceso paso a paso
  'how/search.jpg': {
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
    description: 'Person searching cars on laptop - búsqueda inteligente'
  },
  'how/inspection.jpg': {
    url: 'https://images.unsplash.com/photo-1632823469820-1b7d38c0b2c9?w=800&h=600&fit=crop',
    description: 'Mechanic inspecting luxury car - inspección certificada'
  },
  'how/purchase.jpg': {
    url: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=600&fit=crop',
    description: 'Professional handshake/negotiation - negociación y compra'
  },
  'how/shipping.jpg': {
    url: 'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=800&h=600&fit=crop',
    description: 'Shipping container port - envío asegurado'
  },
  'how/customs.jpg': {
    url: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=600&fit=crop',
    description: 'Documents and paperwork - aduanas y SUNAT'
  },
  'how/delivery.jpg': {
    url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop',
    description: 'Luxury car delivery - entrega VIP'
  },
  
  // WhyUs Section - Diferenciadores
  'whyus/transparency.jpg': {
    url: 'https://images.unsplash.com/photo-1554224311-beee415c201f?w=800&h=600&fit=crop',
    description: 'Clear documents and transparency - transparencia total'
  },
  'whyus/exotics.jpg': {
    url: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&h=600&fit=crop',
    description: 'Exotic luxury cars - ticket premium'
  },
  'whyus/concierge.jpg': {
    url: 'https://images.unsplash.com/photo-1556745753-b2904692b3cd?w=800&h=600&fit=crop',
    description: 'Professional concierge service - servicio concierge'
  },
  'whyus/advisory.jpg': {
    url: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&h=600&fit=crop',
    description: 'Professional advisory meeting - asesoría personalizada'
  }
};

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✓ Downloaded: ${filepath}`);
          resolve();
        });
      } else {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function main() {
  const publicDir = path.join(__dirname, '..', 'public', 'images');
  
  console.log('📥 Downloading professional images from Unsplash...\n');
  
  for (const [filepath, data] of Object.entries(IMAGES)) {
    const fullPath = path.join(publicDir, filepath);
    console.log(`Downloading: ${data.description}`);
    try {
      await downloadImage(data.url, fullPath);
    } catch (error) {
      console.error(`✗ Error downloading ${filepath}:`, error.message);
    }
  }
  
  console.log('\n✅ Image update complete!');
}

main().catch(console.error);

