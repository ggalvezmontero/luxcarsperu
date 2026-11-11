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
import { cotizarEscenario, ejemplosCotizados, sobrecosto, tributos } from "@/lib/guiasDatos";
import { rutaModelo } from "@/lib/importExamples/modelo";
import { formatCurrency, formatPercentage, formatRate } from "@/lib/utils";

const SLUG = "cuanto-cuesta-importar-un-auto-a-peru";

export const revalidate = 86400;
export const generateMetadata = () => metadataDeGuia(SLUG);

export default async function Page() {
  const anio = currentYearInLima();
  const ejemplos = await ejemplosCotizados(anio);
  const { igvRate, ipmRate, percepcionRates, adValoremByOrigin, freightByCategory, planConfigs } = PRICING_CONFIG;
  const general = formatRate(adValoremByOrigin.otro);
  const igvTotal = formatRate(igvRate + ipmRate);

  const porSobrecosto = [...ejemplos].sort((a, b) => sobrecosto(a.e) - sobrecosto(b.e));
  const menor = porSobrecosto[0];
  const mayor = porSobrecosto[porSobrecosto.length - 1];
  const fletes = Object.values(freightByCategory);
  // Un solo flete para toda propulsión se dice como una cifra, no como un rango.
  const textoFlete =
    Math.min(...fletes) === Math.max(...fletes)
      ? formatCurrency(fletes[0])
      : `entre ${formatCurrency(Math.min(...fletes))} y ${formatCurrency(Math.max(...fletes))}`;

  // El mismo vehículo, nuevo y usado, para que se vea cuánto pesa la condición.
  const base = ejemplos[0];
  const comoNuevo = base
    ? cotizarEscenario({ brand: base.v.calculator.brand, model: base.v.calculator.model, priceUsd: base.e.input.priceMiami, vehicleType: base.v.calculator.vehicleType, condition: "nuevo", anio })
    : null;
  const comoUsado = base
    ? cotizarEscenario({ brand: base.v.calculator.brand, model: base.v.calculator.model, priceUsd: base.e.input.priceMiami, vehicleType: base.v.calculator.vehicleType, condition: "usado", anio })
    : null;

  return (
    <GuiaLayout
      slug={SLUG}
      respuesta={
        menor && mayor ? (
          <>
            <p>
              Importar un auto nuevo de Estados Unidos a Perú cuesta entre <Fuerte>{formatPercentage(sobrecosto(menor.e))}</Fuerte> y <Fuerte>{formatPercentage(sobrecosto(mayor.e))}</Fuerte> por encima de su precio de compra, ya puesto en Lima y con placas. No es un porcentaje fijo: depende de dónde se ensambló el vehículo y de qué motor tiene.
            </p>
            <p>
              Dos ejemplos: {menor.v.name}, con un precio de compra de {formatCurrency(menor.e.input.priceMiami)}, queda en {formatCurrency(menor.e.finalEstimate)}. {mayor.v.name}, con un precio de compra de {formatCurrency(mayor.e.input.priceMiami)}, queda en {formatCurrency(mayor.e.finalEstimate)}.
            </p>
          </>
        ) : (
          <p>
            El costo de importar un auto a Perú depende de su precio, de dónde se ensambló y de qué motor tiene. La calculadora te da la cifra exacta con tus datos.
          </p>
        )
      }
    >
      <H2>Qué incluye el costo de importar un auto</H2>
      <P>
        El número que importa es el del vehículo <Fuerte>puesto en Lima</Fuerte>: comprado, embarcado, nacionalizado y con placas. Tiene seis partes.
      </P>
      <Lista
        items={[
          <><Fuerte>El precio de compra en Estados Unidos.</Fuerte> Es la base de todo lo demás.</>,
          <><Fuerte>Flete marítimo y seguro.</Fuerte> De Miami al Callao, {textoFlete} de flete, más un seguro de {formatRate(PRICING_CONFIG.insuranceRate)} sobre el {formatPercentage(PRICING_CONFIG.insuredValueFactor)} del precio del vehículo.</>,
          <><Fuerte>Tributos de SUNAT.</Fuerte> Ad valorem, ISC, IGV e IPM, calculados en cascada.</>,
          <><Fuerte>Costos de aduana.</Fuerte> {formatCurrency(PRICING_CONFIG.customsCostsUsd)} por vehículo para el despacho en el Callao. No entran en la base de los tributos.</>,
          <><Fuerte>El servicio de importación.</Fuerte> Búsqueda, inspección de la unidad, compra, logística y trámite hasta las placas.</>,
          <><Fuerte>La percepción del IGV.</Fuerte> No es un costo, es un adelanto que se recupera, pero hay que tener ese efectivo el día del despacho.</>,
        ]}
      />

      <H2>Los impuestos se calculan en cascada</H2>
      <P>
        Aquí está el error más común. Los tributos no se suman sobre el precio del auto: cada uno se calcula sobre el valor en aduana <Fuerte>más los tributos anteriores</Fuerte>.
      </P>
      <Tabla
        columnas={["Tributo", "Tasa", "Se calcula sobre"]}
        filas={[
          ["Ad valorem", `0% o ${general}`, "El valor CIF: precio más flete más seguro"],
          ["ISC", `0% a 20% en nuevos · ${formatRate(USED_ISC_RATE)} en usados`, "CIF más ad valorem"],
          ["IGV + IPM", `${formatRate(igvRate)} + ${formatRate(ipmRate)} = ${igvTotal}`, "CIF más ad valorem más ISC"],
          ["Percepción del IGV", `${formatRate(percepcionRates.recurrenteNuevo)} a ${formatRate(percepcionRates.primeraImportacion)}`, "Todo lo anterior. Se recupera como crédito fiscal"],
        ]}
        nota="Tasas vigentes. Son las que aplica la calculadora del sitio."
      />
      <P>
        El ad valorem es 0% solo en un caso, que explica la guía de <Enlace href={rutaGuia("ad-valorem-0-autos-estados-unidos")}>ad valorem 0%</Enlace>. El ISC depende del motor: la tabla completa está en la guía del <Enlace href={rutaGuia("isc-vehiculos-peru")}>ISC de vehículos</Enlace>.
      </P>

      {ejemplos.length > 0 ? (
        <>
          <H2>Ejemplos con cifras: cuánto cuesta traer cada modelo</H2>
          <P>
            Calculados hoy con las tasas vigentes para un vehículo nuevo. El precio de compra es referencial; cada modelo enlaza a su desglose completo.
          </P>
          <Tabla
            columnas={["Modelo", "Precio en EE.UU.", "Ad valorem", "ISC", "Tributos", "Puesto en Lima"]}
            filas={ejemplos.map(({ v, e }) => [
              <Enlace key={v.id} href={rutaModelo(v.id)}>{v.name}</Enlace>,
              formatCurrency(e.input.priceMiami),
              formatPercentage(e.adValoremRate),
              formatPercentage(e.iscRate),
              formatCurrency(tributos(e)),
              <Fuerte key="t">{formatCurrency(e.finalEstimate)}</Fuerte>,
            ])}
            nota="Costo final con flete, seguro, tributos y servicio. No incluye la percepción del IGV, que es recuperable."
          />
          {menor && mayor ? (
            <P>
              La diferencia entre el más barato de traer y el más caro no está en el precio, está en los impuestos. {menor.v.name} paga {formatPercentage(menor.e.adValoremRate)} de ad valorem y {formatPercentage(menor.e.iscRate)} de ISC; {mayor.v.name} paga {formatPercentage(mayor.e.adValoremRate)} y {formatPercentage(mayor.e.iscRate)}.
            </P>
          ) : null}
        </>
      ) : null}

      <H2>¿Importar cuesta 60% u 85% más, como se dice?</H2>
      <P>
        Depende del vehículo, y por eso un solo porcentaje confunde.
        {menor && mayor ? (
          <> Con las tasas vigentes, un vehículo nuevo queda entre {formatPercentage(sobrecosto(menor.e))} y {formatPercentage(sobrecosto(mayor.e))} por encima de su precio de compra, con el servicio de importación incluido. El extremo alto es el de los vehículos que pagan {formatPercentage(mayor.e.adValoremRate)} de ad valorem y {formatPercentage(mayor.e.iscRate)} de ISC; el bajo, el de los que pagan {formatPercentage(menor.e.adValoremRate)} y {formatPercentage(menor.e.iscRate)}.</>
        ) : null}
      </P>
      <P>
        Las cifras más altas que circulan corresponden a los <Fuerte>usados</Fuerte>: pagan {formatRate(USED_ISC_RATE)} de ISC sin importar el motor y {general} de ad valorem aunque se hayan fabricado en Estados Unidos.
        {comoUsado ? <> En el ejemplo de abajo, el usado queda {formatPercentage(sobrecosto(comoUsado))} por encima de su precio de compra.</> : null}
      </P>
      {base && comoNuevo && comoUsado ? (
        <Tabla
          columnas={[`${base.v.calculator.brand} ${base.v.calculator.model}`, "Tributos", "Puesto en Lima"]}
          filas={[
            ["Nuevo", formatCurrency(tributos(comoNuevo)), formatCurrency(comoNuevo.finalEstimate)],
            ["Usado", formatCurrency(tributos(comoUsado)), formatCurrency(comoUsado.finalEstimate)],
          ]}
          nota={`El mismo vehículo y el mismo precio de compra (${formatCurrency(base.e.input.priceMiami)}). Solo cambia la condición.`}
        />
      ) : null}
      <P>
        Por eso casi siempre conviene traer el vehículo nuevo. Los límites para importar usados están en la guía de <Enlace href={rutaGuia("requisitos-para-importar-un-auto-a-peru")}>requisitos</Enlace>.
      </P>

      <H2>Cuánto efectivo se necesita en total</H2>
      <P>
        Dos cifras distintas, y conviene tener claras las dos antes de empezar:
      </P>
      <Lista
        items={[
          <><Fuerte>El costo real:</Fuerte> lo que te cuesta el vehículo puesto en Lima. Es el número de las tablas de arriba.</>,
          <><Fuerte>El efectivo del día del despacho:</Fuerte> el costo real más la percepción del IGV, que es de {formatRate(percepcionRates.recurrenteNuevo)} para un importador recurrente con vehículo nuevo, {formatRate(percepcionRates.usado)} en usados y {formatRate(percepcionRates.primeraImportacion)} en una primera importación. Ese monto vuelve como crédito fiscal.</>,
        ]}
      />
      <Aviso titulo="Lo que mueve el número final">
        Los tributos son tasas y no cambian. Varían el tipo de cambio del día, el flete del mes y el valor que SUNAT acepte como base imponible. Por eso todo estimado tiene un rango de ±{formatPercentage(LUXCARS_CONFIG.services.finalRangeVariance, "es-PE", 1)}.
      </Aviso>

      <H2>Preguntas frecuentes sobre el costo</H2>
      <Preguntas
        items={[
          {
            pregunta: "¿Cuánto cuesta nacionalizar un auto en Perú?",
            respuesta: `Nacionalizar es pagar los tributos de importación: ad valorem (0% o ${general}), ISC (según motor y condición) e IGV más IPM (${igvTotal}), en cascada. El monto exacto depende del valor CIF del vehículo; la calculadora lo resuelve con tus datos.`,
          },
          {
            pregunta: "¿Cuánto cobran por traer un carro de Estados Unidos?",
            respuesta: `El flete marítimo de Miami al Callao cuesta ${textoFlete}. A eso se suman el seguro, los tributos, ${formatCurrency(PRICING_CONFIG.customsCostsUsd)} de costos de aduana y el servicio de importación. El plan ${planConfigs.fast.label} (${planConfigs.fast.timelineLabel}) cuesta ${formatCurrency(planConfigs.fast.documentHandlingFee)} más que el ${planConfigs.standard.label} (${planConfigs.standard.timelineLabel}).`,
          },
          {
            pregunta: "¿Desde qué precio conviene importar?",
            respuesta: `Trabajamos desde ${formatCurrency(LUXCARS_CONFIG.services.minimumVehiclePrice)} de precio en Estados Unidos. Por debajo, los costos fijos del proceso pesan demasiado sobre el valor del vehículo.`,
          },
          {
            pregunta: "¿Siempre conviene importar?",
            respuesta:
              "No. Hay modelos que se venden nuevos en Perú por menos de lo que costaría traerlos, y otros que no se pueden matricular. Cuando no conviene, lo decimos antes de cotizar.",
          },
        ]}
      />
      <IrACalculadora texto="Calcular el costo de mi auto" />
    </GuiaLayout>
  );
}
