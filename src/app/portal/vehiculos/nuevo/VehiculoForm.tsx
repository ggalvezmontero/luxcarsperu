"use client";

/**
 * Alta de vehículo. El VIN es el protagonista de esta pantalla.
 *
 * LA IDEA: pegar 17 caracteres y que la ficha técnica se llene sola contra
 * NHTSA vPIC (marca, modelo, año, carrocería, cilindrada, combustible y país de
 * ensamblaje). Lo que queda a mano es lo que ninguna API puede saber:
 * kilometraje real, precios, ubicación y notas. Cuatro minutos por auto.
 *
 * Esa es la alternativa legal a un pipeline de scraping: el inventario de
 * MarketCheck, Auto.dev, eBay, Autotrader, CarGurus, Cars.com, TrueCar,
 * AutoTempest y Facebook Marketplace NO se puede almacenar — sus contratos lo
 * prohíben textualmente. vPIC sí, porque es del gobierno de EE.UU., devuelve
 * ficha técnica y no inventario, y no tiene cláusula que lo impida.
 *
 * DÓNDE GUARDA: en Supabase, desde el navegador, con la sesión del equipo
 * (`usePortalSession()`). No hay Server Action ni `service_role`: una acción de
 * servidor sin autenticar sería un endpoint público capaz de insertar en el
 * inventario del dueño, y `service_role` salta RLS. Acá el candado es Postgres
 * — sin sesión, el INSERT se rechaza. Ver `src/app/portal/layout.tsx`.
 *
 * REGLAS DE COMPORTAMIENTO DEL AUTOCOMPLETADO
 * · Nunca pisa lo que el usuario escribió a mano. Solo rellena lo vacío o lo
 *   que puso el propio decodificador (se marca con la etiqueta "VIN").
 * · Nunca bloquea. Si vPIC está caído o el VIN no existe, se escribe todo a
 *   mano y el auto se guarda igual.
 * · La categoría llega como SUGERENCIA y queda editable: de ella depende el
 *   ISC, y equivocarse ahí cambia el precio final del vehículo.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import {
  usePortalSession,
  type PortalSessionStatus,
} from "@/components/portal/portalSession";
import { insertarVehiculo } from "../consultas";
import { validarVehiculo, type ErroresCampo } from "./validacion";
import { getPortalAuthMissingEnv } from "@/lib/portal/supabaseBrowser";
import {
  CATEGORIA_LABEL,
  CONDICION_LABEL,
  ESTADO_LABEL,
  ESTADO_OPCIONES,
  FUENTE_LABEL,
  FUENTE_OPCIONES,
  MONEDA_OPCIONES,
} from "../etiquetas";
import {
  normalizeVin,
  validateVin,
  vinCheckDigitMatches,
  VIN_LENGTH,
  type VinDecoded,
  type VinLookupResponse,
} from "@/lib/vin";
import { checkAdmissibility } from "@/core/pricing/priceCalculator";
import { IMPORT_COMPLIANCE_REFERENCE } from "@/lib/db/types";
import type { VehicleCategoryId, VehicleCondition } from "@/lib/db/types";

/* -------------------------------------------------------------------------- */
/* Estado del formulario                                                      */
/* -------------------------------------------------------------------------- */

/** Campos que el decodificador de VIN puede rellenar. */
type CampoVin =
  | "marca"
  | "modelo"
  | "version"
  | "anio"
  | "carroceria"
  | "cilindrada_cc"
  | "transmision"
  | "traccion"
  | "puertas"
  | "categoria"
  | "notas_internas";

const VALORES_INICIALES = {
  vin: "",
  placa: "",
  marca: "",
  modelo: "",
  version: "",
  anio: "",
  carroceria: "",
  categoria: "gasolina",
  condicion: "usado",
  cilindrada_cc: "",
  transmision: "",
  traccion: "",
  color_exterior: "",
  color_interior: "",
  puertas: "",
  asientos: "",
  kilometraje_km: "",
  precio_compra: "",
  moneda_compra: "USD",
  fecha_compra: "",
  precio_venta: "",
  moneda_venta: "USD",
  estado: "disponible",
  vendido_en: "",
  ubicacion: "",
  fuente: "carga_manual",
  fuente_referencia: "",
  titular: "",
  slug: "",
  descripcion: "",
  destacados: "",
  notas_internas: "",
};

type Campos = typeof VALORES_INICIALES;
type NombreCampo = keyof Campos;

/**
 * Valor de cada campo + qué campos puso el decodificador y siguen intactos.
 * Van juntos en un solo estado para que nunca puedan discrepar.
 */
type EstadoForm = {
  valores: Campos;
  deVin: Partial<Record<CampoVin, boolean>>;
};

/** Resultado del último intento de guardado. */
type EstadoEnvio =
  | { fase: "inicial" }
  | { fase: "guardando" }
  | { fase: "invalido"; mensaje: string; errores: ErroresCampo }
  /** Validó bien pero no había dónde guardarlo: se devuelve el borrador. */
  | { fase: "sin-guardar"; mensaje: string; borrador: string }
  | { fase: "error"; mensaje: string }
  | {
      fase: "ok";
      id: string;
      titulo: string;
      slug: string | null;
      publicado: boolean;
    };

type EstadoVin =
  | { fase: "vacio" }
  | { fase: "escribiendo"; faltan: number }
  | { fase: "listo" }
  | { fase: "consultando" }
  | { fase: "error"; mensaje: string }
  | { fase: "decodificado"; datos: VinDecoded; avisos: string[] };

/* -------------------------------------------------------------------------- */

export function VehiculoForm({ anioActual }: { anioActual: number }) {
  /**
   * La sesión del equipo es la que guarda. NO se usa `service_role` desde el
   * servidor: esa llave salta RLS, y una acción de servidor sin autenticar
   * sería un endpoint público capaz de insertar en el inventario del dueño.
   * Acá el candado es Postgres — sin sesión, el INSERT se rechaza.
   */
  const { status: sesion, client } = usePortalSession();
  const [envio, setEnvio] = useState<EstadoEnvio>({ fase: "inicial" });

  /**
   * Valores y procedencia viven en UN SOLO estado.
   *
   * Si fueran dos, se desincronizarían: la respuesta de NHTSA llega uno o dos
   * renders después de que el usuario terminó de pegar el VIN, y decidir qué
   * campo se puede pisar exige mirar el valor y su procedencia en el MISMO
   * instante. Con un único `setForm` funcional, ambas cosas se calculan sobre
   * datos frescos y no hay forma de que discrepen.
   */
  const [form, setForm] = useState<EstadoForm>({
    valores: VALORES_INICIALES,
    deVin: {},
  });
  const { valores, deVin } = form;

  const [negociable, setNegociable] = useState(true);
  const [publicado, setPublicado] = useState(false);
  const [vinEstado, setVinEstado] = useState<EstadoVin>({ fase: "vacio" });
  /**
   * Id del alta cuyo panel de éxito ya se cerró ("Cargar otro"). Se guarda el
   * id y no un booleano para no necesitar un efecto que lo reinicie: el panel
   * del alta siguiente aparece solo, porque su id todavía no está descartado.
   */
  const [exitoDescartado, setExitoDescartado] = useState<string | null>(null);

  /** Evita decodificar dos veces el mismo VIN al volver a enfocar el campo. */
  const ultimoConsultado = useRef<string>("");

  const errores: ErroresCampo =
    envio.fase === "invalido" ? envio.errores : {};

  const puedeGuardar = sesion === "autenticado" && client !== null;

  /* --- Envío -------------------------------------------------------------- */

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    // `FormData` se extrae ANTES de cualquier await: después del primero,
    // `currentTarget` ya viene en null.
    const datos = new FormData(evento.currentTarget);

    const validacion = validarVehiculo(datos);
    if (!validacion.ok) {
      setEnvio({
        fase: "invalido",
        mensaje: validacion.mensaje,
        errores: validacion.errores,
      });
      return;
    }

    if (!puedeGuardar || !client) {
      // El formulario funcionó completo; simplemente no hay dónde escribir.
      // Se devuelve la ficha en JSON para no perder los cuatro minutos.
      setEnvio({
        fase: "sin-guardar",
        mensaje:
          sesion === "sin-configurar"
            ? "No hay base de datos conectada, así que el vehículo NO se guardó."
            : "No hay una sesión del equipo activa, así que el vehículo NO se guardó. Inicia sesión y vuelve a enviar: los datos siguen en el formulario.",
        borrador: JSON.stringify(validacion.fila, null, 2),
      });
      return;
    }

    setEnvio({ fase: "guardando" });
    const resultado = await insertarVehiculo(client, validacion.fila);

    if (!resultado.ok) {
      if (resultado.motivo === "duplicado") {
        setEnvio({
          fase: "invalido",
          mensaje: resultado.mensaje,
          errores: { vin: resultado.mensaje },
        });
        return;
      }
      setEnvio({ fase: "error", mensaje: resultado.mensaje });
      return;
    }

    setEnvio({
      fase: "ok",
      id: resultado.id,
      titulo: validacion.titulo,
      slug: resultado.slug,
      publicado: validacion.publicado,
    });
  }

  function setCampo(nombre: NombreCampo, valor: string) {
    // A partir de este momento el campo es del usuario: el decodificador ya no
    // lo toca y la etiqueta "VIN" desaparece.
    setForm((previo) => ({
      valores: { ...previo.valores, [nombre]: valor },
      deVin: { ...previo.deVin, [nombre]: false },
    }));
  }

  /* --- Decodificación ---------------------------------------------------- */

  async function decodificar(vinCrudo: string) {
    const validacion = validateVin(vinCrudo);
    if (!validacion.valid) {
      setVinEstado({ fase: "error", mensaje: validacion.reason });
      return;
    }

    ultimoConsultado.current = validacion.vin;
    setVinEstado({ fase: "consultando" });

    let respuesta: VinLookupResponse;
    try {
      const peticion = await fetch(`/api/vin/${validacion.vin}`, {
        headers: { accept: "application/json" },
      });
      respuesta = (await peticion.json()) as VinLookupResponse;
    } catch {
      setVinEstado({
        fase: "error",
        mensaje:
          "No se pudo consultar NHTSA. Revisa la conexión o escribe los datos a mano: el auto se guarda igual.",
      });
      return;
    }

    if (!respuesta.ok) {
      setVinEstado({ fase: "error", mensaje: respuesta.error });
      return;
    }

    aplicarDecodificado(respuesta.data);
    setVinEstado({
      fase: "decodificado",
      datos: respuesta.data,
      avisos: respuesta.notices,
    });
  }

  function aplicarDecodificado(datos: VinDecoded) {
    const propuesta: Partial<Record<CampoVin, string>> = {
      marca: datos.brand ?? "",
      modelo: datos.model ?? "",
      version: datos.trim ?? "",
      anio: datos.year ? String(datos.year) : "",
      carroceria: datos.bodyStyle ?? "",
      cilindrada_cc: datos.engineCc ? String(datos.engineCc) : "",
      transmision: datos.transmission ?? "",
      traccion: datos.drivetrain ?? "",
      puertas: datos.doors ? String(datos.doors) : "",
      categoria: datos.suggestedCategory ?? "",
      notas_internas: resumenTecnico(datos),
    };

    // Actualización funcional: `decodificar()` resuelve uno o dos renders
    // después de que el usuario terminó de pegar el VIN, y partir de un `form`
    // viejo borraría lo que escribió mientras tanto.
    setForm((previo) => {
      const valoresSiguientes = { ...previo.valores };
      const deVinSiguiente = { ...previo.deVin };

      for (const [nombre, valor] of Object.entries(propuesta) as [
        CampoVin,
        string,
      ][]) {
        if (!valor) continue;
        const actual = previo.valores[nombre];
        // Solo se rellena lo vacío o lo que había puesto el decodificador.
        if (actual.trim() === "" || previo.deVin[nombre]) {
          valoresSiguientes[nombre] = valor;
          deVinSiguiente[nombre] = true;
        }
      }

      return { valores: valoresSiguientes, deVin: deVinSiguiente };
    });
  }

  function alCambiarVin(valor: string) {
    const vin = normalizeVin(valor).slice(0, VIN_LENGTH);
    setForm((previo) => ({
      ...previo,
      valores: { ...previo.valores, vin },
    }));

    if (!vin) {
      setVinEstado({ fase: "vacio" });
      return;
    }
    if (vin.length < VIN_LENGTH) {
      setVinEstado({ fase: "escribiendo", faltan: VIN_LENGTH - vin.length });
      return;
    }

    const validacion = validateVin(vin);
    if (!validacion.valid) {
      setVinEstado({ fase: "error", mensaje: validacion.reason });
      return;
    }

    setVinEstado({ fase: "listo" });
    // 17 caracteres válidos: se consulta sola. Pegar el VIN es todo el trabajo.
    if (ultimoConsultado.current !== vin) void decodificar(vin);
  }

  function limpiarTodo() {
    setForm({ valores: VALORES_INICIALES, deVin: {} });
    setVinEstado({ fase: "vacio" });
    setNegociable(true);
    setPublicado(false);
    setEnvio({ fase: "inicial" });
    ultimoConsultado.current = "";
  }

  /* --- Avisos normativos -------------------------------------------------- */

  const admisibilidad = checkAdmissibility({
    vehicleType: valores.categoria as VehicleCategoryId,
    condition: valores.condicion as VehicleCondition,
    year: valores.anio,
    currentYear: anioActual,
  });

  const kmNumero = Number(valores.kilometraje_km.replace(/[\s,]/g, ""));
  const excedeKm =
    valores.condicion === "usado" &&
    Number.isFinite(kmNumero) &&
    kmNumero > IMPORT_COMPLIANCE_REFERENCE.maxMileageKm.M1;

  const avisosModelo = avisosDeModelo(valores.marca, valores.modelo);

  const vinValidado = validateVin(valores.vin);
  const digitoSospechoso =
    vinValidado.valid && !vinCheckDigitMatches(vinValidado.vin);

  /* --- Éxito -------------------------------------------------------------- */

  if (envio.fase === "ok" && exitoDescartado !== envio.id) {
    const alta = envio;
    return (
      <PanelExito
        titulo={alta.titulo}
        slug={alta.slug}
        publicado={alta.publicado}
        onOtro={() => {
          setExitoDescartado(alta.id);
          limpiarTodo();
        }}
      />
    );
  }

  /* --- Formulario --------------------------------------------------------- */

  return (
    <form onSubmit={alEnviar} noValidate className="mt-10 flex flex-col gap-10">
      {!puedeGuardar && sesion !== "verificando" ? (
        <AvisoNoSeGuarda sesion={sesion} />
      ) : null}

      {envio.fase === "invalido" ? (
        <Alerta tono="danger" titulo="Revisa el formulario">
          {envio.mensaje}
        </Alerta>
      ) : null}

      {envio.fase === "error" ? (
        <Alerta tono="danger" titulo="No se pudo guardar">
          {envio.mensaje}
        </Alerta>
      ) : null}

      {envio.fase === "sin-guardar" ? (
        <BorradorNoGuardado mensaje={envio.mensaje} borrador={envio.borrador} />
      ) : null}

      {/* ==================== VIN: el protagonista ==================== */}
      <section className="rounded-lux-lg border border-line-strong bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-ink">
              Empieza por el VIN
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
              Pega los 17 caracteres y la ficha técnica se completa sola desde
              NHTSA, la agencia de transporte de EE.UU. Si el auto no tiene VIN
              a mano, salta este paso y escribe los datos abajo.
            </p>
          </div>
          <span className="rounded-full border border-line px-3 py-1 font-mono text-xs text-ink-3 tabular-nums">
            {valores.vin.length}/{VIN_LENGTH}
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="vin" className="sr-only">
              VIN
            </label>
            <input
              id="vin"
              name="vin"
              value={valores.vin}
              onChange={(evento) => alCambiarVin(evento.target.value)}
              placeholder="WZ1DB4C09PW123456"
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="characters"
              inputMode="text"
              maxLength={VIN_LENGTH}
              aria-describedby="vin-ayuda"
              aria-invalid={vinEstado.fase === "error" || Boolean(errores.vin)}
              className="h-14 w-full rounded-lux border border-line bg-surface-2 px-4 font-mono text-lg uppercase tracking-[0.18em] text-ink transition-colors placeholder:text-ink-4 placeholder:tracking-[0.18em] hover:border-line-strong focus:border-silver"
            />
          </div>
          <button
            type="button"
            onClick={() => void decodificar(valores.vin)}
            disabled={!vinValidado.valid || vinEstado.fase === "consultando"}
            className="h-14 shrink-0 rounded-lux border border-line-strong px-6 text-xs uppercase tracking-[0.16em] text-ink transition-colors hover:border-silver hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40"
          >
            {vinEstado.fase === "consultando" ? "Consultando…" : "Decodificar"}
          </button>
        </div>

        <p id="vin-ayuda" className="mt-3 text-xs leading-relaxed text-ink-4">
          17 caracteres. El VIN no usa las letras I, O ni Q: si las ves, son 1 y 0.
        </p>

        <EstadoDelVin
          estado={vinEstado}
          errorServidor={errores.vin}
          digitoSospechoso={digitoSospechoso}
        />
      </section>

      {/* ==================== Identificación ==================== */}
      <Bloque
        titulo="Identificación"
        descripcion="Lo que define al vehículo. Con VIN decodificado, esto ya viene lleno."
      >
        <Campo
          nombre="marca"
          etiqueta="Marca"
          requerido
          valor={valores.marca}
          onChange={setCampo}
          error={errores.marca}
          deVin={deVin.marca}
          placeholder="Toyota"
        />
        <Campo
          nombre="modelo"
          etiqueta="Modelo"
          requerido
          valor={valores.modelo}
          onChange={setCampo}
          error={errores.modelo}
          deVin={deVin.modelo}
          placeholder="GR Supra"
        />
        <Campo
          nombre="version"
          etiqueta="Versión / edición"
          valor={valores.version}
          onChange={setCampo}
          deVin={deVin.version}
          placeholder="MkV Final Edition"
        />
        <Campo
          nombre="anio"
          etiqueta="Año modelo"
          requerido
          tipo="number"
          valor={valores.anio}
          onChange={setCampo}
          error={errores.anio}
          deVin={deVin.anio}
          placeholder={String(anioActual)}
        />
        <Campo
          nombre="carroceria"
          etiqueta="Carrocería"
          valor={valores.carroceria}
          onChange={setCampo}
          deVin={deVin.carroceria}
          placeholder="Coupé"
        />
        <Campo
          nombre="placa"
          etiqueta="Placa"
          valor={valores.placa}
          onChange={setCampo}
          placeholder="ABC-123"
          ayuda="Solo si el auto ya está matriculado en Perú."
        />
      </Bloque>

      {/* ==================== Ficha técnica ==================== */}
      <Bloque
        titulo="Ficha técnica"
        descripcion="La categoría decide el ISC. Revísala aunque venga sugerida: un mild-hybrid de 48V tributa como gasolina, no como híbrido."
      >
        <CampoSelect
          nombre="categoria"
          etiqueta="Categoría (motor)"
          valor={valores.categoria}
          onChange={setCampo}
          deVin={deVin.categoria}
          opciones={Object.entries(CATEGORIA_LABEL).map(([valor, texto]) => ({
            valor,
            texto,
          }))}
        />
        <CampoSelect
          nombre="condicion"
          etiqueta="Condición"
          valor={valores.condicion}
          onChange={setCampo}
          opciones={Object.entries(CONDICION_LABEL).map(([valor, texto]) => ({
            valor,
            texto,
          }))}
        />
        <Campo
          nombre="cilindrada_cc"
          etiqueta="Cilindrada (cc)"
          tipo="number"
          valor={valores.cilindrada_cc}
          onChange={setCampo}
          error={errores.cilindrada_cc}
          deVin={deVin.cilindrada_cc}
          placeholder="2998"
        />
        <Campo
          nombre="kilometraje_km"
          etiqueta="Kilometraje (km)"
          tipo="number"
          valor={valores.kilometraje_km}
          onChange={setCampo}
          error={errores.kilometraje_km}
          placeholder="0"
          ayuda="Dato que ninguna API sabe: sale del odómetro o del reporte."
        />
        <Campo
          nombre="transmision"
          etiqueta="Transmisión"
          valor={valores.transmision}
          onChange={setCampo}
          deVin={deVin.transmision}
          placeholder="Automática · 8"
        />
        <Campo
          nombre="traccion"
          etiqueta="Tracción"
          valor={valores.traccion}
          onChange={setCampo}
          deVin={deVin.traccion}
          placeholder="RWD"
        />
        <Campo
          nombre="color_exterior"
          etiqueta="Color exterior"
          valor={valores.color_exterior}
          onChange={setCampo}
          placeholder="Blanco perlado"
        />
        <Campo
          nombre="color_interior"
          etiqueta="Color interior"
          valor={valores.color_interior}
          onChange={setCampo}
          placeholder="Negro"
        />
        <Campo
          nombre="puertas"
          etiqueta="Puertas"
          tipo="number"
          valor={valores.puertas}
          onChange={setCampo}
          error={errores.puertas}
          deVin={deVin.puertas}
        />
        <Campo
          nombre="asientos"
          etiqueta="Asientos"
          tipo="number"
          valor={valores.asientos}
          onChange={setCampo}
          error={errores.asientos}
        />
      </Bloque>

      {(!admisibilidad.allowed || excedeKm || avisosModelo.length > 0) ? (
        <PanelNormativa
          razon={admisibilidad.allowed ? null : admisibilidad.reason}
          excedeKm={excedeKm}
          avisosModelo={avisosModelo}
        />
      ) : null}

      {/* ==================== Comercial ==================== */}
      <Bloque
        titulo="Precios y operación"
        descripcion="El precio de compra y las notas internas nunca salen del portal: el sitio público no tiene permiso de lectura sobre esas columnas."
      >
        <CampoMoneda
          nombre="precio_compra"
          etiqueta="Precio de compra"
          valor={valores.precio_compra}
          moneda={valores.moneda_compra}
          nombreMoneda="moneda_compra"
          onChange={setCampo}
          error={errores.precio_compra}
          ayuda="Reservado. Es el margen del negocio."
        />
        <CampoMoneda
          nombre="precio_venta"
          etiqueta="Precio de venta"
          valor={valores.precio_venta}
          moneda={valores.moneda_venta}
          nombreMoneda="moneda_venta"
          onChange={setCampo}
          error={errores.precio_venta}
          ayuda="Obligatorio para publicar en la web."
        />
        <CampoSelect
          nombre="estado"
          etiqueta="Estado"
          valor={valores.estado}
          onChange={setCampo}
          opciones={ESTADO_OPCIONES.map((valor) => ({
            valor,
            texto: ESTADO_LABEL[valor],
          }))}
        />
        {valores.estado === "vendido" ? (
          <Campo
            nombre="vendido_en"
            etiqueta="Fecha de venta"
            tipo="date"
            requerido
            valor={valores.vendido_en}
            onChange={setCampo}
            error={errores.vendido_en}
          />
        ) : null}
        <Campo
          nombre="ubicacion"
          etiqueta="Ubicación"
          valor={valores.ubicacion}
          onChange={setCampo}
          placeholder="Showroom San Isidro"
        />
        <Campo
          nombre="fecha_compra"
          etiqueta="Fecha de compra"
          tipo="date"
          valor={valores.fecha_compra}
          onChange={setCampo}
        />
        <CampoSelect
          nombre="fuente"
          etiqueta="Procedencia del dato"
          valor={valores.fuente}
          onChange={setCampo}
          opciones={FUENTE_OPCIONES.map((valor) => ({
            valor,
            texto: FUENTE_LABEL[valor],
          }))}
          ayuda="Cómo llegó esta ficha al sistema, no de dónde viene el auto."
        />
        <Campo
          nombre="fuente_referencia"
          etiqueta="Referencia"
          valor={valores.fuente_referencia}
          onChange={setCampo}
          placeholder="Orden de compra, contrato de consignación…"
        />
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 text-sm text-ink-2">
            <input
              type="checkbox"
              name="precio_negociable"
              checked={negociable}
              onChange={(evento) => setNegociable(evento.target.checked)}
              className="mt-0.5 size-4 accent-silver"
            />
            <span>
              Precio negociable
              <span className="block text-xs text-ink-4">
                Se muestra al cliente en la ficha pública.
              </span>
            </span>
          </label>
        </div>
      </Bloque>

      {/* ==================== Publicación ==================== */}
      <Bloque
        titulo="Publicación en la web"
        descripcion="Mientras esté sin publicar, la ficha solo existe en este portal."
      >
        <Campo
          nombre="titular"
          etiqueta="Titular comercial"
          valor={valores.titular}
          onChange={setCampo}
          error={errores.titular}
          placeholder="Toyota GR Supra MkV Final Edition 2026"
          ayuda="Si lo dejas vacío se arma con año, marca, modelo y versión."
        />
        <Campo
          nombre="slug"
          etiqueta="URL (slug)"
          valor={valores.slug}
          onChange={setCampo}
          error={errores.slug}
          placeholder="toyota-gr-supra-final-edition-2026"
          ayuda="Se genera solo al publicar si lo dejas vacío."
        />
        <CampoTextarea
          nombre="descripcion"
          etiqueta="Descripción"
          valor={valores.descripcion}
          onChange={setCampo}
          filas={4}
          placeholder="Lo que le dirías a un cliente parado frente al auto."
        />
        <CampoTextarea
          nombre="destacados"
          etiqueta="Destacados"
          valor={valores.destacados}
          onChange={setCampo}
          filas={4}
          placeholder={"Un punto por línea\nEdición limitada a 1,300 unidades\nÚnico dueño"}
          ayuda="Una línea por punto. Máximo 12."
        />
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 text-sm text-ink-2">
            <input
              type="checkbox"
              name="publicado"
              checked={publicado}
              onChange={(evento) => setPublicado(evento.target.checked)}
              className="mt-0.5 size-4 accent-silver"
            />
            <span>
              Publicar en la web ahora
              <span className="block text-xs text-ink-4">
                Necesita precio de venta y URL. Puedes cargarlo sin publicar,
                subir las fotos y publicarlo después.
              </span>
            </span>
          </label>
        </div>
      </Bloque>

      {/* ==================== Interno ==================== */}
      <Bloque
        titulo="Notas internas"
        descripcion="No se exponen al sitio público bajo ninguna circunstancia."
      >
        <CampoTextarea
          nombre="notas_internas"
          etiqueta="Notas del equipo"
          valor={valores.notas_internas}
          onChange={setCampo}
          deVin={deVin.notas_internas}
          filas={6}
          anchoCompleto
          placeholder="Historial, detalles de negociación, pendientes…"
        />
      </Bloque>

      {/* ==================== Acciones ==================== */}
      <div className="flex flex-col-reverse gap-3 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/portal/vehiculos"
            className="text-sm text-ink-3 transition-colors hover:text-ink"
          >
            Cancelar
          </Link>
          <button
            type="button"
            onClick={limpiarTodo}
            className="text-sm text-ink-3 transition-colors hover:text-ink"
          >
            Vaciar formulario
          </button>
        </div>

        {/* El único oro de la pantalla. */}
        <button
          type="submit"
          disabled={envio.fase === "guardando"}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-gold px-8 text-sm font-medium uppercase tracking-[0.16em] text-void transition-colors hover:bg-gold-bright disabled:pointer-events-none disabled:opacity-50"
        >
          {envio.fase === "guardando" ? "Guardando…" : "Guardar vehículo"}
        </button>
      </div>
    </form>
  );
}

/* ========================================================================== */
/* Estado del VIN                                                             */
/* ========================================================================== */

function EstadoDelVin({
  estado,
  errorServidor,
  digitoSospechoso,
}: {
  estado: EstadoVin;
  errorServidor?: string;
  digitoSospechoso: boolean;
}) {
  if (errorServidor) {
    return (
      <p className="mt-4 text-sm text-danger">{errorServidor}</p>
    );
  }

  if (estado.fase === "escribiendo") {
    return (
      <p className="mt-4 text-sm text-ink-3">
        Faltan {estado.faltan} {estado.faltan === 1 ? "carácter" : "caracteres"}.
      </p>
    );
  }

  if (estado.fase === "consultando") {
    return (
      <p className="mt-4 text-sm text-ink-2">
        Consultando NHTSA vPIC…
      </p>
    );
  }

  if (estado.fase === "error") {
    return (
      <div className="mt-4 rounded-lux border border-danger/40 bg-surface-2 p-4">
        <p className="text-sm text-danger">{estado.mensaje}</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          Puedes continuar igual: completa los campos a mano y guarda. El VIN se
          registra tal como lo escribiste.
        </p>
      </div>
    );
  }

  if (estado.fase !== "decodificado") return null;

  const { datos, avisos } = estado;
  const esUsa = (datos.assemblyCountry ?? "").toLowerCase().includes("estados unidos");

  return (
    <div className="mt-5 rounded-lux border border-line bg-surface-2 p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-silver">
        Ficha decodificada por NHTSA
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <DatoVin etiqueta="Marca" valor={datos.brand} />
        <DatoVin etiqueta="Modelo" valor={datos.model} />
        <DatoVin etiqueta="Año" valor={datos.year ? String(datos.year) : null} />
        <DatoVin etiqueta="Carrocería" valor={datos.bodyStyle} />
        <DatoVin
          etiqueta="Cilindrada"
          valor={datos.engineCc ? `${datos.engineCc} cc` : null}
        />
        <DatoVin etiqueta="Combustible" valor={datos.fuelType} />
        <DatoVin etiqueta="Ensamblaje" valor={datos.assemblyCountry} />
        <DatoVin etiqueta="Planta" valor={datos.assemblyPlant} />
        <DatoVin etiqueta="Fabricante" valor={datos.manufacturer} />
      </dl>

      {datos.assemblyCountry ? (
        <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">
          <strong className="text-ink-2">Ojo con el ad valorem:</strong>{" "}
          {esUsa
            ? "ensamblado en EE.UU. Eso no basta para el 0% del APC: hace falta que sea NUEVO y que el vendedor emita certificado de origen. Un usado paga 6% aunque sea originario."
            : `ensamblado en ${datos.assemblyCountry}, así que no califica para el 0% del APC Perú–EE.UU. Comprarlo en Miami no da origen: paga 6%.`}
        </p>
      ) : null}

      {digitoSospechoso ? (
        <p className="mt-4 rounded-lux border border-warn/40 p-3 text-xs leading-relaxed text-warn">
          El dígito verificador (posición 9) no cuadra. Suele ser un carácter mal
          copiado. NHTSA igual decodificó el VIN, así que puedes seguir, pero
          vale la pena compararlo con la tarjeta de propiedad.
        </p>
      ) : null}

      {avisos.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-line pt-4">
          {avisos.map((aviso) => (
            <li key={aviso} className="text-xs leading-relaxed text-ink-3">
              {aviso}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DatoVin({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] uppercase tracking-[0.14em] text-ink-4">
        {etiqueta}
      </dt>
      <dd className="mt-1 truncate text-sm text-ink" title={valor ?? undefined}>
        {valor ?? "—"}
      </dd>
    </div>
  );
}

/**
 * Resumen que se vuelca en las notas internas: el país de ensamblaje y el
 * combustible no tienen columna propia en `vehicles`, pero deciden el ad
 * valorem y el ISC. Perderlos sería perder el dato más caro del decodificado.
 */
function resumenTecnico(datos: VinDecoded): string {
  const lineas = [
    `Decodificado por NHTSA vPIC (VIN ${datos.vin}):`,
    datos.assemblyCountry ? `· Ensamblaje: ${datos.assemblyCountry}` : null,
    datos.assemblyPlant ? `· Planta: ${datos.assemblyPlant}` : null,
    datos.fuelTypeRaw ? `· Combustible: ${datos.fuelTypeRaw}` : null,
    datos.manufacturer ? `· Fabricante: ${datos.manufacturer}` : null,
    datos.vehicleType ? `· Tipo: ${datos.vehicleType}` : null,
  ].filter(Boolean);
  return lineas.length > 1 ? lineas.join("\n") : "";
}

/* ========================================================================== */
/* Avisos normativos                                                          */
/* ========================================================================== */

/**
 * Advertencias de modelo verificadas. No son opiniones de mercado: son hechos
 * que cambian la decisión de compra y que conviene tener a la vista mientras se
 * carga la ficha.
 */
function avisosDeModelo(marca: string, modelo: string): string[] {
  const texto = `${marca} ${modelo}`.toLowerCase();
  const avisos: string[] = [];

  if (texto.includes("cybertruck")) {
    avisos.push(
      "El Tesla Cybertruck no está homologado fuera de Norteamérica. Si se publica, la ficha debe advertirlo: su nacionalización en Perú no está garantizada.",
    );
  }
  if (texto.includes("changan") || texto.includes("geely")) {
    avisos.push(
      "Changan y Geely ya se venden NUEVOS en Perú más baratos de lo que costaría importarlos, y no están en dealers de EE.UU. Importarlos no tiene sentido económico: conviene decírselo al cliente.",
    );
  }

  return avisos;
}

function PanelNormativa({
  razon,
  excedeKm,
  avisosModelo,
}: {
  razon: string | null;
  excedeKm: boolean;
  avisosModelo: string[];
}) {
  return (
    <div className="rounded-lux border border-warn/40 bg-surface-2 p-5">
      <p className="text-sm font-medium text-warn">
        Antes de importarlo, ojo con esto
      </p>
      <ul className="mt-3 space-y-3 text-sm leading-relaxed text-ink-2">
        {razon ? <li>{razon}</li> : null}
        {excedeKm ? (
          <li>
            Supera los{" "}
            {IMPORT_COMPLIANCE_REFERENCE.maxMileageKm.M1.toLocaleString("es-PE")}{" "}
            km de tope para categoría M1 (autos y SUV). Para N1 (camionetas y
            pickups) el tope es{" "}
            {IMPORT_COMPLIANCE_REFERENCE.maxMileageKm.N1.toLocaleString("es-PE")}{" "}
            km.
          </li>
        ) : null}
        {avisosModelo.map((aviso) => (
          <li key={aviso}>{aviso}</li>
        ))}
      </ul>
      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-3">
        Esto NO impide guardar el vehículo. Las reglas de antigüedad,
        kilometraje y diésel aplican al momento de IMPORTAR: un auto en
        consignación de un cliente peruano puede tener ocho años y 150,000 km
        con toda legitimidad.
      </p>
    </div>
  );
}

/* ========================================================================== */
/* Piezas de formulario                                                       */
/* ========================================================================== */

const CLASE_CONTROL =
  "w-full rounded-lux border border-line bg-surface-2 px-3 py-3 text-sm text-ink transition-colors placeholder:text-ink-4 hover:border-line-strong focus:border-silver";

function Bloque({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-medium text-ink">{titulo}</h2>
      {descripcion ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">
          {descripcion}
        </p>
      ) : null}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Etiqueta({
  nombre,
  etiqueta,
  requerido,
  deVin,
}: {
  nombre: string;
  etiqueta: string;
  requerido?: boolean;
  deVin?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label
        htmlFor={nombre}
        className="text-xs uppercase tracking-[0.14em] text-ink-3"
      >
        {etiqueta}
        {requerido ? <span className="ml-1 text-silver">*</span> : null}
      </label>
      {deVin ? (
        <span className="rounded-full border border-silver/40 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.12em] text-silver">
          VIN
        </span>
      ) : null}
    </div>
  );
}

/**
 * Pie de campo: el mensaje de error o, si no hay, el texto de ayuda.
 *
 * Lleva `id` porque el control de arriba lo referencia con `aria-describedby`.
 * Antes no lo llevaba: el campo se marcaba `aria-invalid`, así que un lector de
 * pantalla decía "no válido" y no tenía forma de leer POR QUÉ — el motivo
 * estaba en un `<p>` suelto, sin relación con el campo (WCAG 3.3.1). El texto
 * de ayuda sufría lo mismo: se veía pero no se leía junto al campo.
 */
function PieCampo({
  id,
  error,
  ayuda,
}: {
  id: string;
  error?: string;
  ayuda?: string;
}) {
  if (error)
    return (
      <p id={id} role="alert" className="mt-2 text-xs text-danger">
        {error}
      </p>
    );
  if (ayuda)
    return (
      <p id={id} className="mt-2 text-xs text-ink-4">
        {ayuda}
      </p>
    );
  return null;
}

/** `aria-describedby` solo si hay algo que describir; si no, se omite. */
const idPie = (nombre: string) => `${nombre}-pie`;
const describedBy = (nombre: string, error?: string, ayuda?: string) =>
  error || ayuda ? idPie(nombre) : undefined;

type CampoBase = {
  nombre: NombreCampo;
  etiqueta: string;
  valor: string;
  onChange: (nombre: NombreCampo, valor: string) => void;
  error?: string;
  ayuda?: string;
  deVin?: boolean;
  requerido?: boolean;
  placeholder?: string;
};

function Campo({
  nombre,
  etiqueta,
  valor,
  onChange,
  error,
  ayuda,
  deVin,
  requerido,
  placeholder,
  tipo = "text",
}: CampoBase & { tipo?: "text" | "number" | "date" }) {
  return (
    <div>
      <Etiqueta
        nombre={nombre}
        etiqueta={etiqueta}
        requerido={requerido}
        deVin={deVin}
      />
      <input
        id={nombre}
        name={nombre}
        type={tipo}
        value={valor}
        onChange={(evento) => onChange(nombre, evento.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(nombre, error, ayuda)}
        autoComplete="off"
        className={`mt-2 ${CLASE_CONTROL} ${error ? "border-danger" : ""}`}
      />
      <PieCampo id={idPie(nombre)} error={error} ayuda={ayuda} />
    </div>
  );
}

function CampoSelect({
  nombre,
  etiqueta,
  valor,
  onChange,
  opciones,
  ayuda,
  deVin,
}: CampoBase & { opciones: { valor: string; texto: string }[] }) {
  return (
    <div>
      <Etiqueta nombre={nombre} etiqueta={etiqueta} deVin={deVin} />
      <select
        id={nombre}
        name={nombre}
        value={valor}
        onChange={(evento) => onChange(nombre, evento.target.value)}
        aria-describedby={describedBy(nombre, undefined, ayuda)}
        className={`mt-2 ${CLASE_CONTROL}`}
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
      <PieCampo id={idPie(nombre)} ayuda={ayuda} />
    </div>
  );
}

function CampoTextarea({
  nombre,
  etiqueta,
  valor,
  onChange,
  filas = 3,
  ayuda,
  placeholder,
  deVin,
  anchoCompleto,
}: CampoBase & {
  filas?: number;
  anchoCompleto?: boolean;
}) {
  return (
    <div className={anchoCompleto ? "sm:col-span-2" : undefined}>
      <Etiqueta nombre={nombre} etiqueta={etiqueta} deVin={deVin} />
      <textarea
        id={nombre}
        name={nombre}
        rows={filas}
        value={valor}
        onChange={(evento) => onChange(nombre, evento.target.value)}
        placeholder={placeholder}
        aria-describedby={describedBy(nombre, undefined, ayuda)}
        className={`mt-2 ${CLASE_CONTROL} resize-y`}
      />
      <PieCampo id={idPie(nombre)} ayuda={ayuda} />
    </div>
  );
}

function CampoMoneda({
  nombre,
  etiqueta,
  valor,
  moneda,
  nombreMoneda,
  onChange,
  error,
  ayuda,
}: CampoBase & { moneda: string; nombreMoneda: NombreCampo }) {
  return (
    <div>
      <Etiqueta nombre={nombre} etiqueta={etiqueta} />
      <div className="mt-2 flex gap-2">
        <input
          id={nombre}
          name={nombre}
          type="number"
          min={0}
          step="0.01"
          value={valor}
          onChange={(evento) => onChange(nombre, evento.target.value)}
          placeholder="0"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(nombre, error, ayuda)}
          className={`${CLASE_CONTROL} tabular-nums ${error ? "border-danger" : ""}`}
        />
        <select
          name={nombreMoneda}
          value={moneda}
          onChange={(evento) => onChange(nombreMoneda, evento.target.value)}
          aria-label={`Moneda de ${etiqueta.toLowerCase()}`}
          className={`${CLASE_CONTROL} w-24 shrink-0`}
        >
          {MONEDA_OPCIONES.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      </div>
      <PieCampo id={idPie(nombre)} error={error} ayuda={ayuda} />
    </div>
  );
}

/* ========================================================================== */
/* Paneles de resultado                                                       */
/* ========================================================================== */

function Alerta({
  tono,
  titulo,
  children,
}: {
  tono: "danger" | "warn";
  titulo: string;
  children: React.ReactNode;
}) {
  const borde = tono === "danger" ? "border-danger/40" : "border-warn/40";
  const color = tono === "danger" ? "text-danger" : "text-warn";
  return (
    <div className={`rounded-lux border ${borde} bg-surface-2 p-5`}>
      <p className={`text-sm font-medium ${color}`}>{titulo}</p>
      <div className="mt-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

/**
 * Aviso honesto y temprano: el formulario funciona igual, pero conviene saber
 * antes de invertir cuatro minutos que al final no habrá dónde guardarlo.
 */
function AvisoNoSeGuarda({ sesion }: { sesion: PortalSessionStatus }) {
  const faltantes = getPortalAuthMissingEnv();

  if (sesion === "sin-configurar") {
    return (
      <Alerta tono="warn" titulo="Sin base de datos: esto NO se va a guardar">
        <p>
          Puedes recorrer el formulario completo y decodificar VINs contra NHTSA,
          pero al enviar no se guardará nada. Falta conectar Supabase.
        </p>
        {faltantes.length > 0 ? (
          <p className="mt-3 text-xs text-ink-3">
            Variables pendientes:{" "}
            <span className="font-mono text-ink-2">{faltantes.join(", ")}</span>.
            Se configuran en Vercel → Project Settings → Environment Variables (o
            en <code className="font-mono">.env.local</code>) y están
            documentadas en <code className="font-mono">.env.example</code>.
          </p>
        ) : null}
      </Alerta>
    );
  }

  return (
    <Alerta tono="warn" titulo="Sin sesión: esto NO se va a guardar">
      <p>
        El formulario funciona, pero guardar exige una sesión del equipo: quien
        escribe en el inventario es tu usuario, no el servidor.{" "}
        <Link
          href="/portal/login"
          className="text-silver underline underline-offset-4"
        >
          Inicia sesión
        </Link>{" "}
        y vuelve a enviar; lo que hayas escrito sigue acá.
      </p>
    </Alerta>
  );
}

function BorradorNoGuardado({
  mensaje,
  borrador,
}: {
  mensaje: string;
  borrador: string;
}) {
  return (
    <div className="rounded-lux border border-warn/40 bg-surface-2 p-5">
      <p className="text-sm font-medium text-warn">El vehículo no se guardó</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{mensaje}</p>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        Los datos siguen en el formulario. Acá está además la ficha completa en
        JSON, por si prefieres copiarla ahora y no repetir el trabajo:
      </p>
      <pre className="mt-3 max-h-64 overflow-auto rounded-lux border border-line bg-surface p-4 font-mono text-xs leading-relaxed text-ink-2">
        {borrador}
      </pre>
    </div>
  );
}

function PanelExito({
  titulo,
  slug,
  publicado,
  onOtro,
}: {
  titulo: string;
  slug: string | null;
  publicado: boolean;
  onOtro: () => void;
}) {
  return (
    <div className="mt-10 rounded-lux-lg border border-line-strong bg-surface p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-silver">
        Vehículo guardado
      </p>
      <h2 className="mt-3 text-2xl font-medium text-ink">{titulo}</h2>

      <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-2">
        {publicado
          ? "Ya está publicado en la web. Súbele fotos cuanto antes: una ficha sin fotos vende mucho menos que una con seis."
          : "Quedó como borrador: solo se ve en este portal. Publícalo cuando tengas las fotos y el precio definitivo."}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onOtro}
          className="inline-flex min-h-12 items-center rounded-full bg-silver px-7 text-xs uppercase tracking-[0.16em] text-void transition-colors hover:bg-silver-bright"
        >
          Cargar otro
        </button>
        <Link
          href="/portal/vehiculos"
          className="inline-flex min-h-12 items-center rounded-full border border-line-strong px-7 text-xs uppercase tracking-[0.16em] text-ink transition-colors hover:border-silver"
        >
          Ver el stock
        </Link>
        {publicado && slug ? (
          <Link
            href={`/comprar/${slug}`}
            className="inline-flex min-h-12 items-center rounded-full border border-line px-7 text-xs uppercase tracking-[0.16em] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            Ver la ficha pública
          </Link>
        ) : null}
      </div>
    </div>
  );
}
