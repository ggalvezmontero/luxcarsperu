import { Button } from "@/components/Button";
import { Section } from "@/components/ui/Section";
import { LUXCARS_CONFIG } from "@/lib/config";

/**
 * Estado "sin base de datos": el despliegue no tiene Supabase configurado, así
 * que no hay cuentas. Se dice tal cual y se ofrece WhatsApp, que es el canal
 * que siempre funciona.
 */
export function SinCuentas() {
  return (
    <Section tone="bg" padding="tight">
      <div className="mx-auto max-w-xl rounded-[22px] border border-warn/30 bg-warn/5 p-6 text-center">
        <p className="text-lg font-semibold text-ink">Las cuentas todavía no están activas</p>
        <p className="mt-2 text-sm text-ink-3">
          Este despliegue no tiene base de datos configurada. Escríbenos por WhatsApp y te atendemos igual.
        </p>
        <Button href={`https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`} variant="whatsapp" className="mt-5">
          Escribir por WhatsApp
        </Button>
      </div>
    </Section>
  );
}
