/**
 * Guía de fotografía de vehículos — contenido, no estilos.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE: el dueño tiene stock real y fotos malas. El
 * cuello de botella no es la tecnología de subida, es que nadie sabe cómo se
 * fotografía un auto para que se vea caro. Una foto correcta sube el precio
 * percibido más que cualquier funcionalidad del portal, así que la guía va
 * DENTRO de la pantalla de carga, no en un PDF que nadie abre.
 *
 * Está separada del componente para que se pueda reordenar, traducir o
 * imprimir sin tocar la interfaz, y para que el checklist de las 8 tomas sea
 * la MISMA lista que usa el contador de progreso del subidor.
 */

/** Una de las tomas mínimas de una ficha vendible. */
export type TomaMinima = {
  id: string;
  /** Nombre corto, el que se ve en el chip del checklist. */
  nombre: string;
  /** Qué se ve en la foto. */
  que: string;
  /** Cómo se para el fotógrafo. El detalle que casi nadie hace bien. */
  como: string;
};

/**
 * LAS 8 TOMAS MÍNIMAS. Debajo de 8 la ficha se ve incompleta y el comprador
 * asume que algo se está escondiendo. El orden es el de la galería: la 3/4
 * delantera es SIEMPRE la portada porque es la única toma que muestra frente y
 * costado a la vez, que es como el ojo reconoce un auto.
 */
export const TOMAS_MINIMAS: readonly TomaMinima[] = [
  {
    id: "tres-cuartos-delantero",
    nombre: "3/4 delantero",
    que: "Frente y costado del conductor en la misma foto. Es la portada.",
    como: "Párate en diagonal al faro delantero, a unos 3 metros. Gira las ruedas delanteras hacia ti: se ve el diseño de la llanta completo y el auto deja de parecer un ladrillo.",
  },
  {
    id: "tres-cuartos-trasero",
    nombre: "3/4 trasero",
    que: "Cola y costado opuesto. Cierra la vuelta al vehículo.",
    como: "El mismo ángulo en diagonal, pero desde la esquina trasera contraria. Que se lea el modelo en la tapa del maletero.",
  },
  {
    id: "perfil",
    nombre: "Perfil",
    que: "El costado completo, de parachoque a parachoque.",
    como: "Perpendicular al centro del auto, retrocede lo necesario para que entre entero con un poco de aire arriba y abajo. Sin recortar ruedas.",
  },
  {
    id: "frontal",
    nombre: "Frontal",
    que: "Frente recto: parrilla, faros, placa.",
    como: "Centrado y a la altura de los faros. Si te agachas de más el auto se ve deformado; si te paras de más, se ve pequeño.",
  },
  {
    id: "trasera",
    nombre: "Trasera",
    que: "Cola recta: luces, escapes, portón.",
    como: "Centrado, mismo criterio de altura que el frontal.",
  },
  {
    id: "interior-tablero",
    nombre: "Interior · tablero",
    que: "Tablero, timón y pantalla. Con el odómetro legible.",
    como: "Desde el asiento trasero, apoyado entre los dos asientos delanteros. Enciende el tablero y la pantalla: un tablero apagado parece un auto que no arranca.",
  },
  {
    id: "interior-asientos",
    nombre: "Interior · asientos",
    que: "Tapiz delantero y trasero, sin cosas encima.",
    como: "Abre la puerta trasera y dispara hacia adentro en diagonal. Saca papeles, cargadores, aromatizantes y el tapasol.",
  },
  {
    id: "motor",
    nombre: "Motor",
    que: "Compartimiento del motor con el capó abierto.",
    como: "De pie frente al auto, capó completamente abierto y sostenido. Motor limpio y seco, sin trapos ni herramientas a la vista.",
  },
];

/** Regla de encuadre o de luz. Va arriba del checklist: se lee en 20 segundos. */
export type ReglaFoto = {
  id: string;
  titulo: string;
  /** Qué hacer, en imperativo y sin adornos. */
  detalle: string;
  /** El error concreto que esta regla evita. */
  error: string;
};

/**
 * LAS CUATRO REGLAS QUE HACEN LA DIFERENCIA. Si el equipo solo recuerda una,
 * que sea la altura de cámara: es el error que más barato hace ver un auto y
 * el único que no se puede arreglar después.
 */
export const REGLAS_FOTO: readonly ReglaFoto[] = [
  {
    id: "altura",
    titulo: "Cámara a la mitad del auto",
    detalle:
      "Agáchate hasta que el celular quede a la altura de la línea de las manijas, más o menos a la mitad de la altura del vehículo. Sostén el celular vertical al piso, no inclinado.",
    error:
      "Fotografiar de pie, apuntando hacia abajo. Achata el auto, alarga el capó y lo hace ver como foto de aviso clasificado.",
  },
  {
    id: "luz",
    titulo: "Hora dorada o sombra pareja",
    detalle:
      "La primera hora después del amanecer o la última antes del atardecer. Si tiene que ser de día, busca sombra completa y uniforme: el techo de un estacionamiento o el lado sombreado de un edificio.",
    error:
      "Sol de mediodía. Quema el techo y el capó, entierra los bajos en sombra negra y llena la carrocería de reflejos duros. Tampoco uses flash: aplana la pintura y marca cada poro.",
  },
  {
    id: "fondo",
    titulo: "Fondo limpio y sin competencia",
    detalle:
      "Pared lisa, muro de concreto, vidrio o un espacio abierto. Que el auto sea lo único interesante del cuadro y quede centrado con aire parejo a los lados.",
    error:
      "Otros autos, tachos, cables, postes que salen del techo, gente reflejada en la puerta y el fotógrafo reflejado en la pintura. Da un paso al costado y el reflejo desaparece.",
  },
  {
    id: "distancia",
    titulo: "Aléjate y no uses gran angular",
    detalle:
      "Retrocede 3 o 4 metros y usa el lente normal (1x) o el teleobjetivo (2x / 3x) si el celular lo tiene. El auto entra igual y las proporciones quedan reales.",
    error:
      "Pegarse al auto con el ultra gran angular (0.5x). Curva las líneas, infla el parachoque más cercano y deforma el vehículo entero.",
  },
];

/** Preparación previa: se hace una vez y sirve para las 8 tomas. */
export const ANTES_DE_DISPARAR: readonly string[] = [
  "Lava el auto y sécalo. Una carrocería sucia no se arregla con ningún filtro.",
  "Llantas y neumáticos limpios y con brillo: es lo primero que mira un comprador de premium.",
  "Vacía el interior por completo y aspira. Sin tapasol, sin papeles, sin cargadores colgando.",
  "Guarda la basura, los conos y la manguera fuera del cuadro antes de la primera foto.",
  "Cierra puertas, maletero y tapa de combustible, y pliega los espejos solo si el auto se ve mejor así.",
  "Limpia el lente del celular con un paño. Es el paso más rápido y el que más fotos salva.",
];

/** Qué NO hacer. Cada una es una foto que hay que volver a tomar. */
export const ERRORES_COMUNES: readonly string[] = [
  "Fotos verticales para la galería: la ficha es horizontal. Gira el celular.",
  "Filtros, saturación al máximo o HDR agresivo: el color real vende, el color falso genera reclamos en la entrega.",
  "Editar la pintura para tapar un rayón. Se descubre en la visita y mata la venta entera.",
  "Fotos con lluvia o con el auto mojado: los reflejos tapan los detalles.",
  "Recortar una rueda o el techo. Si no entra, retrocede.",
];

/**
 * AVISO LEGAL Y COMERCIAL, y no es un detalle menor.
 *
 * Las únicas fotos que pueden entrar acá son las que toma el equipo o las del
 * fabricante con derecho de uso. Las fotos de inventario de MarketCheck,
 * Auto.dev, eBay, Autotrader, CarGurus, Cars.com, TrueCar, AutoTempest y
 * Facebook Marketplace están prohibidas por contrato (sus términos prohíben
 * almacenar, cachear o indexar su contenido; el incumplimiento implica
 * revocación de la llave). Y, aparte del contrato: publicar la foto de otro
 * auto como si fuera el tuyo es publicidad engañosa.
 *
 * El mismo texto vive en la migración `20260915090300_vehicle_photos.sql` y en
 * `src/lib/db/types.ts`. Está repetido a propósito: quien vaya a "optimizar"
 * esto en seis meses tiene que tropezarse con el aviso en los tres lugares.
 */
export const AVISO_ORIGEN_FOTOS =
  "Solo fotos propias del equipo o del fabricante con derecho de uso. Está prohibido por contrato subir imágenes tomadas de MarketCheck, Auto.dev, eBay, Autotrader, CarGurus, Cars.com, TrueCar, AutoTempest o Facebook Marketplace, y publicar la foto de otro auto como si fuera este es publicidad engañosa.";

/** Mínimo de fotos para que una ficha se considere presentable. */
export const MINIMO_FOTOS = TOMAS_MINIMAS.length;
