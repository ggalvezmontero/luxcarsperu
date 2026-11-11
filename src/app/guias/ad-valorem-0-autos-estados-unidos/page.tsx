import {
  Aviso,
  Enlace,
  Fuerte,
  GuiaLayout,
  H2,
  IrACalculadora,
  Lista,
  P,
  Preguntas,
  Tabla,
  metadataDeGuia,
} from "@/components/guias/GuiaLayout";
import { VIN_ASSEMBLY_COUNTRY, resolveOrigin } from "@/core/pricing/originInference";
import { PRICING_CONFIG, currentYearInLima } from "@/core/pricing/pricingConfig";
import { rutaGuia } from "@/lib/guias";
import { cotizarEscenario, ejemplosCotizados } from "@/lib/guiasDatos";
import { formatCurrency, formatRate } from "@/lib/utils";

const SLUG = "ad-valorem-0-autos-estados-unidos";

export const revalidate = 86400;
export const generateMetadata = () => metadataDeGuia(SLUG);

/**
 * Modelos que más se consultan. Lo que se muestra de cada uno (país, planta y
 * tasa que se cotiza) NO se escribe aquí: lo responde el motor de origen
 * (`resolveOrigin`), el mismo que usa la calculadora.
 */
const MODELOS: readonly [string, string][] = [
  ["Toyota", "Tundra"],
  ["Toyota", "Sequoia"],
  ["Toyota", "Highlander"],
  ["Toyota", "Tacoma"],
  ["Toyota", "4Runner"],
  ["Ford", "F-150"],
  ["Ford", "Bronco"],
  ["Ford", "Mustang"],
  ["Ford", "F-250 Super Duty"],
  ["RAM", "1500"],
  ["RAM", "3500"],
  ["Jeep", "Wrangler"],
  ["Jeep", "Grand Cherokee"],
  ["Chevrolet", "Corvette"],
  ["Chevrolet", "Tahoe"],
  ["Chevrolet", "Silverado 1500"],
  ["Cadillac", "Escalade"],
  ["Tesla", "Model Y"],
  ["Tesla", "Cybertruck"],
  ["BMW", "X5"],
  ["Mercedes-Benz", "GLE"],
  ["Lexus", "RX"],
];

export default async function Page() {
  const anio = currentYearInLima();
  const general = formatRate(PRICING_CONFIG.adValoremByOrigin.otro);

  const filas = MODELOS.flatMap(([marca, modelo]) => {
    const o = resolveOrigin(marca, modelo);
    if (!o.matched) return [];
    // Sin las notas internas entre paréntesis ("(verificar VIN)", "(DT)").
    const pais = o.assemblyCountry.replace(/\s*\([^)]*\)/g, "");
    const cotizamos =
      o.adValoremRate === 0
        ? "0% con certificado de origen"
        : o.mayQualifyWithCertificate || o.requiresVin
          ? `${general}; puede bajar a 0% según el VIN y el certificado`
          : `${general}`;
    return [[`${marca} ${modelo}`, pais, cotizamos]];
  });

  // Cuánto dinero es la diferencia, con un ejemplo real de la lista del dueño.
  const ejemplos = await ejemplosCotizados(anio);
  const base = ejemplos.find(({ e }) => e.adValoremRate === 0) ?? ejemplos[0];
  const datos = base
    ? {
        brand: base.v.calculator.brand,
        model: base.v.calculator.model,
        priceUsd: base.e.input.priceMiami,
        vehicleType: base.v.calculator.vehicleType,
        condition: "nuevo" as const,
        anio,
      }
    : null;
  const conCero = datos ? cotizarEscenario({ ...datos, origin: "originario-usa" }) : null;
  const conSeis = datos ? cotizarEscenario({ ...datos, origin: "otro" }) : null;

  const paisesVin = Object.entries(VIN_ASSEMBLY_COUNTRY)
    .filter(([, pais]) => ["Estados Unidos", "Canadá", "México", "Japón", "Alemania"].includes(pais))
    .reduce<Record<string, string[]>>((acc, [caracter, pais]) => {
      (acc[pais] ??= []).push(caracter);
      return acc;
    }, {});

  return (
    <GuiaLayout
      slug={SLUG}
      respuesta={
        <>
          <p>
            Un auto entra a Perú con <Fuerte>0% de ad valorem</Fuerte> solo si cumple tres condiciones a la vez: es nuevo, es originario de Estados Unidos y llega con certificado de origen. Si falla una, paga {general}.
          </p>
          <p>
            Comprarlo en Miami no basta. Lo que decide es <Fuerte>dónde se ensambló</Fuerte>, no dónde se vende ni de qué marca es.
          </p>
        </>
      }
    >
      <H2>Las tres condiciones del 0%</H2>
      <P>
        El arancel de 0% viene del acuerdo comercial entre Perú y Estados Unidos. Para un vehículo exige:
      </P>
      <Lista
        items={[
          <><Fuerte>Que sea nuevo.</Fuerte> Los usados pagan {general} siempre, aunque se hayan fabricado en Estados Unidos y tengan certificado.</>,
          <><Fuerte>Que sea originario de Estados Unidos.</Fuerte> No alcanza con que se venda allá: debe ensamblarse en Estados Unidos y cumplir la regla de contenido regional del acuerdo, de al menos 35%.</>,
          <><Fuerte>Que llegue con certificado de origen.</Fuerte> Lo emite el exportador o vendedor en Estados Unidos, y la preferencia se declara en aduana con el código TPI 802.</>,
        ]}
      />
      <Aviso titulo="Ante la duda, se cotiza 6%">
        Prometer 0% y que el cliente pague {general} al nacionalizar es el error caro. Por eso, cuando un modelo se fabrica en más de un país, cotizamos {general} hasta ver el VIN de la unidad. Si después califica, es una buena noticia.
      </Aviso>

      <H2>Por qué comprar en Miami no basta</H2>
      <P>
        Un Toyota fabricado en Japón, un BMW alemán o una pickup ensamblada en México pagan {general} aunque se compren en un concesionario de Florida. La marca tampoco decide: dentro de la misma marca hay modelos que califican y modelos que no.
      </P>
      <P>
        El caso más claro es Toyota. La Tundra se ensambla en Texas y es candidata a 0%. La Tacoma se ensambla en México y paga {general}. Dos pickups de la misma marca, en el mismo concesionario, con aranceles distintos.
      </P>

      <H2>Qué modelos califican al 0%, según su planta</H2>
      <P>
        Esto es lo que cotizamos hoy para los modelos más pedidos. La última palabra la tienen el VIN de la unidad y el certificado de origen.
      </P>
      <Tabla
        columnas={["Modelo", "Se ensambla en", "Ad valorem que cotizamos"]}
        filas={filas}
        nota="Según el motor de origen de la calculadora. Varios modelos cambian de planta de un año a otro: se confirma con el VIN antes de comprar."
      />

      {conCero && conSeis && base ? (
        <>
          <H2>Cuánto dinero es la diferencia</H2>
          <P>
            El ad valorem no se queda en su {general}: como los demás tributos se calculan encima, el efecto se multiplica. Para {base.v.name}, con un precio de compra de {formatCurrency(base.e.input.priceMiami)}:
          </P>
          <Tabla
            columnas={["Escenario", "Ad valorem", "Puesto en Lima"]}
            filas={[
              ["Con certificado de origen (0%)", formatCurrency(conCero.adValorem), formatCurrency(conCero.finalEstimate)],
              [`Sin certificado (${general})`, formatCurrency(conSeis.adValorem), formatCurrency(conSeis.finalEstimate)],
            ]}
            nota={`Diferencia en el costo final: ${formatCurrency(conSeis.finalEstimate - conCero.finalEstimate)}.`}
          />
        </>
      ) : null}

      <H2>Cómo saber dónde se fabricó un auto: el VIN</H2>
      <P>
        El primer carácter del VIN indica el país de ensamblaje. Es la forma más rápida de descartar una unidad antes de pagarla.
      </P>
      <Tabla
        columnas={["El VIN empieza con", "País de ensamblaje"]}
        filas={Object.entries(paisesVin).map(([pais, caracteres]) => [caracteres.join(", "), pais])}
        nota="El VIN indica dónde se ensambló. El origen para el acuerdo lo acredita el certificado, no el VIN."
      />
      <P>
        Un mismo modelo puede salir de dos plantas. Hay pickups de la misma línea ensambladas en Estados Unidos, en México y en Canadá: solo las primeras pueden calificar. Por eso pedimos el VIN de la unidad concreta, no el del modelo.
      </P>

      <H2>Preguntas frecuentes sobre el ad valorem</H2>
      <Preguntas
        items={[
          {
            pregunta: "¿Quién emite el certificado de origen?",
            respuesta:
              "El exportador o vendedor en Estados Unidos. Sin ese documento no se puede pedir el 0%, aunque el vehículo se haya fabricado allá. Conviene confirmarlo con el vendedor antes de cerrar la compra.",
          },
          {
            pregunta: "¿Un auto usado de Estados Unidos paga arancel?",
            respuesta: `Sí, ${general}. El acuerdo solo exonera vehículos nuevos. Además, un usado paga 40% de ISC.`,
          },
          {
            pregunta: "¿El ad valorem es lo mismo que el IGV?",
            respuesta:
              "No. El ad valorem es el arancel de aduana y se calcula sobre el valor CIF. El IGV se calcula después, sobre el CIF más el ad valorem y el ISC.",
          },
          {
            pregunta: "¿Los autos eléctricos pagan ad valorem?",
            respuesta: `Depende de dónde se ensamblaron, igual que cualquier otro. Un eléctrico nuevo fabricado en Estados Unidos puede entrar con 0%; uno fabricado en China o Alemania paga ${general}. Lo que sí tienen todos los eléctricos nuevos es ISC de 0%.`,
          },
        ]}
      />
      <P>
        El ad valorem es solo el primer tributo. Los demás están en las guías del <Enlace href={rutaGuia("isc-vehiculos-peru")}>ISC de vehículos</Enlace> y de <Enlace href={rutaGuia("cuanto-cuesta-importar-un-auto-a-peru")}>cuánto cuesta importar un auto</Enlace>.
      </P>
      <IrACalculadora texto="Calcular con mi modelo" />
    </GuiaLayout>
  );
}
