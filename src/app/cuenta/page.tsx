import type { Metadata } from "next";
import { CuentaScreen } from "@/components/cuenta/CuentaScreen";

export const metadata: Metadata = {
  title: "Mis solicitudes",
};

/** No lee datos en el servidor a propósito: todo lo pide el cliente con su sesión. */
export default function CuentaPage() {
  return <CuentaScreen />;
}
