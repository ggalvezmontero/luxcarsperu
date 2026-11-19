import { Button } from "@/components/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Section } from "@/components/ui/Section";
import { LUXCARS_CONFIG } from "@/lib/config";

/**
 * Búsqueda y verificación de un auto dentro de Perú: la línea para quien lo
 * quiere ya y no espera 40 días de importación. Vive en /comprar, debajo del
 * stock, porque es la respuesta natural cuando el listado no tiene lo que la
 * persona busca (el estado vacío del explorador enlaza aquí).
 *
 * El honorario sale de `LUXCARS_CONFIG.services.localSearch`: no se escribe a
 * mano, para que el pie, el FAQ y esta sección digan lo mismo.
 */

const PASOS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "search",
    title: "Nos dices qué buscas",
    text: "Modelo, año, presupuesto y qué no negocias. Con eso salimos a buscar en dealers, particulares y consignaciones de Lima.",
  },
  {
    icon: "scan",
    title: "Lo verificamos antes de que pagues",
    text: "Escaneo pre-compra con escáner profesional, VIN contra la base pública de EE.UU., cargas registrales y papeles. Si no pasa, seguimos buscando.",
  },
  {
    icon: "handshake",
    title: "Negociamos y cerramos contigo",
    text: "Te acompañamos en el precio, la transferencia notarial y la entrega. El informe verificado queda contigo.",
  },
];

const usd = (amount: number) => `USD ${amount.toLocaleString("en-US")}`;

export function BusquedaLocalSection() {
  const { localSearch } = LUXCARS_CONFIG.services;
  const mensaje =
    "Hola Luxcars, quiero que me busquen un auto en Lima y lo verifiquen antes de comprar. Busco:";
  const whatsapp = `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;

  return (
    <Section tone="void" padding="normal" id="busqueda-local">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="eyebrow">Búsqueda y verificación en Lima</p>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            ¿Lo quieres ya y no está en nuestro stock? Lo buscamos en Lima y lo verificamos.
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-base text-ink-2 sm:text-lg">
            Para quien no quiere esperar una importación. Buscamos la unidad en el mercado peruano, la escaneamos
            y revisamos sus papeles antes de que pongas un sol.
          </p>
          <ol className="mt-8 space-y-5">
            {PASOS.map((paso, i) => (
              <li key={paso.title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-silver-bright">
                  <Icon name={paso.icon} size={22} />
                </span>
                <span>
                  <span className="block text-base font-semibold text-ink">
                    {i + 1}. {paso.title}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-3">{paso.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-[22px] border border-line bg-surface p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-3">Honorario</p>
          <p className="mt-2 text-3xl font-semibold text-ink">
            {usd(localSearch.feeFromUsd)} a {usd(localSearch.feeToUsd)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-3">
            Según el precio del auto. Incluye el escaneo pre-compra de la unidad que compres y la revisión de
            papeles. Te lo confirmamos por escrito antes de empezar a buscar.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-ink-2">
            {[
              "Autos desde USD 15,000, nuevos o usados",
              "Sin esperar barco ni aduana: días, no semanas",
              "Informe verificado por Luxcars en cada unidad revisada",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-silver-bright" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button href={whatsapp} variant="whatsapp" data-ga-cta="comprar_busqueda_local_whatsapp">
              Dime qué buscas
            </Button>
            <Button href="/escaneo" variant="secondary" data-ga-cta="comprar_busqueda_local_escaneo">
              Ver el escaneo
            </Button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-4">
            Si ya tienes un auto visto y solo quieres revisarlo, el escaneo suelto cuesta aparte y se descuenta
            si luego contratas la búsqueda.
          </p>
        </div>
      </div>
    </Section>
  );
}
