import {
  Aviso,
  Enlace,
  Fuerte,
  GuiaLayout,
  H2,
  H3,
  IrACalculadora,
  Lista,
  P,
  Preguntas,
  Tabla,
  metadataDeGuia,
} from "@/components/guias/GuiaLayout";
import { PRICING_CONFIG, currentYearInLima, oldestImportableModelYear } from "@/core/pricing/pricingConfig";
import { USED_ISC_RATE, VEHICLE_CATEGORIES } from "@/core/pricing/vehicleCategories";
import { IMPORT_COMPLIANCE_REFERENCE } from "@/lib/db/types";
import { rutaGuia } from "@/lib/guias";
import { formatNumber, formatRate } from "@/lib/utils";

const SLUG = "requisitos-para-importar-un-auto-a-peru";

export const revalidate = 86400;
export const generateMetadata = () => metadataDeGuia(SLUG);

export default function Page() {
  const anio = currentYearInLima();
  const masAntiguo = oldestImportableModelYear(anio);
  const { maxVehicleAgeYears, maxMileageKm } = IMPORT_COMPLIANCE_REFERENCE;
  const kmM1 = formatNumber(maxMileageKm.M1, "en-US");
  const kmN1 = formatNumber(maxMileageKm.N1, "en-US");
  const general = formatRate(PRICING_CONFIG.adValoremByOrigin.otro);
  const iscDieselNuevo = formatRate(VEHICLE_CATEGORIES.find((c) => c.id === "diesel")?.newIscRate ?? 0);
  const planes = PRICING_CONFIG.planConfigs;

  return (
    <GuiaLayout
      slug={SLUG}
      respuesta={
        <>
          <p>
            Un vehículo <Fuerte>nuevo</Fuerte> se puede importar a Perú si tiene timón izquierdo de fábrica. Un vehículo <Fuerte>usado</Fuerte> debe cumplir cuatro condiciones a la vez: máximo {maxVehicleAgeYears} años de antigüedad, timón izquierdo de fábrica, kilometraje dentro del tope y no ser diésel.
          </p>
          <p>
            En {anio}, un usado solo entra si su año modelo es <Fuerte>{masAntiguo} o posterior</Fuerte>.
          </p>
        </>
      }
    >
      <H2>Requisitos según el vehículo sea nuevo o usado</H2>
      <Tabla
        columnas={["Requisito", "Vehículo nuevo", "Vehículo usado"]}
        filas={[
          ["Antigüedad", "Sin límite: es nuevo", `Máximo ${maxVehicleAgeYears} años desde el año modelo. En ${anio}: modelo ${masAntiguo} en adelante`],
          ["Timón", "Izquierdo de fábrica", "Izquierdo de fábrica. No se aceptan conversiones"],
          ["Kilometraje", "No aplica", `Hasta ${kmM1} km en autos y SUV · hasta ${kmN1} km en camionetas y pickups`],
          ["Motor diésel", `Permitido. ISC de ${iscDieselNuevo}`, "Prohibido en autos, SUV y camionetas"],
          ["Ad valorem", `0% si es originario de Estados Unidos y trae certificado de origen; si no, ${general}`, `${general} siempre`],
          ["ISC", "0% a 20% según el motor", `${formatRate(USED_ISC_RATE)}, sea cual sea el motor`],
        ]}
        nota="El año en curso cuenta como el primero de la antigüedad. Los topes de kilometraje corresponden a las categorías M1 y N1."
      />

      <H2>Qué vehículos no se pueden importar a Perú</H2>
      <P>Cuatro casos, y ninguno se resuelve con un trámite adicional:</P>
      <Lista
        items={[
          <><Fuerte>Diésel usado.</Fuerte> Prohibido en autos, SUV y camionetas por el D. Leg. 843 y el texto del D.S. 005-2020-MTC. El diésel nuevo sí se puede importar.</>,
          <><Fuerte>Usados con más de {maxVehicleAgeYears} años.</Fuerte> Se cuenta desde el año modelo e incluye el año en curso. En {anio} no entra un usado de año modelo {masAntiguo - 1} o anterior.</>,
          <><Fuerte>Timón a la derecha o convertido.</Fuerte> El timón debe ser izquierdo de fábrica. Una conversión no lo habilita.</>,
          <><Fuerte>Usados que superan el tope de kilometraje.</Fuerte> {kmM1} km en autos y SUV, {kmN1} km en camionetas y pickups. El odómetro se contrasta con el historial del vehículo.</>,
        ]}
      />
      <Aviso titulo="Que pueda entrar no significa que pueda circular">
        Además de pasar aduana, el vehículo debe poder matricularse. Un modelo que no está homologado fuera de su mercado de origen puede nacionalizarse y quedarse sin placas. Lo revisamos antes de cotizar.
      </Aviso>

      <H2>Qué año de auto se puede importar en {anio}</H2>
      <P>
        Para un usado, la regla es de {maxVehicleAgeYears} años contados desde el <Fuerte>año modelo</Fuerte>, no desde la fecha de fabricación ni de la primera matrícula. El año en curso cuenta como el primero.
      </P>
      <Tabla
        columnas={["Año modelo", `¿Entra como usado en ${anio}?`]}
        filas={[
          [String(anio + 1), "Sí"],
          [String(anio), "Sí"],
          [String(masAntiguo), anio === masAntiguo ? "Sí" : "Sí, es el más antiguo permitido"],
          [String(masAntiguo - 1), "No"],
        ]}
        nota="En Estados Unidos el año modelo se adelanta al calendario: desde mediados de año los concesionarios ya venden el modelo del año siguiente."
      />
      <P>
        Para un vehículo nuevo no hay límite de antigüedad. Lo que cambia es el costo: un usado paga bastante más en tributos, como muestra la guía de <Enlace href={rutaGuia("cuanto-cuesta-importar-un-auto-a-peru")}>cuánto cuesta importar un auto</Enlace>.
      </P>

      <H2>El trámite, paso a paso</H2>
      <P>
        Cada paso pide el documento del anterior, así que el orden no es negociable.
      </P>
      <H3>1. Compra e inspección en Estados Unidos</H3>
      <P>
        Antes de pagar se revisa el historial de la unidad, se inspecciona en persona y se confirma con el VIN dónde se ensambló. De ahí salen la factura de compra y, cuando corresponde, el certificado de origen.
      </P>
      <H3>2. Embarque</H3>
      <P>
        El vehículo viaja por mar de Miami al Callao. Es el tramo menos negociable del plazo: depende del calendario de naves.
      </P>
      <H3>3. Nacionalización ante SUNAT</H3>
      <P>
        Un agente de aduana presenta la declaración y se pagan ad valorem, ISC, IGV, IPM y la percepción. Cuánto es cada uno está en la <Enlace href="/calculadora">calculadora de importación</Enlace>.
      </P>
      <H3>4. Homologación ante el MTC</H3>
      <P>
        Se acredita que el vehículo cumple el reglamento peruano. Sin este paso no hay inscripción.
      </P>
      <H3>5. Inscripción registral y placas</H3>
      <P>
        Con la inscripción en el registro vehicular se emite la tarjeta de propiedad y se asignan las placas. Recién ahí el vehículo puede circular.
      </P>
      <P>
        Todo el proceso toma {planes.fast.timelineLabel} con el plan {planes.fast.label} y {planes.standard.timelineLabel} con el {planes.standard.label}. El detalle de cada etapa está en <Enlace href="/como-funciona">cómo funciona la importación</Enlace>.
      </P>

      <H2>Preguntas frecuentes sobre los requisitos</H2>
      <Preguntas
        items={[
          {
            pregunta: "¿Cuáles son los requisitos para importar autos usados a Perú?",
            respuesta: `Cuatro, todos obligatorios: máximo ${maxVehicleAgeYears} años desde el año modelo, timón izquierdo de fábrica, no superar ${kmM1} km en autos y SUV o ${kmN1} km en camionetas y pickups, y no ser diésel.`,
          },
          {
            pregunta: "¿Se puede importar una camioneta diésel usada?",
            respuesta: `No, y no hay trámite que lo levante. Diésel nuevo sí: paga ${iscDieselNuevo} de ISC.`,
          },
          {
            pregunta: "¿Puedo importar un auto con timón a la derecha?",
            respuesta:
              "No. El timón debe ser izquierdo de fábrica y las conversiones no se aceptan.",
          },
          {
            pregunta: "¿Cómo se homologa un vehículo importado?",
            respuesta:
              "Después de nacionalizarlo, se acredita ante el MTC que cumple el reglamento nacional de vehículos. Con ese resultado se inscribe en el registro vehicular y se obtienen las placas. Es parte del servicio de importación.",
          },
          {
            pregunta: "¿Un auto comprado en Miami entra sin arancel?",
            respuesta: `Solo si es nuevo, originario de Estados Unidos y llega con certificado de origen. En cualquier otro caso paga ${general}. Comprarlo en Miami no basta.`,
          },
        ]}
      />
      <IrACalculadora texto="Ver si mi auto puede entrar" />
    </GuiaLayout>
  );
}
