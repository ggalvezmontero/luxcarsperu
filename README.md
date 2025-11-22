## LuxCars.pe · Landing Premium

Landing page corporativa desarrollada con Next.js 16 (App Router), TypeScript y Tailwind CSS v4. El diseño refuerza el posicionamiento de LuxCars.pe como broker boutique de importación de autos de lujo y exóticos entre Miami y Lima.

### 🚀 Inicio rápido

```bash
npm install
npm run dev
# abrir http://localhost:3000
```

### 🧱 Arquitectura principal

- `src/app/page.tsx`: composición de todas las secciones de la landing.
- `src/components/*`: componentes modulares reutilizables (hero, calculadora, timeline, FAQs, etc.).
- `src/lib/config.ts`: configuración central (contactos, contenidos corporativos, timelines).
- `src/core/pricing/*`: motor modular de la calculadora.
  - `pricingConfig.ts`: ajustes globales (fletes base, tasas de seguro, IGV, State Compliance 5%, Broker 10%, planes).
  - `vehicleCategories.ts`: tabla de categorías ISC (Gasolina, Híbrido HEV, Diésel, Eléctrico EV, Híbrido enchufable PHEV).
  - `feeStrategies.ts`: utilidades para logística e impuestos.
  - `priceCalculator.ts`: orquestador que combina módulos y devuelve el estimado premium.
- `src/core/modules/*`: módulos desacoplados (broker, compliance, fast-track, insurance) para escalar futuros escenarios.
- `src/lib/whatsapp.ts`: generación dinámica del mensaje y enlace a WhatsApp.

### ⚙️ Cómo actualizar tasas, impuestos y honorarios

Edita `src/lib/config.ts` para:

- `services.minimumVehiclePrice`: ticket mínimo permitido.
- `services.finalRangeVariance`: variación para calcular el rango estimado (±2.5% por defecto).
- `vehicleTypes`: tabla de tipos de vehículo con sus porcentajes de ISC y tooltips.
- `deliveryWindows`: días estimados para Fast Track y Estándar.
- `timeline`, `brandShowcase`, `sourcingPlatforms`, `differentiators`, `faq`: contenidos de cada sección.

Edita `src/core/pricing/pricingConfig.ts` para actualizar tarifas específicas:

- `freightByCategory`: flete estimado por categoría (Gasolina, Híbrido HEV, Diésel, EV, PHEV).
- `insuranceRate`: porcentaje del seguro marítimo (1.5%).
- `adValoremRate`, `igvRate`, `stateComplianceRate` (5%), `brokerFeeRate` (10%).

> Cualquier ajuste se refleja automáticamente en la calculadora y en las secciones informativas.

### ☎️ Cómo cambiar el número de WhatsApp o email

En el mismo archivo `src/lib/config.ts`:

- `contact.whatsappNumber`: ingresa el número en formato internacional sin `+` (ej. `51912345678`).
- `contact.email`: correo del concierge.

La calculadora y el formulario reutilizan estos datos para generar el enlace directo a WhatsApp y los CTA del sitio.

### 🧮 Funcionamiento de la calculadora

1. Solicita tipo de vehículo (con ISC asociado), marca, modelo, año, precio Miami y plan de entrega.
2. Calcula automáticamente flete (según categoría), seguro (1.5%), CIF, Ad Valorem 6%, ISC con la nueva tabla oficial, IGV, State Compliance Fee (5%), Broker Fee (10%) y Fast Track (si aplica).
3. Muestra rango estimado (±2.5%) y desglose completo.
4. Guarda el resultado en `localStorage` y lo comparte con la sección de formulario concierge.
5. Permite abrir WhatsApp con todos los datos precargados —incluyendo categoría seleccionada e ISC aplicado— para contacto inmediato.

### 🎨 Paleta y estilo

- Colores: blanco cálido (#FCFCFC), negro carbón (#0F0F0F), grafito (#1C1C1C), humo (#D9D9D9), dorado satinado (#D7B977) y dorado resplandor (#F1D387).
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
