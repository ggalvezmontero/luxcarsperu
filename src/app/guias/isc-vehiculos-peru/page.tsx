import {
  Aviso,
  Enlace,
  Fuerte,
  GuiaLayout,
  H2,
  IrACalculadora,
  P,
  Preguntas,
  Tabla,
  metadataDeGuia,
} from "@/components/guias/GuiaLayout";
import { PRICING_CONFIG } from "@/core/pricing/pricingConfig";
import {
  USED_ISC_RATE,
  VEHICLE_CATEGORIES,
  gasolineNewIscRate,
} from "@/core/pricing/vehicleCategories";
import { rutaGuia } from "@/lib/guias";
import { cotizarEscenario } from "@/lib/guiasDatos";
import { formatCurrency, formatRate } from "@/lib/utils";

const SLUG = "isc-vehiculos-peru";

export const revalidate = 86400;
export const generateMetadata = () => metadataDeGuia(SLUG);

/** Precio de compra del ejemplo comparativo. */
const PRECIO_EJEMPLO = 60000;

export default function Page() {
  const anio = new Date().getFullYear();
  const usado = formatRate(USED_ISC_RATE);
  const { igvRate, ipmRate } = PRICING_CONFIG;
  const diesel = VEHICLE_CATEGORIES.find((c) => c.id === "diesel");
  const iscDiesel = formatRate(diesel?.newIscRate ?? 0);
  const tramos = [
    { hasta: "Hasta 1,400 cc", tasa: gasolineNewIscRate(1400) },
    { hasta: "De 1,401 a 1,500 cc", tasa: gasolineNewIscRate(1500) },
    { hasta: "Más de 1,500 cc", tasa: gasolineNewIscRate(2000) },
  ];

  // Mismo vehículo y mismo precio; solo cambia el motor o la condición.
  const comun = { brand: "Toyota", model: "Tundra", priceUsd: PRECIO_EJEMPLO, anio, origin: "originario-usa" as const };
  const escenarios = [
    { nombre: "Gasolina, nuevo", e: cotizarEscenario({ ...comun, vehicleType: "gasolina", condition: "nuevo" }) },
    { nombre: "Híbrido, nuevo", e: cotizarEscenario({ ...comun, vehicleType: "hev", condition: "nuevo" }) },
    { nombre: "Eléctrico, nuevo", e: cotizarEscenario({ ...comun, vehicleType: "ev", condition: "nuevo" }) },
    { nombre: "Diésel, nuevo", e: cotizarEscenario({ ...comun, vehicleType: "diesel", condition: "nuevo" }) },
    { nombre: "Gasolina, usado", e: cotizarEscenario({ ...comun, vehicleType: "gasolina", condition: "usado" }) },
  ].flatMap((x) => (x.e ? [{ nombre: x.nombre, e: x.e }] : []));

  return (
    <GuiaLayout
      slug={SLUG}
      respuesta={
        <>
          <p>
            El ISC de un vehículo importado va de <Fuerte>0% a {usado}</Fuerte>. Un híbrido o eléctrico nuevo paga 0%. Un gasolinero nuevo paga entre {formatRate(tramos[0].tasa)} y {formatRate(tramos[2].tasa)} según la cilindrada. Un diésel nuevo paga {iscDiesel}. Y todo vehículo usado paga {usado}, sea cual sea el motor.
          </p>
          <p>
            Se calcula sobre el valor CIF más el ad valorem, y sobre el resultado se aplican después el IGV y el IPM.
          </p>
        </>
      }
    >
      <H2>Tabla del ISC de vehículos en {anio}</H2>
      <Tabla
        columnas={["Tipo de motor", "ISC si es nuevo", "ISC si es usado"]}
        filas={VEHICLE_CATEGORIES.map((c) => [
          c.label,
          c.newIscRate !== null
            ? formatRate(c.newIscRate)
            : `${formatRate(tramos[0].tasa)} a ${formatRate(tramos[2].tasa)}, según cilindrada`,
          c.usedImportAllowed ? usado : "No se puede importar",
        ])}
        nota="Tasas vigentes. Son las que aplica la calculadora del sitio."
      />

      <H2>Gasolina: el ISC depende de la cilindrada</H2>
      <P>
        En un vehículo nuevo a gasolina el ISC no es plano. Tiene tres tramos:
      </P>
      <Tabla
        columnas={["Cilindrada", "ISC"]}
        filas={tramos.map((t) => [t.hasta, formatRate(t.tasa)])}
      />
      <P>
        Casi todas las pickups, SUV grandes y deportivos que se importan de Estados Unidos superan los 1,500 cc, así que pagan {formatRate(tramos[2].tasa)}.
      </P>

      <H2>Híbridos y eléctricos nuevos: 0%</H2>
      <P>
        Los híbridos, los híbridos enchufables y los eléctricos <Fuerte>nuevos</Fuerte> no pagan ISC. Es la razón por la que una pickup híbrida puede terminar costando menos, puesta en Lima, que la misma pickup a gasolina.
      </P>
      <Aviso titulo="Un híbrido suave de 48 V no cuenta">
        El 0% es para los híbridos completos. Un sistema de 48 V que solo asiste al motor tributa como gasolina. Hay modelos que se venden en las dos configuraciones, así que confirmamos la versión exacta con el VIN antes de comprar.
      </Aviso>

      <H2>Usados: {usado}, sin importar el motor</H2>
      <P>
        Todo vehículo usado de la partida 87.03 paga {usado} de ISC, sea gasolina, híbrido o eléctrico. La tasa rige desde junio de 2019, por el D.S. 181-2019-EF.
      </P>
      <P>
        Todavía circula un 10% para usados. Es la tasa anterior, derogada en 2019: sigue apareciendo en versiones antiguas de la norma.
      </P>
      <P>
        El diésel es el caso aparte: nuevo paga {iscDiesel}, y usado no paga nada porque <Fuerte>no se puede importar</Fuerte>. Los demás límites para usados están en la guía de <Enlace href={rutaGuia("requisitos-para-importar-un-auto-a-peru")}>requisitos para importar</Enlace>.
      </P>

      <H2>Sobre qué se calcula el ISC</H2>
      <P>
        Sobre el valor CIF (precio más flete más seguro) más el ad valorem. Y no termina ahí: el IGV de {formatRate(igvRate)} y el IPM de {formatRate(ipmRate)} se calculan después sobre una base que ya incluye el ISC. Cada punto de ISC cuesta, en la práctica, algo más que un punto.
      </P>

      {escenarios.length > 1 ? (
        <>
          <H2>Ejemplo: el mismo vehículo con distinto motor</H2>
          <P>
            Un vehículo de {formatCurrency(PRECIO_EJEMPLO)} en Estados Unidos, con 0% de ad valorem en los casos nuevos. Solo cambia el motor o la condición.
          </P>
          <Tabla
            columnas={["Escenario", "Tasa de ISC", "ISC", "Puesto en Lima"]}
            filas={escenarios.map(({ nombre, e }) => [
              nombre,
              formatRate(e.iscRate),
              formatCurrency(e.isc),
              <Fuerte key="t">{formatCurrency(e.finalEstimate)}</Fuerte>,
            ])}
            nota="El usado paga además 6% de ad valorem: el acuerdo con Estados Unidos solo exonera vehículos nuevos."
          />
        </>
      ) : null}

      <H2>Preguntas frecuentes sobre el ISC</H2>
      <Preguntas
        items={[
          {
            pregunta: "¿Cuál es la diferencia entre el IGV y el ISC?",
            respuesta: `El ISC es un impuesto selectivo: su tasa depende del tipo de vehículo. El IGV es general: ${formatRate(igvRate + ipmRate)} con el IPM incluido, igual para todos. Al importar se pagan los dos, primero el ISC y luego el IGV sobre una base que ya lo incluye.`,
          },
          {
            pregunta: "¿El ISC es lo mismo que el impuesto vehicular?",
            respuesta:
              "No. El ISC se paga una sola vez, al nacionalizar el vehículo. El impuesto vehicular es otro tributo: se paga cada año a la municipalidad, después de inscribir el vehículo.",
          },
          {
            pregunta: "¿Un auto eléctrico usado paga ISC?",
            respuesta: `Sí, ${usado}. El 0% es solo para los eléctricos e híbridos nuevos.`,
          },
          {
            pregunta: "¿Quién paga el ISC al importar un auto?",
            respuesta:
              "El importador, al momento de la nacionalización ante SUNAT, junto con el ad valorem, el IGV y el IPM. En una importación a pedido ya viene incluido en el costo final.",
          },
        ]}
      />
      <P>
        Para ver el ISC de un modelo concreto, con su ad valorem y el costo final, usa la calculadora o revisa <Enlace href={rutaGuia("cuanto-cuesta-importar-un-auto-a-peru")}>cuánto cuesta importar un auto</Enlace>.
      </P>
      <IrACalculadora texto="Calcular el ISC de mi auto" />
    </GuiaLayout>
  );
}
