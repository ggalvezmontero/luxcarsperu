import {
  Aviso,
  Enlace,
  Fuerte,
  GuiaLayout,
  H2,
  H3,
  Lista,
  P,
  Preguntas,
  Tabla,
  metadataDeGuia,
} from "@/components/guias/GuiaLayout";
import { FiltroRetorno } from "@/components/guias/FiltroRetorno";
import { PRICING_CONFIG, currentYearInLima, oldestImportableModelYear } from "@/core/pricing/pricingConfig";
import { USED_ISC_RATE } from "@/core/pricing/vehicleCategories";
import { rutaGuia } from "@/lib/guias";
import { cotizarEscenario, tributos } from "@/lib/guiasDatos";
import { ENLACES_RETORNO, LEY_RETORNO, topeRecorridoKm } from "@/lib/retorno";
import { formatCurrency, formatNumber, formatPercentage, formatRate } from "@/lib/utils";

const SLUG = "traer-tu-auto-de-estados-unidos-a-peru";

/** Valor del usado con el que se ilustra la importación regular. */
const VALOR_EJEMPLO_USD = 30_000;

export const revalidate = 86400;
export const generateMetadata = () => metadataDeGuia(SLUG);

function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export default function Page() {
  const anio = currentYearInLima();
  const masAntiguo = oldestImportableModelYear(anio);
  const { usedMaxAgeYears, customsCostsUsd, insuranceRate, insuredValueFactor, freightByCategory, adValoremByOrigin } =
    PRICING_CONFIG;
  const kmAuto = formatNumber(topeRecorridoKm("auto"), "en-US");
  const kmCamioneta = formatNumber(topeRecorridoKm("camioneta"), "en-US");
  const tope = formatCurrency(LEY_RETORNO.valorMaximoUsd);
  const vigencia = fechaLarga(LEY_RETORNO.vigenteHasta);
  const general = formatRate(adValoremByOrigin.otro);
  const flete = formatCurrency(freightByCategory.gasolina);

  // Lo que paga el mismo auto sin el beneficio, por el camino de la calculadora.
  const ejemplo = cotizarEscenario({
    brand: "Toyota",
    model: "Camry",
    priceUsd: VALOR_EJEMPLO_USD,
    vehicleType: "gasolina",
    condition: "usado",
    anio,
  });
  const tributosEjemplo = ejemplo ? formatCurrency(tributos(ejemplo)) : null;

  return (
    <GuiaLayout
      slug={SLUG}
      respuesta={
        <>
          <p>
            Sí puedes traer tu auto, si es <Fuerte>modelo {masAntiguo} o más nuevo</Fuerte>. Perú solo admite usados de hasta {usedMaxAgeYears} años, a gasolina, híbridos o eléctricos, y con recorrido dentro del tope. Un auto más antiguo no entra, con o sin Ley del Retorno.
          </p>
          <p>
            Si eres peruano y viviste fuera {LEY_RETORNO.aniosMinimosFuera} años o más, la Ley del Retorno te libera de los tributos de importación de un vehículo de hasta {tope}. El beneficio rige hasta el {vigencia}.
          </p>
        </>
      }
    >
      <H2 id="filtro">Comprueba si tu auto puede entrar</H2>
      <P>
        Son siete datos. El resultado sale al instante y, si tu auto califica, nos llega por WhatsApp con todo ya escrito.
      </P>
      <FiltroRetorno anio={anio} aniosFuera={LEY_RETORNO.aniosMinimosFuera} />

      <H2>Qué debe cumplir el auto</H2>
      <P>
        La Ley del Retorno quita los tributos, no los requisitos. SUNAT exige al vehículo del migrante retornado lo mismo que a cualquier usado que entra al país.
      </P>
      <Tabla
        columnas={["Requisito", `Qué se exige en ${anio}`]}
        filas={[
          ["Antigüedad", `Máximo ${usedMaxAgeYears} años desde el año modelo: modelo ${masAntiguo} en adelante`],
          ["Recorrido", `Hasta ${kmAuto} km en autos y SUV · hasta ${kmCamioneta} km en camionetas y pickups`],
          ["Combustible", "Gasolina, híbrido o eléctrico. Diésel usado no entra"],
          ["Timón", "Izquierdo de fábrica"],
          ["Propiedad", "A tu nombre y sin préstamo pendiente, o con autorización escrita del financista"],
        ]}
        nota={`El año en curso cuenta como el primero: un modelo ${masAntiguo} entra solo hasta el 31 de diciembre de ${anio}. ${kmAuto} km son unas ${formatNumber(Math.round(topeRecorridoKm("auto") / 1.609344 / 100) * 100, "en-US")} millas.`}
      />
      <Aviso titulo="Si tu auto es más antiguo, no hay trámite que lo resuelva">
        Es la consulta que más recibimos. Un auto de {masAntiguo - 1} o anterior no puede entrar a Perú aunque cumplas todo lo demás. En ese caso lo que conviene es venderlo allá y traer uno que sí entre.
      </Aviso>
      <P>
        El detalle de cada requisito está en la guía de <Enlace href={rutaGuia("requisitos-para-importar-un-auto-a-peru")}>requisitos para importar un auto a Perú</Enlace>.
      </P>

      <H2>Quién califica para la Ley del Retorno</H2>
      <P>
        Es la Ley 30001, de reinserción del migrante retornado. Para el vehículo pide cinco cosas:
      </P>
      <Lista
        items={[
          <><Fuerte>Ser peruano</Fuerte> y haber vivido fuera al menos {LEY_RETORNO.aniosMinimosFuera} años seguidos. Las visitas al Perú no cortan el plazo si no pasan de {LEY_RETORNO.diasVisitaPorAnio} días por año.</>,
          <><Fuerte>Tener la Tarjeta del Migrante Retornado.</Fuerte> La emite el Ministerio de Relaciones Exteriores. Se pide en línea hasta {LEY_RETORNO.diasParaPedirTarjeta} días calendario antes o después de tu ingreso al Perú, y sale en unos {LEY_RETORNO.diasHabilesTarjeta} días hábiles. Es un trámite personal.</>,
          <><Fuerte>Pedir el beneficio a tiempo.</Fuerte> El beneficio se pide al numerar la declaración de importación, con el auto ya en el Callao, dentro de los {LEY_RETORNO.mesesParaSolicitar} meses desde tu ingreso al país si sacaste la tarjeta afuera, o desde su emisión si la sacaste en el Perú. No hay una aprobación previa: todo se resuelve en aduana.</>,
          <><Fuerte>Un solo vehículo, de hasta {tope}.</Fuerte> El valor lo determina SUNAT con su tabla de valores referenciales, no la factura. Si lo valoriza por encima del tope, no hay beneficio parcial: paga como importación regular.</>,
          <><Fuerte>Quedarte en el Perú {LEY_RETORNO.aniosSinTransferir} años y no transferir el auto en ese plazo.</Fuerte> Firmas una declaración jurada de residencia; las salidas de más de {LEY_RETORNO.diasFueraPorAnio} días al año cuentan como incumplimiento. Si vendes el auto antes, se pagan los tributos que no se pagaron, con intereses.</>,
        ]}
      />
      <P>
        El beneficio se usa una sola vez y está vigente hasta el {vigencia}.
      </P>

      <H2>Cómo sacar la Tarjeta del Migrante Retornado</H2>
      <P>
        El trámite es gratuito y se hace en el <Enlace href={ENLACES_RETORNO.portalCancilleria}>Portal de Servicios al Ciudadano</Enlace> de Cancillería: creas tu usuario, eliges &ldquo;Tarjeta de Migrante Retornado&rdquo; y &ldquo;Solicitud TMR&rdquo;, llenas el Formulario R-1 y marcas el beneficio del vehículo. La tarjeta llega a tu correo.
      </P>
      <Lista
        items={[
          <>Copia simple del DNI vigente.</>,
          <><Enlace href={ENLACES_RETORNO.declaracionJuradaTarjeta}>Declaración jurada</Enlace> de Cancillería, firmada.</>,
          <>Formulario R-1, que se llena dentro del portal.</>,
          <>Una foto reciente tamaño pasaporte, a colores y con fondo blanco, en JPG.</>,
          <>Si los sellos del pasaporte no bastan para probar los {LEY_RETORNO.aniosMinimosFuera} años fuera: contratos de alquiler, declaraciones de impuestos o planillas del país donde viviste.</>,
        ]}
      />
      <P>
        Cancillería verifica el tiempo fuera en los registros de Migraciones. Las fichas oficiales son la de <Enlace href={ENLACES_RETORNO.tarjetaExtranjero}>quien todavía está en el extranjero</Enlace> y la de <Enlace href={ENLACES_RETORNO.tarjetaPeru}>quien ya volvió al Perú</Enlace>. Conviene pedirla antes de viajar: así el auto puede zarpar mientras tú cierras tus cosas allá.
      </P>

      <H2>Documentos adicionales del migrante retornado</H2>
      <P>
        Son los papeles que el agente de aduana presenta junto con la declaración de importación, además de los de cualquier usado. Con ellos SUNAT decide en el mismo despacho si el auto sale sin tributos.
      </P>
      <Lista
        items={[
          <>Copia de la <Fuerte>Tarjeta del Migrante Retornado</Fuerte>.</>,
          <>Certificado de <Enlace href={ENLACES_RETORNO.movimientoMigratorio}>movimiento migratorio</Enlace> de Migraciones con tu fecha de ingreso, si la tarjeta la emitió un consulado. Se descarga en línea al instante.</>,
          <>Declaración jurada del <Enlace href={ENLACES_RETORNO.anexo1}>Anexo 1</Enlace>: propiedad del auto, residencia en el Perú por {LEY_RETORNO.aniosSinTransferir} años y compromiso de no transferirlo.</>,
          <>Lista valorizada del <Enlace href={ENLACES_RETORNO.anexo2}>Anexo 2</Enlace>, donde va el vehículo con marca, modelo, año, VIN y valor, con la factura o contrato de compra como sustento.</>,
          <>Título de propiedad del auto.</>,
          <>Todos los documentos a nombre del migrante retornado: tarjeta, título, factura y conocimiento de embarque.</>,
        ]}
      />
      <Aviso titulo="El beneficio se decide con el auto en el puerto">
        SUNAT no emite una aprobación antes del embarque: revisa la tarjeta, el plazo y el valor cuando el agente numera la declaración, y tú ya tienes que haber ingresado al Perú. Por eso, antes de mover el auto, confirmamos tres cosas: que tienes la tarjeta, que el auto está dentro de los {tope} en la tabla de SUNAT y que el título está a tu nombre. Con eso cerrado, el riesgo en aduana es mínimo.
      </Aviso>
      <P>
        La página oficial del beneficio es la de <Enlace href={ENLACES_RETORNO.sunatRetorno}>SUNAT para quien retorna al Perú</Enlace>.
      </P>

      <H2>Si no calificas a la ley: importación regular</H2>
      <P>
        Tu auto puede entrar igual, mientras cumpla los requisitos de arriba. La diferencia es que paga los tributos de un usado: ad valorem de {general}, ISC de {formatRate(USED_ISC_RATE)}, IGV e IPM.
        {tributosEjemplo ? (
          <> Para un usado valorizado en {formatCurrency(VALOR_EJEMPLO_USD)}, eso son unos <Fuerte>{tributosEjemplo}</Fuerte>. Con la Ley del Retorno, cero.</>
        ) : null}
      </P>
      <P>
        Cómo se calcula cada tributo está en la guía de <Enlace href={rutaGuia("cuanto-cuesta-importar-un-auto-a-peru")}>cuánto cuesta importar un auto</Enlace>.
      </P>

      <H2>Cuánto cuesta el envío</H2>
      <P>Con o sin Ley del Retorno, traer el auto tiene estos costos:</P>
      <Lista
        items={[
          <><Fuerte>Transporte en Estados Unidos.</Fuerte> Desde donde está el auto hasta el puerto de Miami. Depende del estado.</>,
          <><Fuerte>Flete marítimo y seguro.</Fuerte> {flete} de Miami al Callao, más un seguro de {formatRate(insuranceRate)} sobre el {formatPercentage(insuredValueFactor)} del valor del vehículo.</>,
          <><Fuerte>Costos de aduana.</Fuerte> {formatCurrency(customsCostsUsd)} por vehículo para el despacho en el Callao.</>,
          <><Fuerte>Nuestro servicio.</Fuerte> Embarque, expediente ante SUNAT, homologación y placas. Lo cotizamos según el caso, antes de mover el auto.</>,
        ]}
      />

      <H2>El trámite, paso a paso</H2>
      <H3>1. Confirmamos que el auto puede entrar</H3>
      <P>
        Con el VIN revisamos año modelo, recorrido, historial y dónde se ensambló. Si no puede entrar, lo sabes antes de gastar en nada.
      </P>
      <H3>2. Sacas la Tarjeta del Migrante Retornado</H3>
      <P>
        Solo si vas por la Ley del Retorno. La tramitas tú en el portal de Cancillería, hasta {LEY_RETORNO.diasParaPedirTarjeta} días antes o después de volver; nosotros revisamos que el auto esté dentro del tope en la tabla de SUNAT y armamos la lista de documentos.
      </P>
      <H3>3. Inspección de la entidad verificadora</H3>
      <P>
        Antes de embarcar, una entidad autorizada por el MTC revisa el auto en Estados Unidos y emite el reporte de inspección que exige todo usado: requisitos técnicos y límites de emisiones. Sin ese reporte la aduana no numera la declaración. Los requisitos están en la página de <Enlace href={ENLACES_RETORNO.sunatUsados}>SUNAT para vehículos usados</Enlace>.
      </P>
      <H3>4. Recojo y embarque en Estados Unidos</H3>
      <P>
        El auto viaja al puerto con su título de propiedad a tu nombre, se presenta a la aduana de Estados Unidos y se embarca al Callao. El conocimiento de embarque sale a tu nombre. Coordinamos el zarpe para que el auto llegue unos días después de tu ingreso al Perú.
      </P>
      <H3>5. Nacionalización ante SUNAT</H3>
      <P>
        Ya en el Perú, descargas tu certificado de movimiento migratorio. Un agente de aduana numera la declaración con tu tarjeta, los Anexos 1 y 2, el título, el reporte de la verificadora y la ficha técnica de importación firmada por un ingeniero. Con la Ley del Retorno el auto sale sin tributos; sin ella, se pagan.
      </P>
      <H3>6. Homologación, inscripción y placas</H3>
      <P>
        Igual que cualquier importado: se acredita ante el MTC que cumple el reglamento peruano, se inscribe en el registro vehicular y recibe sus placas.
      </P>

      <H2>Preguntas frecuentes sobre traer tu auto</H2>
      <Preguntas
        items={[
          {
            pregunta: "¿Puedo llevar mi auto de Estados Unidos a Perú?",
            respuesta: `Sí, si es modelo ${masAntiguo} o más nuevo, no es diésel y no supera ${kmAuto} km en autos y SUV o ${kmCamioneta} km en camionetas. Un auto más antiguo no puede entrar.`,
          },
          {
            pregunta: "¿Cuánto cuesta enviar un auto de Estados Unidos a Perú?",
            respuesta: `El flete marítimo de Miami al Callao cuesta ${flete}. Se suman el seguro, ${formatCurrency(customsCostsUsd)} de costos de aduana, el transporte hasta Miami y el servicio. Con la Ley del Retorno no se pagan tributos de importación; sin ella, un usado paga ad valorem, ISC de ${formatRate(USED_ISC_RATE)}, IGV e IPM.`,
          },
          {
            pregunta: "¿La Ley del Retorno me deja traer un auto de más de dos años?",
            respuesta:
              "No. La ley libera de tributos, pero el vehículo debe cumplir los mismos requisitos de antigüedad, recorrido y combustible que cualquier usado.",
          },
          {
            pregunta: `¿Qué pasa si mi auto vale más de ${tope}?`,
            respuesta:
              "Queda fuera del beneficio completo, no solo por el exceso. Puede entrar como importación regular, pagando los tributos de un usado.",
          },
          {
            pregunta: "¿Puedo vender el auto cuando llegue a Perú?",
            respuesta: `Si entró con la Ley del Retorno, no durante ${LEY_RETORNO.aniosSinTransferir} años: venderlo antes obliga a pagar los tributos con intereses. Si entró como importación regular, sí.`,
          },
          {
            pregunta: "¿Hasta cuándo está vigente la Ley del Retorno?",
            respuesta: `Hasta el ${vigencia}, por la prórroga de la Ley 32722.`,
          },
        ]}
      />
      <P className="text-sm text-ink-4">
        Requisitos de la Ley del Retorno revisados contra SUNAT y Cancillería el {fechaLarga(LEY_RETORNO.verificada)}. El valor del vehículo y la procedencia del beneficio los determina SUNAT en cada caso.
      </P>
    </GuiaLayout>
  );
}
