/**
 * 1 · Contrato de mandato con representación para la importación de un
 * vehículo. Veintiuna cláusulas, transcritas del paquete y adaptadas a las
 * decisiones del dueño del 27 nov 2026:
 *   · La unidad ya está elegida al firmar (el Anexo A va dentro del contrato).
 *   · Inspección SOLO si el vehículo es usado: la cláusula es condicional y en
 *     un nuevo el contrato no la menciona (MSO sin matricular y recalls).
 *   · El broker figura como Vendedor (recibe el precio completo) y el dealer
 *     emite la factura y el MSO a nombre del Mandante.
 *   · Cinco pagos en una tabla simple al principio (cláusula tercera, la misma
 *     del Anexo B, el Anexo D y los avisos): Pago 1 al firmar; Pago 2 al
 *     release (una transferencia: flete, seguro y la mitad de los honorarios);
 *     Pago 3 al arribo (gastos de aduana, reembolsables y compensados en el
 *     Pago 5); Pago 4 tributos directo a SUNAT; Pago 5 al levante. Nunca los
 *     códigos internos H1 a H6. Todo pago a LUXCARS va a Fondos de Clientes, y
 *     LUXCARS aplica de ahí cada factura de honorarios al emitirla.
 *   · Honorarios 50/50 (cláusula quinta) que incluyen la gestión registral
 *     (homologación, SUNARP, placas y tarjeta) y las comisiones bancarias, con
 *     autodetracción por defecto (5.3).
 *   · Una sola firma en notaría (contrato con anexos, LOA y poder para la
 *     inmatriculación) y un solo documento a la entrega (acta de entrega y
 *     rendición de cuentas).
 * La última oración del numeral 18.1 (aprobaciones por las acciones del
 * portal) es del 2026-11-25.
 */

import type { Campos } from "../../campos";
import { firmas, h2, lista, p, type Estructura } from "../estructura";
import { tablaCalendario } from "./calendario";
import type { Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  const usado = c.VEH_CONDICION.toLowerCase().startsWith("usado");
  return {
    titulo: "Contrato de mandato con representación para la importación de un vehículo",
    subtitulo: `**Expediente ${c.EXPEDIENTE}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p('Conste por el presente documento el contrato de mandato con representación para la importación de un vehículo (el "Contrato") que celebran:'),
      lista([
        `**LUX CARS IMPORT S.A.C.**, con RUC ${c.LUXCARS_RUC}, domicilio en ${c.LUXCARS_DOMICILIO}, inscrita en la partida ${c.LUXCARS_PARTIDA} del Registro de Personas Jurídicas de Lima, representada por su gerente general ${c.LUXCARS_REPRESENTANTE}, identificado con DNI ${c.LUXCARS_REP_DNI}, con poderes inscritos en la misma partida; en adelante, "LUXCARS" o "el Mandatario".`,
        `**${c.CLIENTE_RAZON_SOCIAL}**, con RUC ${c.CLIENTE_RUC}, domicilio en ${c.CLIENTE_DOMICILIO}, inscrita en la partida ${c.CLIENTE_PARTIDA} del Registro de Personas Jurídicas de Lima, representada por su ${c.CLIENTE_REP_CARGO} ${c.CLIENTE_REPRESENTANTE}, identificado con DNI ${c.CLIENTE_REP_DNI}, con poderes inscritos en la misma partida; en adelante, "el Mandante".`,
      ]),
      p("En los términos y condiciones siguientes:"),

      h2("Primera: Antecedentes"),
      p("1.1 LUXCARS se dedica a la intermediación y a la gestión de importaciones de vehículos por encargo de terceros."),
      p(`1.2 El Mandante desea adquirir en ${c.PAIS_ORIGEN} e importar al Perú, a su nombre, el vehículo ya identificado por las partes y descrito en el Anexo A (el "Vehículo"), cuyo precio consta en la pro forma emitida a nombre del Mandante por ${c.VENDEDOR_NOMBRE} (el "Vendedor"), y requiere que LUXCARS realice en su nombre y por su cuenta los actos necesarios para ello.`),

      h2("Segunda: Objeto"),
      p("2.1 El Mandante otorga a LUXCARS un mandato con representación, conforme a los artículos 1790 y 1806 del Código Civil, para que realice en su nombre, por su cuenta y en su interés los siguientes actos:"),
      lista([
        "a) Formalizar la compra de la unidad elegida por el Mandante y descrita en el Anexo A ante el Vendedor del exterior, de modo que la factura o bill of sale y el documento de propiedad (título o MSO) los emita el dealer a nombre del Mandante.",
        usado
          ? "b) Verificar antes del pago el historial (CarFax) y los gravámenes de la unidad e inspeccionarla, y entregar al Mandante el informe de inspección para su aprobación."
          : "b) Verificar antes del pago que la unidad tenga su MSO sin matricular y que no registre llamados a revisión pendientes según el VIN.",
        "c) Pagar al Vendedor el precio con los fondos que el Mandante provea conforme a la cláusula sexta.",
        "d) Contratar el traslado al puerto, la consolidación cuando corresponda, el flete internacional y el seguro de transporte, de modo que el documento de transporte designe al Mandante como consignatario y la póliza lo designe como asegurado.",
        "e) Coordinar las formalidades de exportación en origen.",
        "f) Designar al agente de aduana indicado en el Anexo A y coordinar con él la declaración aduanera de mercancías (DAM) a nombre del Mandante.",
        "g) Comunicar al Mandante la liquidación de los tributos de importación para que los pague directamente a SUNAT, y pagar por su cuenta, con los fondos que provea, los gastos de aduana, conforme a la cláusula octava.",
        "h) Gestionar la homologación o ficha técnica ante el MTC, la inmatriculación del Vehículo en el Registro de Propiedad Vehicular a nombre del Mandante con el poder especial que el Mandante otorga en el mismo acto, y la obtención de placas y tarjeta de identificación vehicular.",
        "i) Recibir, custodiar y entregar el Vehículo al Mandante.",
        "j) Rendir cuentas de todo lo anterior.",
      ]),
      p("2.2 LUXCARS actúa dentro de los límites de este Contrato y del Anexo A, en particular del precio tope autorizado y de los conceptos de gasto autorizados. Cualquier acto fuera de esos límites requiere la aprobación previa del Mandante por los medios de la cláusula décima octava."),

      h2("Tercera: Calendario de pagos"),
      p("3.1 El Mandante hace cinco pagos, en los momentos y por los montos de esta tabla. Todos los pagos a LUXCARS van a una sola cuenta, Fondos de Clientes; los tributos se pagan directo a SUNAT. Las demás cláusulas se remiten a esta tabla."),
      tablaCalendario(c, { usado }),
      p("3.2 Todos los pagos del Mandante a LUXCARS se realizan en la cuenta Fondos de Clientes indicada en el Anexo D. LUXCARS aplica de esos fondos el importe de cada factura de honorarios en la fecha de su emisión y destina el resto exclusivamente a los pagos por cuenta del Mandante."),
      p("3.3 El Pago 2 y el Pago 5 son una sola transferencia cada uno. El Pago 2 junta el flete, el seguro y la primera mitad de los honorarios. El Pago 5 es la segunda mitad de los honorarios, ajustada con el saldo de los gastos de aduana (numeral 8.5)."),
      p("3.4 Los montos de los Pagos 2, 3 y 4 son estimados según el Anexo B: el Pago 2 se ajusta con el flete real, el Pago 3 se fija con la pro forma del agente de aduana y el Pago 4 es la cifra exacta de la liquidación de SUNAT. El Pago 1 es el precio de la pro forma del Vendedor y solo cambia por el tipo de cambio (numeral 7.2). Las dos mitades de los honorarios son fijas, salvo el ajuste del numeral 8.5 en el Pago 5."),
      p("3.5 Para los Pagos 3, 4 y 5, LUXCARS envía antes un aviso escrito que dice qué pago es, el monto exacto, dónde pagar, la fecha límite y de dónde sale la cifra. El Vehículo se embarca una vez acreditado el Pago 2 y se entrega una vez acreditado el Pago 5. Si el Pago 5 no se acredita dentro de los cinco días hábiles siguientes al aviso de disponibilidad, se aplica la custodia de la cláusula décima tercera, sin perjuicio de los intereses de la cláusula décima quinta."),

      h2("Cuarta: Calidad de importador y propietario"),
      p("4.1 El Mandante es el comprador, el propietario y el importador del Vehículo. Adquiere la propiedad cuando el vendedor del exterior la transfiere a su nombre y figura como dueño o consignatario ante la Administración Aduanera."),
      p("4.2 LUXCARS no adquiere en ningún momento la propiedad ni la posesión a título propio del Vehículo ni de los fondos del Mandante; actúa en todo como mandatario. Los comprobantes de pago de terceros (dealer, Vendedor, transportista, aseguradora, agente de aduana, depósito temporal) se emiten a nombre del Mandante."),
      p("4.3 El IGV y el IPM pagados en la importación y la percepción del IGV corresponden al Mandante conforme a la legislación tributaria; su uso como crédito fiscal es de su exclusiva responsabilidad. LUXCARS no emite comprobante alguno por esos conceptos ni por el precio del Vehículo."),
      p("4.4 El Mandante otorga el mandato al agente de aduana designado, por mandato electrónico a través de SUNAT Operaciones en Línea o por endoso del documento de transporte, dentro de los dos días hábiles siguientes a la solicitud de LUXCARS. Los documentos de la inmatriculación los suscribe LUXCARS con el poder especial otorgado por el Mandante en la misma fecha de este Contrato."),

      h2("Quinta: Honorarios"),
      p(`5.1 Los honorarios de LUXCARS por todos los actos de la cláusula segunda ascienden a USD ${c.COMISION_TOTAL} (base imponible USD ${c.COMISION_BASE} más IGV USD ${c.COMISION_IGV}). El monto incluye el IGV.`),
      p(`5.2 Se pagan en dos mitades iguales de USD ${c.COMISION_MITAD} (50 % cada una), dentro del calendario de la cláusula tercera: la primera con el Pago 2, cuando el Vehículo queda listo para embarcar, y la segunda con el Pago 5, cuando la Administración Aduanera autoriza el levante. El Pago 5 se ajusta con el saldo de los gastos de aduana conforme al numeral 8.5. Por cada mitad LUXCARS emite factura electrónica con la glosa "Honorarios por servicio de intermediación e importación por mandato, vehículo VIN ${c.VEH_VIN}, expediente ${c.EXPEDIENTE}".`),
      p(`5.3 Las facturas a una empresa están sujetas al Sistema de Pago de Obligaciones Tributarias (detracción) del ${c.PORCENTAJE_DETRACCION} %. El Mandante paga siempre el importe completo de cada factura, dentro de su pago, en la cuenta Fondos de Clientes, y LUXCARS deposita la detracción en su propia cuenta de detracciones del Banco de la Nación dentro de los cinco días hábiles siguientes de recibido el pago y le envía la constancia del depósito. Si el Mandante prefiere detraer él mismo, deposita la detracción en esa cuenta, indicada en el Anexo D, la descuenta de su pago y envía la constancia a LUXCARS. Si el Mandante es una persona natural que recibe boleta de venta, no hay detracción. [CONFIRMAR con el contador el porcentaje aplicable antes del primer uso]`),
      p(
        `5.4 Los honorarios comprenden: la búsqueda y la verificación de la unidad (sin costo para el Mandante hasta su elección), la gestión integral de la operación, la gestión registral completa (homologación o ficha técnica ante el MTC, inscripción en la SUNARP, placas y tarjeta de identificación vehicular, con sus tasas y derechos), las comisiones bancarias de las transferencias al exterior (las que el banco debite de la cuenta Fondos de Clientes las repone LUXCARS el mismo día), el traslado en grúa dentro de Lima hasta la entrega y el tiempo de LUXCARS. No comprenden ningún pago a terceros: precio del Vehículo, ${usado ? "inspección del vehículo usado (Anexo B), " : ""}impuestos del país de origen, flete, seguro, tributos de importación, gastos de aduana (agente de aduana, almacenaje, visto bueno y grúa del puerto), SOAT, ni gastos extraordinarios (almacenaje o sobreestadía por demora del Mandante, reclamos a terceros, reexportación).`,
      ),
      p("5.5 Los honorarios se pagan en dólares americanos o, a elección del Mandante, en soles al tipo de cambio venta publicado por la SBS en la fecha de pago."),

      h2("Sexta: Fondos del Mandante y cuenta Fondos de Clientes"),
      p(`6.1 Todos los pagos del Mandante a LUXCARS (Pagos 1, 2, 3 y 5 de la cláusula tercera) se depositan en la cuenta denominada "Fondos de Clientes" indicada en el Anexo D, con el código ${c.EXPEDIENTE} y el número de pago en el concepto de la transferencia. LUXCARS no acepta efectivo ni transferencias desde cuentas que no sean del Mandante.`),
      p("6.2 Los fondos depositados pertenecen al Mandante. LUXCARS los registra en un libro individual por expediente, los aplica únicamente a los conceptos de este Contrato y de los Anexos A y B, no los destina a fines propios y no reconoce intereses sobre ellos. De esos fondos LUXCARS solo toma para sí el importe de cada factura de honorarios, en la fecha de su emisión (numeral 3.2), y lo muestra en el libro y en la rendición de cuentas."),
      p("6.3 Dentro de un día hábil de cada depósito acreditado, LUXCARS entrega al Mandante una constancia de recepción con el saldo del expediente."),
      p("6.4 LUXCARS ordena cada pago a terceros contra un documento emitido a nombre del Mandante (pro forma o factura del Vendedor, factura del transportista, póliza, factura del agente de aduana, del depósito temporal o de la grúa) y remite copia del comprobante de pago dentro de un día hábil de ejecutado. El precio del Vehículo se gira completo al Vendedor, que paga al dealer; la factura o bill of sale y el documento de propiedad los emite el dealer a nombre del Mandante."),
      p("6.5 El saldo no aplicado se devuelve al Mandante, a la cuenta desde la que depositó, dentro de los cinco días hábiles siguientes a la entrega del Vehículo, junto con la rendición de cuentas."),
      p("6.6 Los tributos de importación los paga el Mandante directamente a SUNAT (Pago 4, numeral 8.4). Si el Mandante prefiere que LUXCARS los pague por su cuenta, lo pide por escrito y deposita antes su importe en Fondos de Clientes. El Mandante puede también pagar directamente al Vendedor, previa coordinación con LUXCARS y entregando el comprobante; en ese caso el monto del pago correspondiente se reduce en lo pagado directamente."),
      p("6.7 Un depósito se considera acreditado cuando está disponible en la cuenta, no cuando está en tránsito. Ninguna obligación de LUXCARS frente a terceros nace antes de la acreditación del pago respectivo."),
      p("6.8 Si el banco debita de la cuenta Fondos de Clientes una comisión por la transferencia al exterior, LUXCARS la repone en la misma cuenta el mismo día (numeral 5.4); el saldo del Mandante no cambia y la rendición de cuentas muestra el cargo y la reposición."),

      h2("Séptima: Precio del Vehículo, moneda y tipo de cambio"),
      p(`7.1 El Mandante aprobó la unidad y su precio de ${c.MONEDA_COMPRA} ${c.PRECIO_COMPRA} según la pro forma del Vendedor, y autoriza la compra hasta el precio tope de ${c.MONEDA_COMPRA} ${c.PRECIO_TOPE}. Un precio mayor requiere su aprobación expresa.`),
      p(`7.2 El pago al Vendedor se realiza en la moneda que este exija (${c.MONEDA_COMPRA}). Si los fondos se depositan en dólares americanos y el pago se ejecuta en otra moneda, se aplica el tipo de cambio que el banco de LUXCARS ofrezca el día de la operación. LUXCARS informa el tipo de cambio aplicable antes de ejecutar. Si el saldo del expediente resulta insuficiente, el Mandante deposita la diferencia dentro de un día hábil; si resulta excedente, queda a su favor en el expediente.`),
      p("7.3 Los impuestos del país de origen que el Vendedor o el dealer no exoneren por tratarse de una venta para exportación son de cargo del Mandante y se informan antes del pago."),
      p("7.4 Las comisiones bancarias de la transferencia al Vendedor son de cargo de LUXCARS (numerales 5.4 y 6.8). Las que cobren el banco del Vendedor o los bancos intermediarios, si las hubiera, se incluyen en el monto a transferir."),

      h2("Octava: Tributos de importación y gastos de aduana"),
      p("8.1 Los tributos de importación (ad valorem, impuesto selectivo al consumo, IGV, IPM y percepción del IGV) y los gastos de aduana (agente de aduana, almacenaje en el depósito temporal, visto bueno y grúa del puerto) son de cargo del Mandante en su calidad de importador."),
      p("8.2 El Anexo B contiene una estimación en dólares americanos de esos conceptos, calculada con las tasas vigentes a la fecha de este Contrato y con valores estimados de flete y seguro. Es una estimación, no una liquidación."),
      p("8.3 La liquidación definitiva la determina la Administración Aduanera al numerar la DAM. El valor en aduana expresado en una moneda distinta al dólar americano se convierte con el factor de conversión monetaria que publica SUNAT vigente a la fecha de numeración. Los tributos se expresan en dólares americanos y se cancelan en soles al tipo de cambio venta publicado por la SBS vigente a la fecha de pago, conforme a la Ley General de Aduanas."),
      p("8.4 Los tributos de importación que liquide SUNAT, así como cualquier ajuste, diferencia, multa o reliquidación que la Administración Aduanera determine sobre la operación, son de cargo exclusivo del Mandante y serán asumidos por él. Numerada la DAM, LUXCARS le envía el aviso de pago con el número de liquidación y el monto exacto, y el Mandante los paga directamente a SUNAT, en soles, con su Clave SOL o en ventanilla bancaria, dentro de los dos días hábiles del aviso (Pago 4), y remite el comprobante por su cuenta en el portal de LUXCARS. Si el Mandante lo pide conforme al numeral 6.6, LUXCARS los paga por su cuenta con los fondos del expediente y, si no alcanzan, el Mandante completa la diferencia dentro de los dos días hábiles del aviso."),
      p("8.5 Al arribo del Vehículo, el Mandante deposita en Fondos de Clientes los gastos de aduana según la pro forma del agente de aduana (Pago 3). LUXCARS paga con ellos al agente de aduana, al depósito temporal y a la grúa del puerto contra facturas a nombre del Mandante y los rinde uno por uno. Es un gasto reembolsable: el sobrante se descuenta del Pago 5 y el faltante se suma a ese pago; si el sobrante supera la segunda mitad de los honorarios, la diferencia se devuelve con la rendición de cuentas."),
      p("8.6 Son también de cargo del Mandante el almacenaje o la sobreestadía generados por su demora en hacer un pago o en pagar los tributos, y las multas derivadas de datos proporcionados por el Mandante o por el Vendedor. LUXCARS asiste en la respuesta a cualquier requerimiento aduanero."),
      p("8.7 La percepción del IGV es un pago adelantado del impuesto a favor del Mandante y no un costo; su recuperación depende de la situación tributaria del Mandante. LUXCARS no garantiza su recuperación ni el tratamiento tributario o contable del Vehículo en los libros del Mandante."),
      p("8.8 Si el canal de control asignado por la Administración Aduanera implica reconocimiento físico, los gastos y la demora resultantes no son imputables a LUXCARS."),

      h2("Novena: Requisitos legales del Vehículo"),
      p("9.1 El Vehículo descrito en el Anexo A cumple, a la fecha de su firma, los requisitos para su importación al Perú: año modelo, kilometraje, timón original a la izquierda y tipo de combustible, según su condición de nuevo o usado."),
      p("9.2 El cumplimiento de la antigüedad y del kilometraje se verifica a la fecha de numeración de la DAM. LUXCARS planifica la operación para que la numeración ocurra dentro del plazo en que el Vehículo cumple. Si por demora imputable al Mandante (fondos, documentos, mandato al agente) el Vehículo deja de cumplir, los costos de reexportación, almacenaje o cualquier otro son de su cargo. Si la demora es imputable a LUXCARS, LUXCARS asume esos costos con el límite de la cláusula décima sexta."),
      p("9.3 Un vehículo registrado o matriculado previamente en el exterior es tratado como usado por la Administración Aduanera, con las tasas y requisitos correspondientes, aunque su kilometraje sea bajo. Las instrucciones de LUXCARS al Vendedor y al dealer exigen que una unidad nueva no se registre antes de la exportación y que el MSO se entregue sin matricular. Si pese a la instrucción la unidad se registra, LUXCARS informa al Mandante antes de continuar y las partes acuerdan por escrito si se prosigue con los nuevos costos o se desiste conforme a la cláusula décima quinta."),

      h2("Décima: Elección de la unidad y estado del Vehículo"),
      p(
        usado
          ? "10.1 El Mandante eligió la unidad descrita en el Anexo A y aprobó su precio con la información que LUXCARS le entregó antes de este Contrato: la pro forma del Vendedor a su nombre, el historial del vehículo (CarFax) y el informe de la inspección física."
          : "10.1 El Mandante eligió la unidad descrita en el Anexo A y aprobó su precio con la información que LUXCARS le entregó antes de este Contrato: la pro forma del Vendedor a su nombre y la constancia de que el vehículo tiene su MSO sin matricular y no registra llamados a revisión pendientes según el VIN.",
      ),
      ...(usado
        ? [p(`10.2 Si el Vehículo es usado, como en este caso, LUXCARS lo hizo inspeccionar por ${c.INSPECTOR} el ${c.FECHA_INSPECCION} y el Mandante aprobó el informe de inspección con la unidad. LUXCARS no responde por defectos no detectables en una inspección visual y de escaneo razonable.`)]
        : []),
      p(`10.${usado ? 3 : 2} La aprobación consta en la cuenta del Mandante en el portal de LUXCARS conforme a la cláusula décima octava. Pagado el Vendedor, LUXCARS no responde por fallas mecánicas o eléctricas posteriores ni por el desgaste propio del uso. El Vehículo se adquiere en el estado en que se encuentra, con las garantías que el fabricante o el dealer otorguen. LUXCARS gestiona por cuenta del Mandante cualquier reclamo frente al Vendedor, al dealer o al fabricante, sin garantizar su resultado.`),

      h2("Undécima: Transporte, modalidad de embarque y riesgo"),
      p(`11.1 La modalidad de embarque es la indicada en el Anexo A: ${c.MODALIDAD_EMBARQUE}.`),
      p("11.2 Embarque consolidado. Si el Anexo A indica embarque consolidado con otra unidad, se aplica lo siguiente:"),
      lista([
        `a) El flete (traslado al puerto y tramo marítimo) y los gastos del contenedor (consolidación, manipuleo portuario, documentación del contenedor y desconsolidación) se asignan al Vehículo en la proporción de ${c.PROPORCION_FLETE}. El seguro, el depósito temporal desde la desconsolidación, el agente de aduana y los tributos son propios del Vehículo.`,
        `b) El embarque se realiza cuando ambas unidades están en el almacén de consolidación. Si la otra unidad se retrasa o se retira, LUXCARS lo comunica al Mandante dentro de un día hábil y este elige por escrito entre esperar hasta ${c.DIAS_ESPERA_MAX} días calendario adicionales sin costo, o embarcar el Vehículo en contenedor exclusivo asumiendo el flete y los gastos completos. Esa demora no constituye incumplimiento de LUXCARS.`,
        "c) Si la demora en el embarque es imputable al Mandante, este asume el costo del cambio de reserva, el almacenaje de su Vehículo y los sobrecostos que la demora cause al otro embarque, que LUXCARS acredita con documentos.",
        "d) Los daños que una unidad cause a la otra dentro del contenedor se cubren con la póliza de la unidad afectada.",
      ]),
      p("11.3 Embarque exclusivo o Ro-Ro. Si el Anexo A indica contenedor exclusivo o Ro-Ro, el Vehículo asume el 100 % del flete y de los gastos de embarque."),
      p("11.4 El documento de transporte se emite nominativo, con el Mandante como consignatario y el agente de aduana como parte a notificar."),
      p("11.5 Riesgo. Desde que el dealer entrega el Vehículo al transportista, el riesgo de pérdida o daño es del Mandante como propietario y se cubre con la póliza contratada a su nombre por el 110 % del valor CIF, con cobertura todo riesgo, de almacén a almacén. LUXCARS gestiona el reclamo ante la aseguradora por cuenta del Mandante; los deducibles y las exclusiones de la póliza son de cargo del Mandante."),

      h2("Duodécima: Plazos"),
      p(`12.1 El plazo estimado desde la acreditación del Pago 1 hasta la entrega del Vehículo con placas es de ${c.SEMANAS_ESTIMADAS} semanas, con release estimado el ${c.FECHA_RELEASE}, zarpe estimado el ${c.FECHA_EST_EMBARQUE}, arribo estimado el ${c.FECHA_EST_ARRIBO} y entrega estimada el ${c.FECHA_EST_ENTREGA}.`),
      p("12.2 Los plazos son estimados. No son imputables a LUXCARS las demoras del Vendedor, del dealer, del transportista, de la naviera o de los puertos, de la Administración Aduanera (canal de control, reconocimiento físico, requerimientos), del MTC, de la SUNARP o de la entidad que fabrica las placas, las de fuerza mayor ni las causadas por el Mandante."),
      p("12.3 LUXCARS informa al Mandante el avance en cada etapa (compra, embarque, zarpe, arribo, numeración de la DAM, levante, inmatriculación, placas) y responde sus consultas dentro de un día hábil."),

      h2("Décima tercera: Obligaciones del Mandante"),
      lista([
        "a) Hacer cada pago de la cláusula tercera en la oportunidad pactada y pagar los tributos directamente a SUNAT dentro del plazo del numeral 8.4.",
        "b) Entregar información y documentos veraces y vigentes: vigencia de poder, DNI del representante, ficha RUC, declaración de origen de fondos (Anexo C) y los que requiera la Administración Aduanera.",
        "c) Otorgar el mandato al agente de aduana (numeral 4.4) y mantener vigente el poder especial para la inmatriculación otorgado a LUXCARS; si la SUNARP exigiera la firma directa del propietario en algún documento, firmarlo dentro de los dos días hábiles de ser requerido.",
        `d) Recibir el Vehículo dentro de los cinco días hábiles siguientes al aviso de disponibilidad. Vencido ese plazo, el Vehículo queda en custodia a razón de USD ${c.TARIFA_CUSTODIA} por día calendario, pagaderos antes de la entrega.`,
        "e) Contratar el SOAT y el seguro vehicular desde la asignación de placas.",
        "f) Cumplir sus obligaciones tributarias como importador.",
        "g) No impartir instrucciones directas al Vendedor, al dealer, al transportista, al agente de aduana ni a otros terceros designados por LUXCARS sin coordinar previamente con LUXCARS.",
        "h) Mantener la confidencialidad de las condiciones comerciales de este Contrato.",
      ]),

      h2("Décima cuarta: Obligaciones de LUXCARS"),
      lista([
        "a) Actuar con la diligencia de un ordenado comerciante y dentro de los límites del mandato.",
        "b) Aplicar los fondos del Mandante únicamente a los fines de este Contrato, llevar el libro del expediente y conservar la documentación durante cinco años.",
        "c) Informar el avance en cada etapa y toda circunstancia que afecte el plazo, el costo o la viabilidad de la operación, dentro de un día hábil de conocida.",
        "d) Entregar las constancias de recepción de fondos, los comprobantes de pago a terceros, los avisos de los Pagos 3 (gastos de aduana), 4 (tributos) y 5 (honorarios netos del saldo de aduana) y las constancias de las detracciones que deposite.",
        "e) Rendir cuentas al término del mandato conforme al artículo 1793 del Código Civil, con el acta de entrega y rendición de cuentas y la carpeta de documentos de la cláusula vigésima.",
        "f) Guardar reserva sobre la información del Mandante y usar sus datos personales solo para este Contrato.",
        "g) Mantener vigentes su RUC, sus poderes y su inscripción como sujeto obligado ante la UIF-Perú.",
      ]),

      h2("Décima quinta: Desistimiento, incumplimiento y resolución"),
      p(
        usado
          ? `15.1 Desistimiento antes del pago al Vendedor. El Mandante puede desistir sin expresión de causa comunicándolo por escrito antes de que LUXCARS gire el precio al Vendedor. En ese caso LUXCARS devuelve el Pago 1 que estuviera acreditado dentro de cinco días hábiles, menos el costo de la inspección del vehículo usado ya realizada (USD ${c.COSTO_INSPECCION}), y no se devenga honorario alguno.`
          : "15.1 Desistimiento antes del pago al Vendedor. El Mandante puede desistir sin expresión de causa comunicándolo por escrito antes de que LUXCARS gire el precio al Vendedor. En ese caso LUXCARS devuelve íntegro el Pago 1 que estuviera acreditado dentro de cinco días hábiles y no se devenga honorario alguno: la búsqueda y la verificación previas no tienen costo para el Mandante.",
      ),
      p("15.2 Desistimiento después del pago al Vendedor. El Vehículo es del Mandante y no cabe desistimiento frente a LUXCARS. Si el Mandante decide no continuar, puede instruir a LUXCARS la reventa o la reexportación por cuenta y costo del Mandante, con honorarios adicionales por acordar. En ese caso se devengan los honorarios de este Contrato en la siguiente proporción: 50 % si la decisión se comunica antes del embarque y 100 % después del embarque. La mitad de los honorarios ya pagada con el Pago 2 se imputa a ese monto."),
      p("15.3 Resolución por LUXCARS. LUXCARS puede resolver el Contrato mediante comunicación escrita si el Mandante: no hace un pago de la cláusula tercera o no paga los tributos dentro de los diez días hábiles siguientes al requerimiento; entrega información falsa o incompleta en el Anexo C, o se niega a ampliar la información que la normativa de prevención de lavado de activos exija; o impide con sus actos u omisiones que el Vehículo cumpla los requisitos de importación. Resuelto el Contrato, el Vehículo queda a disposición del Mandante en el lugar en que se encuentre, con los costos de almacenaje, gestión y entrega de documentos de su cargo, y LUXCARS devuelve los fondos no aplicados, deducidos los honorarios devengados conforme al numeral 15.2 y los gastos acreditados."),
      p("15.4 Resolución por el Mandante. El Mandante puede resolver el Contrato si LUXCARS: aplica los fondos a fines distintos de este Contrato; no paga al Vendedor dentro de los tres días hábiles siguientes a la acreditación del Pago 1, sin causa justificada; o no rinde cuentas ni informa pese a requerimiento escrito. Lo comunica por escrito dando cinco días hábiles para subsanar, salvo en el primer caso, en que la resolución es inmediata. Resuelto el Contrato, LUXCARS devuelve los fondos no aplicados y los honorarios no devengados dentro de cinco días hábiles y entrega toda la documentación del expediente."),
      p("15.5 Intereses. Toda suma que el Mandante no pague en la oportunidad pactada devenga el interés moratorio máximo permitido por ley desde el vencimiento hasta el pago."),

      h2("Décima sexta: Responsabilidad"),
      p("16.1 LUXCARS responde por la correcta aplicación de los fondos del Mandante sin límite de monto."),
      p("16.2 Por los demás conceptos, LUXCARS responde por dolo y culpa inexcusable conforme al artículo 1328 del Código Civil y, en los casos de culpa leve, hasta el monto de los honorarios de este Contrato."),
      p("16.3 LUXCARS no responde por los actos u omisiones del Vendedor, del dealer, del transportista, de la aseguradora, del agente de aduana, de la Administración Aduanera, del MTC ni de la SUNARP cuando ha actuado con la diligencia debida en su selección y coordinación; por las variaciones del tipo de cambio o de las tasas tributarias; por los ajustes de valor en aduana; ni por el lucro cesante o los daños indirectos del Mandante."),

      h2("Décima séptima: Prevención de lavado de activos y protección de datos"),
      p("17.1 El Mandante declara que los fondos que destina a esta operación tienen origen lícito conforme al Anexo C y se obliga a entregar la información y documentación adicional que LUXCARS le requiera en cumplimiento de la normativa de prevención del lavado de activos y del financiamiento del terrorismo. LUXCARS es sujeto obligado ante la UIF-Perú, registra las operaciones y, cuando la ley lo exige, las reporta, sin que ello constituya incumplimiento de su deber de reserva."),
      p("17.2 Los datos personales de los representantes y beneficiarios finales se tratan conforme a la Ley 29733 únicamente para la ejecución de este Contrato y el cumplimiento de obligaciones legales, y se conservan por el plazo que la ley exige."),

      h2("Décima octava: Comunicaciones"),
      p(`18.1 Son válidas las comunicaciones por correo electrónico y por mensajería (WhatsApp) a las direcciones y números siguientes: ${c.LUXCARS_CORREO} y ${c.LUXCARS_TELEFONO} por LUXCARS; ${c.CLIENTE_CORREO} y ${c.CLIENTE_TELEFONO} por el Mandante. Por esos medios se entienden válidamente dadas la aprobación de la unidad${usado ? ", del informe de inspección" : ""} y del precio, y la elección prevista en el numeral 11.2.b. También son válidas las aprobaciones y elecciones realizadas por el Mandante mediante las acciones de su cuenta en el portal de LUXCARS, que quedan registradas con fecha, hora y usuario.`),
      p("18.2 Las cuentas bancarias de LUXCARS son únicamente las del Anexo D. Un cambio de cuenta solo es válido mediante documento firmado por el representante de LUXCARS y confirmación telefónica del Mandante al número indicado en 18.1. El Mandante no debe atender instrucciones de pago recibidas por otros medios."),
      p("18.3 Los cambios de domicilio, correo o teléfono se comunican por escrito y surten efecto al día hábil siguiente."),

      h2("Décima novena: Subcontratación y cesión"),
      p(`19.1 LUXCARS puede valerse de brokers, ${usado ? "inspectores, " : ""}transportistas, forwarders, agentes de aduana, gestores y notarías para ejecutar el mandato, bajo su coordinación y con la responsabilidad de la cláusula décima sexta.`),
      p("19.2 Ninguna de las partes puede ceder su posición contractual sin consentimiento escrito de la otra."),

      h2("Vigésima: Entrega, carpeta de documentos y rendición de cuentas"),
      p(`20.1 LUXCARS entrega el Vehículo con placas mediante un único documento, el acta de entrega y rendición de cuentas, que ambas partes firman con firma simple con el Vehículo a la vista, en ${c.CIUDAD_FIRMA}, en el lugar que las partes coordinen.`),
      p(`20.2 Con la entrega, LUXCARS entrega al Mandante la carpeta del expediente: pro forma y factura o bill of sale del exterior y documento de propiedad (título o MSO); comprobante del pago al Vendedor; ${usado ? "historial del vehículo e informe de inspección" : "constancia del MSO sin matricular y de la consulta de recalls"}; documento de transporte, lista de empaque y acta de carga; póliza de seguro; DAM con levante, liquidación y comprobantes de pago de tributos; facturas de terceros a nombre del Mandante; constancia de homologación o ficha técnica; tarjeta de identificación vehicular y placas; facturas de honorarios y constancias de detracción; y el acta de entrega y rendición de cuentas con los gastos de aduana compensados en el Pago 5, el saldo del expediente y el comprobante de devolución.`),
      p("20.3 El Mandante da su conformidad a la rendición de cuentas al firmar el acta o mediante la acción correspondiente en su cuenta del portal de LUXCARS. La conformidad se presume si no la observa por escrito dentro de los diez días hábiles siguientes a la entrega."),

      h2("Vigésima primera: Disposiciones generales"),
      p("21.1 Los Anexos A, B, C y D forman parte integrante de este Contrato y se firman con él en un solo acto, foliados y con el código del expediente en cada página. En caso de discrepancia prevalece el Contrato, luego el Anexo A y luego el Anexo B. En la misma fecha el Mandante otorga la carta de autorización en inglés (Letter of Authorization) y el poder especial para la inmatriculación, que se legalizan ante el mismo notario."),
      p("21.2 Toda modificación se hace por escrito firmado por ambas partes, salvo las aprobaciones y elecciones que este Contrato permite por los medios de la cláusula décima octava. El cambio de la unidad o del precio tope se formaliza con un nuevo Anexo A firmado por ambas partes."),
      p("21.3 El mandato rige desde la firma hasta la aprobación de la rendición de cuentas. Subsisten después las obligaciones de confidencialidad, conservación de documentos y pago de sumas pendientes."),
      p("21.4 Este Contrato se rige por las leyes de la República del Perú. Las partes procuran resolver sus diferencias en trato directo durante quince días hábiles desde la comunicación escrita de una de ellas; de no lograrlo, se someten a la competencia de los jueces y tribunales del distrito judicial de Lima, con renuncia al fuero de sus domicilios."),
      p("21.5 Las partes señalan como domicilios los indicados en la introducción."),

      p(`Firmado en dos ejemplares de igual valor, con sus Anexos A, B, C y D, en ${c.CIUDAD_FIRMA}, el ${c.FECHA_FIRMA}.`),
      firmas(
        ["LUX CARS IMPORT S.A.C.", c.LUXCARS_REPRESENTANTE, `Gerente general, DNI ${c.LUXCARS_REP_DNI}`, "Firma legalizada ante notario"],
        [c.CLIENTE_RAZON_SOCIAL, c.CLIENTE_REPRESENTANTE, `${c.CLIENTE_REP_CARGO}, DNI ${c.CLIENTE_REP_DNI}`, "Firma legalizada ante notario"],
      ),
    ],
  };
}

export const contrato: Plantilla = {
  tipo: "contrato",
  version: "contrato@2026-11-27d",
  nombre: "Contrato de mandato",
  idioma: "es",
  tarea: "luxcars.generar_contrato",
  seFirma: true,
  construir,
};
