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
import { PRICING_CONFIG, currentYearInLima } from "@/core/pricing/pricingConfig";
import { USED_ISC_RATE } from "@/core/pricing/vehicleCategories";
import { LUXCARS_CONFIG } from "@/lib/config";
import { rutaGuia } from "@/lib/guias";
import { cotizarEscenario, tributos } from "@/lib/guiasDatos";
import { formatCurrency, formatPercentage, formatRate } from "@/lib/utils";

const SLUG = "cuanto-cuesta-nacionalizar-un-auto-en-peru";

export const revalidate = 86400;
export const generateMetadata = () => metadataDeGuia(SLUG);

/** Precio de compra del ejemplo. Un gasolinero mediano, el caso más común. */
const PRECIO_EJEMPLO = 50000;

export default function Page() {
  const anio = currentYearInLima();
  const { igvRate, ipmRate, percepcionRates, adValoremByOrigin, customsCostsUsd } = PRICING_CONFIG;
  const general = formatRate(adValoremByOrigin.otro);
  const igvTotal = formatRate(igvRate + ipmRate);

  // El mismo vehículo en tres situaciones: nuevo originario de EE.UU., nuevo
  // de otra planta y usado. Solo cambian los tributos; la logística es igual.
  const comun = { brand: "Toyota", model: "4Runner", priceUsd: PRECIO_EJEMPLO, anio, vehicleType: "gasolina" as const };
  const nuevoUsa = cotizarEscenario({ ...comun, condition: "nuevo", origin: "originario-usa" });
  const nuevoOtro = cotizarEscenario({ ...comun, condition: "nuevo", origin: "otro" });
  const usado = cotizarEscenario({ ...comun, condition: "usado", origin: "otro" });
  const escenarios = [
    { nombre: "Nuevo, originario de EE.UU.", e: nuevoUsa },
    { nombre: "Nuevo, de otra planta", e: nuevoOtro },
    { nombre: "Usado", e: usado },
  ].flatMap((x) => (x.e ? [{ nombre: x.nombre, e: x.e }] : []));

  /** Lo que se paga en aduana para nacionalizar: tributos más costos de despacho. Sin flete, seguro ni servicio. */
  const costoNacionalizar = (e: NonNullable<typeof nuevoUsa>) => tributos(e) + e.customsFee;

  return (
    <GuiaLayout
      slug={SLUG}
      respuesta={
        <>
          <p>
            Nacionalizar un auto en Perú es pagar en SUNAT los tributos de importación sobre su valor CIF: <Fuerte>ad valorem (0% o {general}), ISC (0% a {formatRate(USED_ISC_RATE)}) e IGV más IPM ({igvTotal})</Fuerte>, calculados en cascada, más unos {formatCurrency(customsCostsUsd)} de costos de despacho en el Callao. Después vienen la homologación, la revisión técnica, la inscripción y las placas.
          </p>
          {nuevoUsa && usado ? (
            <p>
              Un ejemplo: un {comun.brand} {comun.model} a gasolina comprado en {formatCurrency(PRECIO_EJEMPLO)} cuesta {formatCurrency(costoNacionalizar(nuevoUsa))} de nacionalizar si es nuevo y originario de Estados Unidos, y {formatCurrency(costoNacionalizar(usado))} si es usado.
            </p>
          ) : null}
        </>
      }
    >
      <H2>Qué significa nacionalizar un vehículo</H2>
      <P>
        Un auto importado llega al Callao como mercancía extranjera. <Fuerte>Nacionalizarlo</Fuerte> es el despacho de importación ante SUNAT: se declara su valor, se pagan los tributos y la aduana autoriza su ingreso definitivo al país. Recién entonces puede homologarse, pasar revisión técnica e inscribirse en Registros Públicos para recibir placas.
      </P>
      <P>
        Por eso el costo de nacionalizar es distinto del costo de importar. El de importar incluye el precio del auto, el flete, el seguro y el servicio; está en la guía de <Enlace href={rutaGuia("cuanto-cuesta-importar-un-auto-a-peru")}>cuánto cuesta importar un auto</Enlace>. Esta guía se queda con lo que se paga en Perú para que el auto deje de ser extranjero.
      </P>

      <H2>Los tributos, en el orden en que se calculan</H2>
      <P>
        Cada tributo se calcula sobre el valor CIF (precio del vehículo más flete más seguro) <Fuerte>más los tributos anteriores</Fuerte>. No se suman porcentajes sobre el precio del auto; se encadenan.
      </P>
      <Tabla
        columnas={["Tributo", "Tasa", "Se calcula sobre"]}
        filas={[
          ["Ad valorem", `0% o ${general}`, "El valor CIF"],
          ["ISC", `0% a 20% en nuevos · ${formatRate(USED_ISC_RATE)} en usados`, "CIF más ad valorem"],
          ["IGV + IPM", `${formatRate(igvRate)} + ${formatRate(ipmRate)} = ${igvTotal}`, "CIF más ad valorem más ISC"],
          ["Percepción del IGV", `${formatRate(percepcionRates.recurrenteNuevo)} a ${formatRate(percepcionRates.primeraImportacion)}`, "Todo lo anterior. Es un adelanto que se recupera"],
        ]}
        nota="Tasas vigentes, las mismas que aplica la calculadora del sitio."
      />
      <Lista
        items={[
          <><Fuerte>Ad valorem.</Fuerte> {general} como regla general. Baja a 0% solo en un vehículo nuevo originario de Estados Unidos con certificado de origen; lo explica la guía de <Enlace href={rutaGuia("ad-valorem-0-autos-estados-unidos")}>ad valorem 0%</Enlace>.</>,
          <><Fuerte>ISC.</Fuerte> Depende del motor y de la condición: 0% en híbridos y eléctricos nuevos, por tramos de cilindrada en gasolina nuevos, y {formatRate(USED_ISC_RATE)} en todo usado. La tabla está en la guía del <Enlace href={rutaGuia("isc-vehiculos-peru")}>ISC de vehículos</Enlace>.</>,
          <><Fuerte>IGV e IPM.</Fuerte> {igvTotal} en conjunto, sobre la base ya cargada con los dos anteriores.</>,
          <><Fuerte>Costos de aduana.</Fuerte> Alrededor de {formatCurrency(customsCostsUsd)} por vehículo entre agencia de aduana, almacén y gastos portuarios. No entran en la base de los tributos.</>,
        ]}
      />

      {escenarios.length > 0 ? (
        <>
          <H2>Ejemplo en cifras: el mismo auto, tres casos</H2>
          <P>
            Un {comun.brand} {comun.model} a gasolina con un precio de compra de {formatCurrency(PRECIO_EJEMPLO)}. Cambia solo la condición y el origen; el flete y el seguro son los mismos.
          </P>
          <Tabla
            columnas={["Caso", "Ad valorem", "ISC", "IGV + IPM", "Aduana", "Nacionalizar"]}
            filas={escenarios.map(({ nombre, e }) => [
              nombre,
              `${formatCurrency(e.adValorem)} (${formatPercentage(e.adValoremRate)})`,
              `${formatCurrency(e.isc)} (${formatPercentage(e.iscRate)})`,
              formatCurrency(e.igv + e.ipm),
              formatCurrency(e.customsFee),
              <Fuerte key="t">{formatCurrency(costoNacionalizar(e))}</Fuerte>,
            ])}
            nota="Tributos más costos de despacho. No incluye flete, seguro, servicio ni la percepción del IGV, que es recuperable."
          />
          {nuevoUsa && usado ? (
            <P>
              La diferencia entre el nuevo originario y el usado es de {formatCurrency(costoNacionalizar(usado) - costoNacionalizar(nuevoUsa))} con el mismo precio de compra. Casi toda viene del ISC de {formatRate(USED_ISC_RATE)} y del ad valorem de {general} que pagan los usados aunque se hayan fabricado en Estados Unidos.
            </P>
          ) : null}
        </>
      ) : null}

      <H2>La percepción del IGV: efectivo, no costo</H2>
      <P>
        El día del despacho SUNAT cobra además la percepción del IGV: {formatRate(percepcionRates.recurrenteNuevo)} si eres importador recurrente con vehículo nuevo, {formatRate(percepcionRates.usado)} en usados y {formatRate(percepcionRates.primeraImportacion)} en una primera importación o sin RUC. No es un costo: se recupera como crédito fiscal. Pero hay que tener ese dinero ese día.
        {nuevoUsa ? <> En el ejemplo nuevo originario, son {formatCurrency(nuevoUsa.percepcion)} más de caja.</> : null}
      </P>

      <H2>Lo que viene después de nacionalizar</H2>
      <P>
        Con la DAM pagada el auto ya es peruano, pero todavía no puede circular. Faltan cuatro trámites, que toman unas dos semanas:
      </P>
      <Lista
        items={[
          <><Fuerte>Homologación vehicular ante el MTC</Fuerte>, o la constancia de que el modelo ya está homologado.</>,
          <><Fuerte>Revisión técnica</Fuerte> en un centro autorizado.</>,
          <><Fuerte>Inscripción en Registros Públicos</Fuerte> (SUNARP) y tarjeta de propiedad.</>,
          <><Fuerte>Placas</Fuerte> y SOAT.</>,
        ]}
      />
      <P>
        Si ya tienes el auto en el Callao o en camino, esos trámites y el despacho los hacemos como servicio independiente dentro de la gestión documentaria: no hace falta haberlo comprado con nosotros.
      </P>
      <Aviso titulo="Qué puede mover el número">
        Las tasas no cambian. Cambian el tipo de cambio del día y el valor que SUNAT acepte como base imponible: si considera que el precio declarado está por debajo del mercado, ajusta la base y los tributos suben. Por eso todo estimado tiene un rango de ±{formatPercentage(LUXCARS_CONFIG.services.finalRangeVariance, "es-PE", 1)}.
      </Aviso>

      <H2>Preguntas frecuentes sobre nacionalizar</H2>
      <Preguntas
        items={[
          {
            pregunta: "¿Cuánto se paga de impuestos por nacionalizar un carro en Perú?",
            respuesta: `Ad valorem de 0% o ${general}, ISC de 0% a ${formatRate(USED_ISC_RATE)} e IGV más IPM de ${igvTotal}, en cascada sobre el valor CIF.${
              nuevoUsa && usado
                ? ` En el ejemplo de esta guía, los tributos equivalen al ${formatPercentage(tributos(nuevoUsa) / nuevoUsa.cif)} del CIF en el nuevo originario de Estados Unidos y al ${formatPercentage(tributos(usado) / usado.cif)} en el usado.`
                : ""
            }`,
          },
          {
            pregunta: "¿Puedo nacionalizar un auto que compré yo mismo en el extranjero?",
            respuesta:
              "Sí, si cumple los requisitos de importación: antigüedad máxima, kilometraje, timón izquierdo y no ser diésel usado. Hacemos el despacho, la homologación y las placas como servicio independiente.",
          },
          {
            pregunta: "¿Cuánto demora nacionalizar un auto?",
            respuesta: `El despacho en aduana toma alrededor de una semana desde que el vehículo llega al Callao; la homologación, revisión técnica, inscripción y placas, unas dos semanas más. En el calendario de una importación completa son los tramos "${LUXCARS_CONFIG.timeline[4]?.title}" y "${LUXCARS_CONFIG.timeline[5]?.title}".`,
          },
          {
            pregunta: "¿Nacionalizar es lo mismo que homologar?",
            respuesta:
              "No. Nacionalizar es el trámite aduanero ante SUNAT: pagar los tributos y liberar el vehículo. Homologar es el trámite técnico ante el MTC que certifica que el modelo cumple las normas peruanas para circular. Primero se nacionaliza, después se homologa.",
          },
        ]}
      />
      <IrACalculadora texto="Calcular los tributos de mi auto" />
    </GuiaLayout>
  );
}
