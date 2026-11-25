import type { Metadata } from "next";
import { ImportacionScreen } from "./ImportacionScreen";

/**
 * /cuenta/importaciones/[codigo] — avance de una importación a pedido, para
 * el cliente. No lee datos en el servidor: la pantalla consulta las vistas
 * del cliente con su sesión. Hereda `noindex` del layout de /cuenta.
 */
export const metadata: Metadata = {
  title: "Mi importación",
};

export default async function ImportacionPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return <ImportacionScreen codigo={decodeURIComponent(codigo)} />;
}
