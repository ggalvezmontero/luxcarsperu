## LuxCars Perú · Landing Premium

Landing page corporativa desarrollada con Next.js 16 (App Router), TypeScript y Tailwind CSS v4. El diseño refuerza el posicionamiento de LuxCars Perú como broker boutique de importación de autos de lujo y exóticos entre Miami y Lima.

### 🚀 Inicio rápido

```bash
npm install
npm run dev
# abrir http://localhost:3000
```

### 🧱 Arquitectura principal

- `src/app/page.tsx`: composición de todas las secciones de la landing.
- `src/components/*`: componentes modulares reutilizables (hero, calculadora, timeline, FAQs, etc.).
- `src/lib/config.ts`: configuración central (tasas, contactos, textos corporativos).
- `src/lib/calculator.ts`: lógica para estimar flete, impuestos SUNAT, honorarios y ahorro.
- `src/lib/whatsapp.ts`: generación dinámica del mensaje y enlace a WhatsApp.

### ⚙️ Cómo actualizar tasas, impuestos y honorarios

Edita `src/lib/config.ts`:

- `services.shippingInsuranceBase`: monto base del flete + seguro.
- `services.shippingInsuranceRate`: % aplicado sobre el precio Miami.
- `services.adValoremRate`, `services.igvRate`, `services.adminFeeRate`, `services.brokerFeeRate`.
- `services.finalRangeVariance`: variación para calcular el rango estimado.
- `services.localMarketMarkup`: factor usado para estimar el precio equivalente en Perú.
- `iscByBrand`: tasas ISC estimadas por marca/categoría (puedes ajustar o añadir nuevas marcas).
- `deliveryWindows`: días estimados para Fast Track y Estándar.
- `timeline`, `brandShowcase`, `sourcingPlatforms`, `differentiators`, `faq`: contenidos de cada sección.

> Cualquier ajuste se refleja automáticamente en la calculadora y en las secciones informativas.

### ☎️ Cómo cambiar el número de WhatsApp o email

En el mismo archivo `src/lib/config.ts`:

- `contact.whatsappNumber`: ingresa el número en formato internacional sin `+` (ej. `51912345678`).
- `contact.email`: correo del concierge.

La calculadora y el formulario reutilizan estos datos para generar el enlace directo a WhatsApp y los CTA del sitio.

### 🧮 Funcionamiento de la calculadora

1. Solicita marca, modelo, año, precio Miami y plan de entrega.
2. Calcula automáticamente flete + seguro, Ad Valorem, ISC, IGV, honorarios administrativos y broker.
3. Muestra rango estimado, ahorro vs. precio de mercado en Perú y desglose completo.
4. Guarda el resultado en `localStorage` y lo comparte con la sección de formulario.
5. Permite abrir WhatsApp con todos los datos precargados para contacto inmediato.

### 🎨 Paleta y estilo

- Colores: negro profundo, grafito, dorados metálicos (`#f5d072`, `#d4af37`) y acentos plata.
- Tipografía: Geist Sans (Next.js font) para un look minimalista premium.
- Componentes con bordes redondeados, gradientes suaves y destellos dorados para transmitir lujo.

### 📸 Prompts para branding e imágenes

Utiliza estos prompts en Midjourney, DALL·E, Leonardo u otra IA visual. Ajusta formato o idioma según la plataforma.

#### Logo principal · LuxCars Perú
```
luxury automotive broker logo, text "LuxCars Perú", metallic gold and graphite palette, minimalist sans serif typography, subtle shield silhouette, negative space, premium feel, dark background, vector style
```

#### Logo alterno · LXCARS
```
sleek monogram logo "LXCARS", futuristic sans serif lettering, metallic gold gradients, Miami to Lima concept, luxury automotive identity, minimalist emblem on black background
```

#### Favicon
```
luxury car broker favicon, letters "LX", metallic gold on deep black, simple geometric mark, high contrast, 1:1 ratio, flat vector icon
```

#### Banners hero con autos de lujo
```
luxury exotic car in a dark premium setting, Porsche Cayenne Lamborghini Urus Ferrari 488, cinematic lighting, glossy reflections, 16:9 ratio, black and gold theme, miami skyline hints, ultra realistic
```

#### Mockups para redes sociales
```
instagram carousel mockup for luxury car import broker, black and gold branding, high-end typography, showcases concierge service miami to lima, premium layout, includes calculator screenshot, clean grid design
```

### 🧪 QA sugerido

- `npm run lint` para validar reglas de ESLint + Tailwind.
- Probar la calculadora con diferentes marcas y montos (≥ USD 50K).
- Confirmar apertura de WhatsApp y datos precargados tras usar el formulario.
- Revisar responsividad en breakpoints móviles, tablets y desktop (≥ 1440 px).

### 📦 Deploy

Puedes desplegar en Vercel (recomendado) o cualquier plataforma compatible con Next.js 16.

```bash
npm run build
npm run start
```

---

Hecho con precisión para **LuxCars.pe · Broker boutique Miami → Lima**. Ajusta libremente el contenido corporativo desde `src/lib/config.ts`. ¡Disfruta la experiencia premium!
