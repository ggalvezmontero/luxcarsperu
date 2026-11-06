export function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrency(
  value: number,
  locale: string = "es-PE",
  currency: string = "USD",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, locale: string = "es-PE") {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercentage(
  value: number,
  locale: string = "es-PE",
  digits: number = 0,
) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * Una tasa como porcentaje, con un decimal solo si lo necesita: 10% → "10 %",
 * 3.5% → "3.5 %". `formatPercentage` redondea a entero por defecto y mostraba
 * la percepción del 3.5% como "4%" al lado de un monto calculado con 3.5%.
 */
export function formatRate(value: number, locale: string = "es-PE") {
  const entero = Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;
  return formatPercentage(value, locale, entero ? 0 : 1);
}
