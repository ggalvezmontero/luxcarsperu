import type { Metadata } from "next";
import { SolicitudCompraForm } from "@/components/cuenta/SolicitudCompraForm";

export const metadata: Metadata = {
  title: "Pedir un auto",
};

export default function CuentaComprarPage() {
  return <SolicitudCompraForm />;
}
