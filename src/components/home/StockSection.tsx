import { getStock } from "@/lib/stock";
import { Button } from "../Button";
import { VehicleCard } from "../VehicleCard";
import { Icon } from "../ui/Icon";
import { Section, SectionHeader } from "../ui/Section";
import { Badge } from "../ui/Badge";

export async function StockSection() {
  const stock = await getStock(6);
  const demo = stock.some((v) => v.isDemo);

  return (
    <Section id="stock" tone="void">
      <SectionHeader
        eyebrow="Disponible en Lima"
        title="Stock verificado, listo para entregar"
        description="Cada unidad está en San Isidro, con documentos en regla. Sin esperas de importación."
        action={
          <Button href="/comprar" variant="secondary">
            Ver todo el stock
            <Icon name="arrowRight" size={16} />
          </Button>
        }
      />

      {demo ? (
        <div className="mt-6">
          <Badge tone="warn">Unidades de demostración</Badge>
        </div>
      ) : null}

      {stock.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stock.map((v, i) => (
            <VehicleCard key={v.id} vehicle={v} priority={i < 3} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-[22px] border border-dashed border-line-strong p-10 text-center">
          <p className="text-lg font-semibold text-ink">Todo el stock se vendió.</p>
          <p className="mt-2 text-sm text-ink-3">Déjanos tu búsqueda y te avisamos cuando entre una unidad.</p>
          <Button href="/comprar" className="mt-6">Dejar mi búsqueda</Button>
        </div>
      )}
    </Section>
  );
}
