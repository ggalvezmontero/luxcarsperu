import { LUXCARS_CONFIG } from "@/lib/config";
import { Button } from "./Button";
import { WhatsAppIcon } from "./ui/Icon";

export function CtaBand({
  title = "¿Tienes un auto en mente?",
  text = "Cuéntanos cuál y te decimos si conviene traerlo, cuánto cuesta puesto en Lima y en cuánto tiempo llega.",
  message = "Hola LuxCars, tengo un auto en mente y quiero saber si conviene importarlo.",
}: {
  title?: string;
  text?: string;
  message?: string;
}) {
  const href = `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${encodeURIComponent(message)}`;
  return (
    <div className="glow-lux relative overflow-hidden rounded-[28px] border border-line px-6 py-12 text-center sm:px-10 sm:py-16">
      <div aria-hidden className="lux-grid-bg absolute inset-0" />
      <div className="relative mx-auto max-w-2xl">
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 text-pretty text-base text-ink-2 sm:text-lg">{text}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button href={href} variant="whatsapp" size="lg">
            <WhatsAppIcon size={20} />
            Escribir por WhatsApp
          </Button>
          <Button href="/#contact" variant="secondary" size="lg">
            Dejar mis datos
          </Button>
        </div>
      </div>
    </div>
  );
}
