import type { Metadata } from "next";
import { SolicitudVentaForm } from "@/components/cuenta/SolicitudVentaForm";

export const metadata: Metadata = {
  title: "Publicar mi auto",
};

export default function CuentaVenderPage() {
  return <SolicitudVentaForm />;
}
