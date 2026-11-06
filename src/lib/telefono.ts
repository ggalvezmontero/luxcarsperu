/**
 * Teléfonos con código de país, para todos los formularios del sitio.
 *
 * El valor que guardan y envían los formularios es UNA cadena en formato
 * internacional ("+51 987 654 321"). Así no cambia nada aguas abajo: los
 * mensajes de WhatsApp, `profiles.telefono` y `normalizePhoneForWhatsapp`
 * siguen recibiendo un texto, solo que ahora siempre trae el país.
 *
 * Perú va por defecto porque es donde está casi toda la clientela; el selector
 * existe para quien escribe desde fuera (un peruano en Miami, por ejemplo).
 */

export type PaisTelefono = {
  /** Código ISO de dos letras. De él sale la bandera. */
  iso: string;
  nombre: string;
  /** Código de marcación, sin el "+". */
  codigo: string;
};

/** Perú primero; después los países desde donde más escriben, y el resto. */
export const PAISES_TELEFONO: readonly PaisTelefono[] = [
  { iso: "PE", nombre: "Perú", codigo: "51" },
  { iso: "US", nombre: "Estados Unidos", codigo: "1" },
  { iso: "CL", nombre: "Chile", codigo: "56" },
  { iso: "CO", nombre: "Colombia", codigo: "57" },
  { iso: "EC", nombre: "Ecuador", codigo: "593" },
  { iso: "BO", nombre: "Bolivia", codigo: "591" },
  { iso: "AR", nombre: "Argentina", codigo: "54" },
  { iso: "BR", nombre: "Brasil", codigo: "55" },
  { iso: "MX", nombre: "México", codigo: "52" },
  { iso: "VE", nombre: "Venezuela", codigo: "58" },
  { iso: "PA", nombre: "Panamá", codigo: "507" },
  { iso: "PY", nombre: "Paraguay", codigo: "595" },
  { iso: "UY", nombre: "Uruguay", codigo: "598" },
  { iso: "CR", nombre: "Costa Rica", codigo: "506" },
  { iso: "CA", nombre: "Canadá", codigo: "1" },
  { iso: "ES", nombre: "España", codigo: "34" },
  { iso: "IT", nombre: "Italia", codigo: "39" },
  { iso: "FR", nombre: "Francia", codigo: "33" },
  { iso: "DE", nombre: "Alemania", codigo: "49" },
  { iso: "GB", nombre: "Reino Unido", codigo: "44" },
  { iso: "CN", nombre: "China", codigo: "86" },
  { iso: "JP", nombre: "Japón", codigo: "81" },
];

export const PAIS_POR_DEFECTO: PaisTelefono = PAISES_TELEFONO[0];

/** Largo máximo de un número internacional completo (E.164). */
const DIGITOS_MAXIMOS = 15;

const soloDigitos = (valor: string) => valor.replace(/\D/g, "");

/** Bandera del país como emoji (dos "indicadores regionales"). */
export function banderaDe(iso: string): string {
  return String.fromCodePoint(
    ...iso
      .toUpperCase()
      .split("")
      .map((letra) => 0x1f1e6 + letra.charCodeAt(0) - 65),
  );
}

export function paisPorIso(iso: string): PaisTelefono {
  return PAISES_TELEFONO.find((pais) => pais.iso === iso) ?? PAIS_POR_DEFECTO;
}

/**
 * Separa un teléfono en país y número local (solo dígitos).
 *
 * Con "+" delante se busca el código de país más largo que coincida. Sin "+"
 * se asume Perú, salvo que venga escrito como 51 + nueve dígitos.
 */
export function separarTelefono(valor: string): { pais: PaisTelefono; numero: string } {
  const texto = (valor ?? "").trim();
  const digitos = soloDigitos(texto);

  if (texto.startsWith("+") || texto.startsWith("00")) {
    const internacional = texto.startsWith("00") ? digitos.slice(2) : digitos;
    const candidatos = [...PAISES_TELEFONO].sort((a, b) => b.codigo.length - a.codigo.length);
    const pais = candidatos.find((candidato) => internacional.startsWith(candidato.codigo));
    if (pais) return { pais, numero: internacional.slice(pais.codigo.length) };
    return { pais: PAIS_POR_DEFECTO, numero: internacional };
  }

  if (digitos.length === 11 && digitos.startsWith("51")) {
    return { pais: PAIS_POR_DEFECTO, numero: digitos.slice(2) };
  }
  return { pais: PAIS_POR_DEFECTO, numero: digitos };
}

/** Número local agrupado para leerlo. Perú: 987 654 321. */
export function formatearNumero(pais: PaisTelefono, numero: string): string {
  const digitos = soloDigitos(numero);
  if (pais.iso === "PE" && digitos.length <= 9) {
    return digitos.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  }
  return digitos;
}

/** El teléfono completo como se guarda: "+51 987 654 321". Vacío sin número. */
export function unirTelefono(pais: PaisTelefono, numero: string): string {
  const digitos = soloDigitos(numero).slice(0, DIGITOS_MAXIMOS - pais.codigo.length);
  if (!digitos) return "";
  return `+${pais.codigo} ${formatearNumero(pais, digitos)}`;
}

/**
 * ¿Sirve para escribirle por WhatsApp? En Perú tiene que ser un celular: nueve
 * dígitos que empiezan con 9. En el resto solo se pide un largo razonable.
 */
export function telefonoValido(valor: string): boolean {
  const { pais, numero } = separarTelefono(valor);
  if (pais.iso === "PE") return /^9\d{8}$/.test(numero);
  return numero.length >= 6 && numero.length + pais.codigo.length <= DIGITOS_MAXIMOS;
}

/** Por qué no sirve, para decirlo bajo el campo. `null` si está bien. */
export function errorDeTelefono(valor: string): string | null {
  const { pais, numero } = separarTelefono(valor);
  if (!numero) return "Escribe tu número de WhatsApp.";
  if (telefonoValido(valor)) return null;
  if (pais.iso === "PE") {
    return "Un celular de Perú tiene 9 dígitos y empieza con 9. Si tu número es de otro país, cambia el código.";
  }
  return "Revisa el número: parece incompleto.";
}

/** Ejemplo que se muestra dentro del campo vacío. */
export function ejemploDeNumero(pais: PaisTelefono): string {
  return pais.iso === "PE" ? "987 654 321" : "Número sin el código de país";
}
