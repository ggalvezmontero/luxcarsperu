import { getVehicleCategory } from "../pricing/vehicleCategories";
import { CONFIG_ENVIOS } from "./configEnvios";
import type { AlertaEnvio, EntradaCotizacionEnvio, ValorAduanaEstimado } from "./tipos";
import { anioDeFecha, fechaLimiteIngresoUsado, recorridoEnKm } from "./valorAduana";

const fmtUsd = (n: number) =>
  `US$ ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n))}`;
const fmtKm = (n: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n))} km`;

/** `2027-12-31` → `31/12/2027`. */
export function fechaCorta(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/**
 * Todas las alertas de una cotización. NUNCA bloquean: el administrador decide
 * qué hacer con ellas. Se devuelven ordenadas por gravedad (peligro, aviso,
 * información) para que la pantalla y el mensaje las muestren en ese orden.
 */
export function validarEnvio(
  entrada: EntradaCotizacionEnvio,
  contexto: { anioImportacion: number; valorAduana: ValorAduanaEstimado },
): AlertaEnvio[] {
  const alertas: AlertaEnvio[] = [];
  const { vehiculo, regimen, retorno } = entrada;
  const { anioImportacion, valorAduana } = contexto;
  const usado = vehiculo.condicion === "usado";

  /* ── Antigüedad ─────────────────────────────────────────────────────── */
  const limite = fechaLimiteIngresoUsado(vehiculo.condicion, vehiculo.anioModelo);
  if (limite) {
    const ultimoAnio = Number(limite.slice(0, 4));
    if (anioImportacion > ultimoAnio) {
      alertas.push({
        clave: "antiguedad",
        nivel: "danger",
        titulo: "Supera la antigüedad máxima para usados",
        detalle:
          `Un usado modelo ${vehiculo.anioModelo} solo puede ingresar hasta el ${fechaCorta(limite)} ` +
          `(máximo ${CONFIG_ENVIOS.usados.antiguedadMaximaAnios} años contados desde el 1 de enero del año modelo). ` +
          `Con una importación en ${anioImportacion} ya no entra como usado.`,
        paraCliente: true,
      });
    } else {
      alertas.push({
        clave: "antiguedad",
        nivel: anioImportacion === ultimoAnio ? "warn" : "info",
        titulo: `Puede ingresar hasta el ${fechaCorta(limite)}`,
        detalle:
          `Un usado modelo ${vehiculo.anioModelo} entra hasta esa fecha: en ${anioImportacion} solo se admiten ` +
          `modelos ${anioImportacion} y ${anioImportacion - 1}.` +
          (anioImportacion === ultimoAnio ? " Es el último año: la fecha de importación no puede pasarse al siguiente." : ""),
        paraCliente: true,
      });
    }
  }

  /* ── Recorrido ──────────────────────────────────────────────────────── */
  if (usado) {
    const km = recorridoEnKm(vehiculo.recorrido, vehiculo.unidadRecorrido);
    const tope = CONFIG_ENVIOS.usados.recorridoMaximoKm;
    if (km > tope) {
      alertas.push({
        clave: "recorrido",
        nivel: "warn",
        titulo: "Recorrido por encima del máximo para usados",
        detalle:
          `${fmtKm(km)} frente a un máximo de ${fmtKm(tope)}` +
          (CONFIG_ENVIOS.usados.recorridoPorConfirmar ? " (parámetro por confirmar)." : "."),
        paraCliente: true,
      });
    }
  }

  /* ── Diésel usado ───────────────────────────────────────────────────── */
  if (usado && !getVehicleCategory(vehiculo.combustible).usedImportAllowed) {
    alertas.push({
      clave: "diesel-usado",
      nivel: "danger",
      titulo: "Diésel usado: no puede ingresar",
      detalle:
        "El Perú prohíbe importar vehículos usados a diésel en autos, SUVs y camionetas (D. Leg. 843). " +
        "Solo se admiten diésel nuevos. La cotización se muestra solo como referencia.",
      paraCliente: true,
    });
  }

  /* ── Préstamo vigente ───────────────────────────────────────────────── */
  if (entrada.prestamoVigente) {
    alertas.push({
      clave: "prestamo",
      nivel: "warn",
      titulo: "Préstamo vigente sobre el vehículo",
      detalle:
        "Para exportarlo de EE.UU. el préstamo debe estar cancelado o se necesita la autorización escrita del financista (lien release o carta de autorización).",
      paraCliente: true,
    });
  }

  /* ── Valor estimado para aduanas ────────────────────────────────────── */
  if (usado) {
    const metodo =
      valorAduana.metodo === "referencia"
        ? "el valor de referencia ingresado"
        : `la factura menos ${Math.round(valorAduana.depreciacion * 100)}% por ${valorAduana.aniosUso} año${valorAduana.aniosUso === 1 ? "" : "s"} de uso`;
    alertas.push({
      clave: "valor-aduana",
      nivel: "info",
      titulo: `Valor estimado para aduanas: ${fmtUsd(valorAduana.valorUsd)}`,
      detalle: `Se tomó ${metodo}. SUNAT puede fijar otro valor.`,
      paraCliente: false,
    });
  }

  /* ── Ley del Retorno ────────────────────────────────────────────────── */
  if (regimen === "ley-retorno") {
    const ley = CONFIG_ENVIOS.leyRetorno;
    const aniosFuera = retorno?.aniosFuera ?? 0;

    if (aniosFuera < ley.aniosMinimosFuera) {
      alertas.push({
        clave: "retorno-anios",
        nivel: "danger",
        titulo: "No cumple los años mínimos fuera del Perú",
        detalle: `${ley.nombre} exige al menos ${ley.aniosMinimosFuera} años continuos viviendo fuera; se indicaron ${aniosFuera}. Sin el beneficio, aplica la importación regular.`,
        paraCliente: true,
      });
    }

    if (valorAduana.valorUsd > ley.valorMaximoUsd) {
      alertas.push({
        clave: "retorno-tope",
        nivel: "danger",
        titulo: `Supera el tope de ${fmtUsd(ley.valorMaximoUsd)}`,
        detalle:
          `El valor estimado para aduanas (${fmtUsd(valorAduana.valorUsd)}) supera el tope. Se pierde TODO el beneficio, no hay beneficio parcial: ` +
          "aplica la importación regular. Conviene revisar el valor de referencia como usado.",
        paraCliente: true,
      });
    } else if (valorAduana.margenTopeUsd < CONFIG_ENVIOS.valorAduana.margenAlertaUsd) {
      alertas.push({
        clave: "retorno-margen",
        nivel: "warn",
        titulo: `Margen ajustado frente al tope: ${fmtUsd(valorAduana.margenTopeUsd)}`,
        detalle:
          `El valor estimado (${fmtUsd(valorAduana.valorUsd)}) queda a menos de ${fmtUsd(CONFIG_ENVIOS.valorAduana.margenAlertaUsd)} del tope de ${fmtUsd(ley.valorMaximoUsd)}. ` +
          "Si SUNAT valora el vehículo por encima, se pierde el beneficio completo.",
        paraCliente: false,
      });
    }

    const anioRetorno = anioDeFecha(retorno?.fechaRetorno);
    const anioVigencia = Number(ley.vigenteHasta.slice(0, 4));
    const fechaRetorno = retorno?.fechaRetorno?.trim() ?? "";
    if ((anioRetorno !== null && anioRetorno > anioVigencia) || (fechaRetorno && fechaRetorno > ley.vigenteHasta)) {
      alertas.push({
        clave: "retorno-vigencia",
        nivel: "danger",
        titulo: "El retorno cae después de la vigencia del beneficio",
        detalle: `${ley.nombre} está vigente hasta el ${fechaCorta(ley.vigenteHasta)}; la fecha estimada de retorno es posterior.`,
        paraCliente: true,
      });
    } else {
      alertas.push({
        clave: "retorno-vigencia",
        nivel: "info",
        titulo: `Beneficio vigente hasta el ${fechaCorta(ley.vigenteHasta)}`,
        detalle: "El retorno y la importación deben completarse antes de esa fecha.",
        paraCliente: true,
      });
    }

    alertas.push({
      clave: "retorno-transferencia",
      nivel: "info",
      titulo: `No se puede transferir por ${ley.aniosSinTransferir} años`,
      detalle: `El vehículo ingresado con ${ley.nombre} no puede venderse ni transferirse durante ${ley.aniosSinTransferir} años desde su nacionalización.`,
      paraCliente: true,
    });
  }

  const orden: Record<AlertaEnvio["nivel"], number> = { danger: 0, warn: 1, info: 2 };
  return alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}
