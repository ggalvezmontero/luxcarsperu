import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cómo funciona la importación paso a paso",
  description:
    "De la búsqueda en Miami a la entrega en Lima: inspección certificada, tránsito marítimo, nacionalización SUNAT, homologación y placas. El proceso completo explicado.",
  alternates: { canonical: "/como-funciona" },
};

import Contenido from "./Contenido";

export default function Page() {
  return <Contenido />;
}
